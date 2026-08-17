import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { explainDiff } from '@/lib/llm';
import {
  runReconEngine,
  draftEntriesForBankOnly,
  draftEntriesForDiff,
} from '@/lib/recon';

// 一键智能对账：规则引擎自动匹配 → 差异项调 DeepSeek 解释 → 自动生成 AI 提案（等待人工审批）
// 铁律不变：引擎和 AI 只产出「提案」，人没点头，账不改
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

  // 1. 跑匹配引擎（纯计算）
  const result = await runReconEngine();

  // 2. 落库：一对一 + 拆分匹配（纯规则命中，可直接建立匹配关系）
  let linked = 0;
  for (const m of result.autoMatched) {
    await prisma.$transaction([
      prisma.bankTransaction.update({
        where: { id: m.bankId },
        data: { matchStatus: 'matched', matchedLedgerId: m.ledgerId },
      }),
      prisma.ledgerEntry.update({
        where: { id: m.ledgerId },
        data: { matchStatus: 'matched' },
      }),
    ]);
    linked++;
  }
  for (const s of result.splitMatches) {
    // matchedLedgerId 唯一约束：首笔挂关系，其余标记 matched 并在提案 payload 记录明细
    for (let i = 0; i < s.bankIds.length; i++) {
      await prisma.bankTransaction.update({
        where: { id: s.bankIds[i] },
        data: { matchStatus: 'matched', matchedLedgerId: i === 0 ? s.ledgerId : null },
      });
    }
    await prisma.ledgerEntry.update({
      where: { id: s.ledgerId },
      data: { matchStatus: 'matched' },
    });
    linked++;
  }

  if (linked > 0) {
    await prisma.auditLog.create({
      data: {
        actorType: 'ai',
        actor: '银企对账Agent',
        module: 'reconciliation',
        action: 'match',
        detail: JSON.stringify({
          engine: 'L1精确+L2拆分',
          autoMatched: result.autoMatched.length,
          splitMatches: result.splitMatches.length,
        }),
      },
    });
  }

  // 3. 差异项 → AI 解释 → 自动生成提案（去重：已有待审提案覆盖的 bankRef 不重复生成）
  const pendingProposals = await prisma.proposal.findMany({
    where: { status: 'pending', type: 'reconciliation' },
    select: { title: true, payload: true },
  });
  const coveredKeys = new Set<string>();
  for (const p of pendingProposals) {
    try {
      const payload = JSON.parse(p.payload);
      const keys: string[] = payload.bankRefs || (payload.bankRef ? [payload.bankRef] : []);
      keys.forEach((k) => coveredKeys.add(k));
    } catch {
      /* 忽略解析失败 */
    }
  }

  interface CaseDraft {
    key: string; // bankRef 或 voucherNo，用于去重
    title: string;
    bank: Record<string, unknown>; // 传给 explainDiff 的主记录
    candidates: Record<string, unknown>[];
    entries?: ReturnType<typeof draftEntriesForBankOnly>;
    linkAction?: boolean; // true = 无需凭证，仅建匹配/备案说明
  }

  const cases: CaseDraft[] = [];

  for (const c of result.amountDiffs) {
    const bank = await prisma.bankTransaction.findUnique({ where: { id: c.bankId } });
    const ledger = await prisma.ledgerEntry.findUnique({ where: { id: c.ledgerId } });
    if (!bank || !ledger) continue;
    cases.push({
      key: bank.bankRef,
      title: `尾差调整：${bank.counterparty} 差异 ${c.diff > 0 ? '+' : ''}${c.diff.toFixed(2)} 元`,
      bank: {
        txDate: bank.txDate, amount: bank.amount, direction: bank.direction,
        counterparty: bank.counterparty, summary: bank.summary, bankRef: bank.bankRef,
      },
      candidates: [ledger].map((l) => ({
        voucherNo: l.voucherNo, txDate: l.txDate, amount: l.amount,
        direction: l.direction, counterparty: l.counterparty,
      })),
      entries: draftEntriesForDiff(c),
    });
  }

  for (const b of result.bankOnly) {
    cases.push({
      key: b.bankRef,
      title: `银行有账上无：${b.counterparty} ${b.amount.toFixed(2)} 元待补提`,
      bank: { ...b },
      candidates: [],
      entries: draftEntriesForBankOnly(b),
    });
  }

  for (const l of result.ledgerOnly) {
    cases.push({
      key: l.voucherNo,
      title: `账上有银行无：${l.counterparty} ${l.amount.toFixed(2)} 元（疑似在途）`,
      bank: {
        txDate: l.txDate, amount: l.amount, direction: l.direction === '借' ? '付' : '收',
        counterparty: l.counterparty, summary: l.summary, voucherNo: l.voucherNo,
        side: 'ledger',
      },
      candidates: [],
      linkAction: true, // 未达账项：无需调账凭证，月结编制余额调节表备案
    });
  }

  // 4. 并行调 AI 解释（每案一次，失败自动降级为规则文案）
  const explained = await Promise.all(
    cases.map(async (c) => ({
      ...c,
      ai: await explainDiff(c.bank, c.candidates, { scene: 'auto-recon-run', key: c.key }),
    }))
  );

  let proposalsCreated = 0;
  for (const c of explained) {
    if (coveredKeys.has(c.key)) continue; // 已有待审提案，不重复
    await prisma.proposal.create({
      data: {
        type: 'reconciliation',
        title: c.title,
        aiAgent: '银企对账Agent',
        aiReason: `${c.ai.data.explanation} 处理建议：${c.ai.data.suggestion}`,
        confidence: c.ai.data.confidence,
        payload: JSON.stringify({
          key: c.key,
          bankRef: c.key.startsWith('记-') ? undefined : c.key,
          action: c.linkAction ? 'note' : 'voucher',
          entries: c.entries ?? [],
          explanation: c.ai.data.explanation,
          severity: c.ai.data.severity,
          degraded: c.ai.degraded,
        }),
      },
    });
    proposalsCreated++;
  }

  if (proposalsCreated > 0) {
    await prisma.auditLog.create({
      data: {
        actorType: 'ai',
        actor: '银企对账Agent',
        module: 'reconciliation',
        action: 'propose',
        detail: JSON.stringify({ created: proposalsCreated, cases: explained.length }),
        model: 'deepseek-chat',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    summary: {
      autoMatched: result.autoMatched.length,
      splitMatches: result.splitMatches.length,
      amountDiffs: result.amountDiffs.length,
      bankOnly: result.bankOnly.length,
      ledgerOnly: result.ledgerOnly.length,
      proposalsCreated,
      aiDegraded: explained.some((e) => e.ai.degraded),
    },
  });
}
