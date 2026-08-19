"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MENU } from "@/lib/menu";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  // 收起状态持久化（localStorage）
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      /* 忽略 */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      } catch {
        /* 忽略 */
      }
      return !c;
    });
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`shrink-0 bg-brand-700 text-slate-200 flex flex-col h-full transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-52"
      }`}
    >
      {/* Logo + 收起按钮 */}
      <div className="px-3 py-4 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-200 to-brand-400 flex items-center justify-center text-white text-sm font-medium shrink-0">
          财
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white leading-tight truncate">
              财务月结 AI
            </div>
            <div className="text-[11px] text-white/55 mt-0.5">演示版 v0.1</div>
          </div>
        )}
        <button
          onClick={toggle}
          className={`w-7 h-7 rounded-md flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors shrink-0 ${
            collapsed ? "ml-auto" : "ml-auto"
          }`}
          title={collapsed ? "展开侧栏" : "收起侧栏"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* 菜单 */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        {MENU.map((sec, i) => (
          <div key={i}>
            {sec.section && !collapsed && (
              <div className="px-3 pt-3.5 pb-1.5 text-[11px] text-white/35 tracking-wider">
                {sec.section}
              </div>
            )}
            {sec.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`relative flex items-center rounded-lg text-[13px] mb-0.5 transition-colors ${
                    collapsed
                      ? "justify-center px-0 py-2.5"
                      : "gap-2.5 px-3 py-2.5"
                  } ${
                    active
                      ? "bg-white/[.12] text-white"
                      : "text-white/75 hover:bg-white/[.06] hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-brand-200 rounded-r" />
                  )}
                  <Icon size={16} className="shrink-0 text-white/55" />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 退出 */}
      <button
        onClick={logout}
        title="退出登录"
        className={`px-3 py-3 border-t border-white/10 text-xs text-white/55 flex items-center hover:text-white transition-colors ${
          collapsed ? "justify-center" : "gap-2"
        }`}
      >
        <LogOut size={14} className="shrink-0" />
        {!collapsed && "退出登录"}
      </button>
    </aside>
  );
}
