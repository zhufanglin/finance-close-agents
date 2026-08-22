import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 发票人工核验通过：低置信度发票经人工对照原图确认无误后，置为已查验（可参与报销）
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: '发票不存在' }, { status: 404 });

  await prisma.invoice.update({
    where: { id },
    data: { checkStatus: 'verified' },
  });

  await prisma.auditLog.create({
    data: {
      actorType: 'human',
      actor: session,
      module: 'invoice',
      action: 'verify',
      detail: JSON.stringify({
        invoiceNo: inv.invoiceNo,
        reason: '人工核验通过（低置信度发票人工复核）',
        confidence: inv.confidence,
        from: 'unchecked',
        to: 'verified',
      }),
    },
  });

  return NextResponse.json({ ok: true, invoiceNo: inv.invoiceNo });
}
