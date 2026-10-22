import type { AppConfig } from "../config.js";

/** Accept only the environment's single public origin; reject protocol-relative and credential-bearing URLs. */
export function safeReturnTo(raw: string | undefined, config: AppConfig, fallback: string): string {
  if (!raw || raw.length > 2048 || /[\\\u0000-\u0020]/.test(raw) || raw.startsWith("//")) return fallback;
  try {
    const url = new URL(raw, config.publicOrigin);
    if (url.origin !== config.publicOrigin || url.username || url.password) return fallback;
    return url.toString();
  } catch { return fallback; }
}

/**
 * 登录没成功的原因，写进统一登录页地址的 `signin` 参数，由登录页（app/console/src/lib/signin.ts）给出说明。
 * 后四个是 #262 第二期（邮箱、Google、邀请码注册）加的。
 */
export type SigninOutcome = "not_member" | "invite_pending" | "cancelled" | "failed" | "account_disabled"
  | "invite_required" | "invalid_invite" | "email_taken";

/**
 * 登录没成功时回到统一登录页（#262）：`/signin?signin=<原因>&return_to=<原来要回的本站路径>`，`extra` 另带几个参数
 * （例如 `provider=google`，让登录页知道是哪种方式要邀请码）。三端的「登录」都从这个页面出发，失败也回到这里说清原因；
 * 登录页会再按同源校验 return_to。
 */
export function signinFailureUrl(publicOrigin: string, back: string, outcome: SigninOutcome, extra: Record<string, string> = {}): string {
  const target = new URL(back);
  target.searchParams.delete("signin");
  const url = new URL("/signin", publicOrigin);
  url.searchParams.set("signin", outcome);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  url.searchParams.set("return_to", `${target.pathname}${target.search}${target.hash}`);
  return url.toString();
}
