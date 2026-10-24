import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

/**
 * #276 论坛 v2 迁移：分类可见范围种子、表情包种子。只增不改所有者改过的数据——
 * `forum_category_settings` 按 `category_id` 幂等插入（已经有的不覆盖，控制台可能已经改过）；
 * 表情包/表情按 shortcode 幂等插入，图片按 sha256 去重。可以重复执行，第二次运行不改变任何行
 * （见 tests/server/forum.test.ts 「迁移跑两次不变」一类用例）。
 *
 * 回滚：本迁移只加表、加列、加行，不删旧表旧列旧行，回滚就是部署上一个镜像。
 */

export type ForumV2MigrationReport = {
  tables: { table: string; before: number; after: number }[];
  stickers_seeded_this_run: number;
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

const REPORT_TABLES = ["forum_category_settings", "forum_sticker_packs", "forum_stickers", "forum_sticker_files"];

export function runForumV2Migration(db: Database.Database, now: number, stickerAssetsDir: string): ForumV2MigrationReport {
  const before = Object.fromEntries(REPORT_TABLES.map(table => [table, tableCount(db, table)]));
  seedCategoryVisibility(db, now);
  const stickersSeeded = seedYugcStickers(db, now, stickerAssetsDir);
  const after = Object.fromEntries(REPORT_TABLES.map(table => [table, tableCount(db, table)]));
  return {
    tables: REPORT_TABLES.map(table => ({ table, before: before[table], after: after[table] })),
    stickers_seeded_this_run: stickersSeeded,
  };
}
