import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 审计日志（倒序，最多 200 条）
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const logs = await prisma.auditLog.findMany({
    orderBy: { ts: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    logs,
    summary: {
      total: logs.length,
      human: logs.filter((l) => l.actorType === 'human').length,
      ai: logs.filter((l) => l.actorType === 'ai').length,
      system: logs.filter((l) => l.actorType === 'system').length,
      tokenCost: logs.reduce((s, l) => s + (l.tokenCost || 0), 0),
    },
  });
}
