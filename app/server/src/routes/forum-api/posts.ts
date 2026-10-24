import type { FastifyInstance, FastifyRequest } from "fastify";
import { ForumError, ipHash } from "../../lib/forum-rules.js";
import { assertVisible, canModerate, forbidden, forumChanges, notFound, rateLimited, requireMember, requireWriter, type MemberViewer } from "./viewer.js";
import { hourlyLimited } from "./forum-limits.js";

/** 同一 IP 上所有账号加起来，回帖每小时 200 次（SPEC §3.8），防止一个 IP 换着账号刷。只存哈希，不存原文。 */
const REPLY_IP_HOURLY_MAX = 200;

type PostParams = { post_id: string };
type ReactionParams = { post_id: string; sticker_id: string };
type ReplyBody = { topicId: string; content: string; replyToPostId?: string };

/** 回复（成员）、编辑、删除、点赞、收藏。#276 起不再有游客回复：去掉昵称、PoW、人机验证分支（CONTRACT-276 §2）。 */
export default async function forumPostRoutes(app: FastifyInstance) {
  const { forum } = app.services;

  /**
   * 帖子存在（可能已软删除，删掉的帖子不能再编辑或点赞，见 assertNotDeleted），而且看的人够得着它所在话题的可见范围：
   * 帖子编号是递增的，点赞、收藏、表情的回答会带回帖子摘要，不在这里拦就能逐个编号读到看不到的话题。
   */
  function existingPost(req: FastifyRequest, viewer: MemberViewer, postId: string) {
    const post = forum.post(postId);
    if (!post) throw notFound("帖子不存在");
    const topic = forum.topic(post.topicId);
    if (topic) assertVisible(req, viewer, topic.visibility);
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
   * 回复（#276 CONTRACT §2：去掉游客回帖，需要登录与 forum.reply.create，否则 401/403）：需要持
   * forum.reply.create（#274 起登录但没有邀请码的注册用户没有这个节点，403 在限额判断之前就拦住，SPEC §3.11）；
   * 每个 IP（IPv6 按 /64）每小时 200 次，全站不再分游客/成员。话题已关闭时只有持 forum.post.moderate 的人能回。
   */
  app.post<{ Body: ReplyBody }>("/api/forum/posts", async (req, reply) => {
    const viewer = await requireWriter(req, "forum.reply.create");
    const { topicId, content, replyToPostId } = req.body;
    const topic = forum.topic(topicId);
    if (!topic) throw notFound("话题不存在");
    assertVisible(req, viewer, topic.visibility);
    if (topic.closed && !canModerate(req, viewer, "forum.moderate.edit", topic.categoryId)) throw forbidden("话题已关闭，不能回复");
    if (replyToPostId && forum.post(replyToPostId)?.topicId !== topic.id) throw new ForumError(400, "invalid_reply_target", "被回复的帖子不在这个话题里");
    if (!content.trim()) throw new ForumError(400, "empty_content", "正文不能为空");

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
  });

  app.patch<{ Params: PostParams; Body: { content: string } }>("/api/forum/posts/:post_id", async req => {
    const viewer = await requireMember(req);
    const post = existingPost(req, viewer, req.params.post_id);
    const moderated = authorOrModerator(req, viewer, post, "forum.moderate.edit", "编辑");
    assertNotDeleted(post);
    if (!req.body.content.trim()) throw new ForumError(400, "empty_content", "正文不能为空");
    forum.editPost(post.id, req.body.content);
    if (moderated) app.services.activity.recordActivity(req, { action: "forum.post.edit", surface: "forum", target_type: "post", target_id: post.id, outcome: "ok", meta: { topic_id: post.topicId, author_id: post.authorId }, account_id: viewer.accountId });
    return forumChanges(req, viewer, { posts: [post.id] }, { posts: "full" });
  });

  /** 软删除。话题的第一帖不能删；已经删掉的再删一次直接返回这条帖子现在的样子。 */
  app.delete<{ Params: PostParams }>("/api/forum/posts/:post_id", async req => {
    const viewer = await requireMember(req);
    const post = existingPost(req, viewer, req.params.post_id);
    const moderated = authorOrModerator(req, viewer, post, "forum.moderate.delete", "删除");
    if (post.deleted) return forumChanges(req, viewer, { posts: [post.id] }, { posts: "full" });
    if (forum.isFirstPost(post.id, post.topicId)) throw new ForumError(400, "first_post", "话题的第一帖不能删除");
    forum.deletePost(post.id);
    if (moderated) app.services.activity.recordActivity(req, { action: "forum.post.delete", surface: "forum", target_type: "post", target_id: post.id, outcome: "ok", meta: { topic_id: post.topicId, author_id: post.authorId }, account_id: viewer.accountId });
    return forumChanges(req, viewer, { posts: [post.id] }, { posts: "full" });
  });

  app.post<{ Params: PostParams }>("/api/forum/posts/:post_id/like", async req => {
    const viewer = await requireWriter(req, "forum.react");
    const post = existingPost(req, viewer, req.params.post_id);
    assertNotDeleted(post);
    forum.toggleLike(post.id, viewer.userId);
    return forumChanges(req, viewer, { posts: [post.id] });
  });

  app.post<{ Params: PostParams }>("/api/forum/posts/:post_id/bookmark", async req => {
    const viewer = await requireWriter(req, "forum.react");
    const post = existingPost(req, viewer, req.params.post_id);
    forum.toggleBookmark(viewer.userId, post.id);
    return forumChanges(req, viewer, { bookmarks: [post.id] });
  });

  /** 表情回应（#276 CONTRACT §4）：需要 forum.react，限额 meta.limit.forum.react.hourly；回全量聚合，前端按 id 并进去。 */
  app.put<{ Params: ReactionParams }>("/api/forum/posts/:post_id/reactions/:sticker_id", async (req, reply) => {
    const viewer = await requireWriter(req, "forum.react");
    const post = existingPost(req, viewer, req.params.post_id);
    assertNotDeleted(post);
    const sticker = forum.stickerById(req.params.sticker_id);
    if (!sticker || sticker.enabled === 0) throw new ForumError(400, "unknown_sticker", "没有这个表情");
    if (hourlyLimited(req, reply, "react", viewer.accountId)) return;
    forum.addReaction(post.id, viewer.accountId, sticker.id);
    return { reactions: forum.reactionsForPost(post.id, viewer.userId) };
  });

  app.delete<{ Params: ReactionParams }>("/api/forum/posts/:post_id/reactions/:sticker_id", async req => {
    const viewer = await requireWriter(req, "forum.react");
    const post = existingPost(req, viewer, req.params.post_id);
    forum.removeReaction(post.id, viewer.accountId, req.params.sticker_id);
    return { reactions: forum.reactionsForPost(post.id, viewer.userId) };
  });
}
