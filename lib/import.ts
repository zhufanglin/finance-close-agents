import * as XLSX from 'xlsx';

// 银行流水导入：CSV / Excel 万能列映射
// 自动识别常见表头（各银行网银导出格式差异大，这里做宽松匹配）

export interface BankRow {
  txDate: string; // YYYY-MM-DD
  amount: number; // 正数
  direction: string; // 收 / 付
  counterparty: string;
  counterpartyAccount?: string;
  summary: string;
  bankRef: string; // 流水号（没有则自动生成）
}

export interface ParseResult {
  ok: boolean;
  rows: BankRow[];
  total: number;
  skipped: number; // 无法解析跳过的行
  columns?: Record<string, string>; // 实际映射到的列名
  error?: string;
}

/** 表头别名映射 */
const HEADER_MAP: Record<string, string[]> = {
  txDate: ['交易日期', '日期', '记账日期', '交易时间', 'transDate', 'date', '值日期'],
  amount: ['发生金额', '金额', '交易金额', '借方发生额', '贷方发生额', 'amount', '转账金额'],
  direction: ['借贷标志', '收支方向', '方向', '收/付', '借贷', 'dir', '摘要方向'],
  counterparty: ['对方户名', '对方账户名', '收款人名称', '付款人名称', '交易对手', '对方名称', 'counterparty', '客户名称'],
  counterpartyAccount: ['对方账号', '对方账户', '收款账号', '付款账号', 'counterpartyAccount'],
  summary: ['摘要', '附言', '用途', '备注', '交易摘要', 'summary', '业务类型'],
  bankRef: ['交易流水号', '流水号', '凭证流水号', '参考号', 'bankRef', '交易编号', '序号'],
};

function normHeader(h: string): string {
  return String(h || '').trim().replace(/[\s　]/g, '');
}

function normalizeDate(s: string): string {
  const t = String(s || '').trim();
  if (!t) return '';
  const cn = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (cn) return `${cn[1]}-${String(cn[2]).padStart(2, '0')}-${String(cn[3]).padStart(2, '0')}`;
  // Excel 数字日期序列号（1900 纪元）
  if (/^\d{5}$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30, 0, 0, 0));
    d.setUTCDate(d.getUTCDate() + parseInt(t, 10));
    return d.toISOString().slice(0, 10);
  }
  const iso = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  return '';
}

function toAmount(v: unknown): number {
  if (typeof v === 'number') return Math.abs(v);
  const s = String(v ?? '').replace(/[¥￥,，\s+]/g, '');
  if (!s || s === '-') return 0;
  return Math.abs(parseFloat(s)) || 0;
}

/** 解析 CSV 文本（支持 UTF-8 BOM、逗号/制表符分隔） */
export function parseCsv(text: string): ParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = clean.split(/\r?\n/).filter((l) => l.trim());
  if (!rows.length) return { ok: false, rows: [], total: 0, skipped: 0, error: '空文件' };
  const sep = rows[0].includes('\t') ? '\t' : ',';
  const header = rows[0].split(sep).map(normHeader);
  return buildRows(header, rows.slice(1).map((l) => l.split(sep)));
}

/** 解析 Excel Buffer */
export function parseExcel(buf: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: true, defval: '' });
  if (!grid.length) return { ok: false, rows: [], total: 0, skipped: 0, error: '空工作表' };
  // 找表头行：前 5 行里包含任一别名的那行
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, grid.length); i++) {
    const h = (grid[i] || []).map(normHeader);
    if (h.some((c) => HEADER_MAP.amount.includes(c) || HEADER_MAP.txDate.includes(c))) {
      headerIdx = i;
      break;
    }
  }
  const header = (grid[headerIdx] || []).map(normHeader);
  return buildRows(header, grid.slice(headerIdx + 1));
}

function buildRows(header: string[], dataRows: string[][]): ParseResult {
  // 建立 字段→列索引 映射
  const colIdx: Record<string, number> = {};
  const matchedCols: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(HEADER_MAP) as Array<[string, string[]]>) {
    if (field === 'auto') continue;
    for (let i = 0; i < header.length; i++) {
      if (aliases.includes(header[i])) {
        colIdx[field] = i;
        matchedCols[field] = header[i];
        break;
      }
    }
  }

  if (colIdx.txDate === undefined || (colIdx.amount === undefined && !dataRows.length)) {
    return { ok: false, rows: [], total: dataRows.length, skipped: 0, error: '识别不到表头（需要「交易日期」和「金额」列），请检查模板' };
  }

  // 有些银行不分收付列，而是「借方金额/贷方金额」两列
  const debitCol = header.findIndex((h) => /借方|支出金额|付款金额/.test(h));
  const creditCol = header.findIndex((h) => /贷方|收入金额|收款金额/.test(h));

  const rows: BankRow[] = [];
  let skipped = 0;

  for (const r of dataRows) {
    if (!r || r.every((c) => !String(c ?? '').trim())) continue;
    const get = (f: string): string => (colIdx[f] !== undefined ? String(r[colIdx[f]] ?? '').trim() : '');

    const txDate = normalizeDate(get('txDate'));
    let amount = toAmount(get('amount'));
    let direction = get('direction');

    // 借贷双列格式
    if (debitCol >= 0 || creditCol >= 0) {
      const debit = toAmount(r[debitCol]);
      const credit = toAmount(r[creditCol]);
      if (debit > 0) {
        amount = debit;
        direction = direction || '付';
      } else if (credit > 0) {
        amount = credit;
        direction = direction || '收';
      }
    }
    if (!direction) direction = /收|贷|入/.test(get('summary') + get('direction')) ? '收' : '付';
    if (direction.includes('借')) direction = '付';
    if (direction.includes('贷')) direction = '收';

    if (!txDate || !amount) {
      skipped++;
      continue;
    }

    const bankRef = get('bankRef') || `IMP-${txDate.replace(/-/g, '')}-${rows.length + 1}`;
    rows.push({
      txDate,
      amount,
      direction,
      counterparty: get('counterparty') || '未知对手',
      counterpartyAccount: get('counterpartyAccount') || undefined,
      summary: get('summary') || '银行流水导入',
      bankRef,
    });
  }

  return { ok: true, rows, total: rows.length, skipped, columns: matchedCols };
}
