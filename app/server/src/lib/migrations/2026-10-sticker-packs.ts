import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";
import type { StickerManifest } from "../sticker-manifest.js";

/**
 * 内置表情包播种（#286）：照清单（lib/sticker-manifest.ts，由 scripts/sticker-manifest.mjs 生成）把库里没有的
 * 包、表情和图片补进去。只增不改、可以重复执行：
 *   - 包按 id 补：库里已经有这个 id 的包，名字、排序、启停一概不动（站长在控制台改过的就是改过的）；新包排在现有的包后面，启用；
 *   - 表情按 id（= 短码 `<包 id>-<表情 id>`）补：已经有的整行不碰（改名、排序、停用、换图都保留），没有的才插，
 *     插进已有的包里也一样排在那个包的最后，所以以后给老包加几张图，只会多出这几张；
 *   - 图片按内容 sha256 去重，哈希按文件真实内容现算，不信清单里写的值（清单落后于图片时，这张图只是不走 CDN）；
 *   - 清单里列了、目录里却没有的图片跳过，报告在 stickers_missing_files 里，不让启动失败，也不插半条记录。
 * 第二次运行不改变任何行。回滚就是部署上一个镜像：本迁移只加行，不删行。
 */
export type StickerSeedReport = {
  packs_seeded_this_run: number;
  stickers_seeded_this_run: number;
  stickers_missing_files: string[];
};

export function seedStickerPacks(db: Database.Database, now: number, assetsDir: string, manifest: StickerManifest): StickerSeedReport {
  const insertPack = db.prepare(
    "INSERT OR IGNORE INTO forum_sticker_packs(id, name, sort, enabled, created_at) VALUES (?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM forum_sticker_packs), 1, ?)",
  );
  const hasSticker = db.prepare("SELECT 1 FROM forum_stickers WHERE id = ?");
  const insertFile = db.prepare("INSERT OR IGNORE INTO forum_sticker_files(hash, mime, bytes, created_at) VALUES (?, 'image/webp', ?, ?)");
  const insertSticker = db.prepare(
    "INSERT OR IGNORE INTO forum_stickers(id, pack_id, shortcode, label, file_hash, sort, enabled) VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM forum_stickers WHERE pack_id = ?), 1)",
  );
  const report: StickerSeedReport = { packs_seeded_this_run: 0, stickers_seeded_this_run: 0, stickers_missing_files: [] };
  db.transaction(() => {
    for (const pack of manifest.packs) {
      report.packs_seeded_this_run += insertPack.run(pack.id, pack.name, now).changes;
      for (const sticker of pack.stickers) {
        const shortcode = `${pack.id}-${sticker.id}`;
        if (hasSticker.get(shortcode)) continue;
        let data: Buffer;
        try {
          data = readFileSync(join(assetsDir, pack.id, sticker.file));
        } catch {
          report.stickers_missing_files.push(`${pack.id}/${sticker.file}`);
          continue;
        }
        const hash = createHash("sha256").update(data).digest("hex");
        insertFile.run(hash, data, now);
        report.stickers_seeded_this_run += insertSticker.run(shortcode, pack.id, shortcode, sticker.label, hash, pack.id).changes;
      }
    }
  })();
  return report;
}
