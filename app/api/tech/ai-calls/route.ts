import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200);

  const [calls, agg] = await Promise.all([
    prisma.aiCallLog.findMany({
      orderBy: { id: 'desc' },
      take: limit,
    }),
    prisma.aiCallLog.aggregate({
      _count: true,
      _sum: { tokensIn: true, tokensOut: true, costYuan: true },
    }),
  ]);

  return NextResponse.json({
    calls,
    summary: {
      total: agg._count,
      tokensIn: agg._sum.tokensIn || 0,
      tokensOut: agg._sum.tokensOut || 0,
      costYuan: Math.round((agg._sum.costYuan || 0) * 10000) / 10000,
      degraded: calls.filter((c) => c.degraded).length,
    },
  });
}
