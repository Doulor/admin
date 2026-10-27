import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { forumLlmsTxt, forumTopicMarkdown, type ForumMarkdownSite } from "../../lib/forum-markdown.js";
import { FORUM_REQUEST_LIMITS, allowedVisibilities, ipSubject } from "../../lib/forum-rules.js";
import { assertVisible, forumViewer, levelOf, notFound } from "./viewer.js";
import { levelRateLimited } from "./forum-limits.js";

type TopicParams = { topic_id: string };
type PublishedParams = { file: string };
const PUBLISHED_FILE = /^[a-f0-9]{16}\.webp$/;

const perIp = (limit: { max: number; timeWindow: number }) => ({
  config: { rateLimit: { ...limit, keyGenerator: (req: FastifyRequest) => ipSubject(req.ip) } },
});

const dynamic = (reply: FastifyReply, type: string) => reply
  .header("Content-Type", `${type}; charset=utf-8`)
  .header("Cache-Control", "private, no-store")
  .header("X-Content-Type-Options", "nosniff");

/** 对外 `/forum/*` 文档与旧帖图片：和网页 state 共用 viewer、权限引擎与 forum-store。 */
export default async function forumMarkdownRoutes(app: FastifyInstance) {
  const { forum, config } = app.services;
  const site: ForumMarkdownSite = {
    siteName: "极客班论坛",
    origin: config.publicOrigin,
    basePath: "/forum/",
    notice: "内容来自核心论坛数据库；索引、正文与附件都按本次请求的当前身份过滤。",
  };

  app.get("/forum/llms.txt", { ...perIp(FORUM_REQUEST_LIMITS.state) }, async (req, reply) => {
    const viewer = await forumViewer(req);
    if (levelRateLimited(req, reply, "read")) return;
    const level = levelOf(app.services.permissions, viewer.accountId);
    return dynamic(reply, "text/plain").send(forumLlmsTxt(forum.state(viewer.userId, level), site));
  });

  app.get<{ Params: TopicParams }>("/forum/t/:topic_id.md", { ...perIp(FORUM_REQUEST_LIMITS.topicPosts) }, async (req, reply) => {
    const viewer = await forumViewer(req);
    if (levelRateLimited(req, reply, "read")) return;
    const topic = forum.topic(req.params.topic_id);
    if (!topic) throw notFound("话题不存在");
    assertVisible(req, viewer, topic.visibility);
    const level = levelOf(app.services.permissions, viewer.accountId);
    const state = forum.state(viewer.userId, level);
    const markdown = forumTopicMarkdown({ ...state, posts: forum.topicPosts(topic.id, viewer.userId) }, topic.id, site);
    if (markdown === null) throw notFound("话题不存在");
    return dynamic(reply, "text/markdown").send(markdown);
  });

  app.get<{ Params: PublishedParams }>("/forum/published/:file", async (req, reply) => {
    if (!PUBLISHED_FILE.test(req.params.file)) throw notFound("图片不存在");
    const viewer = await forumViewer(req);
    const visibility = forum.publishedAssetVisibility(req.params.file);
    const level = levelOf(app.services.permissions, viewer.accountId);
    // 附件地址不透露它是否存在于别的身份可见的话题里；正文直链仍按 401/403 解释所需身份。
    if (!visibility || !allowedVisibilities(level).includes(visibility)) throw notFound("图片不存在");
    let body: Buffer;
    try {
      body = await readFile(join(config.forumPublishedDir, req.params.file));
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw notFound("图片不存在");
      throw error;
    }
    return reply
      .header("Content-Type", "image/webp")
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .send(body);
  });
}
