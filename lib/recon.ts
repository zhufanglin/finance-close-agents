// ============ 银企对账引擎（规则做计算） ============
// 三级匹配策略：
//   L1 一对一精确匹配：金额一致(±0.005) + 日期±3天 + 对方户名模糊一致 + 方向对应(收↔贷 / 付↔借)
//   L2 多对一拆分匹配：同一对方的多笔银行流水合计 = 账套一笔整笔（银行拆分入账场景）
//   L3 尾差标记：金额差 ≤ 1 元且对方一致 → 疑似手续费/垫头差，转 AI 解释 + 人工裁决
// 其余：银行有账上无（未达账项）/ 账上有银行无（在途资金），均转 AI 解释生成提案

import { prisma } from '@/lib/db';

export interface OneToOneMatch {
  bankId: number;
  ledgerId: number;
  rule: string;
}

export interface SplitMatch {
  bankIds: number[];
  ledgerId: number;
  total: number;
  counterparty: string;
}

export interface AmountDiffCase {
  bankId: number;
  ledgerId: number;
  bankAmount: number;
  ledgerAmount: number;
  diff: number;
}

export interface BankOnlyCase {
  id: number;
  bankRef: string;
  txDate: string;
  amount: number;
  direction: string;
  counterparty: string;
  summary: string;
}

export interface LedgerOnlyCase {
  id: number;
  voucherNo: string;
  txDate: string;
  amount: number;
  direction: string;
  counterparty: string;
  summary: string;
}

export interface ReconResult {
  autoMatched: OneToOneMatch[];
  splitMatches: SplitMatch[];
  amountDiffs: AmountDiffCase[];
  bankOnly: BankOnlyCase[];
  ledgerOnly: LedgerOnlyCase[];
}

type BankRow = {
  id: number; bankRef: string; txDate: string; amount: number;
  direction: string; counterparty: string; summary: string;
};

type LedgerRow = {
  id: number; voucherNo: string; txDate: string; amount: number;
  direction: string; counterparty: string; summary: string;
};

const dayGap = (a: string, b: string): number =>
  Math.abs(new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / 86400000;

const cpMatch = (a: string, b: string): boolean => {
  const x = a.replace(/\s/g, '');
  const y = b.replace(/\s/g, '');
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

const dirMatch = (bankDir: string, ledgerDir: string): boolean =>
  (bankDir === '收' && ledgerDir === '贷') || (bankDir === '付' && ledgerDir === '借');

/** 组合枚举（n 很小，最多取 4 个） */
function combos<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  const walk = (start: number, acc: T[]) => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < arr.length; i++) walk(i + 1, [...acc, arr[i]]);
  };
  walk(0, []);
  return out;
}

/** 执行对账引擎（纯计算，不写库；落库由调用方决定） */
export async function runReconEngine(): Promise<ReconResult> {
  const [bankAll, ledgerAll] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: { matchStatus: { not: 'matched' } },
      orderBy: { txDate: 'asc' },
    }),
    prisma.ledgerEntry.findMany({
      where: { matchStatus: { not: 'matched' } },
      orderBy: { txDate: 'asc' },
    }),
  ]);

  const banks: BankRow[] = bankAll.map((b) => ({
    id: b.id, bankRef: b.bankRef, txDate: b.txDate, amount: b.amount,
    direction: b.direction, counterparty: b.counterparty, summary: b.summary,
  }));
  const ledgers: LedgerRow[] = ledgerAll.map((l) => ({
    id: l.id, voucherNo: l.voucherNo, txDate: l.txDate, amount: l.amount,
    direction: l.direction, counterparty: l.counterparty, summary: l.summary,
  }));

  const result: ReconResult = {
    autoMatched: [], splitMatches: [], amountDiffs: [], bankOnly: [], ledgerOnly: [],
  };

  const usedBank = new Set<number>();
  const usedLedger = new Set<number>();

  // ---- L1 一对一精确匹配 ----
  for (const b of banks) {
    if (usedBank.has(b.id)) continue;
    const hit = ledgers.find(
      (l) =>
        !usedLedger.has(l.id) &&
        dirMatch(b.direction, l.direction) &&
        cpMatch(b.counterparty, l.counterparty) &&
        Math.abs(b.amount - l.amount) < 0.005 &&
        dayGap(b.txDate, l.txDate) <= 3
    );
    if (hit) {
      usedBank.add(b.id);
      usedLedger.add(hit.id);
      result.autoMatched.push({ bankId: b.id, ledgerId: hit.id, rule: '金额+日期+对方三重命中' });
    }
  }

  // ---- L2 多对一拆分匹配（银行拆分入账）----
  for (const l of ledgers) {
    if (usedLedger.has(l.id)) continue;
    const candidates = banks.filter(
      (b) =>
        !usedBank.has(b.id) &&
        dirMatch(b.direction, l.direction) &&
        cpMatch(b.counterparty, l.counterparty) &&
        dayGap(b.txDate, l.txDate) <= 5
    );
    if (candidates.length < 2) continue;
    let found: BankRow[] | null = null;
    for (let size = 2; size <= Math.min(4, candidates.length) && !found; size++) {
      for (const group of combos(candidates, size)) {
        const total = group.reduce((s, g) => s + g.amount, 0);
        if (Math.abs(total - l.amount) < 0.015) {
          found = group;
          break;
        }
      }
    }
    if (found) {
      found.forEach((f) => usedBank.add(f.id));
      usedLedger.add(l.id);
      result.splitMatches.push({
        bankIds: found.map((f) => f.id),
        ledgerId: l.id,
        total: found.reduce((s, f) => s + f.amount, 0),
        counterparty: l.counterparty,
      });
    }
  }

  // ---- L3 尾差标记（金额差 ≤ 1 元）----
  for (const b of banks) {
    if (usedBank.has(b.id)) continue;
    const hit = ledgers.find(
      (l) =>
        !usedLedger.has(l.id) &&
        dirMatch(b.direction, l.direction) &&
        cpMatch(b.counterparty, l.counterparty) &&
        Math.abs(b.amount - l.amount) <= 1.0 &&
        dayGap(b.txDate, l.txDate) <= 5
    );
    if (hit) {
      usedBank.add(b.id);
      usedLedger.add(hit.id);
      result.amountDiffs.push({
        bankId: b.id,
        ledgerId: hit.id,
        bankAmount: b.amount,
        ledgerAmount: hit.amount,
        diff: Math.round((b.amount - hit.amount) * 100) / 100,
      });
    }
  }

  // ---- 剩余：银行有账上无 / 账上有银行无 ----
  for (const b of banks) {
    if (!usedBank.has(b.id)) {
      result.bankOnly.push({
        id: b.id, bankRef: b.bankRef, txDate: b.txDate, amount: b.amount,
        direction: b.direction, counterparty: b.counterparty, summary: b.summary,
      });
    }
  }
  for (const l of ledgers) {
    if (!usedLedger.has(l.id)) {
      result.ledgerOnly.push({
        id: l.id, voucherNo: l.voucherNo, txDate: l.txDate, amount: l.amount,
        direction: l.direction, counterparty: l.counterparty, summary: l.summary,
      });
    }
  }

  return result;
}

// ============ 提案分录生成（规则兜底科目映射） ============

const SUBJECT_BY_RULE: Array<[RegExp, string, string]> = [
  [/短信|通讯|电话/, '6602.03', '管理费用-手续费'],
  [/手续费|管理费|年费|服务费|账户/, '6602.03', '管理费用-手续费'],
  [/利息/, '6603', '财务费用-利息支出'],
  [/电费|水费|物业|房租|租赁/, '6602.02', '管理费用-办公费'],
  [/运输|物流|专线/, '6601', '销售费用-运输费'],
  [/货款|采购/, '1403', '原材料'],
];

export interface VoucherEntryDraft {
  subjectCode: string;
  subjectName: string;
  direction: '借' | '贷';
  amount: number;
  summary: string;
}

/** 银行有账上无 → 补提入账分录（借:费用科目 / 贷:银行存款） */
export function draftEntriesForBankOnly(tx: BankOnlyCase): VoucherEntryDraft[] {
  const hit = SUBJECT_BY_RULE.find(([re]) => re.test(tx.summary) || re.test(tx.counterparty));
  const code = hit ? hit[1] : '6602.99';
  const name = hit ? hit[2] : '管理费用-其他';
  return [
    { subjectCode: code, subjectName: name, direction: '借', amount: tx.amount, summary: `${tx.counterparty}-${tx.summary}` },
    { subjectCode: '1002', subjectName: '银行存款', direction: '贷', amount: tx.amount, summary: `银行扣款 ${tx.bankRef}` },
  ];
}

/** 尾差 → 调账分录（借:管理费用-手续费 / 贷:银行存款） */
export function draftEntriesForDiff(c: AmountDiffCase): VoucherEntryDraft[] {
  const amt = Math.abs(c.diff);
  return [
    { subjectCode: '6602.03', subjectName: '管理费用-手续费', direction: '借', amount: amt, summary: '银企尾差调整' },
    { subjectCode: '1002', subjectName: '银行存款', direction: '贷', amount: amt, summary: '以银行实际扣款为准' },
  ];
}
