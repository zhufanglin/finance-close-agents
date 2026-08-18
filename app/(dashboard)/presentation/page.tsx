"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronLeft, ChevronRight,
  Bot, Sparkles, ShieldCheck, Landmark, FileText, ReceiptText,
  Database, ArrowRight, Check, Zap, AlertTriangle, Cpu,
  Terminal, BookOpenCheck,
} from "lucide-react";

const TOTAL = 10;

export default function PresentationPage() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, TOTAL - 1)), []);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") { router.push("/"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, router]);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none"
      style={{ background: "linear-gradient(135deg, #0a2e2a 0%, #133834 40%, #1f4f49 100%)" }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("a")) return;
        const x = e.clientX;
        if (x < window.innerWidth * 0.35) prev();
        else next();
      }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={() => router.push("/")}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
        title="退出演示 (Esc)"
      >
        <X size={20} />
      </button>

      {/* 翻页箭头 */}
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/8 hover:bg-white/16 flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {idx < TOTAL - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/8 hover:bg-white/16 flex items-center justify-center text-white/50 hover:text-white transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* 转场动画：上移淡入（fade-in-up） */}
      <style>{`
        @keyframes slideUpIn {
          from { opacity: 0; transform: translateY(48px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .slide-enter { animation: slideUpIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .slide-enter { animation: none; }
        }
      `}</style>

      {/* Slide 区域 */}
      <div key={idx} className="slide-enter w-full h-full flex items-center justify-center px-16 py-12">
        {idx === 0 && <SlideCover />}
        {idx === 1 && <SlidePhilosophy />}
        {idx === 2 && <SlideAgents />}
        {idx === 3 && <SlideReconEngine />}
        {idx === 4 && <SlideAiLoop />}
        {idx === 5 && <SlideIntegrations />}
        {idx === 6 && <SlideSecurity />}
        {idx === 7 && <SlideArchitecture />}
        {idx === 8 && <SlideDataModel />}
        {idx === 9 && <SlideOutro onEnter={() => router.push("/")} />}
      </div>

      {/* 底部进度条 + 页码 */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-8 py-4">
        <span className="text-xs text-white/40 tabular-nums w-12">{idx + 1} / {TOTAL}</span>
        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((idx + 1) / TOTAL) * 100}%`, background: "#5dcaa5" }}
          />
        </div>
        <span className="text-xs text-white/30 hidden sm:block">← → 翻页 · Esc 退出</span>
      </div>
    </div>
  );
}

/* ──────────── Slide 1: 封面 ──────────── */
function SlideCover() {
  return (
    <div className="text-center max-w-3xl">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-200/15 border border-brand-200/30 text-brand-200 text-sm mb-8">
        <Sparkles size={14} /> 财务月结 AI 演示系统
      </div>
      <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
        让 AI 做脏活累活
        <br />
        让人做关键决策
      </h1>
      <p className="text-lg text-white/50 mb-10">
        规则做计算 · AI 做理解 · 人做决策
      </p>
      <div className="flex justify-center gap-8 text-white/40 text-sm">
        <Stat icon={<Landmark size={16} />} label="8 大模块" />
        <Stat icon={<Bot size={16} />} label="5 个 AI Agent" />
        <Stat icon={<FileText size={16} />} label="DeepSeek 真实接入" />
        <Stat icon={<ShieldCheck size={16} />} label="审计全留痕" />
      </div>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-brand-200">{icon}</span>
      {label}
    </div>
  );
}

/* ──────────── Slide 2: 核心理念 ──────────── */
function SlidePhilosophy() {
  const pillars = [
    { icon: <Cpu size={28} />, title: "规则做计算", desc: "对账引擎按金额+日期+客商三重匹配，100% 确定性输出，不依赖 AI 猜测", color: "#5dcaa5" },
    { icon: <Sparkles size={28} />, title: "AI 做理解", desc: "DeepSeek 解释差异原因、建议会计科目、识别发票字段——AI 负责「理解」，不负责「拍板」", color: "#60a5fa" },
    { icon: <ShieldCheck size={28} />, title: "人做决策", desc: "所有 AI 提案必须经人工审批才能过账，「人没点头，账不改」", color: "#fbbf24" },
  ];
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="设计理念" title="三方协作，各司其职" />
      <div className="grid grid-cols-3 gap-6 mt-10">
        {pillars.map((p, i) => (
          <div
            key={i}
            className="rounded-2xl p-6 border"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
              style={{ background: `${p.color}20`, color: p.color }}
            >
              {p.icon}
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{p.title}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
          <span style={{ color: "#5dcaa5" }}>规则引擎</span>
          <ArrowRight size={16} className="text-white/30" />
          <span style={{ color: "#60a5fa" }}>AI 理解</span>
          <ArrowRight size={16} className="text-white/30" />
          <span style={{ color: "#fbbf24" }}>人工审批</span>
          <ArrowRight size={16} className="text-white/30" />
          <span className="text-white">自动过账</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Slide 3: 5 Agent 集群 ──────────── */
function SlideAgents() {
  const agents = [
    { name: "对账 Agent", icon: <Landmark size={24} />, role: "银企对账匹配", color: "#5dcaa5", status: "自动匹配 30 笔流水" },
    { name: "发票 Agent", icon: <FileText size={24} />, role: "OCR + 数电票解析", color: "#60a5fa", status: "识别 15 张发票" },
    { name: "费用 Agent", icon: <ReceiptText size={24} />, role: "报销审核 + 科目建议", color: "#fbbf24", status: "待审 3 单" },
    { name: "凭证 Agent", icon: <BookOpenCheck size={24} />, role: "审批通过自动过账", color: "#a78bfa", status: "已生成 5 张凭证" },
    { name: "报告 Agent", icon: <Database size={24} />, role: "月结报告与质量检查", color: "#f472b6", status: "健康分 92" },
  ];
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="智能体集群" title="5 个 AI Agent 协同工作" />
      <div className="grid grid-cols-5 gap-4 mt-10">
        {agents.map((a, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 border text-center"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: `${a.color}30` }}
          >
            <div
              className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-3"
              style={{ background: `${a.color}18`, color: a.color }}
            >
              {a.icon}
            </div>
            <div className="text-sm font-medium text-white mb-1">{a.name}</div>
            <div className="text-xs text-white/40 mb-2">{a.role}</div>
            <div
              className="text-xs px-2 py-1 rounded-md inline-block"
              style={{ background: `${a.color}15`, color: a.color }}
            >
              {a.status}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-white/40 text-sm mt-8">
        每个 Agent 有明确职责边界，AI 只生成提案，不做最终决策
      </p>
    </div>
  );
}

/* ──────────── Slide 4: 对账引擎 ──────────── */
function SlideReconEngine() {
  const diffs = [
    { label: "自动匹配", count: "26 笔", desc: "金额+日期+客商三重一致", color: "#5dcaa5" },
    { label: "拆分到账", count: "1 笔", desc: "银行 1 笔拆成 2 笔入账", color: "#60a5fa" },
    { label: "金额尾差", count: "1 笔", desc: "差 1 分钱（四舍五入）", color: "#fbbf24" },
    { label: "银行有账上无", count: "1 笔", desc: "银行扣费账上未记账", color: "#f472b6" },
    { label: "账上有银行无", count: "1 笔", desc: "在途资金（未达账项）", color: "#a78bfa" },
  ];
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="对账引擎" title="三重匹配 + 五类差异识别" />
      <div className="mt-8 flex items-center gap-4 justify-center mb-8">
        <Pill label="金额匹配" color="#5dcaa5" />
        <Plus />
        <Pill label="日期窗口 ±3 天" color="#60a5fa" />
        <Plus />
        <Pill label="客商核对" color="#fbbf24" />
        <ArrowRight size={20} className="text-white/40" />
        <span className="text-white/60 text-sm">五分类输出</span>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {diffs.map((d, i) => (
          <div key={i} className="rounded-xl p-4 border text-center" style={{ background: `${d.color}10`, borderColor: `${d.color}25` }}>
            <div className="text-2xl font-bold" style={{ color: d.color }}>{d.count}</div>
            <div className="text-xs text-white/70 mt-1">{d.label}</div>
            <div className="text-[10px] text-white/35 mt-1 leading-snug">{d.desc}</div>
          </div>
        ))}
      </div>
      <p className="text-center text-white/40 text-sm mt-6">
        引擎参数可调（金额容差 / 日期窗口 / 尾差阈值），见「技术演示 → 对账引擎调试台」
      </p>
    </div>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return <span className="px-3 py-1 rounded-lg text-sm" style={{ background: `${color}18`, color }}>{label}</span>;
}
function Plus() {
  return <span className="text-white/30 text-sm">+</span>;
}

/* ──────────── Slide 5: AI 闭环 ──────────── */
function SlideAiLoop() {
  const steps = [
    { title: "引擎匹配", desc: "对账引擎跑出差异项", icon: <Cpu size={20} />, color: "#5dcaa5" },
    { title: "AI 解释", desc: "DeepSeek 分析原因 + 给建议", icon: <Sparkles size={20} />, color: "#60a5fa" },
    { title: "生成提案", desc: "自动写标准分录 + 落库待审", icon: <Bot size={20} />, color: "#fbbf24" },
    { title: "人工审批", desc: "财务审核 → 通过 / 驳回", icon: <ShieldCheck size={20} />, color: "#a78bfa" },
    { title: "自动过账", desc: "事务内生成凭证+分录", icon: <BookOpenCheck size={20} />, color: "#f472b6" },
  ];
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="AI 闭环" title="从发现差异到自动过账的完整链路" />
      <div className="flex items-center justify-between mt-12">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className="text-center" style={{ width: 140 }}>
              <div
                className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-3"
                style={{ background: `${s.color}18`, color: s.color }}
              >
                {s.icon}
              </div>
              <div className="text-sm font-medium text-white">{s.title}</div>
              <div className="text-xs text-white/40 mt-1 leading-snug">{s.desc}</div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight size={20} className="text-white/20 mx-2" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-xl p-5 border border-white/10 bg-white/[.03]">
        <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
          <Zap size={14} className="text-brand-200" /> 实测验证
        </div>
        <p className="text-white/70 text-sm leading-relaxed">
          一键对账 → 命中 4 类差异 → DeepSeek 真实调用解释（aiDegraded: false）
          → 生成带分录的提案 → 审批通过 → 自动生成凭证 <span className="text-brand-200">记-0755</span>
          （借：管理费用-手续费 200 / 贷：银行存款 200）
        </p>
      </div>
    </div>
  );
}

/* ──────────── Slide 6: 真实集成 ──────────── */
function SlideIntegrations() {
  const integrations = [
    { name: "DeepSeek API", icon: <Sparkles size={24} />, desc: "云端大模型，差异解释 / 科目建议 / 发票抽取", status: "已接入 · 真实调用", color: "#5dcaa5" },
    { name: "RapidOCR", icon: <FileText size={24} />, desc: "本地 onnxruntime 离线识别发票图片", status: "已接入 · 本地引擎", color: "#60a5fa" },
    { name: "数电票 XML", icon: <ReceiptText size={24} />, desc: "全电发票 XML/OFD 直解析，免 OCR", status: "已接入 · 零 OCR", color: "#fbbf24" },
    { name: "银行流水 CSV", icon: <Landmark size={24} />, desc: "万能列映射，支持 CSV / Excel 导入", status: "已接入 · 自动映射", color: "#a78bfa" },
  ];
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="真实集成" title="不是 Mock，全部真实跑通" />
      <div className="grid grid-cols-2 gap-5 mt-10">
        {integrations.map((it, i) => (
          <div key={i} className="rounded-2xl p-6 border flex items-start gap-4" style={{ background: "rgba(255,255,255,0.04)", borderColor: `${it.color}25` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${it.color}18`, color: it.color }}>
              {it.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-medium">{it.name}</span>
                <Check size={14} style={{ color: it.color }} />
              </div>
              <p className="text-sm text-white/45 mb-2">{it.desc}</p>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${it.color}15`, color: it.color }}>{it.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────── Slide 7: 安全与降级 ──────────── */
function SlideSecurity() {
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="安全与降级" title="规则优先于 AI，AI 失败有兜底" />
      <div className="grid grid-cols-2 gap-6 mt-10">
        {/* 左：规则拦截 */}
        <div className="rounded-2xl p-6 border border-red-400/20 bg-red-500/[.06]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-red-400" />
            <span className="text-white font-medium">规则拦截</span>
          </div>
          <p className="text-sm text-white/50 mb-4">大额报销 &gt; ¥5,000 点「通过」被规则引擎 400 拦截</p>
          <div className="rounded-lg p-3 bg-black/30 font-mono text-xs text-red-300/80">
            POST /api/expenses/5<br />
            <span className="text-white/30">→</span> 400 {"{error: '超额需总监加签'}"}
          </div>
          <div className="mt-4 text-xs text-white/40">
            规则在前、AI 在后——AI 建议 ≠ 可以执行
          </div>
        </div>
        {/* 右：降级兜底 */}
        <div className="rounded-2xl p-6 border border-amber-400/20 bg-amber-500/[.06]">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-amber-400" />
            <span className="text-white font-medium">超时降级</span>
          </div>
          <p className="text-sm text-white/50 mb-4">DeepSeek 超时 → 自动降级到规则引擎</p>
          <div className="space-y-2 text-sm">
            <Step n="1" text="AbortController 1ms 超时" color="#fbbf24" />
            <Step n="2" text="catch → degraded: true" color="#fbbf24" />
            <Step n="3" text="规则兜底出科目建议" color="#fbbf24" />
            <Step n="4" text="AiCallLog 记录降级状态" color="#fbbf24" />
            <Step n="5" text="流程不中断，用户无感" color="#5dcaa5" />
          </div>
        </div>
      </div>
      <div className="mt-6 text-center text-sm text-white/40">
        鉴权：httpOnly cookie + 中间件路由保护 · 审计：AI/人工/系统全量留痕 · token 成本可追溯
      </div>
    </div>
  );
}

function Step({ n, text, color }: { n: string; text: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: `${color}25`, color }}>{n}</span>
      <span className="text-white/60">{text}</span>
    </div>
  );
}

/* ──────────── Slide 8: 技术架构 ──────────── */
function SlideArchitecture() {
  const layers = [
    { name: "前端展示层", tech: "Next.js 14 + TypeScript + Tailwind CSS", items: "8 模块页面 + 全屏演示", color: "#5dcaa5" },
    { name: "API 路由层", tech: "Next.js Route Handlers (20+ 端点)", items: "鉴权 + 业务 + AI + 集成", color: "#60a5fa" },
    { name: "业务逻辑层", tech: "对账引擎 / LLM 封装 / OCR / 导入", items: "规则计算 + AI 理解 + 降级", color: "#fbbf24" },
    { name: "数据访问层", tech: "Prisma 6 ORM (14 张表)", items: "事务一致性 + 审计日志", color: "#a78bfa" },
    { name: "存储与外部", tech: "SQLite + DeepSeek API + RapidOCR", items: "本地数据库 + 云端 AI", color: "#f472b6" },
  ];
  return (
    <div className="w-full max-w-3xl">
      <SlideTitle tag="技术架构" title="五层架构，单体简洁" />
      <div className="mt-10 space-y-3">
        {layers.map((l, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl p-4 border" style={{ background: `${l.color}08`, borderColor: `${l.color}20` }}>
            <div className="w-1 h-12 rounded-full" style={{ background: l.color }} />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-white font-medium text-sm">{l.name}</span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${l.color}15`, color: l.color }}>{l.tech}</span>
              </div>
              <div className="text-xs text-white/40 mt-1">{l.items}</div>
            </div>
            {i < layers.length - 1 && <ChevronRight size={16} className="text-white/15 rotate-90" />}
          </div>
        ))}
      </div>
      <div className="mt-6 text-center text-sm text-white/40">
        单体应用 · 无微服务/消息队列——演示系统的定位，够用就好
      </div>
    </div>
  );
}

/* ──────────── Slide 9: 数据模型 ──────────── */
function SlideDataModel() {
  const tables = [
    "User", "Subject", "Partner", "BankAccount",
    "BankTransaction", "LedgerEntry", "Invoice", "Voucher",
    "VoucherItem", "Proposal", "ApprovalRecord", "AuditLog",
    "ExpenseClaim", "AiCallLog",
  ];
  return (
    <div className="w-full max-w-4xl">
      <SlideTitle tag="数据模型" title="14 张表覆盖全业务流" />
      <div className="flex flex-wrap justify-center gap-2.5 mt-10 max-w-4xl">
        {tables.map((t, i) => (
          <div
            key={i}
            className="rounded-lg px-4 py-2 border text-center text-xs font-mono whitespace-nowrap"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(255,255,255,0.08)",
              color: i < 6 ? "#5dcaa5" : i < 10 ? "#60a5fa" : i < 12 ? "#fbbf24" : "#a78bfa",
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-4 gap-4 text-xs">
        <Legend color="#5dcaa5" label="基础主数据" />
        <Legend color="#60a5fa" label="交易流水" />
        <Legend color="#fbbf24" label="审批与凭证" />
        <Legend color="#a78bfa" label="AI 与审计" />
      </div>
      <p className="text-center text-white/40 text-sm mt-6">
        Prisma ORM · SQLite · 事务保证凭证+分录+审计日志原子写入
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-white/50">
      <span className="w-3 h-3 rounded" style={{ background: color }} />
      {label}
    </div>
  );
}

/* ──────────── Slide 10: 演示动线 ──────────── */
function SlideOutro({ onEnter }: { onEnter: () => void }) {
  const steps = [
    "银企对账 → 点「一键对账」看引擎匹配",
    "点差异行「AI 解释」看 DeepSeek 真实分析",
    "发票中心 → 上传发票图看 OCR + AI 抽取",
    "费用报销 → 提交一张看 AI 科目建议",
    "审计中心 → 批准提案看自动生成凭证",
    "技术演示 → 看 AI 调用监控台与降级演示",
  ];
  return (
    <div className="w-full max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-200/15 border border-brand-200/30 text-brand-200 text-sm mb-8">
        <Terminal size={14} /> 演示动线
      </div>
      <h2 className="text-4xl font-bold text-white mb-2">10 分钟看完整套系统</h2>
      <p className="text-white/40 mb-10">每一步都是真实功能，不是截图</p>
      <div className="grid grid-cols-2 gap-3 text-left mb-10">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg p-3 bg-white/[.04]">
            <span className="w-6 h-6 rounded-full bg-brand-200/20 text-brand-200 text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
            <span className="text-sm text-white/60">{s}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onEnter}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-medium text-base transition-all hover:scale-105"
        style={{ background: "linear-gradient(135deg, #1d9e75, #5dcaa5)" }}
      >
        进入系统 <ArrowRight size={18} />
      </button>
      <p className="text-white/30 text-xs mt-4">admin / admin123</p>
    </div>
  );
}

/* ──────────── 公共组件 ──────────── */
function SlideTitle({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs mb-3">
        {tag}
      </div>
      <h2 className="text-3xl font-bold text-white">{title}</h2>
    </div>
  );
}
