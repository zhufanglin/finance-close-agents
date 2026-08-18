import { prisma } from '@/lib/db';

// ============ DeepSeek 真实调用封装 ============
// 设计原则：每次调用留审计（token 成本），失败自动降级，绝不让演示现场卡死

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// DeepSeek 官方定价（元/百万 token，演示用途记录近似成本）
const PRICE_INPUT = 1;
const PRICE_OUTPUT = 2;

export interface ChatResult {
  ok: boolean;
  content: string;
  degraded: boolean; // true = LLM 失败，走了规则降级
  usage?: { prompt: number; completion: number; costYuan: number };
  error?: string;
}

interface ChatOptions {
  system?: string;
  temperature?: number;
  timeoutMs?: number;
  module?: string; // 审计用：reconciliation / invoice / ...
  action?: string; // 审计用：explain / extract / classify
  detail?: Record<string, unknown>; // 审计附加信息
}

/** 底座：单次 chat 调用，带超时、审计、错误吞噬 */
async function chat(userPrompt: string, opts: ChatOptions = {}): Promise<ChatResult> {
  const { system, temperature = 0.1, timeoutMs = 45000, module = 'system', action = 'chat', detail = {} } = opts;

  if (!API_KEY) {
    return { ok: false, content: '', degraded: true, error: '未配置 DEEPSEEK_API_KEY' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`DeepSeek HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const prompt = data.usage?.prompt_tokens ?? 0;
    const completion = data.usage?.completion_tokens ?? 0;
    const costYuan = (prompt / 1_000_000) * PRICE_INPUT + (completion / 1_000_000) * PRICE_OUTPUT;
    const latencyMs = Date.now() - t0;

    // 审计：AI 每次调用留痕（模型、token、成本）
    try {
      await prisma.auditLog.create({
        data: {
          actorType: 'ai',
          actor: `DeepSeek(${MODEL})`,
          module,
          action,
          detail: JSON.stringify({ ...detail, chars: content.length, latencyMs }),
          tokenCost: Math.round(costYuan * 10000) / 10000,
          model: MODEL,
        },
      });
    } catch {
      /* 审计失败不影响主流程 */
    }

    // 技术演示：写入 AI 调用明细（prompt/响应/token/耗时），供监控台展示
    try {
      await prisma.aiCallLog.create({
        data: {
          module, action, model: MODEL,
          prompt: userPrompt.slice(0, 2000),
          response: content.slice(0, 2000),
          tokensIn: prompt,
          tokensOut: completion,
          costYuan: Math.round(costYuan * 10000) / 10000,
          latencyMs,
          degraded: false,
        },
      });
    } catch {
      /* 明细写入失败不影响主流程 */
    }

    return { ok: true, content, degraded: false, usage: { prompt, completion, costYuan } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[llm] 调用失败，降级:', msg);
    const latencyMs = Date.now() - t0;
    // 失败也记录一条（标 degraded=true），让监控台能展示降级过程
    try {
      await prisma.aiCallLog.create({
        data: {
          module, action, model: MODEL,
          prompt: userPrompt.slice(0, 2000),
          response: '',
          tokensIn: 0, tokensOut: 0, costYuan: 0,
          latencyMs,
          degraded: true,
          error: msg.slice(0, 500),
        },
      });
    } catch {
      /* ignore */
    }
    return { ok: false, content: '', degraded: true, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** 从 LLM 回复中提取 JSON（容忍 ```json 包裹和前后废话） */
function extractJson<T>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

// ============ 业务方法一：发票字段抽取 ============

export interface ExtractedInvoice {
  invoiceNo: string;
  invoiceCode?: string;
  type: string;
  issueDate: string; // YYYY-MM-DD
  seller: string;
  buyer: string;
  amount: number; // 不含税
  taxRate: number; // 0.13
  taxAmount: number;
  totalAmount: number;
  category?: string; // 办公费/差旅费/服务费...
  confidence: number; // 0~1
}

/** 规则兜底：从 OCR 文本中正则抽取关键信息（LLM 不可用时） */
function extractInvoiceByRule(text: string): ExtractedInvoice {
  const num = (re: RegExp): number => {
    const m = text.match(re);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };
  const str = (re: RegExp): string => {
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const dateM = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) || text.match(/(\d{4}-\d{2}-\d{2})/);
  const issueDate = dateM
    ? dateM[0].includes('年')
      ? `${dateM[1]}-${String(dateM[2]).padStart(2, '0')}-${String(dateM[3]).padStart(2, '0')}`
      : dateM[1]
    : '';
  const amount = num(/(?:金额|不含税金额)[¥￥:：\s]*([\d,]+\.?\d*)/);
  const taxAmount = num(/(?:税额)[¥￥:：\s]*([\d,]+\.?\d*)/);
  const totalAmount = num(/(?:价税合计|小写)[¥￥:：\s]*([\d,]+\.?\d*)/);
  return {
    invoiceNo: str(/发票号码[：:\s]*(\d{8,20})/),
    type: text.includes('专用发票') ? '增值税专用发票' : text.includes('普通发票') ? '增值税普通发票' : '未知',
    issueDate,
    seller: str(/销\s*方?[：:\s]*([^\n\d]{4,30})/) || str(/销售方[：:\s]*([^\n\d]{4,30})/),
    buyer: str(/购\s*方?[：:\s]*([^\n\d]{4,30})/) || str(/购买方[：:\s]*([^\n\d]{4,30})/),
    amount,
    taxRate: totalAmount && amount ? Math.round((totalAmount / amount - 1) * 100) / 100 : 0,
    taxAmount,
    totalAmount,
    confidence: amount && totalAmount ? 0.5 : 0.2,
  };
}

export async function extractInvoice(
  ocrText: string,
  meta: Record<string, unknown> = {}
): Promise<{ data: ExtractedInvoice; degraded: boolean; usage?: ChatResult['usage'] }> {
  const system =
    '你是财务发票结构化专家。从 OCR 识别文本中抽取发票字段，只输出 JSON，不要任何解释。' +
    '字段：invoiceNo(发票号码), invoiceCode(发票代码,可为空), type(发票类型), issueDate(YYYY-MM-DD), ' +
    'seller(销方名称), buyer(购方名称), amount(不含税金额,数字), taxRate(税率小数如0.13), ' +
    'taxAmount(税额,数字), totalAmount(价税合计,数字), category(费用类别:办公费/差旅费/服务费/通讯费/其他), ' +
    'confidence(你对自己抽取结果的置信度0~1,文本残缺或字段模糊时给低分)。金额去掉¥和逗号。';

  const r = await chat(`OCR 文本如下：\n"""\n${ocrText}\n"""`, {
    system,
    module: 'invoice',
    action: 'extract',
    detail: { ...meta, ocrChars: ocrText.length },
  });

  const parsed = r.ok ? extractJson<Partial<ExtractedInvoice>>(r.content) : null;
  if (parsed && parsed.invoiceNo) {
    return {
      data: {
        invoiceNo: String(parsed.invoiceNo),
        invoiceCode: parsed.invoiceCode || '',
        type: parsed.type || '未知',
        issueDate: parsed.issueDate || '',
        seller: parsed.seller || '',
        buyer: parsed.buyer || '',
        amount: Number(parsed.amount) || 0,
        taxRate: Number(parsed.taxRate) || 0,
        taxAmount: Number(parsed.taxAmount) || 0,
        totalAmount: Number(parsed.totalAmount) || 0,
        category: parsed.category || '',
        confidence: Math.min(Math.max(Number(parsed.confidence) || 0.6, 0), 1),
      },
      degraded: false,
      usage: r.usage,
    };
  }
  // 降级：规则抽取
  return { data: extractInvoiceByRule(ocrText), degraded: true, usage: r.usage };
}

// ============ 业务方法二：对账差异解释 ============

export interface DiffExplanation {
  explanation: string; // 发生了什么
  suggestion: string; // 建议怎么处理
  severity: 'high' | 'medium' | 'low';
  confidence: number;
}

export async function explainDiff(
  bank: Record<string, unknown>,
  candidates: Record<string, unknown>[],
  meta: Record<string, unknown> = {}
): Promise<{ data: DiffExplanation; degraded: boolean; usage?: ChatResult['usage'] }> {
  const system =
    '你是资深财务对账专家。银行流水与账套（银行日记账）出现差异，请分析原因并给出处理建议。' +
    '只输出 JSON：{"explanation":"差异原因分析(通俗中文,120字内)","suggestion":"处理建议(80字内)",' +
    '"severity":"high|medium|low","confidence":0~1}。常见原因参考：银行手续费垫头差、' +
    '银行拆分入账、未达账项（在途资金）、记账串户、漏记账等。';

  const prompt =
    `待解释的银行流水：${JSON.stringify(bank)}\n\n` +
    `账套侧疑似相关记录（可能为空）：${JSON.stringify(candidates.slice(0, 5))}`;

  const r = await chat(prompt, {
    system,
    module: 'reconciliation',
    action: 'explain',
    detail: meta,
  });

  const parsed = r.ok ? extractJson<Partial<DiffExplanation>>(r.content) : null;
  if (parsed && parsed.explanation) {
    return {
      data: {
        explanation: parsed.explanation,
        suggestion: parsed.suggestion || '转人工核查',
        severity: (parsed.severity as DiffExplanation['severity']) || 'medium',
        confidence: Math.min(Math.max(Number(parsed.confidence) || 0.7, 0), 1),
      },
      degraded: false,
      usage: r.usage,
    };
  }

  // 降级：基于金额差的规则解释
  const bAmt = Number(bank.amount) || 0;
  const cAmt = candidates.length ? Number(candidates[0].amount) || 0 : 0;
  const diff = Math.abs(bAmt - cAmt);
  const rule: DiffExplanation =
    candidates.length === 0
      ? {
          explanation: `银行有一笔 ¥${bAmt.toFixed(2)} 的流水，账套侧未找到任何相关记录，符合「未达账项」特征——可能是月末在途资金或漏记账。`,
          suggestion: '请出纳核实原始回单，确认是否为在途资金（下月初自动到账）或漏记账（需补录凭证）。',
          severity: 'medium',
          confidence: 0.6,
        }
      : diff > 0 && diff <= 1
        ? {
            explanation: `银行金额与账套金额仅差 ¥${diff.toFixed(2)}，高度疑似银行手续费/垫头差，属于银企对账最常见的尾差。`,
            suggestion: '建议按「补提手续费」生成调整凭证：借-财务费用，贷-银行存款。',
            severity: 'low',
            confidence: 0.75,
          }
        : {
            explanation: `银行金额 ¥${bAmt.toFixed(2)} 与账套金额 ¥${cAmt.toFixed(2)} 差异 ¥${diff.toFixed(2)}，可能存在拆分入账或串户。`,
            suggestion: '请结合流水前后笔次核查是否为银行拆分入账，或转人工调阅原始凭证。',
            severity: 'high',
            confidence: 0.5,
          };
  return { data: rule, degraded: true, usage: r.usage };
}

// ============ 业务方法三：流水分类（导入时用） ============

export interface TxClassification {
  category: string; // 费用类别
  subjectCode: string; // 建议科目编码
  confidence: number;
}

const SUBJECT_RULES: Array<[RegExp, string, string]> = [
  [/短信|通讯|电话/, '通讯费', '6602.03'],
  [/手续费|管理费|年费|服务费/, '手续费', '6602.01'],
  [/工资|薪酬|社保|公积金/, '薪酬支出', '6601'],
  [/电费|水费|物业|房租|租赁/, '办公费用', '6602.02'],
  [/货款|采购|货品/, '采购货款', '1403'],
  [/税款|税务|增值税|所得税/, '税费', '2221'],
  [/利息/, '利息支出', '6603'],
];

export async function classifyTransaction(
  summary: string,
  counterparty: string,
  meta: Record<string, unknown> = {}
): Promise<{ data: TxClassification; degraded: boolean; usage?: ChatResult['usage'] }> {
  const subjects = await prisma.subject.findMany({ select: { code: true, name: true } }).catch(() => []);
  const system =
    '你是财务分类专家。根据银行流水摘要和对方户名判断费用类别并匹配会计科目。只输出 JSON：' +
    `{"category":"类别","subjectCode":"科目编码","confidence":0~1}。可用科目表：${JSON.stringify(subjects)}。`;

  const r = await chat(`摘要：${summary}\n对方户名：${counterparty}`, {
    system,
    module: 'reconciliation',
    action: 'classify',
    detail: meta,
  });

  const parsed = r.ok ? extractJson<Partial<TxClassification>>(r.content) : null;
  if (parsed && parsed.category) {
    return {
      data: {
        category: parsed.category,
        subjectCode: parsed.subjectCode || '',
        confidence: Math.min(Math.max(Number(parsed.confidence) || 0.6, 0), 1),
      },
      degraded: false,
      usage: r.usage,
    };
  }

  // 规则降级
  const hit = SUBJECT_RULES.find(([re]) => re.test(summary) || re.test(counterparty));
  return {
    data: hit
      ? { category: hit[1], subjectCode: hit[2], confidence: 0.65 }
      : { category: '其他', subjectCode: '6602.99', confidence: 0.3 },
    degraded: true,
    usage: r.usage,
  };
}

// ============ 技术演示：故意触发降级 ============
// 用 1ms 超时强制 abort，模拟 DeepSeek 不可用，记录一条 degraded=true 的 AiCallLog，
// 然后返回规则引擎兜底结果，证明「AI 失败不阻塞流程」
export async function triggerDegradeDemo(): Promise<{
  ok: boolean;
  degraded: boolean;
  error: string;
  fallback: { category: string; subjectCode: string; confidence: number };
  latencyMs: number;
}> {
  const t0 = Date.now();
  const r = await chat('这是一次故意超时的降级演示调用', {
    module: 'demo',
    action: 'degrade-demo',
    timeoutMs: 1,
    detail: { purpose: '技术演示-故意超时' },
  });
  return {
    ok: r.ok,
    degraded: r.degraded,
    error: r.error || '',
    fallback: { category: '其他', subjectCode: '6602.99', confidence: 0.3 },
    latencyMs: Date.now() - t0,
  };
}
