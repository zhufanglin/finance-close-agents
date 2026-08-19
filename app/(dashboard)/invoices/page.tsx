'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, ShieldAlert, Upload, Sparkles } from 'lucide-react';

type Invoice = {
  id: number; invoiceNo: string; type: string; issueDate: string;
  seller: string; buyer: string; amount: number; taxRate: number;
  taxAmount: number; totalAmount: number; category: string | null;
  sourceType: string; confidence: number; status: string; checkStatus: string;
  ocrText: string | null; filePath: string | null;
};
type Data = {
  invoices: Invoice[];
  summary: { total: number; pending: number; verified: number; voucherized: number; lowConfidence: number; totalAmount: number };
};

const fmt = (n: number) =>
  '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_META: Record<string, { label: string; cls: string }> = {
  voucherized: { label: '已生成凭证', cls: 'bg-brand-50 text-brand-600 border-brand-100' },
  verified: { label: '已查验', cls: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: '待处理', cls: 'bg-orange-50 text-orange-600 border-orange-200' },
};

function ConfidenceBar({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const color = v >= 0.9 ? 'bg-green-500' : v >= 0.8 ? 'bg-amber-500' : 'bg-rose-500';
  const text = v >= 0.9 ? 'text-green-600' : v >= 0.8 ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] ${text}`}>{pct}%</span>
    </div>
  );
}

export default function InvoicesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'all' | 'pending' | 'low' | 'done'>('all');
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    fetch('/api/invoices')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  };

  useEffect(load, []);

  const onUpload = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/invoices/upload', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) {
        setUploadMsg({ ok: false, text: j.error || '上传失败' });
      } else {
        const inv = j.invoice;
        setUploadMsg({
          ok: true,
          text:
            j.channel === 'xml'
              ? `✓ 数电票直解析成功：${inv.invoiceNo}（价税合计 ${fmt(inv.totalAmount)}，字段 100% 准确）`
              : `✓ ${j.degraded ? 'OCR 成功（AI 抽取降级为规则）' : 'OCR + DeepSeek 结构化成功'}：${inv.invoiceNo} · 置信度 ${Math.round(inv.confidence * 100)}%${inv.confidence < 0.8 ? '（低于阈值，已转人工复核）' : ''}`,
        });
        load();
        setDetail(inv);
      }
    } catch (e) {
      setUploadMsg({ ok: false, text: e instanceof Error ? e.message : '网络错误' });
    } finally {
      setUploading(false);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    if (tab === 'pending') return data.invoices.filter((i) => i.status === 'pending');
    if (tab === 'low') return data.invoices.filter((i) => i.confidence < 0.8);
    if (tab === 'done') return data.invoices.filter((i) => i.status !== 'pending');
    return data.invoices;
  }, [data, tab]);

  const tabs = [
    { key: 'all' as const, label: `全部 ${data?.summary.total ?? ''}` },
    { key: 'pending' as const, label: `待处理 ${data?.summary.pending ?? ''}` },
    { key: 'low' as const, label: `低置信度 ${data?.summary.lowConfidence ?? ''}` },
    { key: 'done' as const, label: `已处理 ${data ? data.summary.verified + data.summary.voucherized : ''}` },
  ];

  return (
    <div>
      {/* 概览 + 上传区 */}
      <div className="card p-4 mb-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <FileText size={18} />
          </div>
          <div>
            <div className="text-[15px] font-medium text-ink-primary">发票中心</div>
            <div className="text-xs text-ink-tertiary mt-0.5">
              价税合计 {data ? fmt(data.summary.totalAmount) : '—'} · 数电票直解析 / OCR 识别双通道
            </div>
          </div>
        </div>
        <div className="h-8 w-px bg-line" />
        <div className="flex items-center gap-2 text-xs text-ink-secondary">
          <span className="flex items-center gap-1.5"><span className="dot bg-brand-400" />数电票 XML（100% 字段）</span>
          <span className="flex items-center gap-1.5"><span className="dot bg-blue-800" />图片 OCR（置信度分级）</span>
        </div>
        <label className={`btn-primary ml-auto flex items-center gap-1.5 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
          {uploading ? '识别中…（OCR + AI 抽取约 5~15 秒）' : '上传发票（图片 / 数电票 XML）'}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.bmp,.webp,.xml"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              onUpload(e.target.files?.[0] ?? null);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      {/* 上传结果反馈 */}
      {uploadMsg && (
        <div className={`rounded-xl border px-4 py-3 mb-4 text-[13px] ${uploadMsg.ok ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {uploadMsg.text}
        </div>
      )}

      {/* 低置信度警示横幅 */}
      {data && data.summary.lowConfidence > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 mb-4 flex items-center gap-2.5">
          <ShieldAlert size={16} className="text-rose-600 shrink-0" />
          <div className="text-[13px] text-rose-700">
            检出 <b>{data.summary.lowConfidence} 张低置信度发票</b>（OCR &lt;80% 或购方名称异常），已拦截自动生成凭证，转人工复核队列
          </div>
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-1 mb-3 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand-400 text-brand-600 font-medium'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 发票表 */}
      <div className="card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">发票号码</th>
                <th className="th">类型</th>
                <th className="th">开票日期</th>
                <th className="th">销方 → 购方</th>
                <th className="th">金额</th>
                <th className="th">税额</th>
                <th className="th">价税合计</th>
                <th className="th">AI 置信度</th>
                <th className="th">状态</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {!data && <tr><td className="td text-ink-tertiary" colSpan={10}>加载中…</td></tr>}
              {rows.map((inv) => (
                <tr key={inv.id} className={inv.confidence < 0.8 ? 'bg-rose-50/30' : ''}>
                  <td className="td font-mono text-[13px]">{inv.invoiceNo}</td>
                  <td className="td">
                    <span className={`text-xs border rounded-md px-2 py-0.5 ${
                      inv.sourceType === 'xml'
                        ? 'bg-brand-50 text-brand-600 border-brand-100'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {inv.sourceType === 'xml' ? '数电票' : 'OCR'}
                    </span>
                  </td>
                  <td className="td text-ink-secondary">{inv.issueDate}</td>
                  <td className="td max-w-[260px] truncate" title={`${inv.seller} → ${inv.buyer}`}>
                    <div className="text-ink-primary">{inv.seller}</div>
                    <div className="text-[11px] text-ink-tertiary mt-0.5">→ {inv.buyer}</div>
                  </td>
                  <td className="td">{fmt(inv.amount)}</td>
                  <td className="td text-ink-secondary">{fmt(inv.taxAmount)} <span className="text-[11px] text-ink-tertiary">({Math.round(inv.taxRate * 100)}%)</span></td>
                  <td className="td font-medium">{fmt(inv.totalAmount)}</td>
                  <td className="td"><ConfidenceBar v={inv.confidence} /></td>
                  <td className="td">
                    <span className={`text-xs border rounded-md px-2 py-0.5 ${STATUS_META[inv.status].cls}`}>
                      {STATUS_META[inv.status].label}
                    </span>
                  </td>
                  <td className="td">
                    <button
                      onClick={() => setDetail(detail?.id === inv.id ? null : inv)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {detail?.id === inv.id ? '收起' : '详情'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 详情抽屉 */}
      {detail && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-brand-600" />
            <div className="text-sm font-medium text-ink-primary">发票详情 · {detail.invoiceNo}</div>
            <span className="text-[11px] text-ink-tertiary ml-auto">上传原图 ↔ 抽取结果对照</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-4">
            {/* 左：上传原图 */}
            <div>
              <div className="text-[11px] text-ink-tertiary mb-1.5">上传原图</div>
              {detail.filePath ? (
                <div className="rounded-xl border border-line overflow-hidden bg-slate-50 flex items-center justify-center min-h-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/invoices/image/${detail.id}`}
                    alt={`发票原图 ${detail.invoiceNo}`}
                    className="max-w-full max-h-[420px] object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-slate-50 text-xs text-ink-tertiary flex items-center justify-center min-h-[220px]">
                  数电票 XML 通道无图片（字段 100% 直读，无需对照）
                </div>
              )}
            </div>
            {/* 右：抽取字段 */}
            <div>
              <div className="text-[11px] text-ink-tertiary mb-1.5">AI 抽取字段</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                {[
                  ['类别', detail.category || '—'],
                  ['类型', detail.type],
                  ['销方', detail.seller],
                  ['购方', detail.buyer],
                  ['金额', fmt(detail.amount)],
                  ['税率', `${Math.round(detail.taxRate * 100)}%`],
                  ['税额', fmt(detail.taxAmount)],
                  ['价税合计', fmt(detail.totalAmount)],
                  ['采集方式', detail.sourceType === 'xml' ? '数电票 XML 直解析' : detail.sourceType === 'ocr' ? '图片 OCR 识别' : '手工录入'],
                  ['查验状态', detail.checkStatus === 'verified' ? '已查验' : '未查验'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[11px] text-ink-tertiary">{k}</div>
                    <div className="text-ink-primary mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {detail.ocrText && (
            <div className="rounded-lg bg-slate-50 border border-line p-3 text-xs text-ink-secondary leading-relaxed">
              <span className="text-ink-tertiary">原始识别文本：</span>{detail.ocrText}
            </div>
          )}
          {detail.confidence < 0.8 && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              置信度 {Math.round(detail.confidence * 100)}% 低于阈值 80%，系统已拦截自动凭证生成，请对照左侧原图人工复核字段后方可入账。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
