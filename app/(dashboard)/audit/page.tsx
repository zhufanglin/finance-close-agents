'use client';

import { useEffect, useState } from 'react';
import { Bot, User, Server, Check, X, ClipboardCheck, ScrollText, Loader2, BookOpenCheck } from 'lucide-react';

type Approval = { id: number; action: string; actor: string; comment: string | null; createdAt: string };
type VoucherBrief = { id: number; voucherNo: string; totalDebit: number; status: string };
type Proposal = {
  id: number; type: string; title: string; aiAgent: string; aiReason: string;
  confidence: number; payload: string; status: string; createdAt: string;
  decidedAt: string | null; decidedBy: string | null; approvals: Approval[];
  voucher: VoucherBrief | null;
};
type Log = {
  id: number; ts: string; actorType: string; actor: string; module: string;
  action: string; detail: string; tokenCost: number | null; model: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  reconciliation: '银企对账', invoice: '发票处理', expense: '费用报销', quality: '数据质量', masterdata: '主数据',
};

function PayloadView({ payload }: { payload: string }) {
  let obj: Record<string, unknown> = {};
  try { obj = JSON.parse(payload); } catch { return null; }
  return (
    <div className="rounded-lg bg-slate-50 border border-line p-3 mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-ink-tertiary shrink-0">{k}</span>
          <span className="text-ink-secondary break-all">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const [tab, setTab] = useState<'proposals' | 'logs'>('proposals');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'ai' | 'human' | 'system'>('all');
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    fetch('/api/proposals').then((r) => r.json()).then((d) => setProposals(d.proposals || []));
    fetch('/api/audit').then((r) => r.json()).then((d) => setLogs(d.logs || []));
  };
  useEffect(load, []);

  const decide = async (id: number, action: 'approve' | 'reject') => {
    setBusy(id);
    setMsg('');
    const r = await fetch(`/api/proposals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment: action === 'approve' ? '同意，按提案执行' : '驳回，证据不足' }),
    });
    const d = await r.json();
    setBusy(null);
    setMsg(
      r.ok
        ? action === 'approve'
          ? d.voucher
            ? `已通过：审批联动自动过账，生成凭证 ${d.voucher.voucherNo}（借方合计 ¥${Number(d.voucher.totalDebit || 0).toLocaleString('zh-CN')}）`
            : '已通过：提案生效并写入审计日志'
          : '已驳回：记录留痕'
        : `操作失败：${d.error}`
    );
    load();
  };

  const filteredLogs = logFilter === 'all' ? logs : logs.filter((l) => l.actorType === logFilter);
  const pending = proposals.filter((p) => p.status === 'pending');

  return (
    <div>
      {/* Tab 头 */}
      <div className="card p-4 mb-4 flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <ClipboardCheck size={18} />
          </div>
          <div>
            <div className="text-[15px] font-medium text-ink-primary">审批与审计中心</div>
            <div className="text-xs text-ink-tertiary mt-0.5">AI 只产提案，落库必须人工审批 · 全程留痕可追溯</div>
          </div>
        </div>
        <div className="flex gap-1 ml-auto border border-line rounded-lg p-1 bg-slate-50">
          <button
            onClick={() => setTab('proposals')}
            className={`px-3.5 py-1.5 text-[13px] rounded-md transition-colors ${tab === 'proposals' ? 'bg-white text-brand-600 font-medium shadow-card' : 'text-ink-secondary'}`}
          >
            AI 提案（{pending.length} 待审）
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`px-3.5 py-1.5 text-[13px] rounded-md transition-colors ${tab === 'logs' ? 'bg-white text-brand-600 font-medium shadow-card' : 'text-ink-secondary'}`}
          >
            审计日志
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-2.5 mb-4 text-[13px] text-brand-900">{msg}</div>
      )}

      {/* 提案审批 */}
      {tab === 'proposals' && (
        <div className="space-y-3">
          {proposals.map((p) => (
            <div key={p.id} className={`card p-5 ${p.status === 'pending' ? '' : 'opacity-75'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-brand-50 text-brand-600 border border-brand-100 rounded-md px-2 py-0.5">
                      {TYPE_LABEL[p.type] || p.type}
                    </span>
                    <span className="text-[15px] font-medium text-ink-primary">{p.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-tertiary">
                    <span className="flex items-center gap-1"><Bot size={12} />{p.aiAgent}</span>
                    <span>AI 置信度 {Math.round(p.confidence * 100)}%</span>
                    <span>{new Date(p.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  {p.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide(p.id, 'approve')}
                        disabled={busy === p.id}
                        className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                      >
                        {busy === p.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        通过
                      </button>
                      <button
                        onClick={() => decide(p.id, 'reject')}
                        disabled={busy === p.id}
                        className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <X size={13} />驳回
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs border rounded-md px-2.5 py-1 ${
                      p.status === 'approved'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-slate-100 text-ink-secondary border-slate-200'
                    }`}>
                      {p.status === 'approved' ? `已通过 · ${p.decidedBy}` : `已驳回 · ${p.decidedBy}`}
                    </span>
                  )}
                  {p.voucher && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-md px-2 py-1">
                      <BookOpenCheck size={12} />
                      已生成凭证 {p.voucher.voucherNo} · 借方合计 ¥{p.voucher.totalDebit.toLocaleString('zh-CN')}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-lg bg-brand-50/60 border border-brand-100 p-3 text-[13px] text-ink-primary leading-relaxed">
                <span className="text-ink-tertiary text-xs">AI 判断理由：</span>{p.aiReason}
              </div>

              <PayloadView payload={p.payload} />

              {p.approvals.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-tertiary">
                  <User size={12} />
                  {p.approvals.map((a) => (
                    <span key={a.id}>
                      {a.actor} 于 {new Date(a.createdAt).toLocaleString('zh-CN')} {a.action === 'approve' ? '通过' : '驳回'}
                      {a.comment ? `（${a.comment}）` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 审计日志 */}
      {tab === 'logs' && (
        <div className="card overflow-hidden">
          <div className="flex gap-1 px-4 py-3 border-b border-line bg-slate-50/60">
            {([
              ['all', `全部 ${logs.length}`],
              ['ai', `AI 决策 ${logs.filter((l) => l.actorType === 'ai').length}`],
              ['human', `人工操作 ${logs.filter((l) => l.actorType === 'human').length}`],
              ['system', `系统 ${logs.filter((l) => l.actorType === 'system').length}`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setLogFilter(k)}
                className={`text-xs rounded-md px-2.5 py-1 transition-colors ${
                  logFilter === k ? 'bg-white text-brand-600 border border-line shadow-card font-medium' : 'text-ink-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">时间</th>
                  <th className="th">主体</th>
                  <th className="th">模块</th>
                  <th className="th">动作</th>
                  <th className="th">明细</th>
                  <th className="th">模型 / 成本</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td className="td text-ink-secondary font-mono text-xs">
                      {new Date(l.ts).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        {l.actorType === 'ai' ? <Bot size={13} className="text-brand-600" />
                          : l.actorType === 'human' ? <User size={13} className="text-blue-700" />
                          : <Server size={13} className="text-ink-tertiary" />}
                        {l.actor}
                      </span>
                    </td>
                    <td className="td text-ink-secondary">{TYPE_LABEL[l.module] || l.module}</td>
                    <td className="td font-mono text-xs">{l.action}</td>
                    <td className="td max-w-[340px] truncate text-xs text-ink-secondary" title={l.detail}>{l.detail}</td>
                    <td className="td text-xs text-ink-tertiary">
                      {l.model ? `${l.model} · ¥${(l.tokenCost || 0).toFixed(4)}` : '—'}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr><td className="td text-ink-tertiary" colSpan={6}>暂无日志</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-line flex items-center justify-between text-xs text-ink-tertiary">
            <span className="flex items-center gap-1.5"><ScrollText size={12} />追加式存储 · 每条含模型版本与 token 成本</span>
            <button className="btn-ghost text-xs px-3 py-1.5">导出 CSV</button>
          </div>
        </div>
      )}
    </div>
  );
}
