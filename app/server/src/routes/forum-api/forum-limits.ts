import type { FastifyReply, FastifyRequest } from "fastify";
import { VISITOR_PAGE_MAX, ipHash } from "../../lib/forum-rules.js";

/** meta_value 本该在写入时就校验过是 -1 或非负整数（routes/console/permission-groups.ts），这里仍然按
 * "非法值当 0（最严）处理" 兜底（#274 残留修复 K）：旧数据、或者绕过控制台直接写库的值，`Number()` 转出
 * NaN 时不能既不是「不限」也不是「放行」——参与比较的方向一不小心就会变成形同不限，必须显式收口到最严。 */
function metaMax(raw: string | null, unlimitedWhenMissing: boolean): number {
  if (raw === null) return unlimitedWhenMissing ? -1 : 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 按等级的每小时上限（SPEC §3.8），meta 节点 `meta.limit.forum.<action>.hourly`，-1 为不限（控制台可在
 * 权限组上改这个 meta）。和既有的 `forum.rateAllowed`（lib/forum-store.ts 的每分钟洪泛保护，不分等级）
 * 是两条独立的线：那条管「这一下子发得够不够快」，这条管「这一小时发得够不够多」，谁先拦下都回同一形状
 * 的 429（`bucket` 带上具体是哪条线，http-policy.ts 的全局钩子按它记一条 outcome=limited 的操作记录）。
 * 拦下时已经把响应发出去了，调用方只需要 `if (await hourlyLimited(...)) return;`。
 * `max <= 0`（迁移给访客、注册用户种的默认值都是 0）当「这条不管」处理，不是「硬拦截」：SPEC 表里访客、
 * 注册用户「默认不允许」靠的是 forum.topic.create/forum.reply.create 这两个权限节点本身要不要发给他们
 * （由控制台决定，forum-api 的版务权限还没切到新节点体系，见 docs/plan 里 #276 的后续），不是这条每小时
 * 计数器——这里只管「已经能发的人，这一小时发得够不够多」，0 不该在这条线上变成「谁都发不了」。
 */
export function hourlyLimited(req: FastifyRequest, reply: FastifyReply, action: "topic" | "reply" | "react" | "upload", accountId: string): boolean {
  const { permissions, limits } = req.server.services;
  const raw = permissions.meta(accountId, `meta.limit.forum.${action}.hourly`);
  const max = metaMax(raw, true);
  if (max <= 0) return false;
  const bucket = `forum.${action}.hourly`;
  const result = limits.hit({ bucket, subject: accountId, window: { ms: 60 * 60_000 }, max });
  if (result.ok) return false;
  void reply.code(429).header("Retry-After", String(result.retry_after)).send({
    error: "rate_limited", bucket, message: "这小时发得太多了，晚点再试", retry_after: result.retry_after,
  });
  return true;
}

/**
 * 论坛读接口 / 搜索按等级每分钟上限（SPEC §3.8），meta 节点 `meta.limit.read.per_minute` /
 * `meta.limit.search.per_minute`，-1 为不限。按账号（已登录，不论是不是论坛成员——注册用户和极客班成员
 * 的等级组各自有自己的 meta）或访客按 IP 认人（`req.session` 要先调用方自己 `await forumViewer(req)` 或
 * `loadSession(req)` 填上，这里只读）。和已有的 `FORUM_REQUEST_LIMITS`（@fastify/rate-limit，纯按 IP、
 * 不分等级）是两条独立的线，这条是 SPEC 要求的、控制台可改的那条，前者继续当兜底。
 */
export function levelRateLimited(req: FastifyRequest, reply: FastifyReply, kind: "read" | "search"): boolean {
  const { permissions, limits } = req.server.services;
  const accountId = req.session?.account_id ?? null;
  const raw = permissions.meta(accountId, `meta.limit.${kind}.per_minute`);
  const max = metaMax(raw, true);
  if (max === -1) return false;
  const bucket = `${kind}.per_minute`;
  // #274 残留修复 K：访客这条线以前直接存 ipSubject(ip) 的明文（IPv4 原样、IPv6 按 /64），和账号桶的
  // sha256(ip) 不一致，limit_events 里会留下访客的真实 IP 段。
  const result = limits.hit({ bucket, subject: accountId ?? ipHash(req.ip), window: { ms: 60_000 }, max });
  if (result.ok) return false;
  void reply.code(429).header("Retry-After", String(result.retry_after)).send({
    error: "rate_limited", bucket, message: "操作太频繁，请稍后再试", retry_after: result.retry_after,
  });
  return true;
}

/**
 * 访客翻页上限（SPEC §3.8「访客翻页最多 10 页」，#276 CONTRACT §9）：第一页（没带 `cursor`）免费，
 * 从第二页起按访客 id（`attachVisitorId` 发的 `yugc_vid`）计数，每个北京日历日最多翻这么多次；
 * 登录用户（注册用户、极客班成员）一律不限，这条线只管没有会话的访客，防的是整站被按页抓走。
 */
export function visitorPageLimited(req: FastifyRequest, reply: FastifyReply, isVisitor: boolean, hasCursor: boolean): boolean {
  if (!isVisitor || !hasCursor) return false;
  const { limits } = req.server.services;
  const bucket = "forum.visitor.pages";
  const result = limits.hit({ bucket, subject: req.visitorId ?? ipHash(req.ip), window: "day-bj", max: VISITOR_PAGE_MAX });
  if (result.ok) return false;
  void reply.code(429).header("Retry-After", String(result.retry_after)).send({
    error: "rate_limited", bucket, message: "今天翻页太多了，登录后不限", retry_after: result.retry_after,
  });
  return true;
}
