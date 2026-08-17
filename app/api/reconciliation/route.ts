import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 银企对账数据：银行流水（含匹配到的账套记录）+ 账套侧未匹配记录
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const [bank, ledgerOnly, accounts] = await Promise.all([
    prisma.bankTransaction.findMany({
      orderBy: [{ txDate: 'desc' }, { id: 'desc' }],
      include: {
        ledgerEntry: true,
        account: { select: { bankName: true, accountNo: true } },
      },
    }),
    prisma.ledgerEntry.findMany({
      where: { matchStatus: { not: 'matched' }, matchedBank: null },
      orderBy: [{ txDate: 'desc' }, { id: 'desc' }],
      include: { account: { select: { bankName: true, accountNo: true } } },
    }),
    prisma.bankAccount.findMany(),
  ]);

  return NextResponse.json({
    period: '2026-07',
    bank,
    ledgerOnly,
    accounts,
    summary: {
      total: bank.length,
      matched: bank.filter((b) => b.matchStatus === 'matched').length,
      unmatched: bank.filter((b) => b.matchStatus === 'unmatched').length,
      flagged: bank.filter((b) => b.matchStatus === 'flagged').length,
    },
  });
}
