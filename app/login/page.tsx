"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.message || "登录失败");
      }
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(160deg, #f8fafc, #eff6ff)",
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-200 to-brand-400 flex items-center justify-center text-white text-xl font-medium shadow-card">
            财
          </div>
          <h1 className="mt-4 text-lg font-medium text-ink-primary">
            财务月结 AI
          </h1>
          <p className="text-[13px] text-ink-secondary mt-1">
            银企对账 · 发票识别 · AI 差异解释 · 人工审批
          </p>
        </div>

        {/* 登录卡片 */}
        <form
          onSubmit={submit}
          className="bg-white border border-line rounded-2xl shadow-card p-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] text-ink-secondary mb-1.5">
                账号
              </label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入账号"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-[13px] text-ink-secondary mb-1.5">
                密码
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "登录中…" : "登 录"}
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-line text-center text-xs text-ink-tertiary">
            演示账号：admin / admin123
          </div>
        </form>

        <p className="text-center text-xs text-ink-tertiary mt-5">
          演示系统 · 所有 AI 调用均为真实接口
        </p>
      </div>
    </div>
  );
}
