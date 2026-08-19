import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { parseEticketXml } from '@/lib/eticket';
import { runOcr } from '@/lib/ocr';
import { extractInvoice } from '@/lib/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// 发票上传：图片 → OCR → DeepSeek 结构化；数电票 XML → 直解析（零 OCR）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '未收到文件' }, { status: 400 });
  }

  const name = file.name || 'upload';
  const ext = path.extname(name).toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    // ---------- 通道一：数电票 XML 直解析 ----------
    if (ext === '.xml' || buf.slice(0, 5).toString().includes('<?xml')) {
      const xml = buf.toString('utf-8');
      const et = parseEticketXml(xml);
      if (!et.ok) return NextResponse.json({ error: et.error }, { status: 400 });

      const exist = await prisma.invoice.findUnique({ where: { invoiceNo: et.data!.invoiceNo } });
      if (exist) return NextResponse.json({ error: `发票 ${et.data!.invoiceNo} 已存在` }, { status: 409 });

      const inv = await prisma.invoice.create({
        data: {
          invoiceNo: et.data!.invoiceNo,
          type: et.data!.type,
          issueDate: et.data!.issueDate,
          seller: et.data!.seller,
          buyer: et.data!.buyer,
          amount: et.data!.amount,
          taxRate: et.data!.taxRate,
          taxAmount: et.data!.taxAmount,
          totalAmount: et.data!.totalAmount,
          sourceType: 'xml',
          confidence: 1, // XML 直解析 100% 准确
          status: 'verified',
          checkStatus: 'verified',
        },
      });
      await prisma.auditLog.create({
        data: {
          actorType: 'system',
          actor: session,
          module: 'invoice',
          action: 'import_xml',
          detail: JSON.stringify({ invoiceNo: inv.invoiceNo, total: inv.totalAmount, channel: '数电票XML直解析' }),
        },
      });
      return NextResponse.json({ ok: true, channel: 'xml', invoice: inv });
    }

    // ---------- 通道二：图片 → 本地 OCR → DeepSeek 结构化 ----------
    if (!['.jpg', '.jpeg', '.png', '.bmp', '.webp'].includes(ext)) {
      return NextResponse.json({ error: `不支持的文件类型 ${ext}，请上传发票图片或数电票 XML` }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const savePath = path.join(UPLOAD_DIR, `${Date.now()}-${name}`);
    await fs.writeFile(savePath, buf);

    // 1) 本地 RapidOCR
    const ocr = await runOcr(savePath);
    await prisma.auditLog.create({
      data: {
        actorType: 'system',
        actor: 'RapidOCR(本地)',
        module: 'invoice',
        action: 'ocr',
        detail: JSON.stringify({ file: name, ok: ocr.ok, lines: ocr.lines.length, avgScore: ocr.avgScore }),
      },
    });
    if (!ocr.ok || !ocr.text.trim()) {
      return NextResponse.json({ error: ocr.error || 'OCR 未识别到文字，请换更清晰的图片' }, { status: 422 });
    }

    // 2) DeepSeek 结构化抽取（失败自动降级规则）
    const { data: extracted, degraded } = await extractInvoice(ocr.text, { file: name });
    if (!extracted.invoiceNo) {
      return NextResponse.json(
        { error: '未能抽取到发票号码，请确认上传的是发票图片', ocrText: ocr.text.slice(0, 500) },
        { status: 422 }
      );
    }

    const exist = await prisma.invoice.findUnique({ where: { invoiceNo: extracted.invoiceNo } });
    if (exist) return NextResponse.json({ error: `发票 ${extracted.invoiceNo} 已存在` }, { status: 409 });

    const inv = await prisma.invoice.create({
      data: {
        invoiceNo: extracted.invoiceNo,
        invoiceCode: extracted.invoiceCode || null,
        type: extracted.type.includes('数电') ? extracted.type : extracted.type,
        issueDate: extracted.issueDate,
        seller: extracted.seller,
        buyer: extracted.buyer,
        amount: extracted.amount,
        taxRate: extracted.taxRate,
        taxAmount: extracted.taxAmount,
        totalAmount: extracted.totalAmount,
        category: extracted.category || null,
        sourceType: 'ocr',
        filePath: savePath,
        ocrText: ocr.text,
        confidence: Math.min(extracted.confidence, ocr.avgScore || 1), // 综合 LLM 与 OCR 置信度
        status: extracted.confidence < 0.8 ? 'pending' : 'verified',
        checkStatus: extracted.confidence < 0.8 ? 'unchecked' : 'verified', // 高置信度直接视为已查验
      },
    });

    return NextResponse.json({ ok: true, channel: 'ocr', degraded, ocrScore: ocr.avgScore, invoice: inv });
  } catch (e) {
    console.error('[upload]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : '上传处理失败' }, { status: 500 });
  }
}
