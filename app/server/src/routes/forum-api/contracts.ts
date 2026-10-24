import { integer, object, text, type RouteContracts } from "../../lib/http-contracts.js";
import { FORUM_LIMITS } from "../../lib/forum-rules.js";
import type { forumChanges } from "./viewer.js";

/**
 * `/api/forum/*` 的输入协议源（#57）。所有 body 都拒绝未知字段。编号是字符串（t73、p10001、body-73、m123、g4、n9），
 * 路径参数不叫 `:id`，因为公共校验会把 `:id` 强制成数字。长度按 UTF-16 计（与浏览器里 `String.length` 一致），
 * 去掉首尾空白后的判断在路由里做。
 */
/**
 * 输出协议（#145）。GET /api/forum/state 回 `{ state }`：整份 ForumState，加 `viewer`。
 * 写接口不再回整份状态，一律回 {@link ForumWriteResponse}：`changes` 里只有这次写入改动的记录（lib/forum-store.ts 的
 * ForumChanges，每条与 /state 里同一条完全一样，可见性也一样），前端 app/forum/shared/forum-api.ts 的 `parseWriteResult`
 * 按同一形状解析，按 id 并进手里的状态。POST /topics 另带 `topicId`、`postId`，POST /posts 另带 `postId`（这两个是 201，其余 200）。
 *
 * - POST /topics：新话题、首帖、话题用到的标签
 * - POST /posts：新帖子和它所在的话题（最后活动时间变了）；游客回复另带这次新建的游客用户
 * - PATCH、DELETE /posts/:post_id，POST /posts/:post_id/like：这条帖子
 * - POST /posts/:post_id/bookmark：自己对这条帖子的书签，取消了就在 `removed.bookmarks`
 * - POST /users/:forum_user_id/follow：这条关注，取消了就在 `removed.follows`
 * - POST /topics/:topic_id/pin、/close：这个话题
 * - POST /notifications/:notification_id/read：这条通知；/notifications/read-all：这次从未读变成已读的通知
 * - PATCH /me/profile、PUT 和 DELETE /me/avatar：只有下面这条
 *
 * 成员的回答总带自己的用户记录：每次请求都会刷新角色、称号和 GitHub 头像。别人收到的通知不在回答里。
 */
export type ForumWriteResponse = ReturnType<typeof forumChanges> & { topicId?: string; postId?: string };

export const TOPIC_ID_PATTERN = "^t[1-9][0-9]{0,8}$";
export const POST_ID_PATTERN = "^(?:p[1-9][0-9]{0,9}|body-[1-9][0-9]{0,8})$";
export const USER_ID_PATTERN = "^(?:m[1-9][0-9]{0,14}|g[1-9][0-9]{0,9}|u-[a-z0-9-]{1,32})$";
/** 表情 id 就是它的短码（forum-store.ts 的 createSticker），和 CONTRACT §8 的 shortcode 规则共用。 */
export const STICKER_ID_PATTERN = "^[a-z0-9][a-z0-9-]{1,39}$";
const pattern = (source: string) => ({ type: "string", pattern: source });
const flag = { type: "boolean" };
const topicParams = { params: object({ topic_id: pattern(TOPIC_ID_PATTERN) }, ["topic_id"]) };
const postParams = { params: object({ post_id: pattern(POST_ID_PATTERN) }, ["post_id"]) };
const reactionParams = { params: object({ post_id: pattern(POST_ID_PATTERN), sticker_id: pattern(STICKER_ID_PATTERN) }, ["post_id", "sticker_id"]) };

/**
 * 响应 Schema（宏观对齐要求：新增或修改的接口契约要声明 response）。写接口一律回通用的 ForumWriteResponse
 * （forumChanges()，字段多、随 keys/options 变化，和其余十几个既有写接口共用同一个没固定 Schema 的形状）——
 * 这里不单独为 PATCH visibility、POST /posts 另定一份，用最宽松的占位（只声明是对象，不限制字段），不会把
 * 任何字段裁掉；真正有确定形状的几个新接口（表情聚合、话题分页、表情包列表、上传结果）按真实形状声明。
 */
const writeResultShape = { type: "object", additionalProperties: true } as const;
const reactionSummary = object({
  stickerId: pattern(STICKER_ID_PATTERN), shortcode: pattern(STICKER_ID_PATTERN), url: text(200, 1), count: integer(0), mine: { type: "boolean" },
}, ["stickerId", "shortcode", "url", "count", "mine"]);
const reactionsResult = object({ reactions: { type: "array", items: reactionSummary } }, ["reactions"]);
const publicSticker = object({ id: pattern(STICKER_ID_PATTERN), shortcode: pattern(STICKER_ID_PATTERN), label: text(FORUM_LIMITS.stickerLabelMax, 1), url: text(200, 1) }, ["id", "shortcode", "label", "url"]);
const publicStickerPack = object({ id: text(40, 1), name: text(40, 1), stickers: { type: "array", items: publicSticker } }, ["id", "name", "stickers"]);
const stickersListResult = object({ packs: { type: "array", items: publicStickerPack } }, ["packs"]);
const topicView = object({
  id: pattern(TOPIC_ID_PATTERN), slug: text(200, 1), title: text(FORUM_LIMITS.titleMax, 1), categoryId: pattern("^[a-z0-9][a-z0-9-]{0,39}$"),
  tagIds: { type: "array", items: text(40, 1) }, authorId: text(60, 1), createdAt: integer(0), lastActivityAt: integer(0),
  views: integer(0), pinned: { type: "boolean" }, closed: { type: "boolean" }, visibility: { type: "string", enum: ["public", "registered", "member"] },
}, ["id", "slug", "title", "categoryId", "tagIds", "authorId", "createdAt", "lastActivityAt", "views", "pinned", "closed", "visibility"]);
const topicsPageResult = object({ topics: { type: "array", items: topicView }, nextCursor: { anyOf: [text(2000, 1), { type: "null" }] } }, ["topics", "nextCursor"]);
const uploadResult = object({ url: text(200, 1), width: integer(0), height: integer(0) }, ["url", "width", "height"]);
const suggestedUser = object({ username: text(FORUM_LIMITS.displayNameMax, 1), display_name: text(FORUM_LIMITS.displayNameMax, 1), avatar_url: { anyOf: [text(500, 1), { type: "null" }] } }, ["username", "display_name", "avatar_url"]);
const suggestResult = object({ users: { type: "array", items: suggestedUser } }, ["users"]);

export const forumContracts: RouteContracts = {
  "POST /api/forum/topics": {
    body: object({
      title: text(FORUM_LIMITS.titleMax, 1),
      categoryId: pattern("^[a-z0-9][a-z0-9-]{0,39}$"),
      tags: { type: "array", items: text(40, 1), maxItems: FORUM_LIMITS.tagsMax },
      content: text(FORUM_LIMITS.memberContentMax, 1),
    }, ["title", "categoryId", "content"]),
  },
  // #276 CONTRACT §2：去掉游客回帖，不再收 guest/pow/website(蜜罐)/turnstileToken。
  "POST /api/forum/posts": {
    body: object({
      topicId: pattern(TOPIC_ID_PATTERN),
      content: text(FORUM_LIMITS.memberContentMax, 1),
      replyToPostId: pattern(POST_ID_PATTERN),
    }, ["topicId", "content"]),
    response: { 201: writeResultShape },
  },
  "PATCH /api/forum/posts/:post_id": { ...postParams, body: object({ content: text(FORUM_LIMITS.memberContentMax, 1) }, ["content"]) },
  "DELETE /api/forum/posts/:post_id": postParams,
  "POST /api/forum/posts/:post_id/like": postParams,
  "POST /api/forum/posts/:post_id/bookmark": postParams,
  "PUT /api/forum/posts/:post_id/reactions/:sticker_id": { ...reactionParams, response: { 200: reactionsResult } },
  "DELETE /api/forum/posts/:post_id/reactions/:sticker_id": { ...reactionParams, response: { 200: reactionsResult } },
  "POST /api/forum/users/:forum_user_id/follow": { params: object({ forum_user_id: pattern(USER_ID_PATTERN) }, ["forum_user_id"]) },
  "GET /api/forum/users/suggest": { querystring: object({ q: text(FORUM_LIMITS.suggestQueryMax, 1) }, ["q"]), response: { 200: suggestResult } },
  "GET /api/forum/stickers": { response: { 200: stickersListResult } },
  "GET /api/forum/topics": { response: { 200: topicsPageResult } },
  "PUT /api/forum/uploads": { response: { 200: uploadResult } },
  "POST /api/forum/topics/:topic_id/pin": { ...topicParams, body: object({ pinned: flag }, ["pinned"]) },
  "POST /api/forum/topics/:topic_id/close": { ...topicParams, body: object({ closed: flag }, ["closed"]) },
  "POST /api/forum/topics/:topic_id/view": topicParams,
  // #276 CONTRACT §1：null 表示跟随分类，非 null 只能比分类更严（路由层/store 层再校验，这里只管形状）。
  "PATCH /api/forum/topics/:topic_id/visibility": {
    ...topicParams,
    body: object({ visibility: { type: ["string", "null"], enum: ["public", "registered", "member", null] } }, ["visibility"]),
    response: { 200: writeResultShape },
  },
  "POST /api/forum/notifications/:notification_id/read": { params: object({ notification_id: pattern("^n[1-9][0-9]{0,9}$") }, ["notification_id"]) },
  "PATCH /api/forum/me/profile": {
    body: {
      ...object({
        displayName: text(FORUM_LIMITS.displayNameMax, 1),
        bio: text(FORUM_LIMITS.bioMax),
        location: text(FORUM_LIMITS.locationMax),
        website: text(FORUM_LIMITS.websiteMax),
        notifyPrefs: object({ reply: flag, like: flag, follow: flag }),
      }),
      minProperties: 1,
    },
  },
  "GET /api/forum/avatars/:file": { params: object({ file: pattern("^[0-9a-f]{64}\\.webp$") }, ["file"]) },
  // 图片文件响应是 Buffer：Fastify 发 Buffer 时整段绕过 JSON Schema 序列化（lib/reply.js 的 payload.buffer
  // instanceof ArrayBuffer 分支直接进 onSend，不走序列化），占位 Schema 只为满足宏观对齐的声明要求，不会真的生效。
  "GET /api/forum/stickers/:file": { params: object({ file: pattern("^[0-9a-f]{64}\\.webp$") }, ["file"]), response: { 200: { type: "string" } } },
  "GET /api/forum/uploads/:file": { params: object({ file: pattern("^[0-9a-f]{64}\\.[a-z0-9]{1,8}$") }, ["file"]), response: { 200: { type: "string" } } },
};

const FIELD_LABELS: Record<string, string> = {
  title: "标题", categoryId: "分类", tags: "标签", content: "正文", topicId: "话题", replyToPostId: "被回复的帖子",
  displayName: "昵称", bio: "个人签名", location: "所在地", website: "个人网站", notifyPrefs: "通知设置",
  reply: "通知设置", like: "通知设置", follow: "通知设置", pinned: "置顶", closed: "关闭", visibility: "可见范围", q: "搜索词",
};

type SchemaError = { keyword: string; instancePath: string; params: Record<string, unknown> };

/** 校验失败时给中文说明（论坛前端直接弹出 message）。机器码仍是 validation_error。 */
export function forumValidationMessage(errors: SchemaError[], dataVar: string): string {
  const [first] = errors;
  if (!first) return "请求参数不对";
  if (dataVar === "params") return "链接里的编号不对";
  if (dataVar !== "body") return "请求参数不对";
  if (first.keyword === "additionalProperties") return `不认识的字段：${String(first.params.additionalProperty)}`;
  if (first.keyword === "minProperties") return "没有要修改的内容";
  const field = first.keyword === "required" ? String(first.params.missingProperty) : first.instancePath.split("/").filter(Boolean).filter(part => !/^\d+$/.test(part)).pop();
  const label = (field && FIELD_LABELS[field]) ?? "请求内容";
  switch (first.keyword) {
    case "required": return `缺少${label}`;
    case "minLength": return `${label}不能为空`;
    case "maxLength": return `${label}太长了，最多 ${String(first.params.limit)} 个字`;
    case "maxItems": return `${label}最多 ${String(first.params.limit)} 个`;
    default: return `${label}的格式不对`;
  }
}
