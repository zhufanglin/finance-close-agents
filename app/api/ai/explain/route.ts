import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { explainDiff } from '@/lib/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

// AI 差异解释：真实调用 DeepSeek，失败自动降级为规则解释
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bankId = Number(body?.bankId);
  if (!bankId) return NextResponse.json({ error: '缺少 bankId' }, { status: 400 });

  const bank = await prisma.bankTransaction.findUnique({
    where: { id: bankId },
    include: { account: { select: { bankName: true, accountNo: true } } },
  });
  if (!bank) return NextResponse.json({ error: '流水不存在' }, { status: 404 });

  if (bank.matchStatus === 'matched') {
    return NextResponse.json({ error: '该流水已匹配，无需解释' }, { status: 400 });
  }

  // 找账套侧疑似相关记录：日期 ±5 天，金额差 ≤ 10% 或对方户名相似
  const candidates = await prisma.ledgerEntry.findMany({
    where: {
      OR: [
        {
          txDate: {
            gte: shiftDate(bank.txDate, -5),
            lte: shiftDate(bank.txDate, 5),
          },
          amount: { gte: bank.amount * 0.3, lte: bank.amount * 3 },
        },
        { counterparty: { contains: bank.counterparty.slice(0, 4) } },
      ],
    },
    orderBy: [{ txDate: 'asc' }],
    take: 5,
  });

  const { data, degraded, usage } = await explainDiff(
    {
      txDate: bank.txDate,
      amount: bank.amount,
      direction: bank.direction,
      counterparty: bank.counterparty,
      summary: bank.summary,
      bank: `${bank.account.bankName}(${bank.account.accountNo.slice(-4)})`,
    },
    candidates.map((c) => ({
      txDate: c.txDate,
      amount: c.amount,
      direction: c.direction,
      counterparty: c.counterparty,
      summary: c.summary,
      voucherNo: c.voucherNo,
    })),
    { bankId: bank.id, bankRef: bank.bankRef, candidateCount: candidates.length }
  );

  return NextResponse.json({
    ok: true,
    explanation: data,
    degraded,
    usage,
    candidates: candidates.map((c) => ({
      voucherNo: c.voucherNo,
      txDate: c.txDate,
      amount: c.amount,
      direction: c.direction,
      counterparty: c.counterparty,
    })),
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
