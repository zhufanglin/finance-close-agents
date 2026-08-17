import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 指挥中心统计（演示数据实时查询）
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const [
    bankTxCount, ledgerCount, unmatchedBank, flaggedBank,
    invoiceCount, pendingInvoices, lowConfInvoices,
    pendingProposals, approvedProposals, voucherCount,
    auditLogs, partners, subjects, accounts,
  ] = await Promise.all([
    prisma.bankTransaction.count(),
    prisma.ledgerEntry.count(),
    prisma.bankTransaction.count({ where: { matchStatus: 'unmatched' } }),
    prisma.bankTransaction.count({ where: { matchStatus: 'flagged' } }),
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: 'pending' } }),
    prisma.invoice.count({ where: { confidence: { lt: 0.8 } } }),
    prisma.proposal.count({ where: { status: 'pending' } }),
    prisma.proposal.count({ where: { status: 'approved' } }),
    prisma.voucher.count(),
    prisma.auditLog.count(),
    prisma.partner.count(),
    prisma.subject.count(),
    prisma.bankAccount.count(),
  ]);

  return NextResponse.json({
    period: '2026-07',
    bank: { total: bankTxCount, ledger: ledgerCount, unmatched: unmatchedBank, flagged: flaggedBank },
    invoice: { total: invoiceCount, pending: pendingInvoices, lowConfidence: lowConfInvoices },
    proposal: { pending: pendingProposals, approved: approvedProposals },
    voucher: { total: voucherCount },
    audit: { logs: auditLogs },
    master: { partners, subjects, accounts },
    generatedAt: new Date().toISOString(),
  });
}
