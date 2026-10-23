import type { FastifyRequest } from "fastify";
import { loadSession } from "../../middleware/require-auth.js";
import { resolveAccess } from "../../middleware/require-capability.js";
import { orderedCapabilities, type Capability } from "../../lib/roles.js";
import { FORUM_LIMITS, ForumError } from "../../lib/forum-rules.js";
import type { ChangeKeys, ChangeOptions, ForumTitle } from "../../lib/forum-store.js";

/**
 * 论坛里「谁在看」：带有效 `sid`、账号现在是极客班成员的是成员，其余一律是游客。成员的论坛能力与
 * 控制台同一条路径（`resolveAccess` → `computeAccess`），只取 `forum.*`；按钮显隐只是提示，授权在这里。
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

/**
 * 解析并缓存到 req.forumViewer。成员按会话的极客班账号认人（#262）：第一次来建论坛用户，之后每次请求刷新角色（站内管理员是 admin）、
 * 称号（排序最高的那个）和 GitHub 头像地址。老账号第一次补记站内角色时要查 GitHub，出错直接抛给 http-policy，不把成员降成游客。
 * 登录后被移出极客班（控制台里把站内角色改成「不是成员」）的人：会话还在，论坛按游客处理，不建、不刷新论坛用户，
 * 显式称号给的 forum.* 能力也不算，下一次请求就生效。
 */
export async function forumViewer(req: FastifyRequest): Promise<ForumViewer> {
  if (req.forumViewer) return req.forumViewer;
  // 论坛用户按 GitHub id 建：没有绑定 GitHub 的账号（邮箱、Google 注册，#262）会话里 user_id 为空，在论坛按游客处理。
  if (!loadSession(req) || req.session!.user_id === null) return (req.forumViewer = GUEST);
  const session = req.session!;
  const access = await resolveAccess(req);
  if (!access.member) return (req.forumViewer = GUEST);
  const top = access.titles[0];
  const title: ForumTitle | null = top && top.id !== "guest" ? { id: top.id, ...(top.department ? { department: top.department.id } : {}) } : null;
  const userId = req.server.services.forum.ensureMember({
    accountId: session.account_id, githubUserId: session.user_id!, login: session.login, avatarUrl: session.avatar_url,
    role: access.siteRole === "admin" ? "admin" : "member", title,
  });
  const capabilities = orderedCapabilities(access.capabilities).filter(capability => capability.startsWith("forum."));
  return (req.forumViewer = { kind: "member", userId, login: session.login, accountId: session.account_id, capabilities });
}

export async function requireMember(req: FastifyRequest): Promise<MemberViewer> {
  const viewer = await forumViewer(req);
  if (viewer.kind !== "member") throw new ForumError(401, "signin_required", "登录后才能操作");
  return viewer;
}

export const can = (viewer: ForumViewer, capability: Capability) => viewer.capabilities.includes(capability);
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
/** 全站的游客回复总量到了上限（FORUM_RATE_LIMITS.guestPostSite）：所有游客暂时不能回复，成员照常。 */
export const guestRepliesPaused = () => new ForumError(429, "guest_replies_paused", "游客回复暂时太多，请过一会儿再试，或者登录后回复");

/** 看的人（前端据此判断按钮显隐）与游客发帖的规则：GET /state 与每个写接口都带。 */
function viewerAndPolicy(req: FastifyRequest, viewer: ForumViewer) {
  const { config, publicSubmission, turnstile } = req.server.services;
  return {
    viewer: { userId: viewer.userId, kind: viewer.kind, capabilities: viewer.capabilities },
    guestPolicy: {
      powDifficulty: publicSubmission.powDifficulty(),
      turnstileSiteKey: turnstile.turnstileEnabled() ? config.turnstile.siteKey : null,
      nameMax: FORUM_LIMITS.guestNameMax,
      contentMax: FORUM_LIMITS.guestContentMax,
    },
  };
}

/** GET /state 返回的 state：整份论坛数据 + 看的人 + 游客发帖的规则。 */
export function forumState(req: FastifyRequest, viewer: ForumViewer) {
  return { ...req.server.services.forum.state(viewer.userId), ...viewerAndPolicy(req, viewer) };
}

/**
 * 写接口的回答（#145）：只有这次写入改动的记录（`changes`，见 forum-store 的 ForumChanges），加上看的人与游客规则。
 * 成员每次请求都会刷新自己的角色、称号、头像（ensureMember），所以成员本人的用户记录总是带上。
 * #156：`options.posts` 决定帖子记录带什么（默认只有字段、没有正文也没有摘要）；发帖、回复、编辑、删除传 `full`。
 */
export function forumChanges(req: FastifyRequest, viewer: ForumViewer, keys: ChangeKeys, options: ChangeOptions = {}) {
  const users = viewer.userId === null ? keys.users : [viewer.userId, ...(keys.users ?? [])];
  return { changes: req.server.services.forum.changes(viewer.userId, { ...keys, ...(users ? { users } : {}) }, options), ...viewerAndPolicy(req, viewer) };
}
