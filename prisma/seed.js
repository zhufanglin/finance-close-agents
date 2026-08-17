// 财务月结 AI 演示系统 - 演示数据种子脚本
// 用法：node prisma/seed.js  或  npx prisma db seed
// 数据期间：2026 年 7 月（月结演示期）
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('清空旧数据...');
  await prisma.auditLog.deleteMany();
  await prisma.approvalRecord.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.expenseClaim.deleteMany();
  await prisma.voucherItem.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.bankTransaction.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.user.deleteMany();

  // ============ 用户 ============
  await prisma.user.createMany({
    data: [
      { username: 'admin', password: 'admin123', name: '朱方林', role: 'admin' },
      { username: 'finance', password: 'finance123', name: '李会计', role: 'finance' },
      { username: 'auditor', password: 'auditor123', name: '王审计', role: 'auditor' },
    ],
  });

  // ============ 会计科目 ============
  const subjects = [
    { code: '1001', name: '库存现金', type: '资产', direction: '借', level: 1 },
    { code: '1002', name: '银行存款', type: '资产', direction: '借', level: 1 },
    { code: '1122', name: '应收账款', type: '资产', direction: '借', level: 1 },
    { code: '1403', name: '原材料', type: '资产', direction: '借', level: 1 },
    { code: '2202', name: '应付账款', type: '负债', direction: '贷', level: 1 },
    { code: '2221', name: '应交税费', type: '负债', direction: '贷', level: 1 },
    { code: '6001', name: '主营业务收入', type: '损益', direction: '贷', level: 1 },
    { code: '6401', name: '主营业务成本', type: '损益', direction: '借', level: 1 },
    { code: '6601', name: '销售费用', type: '损益', direction: '借', level: 1 },
    { code: '6602', name: '管理费用', type: '损益', direction: '借', level: 1 },
    { code: '6602.01', name: '管理费用-办公费', type: '损益', direction: '借', level: 2 },
    { code: '6602.02', name: '管理费用-差旅费', type: '损益', direction: '借', level: 2 },
    { code: '6602.03', name: '管理费用-手续费', type: '损益', direction: '借', level: 2 },
  ];
  await prisma.subject.createMany({ data: subjects });

  // ============ 客商 ============
  const partners = [
    { code: 'SUP-001', name: '华信电子科技有限公司', type: 'supplier', taxId: '91440300MA5DA1234X' },
    { code: 'SUP-002', name: '深圳市宏图纸品包装有限公司', type: 'supplier', taxId: '91440300MA5EQ5678Y' },
    { code: 'SUP-003', name: '广州迅达物流股份有限公司', type: 'supplier', taxId: '91440100MA7KP9012Z' },
    { code: 'SUP-004', name: '北京中天咨询有限公司', type: 'supplier', taxId: '91110108MA01AB345C' },
    { code: 'CUS-001', name: '珠海瑞丰电器有限公司', type: 'customer', taxId: '91440400MA52CD678D' },
    { code: 'CUS-002', name: '苏州联创精密制造有限公司', type: 'customer', taxId: '91320594MA1WXU901E' },
    { code: 'CUS-003', name: '杭州云启网络科技有限公司', type: 'customer', taxId: '91330109MA2HLM234F' },
    { code: 'CUS-004', name: '上海锦程商贸有限公司', type: 'customer', taxId: '91310115MA1FLN567G' },
  ];
  await prisma.partner.createMany({ data: partners });

  // ============ 银行账户 ============
  const icbc = await prisma.bankAccount.create({
    data: { bankName: '工商银行深圳科技支行', accountNo: '4000021909200123456', accountName: '深圳市示例科技有限公司', balance: 2864320.55 },
  });
  const cmb = await prisma.bankAccount.create({
    data: { bankName: '招商银行深圳分行营业部', accountNo: '755908886677000155', accountName: '深圳市示例科技有限公司', balance: 1098340.18 },
  });

  // ============ 银行流水 + 账套流水 ============
  // 结构：26 笔正常匹配 + 4 个埋点差异（金额差一分 / 银行有账上无 / 一收拆两笔 / 账上有银行无）
  const seq = { n: 0 };
  const ref = () => `ICBC2026${String(++seq.n).padStart(6, '0')}`;

  // 正常配对流水：付款（供应商）+ 收款（客户）
  const normalPairs = [
    // [日期, 金额, 收/付, 对方, 摘要]
    ['2026-07-02', 236000.00, '付', '华信电子科技有限公司', '支付货款-电子料采购'],
    ['2026-07-03', 45000.00, '收', '珠海瑞丰电器有限公司', '货款回款-6月对账单'],
    ['2026-07-05', 88500.00, '付', '广州迅达物流股份有限公司', '支付运输费'],
    ['2026-07-06', 128000.00, '收', '苏州联创精密制造有限公司', '货款回款-订单A2231'],
    ['2026-07-08', 36000.00, '付', '深圳市宏图纸品包装有限公司', '支付包装材料款'],
    ['2026-07-09', 96000.00, '收', '杭州云启网络科技有限公司', '货款回款-6月'],
    ['2026-07-10', 568000.00, '付', '华信电子科技有限公司', '支付货款-芯片批量采购'],
    ['2026-07-11', 234000.00, '收', '上海锦程商贸有限公司', '货款回款-7月发货'],
    ['2026-07-12', 15800.00, '付', '北京中天咨询有限公司', '支付咨询服务费'],
    ['2026-07-14', 87500.00, '收', '珠海瑞丰电器有限公司', '货款回款-订单B1187'],
    ['2026-07-15', 426300.00, '付', '华信电子科技有限公司', '支付货款-账期90天到期'],
    ['2026-07-16', 63200.00, '收', '苏州联创精密制造有限公司', '货款回款'],
    ['2026-07-17', 29500.00, '付', '广州迅达物流股份有限公司', '支付运输费-专线'],
    ['2026-07-18', 176000.00, '收', '杭州云启网络科技有限公司', '货款回款-订单C3345'],
    ['2026-07-21', 78000.00, '付', '深圳市宏图纸品包装有限公司', '支付包装材料款'],
    ['2026-07-22', 145000.00, '收', '上海锦程商贸有限公司', '货款回款'],
    ['2026-07-23', 112000.00, '付', '华信电子科技有限公司', '支付货款'],
    ['2026-07-24', 38900.00, '收', '珠海瑞丰电器有限公司', '货款回款-尾款'],
    ['2026-07-25', 18600.00, '付', '北京中天咨询有限公司', '支付7月咨询费'],
    ['2026-07-28', 268000.00, '收', '苏州联创精密制造有限公司', '货款回款-订单D4402'],
    ['2026-07-28', 356000.00, '付', '深圳供电局有限公司', '支付6月电费'],
    ['2026-07-29', 98400.00, '收', '杭州云启网络科技有限公司', '货款回款'],
    ['2026-07-30', 486200.00, '付', '华信电子科技有限公司', '支付货款-月末集中付款'],
    ['2026-07-30', 212300.00, '收', '上海锦程商贸有限公司', '货款回款-7月全月'],
    ['2026-07-31', 68500.00, '付', '广州迅达物流股份有限公司', '支付运输费-月末'],
    ['2026-07-31', 54300.00, '收', '珠海瑞丰电器有限公司', '货款回款'],
  ];

  let vno = 700;
  const nextVoucherNo = () => `记-${String(++vno).padStart(4, '0')}`;

  for (const [date, amount, dir, cp, summary] of normalPairs) {
    const bankRef = ref();
    const bank = await prisma.bankTransaction.create({
      data: { accountId: icbc.id, txDate: date, amount, direction: dir, counterparty: cp, summary, bankRef, matchStatus: 'matched' },
    });
    const ledger = await prisma.ledgerEntry.create({
      data: { accountId: icbc.id, txDate: date, amount, direction: dir === '收' ? '贷' : '借', counterparty: cp, summary, voucherNo: nextVoucherNo(), matchStatus: 'matched' },
    });
    await prisma.bankTransaction.update({ where: { id: bank.id }, data: { matchedLedgerId: ledger.id } });
  }

  // --- 差异1：金额差一分（银行 28.50 vs 账套 28.49）---
  await prisma.bankTransaction.create({
    data: { accountId: cmb.id, txDate: '2026-07-05', amount: 28.50, direction: '付', counterparty: '招商银行', summary: '账户短信服务费', bankRef: 'CMB2026070001', matchStatus: 'flagged' },
  });
  await prisma.ledgerEntry.create({
    data: { accountId: cmb.id, txDate: '2026-07-05', amount: 28.49, direction: '借', counterparty: '招商银行', summary: '账户短信服务费', voucherNo: nextVoucherNo(), matchStatus: 'flagged' },
  });

  // --- 差异2：银行有、账上无（账户管理费 200 未入账）---
  await prisma.bankTransaction.create({
    data: { accountId: cmb.id, txDate: '2026-07-20', amount: 200.00, direction: '付', counterparty: '招商银行', summary: '账户管理费-2026年7月', bankRef: 'CMB2026070002', matchStatus: 'unmatched' },
  });

  // --- 差异3：一笔收款银行拆两笔到账（89,000 = 50,000 + 39,000）---
  await prisma.bankTransaction.create({
    data: { accountId: icbc.id, txDate: '2026-07-26', amount: 50000.00, direction: '收', counterparty: '苏州联创精密制造有限公司', summary: '货款-分笔到账1/2', bankRef: ref(), matchStatus: 'flagged' },
  });
  await prisma.bankTransaction.create({
    data: { accountId: icbc.id, txDate: '2026-07-26', amount: 39000.00, direction: '收', counterparty: '苏州联创精密制造有限公司', summary: '货款-分笔到账2/2', bankRef: ref(), matchStatus: 'flagged' },
  });
  await prisma.ledgerEntry.create({
    data: { accountId: icbc.id, txDate: '2026-07-26', amount: 89000.00, direction: '贷', counterparty: '苏州联创精密制造有限公司', summary: '货款回款-整笔', voucherNo: nextVoucherNo(), matchStatus: 'flagged' },
  });

  // --- 差异4：账上有、银行无（电费在途/未达账）---
  await prisma.ledgerEntry.create({
    data: { accountId: icbc.id, txDate: '2026-07-31', amount: 12800.00, direction: '借', counterparty: '深圳供电局有限公司', summary: '7月电费（月末在途）', voucherNo: nextVoucherNo(), matchStatus: 'unmatched' },
  });

  // ============ 发票（15 张：10 数电票 + 3 正常 OCR + 2 低置信度 OCR）===========
  const mkInvoice = (no, seller, amount, rate, cat, source, conf, status, extra = {}) => {
    const tax = Math.round(amount * rate * 100) / 100;
    return {
      invoiceNo: no, type: '数电票（增值税专用发票）', issueDate: extra.date || '2026-07-10', seller,
      buyer: '深圳市示例科技有限公司', amount, taxRate: rate, taxAmount: tax, totalAmount: Math.round((amount + tax) * 100) / 100,
      category: cat, sourceType: source, confidence: conf, status, checkStatus: extra.check || 'verified', ...extra.fields,
    };
  };
  const invoices = [
    mkInvoice('24512000000123456789', '华信电子科技有限公司', 236000.00, 0.13, '原材料采购', 'xml', 0.99, 'voucherized', { date: '2026-07-01' }),
    mkInvoice('24512000000123457012', '广州迅达物流股份有限公司', 88500.00, 0.09, '运输费', 'xml', 0.99, 'voucherized', { date: '2026-07-04' }),
    mkInvoice('24512000000123457330', '深圳市宏图纸品包装有限公司', 36000.00, 0.13, '包装材料', 'xml', 0.99, 'verified', { date: '2026-07-07' }),
    mkInvoice('24512000000123457651', '北京中天咨询有限公司', 15800.00, 0.06, '咨询服务费', 'xml', 0.99, 'verified', { date: '2026-07-11' }),
    mkInvoice('24512000000123458023', '华信电子科技有限公司', 568000.00, 0.13, '原材料采购', 'xml', 0.99, 'voucherized', { date: '2026-07-09' }),
    mkInvoice('24512000000123458447', '深圳供电局有限公司', 356000.00, 0.13, '电费', 'xml', 0.99, 'verified', { date: '2026-07-27' }),
    mkInvoice('24512000000123458902', '广州迅达物流股份有限公司', 29500.00, 0.09, '运输费', 'xml', 0.99, 'verified', { date: '2026-07-16' }),
    mkInvoice('24512000000123459120', '深圳市宏图纸品包装有限公司', 78000.00, 0.13, '包装材料', 'xml', 0.99, 'verified', { date: '2026-07-20' }),
    mkInvoice('24512000000123459563', '北京中天咨询有限公司', 18600.00, 0.06, '咨询服务费', 'xml', 0.99, 'verified', { date: '2026-07-24' }),
    mkInvoice('24512000000123459887', '华信电子科技有限公司', 486200.00, 0.13, '原材料采购', 'xml', 0.99, 'pending', { date: '2026-07-29' }),
    mkInvoice('03212000011234567890', '深圳市南山办公用品商行', 4860.00, 0.13, '办公费', 'ocr', 0.95, 'verified', { date: '2026-07-08', fields: { ocrText: '深圳增值税专用发票 代码:0312192130 号码:03212000011234567890 价税合计(大写)伍仟肆佰捌拾壹元捌角' } }),
    mkInvoice('14432000022345678901', '深圳亚朵酒店管理有限公司', 3250.00, 0.06, '差旅费', 'ocr', 0.93, 'verified', { date: '2026-07-15', fields: { ocrText: '增值税普通发票 酒店住宿费 金额3250.00 税率6%' } }),
    mkInvoice('14432000022345679999', '中国石化销售股份有限公司', 8600.00, 0.13, '车辆使用费', 'ocr', 0.91, 'verified', { date: '2026-07-19', fields: { ocrText: '成品油发票 加油卡充值 8600元' } }),
    // 低置信度埋点1：图像倾斜，金额识别不清
    {
      invoiceNo: '14432OCRLOW001', type: '增值税普通发票', issueDate: '2026-07-22', seller: '深圳市福田区百果园水果店',
      buyer: '深圳市示例科技有限公司', amount: 680, taxRate: 0.01, taxAmount: 6.8, totalAmount: 686.8,
      category: '业务招待费', sourceType: 'ocr', confidence: 0.62, status: 'pending', checkStatus: 'unchecked',
      ocrText: 'OCR识别置信度低：发票代码模糊，金额区域反光，卖家名称疑似「百果四水果店」（置信度62%）',
    },
    // 低置信度埋点2：购方名称与本公司不符
    {
      invoiceNo: '24512000000999990001', type: '数电票（增值税普通发票）', issueDate: '2026-07-25', seller: '杭州云启网络科技有限公司',
      buyer: '深圳示例科技有限公司（缺「市」字，与工商登记名称不符）', amount: 12000, taxRate: 0.06, taxAmount: 720, totalAmount: 12720,
      category: '技术服务费', sourceType: 'xml', confidence: 0.71, status: 'pending', checkStatus: 'unchecked',
    },
  ];
  for (const inv of invoices) await prisma.invoice.create({ data: inv });

  // ============ 凭证（已过账 3 张 + 待审 1 张）===========
  const v1 = await prisma.voucher.create({
    data: {
      voucherNo: '记-0702', voucherDate: '2026-07-02', summary: '支付华信电子货款', source: 'bank', status: 'posted',
      totalDebit: 266680, createdBy: '银企对账Agent', approvedBy: '朱方林',
      items: {
        create: [
          { subjectCode: '2202', subjectName: '应付账款', direction: '借', amount: 236000, summary: '华信电子' },
          { subjectCode: '2221.01', subjectName: '应交税费-进项税额', direction: '借', amount: 30680, summary: '进项税' },
          { subjectCode: '1002', subjectName: '银行存款', direction: '贷', amount: 266680, summary: '工行付款' },
        ],
      },
    },
  });
  await prisma.voucher.create({
    data: {
      voucherNo: '记-0703', voucherDate: '2026-07-03', summary: '瑞丰电器回款', source: 'bank', status: 'posted',
      totalDebit: 50850, createdBy: '银企对账Agent', approvedBy: '朱方林',
      items: {
        create: [
          { subjectCode: '1002', subjectName: '银行存款', direction: '借', amount: 45000 },
          { subjectCode: '1122', subjectName: '应收账款', direction: '贷', amount: 45000 },
        ],
      },
    },
  });
  await prisma.voucher.create({
    data: {
      voucherNo: '记-0708', voucherDate: '2026-07-08', summary: '报销办公费', source: 'invoice', status: 'posted',
      totalDebit: 5481.8, createdBy: '发票Agent', approvedBy: '李会计',
      items: {
        create: [
          { subjectCode: '6602.01', subjectName: '管理费用-办公费', direction: '借', amount: 4860, summary: '办公用品' },
          { subjectCode: '2221.01', subjectName: '应交税费-进项税额', direction: '借', amount: 621.8 },
          { subjectCode: '1001', subjectName: '库存现金', direction: '贷', amount: 5481.8 },
        ],
      },
    },
  });
  const pendingVoucher = await prisma.voucher.create({
    data: {
      voucherNo: '记-0729', voucherDate: '2026-07-29', summary: '华信电子原材料采购（发票待审）', source: 'invoice', status: 'pending',
      totalDebit: 549406, createdBy: '发票Agent',
      items: {
        create: [
          { subjectCode: '1403', subjectName: '原材料', direction: '借', amount: 486200 },
          { subjectCode: '2221.01', subjectName: '应交税费-进项税额', direction: '借', amount: 63206 },
          { subjectCode: '2202', subjectName: '应付账款', direction: '贷', amount: 549406 },
        ],
      },
    },
  });

  // ============ AI 提案（3 待审 + 1 已批）===========
  const p1 = await prisma.proposal.create({
    data: {
      type: 'reconciliation', title: '短信服务费差异 0.01 元——建议以银行金额为准调账',
      aiAgent: '银企对账Agent', confidence: 0.97,
      aiReason: '银行实际扣款 28.50 元，账套录入 28.49 元，差异 0.01 元。银行回单具有最高可信度，判断为录入时四舍五入误差，建议按银行金额调增手续费 0.01 元。',
      payload: JSON.stringify({ bankRef: 'CMB2026070001', action: 'voucher', bankAmount: 28.5, ledgerAmount: 28.49, diff: 0.01, suggestion: '调账-借:管理费用-手续费 0.01 / 贷:银行存款 0.01', entries: [
        { subjectCode: '6602.03', subjectName: '管理费用-手续费', direction: '借', amount: 0.01, summary: '银企尾差调整（以银行扣款为准）' },
        { subjectCode: '1002', subjectName: '银行存款', direction: '贷', amount: 0.01, summary: '招行短信费尾差' },
      ] }),
    },
  });
  await prisma.proposal.create({
    data: {
      type: 'reconciliation', title: '招商银行账户管理费 200 元未入账——建议补提',
      aiAgent: '银企对账Agent', confidence: 0.95,
      aiReason: '银行 2026-07-20 扣收账户管理费 200 元，账套无对应记录。属于典型的「银行有、账上无」未达账项，月结前建议补提入账，避免银企余额调节表挂账。',
      payload: JSON.stringify({ bankRef: 'CMB2026070002', action: 'voucher', amount: 200, suggestion: '补提-借:管理费用-手续费 200 / 贷:银行存款 200', entries: [
        { subjectCode: '6602.03', subjectName: '管理费用-手续费', direction: '借', amount: 200, summary: '招行账户管理费 2026-07 补提' },
        { subjectCode: '1002', subjectName: '银行存款', direction: '贷', amount: 200, summary: '银行已扣账上未记' },
      ] }),
    },
  });
  await prisma.proposal.create({
    data: {
      type: 'reconciliation', title: '联创精密 89,000 元收款被银行拆分为两笔到账',
      aiAgent: '银企对账Agent', confidence: 0.93,
      aiReason: '账套整笔确认收款 89,000 元（记-0732），银行分两笔到账 50,000 + 39,000 元。金额合计一致，判断为银行大额收款拆分清算规则，建议建立「一对多」匹配关系而非差异调账。',
      payload: JSON.stringify({ ledgerVoucher: '记-0732', bankRefs: ['ICBC202600031', 'ICBC202600032'], bankTotal: 89000, ledgerAmount: 89000, suggestion: '建立拆分匹配关系' }),
    },
  });
  const pInv = await prisma.proposal.create({
    data: {
      type: 'invoice', title: '低置信度发票 2 张——建议人工复核后处理',
      aiAgent: '数据质量Agent', confidence: 0.62,
      aiReason: '发票 14432OCRLOW001 OCR 置信度仅 62%（图像反光）；发票 24512000000999990001 购方名称与工商登记名称不一致（缺「市」字）。两张均不建议自动生成凭证，已转人工复核队列。',
      payload: JSON.stringify({ invoices: ['14432OCRLOW001', '24512000000999990001'], reason: '低置信度+购方名称异常' }),
    },
  });
  const pDone = await prisma.proposal.create({
    data: {
      type: 'reconciliation', title: '工行 26 笔流水自动匹配——已批量确认',
      aiAgent: '银企对账Agent', confidence: 0.99,
      aiReason: '26 笔银行流水与账套记录在金额、日期、对方户名三项规则全部一致，符合自动匹配条件，已建立匹配关系。',
      payload: JSON.stringify({ matched: 26, rule: '金额+日期+户名三重命中' }),
      status: 'approved', decidedAt: new Date('2026-08-01T09:30:00+08:00'), decidedBy: '朱方林',
      approvals: {
        create: [{ action: 'approve', actor: '朱方林', comment: '同意批量匹配', createdAt: new Date('2026-08-01T09:30:00+08:00') }],
      },
    },
  });

  // ============ 费用报销单（3 已结 + 2 待审埋点）============
  const mkClaimCheck = (rules) => JSON.stringify({ rules, aiSuggestion: { category: rules.at(-1).note.match(/（(.+?)，/)?.[1] ?? '费用', subjectCode: '', confidence: 0.9 }, degraded: false });
  await prisma.expenseClaim.createMany({
    data: [
      {
        claimNo: 'BX-202607-001', employee: '陈曦', department: '销售部', category: '差旅费', subjectCode: '6602.02',
        amount: 3250.00, description: '上海客户拜访住宿及交通', invoiceNos: '14432000022345678901',
        aiCheck: mkClaimCheck([{ rule: '发票查验', pass: true, note: '发票 14432000022345678901 已查验一致' }, { rule: '额度控制', pass: true, note: '金额在常规审批额度内' }, { rule: 'AI 科目建议', pass: true, note: '建议入账科目 6602.02（差旅费，置信度 93%）' }]),
        status: 'paid', voucherNo: '记-0708', decidedAt: new Date('2026-07-16T10:00:00+08:00'), decidedBy: '李会计',
        createdAt: new Date('2026-07-15T09:12:00+08:00'),
      },
      {
        claimNo: 'BX-202607-002', employee: '刘畅', department: '行政部', category: '办公费', subjectCode: '6602.01',
        amount: 4860.00, description: '部门打印机耗材与文具集中采购', invoiceNos: '03212000011234567890',
        aiCheck: mkClaimCheck([{ rule: '发票查验', pass: true, note: '发票 03212000011234567890 已查验一致' }, { rule: '额度控制', pass: true, note: '金额在常规审批额度内' }, { rule: 'AI 科目建议', pass: true, note: '建议入账科目 6602.01（办公费，置信度 95%）' }]),
        status: 'paid', voucherNo: '记-0708', decidedAt: new Date('2026-07-09T14:30:00+08:00'), decidedBy: '李会计',
        createdAt: new Date('2026-07-08T16:40:00+08:00'),
      },
      {
        claimNo: 'BX-202607-003', employee: '赵铭', department: '研发部', category: '差旅费', subjectCode: '6602.02',
        amount: 1860.00, description: '东莞供应商现场技术支持往返高铁',
        aiCheck: mkClaimCheck([{ rule: '发票关联', pass: true, note: '无票报销（小额/补贴类），免查验' }, { rule: '额度控制', pass: true, note: '金额在常规审批额度内' }, { rule: 'AI 科目建议', pass: true, note: '建议入账科目 6602.02（差旅费，置信度 91%）' }]),
        status: 'approved', voucherNo: '记-7698', decidedAt: new Date('2026-07-24T11:00:00+08:00'), decidedBy: '朱方林',
        createdAt: new Date('2026-07-23T18:20:00+08:00'),
      },
      // 埋点1：正常小额待审——现场演示可直接「通过」自动出凭证
      {
        claimNo: 'BX-202607-004', employee: '孙倩', department: '市场部', category: '业务招待费', subjectCode: '6602',
        amount: 1680.00, description: '华东大区客户答谢晚宴',
        aiCheck: mkClaimCheck([{ rule: '发票关联', pass: true, note: '无票报销（小额/补贴类），免查验' }, { rule: '额度控制', pass: true, note: '金额在常规审批额度内' }, { rule: '税务合规', pass: true, note: '业务招待费按发生额 60% 且不超过营收 0.5% 税前扣除，请在备注中注明招待对象' }, { rule: 'AI 科目建议', pass: true, note: '建议入账科目 6602（业务招待费，置信度 88%）' }]),
        status: 'submitted',
        createdAt: new Date('2026-07-30T10:05:00+08:00'),
      },
      // 埋点2：大额待审——演示「规则拦截，AI 不越权」
      {
        claimNo: 'BX-202607-005', employee: '周航', department: '研发部', category: '培训费', subjectCode: '6602',
        amount: 12800.00, description: '团队云原生架构专项外训（含讲师费）',
        aiCheck: mkClaimCheck([{ rule: '发票关联', pass: true, note: '无票报销（小额/补贴类），免查验' }, { rule: '额度控制', pass: false, note: '金额 ¥12,800.00 超过 ¥5,000，需部门总监加签后才能过审' }, { rule: 'AI 科目建议', pass: true, note: '建议入账科目 6602（培训费，置信度 90%）' }]),
        status: 'submitted',
        createdAt: new Date('2026-07-31T15:45:00+08:00'),
      },
    ],
  });

  // ============ 审计日志 ============
  await prisma.auditLog.createMany({
    data: [
      { actorType: 'system', actor: 'system', module: 'auth', action: 'login', detail: JSON.stringify({ user: 'admin', ip: '127.0.0.1' }), ts: new Date('2026-08-01T09:00:00+08:00') },
      { actorType: 'ai', actor: '银企对账Agent', module: 'reconciliation', action: 'match', detail: JSON.stringify({ rule: '金额+日期+户名', matched: 26 }), model: 'deepseek-chat', tokenCost: 0.0421, ts: new Date('2026-08-01T09:10:00+08:00') },
      { actorType: 'ai', actor: '银企对账Agent', module: 'reconciliation', action: 'explain', detail: JSON.stringify({ findings: 4, flagged: ['CMB2026070001', 'CMB2026070002', '拆分到账', '在途电费'] }), model: 'deepseek-chat', tokenCost: 0.0865, ts: new Date('2026-08-01T09:12:00+08:00') },
      { actorType: 'ai', actor: '数据质量Agent', module: 'invoice', action: 'review', detail: JSON.stringify({ lowConfidence: 2, checked: 15 }), model: 'deepseek-chat', tokenCost: 0.0332, ts: new Date('2026-08-01T09:20:00+08:00') },
      { actorType: 'human', actor: '朱方林', module: 'reconciliation', action: 'approve', detail: JSON.stringify({ proposalId: pDone.id, result: 'approved' }), ts: new Date('2026-08-01T09:30:00+08:00') },
      { actorType: 'ai', actor: '发票Agent', module: 'invoice', action: 'voucherize', detail: JSON.stringify({ invoice: '24512000000123456789', voucherNo: v1.voucherNo }), model: 'deepseek-chat', tokenCost: 0.0288, ts: new Date('2026-08-01T09:35:00+08:00') },
      { actorType: 'system', actor: 'system', module: 'audit', action: 'hash', detail: JSON.stringify({ note: '审计日志链哈希校验通过', prevBlocks: 6 }), ts: new Date('2026-08-01T10:00:00+08:00') },
    ],
  });

  // ============ 汇总输出 ============
  const counts = {
    users: await prisma.user.count(),
    subjects: await prisma.subject.count(),
    partners: await prisma.partner.count(),
    bankAccounts: await prisma.bankAccount.count(),
    bankTransactions: await prisma.bankTransaction.count(),
    ledgerEntries: await prisma.ledgerEntry.count(),
    invoices: await prisma.invoice.count(),
    vouchers: await prisma.voucher.count(),
    proposals: await prisma.proposal.count(),
    approvals: await prisma.approvalRecord.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log('演示数据灌入完成：', JSON.stringify(counts, null, 2));

  const bankUnmatched = await prisma.bankTransaction.count({ where: { matchStatus: { not: 'matched' } } });
  const ledgerUnmatched = await prisma.ledgerEntry.count({ where: { matchStatus: { not: 'matched' } } });
  const lowConf = await prisma.invoice.count({ where: { confidence: { lt: 0.8 } } });
  console.log(`埋点验证 → 银行侧异常 ${bankUnmatched} 笔 | 账套侧异常 ${ledgerUnmatched} 笔 | 低置信度发票 ${lowConf} 张`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
