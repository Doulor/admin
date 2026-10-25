import type { UserTitle } from './titles'

/**
 * Forum entities. Everything the app shows derives from `ForumState`; counts
 * (replies, likes, followers…) are computed by the store, never stored twice.
 *
 * Timestamps are epoch milliseconds. Ids come from `ForumState.counters`
 * (`t46`, `p221`, `n31`), never from the clock or a random source, so a seed
 * and every state grown from it stay deterministic.
 */

export const FORUM_STATE_VERSION = 1

export type UserRole = 'admin' | 'moderator' | 'member'

/**
 * 谁能看到（#276）：公开、注册用户可见、极客班成员可见。话题上是生效值（话题自己的设置，
 * 没有就跟分类），服务端已经按看的人过滤过，看不到的话题根本不在 state 里。
 */
export type Visibility = 'public' | 'registered' | 'member'

/** 帖子上的一种表情回应（#276）：用的哪个表情、几个人、自己有没有贴。 */
export interface Reaction {
  stickerId: string
  shortcode: string
  url: string
  count: number
  mine: boolean
}

/** 账号所在部门（#276，和 `/auth/me`、`/api/public/departments` 同一套数据）。 */
export interface AccountDepartment {
  id: string
  name: string
  tone: string | null
}

/** 账号的一个称号（控制台发的，名字由管理员定）。 */
export interface AccountTitle {
  id: string
  name: string
  department_id: string | null
}

/**
 * Who the account belongs to, set by the forum server (`/api/forum/state`):
 * a signed-in 极客班 member, a guest who replied under a nickname (no login,
 * no editable profile), or the 极客班 account that owns the published old
 * posts. The demo seed and the snapshot leave it out: everyone is a member.
 */
export type UserKind = 'member' | 'guest' | 'official'

export interface NotifyPrefs {
  reply: boolean
  like: boolean
  follow: boolean
}

export interface User {
  id: string
  /** ASCII handle used in `@mentions` and `/u/[username]`. */
  username: string
  displayName: string
  bio: string
  location: string
  website: string
  /** Hex colour behind the initials avatar. */
  avatarColor: string
  /**
   * Optional picture: the uploaded avatar or the GitHub one from the forum
   * server, or the local snapshot's asset route. The seed never sets it and
   * initials remain the fallback.
   */
  avatarUrl?: string
  kind?: UserKind
  joinedAt: number
  role: UserRole
  /**
   * Optional 极客班 title (舰长, 队长, 领航员 …) shown beside the name.
   * `role` is unchanged by it. Forum permissions read both: an admin or
   * moderator holds every forum capability, anyone else what their title
   * carries (`hasForumCapability` in `permissions.ts`).
   */
  title?: UserTitle
  /** 论坛服务端给的部门与称号（#276），示例数据和快照没有。 */
  department?: AccountDepartment | null
  titles?: AccountTitle[]
  notifyPrefs: NotifyPrefs
}

export interface Category {
  id: string
  slug: string
  name: string
  description: string
  /** Hex colour for the category dot. */
  color: string
  /** UnoCSS icon class, `i-carbon-*`. */
  icon: string
}

export interface Tag {
  id: string
  slug: string
  name: string
  color: string
}

export interface Topic {
  id: string
  slug: string
  title: string
  categoryId: string
  tagIds: string[]
  authorId: string
  createdAt: number
  /** Timestamp of the newest post; the "latest" sort key. */
  lastActivityAt: number
  views: number
  pinned: boolean
  closed: boolean
  /** 生效的可见范围（#276）；示例数据和快照没有，按公开处理。 */
  visibility?: Visibility
}

export interface Post {
  id: string
  topicId: string
  authorId: string
  /**
   * Markdown. Empty once the post is soft-deleted, and absent in a list the
   * forum server answered without bodies (#156): `/state` carries `excerpt`
   * instead, and the topic page asks for this topic's posts to get `content`.
   * “Absent” means “this answer did not send a body”, not “the post is
   * empty” — a merge must keep the body the page already holds.
   */
  content?: string
  /**
   * One line of plain text the server cut from the body (#156), for lists and
   * search hits. Present on every post `/state` returns; `content` is not.
   * The demo seed and the snapshot leave it out and use `content`.
   */
  excerpt?: string
  createdAt: number
  editedAt?: number
  /** Set when the reply targets a specific post rather than the topic. */
  replyToPostId?: string
  likeUserIds: string[]
  /** 表情回应（#276），只含有人贴的，按第一次出现排序；示例数据和快照没有。 */
  reactions?: Reaction[]
  deleted?: boolean
}

export type NotificationType = 'reply' | 'like' | 'follow' | 'mention' | 'system'

export interface Notification {
  id: string
  recipientId: string
  type: NotificationType
  /** Who caused it. System notifications are attributed to the admin. */
  actorId: string
  topicId?: string
  postId?: string
  createdAt: number
  read: boolean
}

export interface Bookmark {
  userId: string
  postId: string
  createdAt: number
}

export interface Follow {
  followerId: string
  followeeId: string
  createdAt: number
}

export interface Counters {
  topic: number
  post: number
  notification: number
  /**
   * Added with tag creation. A state written before it exists resumes from
   * `tags.length` (see `parseState`), so the version stays at 1 and nobody's
   * local forum is reseeded by the upgrade.
   */
  tag: number
}

export interface ForumState {
  version: typeof FORUM_STATE_VERSION
  seededAt: number
  counters: Counters
  users: User[]
  categories: Category[]
  tags: Tag[]
  topics: Topic[]
  posts: Post[]
  notifications: Notification[]
  bookmarks: Bookmark[]
  follows: Follow[]
}

/**
 * What one write changed, as the forum server sends it back (#145): the
 * records in the same shape as in `ForumState`, merged by id into the state
 * the page already holds (`applyChanges` in stores/forum.ts). Bookmarks and
 * follows have no id; one that no longer exists comes under `removed`.
 *
 * Posts come in two shapes (#156): the answer to a write that did not change
 * a body (a like, a bookmark) carries `excerpt` like `/state` does, and the
 * answer to one that did (发贴、回复、编辑、删除) carries `content`. A post
 * whose `content` is absent is not a deleted post — it means “the server did
 * not send a body”, and `postExcerpt()` reads `excerpt` instead.
 */
export interface ForumChanges {
  users?: User[]
  tags?: Tag[]
  topics?: Topic[]
  posts?: Post[]
  notifications?: Notification[]
  bookmarks?: Bookmark[]
  follows?: Follow[]
  removed?: {
    bookmarks?: Array<Pick<Bookmark, 'userId' | 'postId'>>
    follows?: Array<Pick<Follow, 'followerId' | 'followeeId'>>
  }
}

export interface SessionState {
  currentUserId: string | null
}
