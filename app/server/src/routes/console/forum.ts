import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { processAvatar, AVATAR_TYPES } from "../../lib/forum-avatar.js";
import { ForumError } from "../../lib/forum-rules.js";

type CategoryParams = { id: string };
type StickerParams = { id: string };
type StickerUploadParams = { id: string };
type StickerUploadQuery = { shortcode: string; label: string };

/** 控制台「论坛管理」（CONTRACT-276 §8）：分类可见范围、表情包/表情的查看与维护。所有写操作需要 step-up。 */
export default async function consoleForumRoutes(app: FastifyInstance) {
  const { forum } = app.services;
  app.addHook("preHandler", requireAuth);

  app.get("/api/console/forum/categories", { preHandler: requirePermission("forum.category.manage") }, async () => ({
    categories: forum.consoleCategories().map(({ id, name, visibility, topicCount }) => ({ id, name, visibility, topic_count: topicCount })),
  }));

  app.patch<{ Params: CategoryParams; Body: { visibility: "public" | "registered" | "member" } }>(
    "/api/console/forum/categories/:id",
    { preHandler: [requirePermission("forum.category.manage"), requireStepUp] },
    async (req, reply) => {
      if (!forum.hasCategory(req.params.id)) return reply.code(404).send({ error: "not_found", message: "没有这个分类" });
      forum.setCategoryVisibility(req.params.id, req.body.visibility, req.session!.account_id);
      app.services.activity.recordActivity(req, {
        action: "forum.category.visibility", surface: "console", target_type: "category", target_id: req.params.id,
        outcome: "ok", meta: { visibility: req.body.visibility },
      });
      return { id: req.params.id, visibility: req.body.visibility };
    },
  );

  app.get("/api/console/forum/stickers", { preHandler: requirePermission("forum.sticker.manage") }, async () => ({
    packs: forum.consoleStickerPacks().map(pack => ({
      id: pack.id, name: pack.name, sort: pack.sort, enabled: pack.enabled,
      stickers: pack.stickers.map(sticker => ({
        id: sticker.id, shortcode: sticker.shortcode, label: sticker.label, url: sticker.url, sort: sticker.sort, enabled: sticker.enabled, use_count: sticker.useCount,
      })),
    })),
  }));

  /** 新建一个空表情包（#276）：id 之后当这个包里表情短码的前缀，定了不能改；重复回 409。 */
  app.post<{ Body: { id: string; name: string } }>(
    "/api/console/forum/sticker-packs",
    { preHandler: [requirePermission("forum.sticker.manage"), requireStepUp] },
    async (req, reply) => {
      if (!forum.createStickerPack(req.body.id, req.body.name.trim())) return reply.code(409).send({ error: "pack_id_taken", message: "这个表情包 id 已经被用过了" });
      app.services.cache.invalidate("forum:stickers");
      app.services.activity.recordActivity(req, { action: "forum.sticker_pack.create", surface: "console", target_type: "sticker_pack", target_id: req.body.id, outcome: "ok", meta: { name: req.body.name.trim() } });
      return reply.code(201).send({ id: req.body.id, name: req.body.name.trim() });
    },
  );

  app.patch<{ Params: StickerParams; Body: { name?: string; sort?: number; enabled?: boolean } }>(
    "/api/console/forum/sticker-packs/:id",
    { preHandler: [requirePermission("forum.sticker.manage"), requireStepUp] },
    async (req, reply) => {
      if (!forum.updateStickerPack(req.params.id, req.body)) return reply.code(404).send({ error: "not_found", message: "没有这个表情包" });
      app.services.cache.invalidate("forum:stickers");
      app.services.activity.recordActivity(req, { action: "forum.sticker_pack.update", surface: "console", target_type: "sticker_pack", target_id: req.params.id, outcome: "ok", meta: req.body });
      return { ok: true };
    },
  );

  app.patch<{ Params: StickerParams; Body: { label?: string; sort?: number; enabled?: boolean } }>(
    "/api/console/forum/stickers/:id",
    { preHandler: [requirePermission("forum.sticker.manage"), requireStepUp] },
    async (req, reply) => {
      if (!forum.updateSticker(req.params.id, req.body)) return reply.code(404).send({ error: "not_found", message: "没有这个表情" });
      app.services.cache.invalidate("forum:stickers");
      app.services.activity.recordActivity(req, { action: "forum.sticker.update", surface: "console", target_type: "sticker", target_id: req.params.id, outcome: "ok", meta: req.body });
      return { ok: true };
    },
  );

  /** 新增一个表情（CONTRACT §8）：请求体是图片本身（同头像处理，转 256px webp），shortcode 重复 409。 */
  await app.register(async uploadApp => {
    uploadApp.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: 2 * 1024 * 1024 }, (_req, body, done) => done(null, body));
    const tooLarge = (error: { code?: string }, _req: FastifyRequest, reply: FastifyReply) => {
      if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.code(413).send({ error: "sticker_too_large", message: "表情图片不能超过 2MB" });
      throw error;
    };
    uploadApp.put<{ Params: StickerUploadParams; Querystring: StickerUploadQuery }>(
      "/api/console/forum/sticker-packs/:id/stickers",
      { preHandler: [requirePermission("forum.sticker.manage"), requireStepUp], errorHandler: tooLarge },
      async (req, reply) => {
        const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        if (!(AVATAR_TYPES as readonly string[]).includes(type) || !Buffer.isBuffer(req.body)) {
          throw new ForumError(415, "unsupported_media_type", "表情图片只支持 PNG、JPEG、WebP");
        }
        const shortcode = req.query.shortcode;
        // 表情 id 就是它的短码（forum-store.ts 的 createSticker），stickerById 不按 enabled 过滤，
        // 停用的旧表情占着的短码也挡得住，不会撞上 UNIQUE 约束变成裸的 500。
        if (forum.stickerById(shortcode)) return reply.code(409).send({ error: "shortcode_taken", message: "这个短码已经被用过了" });
        const { hash, data } = await processAvatar(req.body);
        const createdId = forum.createSticker(req.params.id, shortcode, req.query.label, hash, "image/webp", data);
        if (!createdId) return reply.code(404).send({ error: "not_found", message: "没有这个表情包" });
        app.services.cache.invalidate("forum:stickers");
        app.services.activity.recordActivity(req, { action: "forum.sticker.create", surface: "console", target_type: "sticker", target_id: createdId, outcome: "ok", meta: { pack_id: req.params.id } });
        return reply.code(201).send({ id: createdId, shortcode, label: req.query.label });
      },
    );
  });
}
