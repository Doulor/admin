import type { FastifyInstance } from "fastify";
import { notFound } from "./viewer.js";

const CACHE_KEY = "forum:stickers";
const CACHE_TTL_MS = 60_000;

/** 表情包（#276 CONTRACT §3）：公开列表 + 按内容哈希取图片。帖子正文里的短码渲染是前端的事（白名单来自这个列表）。 */
export default async function forumStickerRoutes(app: FastifyInstance) {
  const { forum, cache } = app.services;

  app.get("/api/forum/stickers", async () => cache.cached(CACHE_KEY, CACHE_TTL_MS, async () => ({ packs: forum.listStickerPacks() })));

  app.get<{ Params: { file: string } }>("/api/forum/stickers/:file", async (req, reply) => {
    const file = forum.stickerFile(req.params.file.slice(0, -".webp".length));
    if (!file) throw notFound("表情不存在");
    return reply
      .header("Content-Type", file.mime)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("Content-Security-Policy", "default-src 'none'")
      .send(file.bytes);
  });
}
