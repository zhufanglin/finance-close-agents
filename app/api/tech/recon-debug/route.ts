import { NextResponse } from 'next/server';
import { runReconEngine, type ReconOptions } from '@/lib/recon';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 对账引擎调试台：用可调阈值跑引擎（只读，不落库），返回匹配结果与原始笔数
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(req.url);
  const p = url.searchParams;
  const opts: ReconOptions = {
    amountTol: p.get('amountTol') ? Number(p.get('amountTol')) : undefined,
    dateWindow: p.get('dateWindow') ? Number(p.get('dateWindow')) : undefined,
    tailDiffMax: p.get('tailDiffMax') ? Number(p.get('tailDiffMax')) : undefined,
    splitDateWindow: p.get('splitDateWindow') ? Number(p.get('splitDateWindow')) : undefined,
  };
  // 过滤 undefined
  Object.keys(opts).forEach((k) => opts[k as keyof ReconOptions] === undefined && delete opts[k as keyof ReconOptions]);

  const result = await runReconEngine(opts);

  const [bankCount, ledgerCount] = await Promise.all([
    prisma.bankTransaction.count({ where: { matchStatus: { not: 'matched' } } }),
    prisma.ledgerEntry.count({ where: { matchStatus: { not: 'matched' } } }),
  ]);

  return NextResponse.json({
    params: {
      amountTol: opts.amountTol ?? 0.005,
      dateWindow: opts.dateWindow ?? 3,
      tailDiffMax: opts.tailDiffMax ?? 1.0,
      splitDateWindow: opts.splitDateWindow ?? 5,
    },
    input: { unmatchedBank: bankCount, unmatchedLedger: ledgerCount },
    result: {
      autoMatched: result.autoMatched.length,
      splitMatches: result.splitMatches.length,
      amountDiffs: result.amountDiffs.length,
      bankOnly: result.bankOnly.length,
      ledgerOnly: result.ledgerOnly.length,
    },
    details: result,
  });
}
