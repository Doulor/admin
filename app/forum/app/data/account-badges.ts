import type { AccountDepartment, User } from './types'

/**
 * 论坛里账号旁边的称号标签（#276 CONTRACT §9）：读论坛服务端给的新称号与部门（和 `/auth/me`、
 * `/api/public/departments` 同一套，名字由管理员在控制台定），不再读旧的 `/api/public/org`，
 * 不再出现提督、舰长这些旧称号。
 *
 * - 有称号：每个称号一个标签，颜色取称号所在部门的色调；
 * - 没有称号但有部门（不是「无部门」）：部门名一个标签；
 * - 都没有：不挂标签。
 *
 * 示例数据和本机快照里的用户没有 `titles` 字段，仍按旧的 `title`（TitleBadge 的另一条路）显示。
 */

/** 部门色调 → 白底上的字色（SPEC §1 四个字母的描边色，对比度 ≥ 4.5:1）。 */
export const DEPARTMENT_TONE_COLORS: Record<string, string> = {
  y: '#16806a',
  u: '#2a6fd6',
  c: '#565de0',
  g: '#c03a7e',
  pill: '#2f68d8',
  ink: '#4f6f9f',
}

const NO_DEPARTMENT = 'dept.none'

export interface AccountBadge {
  key: string
  label: string
  color: string
}

/** 这个用户是不是服务端的新称号数据（有 `titles` 字段）。 */
export function hasAccountTitles(user: Pick<User, 'titles'>): boolean {
  return Array.isArray(user.titles)
}

/**
 * `departments` 是 `/api/public/departments` 读到的部门（按 id），称号的部门不是这个人自己的部门时用它取色调；
 * 没读到就用这个人自己的部门。
 */
export function accountBadges(user: Pick<User, 'titles' | 'department'>, departments?: ReadonlyMap<string, AccountDepartment>): AccountBadge[] {
  const toneOf = (departmentId: string | null): string => {
    const department = departmentId ? (departments?.get(departmentId) ?? (user.department?.id === departmentId ? user.department : null)) : null
    return DEPARTMENT_TONE_COLORS[department?.tone ?? 'ink'] ?? DEPARTMENT_TONE_COLORS.ink!
  }
  const titles = user.titles ?? []
  if (titles.length)
    return titles.map(title => ({ key: title.id, label: title.name, color: toneOf(title.department_id) }))
  const department = user.department
  if (department && department.id !== NO_DEPARTMENT)
    return [{ key: department.id, label: department.name, color: DEPARTMENT_TONE_COLORS[department.tone ?? 'ink'] ?? DEPARTMENT_TONE_COLORS.ink! }]
  return []
}

/** `/api/public/departments` 的回答里论坛用得上的部分：id、名字、色调；形状不对的条目跳过。 */
export function parsePublicDepartments(body: unknown): Map<string, AccountDepartment> {
  const list = (body as { departments?: unknown } | null)?.departments
  const map = new Map<string, AccountDepartment>()
  if (!Array.isArray(list))
    return map
  for (const item of list) {
    const { id, name, tone } = (item ?? {}) as { id?: unknown, name?: unknown, tone?: unknown }
    if (typeof id === 'string' && typeof name === 'string')
      map.set(id, { id, name, tone: typeof tone === 'string' ? tone : null })
  }
  return map
}

/** 这个用户旁边有没有称号标签可挂：新称号数据看 `accountBadges`，示例数据看旧的 `title`。 */
export function hasTitleBadge(user: Pick<User, 'title' | 'titles' | 'department'>): boolean {
  return hasAccountTitles(user) ? accountBadges(user).length > 0 : !!user.title
}
