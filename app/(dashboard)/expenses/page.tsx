'use client';

import { useEffect, useState } from 'react';
import { Receipt, Check, X, Loader2, Sparkles, BadgeCheck, AlertTriangle, Upload, Wand2 } from 'lucide-react';

type AiCheck = {
  rules?: Array<{ rule: string; pass: boolean; note: string }>;
  aiSuggestion?: { category: string; subjectCode: string; confidence: number };
  degraded?: boolean;
  usage?: { prompt: number; completion: number; costYuan: number };
};
type Claim = {
  id: number; claimNo: string; employee: string; department: string; category: string;
  subjectCode: string | null; amount: number; description: string; invoiceNos: string | null;
  aiCheck: string | null; status: string; voucherNo: string | null;
  createdAt: string; decidedAt: string | null; decidedBy: string | null;
};

const fmt = (n: number) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

const STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: '待审批', cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  approved: { label: '已审 · 待支付', cls: 'bg-green-50 text-green-700 border-green-200' },
  paid: { label: '已支付', cls: 'bg-slate-100 text-ink-secondary border-slate-200' },
  rejected: { label: '已驳回', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
};

const CATEGORIES = ['差旅费', '办公费', '业务招待费', '通讯费', '培训费', '其他'];
const DEPARTMENTS = ['财务部', '销售部', '研发部', '行政部', '生产部'];

export default function ExpensesPage() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [detail, setDetail] = useState<Claim | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // 提交表单
  const [form, setForm] = useState({ employee: '', department: DEPARTMENTS[0], category: CATEGORIES[0], amount: '', description: '', invoiceNos: '' });
  const [submitting, setSubmitting] = useState(false);
  // 传票自动填单
  const [uploading, setUploading] = useState(false);
  const [autoFill, setAutoFill] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  // 上传发票 → OCR + DeepSeek 抽取 → 自动填充表单
  const handleInvoiceUpload = async (file: File) => {
    setUploading(true); setMsg(null); setAutoFill(null); setPreviewImg(null);
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/invoices/upload', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    setUploading(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error || '发票识别失败，可手动填写' }); return; }
    const inv = d.invoice;
    if (!inv) { setMsg({ ok: false, text: '未返回发票数据' }); return; }
    // 类别映射：发票类别不在选项里则归入「其他」
    const cat = CATEGORIES.includes(inv.category) ? inv.category : '其他';
    setForm((f) => ({
      ...f,
      category: cat,
      amount: inv.totalAmount ? String(inv.totalAmount) : f.amount,
      invoiceNos: inv.invoiceNo ? (f.invoiceNos ? `${f.invoiceNos}, ${inv.invoiceNo}` : inv.invoiceNo) : f.invoiceNos,
      description: inv.seller ? `${inv.seller} 发票费用` : f.description,
    }));
    if (d.channel === 'ocr') {
      setPreviewImg(`/api/invoices/image/${inv.id}`);
    }
    setAutoFill(`已自动填入：金额 ${inv.totalAmount ? '¥' + inv.totalAmount : '—'} · 类别 ${cat} · 发票 ${inv.invoiceNo ?? '—'}${d.channel === 'ocr' ? '（OCR 识别）' : '（XML 直读）'}`);
  };

  const load = () => {
    fetch('/api/expenses').then((r) => (r.ok ? r.json() : null)).then((d) => setClaims(d?.claims ?? []));
  };
  useEffect(load, []);

  const decide = async (id: number, action: 'approve' | 'reject') => {
    setBusy(id); setMsg(null);
    const r = await fetch(`/api/expenses/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const d = await r.json();
    setBusy(null);
    setMsg(r.ok
      ? { ok: true, text: d.voucher ? `已通过：自动过账生成凭证 ${d.voucher.voucherNo}（借 ${d.voucher.debit} ${fmt(d.voucher.amount)}）` : '已驳回：记录留痕' }
      : { ok: false, text: `操作失败：${d.error}` });
    load();
  };

  const submit = async () => {
    setSubmitting(true); setMsg(null);
    const r = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error || '提交失败' }); return; }
    setMsg({ ok: true, text: `报销单 ${d.claim.claimNo} 已提交，进入审批队列` });
    setForm({ employee: '', department: DEPARTMENTS[0], category: CATEGORIES[0], amount: '', description: '', invoiceNos: '' });
    setAutoFill(null);
    setPreviewImg(null);
    load();
    setDetail(d.claim);
  };

  const parseCheck = (c: Claim | null): AiCheck => {
    if (!c?.aiCheck) return {};
    try { return JSON.parse(c.aiCheck); } catch { return {}; }
  };

  return (
    <div>
      <div className="card p-5 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-ink-primary flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center"><Receipt size={15} /></span>
            费用报销
          </div>
          <div className="text-[13px] text-ink-secondary mt-1">员工提交 → 规则审核 + AI 科目建议 → 审批 → 自动生成凭证</div>
        </div>
        <span className="chip">月结期间 D+5</span>
      </div>

      {msg && (
        <div className={`card px-4 py-3 mb-4 text-[13px] ${msg.ok ? 'text-green-700 bg-green-50/60' : 'text-rose-600 bg-rose-50/60'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* 左：报销单列表 */}
        <div className="xl:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-ink-primary">报销单（{claims?.length ?? '…'}）</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-ink-tertiary">
                  <th className="th">单号</th><th className="th">提交人</th><th className="th">类别</th>
                  <th className="th text-right">金额</th><th className="th">AI 科目</th><th className="th">状态</th><th className="th">操作</th>
                </tr>
              </thead>
              <tbody>
                {(claims ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer" onClick={() => setDetail(c)}>
                    <td className="td font-mono text-xs">{c.claimNo}</td>
                    <td className="td">{c.employee}<span className="text-ink-tertiary text-[11px] ml-1">{c.department}</span></td>
                    <td className="td">{c.category}</td>
                    <td className="td text-right font-medium">{fmt(c.amount)}</td>
                    <td className="td font-mono text-xs text-ink-secondary">{c.subjectCode || '—'}</td>
                    <td className="td">
                      <span className={`text-xs border rounded-md px-2 py-0.5 ${STATUS[c.status]?.cls ?? ''}`}>
                        {STATUS[c.status]?.label ?? c.status}{c.voucherNo ? ` · ${c.voucherNo}` : ''}
                      </span>
                    </td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      {c.status === 'submitted' && (
                        <div className="flex gap-1.5">
                          <button className="btn-primary !px-2.5 !py-1 !text-xs flex items-center gap-1" disabled={busy === c.id} onClick={() => decide(c.id, 'approve')}>
                            {busy === c.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}通过
                          </button>
                          <button className="border border-slate-200 rounded-md px-2.5 py-1 text-xs text-ink-secondary hover:bg-slate-50 flex items-center gap-1" disabled={busy === c.id} onClick={() => decide(c.id, 'reject')}>
                            <X size={12} />驳回
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {claims && claims.length === 0 && (
                  <tr><td colSpan={7} className="td text-center text-ink-tertiary py-8">暂无报销单，从右侧提交第一笔</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 右：提交新报销 */}
        <div className="card p-5 h-fit">
          <div className="text-sm font-medium text-ink-primary mb-1">提交报销</div>

          {/* 传票自动填单 */}
          <div className="mb-3 mt-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-3">
            <div className="text-[12px] font-medium text-brand-700 flex items-center gap-1 mb-1.5"><Wand2 size={13} />传票自动填单</div>
            <label className={`flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white hover:bg-brand-50 text-brand-700 text-[12px] px-3 py-2 cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
              {uploading ? '识别中（OCR + AI 抽取约 5~15 秒）…' : '上传发票图片 / XML，自动填充表单'}
              <input type="file" accept=".png,.jpg,.jpeg,.bmp,.webp,.xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInvoiceUpload(f); e.target.value = ''; }} />
            </label>
            {autoFill && (
              <div className="mt-2 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 leading-relaxed">
                {autoFill}
                {previewImg && (
                  <div className="flex items-center gap-2.5 mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImg}
                      alt="发票原图"
                      className="h-16 w-auto rounded-md border border-green-200 bg-white object-contain cursor-zoom-in"
                      title="点击放大核对抽取字段"
                      onClick={() => window.open(previewImg, '_blank')}
                    />
                    <span className="text-[11px] text-green-700/80">原图已保留，点击放大核对抽取结果</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <input className="input w-full" placeholder="提交人姓名" value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })} />
            <div className="grid grid-cols-2 gap-2.5">
              <select className="input w-full" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <select className="input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <input className="input w-full" placeholder="金额（元），超 5000 需总监加签" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <textarea className="input w-full" rows={2} placeholder="费用事由（AI 依据事由建议入账科目）" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="input w-full" placeholder="关联发票号（可多个，逗号分隔，可空）" value={form.invoiceNos} onChange={(e) => setForm({ ...form, invoiceNos: e.target.value })} />
            <button className="btn-primary w-full flex items-center justify-center gap-1.5" disabled={submitting} onClick={submit}>
              {submitting ? <><Loader2 size={14} className="animate-spin" />提交中（AI 审核约 5~15 秒）</> : <>提交并触发 AI 审核</>}
            </button>
            <div className="text-[11px] text-ink-tertiary leading-relaxed">
              提交后自动执行：发票关联核验 → 额度规则 → 业务招待税务提示 → DeepSeek 科目建议（不可用时降级规则），全部留痕审计。
            </div>
          </div>
        </div>
      </div>

      {/* 审核明细弹层 */}
      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-sm text-ink-primary">{detail.claimNo}</div>
                <div className="text-lg font-semibold mt-0.5">{fmt(detail.amount)} <span className="text-sm font-normal text-ink-secondary">{detail.category}</span></div>
              </div>
              <button className="text-ink-tertiary hover:text-ink-primary" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="text-[13px] text-ink-secondary mb-4">{detail.employee} · {detail.department} · {detail.description}</div>
            {detail.invoiceNos && <div className="text-xs text-ink-tertiary mb-4">关联发票：{detail.invoiceNos}</div>}

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-medium text-ink-secondary mb-2 flex items-center gap-1"><Sparkles size={12} />AI + 规则审核结果</div>
              <div className="space-y-2">
                {(parseCheck(detail).rules ?? []).map((r, i) => (
                  <div key={i} className="flex gap-2 text-[13px] items-start">
                    {r.pass ? <BadgeCheck size={15} className="text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />}
                    <div>
                      <span className="text-ink-primary">{r.rule}</span>
                      <span className="text-ink-tertiary"> — {r.note}</span>
                    </div>
                  </div>
                ))}
                {!parseCheck(detail).rules && <div className="text-xs text-ink-tertiary">（种子数据单据，无审核记录）</div>}
              </div>
              {detail.voucherNo && (
                <div className="mt-3 text-xs bg-green-50 text-green-700 rounded-lg px-3 py-2">
                  审批通过后已自动过账：凭证 {detail.voucherNo}（{detail.decidedBy} 审批）
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
