import type { FastifyRequest } from "fastify";
import { loadSession } from "../../middleware/require-auth.js";
import { FORUM_CAPABILITIES, type Capability } from "../../lib/roles.js";
import { CAPABILITY_TO_NODES } from "../../lib/permission-nodes.js";
import { nodeMatches, type PermissionEngine } from "../../lib/permissions.js";
import { ForumError, allowedVisibilities, type ViewerLevel } from "../../lib/forum-rules.js";
import type { ChangeKeys, ChangeOptions, ForumTitle } from "../../lib/forum-store.js";

/**
 * 论坛里「谁在看」：带有效 `sid` 就是成员，其余一律是游客——`getSession()`（lib/auth.ts）已经把账号被停用的
 * 会话删掉了，能解析出会话就等于账号现在是活跃状态，不用再按 `access.member`/`org_state` 多判一次（#274 之前
 * 这里就是靠这个判的，迁移后所有新账号的 `org_state` 恒为 active，这个检查已经形同虚设）。
 * 「能不能写」不在这里判：由 `requireWriter`/`canModerate` 按权限节点判定，`capabilities` 只是按钮显隐的
 * 提示（从权限引擎的 forum.moderate.* 等节点反查成旧 Capability 格式给前端，不参与真正的鉴权）。
 * 不调用 `access.resolve()`：它原来在这里补查 GitHub 组织角色，#274 review round 1 删掉那次查询之后只剩一次
 * 读完就丢的计算。
 */
export type ForumViewer =
  | { kind: "guest"; userId: null; login: null; accountId: null; capabilities: Capability[] }
  | { kind: "member"; userId: string; login: string; accountId: string; capabilities: Capability[] };
export type MemberViewer = Extract<ForumViewer, { kind: "member" }>;

declare module "fastify" {
  interface FastifyRequest {
    forumViewer?: ForumViewer;
  }
}

const GUEST: ForumViewer = Object.freeze({ kind: "guest", userId: null, login: null, accountId: null, capabilities: [] });

/** 旧 Capability → 新节点的反查，只留论坛相关的几条；持有反查到的任意一个节点就算有这条旧能力。 */
const FORUM_CAPABILITY_NODES = FORUM_CAPABILITIES
  .map(capability => [capability, CAPABILITY_TO_NODES[capability]] as const)
  .filter((entry): entry is [Capability, string[]] => entry[1] !== null);

/**
 * 这个节点不论在哪个 scope 下，只要有一条允许的条目就算数：按钮显隐的提示不用管具体分类（真正能不能操作
 * 某一条帖子仍然按 canModerate 带着分类判一遍），版主在哪怕一个分类里能管，提示就该让按钮露出来。
 */
function hasGrantedNode(permissions: PermissionEngine, accountId: string, node: string): boolean {
  return permissions.entriesFor(accountId).some(entry => nodeMatches(entry.node, node) && entry.value);
}

/**
 * 解析并缓存到 req.forumViewer。成员按会话的极客班账号认人（#262）：第一次来建论坛用户，之后每次请求刷新头像地址。
 * 角色与称号只保真两件事，都是权限引擎当下主动维护、不会越来越假的字段：站长（持 `title.site.owner`）显示
 * 管理员角色与徽章；往届成员（`level` 是 `level.alumni`）挂「alumni」徽章；其余人不挂称号徽章——旧的提督、
 * 舰长、部门称号徽章读的是 `role_assignments`，迁移后这张表不再写入，继续显示只会越来越假。论坛的称号与部门
 * 展示改读新称号体系是 #276（CONTRACT-276.md §9）。
 * #274 SPEC §3.6：邮箱、Google 登录的会话没有 GitHub id（`session.user_id` 为空）——这不等于游客，论坛按
 * `account_id` 认人；`ensureMember` 接受 `githubUserId: null`，没有 GitHub id 的成员编一个新的论坛内部 id。
 * 这个账号以前用 GitHub 登录过、留下一条 `m<GitHub id>` 的论坛用户行时，`ensureMember` 按账号先找到那一行，
 * 自动续用，不会另建一个空白新号。
 */
export async function forumViewer(req: FastifyRequest): Promise<ForumViewer> {
  if (req.forumViewer) return req.forumViewer;
  if (!loadSession(req)) return (req.forumViewer = GUEST);
  const session = req.session!;
  const { permissions } = req.server.services;
  const groups = permissions.groupsOf(session.account_id);
  const isOwner = groups.titles.some(item => item.id === "title.site.owner");
  const title: ForumTitle | null = isOwner ? { id: "admin" } : groups.level === "level.alumni" ? { id: "alumni" } : null;
  const userId = req.server.services.forum.ensureMember({
    accountId: session.account_id, githubUserId: session.user_id, login: session.login, avatarUrl: session.avatar_url,
    role: isOwner ? "admin" : "member", title,
    // #276 CONTRACT §9：部门与称号和 /auth/me 同一套数据（权限引擎的 groupsOf），每次请求都刷新。
    department: groups.department, titles: groups.titles,
  });
  const capabilities = FORUM_CAPABILITY_NODES
    .filter(([, nodes]) => nodes.some(node => hasGrantedNode(permissions, session.account_id, node)))
    .map(([capability]) => capability);
  return (req.forumViewer = { kind: "member", userId, login: session.login, accountId: session.account_id, capabilities });
}

export async function requireMember(req: FastifyRequest): Promise<MemberViewer> {
  const viewer = await forumViewer(req);
  if (viewer.kind !== "member") throw new ForumError(401, "signin_required", "登录后才能操作");
  return viewer;
}

export const can = (viewer: ForumViewer, capability: Capability) => viewer.capabilities.includes(capability);

/**
 * 写接口的权限闸（#274 SPEC §3.2/§3.11）：先要求登录，再按权限节点判定；403 在限额判断之前就拦住——
 * 拿错身份的人（登录了但没有邀请码、没有这个节点）先被拒绝，不会先撞上限额。
 * 发话题 → forum.topic.create，发回复 → forum.reply.create，点赞/收藏/关注 → forum.react；
 * 版务（置顶、关闭、编辑删除他人帖子）另走 canModerate，按分类限定 scope，这里不重复。
 */
export async function requireWriter(req: FastifyRequest, node: string): Promise<MemberViewer> {
  const viewer = await requireMember(req);
  if (!req.server.services.permissions.check(viewer.accountId, node)) throw forbidden(`需要「${node}」权限`);
  return viewer;
}
/**
 * #274 版务授权：按新权限节点判定（取代 can() 走的旧 Capability），版主的 forum.moderate.* 是按分类限定的
 * scope（SPEC §3.4：部门组的 scope 是 `{category:[本部门分类]}`），所以这里要把目标话题的分类传进去，
 * 不能只判「有没有这个节点」。访客没有账号，一律 false。
 */
export function canModerate(req: FastifyRequest, viewer: ForumViewer, node: string, categoryId?: string): boolean {
  if (viewer.kind !== "member") return false;
  return req.server.services.permissions.check(viewer.accountId, node, categoryId ? { category: [categoryId] } : {});
}
export const forbidden = (message: string) => new ForumError(403, "forbidden", message);
export const notFound = (message: string) => new ForumError(404, "not_found", message);
export { rateLimited } from "../../middleware/http-policy.js";

/**
 * 分级可见（#276 CONTRACT §1）：这个身份能看到的最高级别。成员（持 `forum.read.member`）看三级，
 * 注册用户（持 `forum.read.registered`）看公开 + 注册可见，其余（访客）只看公开。
 */
export function levelOf(permissions: PermissionEngine, accountId: string | null): ViewerLevel {
  if (permissions.check(accountId, "forum.read.member")) return "member";
  if (permissions.check(accountId, "forum.read.registered")) return "registered";
  return "public";
}

/**
 * 直接取看不到的话题或帖子（#276 CONTRACT §1）：访客回 401 带 `need`，已登录但不够回 403 带 `node` 与 `need`；
 * 响应体里不带标题和正文——调用方在抛出这个错误之前不能已经把标题/正文塞进别的字段。
 */
export function visibilityDenied(viewerKind: ForumViewer["kind"], need: Exclude<ViewerLevel, "public">): ForumError {
  if (viewerKind === "guest") return new ForumError(401, "unauthenticated", "登录后才能查看", { need });
  const node = need === "member" ? "forum.read.member" : "forum.read.registered";
  return new ForumError(403, "forbidden", `需要「${need === "member" ? "极客班成员" : "注册用户"}」身份才能查看`, { node, need });
}

/** 这个话题/帖子的生效可见范围，看的人够不够看；不够就抛 401/403（见 visibilityDenied）。 */
export function assertVisible(req: FastifyRequest, viewer: ForumViewer, effective: ViewerLevel) {
  if (effective === "public") return;
  const level = levelOf(req.server.services.permissions, viewer.accountId);
  if (allowedVisibilities(level).includes(effective)) return;
  throw visibilityDenied(viewer.kind, effective as Exclude<ViewerLevel, "public">);
}

/** 看的人（前端据此判断按钮显隐）：GET /state 与每个写接口都带。 */
function viewerAndPolicy(_req: FastifyRequest, viewer: ForumViewer) {
  return { viewer: { userId: viewer.userId, kind: viewer.kind, capabilities: viewer.capabilities } };
}

/**
 * GET /state 返回的 state：整份论坛数据 + 看的人。分级可见（#276）在 SQL 层按 `levelOf()` 算出的级别过滤，
 * 不是查出来再筛——forum-store.ts 的 state() 把过滤条件编进 WHERE。
 */
export function forumState(req: FastifyRequest, viewer: ForumViewer) {
  const level = levelOf(req.server.services.permissions, viewer.accountId);
  return { ...req.server.services.forum.state(viewer.userId, level), ...viewerAndPolicy(req, viewer) };
}

/**
 * 写接口的回答（#145）：只有这次写入改动的记录（`changes`，见 forum-store 的 ForumChanges），加上看的人。
 * 成员每次请求都会刷新自己的角色、称号、头像（ensureMember），所以成员本人的用户记录总是带上。
 * #156：`options.posts` 决定帖子记录带什么（默认只有字段、没有正文也没有摘要）；发帖、回复、编辑、删除传 `full`。
 */
export function forumChanges(req: FastifyRequest, viewer: ForumViewer, keys: ChangeKeys, options: ChangeOptions = {}) {
  const users = viewer.userId === null ? keys.users : [viewer.userId, ...(keys.users ?? [])];
  return { changes: req.server.services.forum.changes(viewer.userId, { ...keys, ...(users ? { users } : {}) }, options), ...viewerAndPolicy(req, viewer) };
}
