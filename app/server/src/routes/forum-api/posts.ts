import type { FastifyInstance, FastifyRequest } from "fastify";
import { FORUM_LIMITS, ForumError, GUEST_POST_SITE_SUBJECT, NAME_RULE_MESSAGE, ipHash, ipSubject, isAllowedName, normalizeName } from "../../lib/forum-rules.js";
import { canModerate, forbidden, forumChanges, forumViewer, guestRepliesPaused, notFound, rateLimited, requireMember, requireWriter, type MemberViewer } from "./viewer.js";
import { hourlyLimited } from "./forum-limits.js";

/** 同一 IP 上所有账号加起来，回帖每小时 200 次（SPEC §3.8），防止一个 IP 换着账号刷。只存哈希，不存原文。 */
const REPLY_IP_HOURLY_MAX = 200;

type PostParams = { post_id: string };
type ReplyBody = {
  topicId: string; content: string; replyToPostId?: string;
  guest?: { name: string }; pow?: { timestamp: number; nonce: string }; website?: string; turnstileToken?: string;
};

/** 回复（成员与游客）、编辑、删除、点赞、收藏。 */
export default async function forumPostRoutes(app: FastifyInstance) {
  const { forum, config, publicSubmission, turnstile } = app.services;
  const { audit } = app.services.storage;

  /** 帖子存在（可能已软删除，删掉的帖子不能再编辑或点赞，见 assertNotDeleted）。 */
  function existingPost(postId: string) {
    const post = forum.post(postId);
    if (!post) throw notFound("帖子不存在");
    return post;
  }
  const assertNotDeleted = (post: { deleted: boolean }) => {
    if (post.deleted) throw new ForumError(409, "post_deleted", "这条帖子已被删除");
  };
  /** 作者本人或持有对应版务节点（按帖子所在话题的分类限定 scope，#274）的人；返回是不是在动别人的帖子（要审计）。 */
  function authorOrModerator(req: FastifyRequest, viewer: MemberViewer, post: { authorId: string; topicId: string }, node: string, action: string): boolean {
    if (post.authorId === viewer.userId) return false;
    const categoryId = forum.topic(post.topicId)?.categoryId;
    if (!canModerate(req, viewer, node, categoryId)) throw forbidden(`只能${action}自己的帖子`);
    return true;
  }

  /**
   * 回复。成员直接发（需要持 forum.reply.create，#274 起登录但没有邀请码的注册用户没有这个节点，403 在限额判断
   * 之前就拦住，SPEC §3.11）；游客（没有有效 sid）另带昵称、PoW 与空的蜜罐字段，正文上限 2000 字，
   * 每个 IP（IPv6 按 /64）每分钟 5 次、每天 30 次，全站游客回复每小时 200 次。话题已关闭时只有持 forum.post.moderate 的人能回。
   */
  app.post<{ Body: ReplyBody }>("/api/forum/posts", async (req, reply) => {
    const viewer = await forumViewer(req);
    const { topicId, content, replyToPostId } = req.body;
    const topic = forum.topic(topicId);
    if (!topic) throw notFound("话题不存在");
    if (topic.closed && !canModerate(req, viewer, "forum.moderate.edit", topic.categoryId)) throw forbidden("话题已关闭，不能回复");
    if (replyToPostId && forum.post(replyToPostId)?.topicId !== topic.id) throw new ForumError(400, "invalid_reply_target", "被回复的帖子不在这个话题里");
    if (!content.trim()) throw new ForumError(400, "empty_content", "正文不能为空");

    if (viewer.kind === "member") {
      if (!req.server.services.permissions.check(viewer.accountId, "forum.reply.create")) throw forbidden("需要「发回复」权限");
      if (!forum.rateAllowed("reply", viewer.userId)) throw rateLimited();
      if (hourlyLimited(req, reply, "reply", viewer.accountId)) return;
      const ipResult = app.services.limits.hit({ bucket: "forum.reply.ip.hourly", subject: ipHash(req.ip), window: { ms: 60 * 60_000 }, max: REPLY_IP_HOURLY_MAX });
      if (!ipResult.ok) {
        return reply.code(429).header("Retry-After", String(ipResult.retry_after)).send({
          error: "rate_limited", bucket: "forum.reply.ip.hourly", message: "这个网络这小时的回复太多了，晚点再试", retry_after: ipResult.retry_after,
        });
      }
      const postId = forum.createPost({ topicId, authorId: viewer.userId, content, replyToPostId });
      forum.rateRecord("reply", viewer.userId);
      app.services.activity.recordActivity(req, { action: "forum.reply.create", surface: "forum", target_type: "post", target_id: postId, outcome: "ok" });
      return reply.code(201).send({ ...forumChanges(req, viewer, { posts: [postId], topics: [topicId] }, { posts: "full" }), postId });
    }

    if (!publicSubmission.checkHoneypot(req.body)) throw new ForumError(400, "request_rejected", "请求被拒绝");
    if (content.length > FORUM_LIMITS.guestContentMax) throw new ForumError(400, "content_too_long", `游客回复最多 ${FORUM_LIMITS.guestContentMax} 个字，登录后可以写更长`);
    const name = normalizeName(req.body.guest?.name ?? "");
    if (!name || name.length > FORUM_LIMITS.guestNameMax) throw new ForumError(400, "invalid_guest_name", `游客要填 1 到 ${FORUM_LIMITS.guestNameMax} 个字的昵称`);
    if (!isAllowedName(name)) throw new ForumError(400, "invalid_guest_name", NAME_RULE_MESSAGE);
    const subject = ipSubject(req.ip);
    const withinSiteLimit = () => {
      if (!forum.rateAllowed("guestPostSite", GUEST_POST_SITE_SUBJECT)) throw guestRepliesPaused();
    };
    if (!forum.rateAllowed("guestPost", subject)) throw rateLimited();
    withinSiteLimit();
    // PoW 的摘要输入是原样的正文（不去首尾空白），与前端计算时用的字符串一致。
    if (!publicSubmission.checkPow(`${topicId}:${content}`, req.body.pow).ok) throw new ForumError(400, "pow_invalid", "防滥用校验失败，请刷新页面重试");
    // PoW 通过后，每次尝试都占这个 IP 一次回复额度，不管后面是昵称被占、人机验证没过还是发出去了：
    // 昵称被占的回答会透露某个登录名登录过或有称号，这样探测和回复共用每分钟 5 次、每天 30 次，
    // 也分不出被占和没被占在额度上的差别。从上面的检查到这里没有 await，同一 IP 的并发请求挤不过上限。
    forum.rateRecord("guestPost", subject);
    if (forum.guestNameTaken(name)) throw new ForumError(400, "guest_name_taken", "这个昵称是成员在用的，换一个吧");
    if (!(await turnstile.verifyTurnstile(req.body.turnstileToken, req.ip))) throw new ForumError(400, "turnstile_failed", "人机验证失败，请刷新重试");
    // 等人机验证的时候可能有别的游客写进来：写入前再查一次全站上限，查、写、记之间没有 await。全站只记真正发出的回复。
    withinSiteLimit();
    const { guestId, postId } = forum.createGuestPost(name, { topicId, content, replyToPostId });
    forum.rateRecord("guestPostSite", GUEST_POST_SITE_SUBJECT);
    app.services.activity.recordActivity(req, { action: "forum.reply.create", surface: "forum", target_type: "post", target_id: postId, outcome: "ok", meta: { guest: true } });
    return reply.code(201).send({ ...forumChanges(req, viewer, { posts: [postId], topics: [topicId], users: [guestId] }, { posts: "full" }), postId });
  });

  app.patch<{ Params: PostParams; Body: { content: string } }>("/api/forum/posts/:post_id", async req => {
    const viewer = await requireMember(req);
    const post = existingPost(req.params.post_id);
    const moderated = authorOrModerator(req, viewer, post, "forum.moderate.edit", "编辑");
    assertNotDeleted(post);
    if (!req.body.content.trim()) throw new ForumError(400, "empty_content", "正文不能为空");
    forum.editPost(post.id, req.body.content);
    if (moderated) audit(config.consoleOrg, { login: viewer.login, account_id: viewer.accountId }, "forum.post.edit", post.id, { topic_id: post.topicId, author_id: post.authorId }, req.ip);
    return forumChanges(req, viewer, { posts: [post.id] }, { posts: "full" });
  });

  /** 软删除。话题的第一帖不能删；已经删掉的再删一次直接返回这条帖子现在的样子。 */
  app.delete<{ Params: PostParams }>("/api/forum/posts/:post_id", async req => {
    const viewer = await requireMember(req);
    const post = existingPost(req.params.post_id);
    const moderated = authorOrModerator(req, viewer, post, "forum.moderate.delete", "删除");
    if (post.deleted) return forumChanges(req, viewer, { posts: [post.id] }, { posts: "full" });
    if (forum.isFirstPost(post.id, post.topicId)) throw new ForumError(400, "first_post", "话题的第一帖不能删除");
    forum.deletePost(post.id);
    if (moderated) audit(config.consoleOrg, { login: viewer.login, account_id: viewer.accountId }, "forum.post.delete", post.id, { topic_id: post.topicId, author_id: post.authorId }, req.ip);
    return forumChanges(req, viewer, { posts: [post.id] }, { posts: "full" });
  });

  app.post<{ Params: PostParams }>("/api/forum/posts/:post_id/like", async req => {
    const viewer = await requireWriter(req, "forum.react");
    const post = existingPost(req.params.post_id);
    assertNotDeleted(post);
    forum.toggleLike(post.id, viewer.userId);
    return forumChanges(req, viewer, { posts: [post.id] });
  });

  app.post<{ Params: PostParams }>("/api/forum/posts/:post_id/bookmark", async req => {
    const viewer = await requireWriter(req, "forum.react");
    const post = existingPost(req.params.post_id);
    forum.toggleBookmark(viewer.userId, post.id);
    return forumChanges(req, viewer, { bookmarks: [post.id] });
  });
}
