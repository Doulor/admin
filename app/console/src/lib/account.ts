// 账号页 /account 的显示规则（#262）：登录方式、成员资格、账号记录的中文名，以及设密码前的本地检查。
// 纯函数，tests/console 直接测；授权和最终校验都在服务端（app/server/src/routes/identity/account.ts）。
import type { AccountView, SessionProvider } from "./types";

export const PROVIDER_TEXT: Record<SessionProvider, string> = { github: "GitHub", email: "邮箱", google: "Google" };
export const PROVIDER_ICON: Record<SessionProvider, string> = { github: "i-carbon-logo-github", email: "i-carbon-email", google: "i-carbon-logo-google" };

export const ACTION_TEXT: Record<string, string> = {
  login: "登录",
  login_denied: "登录被拒",
  logout: "退出登录",
  register: "注册",
  link: "绑定登录方式",
  link_conflict: "绑定被拒",
  password_set: "设置密码",
  password_change: "修改密码",
};
export const RESULT_TEXT: Record<AccountView["recent"][number]["result"], string> = { ok: "成功", denied: "被拒绝", failed: "失败" };

export const providerText = (id: string | null): string => (id && id in PROVIDER_TEXT ? PROVIDER_TEXT[id as SessionProvider] : "-");
export const actionText = (action: string): string => ACTION_TEXT[action] ?? action;

/** 成员资格的一句话：GitHub 组织里的角色，或者用邀请码注册。 */
export function membershipText(membership: AccountView["membership"]): string {
  if (membership.state !== "active") return "已经不是极客班成员";
  if (membership.org_role === "admin") return "极客班成员 · GitHub 组织管理员";
  if (membership.org_role === "member") return "极客班成员 · GitHub 组织成员";
  return membership.via_invite ? "极客班成员 · 用邀请码注册" : "极客班成员";
}

/** 绑定邮箱、设密码要求这次登录不超过 10 分钟；这里只决定提示，服务端仍会核对。 */
export const loginIsFresh = (view: Pick<AccountView, "session">, now = Date.now()): boolean => now < view.session.step_up_until;

/** 和服务端 passwordError 同一条规则：至少 15 位，UTF-8 不超过 72 字节；两次要一样。 */
export function passwordProblem(password: string, again: string): string | null {
  if (password.length < 15) return "密码至少 15 位";
  if (new TextEncoder().encode(password).length > 72) return "密码太长了（不能超过 72 个字节，一个汉字算 3 个）";
  if (password !== again) return "两次输入的密码不一样";
  return null;
}
