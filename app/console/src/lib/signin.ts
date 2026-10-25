// 极客班内部登录页（#262）：登录结果的说明、回跳地址的同源校验，以及按 GET /auth/providers 渲染的登录方式。
// 官网、论坛、控制台的「登录」都进 /signin?return_to=<同源路径>；GitHub 只是登录方式之一，身份以极客班账号（account_id）为准。
import { passwordRuleProblem } from "./account";
import { gradeProblem, realNameProblem } from "./grade";
import { ApiError, api, jsonBody } from "./http";
import type { SelectableGrade } from "./types";

export interface OutcomeAction {
  label: string;
  icon: string;
  href: string;
  target?: "_blank" | "_self";
}

export interface OutcomeInfo {
  type: "warning" | "info";
  title: string;
  body?: string;
  action?: OutcomeAction;
}

export function signInOutcomes(): Record<string, OutcomeInfo> {
  return {
    cancelled: { type: "info", title: "已取消登录" },
    failed: { type: "warning", title: "登录没有完成", body: "请稍后再试一次。" },
    account_disabled: {
      type: "warning",
      title: "这个极客班账号已停用",
      body: "账号停用后不能登录，已有的会话也已失效。如有疑问请联系站长。",
    },
    // #274 review round 1：邀请码改成选填，不填直接注册成注册用户；这个码只在填了但无效时才会回来。
    invite_invalid: {
      type: "warning",
      title: "邀请码无效",
      body: "邀请码不对、已停用、过期或者次数用完了。不填邀请码也能注册成注册用户，或者向发给你邀请码的人要一个新的。",
    },
    email_taken: {
      type: "warning",
      title: "这个邮箱已经有极客班账号",
      body: "Google 账号的邮箱已经绑定了别的极客班账号。用邮箱验证码登录那个账号就好。",
    },
    no_account: { type: "info", title: "这个邮箱还没有极客班账号", body: "先用验证码登录注册一个。" },
    code_expired: { type: "warning", title: "验证码已失效", body: "请重新获取验证码再试。" },
    rate_limited: { type: "warning", title: "试得太频繁了", body: "请稍后再试。" },
    registration_limited: {
      type: "warning",
      title: "今天新注册的账号太多了",
      body: "同一个网络或同一台设备今天新建账号的次数到上限了，北京时间零点以后可以再注册。已有账号登录不受影响。",
    },
  };
}

export function parseSignInOutcome(raw: unknown): OutcomeInfo | null {
  if (typeof raw !== "string") return null;
  const outcomes = signInOutcomes();
  return Object.prototype.hasOwnProperty.call(outcomes, raw) ? outcomes[raw] : null;
}

export const DEFAULT_RETURN_PATH = "/console";

/** 绑定邮箱页（#273）：账号还没有登录邮箱时，官网、论坛、控制台都先带人来这里，绑好回到 return_to。 */
export const BIND_EMAIL_PATH = "/bind-email";
export const bindEmailPath = (returnPath: string): string => `${BIND_EMAIL_PATH}?return_to=${encodeURIComponent(returnPath)}`;
/** 补资料页（#280）：缺真实姓名或年级时同样先带人来这里，填好回到 return_to。两项都缺时先绑邮箱。 */
export const COMPLETE_PROFILE_PATH = "/complete-profile";
export const completeProfilePath = (returnPath: string): string => `${COMPLETE_PROFILE_PATH}?return_to=${encodeURIComponent(returnPath)}`;

/**
 * 回跳地址只认本站路径（`/` 开头、不是 `//`、不带反斜杠与控制字符），解析后的 origin 必须等于本站 origin；
 * 完整的本站地址也接受，统一转成「路径 + 查询 + 锚点」。不合格的一律回 `fallback`，绝不跳到别的站点。
 * 服务端 `/auth/*` 还会按 PUBLIC_ORIGIN 再校验一次（app/server/src/lib/safe-return.ts）。
 */
export function safeReturnPath(raw: unknown, origin: string, fallback = DEFAULT_RETURN_PATH): string {
  if (typeof raw !== "string" || !raw || raw.length > 2048) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(raw) || raw.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin || url.username || url.password) return fallback;
  if (!raw.startsWith("/") && !raw.startsWith(`${origin}/`) && raw !== origin) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  // 不回到登录页自己，免得登录成功后又停在登录页
  return url.pathname === "/signin" ? fallback : path;
}

/** 绑定邮箱页绑好以后去哪：同上只认本站路径；指回绑定邮箱页自己时去控制台，免得原地打转。补资料页可以是下一站。 */
export function bindEmailReturn(raw: unknown, origin: string): string {
  const path = safeReturnPath(raw, origin);
  return new URL(path, origin).pathname === BIND_EMAIL_PATH ? DEFAULT_RETURN_PATH : path;
}

/** 补资料页填好以后去哪：同上；指回补资料页或绑定邮箱页时去控制台。 */
export function completeProfileReturn(raw: unknown, origin: string): string {
  const path = safeReturnPath(raw, origin);
  const { pathname } = new URL(path, origin);
  return pathname === COMPLETE_PROFILE_PATH || pathname === BIND_EMAIL_PATH ? DEFAULT_RETURN_PATH : path;
}

/** 一种登录方式，形状与服务端 `GET /auth/providers` 一致（app/server/src/routes/identity/providers.ts）。`password` 是邮箱加密码登录的地址。 */
export type LoginProvider = {
  id: string;
  name: string;
  kind: "redirect" | "email_code";
  start: string;
  can_register: boolean;
  password?: string;
};

const sitePath = (value: unknown): value is string => typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const PROVIDER_ICONS: Record<string, string> = {
  github: "i-carbon-logo-github",
  google: "i-carbon-logo-google",
  email: "i-carbon-email",
};

export const providerIcon = (provider: Pick<LoginProvider, "id">): string => PROVIDER_ICONS[provider.id] ?? "i-carbon-login";

/** 只留形状正确、起点是本站路径的登录方式；未知字段与异常条目丢掉，不让一条坏数据弄坏整页。 */
export function readProviders(body: unknown): LoginProvider[] {
  const list = (body as { providers?: unknown } | null)?.providers;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item): LoginProvider[] => {
    const p = item as Partial<LoginProvider> | null;
    if (!p || typeof p.id !== "string" || typeof p.name !== "string" || typeof p.start !== "string") return [];
    if (p.kind !== "redirect" && p.kind !== "email_code") return [];
    if (!sitePath(p.start)) return [];
    return [{ id: p.id, name: p.name, kind: p.kind, start: p.start, can_register: p.can_register === true, ...(sitePath(p.password) && { password: p.password }) }];
  });
}

/** 整页跳转的登录方式：起点加上 `return_to`（完整本站地址，服务端只接受本站）；Google 注册时另带 `invite`。 */
export function providerHref(provider: Pick<LoginProvider, "start">, returnPath: string, origin: string, invite?: string): string {
  const separator = provider.start.includes("?") ? "&" : "?";
  const code = invite?.trim();
  return `${provider.start}${separator}return_to=${encodeURIComponent(`${origin}${returnPath}`)}${code ? `&invite=${encodeURIComponent(code)}` : ""}`;
}

/**
 * 邮箱登录的接口（app/server/src/routes/identity/email.ts）。成功都已写好 `sid`，前端整页跳到 `return_to`。
 * 忘了密码（#273）也用 `/auth/email/start` 发验证码，`purpose: "reset"` 只换信的标题和第一句话。
 */
export const sendSigninCode = (email: string, returnPath: string, origin: string, purpose: "signin" | "reset" = "signin") =>
  api<{ resend_after: number }>("/auth/email/start", {
    method: "POST", ...jsonBody({ email, return_to: `${origin}${returnPath}`, ...(purpose === "reset" && { purpose }) }),
  });
/** 邮箱还没有账号时这一步就是注册，要带真实姓名和年级（#280）；没带时服务端回 `real_info_required`，验证码不作废。 */
export const verifySigninCode = (code: string, inviteCode?: string, realInfo?: { real_name: string; grade: SelectableGrade }) =>
  api<{ return_to: string; registered: boolean }>("/auth/email/verify", {
    method: "POST", ...jsonBody({ code, ...(inviteCode?.trim() && { invite_code: inviteCode.trim() }), ...(realInfo && { real_name: realInfo.real_name.trim(), grade: realInfo.grade }) }),
  });
export const signInWithPassword = (provider: Pick<LoginProvider, "password">, email: string, password: string, returnPath: string, origin: string) =>
  api<{ return_to: string }>(provider.password ?? "/auth/email/password", { method: "POST", ...jsonBody({ email, password, return_to: `${origin}${returnPath}` }) });
/** 用邮箱验证码重设密码并登录（#273）。这个邮箱没有账号时回 `no_account`，不会顺手注册新账号。 */
export const resetPasswordWithCode = (code: string, password: string) =>
  api<{ return_to: string }>("/auth/email/reset", { method: "POST", ...jsonBody({ code, password }) });

/** 429 里服务端给的等待秒数（`retry_after`）；没有就按 60 秒算。 */
export function retryAfter(error: unknown, fallback = 60): number | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  const seconds = Number(error.payload?.retry_after);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : fallback;
}

/** 验证码只留数字，最多 6 位（粘贴「123 456」也能用）。 */
export const cleanCode = (raw: string | number): string => String(raw).replace(/\D/g, "").slice(0, 6);

/** 登录页的两个标签：登录、注册（所有者 2026-10-23 10:32：要有邮箱注册）。 */
export type SignInTab = "signin" | "register";

/** Google 填的邀请码无效回到登录页（`provider=google` 且 `signin=invite_invalid`，#274：邀请码选填后 Google 不会再有「还没有账号」这一种）：要在「注册」里填邀请码再走 Google。 */
export function backFromGoogleForInvite(query: Record<string, unknown>): boolean {
  return query.provider === "google" && query.signin === "invite_invalid";
}

/** 先打开哪个标签：从 Google 回来要邀请码时开「注册」，其余开「登录」。 */
export const initialSignInTab = (query: Record<string, unknown>): SignInTab => (backFromGoogleForInvite(query) ? "register" : "signin");

/** 只挡明显填错的邮箱，真正的校验在服务端。 */
export const looksLikeEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** 验证码登录和注册共用：先发过验证码，再填满 6 位。 */
export function codeProblem(codeSent: boolean, code: string): string | null {
  if (!codeSent) return "先获取验证码";
  return code.length === 6 ? null : "验证码是 6 位数字";
}

/** 忘记密码表单提交前的本地检查，按页面上从上到下的顺序报第一处问题；新密码必填，规则同账号页。 */
export function resetProblem(form: { email: string; codeSent: boolean; code: string; password: string }): string | null {
  if (!looksLikeEmail(form.email)) return "邮箱格式不对";
  return codeProblem(form.codeSent, form.code) ?? (form.password ? passwordRuleProblem(form.password) : "填上新密码");
}

/**
 * 邮箱注册表单提交前的本地检查，按页面上从上到下的顺序报第一处问题；都对返回 null。
 * 姓名和年级只有极客班成员要填（#280，所有者 2026-10-24 22:05）：填了邀请码就要填；没填邀请码可以都不填，填了一项就两项都要对。
 * 邀请码选填（CONTRACT-274 §2：填了有效的进极客班成员，不填进注册用户，填错了服务端回 invite_invalid）。
 * 密码可以不填（注册后到「我的账号」再设），填了就按账号页同一条规则。
 */
export function registerProblem(form: { email: string; realName: string; grade: unknown; invite: string; codeSent: boolean; code: string; password: string }): string | null {
  if (!looksLikeEmail(form.email)) return "邮箱格式不对";
  const needsRealInfo = Boolean(form.invite.trim()) || Boolean(form.realName.trim()) || form.grade !== "";
  return (needsRealInfo ? realNameProblem(form.realName) ?? gradeProblem(form.grade) : null)
    ?? codeProblem(form.codeSent, form.code) ?? (form.password ? passwordRuleProblem(form.password) : null);
}

/**
 * 邮箱注册提交后的结果。`done` 直接跳回 return_to；另外两种要先在页面上说一句再走：
 * `existing` 是邮箱原来就有账号，这次只登录、不替它改密码；`password_failed` 是账号建好并登录了，填的密码没设上。
 */
export type RegisterOutcome =
  | { kind: "done"; returnTo: string }
  | { kind: "existing"; returnTo: string }
  | { kind: "password_failed"; returnTo: string; error: unknown };

/** 设密码（app/server/src/routes/identity/account.ts）。刚用验证码登录，会话 10 分钟内不用再验证，不要当前密码。 */
const setPassword = (password: string) => api<{ ok: true }>("/api/identity/password", { method: "POST", ...jsonBody({ password }) });

/** 用验证码、姓名、年级和邀请码注册，填了密码就接着设上。验证码这一步的错误照常抛出，由页面按错误码处理。 */
export async function registerWithEmail(
  input: { code: string; invite: string; password: string; realName: string; grade: SelectableGrade | null },
  deps: { verify: typeof verifySigninCode; setPassword: (password: string) => Promise<unknown> } = { verify: verifySigninCode, setPassword },
): Promise<RegisterOutcome> {
  const result = await deps.verify(input.code, input.invite, input.grade === null ? undefined : { real_name: input.realName, grade: input.grade });
  if (!input.password) return { kind: "done", returnTo: result.return_to };
  if (!result.registered) return { kind: "existing", returnTo: result.return_to };
  try {
    await deps.setPassword(input.password);
    return { kind: "done", returnTo: result.return_to };
  } catch (error) {
    return { kind: "password_failed", returnTo: result.return_to, error };
  }
}
