/**
 * 同域 `/auth/me` 的回答里论坛要用的部分。`useSiteAccount` 读它；拿出来单独放，是为了不起 Nuxt 就能测。
 * 官网的 `app/web/sites/portal/lib/account.ts` 有同样的一份（两边工具链分开，不共享代码）。
 */
export interface SiteAccount {
  login: string
  avatarUrl: string | null
  /**
   * `/auth/me` 的 `console_link`：账号在新权限引擎里有没有 `console.access` 节点（#274 review round 1，
   * 不再按旧的称号名单判断，站长、部门部长、拿到这个节点的自定义组都算）。
   * 头像菜单只在它为 true 时放「控制台」；字段缺失或不是 true 都当作 false。控制台自己的准入不变。
   */
  consoleLink: boolean
  /**
   * 账号偏好里存的论坛主题（`prefs.forum_theme`，#276）：换一个浏览器登录时用它，没存过是 null。
   * 只认 sky、light、dark 三个值。
   */
  forumTheme: ForumTheme | null
}

/** 账号偏好里能存的论坛主题；「跟随系统」只存在浏览器里，账号里存 null。 */
export type ForumTheme = 'sky' | 'light' | 'dark'

export function isForumTheme(value: unknown): value is ForumTheme {
  return value === 'sky' || value === 'light' || value === 'dark'
}

/** 没登录、回答不是 JSON 对象、login 不是非空字符串时都是 `null`（当作未登录）。 */
export function parseMe(body: unknown): SiteAccount | null {
  const me = body as { signed_in?: unknown, login?: unknown, avatar_url?: unknown, console_link?: unknown, prefs?: { forum_theme?: unknown } } | null
  if (me?.signed_in !== true || typeof me.login !== 'string' || !me.login)
    return null
  const theme = me.prefs?.forum_theme
  return {
    login: me.login,
    avatarUrl: typeof me.avatar_url === 'string' ? me.avatar_url : null,
    consoleLink: me.console_link === true,
    forumTheme: isForumTheme(theme) ? theme : null,
  }
}

/**
 * `/auth/me` 说这个账号还没有登录邮箱（#273）：论坛整页跳到绑定邮箱页（属于控制台），绑好回到当前页。
 * 本机独立端口上没有 `/auth/me`，读不到这一项，不会跳。
 */
export function emailRequired(body: unknown): boolean {
  const me = body as { signed_in?: unknown, email_required?: unknown } | null
  return me?.signed_in === true && me.email_required === true
}

/** 绑定邮箱页地址；`back` 是浏览器里的本站路径（线上论坛的路径带 `/forum` 前缀），不是本站路径时回首页。 */
export function bindEmailHref(back: string): string {
  const path = back.startsWith('/') && !back.startsWith('//') ? back : '/'
  return `/bind-email?return_to=${encodeURIComponent(path)}`
}

/** `/auth/me` 说这个账号缺真实姓名或年级（#280）：同样整页跳到补资料页（属于控制台），填好回到当前页。 */
export function profileRequired(body: unknown): boolean {
  const me = body as { signed_in?: unknown, profile_required?: unknown } | null
  return me?.signed_in === true && me.profile_required === true
}

/** 补资料页地址；`back` 的规则同 `bindEmailHref`。 */
export function completeProfileHref(back: string): string {
  const path = back.startsWith('/') && !back.startsWith('//') ? back : '/'
  return `/complete-profile?return_to=${encodeURIComponent(path)}`
}
