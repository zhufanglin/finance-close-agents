'use client';

import { useEffect, useState } from 'react';
import { Database, Landmark, Users, BookOpen } from 'lucide-react';

type Subject = { id: number; code: string; name: string; type: string; direction: string; level: number };
type Partner = { id: number; code: string; name: string; type: string; taxId: string | null; bankAccount: string | null };
type Account = { id: number; bankName: string; accountNo: string; accountName: string; currency: string; balance: number };

const fmt = (n: number) => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

const TYPE_CLS: Record<string, string> = {
  资产: 'text-blue-600 bg-blue-50',
  负债: 'text-amber-600 bg-amber-50',
  损益: 'text-purple-600 bg-purple-50',
  supplier: 'text-cyan-700 bg-cyan-50',
  customer: 'text-green-700 bg-green-50',
};

export default function MasterDataPage() {
  const [tab, setTab] = useState<'subjects' | 'partners' | 'accounts'>('subjects');
  const [data, setData] = useState<{ subjects: Subject[]; partners: Partner[]; accounts: Account[] } | null>(null);

  useEffect(() => {
    fetch('/api/masterdata').then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);

  const tabs = [
    { key: 'subjects', label: '会计科目', icon: BookOpen, count: data?.subjects.length },
    { key: 'partners', label: '客商', icon: Users, count: data?.partners.length },
    { key: 'accounts', label: '银行账户', icon: Landmark, count: data?.accounts.length },
  ] as const;

  return (
    <div>
      <div className="card p-5 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-ink-primary flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center"><Database size={15} /></span>
            主数据
          </div>
          <div className="text-[13px] text-ink-secondary mt-1">科目表 / 客商档案 / 银行账户 —— 所有凭证、对账、AI 建议共用的数据地基</div>
        </div>
        <span className="chip">演示系统 · 只读</span>
      </div>

      <div className="card p-5">
        <div className="flex gap-1 mb-4 border-b border-slate-100">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`px-3.5 py-2 text-[13px] rounded-t-lg flex items-center gap-1.5 -mb-px border-b-2 transition-colors ${
                tab === t.key ? 'text-brand-700 border-brand-500 bg-brand-50/40 font-medium' : 'text-ink-secondary border-transparent hover:text-ink-primary'
              }`}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} />{t.label}
              {t.count !== undefined && <span className="text-[11px] text-ink-tertiary">{t.count}</span>}
            </button>
          ))}
        </div>

        {tab === 'subjects' && (
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-ink-tertiary">
              <th className="th">科目编码</th><th className="th">科目名称</th><th className="th">类别</th>
              <th className="th">余额方向</th><th className="th">层级</th>
            </tr></thead>
            <tbody>
              {(data?.subjects ?? []).map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="td font-mono text-xs">{s.level === 2 ? <span className="text-ink-tertiary ml-3">└ </span> : null}{s.code}</td>
                  <td className="td">{s.name}</td>
                  <td className="td"><span className={`text-xs rounded px-1.5 py-0.5 ${TYPE_CLS[s.type] ?? ''}`}>{s.type}</span></td>
                  <td className="td">{s.direction}</td>
                  <td className="td text-ink-tertiary">一级 / 二级明细</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'partners' && (
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-ink-tertiary">
              <th className="th">客商编码</th><th className="th">名称</th><th className="th">类型</th><th className="th">纳税人识别号</th>
            </tr></thead>
            <tbody>
              {(data?.partners ?? []).map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="td font-mono text-xs">{p.code}</td>
                  <td className="td">{p.name}</td>
                  <td className="td"><span className={`text-xs rounded px-1.5 py-0.5 ${TYPE_CLS[p.type] ?? ''}`}>{p.type === 'supplier' ? '供应商' : '客户'}</span></td>
                  <td className="td font-mono text-xs text-ink-secondary">{p.taxId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'accounts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.accounts ?? []).map((a) => (
              <div key={a.id} className="border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 text-sm font-medium text-ink-primary">
                  <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Landmark size={14} /></span>
                  {a.bankName}
                </div>
                <div className="font-mono text-xs text-ink-secondary mt-2.5">{a.accountNo}</div>
                <div className="text-xs text-ink-tertiary mt-1">{a.accountName} · {a.currency}</div>
                <div className="text-lg font-semibold mt-2">{fmt(a.balance)}</div>
                <div className="text-[11px] text-ink-tertiary">账面余额（对账基准）</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
