import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 发票原图读取：用于前端展示上传的发票图片，供用户对照抽取结果
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: '参数错误' }, { status: 400 });

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return NextResponse.json({ error: '发票不存在' }, { status: 404 });
  if (!inv.filePath) return NextResponse.json({ error: '该发票无原图（数电票 XML 通道无图片）' }, { status: 404 });

  try {
    const buf = await fs.readFile(inv.filePath);
    const ext = path.extname(inv.filePath).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' ? 'jpeg' : ext === 'xml' ? 'xml' : ext;
    return new NextResponse(buf, {
      headers: {
        'Content-Type': `image/${mime}`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: '图片文件缺失' }, { status: 404 });
  }
}
