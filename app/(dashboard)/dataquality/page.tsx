'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Info, ArrowRight, Sparkles } from 'lucide-react';

type Check = { key: string; name: string; count: number; target: string; level: 'ok' | 'warn' | 'info'; desc: string };
type LowConf = { invoiceNo: string; seller: string; confidence: number; category: string | null };
type Data = { checks: Check[]; lowConf: LowConf[]; health: number; ai: { calls: number; costYuan: number } };

const LEVEL_META = {
  ok: { icon: ShieldCheck, cls: 'text-green-500', badge: 'bg-green-50 text-green-700 border-green-200', label: '通过' },
  warn: { icon: AlertTriangle, cls: 'text-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', label: '需处理' },
  info: { icon: Info, cls: 'text-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: '待确认' },
} as const;

export default function DataQualityPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/dataquality').then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);

  const healthColor = (data?.health ?? 0) >= 85 ? 'text-green-600' : (data?.health ?? 0) >= 60 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div>
      <div className="card p-5 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-ink-primary flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center"><ShieldCheck size={15} /></span>
            数据质量
          </div>
          <div className="text-[13px] text-ink-secondary mt-1">月结关账前的质量门禁：所有检查项清零或确认后，方可进入结账</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold ${healthColor}`}>{data ? `${data.health}` : '—'}<span className="text-sm font-normal text-ink-tertiary"> / 100</span></div>
          <div className="text-[11px] text-ink-tertiary">数据健康分</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <div className="text-sm font-medium text-ink-primary mb-3">检查项（{data?.checks.length ?? '…'}）</div>
          <div className="space-y-2.5">
            {(data?.checks ?? []).map((c) => {
              const m = LEVEL_META[c.level];
              const Icon = m.icon;
              return (
                <a key={c.key} href={c.target} className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-3 hover:border-brand-200 hover:bg-brand-50/30 transition-colors">
                  <Icon size={17} className={m.cls} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink-primary flex items-center gap-2">
                      {c.name}
                      <span className={`text-[11px] border rounded px-1.5 py-px ${m.badge}`}>{m.label}</span>
                    </div>
                    <div className="text-xs text-ink-tertiary mt-0.5 truncate">{c.desc}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-base font-semibold ${c.count > 0 ? (c.level === 'warn' ? 'text-amber-600' : 'text-ink-primary') : 'text-green-600'}`}>{c.count}</div>
                    <div className="text-[10px] text-ink-tertiary flex items-center gap-0.5 justify-end">去处理<ArrowRight size={9} /></div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-sm font-medium text-ink-primary mb-3 flex items-center gap-1.5"><AlertTriangle size={14} className="text-amber-500" />低置信度发票明细</div>
            <div className="space-y-2">
              {(data?.lowConf ?? []).map((i) => (
                <div key={i.invoiceNo} className="border border-amber-100 bg-amber-50/40 rounded-lg px-3 py-2">
                  <div className="font-mono text-xs text-ink-primary">{i.invoiceNo}</div>
                  <div className="flex justify-between text-[11px] text-ink-secondary mt-1">
                    <span className="truncate mr-2">{i.seller}</span>
                    <span className="text-amber-600 font-medium shrink-0">{Math.round(i.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
              {data && data.lowConf.length === 0 && <div className="text-xs text-ink-tertiary py-2">无低置信度发票 ✓</div>}
            </div>
          </div>

          <div className="card p-5">
            <div className="text-sm font-medium text-ink-primary mb-3 flex items-center gap-1.5"><Sparkles size={14} className="text-brand-500" />AI 调用账本</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xl font-semibold">{data?.ai.calls ?? '—'}</div>
                <div className="text-[11px] text-ink-tertiary">累计 AI 调用次数</div>
              </div>
              <div>
                <div className="text-xl font-semibold">¥{(data?.ai.costYuan ?? 0).toFixed(4)}</div>
                <div className="text-[11px] text-ink-tertiary">累计 token 成本</div>
              </div>
            </div>
            <div className="text-[11px] text-ink-tertiary mt-3 leading-relaxed">每次 AI 调用（抽取/解释/分类）均记录模型、token 数与成本，可在审计中心查看明细。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
