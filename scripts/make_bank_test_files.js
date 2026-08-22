// 生成银行流水测试文件（CSV + Excel 各一份）
// 模拟招商银行网银导出格式：交易日期/借方金额/贷方金额/对方户名/对方账号/摘要/交易流水号
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 交易数据（2026-07 月结期间，含与发票中心/对账引擎联动的线索）
const rows = [
  ['2026-07-25', '', 158000.00, '深圳宏图电子科技有限公司', '4400123456789', '收到货款-对公转账', 'B202607250001'],
  ['2026-07-25', 3200.00, '', '广州云启办公设备有限公司', '4400987654321', '采购打印机款', 'B202607250002'],
  ['2026-07-26', '', 8600.50, '深圳市恒基物流有限公司', '440055550001', '物流运费结算', 'B202607260003'],
  ['2026-07-28', '', 23500.00, '杭州云栖软件有限公司', '440066660002', '软件服务费', 'B202607280004'],
  ['2026-07-29', 4680.00, '', '广州云启办公设备有限公司', '4400987654321', '办公设备尾款', 'B202607290005'],
  ['2026-07-30', 1280.00, '', '中国南方航空股份有限公司', '440033330003', '差旅机票款', 'B202607300006'],
  ['2026-07-31', '', 5000.00, '深圳市创新信息技术有限公司', '440022220004', '技术咨询收入', 'B202607310007'],
  ['2026-07-31', 365.20, '', '深圳燃气集团', '440011110005', '燃气费代扣', 'B202607310008'],
];

const headers = ['交易日期', '借方金额', '贷方金额', '对方户名', '对方账号', '摘要', '交易流水号'];

// ---------- CSV（UTF-8 BOM，Excel 直接打开不乱码） ----------
const csv = '\uFEFF' + headers.join(',') + '\n' + rows
  .map((r) => r.map((c) => (typeof c === 'string' && /[,"\n]/.test(c) ? `"${c}"` : c)).join(','))
  .join('\n');

// ---------- Excel（日期用 Excel 日期类型，模拟真实网银导出） ----------
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => [...r])]);
// 把第一列转成 Excel 日期（数字序列号，测试系统对 Excel 日期的解析）
for (let i = 1; i <= rows.length; i++) {
  const cell = ws[XLSX.utils.encode_cell({ r: i, c: 0 })];
  if (cell) {
    const [y, m, d] = rows[i - 1][0].split('-').map(Number);
    // Excel 序列号 = 自 1900-01-00 起的天数（Unix 时间戳换算 + 25569）
    cell.t = 'n';
    cell.z = 'yyyy-mm-dd';
    cell.v = Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 25569;
  }
}
// 金额列加千分位格式
for (const c of [1, 2]) {
  for (let i = 1; i <= rows.length; i++) {
    const cell = ws[XLSX.utils.encode_cell({ r: i, c })];
    if (cell) cell.z = '#,##0.00';
  }
}
ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 16 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '银行流水');

const outDir = process.argv[2] || '.';
fs.mkdirSync(outDir, { recursive: true });
const csvPath = path.join(outDir, '银行流水_2026年07月_测试.csv');
const xlsxPath = path.join(outDir, '银行流水_2026年07月_测试.xlsx');
fs.writeFileSync(csvPath, csv, 'utf8');
XLSX.writeFile(wb, xlsxPath);

console.log('已生成：');
console.log('  CSV :', csvPath, '(', fs.statSync(csvPath).size, 'B )');
console.log('  XLSX:', xlsxPath, '(', fs.statSync(xlsxPath).size, 'B )');
console.log('  共', rows.length, '笔交易（7/25 - 7/31 月结期间）');
