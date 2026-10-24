import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

/**
 * #276 论坛 v2 迁移：分类可见范围种子、表情包种子。只增不改所有者改过的数据——
 * `forum_category_settings` 按 `category_id` 幂等插入（已经有的不覆盖，控制台可能已经改过）；
 * 表情包/表情按 shortcode 幂等插入，图片按 sha256 去重；2026-10-25 第一套里 15 张换成带小字的图，
 * 库里还是原图的才换（`recaptionYugcStickers`）。可以重复执行，第二次运行不改变任何行
 * （见 tests/server/forum.test.ts 「迁移跑两次不变」一类用例）。
 *
 * 回滚：本迁移只加表、加列、加行，不删旧表旧列旧行，回滚就是部署上一个镜像。
 */

export type ForumV2MigrationReport = {
  tables: { table: string; before: number; after: number }[];
  stickers_seeded_this_run: number;
  stickers_recaptioned_this_run: number;
};

function tableCount(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

/**
 * 分类默认的可见范围（SPEC §5「分级可见」，所有者 2026-10-24 交接时告知的初始值，控制台可以改）：
 * 公开——招新与机试、竞赛与项目、人工智能；注册可见——课程与作业、求职与升学；成员可见——班级公告。
 * 这里按固定 id 种子，不依赖 app/forum/content/curation.json 实际有没有这些分类：某个环境的分类集合
 * 和这份清单不完全一致时，多出来的设置行不会被任何查询用到（EFFECTIVE_VISIBILITY_EXPR 按 category_id
 * 联接，联不上的分类按 'public' 兜底），缺的分类等那个分类真的存在时由控制台手动设置。
 */
export const CATEGORY_VISIBILITY_SEED: { categoryId: string; visibility: "public" | "registered" | "member" }[] = [
  { categoryId: "c-exam", visibility: "public" },
  { categoryId: "c-competitions", visibility: "public" },
  { categoryId: "c-ai", visibility: "public" },
  { categoryId: "c-courses", visibility: "registered" },
  { categoryId: "c-careers", visibility: "registered" },
  { categoryId: "c-announcements", visibility: "member" },
];

export function seedCategoryVisibility(db: Database.Database, now: number): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO forum_category_settings(category_id, visibility, updated_at, updated_by) VALUES (?, ?, ?, 'migration:2026-10-forum-v2')",
  );
  const tx = db.transaction(() => {
    for (const row of CATEGORY_VISIBILITY_SEED) insert.run(row.categoryId, row.visibility, now);
  });
  tx();
}

/** 第一套「极客娘」表情（CONTRACT §3），短码固定是 `yugc-<code>`，排序就是这份清单的顺序。 */
export const YUGC_STICKER_PACK_ID = "yugc";
export const YUGC_STICKERS: { code: string; label: string }[] = [
  { code: "wave", label: "打招呼" }, { code: "thumbsup", label: "点赞" }, { code: "heart", label: "比心" },
  { code: "confused", label: "疑惑" }, { code: "shocked", label: "震惊" }, { code: "cry", label: "哭哭" },
  { code: "happy", label: "开心" }, { code: "angry", label: "生气" }, { code: "sleepy", label: "困了" },
  { code: "cheer", label: "加油" }, { code: "thanks", label: "谢谢" }, { code: "hug", label: "抱抱" },
  { code: "think", label: "思考" }, { code: "smirk", label: "坏笑" }, { code: "shy", label: "害羞" },
  { code: "proud", label: "得意" }, { code: "speechless", label: "无语" }, { code: "popcorn", label: "吃瓜" },
  { code: "coding", label: "敲代码" }, { code: "debug", label: "debug" }, { code: "merged", label: "合并了" },
  { code: "go", label: "冲" }, { code: "goodnight", label: "晚安" }, { code: "roger", label: "收到" },
];

/**
 * 种进 forum_sticker_packs/forum_stickers/forum_sticker_files：图片按 sha256 去重，表情按 shortcode 幂等。
 * 文件缺失（例如测试换了一个没放全 24 张的目录）不让启动失败——跳过那一个，返回这次真正种进去的数量，
 * 调用方/测试据此知道是不是种全了。
 */
export function seedYugcStickers(db: Database.Database, now: number, assetsDir: string): number {
  db.prepare("INSERT OR IGNORE INTO forum_sticker_packs(id, name, sort, enabled, created_at) VALUES (?, '极客娘', 0, 1, ?)").run(YUGC_STICKER_PACK_ID, now);
  const insertFile = db.prepare("INSERT OR IGNORE INTO forum_sticker_files(hash, mime, bytes, created_at) VALUES (?, 'image/webp', ?, ?)");
  const insertSticker = db.prepare(
    "INSERT OR IGNORE INTO forum_stickers(id, pack_id, shortcode, label, file_hash, sort, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)",
  );
  let seeded = 0;
  const tx = db.transaction(() => {
    YUGC_STICKERS.forEach((item, index) => {
      const shortcode = `${YUGC_STICKER_PACK_ID}-${item.code}`;
      let data: Buffer;
      try {
        data = readFileSync(join(assetsDir, `${item.code}.webp`));
      } catch {
        return; // 文件缺失不阻塞启动，报告里的 stickers_seeded_this_run 会比 24 少，提示有缺口
      }
      const hash = createHash("sha256").update(data).digest("hex");
      insertFile.run(hash, data, now);
      const result = insertSticker.run(shortcode, YUGC_STICKER_PACK_ID, shortcode, item.label, hash, index);
      seeded += result.changes;
    });
  });
  tx();
  return seeded;
}

/**
 * 第一套「极客娘」里 15 张原图的 sha256（2026-10-25 换成带小字的版本，#276，所有者「他们的表情包都是带点小文字的
 * 看着更可爱一点」）。库里这张表情还指着原图的，换成仓库里现在的图；管理员自己换过图的（哈希对不上）不动。
 * 原图的文件行留着：页面缓存里的旧地址照样能打开。
 */
export const YUGC_UNCAPTIONED: Record<string, string> = {
  wave: "8d421f54cca80e1b2b0fe929211d0d721d75691a1d7b811f7de760203b5c439c",
  thumbsup: "b31c83ecaed5408371494decd3f57e1ed696304415e18be76821d3a544fb7db8",
  confused: "78da33f1a055c6b04f4a566882d4e9e3091ef6e3fa479558c54c2d0e1f86b6f7",
  shocked: "d5338c82b6fe7c430c99de14ad9b472d4976f4d76a152eaba305084b340134ad",
  sleepy: "634d3faed00b3746b594c58e6962108ce19737981cb8586adaa8fcf1f192c4b1",
  cheer: "f905e91ca9847888621cf714c951ed980af6babc245d8df4913c1e23a83e1c4f",
  thanks: "98d14c49567bf0f56e693dedc2a11e6ded5b81dfd7040719cc8185d4d1c8187b",
  think: "8c79fb7310370d8bccb59d8a9cf6e88dcde8c6ad773476eb58bf92b50831ecbb",
  smirk: "25bc916aa256b9001e2c09fe185c60ebb7421093dc7c08afbbd4072e1df52792",
  proud: "76bfcc905b3bdab5c9d4700cffe371356e0048e257565fce684de844b08737fc",
  speechless: "3cb68a476fb7caa60afa39f522a36a3bbe8ae383d5687fbfc20ea03e4f16660e",
  merged: "4e1a1f35ab3af7704e278d85a93122b35fcfeb0e5f25d71158ab940fafd5f522",
  go: "98340ed718cfb75d248414dc28903e0e0644193a735da0ce827aaf2bd8148241",
  goodnight: "b08cfaa8cbc4e4d75f98c6f5d9fa8cb247d2bd304b59498ece22370826ba5520",
  roger: "90108616d7be531e4816502e113b2dd07c711955864f1a67b8ad67bb9935a0ea",
};

export function recaptionYugcStickers(db: Database.Database, now: number, assetsDir: string): number {
  const insertFile = db.prepare("INSERT OR IGNORE INTO forum_sticker_files(hash, mime, bytes, created_at) VALUES (?, 'image/webp', ?, ?)");
  const swap = db.prepare("UPDATE forum_stickers SET file_hash = ? WHERE id = ? AND file_hash = ?");
  let swapped = 0;
  db.transaction(() => {
    for (const [code, oldHash] of Object.entries(YUGC_UNCAPTIONED)) {
      let data: Buffer;
      try {
        data = readFileSync(join(assetsDir, `${code}.webp`));
      } catch {
        continue;
      }
      const hash = createHash("sha256").update(data).digest("hex");
      if (hash === oldHash) continue;
      const shortcode = `${YUGC_STICKER_PACK_ID}-${code}`;
      if (!db.prepare("SELECT 1 FROM forum_stickers WHERE id = ? AND file_hash = ?").get(shortcode, oldHash)) continue;
      insertFile.run(hash, data, now);
      swapped += swap.run(hash, shortcode, oldHash).changes;
    }
  })();
  return swapped;
}

const REPORT_TABLES = ["forum_category_settings", "forum_sticker_packs", "forum_stickers", "forum_sticker_files"];

export function runForumV2Migration(db: Database.Database, now: number, stickerAssetsDir: string): ForumV2MigrationReport {
  const before = Object.fromEntries(REPORT_TABLES.map(table => [table, tableCount(db, table)]));
  seedCategoryVisibility(db, now);
  const stickersSeeded = seedYugcStickers(db, now, stickerAssetsDir);
  const stickersRecaptioned = recaptionYugcStickers(db, now, stickerAssetsDir);
  const after = Object.fromEntries(REPORT_TABLES.map(table => [table, tableCount(db, table)]));
  return {
    tables: REPORT_TABLES.map(table => ({ table, before: before[table], after: after[table] })),
    stickers_seeded_this_run: stickersSeeded,
    stickers_recaptioned_this_run: stickersRecaptioned,
  };
}
