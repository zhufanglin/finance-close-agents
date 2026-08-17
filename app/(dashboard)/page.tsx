'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Landmark, FileText, ClipboardCheck, AlertTriangle, BookOpenCheck, ScrollText,
  Upload, BadgeCheck, ArrowRight, Bot, User, Server, Sparkles, Zap, RefreshCw,
} from 'lucide-react';

// 月结时间轴 12 节点（对齐公司月结时间轴图）
const TIMELINE = [
  { day: 'D-5', label: '催票催款', date: '07-26', status: 'done' },
  { day: 'D-4', label: '数据预检', date: '07-27', status: 'done' },
  { day: 'D-3', label: '存货盘点', date: '07-28', status: 'done' },
  { day: 'D-2', label: '费用预提', date: '07-29', status: 'done' },
  { day: 'D-1', label: '截单提醒', date: '07-30', status: 'done' },
  { day: 'D-Day', label: '截止冻结', date: '07-31', status: 'done' },
  { day: 'D+1', label: '银企对账', date: '08-01', status: 'done' },
  { day: 'D+2', label: '存货成本', date: '08-02', status: 'done' },
  { day: 'D+3', label: '税费计提', date: '08-03', status: 'done' },
  { day: 'D+4', label: '总账对账', date: '08-04', status: 'done' },
  { day: 'D+5', label: '单体报表', date: '08-05', status: 'current' },
  { day: 'D+6~8', label: '集团合并', date: '08-06~08', status: 'pending' },
] as const;

type Stats = {
  period: string;
  bank: { total: number; ledger: number; unmatched: number; flagged: number };
  invoice: { total: number; pending: number; lowConfidence: number };
  proposal: { pending: number; approved: number };
  voucher: { total: number };
  audit: { logs: number };
  master: { partners: number; subjects: number; accounts: number };
};

type AgentInfo = {
  key: string;
  name: string;
  desc: string;
  status: 'working' | 'done' | 'idle';
  stat: string;
  detail: string;
  lastActive: string | null;
  href: string;
};

type RunResult = {
  autoMatched: number;
  splitMatches: number;
  amountDiffs: number;
  bankOnly: number;
  ledgerOnly: number;
  proposalsCreated: number;
  aiDegraded: boolean;
};

const AGENT_STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  working: { label: '工作中', dot: 'dot-warn', cls: 'bg-orange-50 text-orange-600 border-orange-200' },
  done: { label: '已完成', dot: 'dot-ok', cls: 'bg-green-50 text-green-700 border-green-200' },
  idle: { label: '待命', dot: 'bg-slate-300', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<AgentInfo[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const loadAll = () => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .finally(() => setLoaded(true));
    fetch('/api/agents')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAgents(d?.agents ?? null));
  };

  useEffect(loadAll, []);

  const runRecon = async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const res = await fetch('/api/reconciliation/run', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '对账失败');
      const s: RunResult = j.summary;
      setRunMsg(
        `✓ 引擎匹配 ${s.autoMatched + s.splitMatches} 组（精确 ${s.autoMatched} · 拆分 ${s.splitMatches}），` +
        `差异 ${s.amountDiffs + s.bankOnly + s.ledgerOnly} 项已交 AI 解释，新增提案 ${s.proposalsCreated} 条待审` +
        (s.aiDegraded ? '（⚠ AI 降级为规则解释）' : '')
      );
      loadAll();
    } catch (e) {
      setRunMsg('✗ ' + (e instanceof Error ? e.message : '网络错误'));
    } finally {
      setRunning(false);
    }
  };

  const cards = stats
    ? [
        { label: '银行流水（2026-07）', value: `${stats.bank.total} 笔`, sub: `账套 ${stats.bank.ledger} 笔`, icon: Landmark, cls: 'bg-brand-50 text-brand-600' },
        { label: '对账差异待处理', value: `${stats.bank.unmatched + stats.bank.flagged} 笔`, sub: `未匹配 ${stats.bank.unmatched} · 疑似差异 ${stats.bank.flagged}`, icon: AlertTriangle, cls: 'bg-orange-50 text-orange-600' },
        { label: '进项发票', value: `${stats.invoice.total} 张`, sub: `低置信度 ${stats.invoice.lowConfidence} 张`, icon: FileText, cls: 'bg-violet-50 text-violet-600' },
        { label: '待审 AI 提案', value: `${stats.proposal.pending} 条`, sub: `已批 ${stats.proposal.approved} 条`, icon: ClipboardCheck, cls: 'bg-rose-50 text-rose-600' },
        { label: '凭证（本期）', value: `${stats.voucher.total} 张`, sub: '含待审凭证', icon: BookOpenCheck, cls: 'bg-blue-50 text-blue-700' },
        { label: '审计日志', value: `${stats.audit.logs} 条`, sub: '全程留痕可追溯', icon: ScrollText, cls: 'bg-pink-50 text-pink-600' },
      ]
    : [];

  return (
    <div>
      {/* 横幅 */}
      <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-brand-900">
            2026 年 7 月月结进行中 · 当前节点 D+5 单体报表
          </div>
          <div className="text-[13px] text-brand-600/80 mt-0.5">
            规则做计算 · AI 做理解 · 人做决策 —— 人没点头，账不改
          </div>
        </div>
        <span className="chip shrink-0 ml-4">数据来源：SQLite 演示库</span>
      </div>

      {/* 统计卡 3x2 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {!loaded
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-4 h-[88px] animate-pulse bg-slate-50" />
            ))
          : cards.map((c) => (
              <div key={c.label} className="card p-4 flex items-center justify-between">
                <div>
                  <div className="text-[22px] font-semibold text-ink-primary leading-tight">{c.value}</div>
                  <div className="text-xs text-ink-secondary mt-1">{c.label}</div>
                  <div className="text-[11px] text-ink-tertiary mt-0.5">{c.sub}</div>
                </div>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.cls}`}>
                  <c.icon size={18} />
                </div>
              </div>
            ))}
      </div>

      {/* Agent 集群状态 */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-brand-600" />
            <div className="text-[15px] font-medium text-ink-primary">Agent 集群 · 实时状态</div>
            <span className="text-[11px] text-ink-tertiary ml-1">状态由数据库实时计算</span>
          </div>
          <button
            onClick={runRecon}
            disabled={running}
            className={`btn-primary flex items-center gap-1.5 text-[13px] ${running ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {running ? '引擎匹配 + AI 解释中…' : '发起智能对账'}
          </button>
        </div>
        {runMsg && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2.5 mb-4 text-[13px] text-brand-800">
            {runMsg}
          </div>
        )}
        <div className="grid grid-cols-5 gap-3">
          {(agents ?? Array.from({ length: 5 })).map((a, i) => {
            if (!a) return <div key={i} className="rounded-lg border border-line p-3.5 h-[110px] animate-pulse bg-slate-50" />;
            const info = a as AgentInfo;
            const st = AGENT_STATUS[info.status];
            return (
              <Link
                key={info.key}
                href={info.href}
                className="rounded-lg border border-line p-3.5 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-ink-primary truncate">{info.name}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 shrink-0 ml-1 ${st.cls}`}>
                    <span className={st.dot} />{st.label}
                  </span>
                </div>
                <div className="text-[11px] text-ink-tertiary leading-relaxed h-[30px]">{info.desc}</div>
                <div className="text-[11px] text-brand-700 mt-1.5 truncate">{info.stat}</div>
                <div className="text-[10px] text-ink-tertiary mt-0.5 truncate">
                  {info.lastActive ? `最近活动 ${info.lastActive}` : '暂无活动记录'}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 时间轴 */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-medium text-ink-primary">月结时间轴</div>
          <div className="flex items-center gap-3 text-xs text-ink-tertiary">
            <span className="flex items-center gap-1.5"><span className="dot-ok" />已完成</span>
            <span className="flex items-center gap-1.5"><span className="dot-warn" />进行中</span>
            <span className="flex items-center gap-1.5"><span className="dot bg-slate-300" />待开始</span>
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex items-start min-w-[880px]">
            {TIMELINE.map((n, i) => (
              <div key={n.day} className="flex-1 relative">
                {/* 连线 */}
                {i < TIMELINE.length - 1 && (
                  <div
                    className={`absolute top-[7px] left-[22px] right-0 h-[2px] ${
                      n.status === 'done' ? 'bg-brand-200' : 'bg-slate-200'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 w-4 h-4 rounded-full border-[3px] ${
                    n.status === 'done'
                      ? 'bg-brand-400 border-brand-100'
                      : n.status === 'current'
                        ? 'bg-white border-brand-400 ring-4 ring-brand-50'
                        : 'bg-white border-slate-300'
                  }`}
                />
                <div className="mt-2 pr-2">
                  <div className={`text-xs font-medium ${n.status === 'current' ? 'text-brand-600' : 'text-ink-primary'}`}>
                    {n.day}
                  </div>
                  <div className="text-[11px] text-ink-secondary mt-0.5">{n.label}</div>
                  <div className="text-[10px] text-ink-tertiary mt-0.5">{n.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 快捷操作 + 系统状态 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-5">
          <div className="text-[15px] font-medium text-ink-primary mb-3">快捷操作</div>
          <div className="space-y-2">
            <Link href="/reconciliation" className="flex items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2.5 text-sm text-ink-primary">
                <Upload size={16} className="text-brand-600" /> 上传银行流水 / 发起对账
              </span>
              <ArrowRight size={15} className="text-ink-tertiary" />
            </Link>
            <Link href="/invoices" className="flex items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2.5 text-sm text-ink-primary">
                <FileText size={16} className="text-brand-600" /> 发票上传与查验（OCR + 数电票）
              </span>
              <ArrowRight size={15} className="text-ink-tertiary" />
            </Link>
            <Link href="/audit" className="flex items-center justify-between rounded-lg border border-line px-4 py-3 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2.5 text-sm text-ink-primary">
                <BadgeCheck size={16} className="text-brand-600" /> 审批 AI 提案（{stats?.proposal.pending ?? '—'} 条待审）
              </span>
              <ArrowRight size={15} className="text-ink-tertiary" />
            </Link>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-[15px] font-medium text-ink-primary mb-3">系统状态</div>
          <div className="space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-primary"><Bot size={14} className="text-ink-tertiary" /> DeepSeek API</span>
              <span className="flex items-center gap-1.5 text-ink-secondary"><span className="dot-ok" />已连接 · 08-01 09:12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-primary"><Server size={14} className="text-ink-tertiary" /> OCR 识别服务</span>
              <span className="flex items-center gap-1.5 text-ink-secondary"><span className="dot-ok" />本地 RapidOCR · 已接入</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-primary"><Server size={14} className="text-ink-tertiary" /> 数据库 SQLite</span>
              <span className="flex items-center gap-1.5 text-ink-secondary"><span className="dot-ok" />正常 · 2026-07 期间</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-ink-primary"><User size={14} className="text-ink-tertiary" /> 巡检调度</span>
              <span className="flex items-center gap-1.5 text-ink-secondary"><span className="dot-info" />每日 02:00 自动巡检</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
