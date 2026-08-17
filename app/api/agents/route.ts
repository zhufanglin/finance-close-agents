import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

// 5 个 Agent 的真实状态（基于数据库实时计算，不做假状态）
// status: working = 有待处理任务 | done = 本期任务清零 | idle = 待命（模块建设中）
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const [
    unmatchedBank, flaggedBank,
    reconProposalsTotal, reconProposalsPending,
    invoicePending, invoiceLowConf, invoiceVoucherized,
    vouchersPosted, vouchersPending,
    lastReconLog, lastInvoiceLog,
  ] = await Promise.all([
    prisma.bankTransaction.count({ where: { matchStatus: 'unmatched' } }),
    prisma.bankTransaction.count({ where: { matchStatus: 'flagged' } }),
    prisma.proposal.count({ where: { type: 'reconciliation' } }),
    prisma.proposal.count({ where: { type: 'reconciliation', status: 'pending' } }),
    prisma.invoice.count({ where: { status: 'pending' } }),
    prisma.invoice.count({ where: { confidence: { lt: 0.8 } } }),
    prisma.invoice.count({ where: { status: 'voucherized' } }),
    prisma.voucher.count({ where: { status: 'posted' } }),
    prisma.voucher.count({ where: { status: 'pending' } }),
    prisma.auditLog.findFirst({ where: { module: 'reconciliation' }, orderBy: { ts: 'desc' }, select: { ts: true, action: true } }),
    prisma.auditLog.findFirst({ where: { module: 'invoice' }, orderBy: { ts: 'desc' }, select: { ts: true, action: true } }),
  ]);

  const ts = (t: { ts: Date; action: string } | null): string | null =>
    t ? new Date(t.ts).toISOString().replace('T', ' ').slice(0, 16) : null;

  const agents = [
    {
      key: 'recon',
      name: '银企对账 Agent',
      desc: '银行流水 ↔ 账套逐笔核对，差异解释',
      status: unmatchedBank + flaggedBank > 0 ? 'working' : 'done',
      stat: reconProposalsPending > 0
        ? `已产出 ${reconProposalsTotal} 条提案，${reconProposalsPending} 条待人工审批`
        : `本期累计产出 ${reconProposalsTotal} 条提案`,
      detail: `未匹配 ${unmatchedBank} · 疑似差异 ${flaggedBank}`,
      lastActive: ts(lastReconLog),
      href: '/reconciliation',
    },
    {
      key: 'invoice',
      name: '发票 Agent',
      desc: 'OCR / 数电票收取、查验、生成凭证',
      status: invoicePending > 0 ? 'working' : 'done',
      stat: `已制证 ${invoiceVoucherized} 张，待处理 ${invoicePending} 张`,
      detail: invoiceLowConf > 0 ? `⚠ ${invoiceLowConf} 张低置信度已转人工复核` : '置信度全部达标',
      lastActive: ts(lastInvoiceLog),
      href: '/invoices',
    },
    {
      key: 'expense',
      name: '费用报销 Agent',
      desc: '报销单智能审核、费用标准校验',
      status: 'idle',
      stat: '模块建设中（下一期接入）',
      detail: '已预留提案通道与审批闭环',
      lastActive: null,
      href: '/expenses',
    },
    {
      key: 'voucher',
      name: '凭证生成 Agent',
      desc: '审批通过后自动编制凭证与分录',
      status: vouchersPending > 0 ? 'working' : 'done',
      stat: `本期已过账 ${vouchersPosted} 张凭证`,
      detail: vouchersPending > 0 ? `${vouchersPending} 张待审凭证挂起` : '与审批流实时联动',
      lastActive: null,
      href: '/audit',
    },
    {
      key: 'quality',
      name: '数据质量 Agent',
      desc: '主数据巡检、异常数据拦截',
      status: invoiceLowConf > 0 ? 'working' : 'done',
      stat: invoiceLowConf > 0 ? `拦截 ${invoiceLowConf} 项数据质量问题` : '本期无质量告警',
      detail: '购方名称比对 / OCR 置信度门限 0.8',
      lastActive: null,
      href: '/dataquality',
    },
  ];

  return NextResponse.json({ agents, generatedAt: new Date().toISOString() });
}
