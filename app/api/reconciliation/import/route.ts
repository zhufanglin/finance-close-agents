import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { parseCsv, parseExcel } from '@/lib/import';

export const runtime = 'nodejs';

// 银行流水导入：CSV / Excel → 万能列映射 → 落库（bankRef 去重）
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const accountId = Number(form?.get('accountId') || 0);
  if (!file || !(file instanceof File)) return NextResponse.json({ error: '未收到文件' }, { status: 400 });

  const name = file.name || '';
  const ext = name.toLowerCase().split('.').pop() || '';
  const buf = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    if (ext === 'csv' || ext === 'txt') {
      parsed = parseCsv(buf.toString('utf-8'));
    } else if (['xls', 'xlsx'].includes(ext)) {
      parsed = parseExcel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    } else {
      return NextResponse.json({ error: '仅支持 CSV / Excel 文件' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: `解析失败: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // 目标银行账户：指定 > 第一个
  const account = accountId
    ? await prisma.bankAccount.findUnique({ where: { id: accountId } })
    : await prisma.bankAccount.findFirst();
  if (!account) return NextResponse.json({ error: '系统中还没有银行账户，请先在主数据中添加' }, { status: 400 });

  // bankRef 去重导入
  let imported = 0;
  let duplicated = 0;
  for (const row of parsed.rows) {
    const exist = await prisma.bankTransaction.findUnique({ where: { bankRef: row.bankRef } });
    if (exist) {
      duplicated++;
      continue;
    }
    await prisma.bankTransaction.create({
      data: {
        accountId: account.id,
        txDate: row.txDate,
        amount: row.amount,
        direction: row.direction,
        counterparty: row.counterparty,
        counterpartyAccount: row.counterpartyAccount || null,
        summary: row.summary,
        bankRef: row.bankRef,
        matchStatus: 'unmatched',
      },
    });
    imported++;
  }

  await prisma.auditLog.create({
    data: {
      actorType: 'human',
      actor: session,
      module: 'reconciliation',
      action: 'import',
      detail: JSON.stringify({
        file: name,
        imported,
        duplicated,
        skipped: parsed.skipped,
        account: `${account.bankName}(${account.accountNo.slice(-4)})`,
        columns: parsed.columns,
      }),
    },
  });

  return NextResponse.json({ ok: true, imported, duplicated, skipped: parsed.skipped, total: parsed.rows.length });
}
