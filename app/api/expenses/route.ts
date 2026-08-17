import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { classifyTransaction } from '@/lib/llm';

// 费用报销：列表 + 提交（规则审核 + AI 科目建议）
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const claims = await prisma.expenseClaim.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ claims });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const employee = String(body.employee || '').trim();
  const department = String(body.department || '').trim();
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);
  const invoiceNos = String(body.invoiceNos || '').trim();

  if (!employee || !department || !category || !description) {
    return NextResponse.json({ error: '请填写完整：提交人、部门、类别、事由' }, { status: 400 });
  }
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: '报销金额必须大于 0' }, { status: 400 });
  }

  // ===== 规则审核（本地，零成本零延迟）=====
  const rules: Array<{ rule: string; pass: boolean; note: string }> = [];

  // 规则1：发票核验（填了发票号则必须在发票库中且已查验）
  if (invoiceNos) {
    const nos = invoiceNos.split(/[,，\s]+/).filter(Boolean);
    for (const no of nos) {
      const inv = await prisma.invoice.findUnique({ where: { invoiceNo: no } });
      if (!inv) {
        rules.push({ rule: '发票关联', pass: false, note: `发票 ${no} 不在本系统发票库，需先上传影像或数电票` });
      } else if (inv.checkStatus !== 'verified') {
        rules.push({ rule: '发票查验', pass: false, note: `发票 ${no} 尚未通过查验（当前 ${inv.checkStatus}）` });
      } else {
        rules.push({ rule: '发票查验', pass: true, note: `发票 ${no} 已查验一致（价税合计 ¥${inv.totalAmount.toFixed(2)}）` });
      }
    }
  } else {
    rules.push({ rule: '发票关联', pass: true, note: '无票报销（小额/补贴类），免查验' });
  }

  // 规则2：大额报销需总监加签
  if (amount > 5000) {
    rules.push({ rule: '额度控制', pass: false, note: `金额 ¥${amount.toFixed(2)} 超过 ¥5,000，需部门总监加签后才能过审` });
  } else {
    rules.push({ rule: '额度控制', pass: true, note: '金额在常规审批额度内' });
  }

  // 规则3：业务招待费税前扣除提示
  if (category.includes('招待')) {
    rules.push({ rule: '税务合规', pass: true, note: '业务招待费按发生额 60% 且不超过营收 0.5% 税前扣除，请在备注中注明招待对象' });
  }

  // ===== AI 科目建议（DeepSeek，失败自动降级规则）=====
  const ai = await classifyTransaction(`${category} ${description}`, employee, { scene: 'expense' });
  rules.push({
    rule: 'AI 科目建议',
    pass: true,
    note: `建议入账科目 ${ai.data.subjectCode}（${ai.data.category}，置信度 ${(ai.data.confidence * 100).toFixed(0)}%）${ai.degraded ? '· AI 不可用，规则给出' : ''}`,
  });

  // 单号：BX-202607-0xx
  const count = await prisma.expenseClaim.count();
  const claimNo = `BX-202607-${String(count + 1).padStart(3, '0')}`;

  const claim = await prisma.expenseClaim.create({
    data: {
      claimNo,
      employee,
      department,
      category,
      subjectCode: ai.data.subjectCode,
      amount,
      description,
      invoiceNos: invoiceNos || null,
      aiCheck: JSON.stringify({ rules, aiSuggestion: ai.data, degraded: ai.degraded, usage: ai.usage }),
      status: 'submitted',
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: 'human',
      actor: session,
      module: 'expense',
      action: 'submit',
      detail: JSON.stringify({ claimNo, amount, category, subjectCode: ai.data.subjectCode, rulesPassed: rules.filter((r) => r.pass).length, rulesTotal: rules.length }),
    },
  });

  return NextResponse.json({ ok: true, claim });
}
