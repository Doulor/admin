import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * 账号头像（#274 CONTRACT §2）：和 lib/forum-avatar.ts 的处理方式一样（解码、按 EXIF 摆正、居中裁正方形、
 * 重新编码 WebP、按内容 sha256 寻址），但尺寸（512×512）、接受的格式（多一个 GIF）不同，所以单独一份，
 * 不改 forum-avatar.ts——那是论坛（#57）自己的契约，不属于这次改动的范围。
 */
export const ACCOUNT_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const DECODED_FORMATS = new Set(["png", "jpeg", "webp", "gif"]);
export const ACCOUNT_AVATAR_BYTES_MAX = 2 * 1024 * 1024;
export const ACCOUNT_AVATAR_PIXELS_MAX = 4096 * 4096;
export const ACCOUNT_AVATAR_SIZE = 512;

export class AccountAvatarError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export async function processAccountAvatar(input: Buffer): Promise<{ hash: string; data: Buffer }> {
  let data: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: ACCOUNT_AVATAR_PIXELS_MAX, animated: false, failOn: "error" });
    const { format } = await image.metadata();
    if (!format || !DECODED_FORMATS.has(format)) throw new AccountAvatarError(400, "invalid_image", "头像只支持 PNG、JPEG、WebP、GIF 图片");
    data = await image
      .rotate()
      .resize(ACCOUNT_AVATAR_SIZE, ACCOUNT_AVATAR_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (cause) {
    if (cause instanceof AccountAvatarError) throw cause;
    if (/pixel limit/i.test((cause as Error)?.message ?? "")) throw new AccountAvatarError(400, "image_too_large", "图片尺寸太大，请换一张小一点的图");
    throw new AccountAvatarError(400, "invalid_image", "没能读出这张图片，请换一张 PNG、JPEG、WebP 或 GIF");
  }
  return { hash: createHash("sha256").update(data).digest("hex"), data };
}
