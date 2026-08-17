import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 报销审批：通过 → 自动生成凭证（借:费用科目 / 贷:库存现金）
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const comment = (body.comment as string) || '';

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action 必须是 approve 或 reject' }, { status: 400 });
  }

  const claim = await prisma.expenseClaim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: '报销单不存在' }, { status: 404 });
  if (claim.status !== 'submitted') {
    return NextResponse.json({ error: '该报销单已处理过' }, { status: 409 });
  }

  // 大额规则未过 → 拒绝自动过账，要求线下加签
  if (action === 'approve') {
    let checks: { rules?: Array<{ rule: string; pass: boolean; note: string }> } = {};
    try { checks = JSON.parse(claim.aiCheck || '{}'); } catch { /* ignore */ }
    const blocking = (checks.rules || []).filter((r) => !r.pass && r.rule !== 'AI 科目建议' && r.rule !== '税务合规');
    if (blocking.length > 0) {
      return NextResponse.json(
        { error: `规则未全部通过：${blocking.map((b) => b.note).join('；')}` },
        { status: 400 }
      );
    }
  }

  if (action === 'reject') {
    const updated = await prisma.expenseClaim.update({
      where: { id },
      data: { status: 'rejected', decidedAt: new Date(), decidedBy: session },
    });
    await prisma.auditLog.create({
      data: {
        actorType: 'human', actor: session, module: 'expense', action: 'reject',
        detail: JSON.stringify({ claimNo: claim.claimNo, comment }),
      },
    });
    return NextResponse.json({ ok: true, claim: updated, voucher: null });
  }

  // ===== 通过：费用科目（AI 建议码 → 科目表回查名称，兜底 6602 管理费用）=====
  const subject = (await prisma.subject.findUnique({ where: { code: claim.subjectCode || '' } })) ||
    (await prisma.subject.findUnique({ where: { code: '6602' } }));
  const debitCode = subject?.code || '6602';
  const debitName = subject?.name || '管理费用';

  const cash = await prisma.subject.findUnique({ where: { code: '1001' } });

  // 凭证号：记-76xx 序列（与对账凭证 75xx 区分）
  let voucherNo = '';
  for (let i = 1; i < 50; i++) {
    const no = `记-76${String(i).padStart(2, '0')}`;
    const dup = await prisma.voucher.findUnique({ where: { voucherNo: no } });
    if (!dup) { voucherNo = no; break; }
  }
  if (!voucherNo) voucherNo = `记-EX-${Date.now().toString().slice(-6)}`;

  const tx = await prisma.$transaction([
    prisma.expenseClaim.update({
      where: { id },
      data: { status: 'approved', decidedAt: new Date(), decidedBy: session, voucherNo },
    }),
    prisma.voucher.create({
      data: {
        voucherNo,
        voucherDate: new Date().toISOString().slice(0, 10),
        summary: `报销 ${claim.claimNo} ${claim.employee} ${claim.category}`.slice(0, 100),
        source: 'expense',
        status: 'posted',
        totalDebit: claim.amount,
        createdBy: '费用报销Agent',
        approvedBy: session,
        items: {
          create: [
            { subjectCode: debitCode, subjectName: debitName, direction: '借', amount: claim.amount, summary: `${claim.employee} ${claim.category}` },
            { subjectCode: cash?.code || '1001', subjectName: cash?.name || '库存现金', direction: '贷', amount: claim.amount, summary: `报销支付 ${claim.claimNo}` },
          ],
        },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'human', actor: session, module: 'expense', action: 'approve',
        detail: JSON.stringify({ claimNo: claim.claimNo, amount: claim.amount, comment }),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'system', actor: '凭证生成Agent', module: 'expense', action: 'post',
        detail: JSON.stringify({ claimNo: claim.claimNo, voucherNo, trigger: `人工审批通过（${session}）后自动过账` }),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, claim: tx[0], voucher: { voucherNo, debit: `${debitCode} ${debitName}`, amount: claim.amount } });
}
