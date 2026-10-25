import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FORUM_LIMITS } from "./forum-rules.js";

/**
 * 内置表情包的清单（#286）：`app/server/assets/stickers/manifest.json`，由 `scripts/sticker-manifest.mjs`
 * 从各包目录里手写的 pack.json 和图片生成；server 镜像把整个 stickers/ 目录复制到同样的相对位置（app/server/Dockerfile）。
 * 启动时读一次：迁移据此把没有的包和表情补进库（migrations/2026-10-sticker-packs.ts），
 * 接口据此决定哪些图片可以走 CDN（`createStickerUrl`）。
 *
 * 清单文件不存在算没有内置表情包（测试与本机可以指向别的目录，已有的库照常用）；
 * 存在但读不出来、形状不对就抛错，让服务启动失败，而不是带着一份不知道对不对的清单上线。
 */

export type StickerManifestSticker = { id: string; label: string; file: string; sha256: string; size: number; key: string };
export type StickerManifestPack = { id: string; name: string; stickers: StickerManifestSticker[] };
export type StickerManifest = { version: 1; packs: StickerManifestPack[] };

export const STICKER_MANIFEST_FILE = "manifest.json";
/** 对象键在 STATIC_CDN_BASE 之后的前缀；键就是 `forum/stickers/<图片内容 sha256>.webp`，与 scripts/sticker-manifest.mjs 一致。 */
export const STICKER_KEY_PREFIX = "forum/stickers/";
const PACK_ID = /^[a-z0-9][a-z0-9-]{0,19}$/;
const STICKER_ID = /^[a-z0-9][a-z0-9-]{0,18}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\.webp$/;
const PACK_NAME_MAX = 40;

class StickerManifestError extends Error {}
const fail = (message: string): never => { throw new StickerManifestError(`sticker manifest: ${message}`); };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const plainText = (value: unknown, max: number): value is string => typeof value === "string" && value.length >= 1 && value.length <= max;

function parseSticker(packId: string, value: unknown): StickerManifestSticker {
  if (!isRecord(value)) return fail(`${packId}: a sticker is not an object`);
  const { id, label, file, sha256, size, key } = value;
  if (typeof id !== "string" || !STICKER_ID.test(id)) return fail(`${packId}: invalid sticker id`);
  const at = `${packId}-${id}`;
  if (!FORUM_LIMITS.stickerShortcodePattern.test(at)) return fail(`${at}: invalid shortcode`);
  if (!plainText(label, FORUM_LIMITS.stickerLabelMax)) return fail(`${at}: invalid label`);
  if (typeof file !== "string" || !FILE_NAME.test(file)) return fail(`${at}: invalid file`);
  if (typeof sha256 !== "string" || !SHA256.test(sha256)) return fail(`${at}: invalid sha256`);
  if (!Number.isInteger(size) || (size as number) <= 0) return fail(`${at}: invalid size`);
  if (key !== `${STICKER_KEY_PREFIX}${sha256}.webp`) return fail(`${at}: key must be ${STICKER_KEY_PREFIX}<sha256>.webp`);
  return { id, label, file, sha256, size: size as number, key };
}

/** 读清单；文件不存在返回空清单，存在但不对抛错。同一个短码、同一个包 id 出现两次也算不对。 */
export function loadStickerManifest(assetsDir: string): StickerManifest {
  let text: string;
  try {
    text = readFileSync(join(assetsDir, STICKER_MANIFEST_FILE), "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, packs: [] };
    return fail(`cannot read (${(cause as Error).message})`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return fail(`not JSON (${(cause as Error).message})`);
  }
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.packs)) return fail("unsupported shape");
  const packIds = new Set<string>();
  const shortcodes = new Set<string>();
  const packs = raw.packs.map((item): StickerManifestPack => {
    if (!isRecord(item) || typeof item.id !== "string" || !PACK_ID.test(item.id)) return fail("invalid pack id");
    if (packIds.has(item.id)) return fail(`${item.id}: pack listed twice`);
    packIds.add(item.id);
    if (!plainText(item.name, PACK_NAME_MAX)) return fail(`${item.id}: invalid pack name`);
    if (!Array.isArray(item.stickers) || item.stickers.length === 0) return fail(`${item.id}: no stickers`);
    const stickers = item.stickers.map(sticker => parseSticker(item.id as string, sticker));
    for (const sticker of stickers) {
      const shortcode = `${item.id}-${sticker.id}`;
      if (shortcodes.has(shortcode)) return fail(`${shortcode}: shortcode listed twice`);
      shortcodes.add(shortcode);
    }
    return { id: item.id, name: item.name, stickers };
  });
  return { version: 1, packs };
}

/** 表情的同源图片地址：按内容哈希，永久缓存（routes/forum-api/stickers.ts）。 */
export const stickerSameOriginUrl = (hash: string): string => `/api/forum/stickers/${hash}.webp`;

/**
 * 一张表情图片的地址（#286）：CDN 开关打开（`cdnBase` 非空）且这张图是仓库内置素材（内容哈希在清单里）→
 * CDN 绝对地址 `<cdnBase>forum/stickers/<hash>.webp`；开关关闭，或者图片是站长在控制台上传的、
 * 不在清单里（CDN 上没有它）→ 同源地址。清单里的哈希与库里 `forum_sticker_files.hash` 是同一种 sha256，
 * 所以只要内容一样，哪个包的哪个表情都走同一个对象。
 */
export function createStickerUrl(options: { cdnBase: string; manifest: StickerManifest }): (hash: string) => string {
  const keys = new Map<string, string>();
  for (const pack of options.manifest.packs) for (const sticker of pack.stickers) keys.set(sticker.sha256, sticker.key);
  return (hash: string) => {
    const key = options.cdnBase ? keys.get(hash) : undefined;
    return key ? `${options.cdnBase}${key}` : stickerSameOriginUrl(hash);
  };
}
