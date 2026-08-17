import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 发票中心：发票列表
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
  });

  return NextResponse.json({
    invoices,
    summary: {
      total: invoices.length,
      pending: invoices.filter((i) => i.status === 'pending').length,
      verified: invoices.filter((i) => i.status === 'verified').length,
      voucherized: invoices.filter((i) => i.status === 'voucherized').length,
      lowConfidence: invoices.filter((i) => i.confidence < 0.8).length,
      totalAmount: invoices.reduce((s, i) => s + i.totalAmount, 0),
    },
  });
}
