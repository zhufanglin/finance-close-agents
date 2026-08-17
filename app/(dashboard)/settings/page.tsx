'use client';

import { useEffect, useState } from 'react';
import { Settings, Check, X, User, Cpu } from 'lucide-react';

type UserRow = { username: string; name: string; role: string; createdAt: string };
type Integration = { key: string; name: string; enabled: boolean; detail: string };
type Data = {
  users: UserRow[]; integrations: Integration[]; current: string;
  env: { node: string; platform: string; db: string; period: string };
};

const ROLE_LABEL: Record<string, string> = { admin: '管理员', finance: '财务', auditor: '审计' };

export default function SettingsPage() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch('/api/settings').then((r) => (r.ok ? r.json() : null)).then(setData);
  }, []);

  return (
    <div>
      <div className="card p-5 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-ink-primary flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center"><Settings size={15} /></span>
            系统设置
          </div>
          <div className="text-[13px] text-ink-secondary mt-1">账号 · 集成通道 · 运行环境（演示系统，配置只读展示）</div>
        </div>
        <span className="chip">v0.6 demo</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 集成通道 */}
        <div className="card p-5">
          <div className="text-sm font-medium text-ink-primary mb-3 flex items-center gap-1.5"><Cpu size={14} />AI 与集成通道</div>
          <div className="space-y-2.5">
            {(data?.integrations ?? []).map((i) => (
              <div key={i.key} className="border border-slate-100 rounded-xl px-4 py-3 flex gap-3 items-start">
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${i.enabled ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-500'}`}>
                  {i.enabled ? <Check size={12} /> : <X size={12} />}
                </span>
                <div>
                  <div className="text-[13px] text-ink-primary">{i.name}</div>
                  <div className="text-xs text-ink-tertiary mt-0.5 leading-relaxed">{i.detail}</div>
                </div>
                <span className={`ml-auto text-[11px] border rounded px-1.5 py-px shrink-0 ${i.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                  {i.enabled ? '已就绪' : '未启用'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* 账号 */}
          <div className="card p-5">
            <div className="text-sm font-medium text-ink-primary mb-3 flex items-center gap-1.5"><User size={14} />演示账号</div>
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-ink-tertiary">
                <th className="th">用户名</th><th className="th">姓名</th><th className="th">角色</th><th className="th">当前</th>
              </tr></thead>
              <tbody>
                {(data?.users ?? []).map((u) => (
                  <tr key={u.username} className="border-t border-slate-100">
                    <td className="td font-mono text-xs">{u.username}</td>
                    <td className="td">{u.name}</td>
                    <td className="td">{ROLE_LABEL[u.role] ?? u.role}</td>
                    <td className="td">{data?.current === u.username ? <span className="text-green-600 text-xs">● 在线</span> : <span className="text-ink-tertiary text-xs">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[11px] text-ink-tertiary mt-3">审批人身份由登录会话决定，全程写入审计日志。</div>
          </div>

          {/* 运行环境 */}
          <div className="card p-5">
            <div className="text-sm font-medium text-ink-primary mb-3">运行环境</div>
            <div className="space-y-1.5 text-[13px]">
              {[
                ['业务期间', data?.env.period],
                ['数据库', data?.env.db],
                ['Node 运行时', data?.env.node],
                ['平台', data?.env.platform],
                ['架构原则', '规则做计算 · AI 做理解 · 人做决策'],
                ['铁律', '人没点头，账不改——所有写账动作必须经人工审批'],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 py-1 border-b border-slate-50 last:border-0">
                  <span className="text-ink-tertiary shrink-0">{k}</span>
                  <span className="text-ink-primary text-right">{v ?? '…'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
