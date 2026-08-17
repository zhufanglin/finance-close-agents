"use client";

import { usePathname } from "next/navigation";
import { currentMenuLabel } from "@/lib/menu";

export default function Topbar() {
  const pathname = usePathname();
  const label = currentMenuLabel(pathname);

  return (
    <header className="h-[52px] bg-white border-b border-line flex items-center justify-between px-5 shrink-0">
      <div className="text-[13px] text-ink-secondary">
        <span className="font-medium text-ink-primary">财务月结 AI</span>
        <span className="mx-2 text-ink-tertiary">·</span>
        {label}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="chip font-medium">演示版 v0.1</span>
      </div>
    </header>
  );
}
