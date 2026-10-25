import type { AppConfig } from "../config.js";
import type { SigninRefusal } from "./identity-store.js";

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
 * 中间几个是 #262 第二期（邮箱、Google、邀请码注册）加的。
 * #274：邀请码在三种注册方式上都改成选填（SPEC §3.2），`not_member`、`invite_pending`、`invite_required`
 * 不会再被登录流程抛出——GitHub 组织那道门已经去掉，没填邀请码就注册成注册用户，不再是「缺邀请码不能注册」。
 * `invite_invalid` 取代旧的 `invalid_invite`，和 CONTRACT-274 §1/§2 的错误码、`POST /api/identity/invite/redeem`
 * 用的码保持一致（旧名字只在这两个字之间颠倒，容易和「邀请码不对」的真实错误码搞混）。
 * 直接复用 `lib/identity-store.ts` 的 `SigninRefusal`（邮箱、Google、GitHub 共用同一套登录结果），
 * 不在这里另造一份可能对不上的字面量联合。
 */
export type SigninOutcome = SigninRefusal | "cancelled" | "failed";

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

/**
 * 绑定登录方式（#291）的结果：写进回到原页面的地址，`?link=<结果>&provider=google`（docs/plan/UNIFIED-LOGIN.md「绑定与解绑」）。
 * 绑定不走登录页：人是登录着的，失败也留在原来的账号里。
 * linked：绑上了；conflict：这个 Google 账号已属于别的账号；exists：本账号已经绑了 Google；
 * cancelled：在 Google 页点了拒绝；failed：其余都算失败（授权没通过，或授权过程中换了账号、重新登录过）。
 */
export type LinkOutcome = "linked" | "conflict" | "exists" | "cancelled" | "failed";

export function linkResultUrl(back: string, provider: "google", outcome: LinkOutcome): string {
  const url = new URL(back);
  url.searchParams.set("link", outcome);
  url.searchParams.set("provider", provider);
  return url.toString();
}
