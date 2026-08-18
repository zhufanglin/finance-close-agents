'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Terminal, Cpu, Network, SlidersHorizontal, Database, ShieldAlert,
  Code, ChevronDown, Play, Zap, AlertTriangle, Check, X, Loader2,
  RefreshCw, ArrowRight,
} from 'lucide-react';

type Tab = { key: string; label: string; icon: typeof Terminal };
const TABS: Tab[] = [
  { key: 'ai', label: 'AI 调用监控台', icon: Cpu },
  { key: 'arch', label: '架构与数据流', icon: Network },
  { key: 'recon', label: '对账引擎调试台', icon: SlidersHorizontal },
  { key: 'schema', label: '数据模型', icon: Database },
  { key: 'security', label: '安全与降级', icon: ShieldAlert },
  { key: 'api', label: 'API 清单', icon: Code },
];

export default function TechPage() {
  const [tab, setTab] = useState('ai');
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Terminal size={18} className="text-brand-600" />
        <div className="text-[15px] font-medium text-ink-primary">技术演示中心</div>
        <span className="text-xs text-ink-tertiary">面向技术评审 · 可观测性 / 可控性 / 真实集成</span>
      </div>

      {/* Tab 栏 */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-2 text-[13px] flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-brand-600 text-brand-600 font-medium' : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ai' && <AiMonitorTab />}
      {tab === 'arch' && <ArchTab />}
      {tab === 'recon' && <ReconDebugTab />}
      {tab === 'schema' && <SchemaTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'api' && <ApiListTab />}
    </div>
  );
}

/* ============ ① AI 调用监控台 ============ */
type AiCall = {
  id: number; ts: string; module: string; action: string; model: string;
  prompt: string; response: string; tokensIn: number; tokensOut: number;
  costYuan: number; latencyMs: number; degraded: boolean; error: string | null;
};
function AiMonitorTab() {
  const [data, setData] = useState<{ calls: AiCall[]; summary: any } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/tech/ai-calls?limit=50')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const s = data?.summary;
  return (
    <div>
      {/* 汇总卡 */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {[
          { label: '总调用', value: s?.total ?? '-', color: 'text-ink-primary' },
          { label: '输入 token', value: s?.tokensIn ?? '-', color: 'text-blue-600' },
          { label: '输出 token', value: s?.tokensOut ?? '-', color: 'text-purple-600' },
          { label: '累计成本(¥)', value: s?.costYuan ?? '-', color: 'text-emerald-600' },
          { label: '降级次数', value: s?.degraded ?? 0, color: s?.degraded ? 'text-rose-600' : 'text-ink-secondary' },
        ].map((c) => (
          <div key={c.label} className="card p-3.5">
            <div className="text-xs text-ink-tertiary mb-1">{c.label}</div>
            <div className={`text-lg font-semibold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-ink-primary">调用流水（最近 50 条，倒序）</div>
        <button onClick={load} className="text-xs text-brand-600 flex items-center gap-1 hover:underline">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />刷新
        </button>
      </div>

      {!data ? (
        <div className="card p-8 text-center text-sm text-ink-tertiary">加载中…</div>
      ) : data.calls.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-tertiary">
          暂无 AI 调用记录。去「银企对账」点一次「一键对账」或「AI 解释」就会产生记录。
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.calls.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50/60"
              >
                <ChevronDown size={14} className={`text-ink-tertiary transition-transform ${expanded === c.id ? 'rotate-180' : ''}`} />
                <span className="text-xs font-mono text-ink-tertiary w-16">#{c.id}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-ink-secondary w-20 text-center">{c.module}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 w-16 text-center">{c.action}</span>
                <span className="text-xs text-ink-secondary flex-1 truncate">{c.prompt.slice(0, 60)}…</span>
                <span className="text-xs text-ink-tertiary w-24 text-right">{c.latencyMs}ms</span>
                <span className="text-xs text-ink-tertiary w-20 text-right">{c.tokensIn + c.tokensOut} tok</span>
                <span className="text-xs text-emerald-600 w-16 text-right">¥{c.costYuan.toFixed(4)}</span>
                {c.degraded ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 w-14 text-center">降级</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 w-14 text-center">正常</span>
                )}
              </button>
              {expanded === c.id && (
                <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 space-y-2">
                  {c.error && (
                    <div className="text-xs bg-rose-50 border border-rose-200 rounded p-2 text-rose-700">
                      <AlertTriangle size={12} className="inline mr-1" />错误：{c.error}
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] text-ink-tertiary mb-1">Prompt（用户输入）</div>
                    <pre className="text-xs bg-slate-900 text-slate-100 rounded p-2.5 overflow-x-auto max-h-40 whitespace-pre-wrap">{c.prompt}</pre>
                  </div>
                  {c.response && (
                    <div>
                      <div className="text-[11px] text-ink-tertiary mb-1">Response（DeepSeek 返回）</div>
                      <pre className="text-xs bg-slate-900 text-emerald-200 rounded p-2.5 overflow-x-auto max-h-40 whitespace-pre-wrap">{c.response}</pre>
                    </div>
                  )}
                  <div className="text-[11px] text-ink-tertiary">
                    模型 {c.model} · {c.ts}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ ② 架构与数据流 ============ */
function ArchTab() {
  const layers = [
    { title: '前端层', tech: 'Next.js 14 App Router + TypeScript + Tailwind', items: ['8 业务页面 + /tech 技术演示', 'client component 拉取 REST API', 'httpOnly cookie 会话'] },
    { title: 'API 层', tech: 'Next.js Route Handlers（/app/api/*）', items: ['20+ REST 端点', 'getSession 鉴权守卫', '事务内提案→审批→凭证'] },
    { title: '引擎/AI 层', tech: 'lib/recon.ts + lib/llm.ts', items: ['对账引擎：金额+日期+客商三重匹配', 'DeepSeek 封装：超时/降级/审计', '失败自动降级到规则兜底'] },
    { title: '集成层', tech: 'lib/ocr.ts + lib/eticket.ts + lib/import.ts', items: ['RapidOCR 本地子进程', '数电票 XML 宽标签解析（零 OCR）', '银行流水 CSV/Excel 万能列映射'] },
    { title: '数据层', tech: 'Prisma 6 + SQLite', items: ['12 张表', 'AiCallLog 记录每次 AI 调用明细', 'AuditLog 全链路审计留痕'] },
  ];
  return (
    <div>
      <div className="card p-4 mb-3">
        <div className="text-sm font-medium text-ink-primary mb-3">五层架构与数据流向</div>
        <div className="space-y-2">
          {layers.map((l, i) => (
            <div key={l.title}>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="w-1.5 h-10 rounded bg-brand-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-primary">{l.title}</span>
                    <span className="text-[11px] text-ink-tertiary">{l.tech}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {l.items.map((it) => (
                      <li key={it} className="text-xs text-ink-secondary flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-brand-400" />{it}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {i < layers.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowRight size={12} className="text-ink-tertiary rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-medium text-ink-primary mb-2">关键链路：一键对账 → AI 提案 → 审批过账</div>
        <pre className="text-[11px] leading-relaxed text-ink-secondary overflow-x-auto">{`用户点「一键对账」
  │
  ├─ /api/reconciliation/run
  │     └─ runReconEngine()  金额+日期+客商三重匹配（纯规则计算）
  │           ├─ autoMatched   → 落库 matched
  │           ├─ splitMatches  → 落库 matched（银行拆分入账）
  │           ├─ amountDiffs   → DeepSeek.explainDiff() → 生成提案
  │           ├─ bankOnly      → DeepSeek.explainDiff() → 生成提案
  │           └─ ledgerOnly    → DeepSeek.explainDiff() → 生成提案
  │
  ├─ 每条差异调用 lib/llm.ts chat()
  │     ├─ 成功 → AiCallLog(degraded=false) + AuditLog(token+cost)
  │     └─ 失败 → AiCallLog(degraded=true) + 规则兜底解释
  │
  └─ 人工到「审计中心」审批
        └─ /api/proposals/[id] POST approve
              └─ $transaction: Proposal.approved + Voucher + VoucherItem[] + AuditLog`}</pre>
      </div>
    </div>
  );
}

/* ============ ③ 对账引擎调试台 ============ */
function ReconDebugTab() {
  const [params, setParams] = useState({ amountTol: 0.005, dateWindow: 3, tailDiffMax: 1.0, splitDateWindow: 5 });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    const q = new URLSearchParams({
      amountTol: String(params.amountTol),
      dateWindow: String(params.dateWindow),
      tailDiffMax: String(params.tailDiffMax),
      splitDateWindow: String(params.splitDateWindow),
    });
    fetch(`/api/tech/recon-debug?${q}`)
      .then((r) => r.json())
      .then((d) => setResult(d))
      .finally(() => setLoading(false));
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const sliders = [
    { key: 'amountTol', label: '一对一金额容差(元)', min: 0, max: 5, step: 0.005 },
    { key: 'dateWindow', label: '一对一日期窗口(天)', min: 0, max: 14, step: 1 },
    { key: 'tailDiffMax', label: '尾差阈值(元)', min: 0, max: 50, step: 0.5 },
    { key: 'splitDateWindow', label: '拆分匹配日期窗口(天)', min: 0, max: 14, step: 1 },
  ];

  return (
    <div>
      <div className="card p-4 mb-3">
        <div className="text-sm font-medium text-ink-primary mb-3">可调参数（拖动后点「重跑」看匹配结果变化）</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {sliders.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-secondary">{s.label}</span>
                <span className="text-brand-600 font-mono">{params[s.key as keyof typeof params]}</span>
              </div>
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={params[s.key as keyof typeof params]}
                onChange={(e) => setParams({ ...params, [s.key]: Number(e.target.value) })}
                className="w-full accent-brand-600"
              />
            </div>
          ))}
        </div>
        <button onClick={run} disabled={loading} className="btn-primary mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}重跑引擎
        </button>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {[
              { label: '自动匹配', value: result.result.autoMatched, color: 'text-emerald-600' },
              { label: '拆分匹配', value: result.result.splitMatches, color: 'text-blue-600' },
              { label: '尾差', value: result.result.amountDiffs, color: 'text-amber-600' },
              { label: '银行有账上无', value: result.result.bankOnly, color: 'text-rose-600' },
              { label: '账上有银行无', value: result.result.ledgerOnly, color: 'text-purple-600' },
            ].map((c) => (
              <div key={c.label} className="card p-3 text-center">
                <div className={`text-xl font-semibold ${c.color}`}>{c.value}</div>
                <div className="text-[11px] text-ink-tertiary mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>
          <div className="card p-3.5">
            <div className="text-xs text-ink-tertiary">
              输入：未匹配银行流水 <b>{result.input.unmatchedBank}</b> 笔 / 账套记录 <b>{result.input.unmatchedLedger}</b> 笔
              <span className="mx-2">|</span>
              当前参数：金额容差 {result.params.amountTol} · 日期窗口 {result.params.dateWindow}d · 尾差阈值 {result.params.tailDiffMax} · 拆分窗口 {result.params.splitDateWindow}d
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============ ④ 数据模型 ============ */
function SchemaTab() {
  const tables = [
    { name: 'User', fields: ['id', 'username', 'password', 'name', 'role', 'createdAt'], desc: '演示账号' },
    { name: 'Subject', fields: ['id', 'code', 'name', 'type', 'direction', 'level'], desc: '会计科目' },
    { name: 'Partner', fields: ['id', 'code', 'name', 'type', 'taxId', 'bankAccount'], desc: '客商' },
    { name: 'BankAccount', fields: ['id', 'bankName', 'accountNo', 'accountName', 'currency', 'balance'], desc: '银行账户' },
    { name: 'BankTransaction', fields: ['id', 'accountId', 'txDate', 'amount', 'direction', 'counterparty', 'summary', 'bankRef', 'matchStatus', 'matchedLedgerId'], desc: '银行流水' },
    { name: 'LedgerEntry', fields: ['id', 'accountId', 'txDate', 'amount', 'direction', 'counterparty', 'summary', 'voucherNo', 'matchStatus'], desc: '账套流水' },
    { name: 'Invoice', fields: ['id', 'invoiceNo', 'type', 'issueDate', 'seller', 'buyer', 'amount', 'taxRate', 'taxAmount', 'totalAmount', 'sourceType', 'ocrText', 'confidence', 'checkStatus'], desc: '发票' },
    { name: 'Voucher', fields: ['id', 'voucherNo', 'voucherDate', 'summary', 'source', 'status', 'totalDebit', 'createdBy', 'approvedBy'], desc: '凭证' },
    { name: 'VoucherItem', fields: ['id', 'voucherId', 'subjectCode', 'subjectName', 'direction', 'amount', 'invoiceId'], desc: '凭证分录' },
    { name: 'ExpenseClaim', fields: ['id', 'claimNo', 'employee', 'department', 'category', 'subjectCode', 'amount', 'aiCheck', 'status', 'voucherNo'], desc: '报销单' },
    { name: 'Proposal', fields: ['id', 'type', 'title', 'aiAgent', 'aiReason', 'confidence', 'payload', 'status', 'voucherId'], desc: 'AI 提案' },
    { name: 'ApprovalRecord', fields: ['id', 'proposalId', 'action', 'actor', 'comment'], desc: '审批记录' },
    { name: 'AuditLog', fields: ['id', 'ts', 'actorType', 'actor', 'module', 'action', 'detail', 'tokenCost', 'model'], desc: '审计日志' },
    { name: 'AiCallLog', fields: ['id', 'ts', 'module', 'action', 'model', 'prompt', 'response', 'tokensIn', 'tokensOut', 'costYuan', 'latencyMs', 'degraded', 'error'], desc: 'AI 调用明细' },
  ];
  const [sel, setSel] = useState(tables[4].name);
  const t = tables.find((x) => x.name === sel)!;
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="col-span-1 space-y-1 max-h-[70vh] overflow-y-auto">
        {tables.map((tb) => (
          <button
            key={tb.name}
            onClick={() => setSel(tb.name)}
            className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono transition-colors ${
              sel === tb.name ? 'bg-brand-600 text-white' : 'text-ink-secondary hover:bg-slate-50'
            }`}
          >
            {tb.name}
            <span className={`block text-[10px] ${sel === tb.name ? 'text-brand-100' : 'text-ink-tertiary'}`}>{tb.desc}</span>
          </button>
        ))}
      </div>
      <div className="col-span-3 card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={14} className="text-brand-600" />
          <span className="text-sm font-mono font-medium">{t.name}</span>
          <span className="text-xs text-ink-tertiary">{t.desc}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-ink-secondary ml-auto">{t.fields.length} 字段</span>
        </div>
        <div className="space-y-0.5">
          {t.fields.map((f, i) => (
            <div key={f} className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-slate-50 font-mono text-xs">
              <span className="text-ink-tertiary w-5">{i + 1}.</span>
              <span className={i === 0 ? 'text-brand-600 font-medium' : 'text-ink-primary'}>{f}</span>
              {i === 0 && <span className="text-[10px] px-1 rounded bg-amber-50 text-amber-600 border border-amber-200">PK</span>}
              {f.endsWith('Id') && <span className="text-[10px] px-1 rounded bg-blue-50 text-blue-600 border border-blue-200">FK</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 text-[11px] text-ink-tertiary">SQLite 存储 · Prisma ORM · 共 {tables.length} 张表</div>
      </div>
    </div>
  );
}

/* ============ ⑤ 安全与降级 ============ */
function SecurityTab() {
  const [demo, setDemo] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const trigger = () => {
    setBusy(true);
    fetch('/api/tech/degrade-demo', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setDemo(d))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-3">
      {/* 鉴权流程 */}
      <div className="card p-4">
        <div className="text-sm font-medium text-ink-primary mb-3">鉴权流程</div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {[
            { t: '登录 POST /api/auth/login', d: '校验用户名密码' },
            { t: 'Set-Cookie fin_session', d: 'httpOnly · 7天 · 存用户名' },
            { t: '中间件 matcher', d: '保护 / 与 /api（除 login）' },
            { t: 'API getSession()', d: '每个路由首行校验' },
            { t: '未登录 → 401', d: '返回 {error:未登录}' },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="px-2.5 py-1.5 rounded bg-slate-50 border border-slate-100">
                <div className="text-ink-primary font-medium">{s.t}</div>
                <div className="text-[11px] text-ink-tertiary">{s.d}</div>
              </div>
              {i < arr.length - 1 && <ArrowRight size={12} className="text-ink-tertiary" />}
            </div>
          ))}
        </div>
      </div>

      {/* 降级演示 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-medium text-ink-primary">AI 超时降级演示</div>
            <div className="text-xs text-ink-tertiary mt-0.5">点按钮故意触发 DeepSeek 超时（timeout=1ms），看降级到规则引擎全过程</div>
          </div>
          <button onClick={trigger} disabled={busy} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}触发降级
          </button>
        </div>
        {demo && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <X size={14} className="text-rose-500" />
              <span className="text-ink-secondary">DeepSeek 调用结果：</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">degraded = true</span>
              <span className="text-ink-tertiary">耗时 {demo.degradeDemo.latencyMs}ms</span>
            </div>
            <div className="text-xs bg-rose-50 border border-rose-200 rounded p-2 text-rose-700">
              错误：{demo.degradeDemo.error}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Check size={14} className="text-emerald-500" />
              <span className="text-ink-secondary">规则兜底结果：</span>
              <span className="font-mono">科目 {demo.degradeDemo.fallback.subjectCode} · 置信度 {demo.degradeDemo.fallback.confidence}</span>
            </div>
            <div className="text-[11px] text-ink-tertiary">
              ✓ 已写入 AiCallLog（id={demo.latestLog?.id}，degraded=true），可在「AI 调用监控台」Tab 查到这条降级记录
            </div>
          </div>
        )}
      </div>

      {/* 规则拦截回放 */}
      <div className="card p-4">
        <div className="text-sm font-medium text-ink-primary mb-2">规则优先于 AI：大额报销拦截回放</div>
        <div className="text-xs text-ink-secondary space-y-1.5">
          <div>场景：报销单金额 ¥12,800，在「费用报销」页点「通过」</div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-mono">HTTP 400</span>
            <span className="text-ink-tertiary">→</span>
            <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">{demo?.ruleBlockExample?.response?.error || '该报销金额超过 5000 元，需总监加签后方可通过'}</code>
          </div>
          <div className="text-[11px] text-ink-tertiary mt-1">
            要点：即使 DeepSeek 已给出科目建议，规则仍能拦截审批 ——「人没点头，账不改」由代码强制保证，不是 AI 自觉。
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ ⑥ API 清单 ============ */
function ApiListTab() {
  const apis = [
    { group: '鉴权', items: [
      ['POST', '/api/auth/login', '用户名密码登录，下发 cookie', '公开'],
      ['POST', '/api/auth/logout', '清除会话', '已登录'],
    ]},
    { group: '指挥中心', items: [
      ['GET', '/api/stats', '6 项统计 + 月结进度', '已登录'],
      ['GET', '/api/agents', '5 Agent 实时状态', '已登录'],
    ]},
    { group: '银企对账', items: [
      ['GET', '/api/reconciliation', '银行流水 + 账套对照', '已登录'],
      ['POST', '/api/reconciliation/run', '一键对账：引擎匹配 + AI 提案', '已登录'],
      ['POST', '/api/reconciliation/import', '导入银行流水 CSV/Excel', '已登录'],
      ['POST', '/api/ai/explain', '单条差异 AI 解释', '已登录'],
    ]},
    { group: '发票', items: [
      ['GET', '/api/invoices', '发票列表', '已登录'],
      ['POST', '/api/invoices/upload', '上传图片/XML', '已登录'],
    ]},
    { group: '费用报销', items: [
      ['GET', '/api/expenses', '报销单列表', '已登录'],
      ['POST', '/api/expenses', '提交报销（触发 AI 审核）', '已登录'],
      ['POST', '/api/expenses/[id]', '审批报销单', '已登录'],
    ]},
    { group: '提案与审计', items: [
      ['GET', '/api/proposals', 'AI 提案列表', '已登录'],
      ['POST', '/api/proposals/[id]', '审批提案→自动过账', '已登录'],
      ['GET', '/api/audit', '审计日志', '已登录'],
    ]},
    { group: '主数据/质量/设置', items: [
      ['GET', '/api/masterdata', '科目/客商/账户', '已登录'],
      ['GET', '/api/dataquality', '7 项门禁 + 健康分', '已登录'],
      ['GET', '/api/settings', '集成状态 + 账号', '已登录'],
    ]},
    { group: '技术演示', items: [
      ['GET', '/api/tech/ai-calls', 'AI 调用明细流水', '已登录'],
      ['GET', '/api/tech/recon-debug', '对账引擎调试（可调阈值）', '已登录'],
      ['POST', '/api/tech/degrade-demo', '故意触发降级演示', '已登录'],
    ]},
  ];
  const methodColor: Record<string, string> = {
    GET: 'bg-blue-50 text-blue-600 border-blue-200',
    POST: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };
  return (
    <div className="space-y-3">
      {apis.map((g) => (
        <div key={g.group} className="card p-3.5">
          <div className="text-xs font-medium text-ink-tertiary mb-2">{g.group}</div>
          <table className="w-full text-xs">
            <tbody>
              {g.items.map((it, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 w-16">
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${methodColor[it[0] as string]}`}>{it[0]}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-ink-primary">{it[1]}</td>
                  <td className="py-1.5 pr-3 text-ink-secondary">{it[2]}</td>
                  <td className="py-1.5 text-right text-[11px] text-ink-tertiary">{it[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
