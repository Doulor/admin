import { describe, expect, it } from 'vitest';
import { STATIC_CDN_BASE } from '../../scripts/static-cdn-base.mjs';
import { stickerCdnUrl } from '../../scripts/sticker-manifest.mjs';
import { STICKER_KEY_PREFIX as SERVER_KEY_PREFIX, createStickerUrl, loadStickerManifest, stickerSameOriginUrl } from '../../app/server/src/lib/sticker-manifest';
import { STICKER_CDN_PREFIX, STICKER_SAME_ORIGIN_PREFIX, isStickerUrl, stickerHash } from '../../app/forum/shared/sticker-url';

// 论坛前端对表情图片地址的白名单（app/forum/shared/sticker-url.ts，#286）是写死的两个前缀；服务端给出的地址、
// 上传脚本列出的 CDN 地址都要被它认。三边任何一边改了前缀或哈希写法，这里先红。
describe('forum front-end whitelist equals what the server and the upload script produce', () => {
  const manifest = loadStickerManifest(new URL('../../app/server/assets/stickers', import.meta.url).pathname);
  const stickers = manifest.packs.flatMap(pack => pack.stickers);

  it('names the same two prefixes', () => {
    expect(STICKER_CDN_PREFIX).toBe(`${STATIC_CDN_BASE}${SERVER_KEY_PREFIX}`);
    expect(STICKER_SAME_ORIGIN_PREFIX).toBe(stickerSameOriginUrl('').slice(0, -'.webp'.length));
  });

  it('takes every address the server can give for a built-in sticker, switch off and on, and the address the upload script lists', () => {
    expect(stickers.length).toBeGreaterThan(0);
    const off = createStickerUrl({ cdnBase: '', manifest });
    const on = createStickerUrl({ cdnBase: STATIC_CDN_BASE, manifest });
    for (const sticker of stickers) {
      expect(isStickerUrl(off(sticker.sha256)), sticker.key).toBe(true);
      expect(isStickerUrl(on(sticker.sha256)), sticker.key).toBe(true);
      expect(on(sticker.sha256)).toBe(stickerCdnUrl(sticker));
      expect(stickerHash(off(sticker.sha256))).toBe(sticker.sha256);
      expect(stickerHash(on(sticker.sha256))).toBe(sticker.sha256);
    }
    // 站长上传的表情（不在清单里）开关打开时仍是同源地址，前端同样认。
    expect(isStickerUrl(on('9'.repeat(64)))).toBe(true);
    expect(on('9'.repeat(64)).startsWith('/api/forum/stickers/')).toBe(true);
  });
});

