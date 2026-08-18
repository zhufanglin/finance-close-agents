"use client";

import { usePathname } from "next/navigation";

/**
 * 页面切换转场容器：路由变化时以 pathname 为 key 重新挂载，
 * 触发 .page-enter 上移淡入动画（定义在 globals.css）。
 * /presentation 自带全屏幻灯转场，跳过避免嵌套动画。
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const skip = pathname?.startsWith("/presentation");

  return (
    <div key={pathname} className={skip ? "" : "page-enter"}>
      {children}
    </div>
  );
}
