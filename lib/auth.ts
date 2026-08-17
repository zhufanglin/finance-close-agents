import { cookies } from "next/headers";

export const SESSION_COOKIE = "fin_session";

/** 服务端鉴权：读取会话 cookie，未登录返回 null */
export async function getSession(): Promise<string | null> {
  const store = cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
