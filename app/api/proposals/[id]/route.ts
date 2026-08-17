import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 审批决策：人工对 AI 提案 通过 / 驳回（铁律：人没点头，账不改）
// Step 5 升级：通过的提案若 payload.entries 含凭证分录，事务内自动生成凭证并回写 voucherId
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

  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) return NextResponse.json({ error: '提案不存在' }, { status: 404 });
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: '该提案已处理过' }, { status: 409 });
  }

  // 解析提案 payload：判断是否需要自动生成凭证
  let entries: Array<{ subjectCode: string; subjectName: string; direction: string; amount: number; summary?: string }> = [];
  let payloadAction = 'none';
  try {
    const payload = JSON.parse(proposal.payload || '{}');
    payloadAction = payload.action || (Array.isArray(payload.entries) && payload.entries.length > 0 ? 'voucher' : 'none');
    if (Array.isArray(payload.entries)) entries = payload.entries;
  } catch {
    /* payload 非法则不生成凭证 */
  }

  const status = action === 'approve' ? 'approved' : 'rejected';

  // 生成本案凭证号（记-07xx 序列，避开 seed 已占用的号段）
  const genVoucherNo = async (): Promise<string> => {
    const count = await prisma.voucher.count();
    for (let i = count + 1; i < count + 50; i++) {
      const no = `记-${String(750 + i).padStart(4, '0')}`;
      const dup = await prisma.voucher.findUnique({ where: { voucherNo: no } });
      if (!dup) return no;
    }
    return `记-AI-${Date.now().toString().slice(-6)}`;
  };

  // 驳回 / 无分录提案（仅备案说明类）：维持原流程
  if (action === 'reject' || payloadAction !== 'voucher' || entries.length < 2) {
    const [updated] = await prisma.$transaction([
      prisma.proposal.update({
        where: { id },
        data: { status, decidedAt: new Date(), decidedBy: session },
      }),
      prisma.approvalRecord.create({
        data: { proposalId: id, action, actor: session, comment },
      }),
      prisma.auditLog.create({
        data: {
          actorType: 'human',
          actor: session,
          module: proposal.type,
          action: action === 'approve' ? 'approve' : 'reject',
          detail: JSON.stringify({ proposalId: id, title: proposal.title, comment, aiAgent: proposal.aiAgent }),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, proposal: updated, voucher: null });
  }

  // ===== 通过 + 含凭证分录：事务内「审批记录 + 凭证 + 分录 + 审计」一体落库 =====
  const voucherNo = await genVoucherNo();
  const totalDebit = entries
    .filter((e) => e.direction === '借')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const tx = await prisma.$transaction([
    prisma.proposal.update({
      where: { id },
      data: { status, decidedAt: new Date(), decidedBy: session },
    }),
    prisma.approvalRecord.create({
      data: { proposalId: id, action, actor: session, comment },
    }),
    prisma.voucher.create({
      data: {
        voucherNo,
        voucherDate: new Date().toISOString().slice(0, 10),
        summary: `AI提案#${id} ${proposal.title}`.slice(0, 100),
        source: proposal.type === 'reconciliation' ? 'bank' : proposal.type,
        status: 'posted', // 人工已批即过账（演示系统约定）
        totalDebit,
        createdBy: proposal.aiAgent,
        approvedBy: session,
        items: {
          create: entries.map((e) => ({
            subjectCode: String(e.subjectCode || ''),
            subjectName: String(e.subjectName || ''),
            direction: e.direction === '贷' ? '贷' : '借',
            amount: Number(e.amount) || 0,
            summary: e.summary || null,
          })),
        },
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'human',
        actor: session,
        module: proposal.type,
        action: 'approve',
        detail: JSON.stringify({ proposalId: id, title: proposal.title, comment, aiAgent: proposal.aiAgent }),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'system',
        actor: '凭证生成Agent',
        module: proposal.type,
        action: 'post',
        detail: JSON.stringify({
          proposalId: id,
          voucherNo,
          entries: entries.length,
          totalDebit,
          trigger: `人工审批通过（${session}）后自动过账`,
        }),
      },
    }),
  ]);

  const updated = tx[0];
  const voucher = tx[2]; // 第3个操作才是 voucher.create（第2个是 approvalRecord）

  // 回写凭证关联（提案 → 凭证可追溯）
  await prisma.proposal.update({ where: { id }, data: { voucherId: voucher.id } });
  const finalProposal = await prisma.proposal.findUnique({ where: { id } });
  const voucherWithItems = await prisma.voucher.findUnique({ where: { id: voucher.id }, include: { items: true } });

  return NextResponse.json({ ok: true, proposal: finalProposal, voucher: voucherWithItems });
}
