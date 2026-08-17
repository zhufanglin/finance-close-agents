import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 数据质量：月结前的检查项聚合（低置信发票 / 未达账 / 待审事项）
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const [
    uncheckedInvoices, unmatchedBank, unmatchedLedger,
    pendingProposals, pendingVouchers, pendingClaims, aiCalls, aiCost,
  ] = await Promise.all([
    prisma.invoice.count({ where: { checkStatus: 'unchecked' } }),
    prisma.bankTransaction.count({ where: { matchStatus: { not: 'matched' } } }),
    prisma.ledgerEntry.count({ where: { matchStatus: { not: 'matched' } } }),
    prisma.proposal.count({ where: { status: 'pending' } }),
    prisma.voucher.count({ where: { status: 'pending' } }),
    prisma.expenseClaim.count({ where: { status: 'submitted' } }),
    prisma.auditLog.count({ where: { actorType: 'ai' } }),
    prisma.auditLog.aggregate({ _sum: { tokenCost: true } }),
  ]);

  // 低置信发票改用带字段的查询
  const lowConf = await prisma.invoice.findMany({
    where: { confidence: { lt: 0.8 } },
    select: { invoiceNo: true, seller: true, confidence: true, category: true },
  }).catch(() => []);

  const checks = [
    { key: 'low-confidence', name: '低置信度发票（<80%）', count: lowConf.length, target: '/invoices', level: lowConf.length > 0 ? 'warn' : 'ok',
      desc: 'OCR/AI 识别把握不足，禁止自动生成凭证，需人工复核原图' },
    { key: 'unchecked', name: '未查验发票', count: uncheckedInvoices, target: '/invoices', level: uncheckedInvoices > 0 ? 'info' : 'ok',
      desc: '数电票未完成税务平台查验（演示：购方名称比对等规则）' },
    { key: 'bank-unmatched', name: '银行侧未匹配流水', count: unmatchedBank, target: '/reconciliation', level: unmatchedBank > 0 ? 'warn' : 'ok',
      desc: '银行有记录但账套未找到对应，含未达账项与漏记账' },
    { key: 'ledger-unmatched', name: '账套侧未匹配记录', count: unmatchedLedger, target: '/reconciliation', level: unmatchedLedger > 0 ? 'info' : 'ok',
      desc: '账套有记录但银行无流水，多为月末在途资金' },
    { key: 'pending-proposals', name: '待审 AI 提案', count: pendingProposals, target: '/audit', level: pendingProposals > 0 ? 'warn' : 'ok',
      desc: 'Agent 已给出建议，等待人工决策（人没点头，账不改）' },
    { key: 'pending-vouchers', name: '待审凭证', count: pendingVouchers, target: '/audit', level: pendingVouchers > 0 ? 'info' : 'ok',
      desc: '凭证已生成但未过账' },
    { key: 'pending-claims', name: '待审批报销单', count: pendingClaims, target: '/expenses', level: pendingClaims > 0 ? 'info' : 'ok',
      desc: '员工报销等待审批，月结前需清零' },
  ];

  const issues = checks.filter((c) => c.count > 0 && c.level === 'warn').length;
  const health = Math.max(0, 100 - issues * 12 - checks.filter((c) => c.count > 0 && c.level === 'info').length * 4);

  return NextResponse.json({
    checks,
    lowConf,
    health,
    ai: { calls: aiCalls, costYuan: Math.round((aiCost._sum.tokenCost || 0) * 10000) / 10000 },
  });
}
