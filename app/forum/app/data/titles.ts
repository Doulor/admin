/**
 * 极客班称号 (titles) as the forum shows them next to a username.
 *
 * Accounts from the core service carry their titles and department themselves
 * (`/auth/me`, drawn by `account-badges.ts`). This file is the older look for
 * users without that data: the demo seed and the local snapshot. The values
 * below are the server's seed defaults (`app/server/src/lib/roles.ts`), kept
 * dependency-free so the static Nuxt build never reaches into the core
 * packages. Every display helper takes the look (`OrgLook`) as an argument, so
 * the helpers stay pure. `tests/titles.test.ts` and
 * `tests/titles-server-parity.test.ts` pin the defaults to the server's.
 *
 * Icons: the server stores bare Carbon names (`star-filled`); here they are the
 * full UnoCSS class (`i-carbon-star-filled`) spelled out as literals, because
 * the scanner reads `app/**` TypeScript and only a literal makes the icon rule
 * exist. `ICON_CLASSES` spells out every name the server's defaults use; the
 * test checks each against `@iconify-json/carbon/icons.json`.
 *
 * A title is identity, not a forum role: `User.role` (admin / moderator /
 * member) is untouched. What a title may do in the forum is its forum
 * capabilities (`titleForumCapabilities`), read by `permissions.ts`. Those
 * packs stay local defaults: the server does not publish permission packs to
 * anonymous readers, so a pack the 提督 edits in the console does not reach
 * the forum until the forum has its own backend (issue #57).
 */

export type TitleId = 'admin' | 'captain' | 'head' | 'member' | 'alumni' | 'guest'

/** The server's `TONES`: every tone is at least 5:1 on white and on its own 12% tint. */
export const TONES = {
  amber: '#855700',
  cobalt: '#3346C8',
  violet: '#6E44C9',
  jade: '#18694A',
  sky: '#08609A',
  coral: '#A63F16',
  rose: '#B4235A',
  slate: '#5B6475',
} as const

export type Tone = keyof typeof TONES

/**
 * The server's `DEPARTMENT_ICONS`, in its order: every icon a title or a
 * department may wear, bare Carbon name to UnoCSS class.
 */
export const ICON_CLASSES = {
  'star-filled': 'i-carbon-star-filled',
  'badge': 'i-carbon-badge',
  'code': 'i-carbon-code',
  'compass': 'i-carbon-compass',
  'user': 'i-carbon-user',
  'user-follow': 'i-carbon-user-follow',
  'terminal': 'i-carbon-terminal',
  'forum': 'i-carbon-forum',
  'application': 'i-carbon-application',
  'bullhorn': 'i-carbon-bullhorn',
  'education': 'i-carbon-education',
  'idea': 'i-carbon-idea',
  'trophy': 'i-carbon-trophy',
  'user-favorite': 'i-carbon-user-favorite',
  'chart-network': 'i-carbon-chart-network',
  'logo-github': 'i-carbon-logo-github',
  'book': 'i-carbon-book',
  'user-admin': 'i-carbon-user-admin',
} as const

/**
 * Dark theme: the console has none, so the forum lifts each tone toward
 * Tuffex's own ink token instead of inventing a second palette. The share is
 * the tone's weight in `color-mix`; the test resolves it against the dark
 * tokens in `@talex-touch/tuffex/base.css` and holds it to 5:1.
 */
export const DARK_TONE_SHARE = 40

/** The server's forum capabilities, in catalogue order. */
export const FORUM_CAPABILITIES = [
  'forum.topic.pin',
  'forum.topic.close',
  'forum.post.moderate',
  'forum.category.manage',
  'forum.badge.assign',
] as const

export type ForumCapability = (typeof FORUM_CAPABILITIES)[number]

/** What a title looks like: everything the 提督 can edit apart from its permission pack. */
export interface TitleLook {
  /** Chinese label. For `head` and crew it follows the department name. */
  label: string
  /** English tag, upper case. */
  tag: string
  /** UnoCSS class, one of `ICON_CLASSES`. */
  icon: string
  tone: Tone
  description: string
}

export interface TitleDefinition extends TitleLook {
  id: TitleId
  /** Fixed in code. Lower first: someone's primary title is their lowest rank. */
  rank: number
}

/** The server's `TITLES`, keyed the same way. */
export const TITLES: Readonly<Record<TitleId, TitleDefinition>> = {
  admin: { id: 'admin', label: '提督', tag: 'ADMIRAL', icon: 'i-carbon-user-admin', tone: 'violet', rank: 0, description: '站内管理员，拥有全部权限，任命舰长' },
  captain: { id: 'captain', label: '舰长', tag: 'CAPTAIN', icon: 'i-carbon-star-filled', tone: 'amber', rank: 1, description: '带领全班，权限仅次于提督' },
  head: { id: 'head', label: '队长', tag: 'LEADER', icon: 'i-carbon-badge', tone: 'cobalt', rank: 2, description: '负责一个部门的日常事务' },
  member: { id: 'member', label: '舰员', tag: 'CREW', icon: 'i-carbon-code', tone: 'sky', rank: 5, description: '在读成员；成为极客班成员后自动获得' },
  alumni: { id: 'alumni', label: '领航员', tag: 'NAVIGATOR', icon: 'i-carbon-compass', tone: 'jade', rank: 4, description: '已毕业的学长学姐' },
  guest: { id: 'guest', label: '乘客', tag: 'PASSENGER', icon: 'i-carbon-user', tone: 'slate', rank: 9, description: '没登录的人，只能看帖子' },
}

/**
 * The server's `CREW_TITLE`: `{部门} · {member label}` wears the member tag and
 * the department icon in this fixed neutral tone, ranked between heads and
 * alumni.
 */
export const CREW = { tone: 'slate', rank: 3 } as const satisfies { tone: Tone, rank: number }

/** The server's `DEPARTMENT_ID_PATTERN`. */
export const DEPARTMENT_ID_PATTERN = '^[a-z][a-z0-9-]{1,31}$'

/** What a department looks like on its heads and crew. */
export interface DepartmentLook {
  id: string
  name: string
  tag: string
  /** UnoCSS class, one of `ICON_CLASSES`. */
  icon: string
  tone: Tone
}

export interface DepartmentDefinition extends DepartmentLook {
  /** The `forum.*` part of the department head's permission pack. */
  headForum: readonly ForumCapability[]
  /** The `forum.*` part of the crew (member with a department) permission pack. */
  crewForum: readonly ForumCapability[]
}

/**
 * The server's `DEFAULT_DEPARTMENTS`, reduced to what the forum shows and
 * enforces. A department the forum did not ship with carries no forum
 * capability.
 */
export const DEPARTMENTS: readonly DepartmentDefinition[] = [
  { id: 'recruitment', name: '招新部', tag: 'RECRUIT', icon: 'i-carbon-user-follow', tone: 'coral', headForum: [], crewForum: [] },
  { id: 'tech', name: '技术部', tag: 'TECH', icon: 'i-carbon-terminal', tone: 'jade', headForum: [], crewForum: [] },
  {
    id: 'community',
    name: '社区部',
    tag: 'COMMUNITY',
    icon: 'i-carbon-forum',
    tone: 'rose',
    headForum: ['forum.topic.pin', 'forum.topic.close', 'forum.post.moderate', 'forum.category.manage', 'forum.badge.assign'],
    crewForum: ['forum.topic.pin', 'forum.topic.close', 'forum.post.moderate'],
  },
  { id: 'projects', name: '项目部', tag: 'PROJECTS', icon: 'i-carbon-application', tone: 'cobalt', headForum: ['forum.topic.pin'], crewForum: [] },
]

/**
 * The `forum.*` part of each title's default permission pack (the server's
 * `ROLE_BASE`). The 提督 always holds every capability; the others are only
 * the seed defaults the console may since have changed (see the file comment).
 * A head or crew member adds their department's pack on top.
 */
export const TITLE_FORUM: Readonly<Record<TitleId, readonly ForumCapability[]>> = {
  admin: FORUM_CAPABILITIES,
  captain: FORUM_CAPABILITIES,
  head: [],
  member: [],
  alumni: [],
  guest: [],
}

/** Everything a title badge is drawn from: the titles' and the departments' looks. */
export interface OrgLook {
  titles: Readonly<Record<TitleId, TitleLook>>
  departments: readonly DepartmentLook[]
}

/** The look the demo seed and the local snapshot are drawn with. */
export const DEFAULT_ORG: OrgLook = { titles: TITLES, departments: DEPARTMENTS }

/** What a user record carries. `guest` is the absence of a title and is never stored. */
export interface UserTitle {
  id: Exclude<TitleId, 'guest'>
  /** Department id: expected for `head`; optional for `member` (makes them crew). */
  department?: string
}

const DEPARTMENT_ID = new RegExp(DEPARTMENT_ID_PATTERN)

const STORABLE: ReadonlySet<string> = new Set(['admin', 'captain', 'head', 'member', 'alumni'] satisfies UserTitle['id'][])

const NO_FORUM_CAPABILITIES: ReadonlySet<ForumCapability> = new Set()

function departmentOf(title: UserTitle, departments: readonly DepartmentLook[]): DepartmentLook | undefined {
  return title.department === undefined ? undefined : departments.find(department => department.id === title.department)
}

export function isCrew(title: UserTitle): boolean {
  return title.id === 'member' && title.department !== undefined
}

/**
 * Structural check for titles that did not come from the seed (the read-only
 * snapshot): an object whose `id` is a storable title and whose optional
 * `department` is shaped like a department id.
 */
export function isUserTitle(value: unknown): value is UserTitle {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false
  const { id, department } = value as Record<string, unknown>
  if (typeof id !== 'string' || !STORABLE.has(id))
    return false
  return department === undefined || (typeof department === 'string' && DEPARTMENT_ID.test(department))
}

/** The title's own label, `{部门} · {head label}`, `{部门} · {member label}`. */
export function titleLabel(title: UserTitle, org: OrgLook = DEFAULT_ORG): string {
  const department = departmentOf(title, org.departments)
  const { head, member } = org.titles
  if (title.id === 'head')
    return department ? `${department.name} · ${head.label}` : head.label
  if (isCrew(title))
    return department ? `${department.name} · ${member.label}` : `部门${member.label}`
  return org.titles[title.id].label
}

/** English tag; crew wears the member tag. */
export function titleTag(title: UserTitle, org: OrgLook = DEFAULT_ORG): string {
  return isCrew(title) ? org.titles.member.tag : org.titles[title.id].tag
}

/** Head and crew wear their department's icon; an unknown department falls back to the head icon. */
export function titleIcon(title: UserTitle, org: OrgLook = DEFAULT_ORG): string {
  if (title.id === 'head' || isCrew(title))
    return departmentOf(title, org.departments)?.icon ?? org.titles.head.icon
  return org.titles[title.id].icon
}

/** A head takes the department's tone; crew is always the neutral crew tone. */
export function titleTone(title: UserTitle, org: OrgLook = DEFAULT_ORG): Tone {
  if (isCrew(title))
    return CREW.tone
  if (title.id === 'head')
    return departmentOf(title, org.departments)?.tone ?? org.titles.head.tone
  return org.titles[title.id].tone
}

/**
 * CSS colour for TxTag's `color`: the palette hex on the light theme, the
 * same hex lifted toward `--tx-text-color-primary` under `html.dark`.
 */
export function titleColor(title: UserTitle, dark = false, org: OrgLook = DEFAULT_ORG): string {
  const hex = TONES[titleTone(title, org)]
  return dark ? `color-mix(in srgb, ${hex} ${DARK_TONE_SHARE}%, var(--tx-text-color-primary))` : hex
}

/** Sort key, fixed in code: admin 0, captain 1, head 2, crew 3, alumni 4, member 5, no title 9. */
export function titleRank(title: UserTitle | null | undefined): number {
  if (!title)
    return TITLES.guest.rank
  return isCrew(title) ? CREW.rank : TITLES[title.id].rank
}

/**
 * The forum capabilities a title carries, as the server computes them from
 * the default packs: the title's own `TITLE_FORUM` pack, plus the department's
 * forum pack for a head or crew member. A head or crew member of a department
 * the forum does not ship with holds nothing, like the server skips an
 * assignment to a missing department. Local defaults only (see the file comment).
 */
export function titleForumCapabilities(title: UserTitle | null | undefined): ReadonlySet<ForumCapability> {
  if (!title)
    return NO_FORUM_CAPABILITIES
  if (title.id !== 'head' && !isCrew(title))
    return new Set(TITLE_FORUM[title.id])
  const department = title.department === undefined ? undefined : DEPARTMENTS.find(candidate => candidate.id === title.department)
  if (!department)
    return NO_FORUM_CAPABILITIES
  return new Set([...TITLE_FORUM[title.id], ...(title.id === 'head' ? department.headForum : department.crewForum)])
}
