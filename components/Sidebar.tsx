"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MENU } from "@/lib/menu";
import { LogOut } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-52 shrink-0 bg-brand-700 text-slate-200 flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-200 to-brand-400 flex items-center justify-center text-white text-sm font-medium">
          财
        </div>
        <div>
          <div className="text-[13px] font-medium text-white leading-tight">
            财务月结 AI
          </div>
          <div className="text-[11px] text-white/55 mt-0.5">演示版 v0.1</div>
        </div>
      </div>

      {/* 菜单 */}
      <nav className="flex-1 overflow-y-auto px-2 py-2.5">
        {MENU.map((sec, i) => (
          <div key={i}>
            {sec.section && (
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
                  className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] mb-0.5 transition-colors ${
                    active
                      ? "bg-white/[.12] text-white"
                      : "text-white/75 hover:bg-white/[.06] hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-brand-200 rounded-r" />
                  )}
                  <Icon size={16} className="shrink-0 text-white/55" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 退出 */}
      <button
        onClick={logout}
        className="px-4 py-3 border-t border-white/10 text-xs text-white/55 flex items-center gap-2 hover:text-white transition-colors"
      >
        <LogOut size={14} />
        退出登录
      </button>
    </aside>
  );
}
