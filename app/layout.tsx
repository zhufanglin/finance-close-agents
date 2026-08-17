import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "财务月结 AI · 演示系统",
  description: "银行对账 · 发票识别 · AI 差异解释 · 人工审批 · 审计留痕",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
