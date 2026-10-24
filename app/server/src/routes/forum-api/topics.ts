import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { FORUM_REQUEST_LIMITS, ForumError, SEARCH_QUERY_MAX, hasControlChars, ipSubject } from "../../lib/forum-rules.js";
import { canModerate, forbidden, forumChanges, forumState, forumViewer, notFound, rateLimited, requireMember, requireWriter } from "./viewer.js";
import { hourlyLimited, levelRateLimited } from "./forum-limits.js";
import { loadSession } from "../../middleware/require-auth.js";

type TopicParams = { topic_id: string };

/** 不登录也能调的读接口按 IP 限流（IPv6 按 /64）：@fastify/rate-limit 在 onRequest 计数，超了和论坛其它接口一样回
 * 429 `rate_limited`（app.ts 注册插件时给的默认 errorResponseBuilder，这里不另写）。计数在进程内存里，重启清零。
 */
const perIp = (limit: { max: number; timeWindow: number }) => ({
  config: { rateLimit: { ...limit, keyGenerator: (req: FastifyRequest) => ipSubject(req.ip) } },
});

/** 看帖、发帖、话题浏览数与版务（置顶、关闭）。 */
export default async function forumTopicRoutes(app: FastifyInstance) {
  const { forum } = app.services;

  // 不要 Fastify 自动加的 HEAD：它会另占一份 120 次的额度，而且照样算整份 state。HEAD 明确回 405，
  // 不落到旧论坛的 410 通配路由上。
  app.get("/api/forum/state", { ...perIp(FORUM_REQUEST_LIMITS.state), exposeHeadRoute: false }, async (req, reply) => {
    const viewer = await forumViewer(req);
    if (levelRateLimited(req, reply, "read")) return;
    return { state: forumState(req, viewer) };
  });
  app.head("/api/forum/state", async (_req, reply) => reply.code(405).header("Allow", "GET").send());

  /**
   * 一个话题的帖子（含正文，#156）：首屏不再带正文，进话题页时按话题取这里。
   * 所有人可读，可见性与 `/state` 的 `posts` 相同（没有帖子级的权限）；不存在的话题 404。
   */
  app.get<{ Params: TopicParams }>("/api/forum/topics/:topic_id/posts", { ...perIp(FORUM_REQUEST_LIMITS.topicPosts), exposeHeadRoute: false }, async (req, reply) => {
    await forumViewer(req);
    if (levelRateLimited(req, reply, "read")) return;
    if (!forum.topic(req.params.topic_id)) throw notFound("话题不存在");
    return { posts: forum.topicPosts(req.params.topic_id) };
  });

  /**
   * 搜索（#156）：首屏不再带正文，浏览器的子串匹配做不到了，改在服务端按话题标题、帖子正文、用户名与昵称匹配。
   * 只在 `/state` 也不给的正文里搜不到时就搜不到（已删除的帖子不参与，与之前一致）；空词回空结果。
   */
  app.get<{ Querystring: { q?: string } }>("/api/forum/search", { ...perIp(FORUM_REQUEST_LIMITS.search), exposeHeadRoute: false }, async (req, reply) => {
    const viewer = await forumViewer(req);
    if (levelRateLimited(req, reply, "search")) return;
    const query = (req.query.q ?? "").trim();
    if (!query) return { results: { topics: [], posts: [], users: [] } };
    if (query.length > SEARCH_QUERY_MAX) throw new ForumError(400, "validation_error", `搜索词最长 ${SEARCH_QUERY_MAX} 个字`);
    app.services.activity.recordActivity(req, { action: "forum.search", surface: "forum", outcome: "ok", meta: { query } });
    return { results: forum.search(viewer.userId, query) };
  });

  /** 只有持 forum.topic.create 的人能发帖（#274 起登录但没有邀请码的注册用户没有这个节点）；游客只能回复。 */
  app.post<{ Body: { title: string; categoryId: string; tags?: string[]; content: string } }>("/api/forum/topics", async (req, reply) => {
    const viewer = await requireWriter(req, "forum.topic.create");
    const title = req.body.title.trim();
    if (!title || hasControlChars(title)) throw new ForumError(400, "invalid_title", "标题不能为空，也不能含控制字符");
    if (!forum.hasCategory(req.body.categoryId)) throw new ForumError(400, "unknown_category", "没有这个分类");
    const tags = req.body.tags ?? [];
    if (tags.some(tag => !tag.trim() || hasControlChars(tag))) throw new ForumError(400, "invalid_tag", "标签不能为空，也不能含控制字符");
    if (!req.body.content.trim()) throw new ForumError(400, "empty_content", "正文不能为空");
    if (!forum.rateAllowed("topic", viewer.userId)) throw rateLimited();
    if (hourlyLimited(req, reply, "topic", viewer.accountId)) return;
    const { topicId, postId } = forum.createTopic({ authorId: viewer.userId, title, categoryId: req.body.categoryId, tags, content: req.body.content });
    forum.rateRecord("topic", viewer.userId);
    const tagIds = forum.topic(topicId)?.tagIds ?? [];
    app.services.activity.recordActivity(req, { action: "forum.topic.create", surface: "forum", target_type: "topic", target_id: topicId, outcome: "ok" });
    return reply.code(201).send({ ...forumChanges(req, viewer, { topics: [topicId], posts: [postId], tags: tagIds }, { posts: "full" }), topicId, postId });
  });

  /** 置顶与关闭：按 forum.moderate.pin / forum.moderate.close 授权（按话题分类限定 scope，#274），写审计（只记开关，不记正文）。 */
  for (const [action, field, node, label] of [
    ["pin", "pinned", "forum.moderate.pin", "置顶话题"],
    ["close", "closed", "forum.moderate.close", "关闭话题"],
  ] as const) {
    app.post<{ Params: TopicParams; Body: Record<typeof field, boolean> }>(`/api/forum/topics/:topic_id/${action}`, async req => {
      const viewer = await requireMember(req);
      const topic = forum.topic(req.params.topic_id);
      if (!topic) throw notFound("话题不存在");
      if (!canModerate(req, viewer, node, topic.categoryId)) throw forbidden(`需要「${label}」权限`);
      const value = req.body[field];
      if (action === "pin") forum.setPinned(topic.id, value); else forum.setClosed(topic.id, value);
      app.services.activity.recordActivity(req, { action: `forum.topic.${action}`, surface: "forum", target_type: "topic", target_id: topic.id, outcome: "ok", meta: { [field]: value }, account_id: viewer.accountId });
      return forumChanges(req, viewer, { topics: [topic.id] });
    });
  }

  /** 浏览数 +1：所有人都能调，同一 IP（IPv6 按 /64）同一话题一小时只算一次。 */
  app.post<{ Params: TopicParams }>("/api/forum/topics/:topic_id/view", perIp(FORUM_REQUEST_LIMITS.view), async (req, reply) => {
    const topic = forum.topic(req.params.topic_id);
    if (!topic) throw notFound("话题不存在");
    forum.recordView(req.params.topic_id, ipSubject(req.ip));
    // #274 残留修复 G：这条路由之前没有任何 preHandler 加载过会话，req.session 永远是 undefined——
    // 下面按账号归因的这次操作记录实际上从来没有把登录的人算成账号，一律落到访客那一支。先补一次
    // loadSession()（和 forumViewer() 的做法一样，只读不写，不强制要求登录）。
    loadSession(req);
    // forum.topic.view 这条操作记录（SPEC §3.7）和上面的浏览计数是两回事：计数永远按 IP 一小时去重，
    // 这里按「同一账号或同一访客」10 分钟只记一次，账号和访客分开计（同一个人同时有两者时按账号）。
    const viewerSubject = req.session?.account_id ?? req.visitorId ?? ipSubject(req.ip);
    if (app.services.limits.hit({ bucket: "forum.topic.view.dedup", subject: `${viewerSubject}:${topic.id}`, window: { ms: 10 * 60_000 }, max: 1 }).ok) {
      app.services.activity.recordActivity(req, { action: "forum.topic.view", surface: "forum", target_type: "topic", target_id: topic.id, outcome: "ok" });
    }
    return reply.code(204).send();
  });
}
