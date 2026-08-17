import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 演示账号登录：校验 DB 种子用户（admin/finance/auditor），cookie 记录用户名
const DEMO_FALLBACK = { username: "admin", password: "admin123", name: "朱方林" };

export async function POST(req: Request) {
  const { username, password } = await req.json();

  let user = await prisma.user.findUnique({ where: { username } }).catch(() => null);
  // 数据库不可用时兜底演示账号
  if (!user && username === DEMO_FALLBACK.username && password === DEMO_FALLBACK.password) {
    user = { ...DEMO_FALLBACK, role: "admin" } as NonNullable<typeof user>;
  }

  if (!user || user.password !== password) {
    return NextResponse.json(
      { ok: false, message: "账号或密码错误" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set("fin_session", user.username, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  return res;
}
