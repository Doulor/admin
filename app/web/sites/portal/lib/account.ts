// 全站统一登录（官网、论坛、控制台共用同一个 sid cookie，#262）。「登录」一律去极客班统一登录页：
// /signin?return_to=<本站路径> → 选登录方式（GET /auth/providers，GitHub 只是其一）→ /auth/callback → 回到 return_to。
// 同域读 /auth/me 就知道是谁；本机开发时 5173 把 /auth 代理给核心后端、把 /signin 转给控制台 dev server，127.0.0.1 上各端口共用这个 cookie。
// /auth/me 的字段见 #274 的接口契约（身份等级、部门、称号、限额、偏好、绑定的登录方式）；旧服务端没有的字段读成空值。
import { useCallback, useEffect, useState } from "react";
import { PREVIEW_MOCK } from "@shared/config";
import { devPersonaMe } from "@shared/lib/api";
import { followAppLink } from "./osApps";

/** 部门色：YUGC 四个字母色，管理部门用胶囊蓝，无部门用次要文字色（SPEC §1） */
export type DepartmentTone = "y" | "u" | "g" | "c" | "pill" | "ink";
export type AccountLevel = "registered" | "member" | "alumni";
/** 今天还能投几份、每天最多几份；不限时两个都是 -1 */
export type ApplyQuota = { left: number; limit: number };

/**
 * consoleLink 是 /auth/me 的 console_link：登录者在控制台里能管点什么（持有 console.access、github.org.read、feedback.read
 * 之外的能力）。资料卡只在它为 true 时放「控制台」；字段缺失当作 false。控制台自己的准入不变。
 */
export type Account = {
  login: string;
  avatarUrl: string | null;
  consoleLink: boolean;
  accountId: string | null;
  /** 资料卡上的 @用户名；旧服务端没有时用 login */
  username: string;
  displayName: string;
  bio: string;
  /** 身份等级；旧服务端没有时为 null（资料卡不显示等级，也不显示邀请码） */
  level: AccountLevel | null;
  levelName: string | null;
  department: { id: string; name: string; tone: DepartmentTone } | null;
  titles: Array<{ id: string; name: string }>;
  permissions: string[];
  quota: ApplyQuota | null;
  prefs: { startNoteSeenAt: number | null };
  identities: { emails: string[]; google: boolean; github: string | null };
};

/**
 * 统一登录页地址。`returnTo` 是登录后回到的本站路径（默认当前页面）；只带路径、不带域名，
 * 登录页（app/console/src/lib/signin.ts）与服务端（app/server/src/lib/safe-return.ts）都会再按同源校验。
 */
export function signInHref(returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`): string {
  const path = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/signin?return_to=${encodeURIComponent(path)}`;
}

/** 统一登录页的「注册」页签：注册不需要邀请码，有邀请码可以直接成为成员 */
export function registerHref(returnTo?: string): string {
  return `${signInHref(returnTo)}&tab=register`;
}

/**
 * `/auth/me` 说这个账号还没有登录邮箱（#273）：官网整页跳到绑定邮箱页，绑好回到当前页面。
 * 绑定邮箱页属于控制台（app/console/src/pages/BindEmail.vue），return_to 同样只带本站路径。
 */
export function emailRequired(body: unknown): boolean {
  const me = body as { signed_in?: unknown; email_required?: unknown } | null;
  return me?.signed_in === true && me.email_required === true;
}

export function bindEmailHref(returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`): string {
  const path = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `/bind-email?return_to=${encodeURIComponent(path)}`;
}

const TONES: readonly DepartmentTone[] = ["y", "u", "g", "c", "pill", "ink"];
const LEVELS: readonly AccountLevel[] = ["registered", "member", "alumni"];
const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const count = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function readDepartment(value: unknown): Account["department"] {
  const dept = value as { id?: unknown; name?: unknown; tone?: unknown } | null;
  const id = text(dept?.id);
  const name = text(dept?.name);
  if (!id || !name) return null;
  return { id, name, tone: TONES.includes(dept?.tone as DepartmentTone) ? (dept?.tone as DepartmentTone) : "ink" };
}

/** /auth/me 和投递成功回执里的 quota：两个数都在才算读到 */
export function readQuota(value: unknown): ApplyQuota | null {
  const quota = value as { apply_left_today?: unknown; apply_daily_limit?: unknown } | null;
  const left = count(quota?.apply_left_today);
  const limit = count(quota?.apply_daily_limit);
  return left === null || limit === null ? null : { left, limit };
}

export function parseMe(body: unknown): Account | null {
  const me = body as Record<string, unknown> | null;
  const login = text(me?.login);
  if (me?.signed_in !== true || !login) return null;
  // accountId 是极客班账号（#262）：比赛窗口用它在天梯、队伍里认出「我」；旧会话没有时是 null。
  const accountId = typeof me.account_id === "string" && me.account_id ? me.account_id : null;
  const prefs = me.prefs as { start_note_seen_at?: unknown } | null | undefined;
  const identities = me.identities as { emails?: unknown; google?: unknown; github?: unknown } | null | undefined;
  return {
    login,
    avatarUrl: text(me.avatar_url),
    consoleLink: me.console_link === true,
    accountId,
    username: text(me.username) ?? login,
    displayName: text(me.display_name) ?? login,
    bio: typeof me.bio === "string" ? me.bio : "",
    level: LEVELS.includes(me.level as AccountLevel) ? (me.level as AccountLevel) : null,
    levelName: text(me.level_name),
    department: readDepartment(me.department),
    titles: Array.isArray(me.titles) ? me.titles.flatMap((title: { id?: unknown; name?: unknown }) => (text(title?.id) && text(title?.name) ? [{ id: title.id as string, name: title.name as string }] : [])) : [],
    permissions: Array.isArray(me.permissions) ? me.permissions.filter((node): node is string => typeof node === "string") : [],
    quota: readQuota(me.quota),
    prefs: { startNoteSeenAt: count(prefs?.start_note_seen_at) },
    identities: {
      emails: Array.isArray(identities?.emails) ? identities.emails.filter((email): email is string => typeof email === "string") : [],
      google: identities?.google === true,
      github: text(identities?.github),
    },
  };
}

/**
 * 读 /auth/me。开发态和 PR 预览构建里，地址带 `?__mock=member|registered|visitor` 时改用样板身份（@shared/lib/api 的 devPersonaMe），
 * 不连后端也能看资料卡、投递限额；正式构建里这个分支整段删掉，永远读真接口。
 */
async function readMe(): Promise<unknown> {
  if (import.meta.env.DEV || PREVIEW_MOCK) {
    const persona = await devPersonaMe();
    if (persona) return persona;
  }
  return fetch("/auth/me", { credentials: "same-origin", headers: { accept: "application/json" } })
    .then((response) => (response.ok && response.headers.get("content-type")?.includes("application/json") ? response.json() : null))
    .catch(() => null);
}

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readMe().then((body) => {
      if (cancelled) return;
      if (emailRequired(body)) {
        followAppLink({ href: bindEmailHref(), newTab: false });
        return;
      }
      setAccount(parseMe(body));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  /** 退出是全站的：官网、论坛、控制台一起变成未登录。服务端确认后才显示已退出。 */
  const signOut = useCallback(async () => {
    const ok = await fetch("/auth/signout", { method: "POST", credentials: "same-origin" })
      .then((response) => response.ok)
      .catch(() => false);
    if (ok) setAccount(null);
  }, []);

  /** 资料卡保存成功后把服务端回的新值合进来，不用整份重读 */
  const patch = useCallback((change: Partial<Account>) => setAccount((current) => (current ? { ...current, ...change } : current)), []);
  /** 身份变了（填了邀请码、绑了邮箱）：重读 /auth/me */
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { account, loaded, signOut, patch, reload };
}
