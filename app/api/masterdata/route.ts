import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 主数据：科目 / 客商 / 银行账户
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const [subjects, partners, accounts] = await Promise.all([
    prisma.subject.findMany({ orderBy: { code: 'asc' } }),
    prisma.partner.findMany({ orderBy: { code: 'asc' } }),
    prisma.bankAccount.findMany({ orderBy: { id: 'asc' } }),
  ]);
  return NextResponse.json({ subjects, partners, accounts });
}
