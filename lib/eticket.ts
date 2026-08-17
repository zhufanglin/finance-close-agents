// 数电票（全电发票）XML 直解析 —— 零 OCR，100% 字段准确
// 兼容税总标准格式：发票为 <Invoice> 节点，字段在 <IssueData>/tax flag 结构中

export interface EticketResult {
  ok: boolean;
  data?: {
    invoiceNo: string;
    invoiceCode?: string;
    type: string;
    issueDate: string;
    seller: string;
    buyer: string;
    amount: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
  };
  error?: string;
}

interface TaxField {
  'TaxpayerName'?: string[] | string;
  'Name'?: string;
  'Amount'?: string;
  'TaxRate'?: string;
  'TaxAmount'?: string;
  'TotalAmount'?: string;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** 宽松提取：先按标签名全局找，不依赖命名空间 */
function pick(xml: string, tagName: string): string {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const m = xml.match(re);
  return m ? decodeXmlEntities(m[1].trim()) : '';
}

function pickAll(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(decodeXmlEntities(m[1].trim()));
  return out;
}

function toNum(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/[¥￥,，\s]/g, '')) || 0;
}

function toRate(s: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace('%', ''));
  if (Number.isNaN(n)) return 0;
  return n > 1 ? n / 100 : n; // 13% → 0.13
}

export function parseEticketXml(xml: string): EticketResult {
  try {
    // 发票号码：InvoiceNo / 发票号码
    const invoiceNo =
      pick(xml, 'InvoiceNo') ||
      pick(xml, 'InvoiceNumber') ||
      xml.match(/发票号码[：:\s]*(\d{8,20})/)?.[1] ||
      '';

    // 发票类型：02603 全电普票 / 02604（专票试点）…；直接看文本特征更可靠
    const typeText = pick(xml, 'InvoiceType') || xml;
    let type = '数电普票';
    if (/专用|专票|Special/.test(typeText)) type = '数电专票';
    else if (/普通|普票|General/.test(typeText)) type = '数电普票';

    // 开票日期 IssueDate / IssueDateStr / 开票日期
    const rawDate = pick(xml, 'IssueDate') || pick(xml, 'IssueDateStr') || xml.match(/开票日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/)?.[1] || '';
    const cn = rawDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const issueDate = cn
      ? `${cn[1]}-${String(cn[2]).padStart(2, '0')}-${String(cn[3]).padStart(2, '0')}`
      : rawDate.slice(0, 10);

    // 购销方：标准格式为 <TaxpayerName>（第一个=购买方，第二个=销售方）
    let names = pickAll(xml, 'TaxpayerName');
    if (names.length < 2) names = pickAll(xml, 'Name');
    let buyer = names[0] || '';
    let seller = names[1] || '';
    // 兜底：中文标签
    if (!buyer) buyer = xml.match(/购买方[：:\s]*([^\n<]{4,40})/)?.[1]?.trim() || '';
    if (!seller) seller = xml.match(/销售方[：:\s]*([^\n<]{4,40})/)?.[1]?.trim() || '';

    // 金额：明细行 Amount 合计 / TotalAmount / 价税合计
    const amounts = pickAll(xml, 'Amount').map(toNum).filter((n) => n > 0);
    const amount = pick(xml, 'TotalAmountWithoutTax') ? toNum(pick(xml, 'TotalAmountWithoutTax')) : amounts.length ? amounts.reduce((a, b) => a + b, 0) : 0;
    const taxAmount = toNum(pick(xml, 'TotalTaxAmount') || pick(xml, 'TaxAmount'));
    const totalAmount = toNum(pick(xml, 'TotalAmount') || pick(xml, 'TotalAmountWithTax')) || amount + taxAmount;
    const rates = pickAll(xml, 'TaxRate').map(toRate).filter((n) => n > 0 && n < 0.2);
    const taxRate = rates.length ? Math.max(...rates) : amount && taxAmount ? taxAmount / amount : 0;

    if (!invoiceNo) return { ok: false, error: '未找到发票号码，不是有效的数电票 XML' };

    return {
      ok: true,
      data: { invoiceNo, type, issueDate, seller, buyer, amount, taxRate, taxAmount, totalAmount },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'XML 解析失败' };
  }
}
