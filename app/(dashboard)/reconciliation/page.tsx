'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2, Link2Off, AlertTriangle, Landmark, ArrowLeftRight, Sparkles, X, Upload, Zap } from 'lucide-react';

type BankTx = {
  id: number; txDate: string; amount: number; direction: string;
  counterparty: string; summary: string; bankRef: string; matchStatus: string;
  account: { bankName: string; accountNo: string };
  ledgerEntry: { voucherNo: string; amount: number; txDate: string; counterparty: string; direction: string } | null;
};
type LedgerOnly = {
  id: number; txDate: string; amount: number; direction: string;
  counterparty: string; summary: string; voucherNo: string;
  account: { bankName: string; accountNo: string };
};
type Data = {
  period: string;
  bank: BankTx[];
  ledgerOnly: LedgerOnly[];
  summary: { total: number; matched: number; unmatched: number; flagged: number };
};

const fmt = (n: number) =>
  '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_META: Record<string, { label: string; cls: string }> = {
  matched: { label: '已匹配', cls: 'bg-green-50 text-green-700 border-green-200' },
  unmatched: { label: '未匹配', cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  flagged: { label: '疑似差异', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
};

type ExplainResult = {
  explanation: { explanation: string; suggestion: string; severity: string; confidence: number };
  degraded: boolean;
  usage?: { prompt: number; completion: number; costYuan: number };
  candidates: { voucherNo: string; txDate: string; amount: number; direction: string; counterparty: string }[];
};

export default function ReconciliationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'all' | 'flagged' | 'unmatched' | 'matched'>('all');
  const [explain, setExplain] = useState<{ bank: BankTx; loading: boolean; result?: ExplainResult; error?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [running, setRunning] = useState(false);

  const runRecon = async () => {
    setRunning(true);
    setImportMsg(null);
    try {
      const res = await fetch('/api/reconciliation/run', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '对账失败');
      const s = j.summary;
      setImportMsg({
        ok: true,
        text:
          `✓ 引擎匹配 ${s.autoMatched + s.splitMatches} 组（精确 ${s.autoMatched} · 拆分 ${s.splitMatches}）；` +
          `差异 ${s.amountDiffs + s.bankOnly + s.ledgerOnly} 项已交 DeepSeek 解释，新增提案 ${s.proposalsCreated} 条待审` +
          (s.aiDegraded ? '（⚠ AI 降级为规则解释）' : ''),
      });
      load();
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : '网络错误' });
    } finally {
      setRunning(false);
    }
  };

  const load = () => {
    fetch('/api/reconciliation')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  };

  useEffect(load, []);

  const askAi = async (bank: BankTx) => {
    setExplain({ bank, loading: true });
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: bank.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '解释失败');
      setExplain({ bank, loading: false, result: j });
    } catch (e) {
      setExplain({ bank, loading: false, error: e instanceof Error ? e.message : '网络错误' });
    }
  };

  const onImport = async (f: File | null) => {
    if (!f) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/reconciliation/import', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '导入失败');
      setImportMsg({ ok: true, text: `✓ 导入成功：新增 ${j.imported} 笔流水${j.duplicated ? `，跳过重复 ${j.duplicated} 笔` : ''}${j.skipped ? `，忽略无效行 ${j.skipped} 行` : ''}` });
      load();
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : '网络错误' });
    } finally {
      setImporting(false);
    }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    return tab === 'all' ? data.bank : data.bank.filter((b) => b.matchStatus === tab);
  }, [data, tab]);

  const tabs = [
    { key: 'all' as const, label: `全部 ${data?.summary.total ?? ''}` },
    { key: 'flagged' as const, label: `疑似差异 ${data?.summary.flagged ?? ''}` },
    { key: 'unmatched' as const, label: `未匹配 ${data?.summary.unmatched ?? ''}` },
    { key: 'matched' as const, label: `已匹配 ${data?.summary.matched ?? ''}` },
  ];

  return (
    <div>
      {/* 概览条 */}
      <div className="card p-4 mb-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Landmark size={18} />
          </div>
          <div>
            <div className="text-[15px] font-medium text-ink-primary">银企对账 · {data?.period ?? '—'}</div>
            <div className="text-xs text-ink-tertiary mt-0.5">银行流水与账套记录逐笔核对，差异交 AI 解释、人工裁决</div>
          </div>
        </div>
        <div className="h-8 w-px bg-line" />
        {[
          { label: '流水总数', value: data?.summary.total },
          { label: '已匹配', value: data?.summary.matched },
          { label: '未匹配', value: data?.summary.unmatched },
          { label: '疑似差异', value: data?.summary.flagged },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-lg font-semibold text-ink-primary">{s.value ?? '—'}</div>
            <div className="text-[11px] text-ink-tertiary mt-0.5">{s.label}</div>
          </div>
        ))}
        <button
          onClick={runRecon}
          disabled={running}
          className={`ml-auto btn-primary flex items-center gap-1.5 ${running ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <Zap size={14} />
          {running ? '引擎匹配 + AI 解释中…' : '一键智能对账'}
        </button>
        <label className={`btn-primary flex items-center gap-1.5 cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
          <Upload size={14} />
          {importing ? '导入中…' : '导入银行流水（CSV / Excel）'}
          <input
            type="file"
            accept=".csv,.txt,.xls,.xlsx"
            className="hidden"
            disabled={importing}
            onChange={(e) => {
              onImport(e.target.files?.[0] ?? null);
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      {/* 导入结果反馈 */}
      {importMsg && (
        <div className={`rounded-xl border px-4 py-3 mb-4 text-[13px] ${importMsg.ok ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {importMsg.text}
        </div>
      )}

      {/* AI 差异解释面板 */}
      {explain && (
        <div className="card p-5 mb-4 border-brand-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-brand-600" />
              <div className="text-sm font-medium text-ink-primary">
                AI 差异解释 · {explain.bank.txDate} {explain.bank.counterparty} {fmt(explain.bank.amount)}
              </div>
            </div>
            <button onClick={() => setExplain(null)} className="text-ink-tertiary hover:text-ink-primary">
              <X size={16} />
            </button>
          </div>
          {explain.loading && (
            <div className="text-[13px] text-ink-secondary py-4 flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
              正在调用 DeepSeek 分析差异成因…
            </div>
          )}
          {!explain.loading && explain.error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-[13px] text-rose-700">{explain.error}</div>
          )}
          {!explain.loading && explain.result && (
            <div className="space-y-3">
              <div className="rounded-lg bg-brand-50/60 border border-brand-100 p-3.5">
                <div className="text-[13px] text-ink-primary leading-relaxed">{explain.result.explanation.explanation}</div>
                <div className="text-[13px] text-brand-700 mt-2">💡 建议：{explain.result.explanation.suggestion}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-ink-tertiary">
                <span className={`border rounded-md px-2 py-0.5 ${
                  explain.result.explanation.severity === 'high' ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : explain.result.explanation.severity === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-200'
                  : 'bg-green-50 text-green-700 border-green-200'
                }`}>严重度 {explain.result.explanation.severity === 'high' ? '高' : explain.result.explanation.severity === 'medium' ? '中' : '低'}</span>
                <span>AI 置信度 {Math.round(explain.result.explanation.confidence * 100)}%</span>
                {explain.result.usage && <span>DeepSeek 消耗 {explain.result.usage.prompt + explain.result.usage.completion} tokens（约 ¥{explain.result.usage.costYuan.toFixed(4)}）</span>}
                {explain.result.degraded && <span className="text-orange-500">⚠ AI 不可用，已降级为规则解释</span>}
              </div>
              {explain.result.candidates.length > 0 && (
                <div className="text-xs text-ink-tertiary">
                  账套侧疑似相关：{explain.result.candidates.map((c) => c.voucherNo + '（' + fmt(c.amount) + '）').join('、')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 筛选 Tab */}
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

      {/* 主表：银行流水 + 匹配到的账套记录 */}
      <div className="card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">状态</th>
                <th className="th">日期</th>
                <th className="th">银行流水（对方 / 摘要 / 金额）</th>
                <th className="th w-10"></th>
                <th className="th">账套记录（凭证号 / 对方 / 金额）</th>
                <th className="th">差异</th>
              </tr>
            </thead>
            <tbody>
              {!data && (
                <tr>
                  <td className="td text-ink-tertiary" colSpan={6}>加载中…</td>
                </tr>
              )}
              {rows.map((b) => {
                const m = STATUS_META[b.matchStatus];
                const diff =
                  b.ledgerEntry && Math.abs(b.ledgerEntry.amount - b.amount) > 0.001
                    ? b.amount - b.ledgerEntry.amount
                    : null;
                return (
                  <tr key={b.id} className={b.matchStatus !== 'matched' ? 'bg-rose-50/30' : ''}>
                    <td className="td">
                      <span className={`inline-flex items-center gap-1 text-xs border rounded-md px-2 py-0.5 ${m.cls}`}>
                        {b.matchStatus === 'matched' ? <Link2 size={12} /> : <AlertTriangle size={12} />}
                        {m.label}
                      </span>
                    </td>
                    <td className="td text-ink-secondary">{b.txDate}</td>
                    <td className="td">
                      <div className="text-ink-primary font-medium">{fmt(b.amount)} <span className={b.direction === '收' ? 'text-red-600' : 'text-green-700'}>{b.direction}</span></div>
                      <div className="text-xs text-ink-tertiary mt-0.5">{b.counterparty} · {b.summary}</div>
                    </td>
                    <td className="td text-center text-ink-tertiary">
                      <ArrowLeftRight size={14} className={b.matchStatus === 'matched' ? 'text-brand-400' : 'text-slate-300'} />
                    </td>
                    <td className="td">
                      {b.ledgerEntry ? (
                        <>
                          <div className="text-ink-primary font-medium">{fmt(b.ledgerEntry.amount)} <span className={b.ledgerEntry.direction === '贷' ? 'text-red-600' : 'text-green-700'}>{b.ledgerEntry.direction}</span></div>
                          <div className="text-xs text-ink-tertiary mt-0.5">{b.ledgerEntry.voucherNo} · {b.ledgerEntry.counterparty}</div>
                        </>
                      ) : b.matchStatus === 'flagged' ? (
                        <span className="text-xs text-rose-500">账套侧另有整笔/差额记录</span>
                      ) : (
                        <span className="text-xs text-ink-tertiary flex items-center gap-1"><Link2Off size={12} />账上无此记录（未达账项）</span>
                      )}
                    </td>
                    <td className="td">
                      {diff !== null ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-2 py-0.5">差 {diff > 0 ? '+' : ''}{diff.toFixed(2)} 元</span>
                          <button onClick={() => askAi(b)} className="text-xs text-brand-600 hover:underline shrink-0">AI 解释</button>
                        </div>
                      ) : b.matchStatus === 'matched' ? (
                        <span className="text-xs text-green-600">—</span>
                      ) : (
                        <button onClick={() => askAi(b)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                          <Sparkles size={12} />AI 解释差异
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 账套侧未匹配（银行无此流水） */}
      <div className="card p-5">
        <div className="text-sm font-medium text-ink-primary mb-1 flex items-center gap-2">
          <AlertTriangle size={15} className="text-orange-500" />
          账套有、银行无（企业已记账，银行流水缺失 / 在途）
        </div>
        <div className="text-xs text-ink-tertiary mb-3">月结前需编制银行存款余额调节表说明此类未达账项</div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">日期</th>
              <th className="th">凭证号</th>
              <th className="th">对方</th>
              <th className="th">摘要</th>
              <th className="th">金额</th>
            </tr>
          </thead>
          <tbody>
            {data?.ledgerOnly.map((l) => (
              <tr key={l.id} className="bg-orange-50/30">
                <td className="td text-ink-secondary">{l.txDate}</td>
                <td className="td">{l.voucherNo}</td>
                <td className="td">{l.counterparty}</td>
                <td className="td text-ink-secondary">{l.summary}</td>
                <td className="td font-medium">{fmt(l.amount)}</td>
              </tr>
            ))}
            {data && data.ledgerOnly.length === 0 && (
              <tr><td className="td text-ink-tertiary" colSpan={5}>无未达账项</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
