import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// AI 提案列表（含审批记录）
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const proposals = await prisma.proposal.findMany({
    orderBy: { createdAt: 'desc' },
    include: { approvals: true, voucher: { select: { id: true, voucherNo: true, totalDebit: true, status: true } } },
  });

  return NextResponse.json({
    proposals,
    summary: {
      pending: proposals.filter((p) => p.status === 'pending').length,
      approved: proposals.filter((p) => p.status === 'approved').length,
      rejected: proposals.filter((p) => p.status === 'rejected').length,
    },
  });
}
