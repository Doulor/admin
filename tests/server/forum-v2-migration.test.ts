import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../app/server/src/lib/db';
import { CATEGORY_VISIBILITY_SEED, runForumV2Migration, YUGC_STICKERS, YUGC_STICKER_PACK_ID, YUGC_UNCAPTIONED } from '../../app/server/src/lib/migrations/2026-10-forum-v2';

/**
 * #276 论坛 v2 迁移（分类可见范围种子、表情包种子）。`createDatabase(':memory:')` 在构造时已经跑过一次
 * （db.ts 的 `forumV2Migration` 常量），这里测的是：种子的形状对不对、按 category_id/shortcode 幂等、
 * 控制台改过的设置不被覆盖，以及——最关键的——重跑一遍是不是真的零变化。对预发布库真实数据跑两遍、
 * 核对行数表另见执行记录（.tools/handoff 之外不留真实数据），这里只测脚本本身的逻辑。
 */
function makeStorage() {
  return createDatabase(':memory:');
}

describe('分类可见范围种子', () => {
  it('按 CATEGORY_VISIBILITY_SEED 写满 forum_category_settings', () => {
    const { db } = makeStorage();
    const rows = db.prepare('SELECT category_id, visibility FROM forum_category_settings ORDER BY category_id').all();
    expect(rows).toHaveLength(CATEGORY_VISIBILITY_SEED.length);
    const row = db.prepare("SELECT visibility FROM forum_category_settings WHERE category_id = 'c-announcements'").get();
    expect(row).toEqual({ visibility: 'member' });
  });

  it('不覆盖控制台已经改过的设置', () => {
    const { db } = makeStorage();
    db.prepare("UPDATE forum_category_settings SET visibility = 'member', updated_by = 'console' WHERE category_id = 'c-ai'").run();
    runForumV2Migration(db, Date.now(), 'app/server/assets/stickers/yugc');
    expect(db.prepare("SELECT visibility, updated_by FROM forum_category_settings WHERE category_id = 'c-ai'").get())
      .toEqual({ visibility: 'member', updated_by: 'console' });
  });
});

describe('表情包种子', () => {
  it('种出 24 个表情，shortcode 都带 yugc- 前缀，图片按内容去重', () => {
    const { db } = makeStorage();
    const stickers = db.prepare('SELECT shortcode FROM forum_stickers ORDER BY shortcode').all() as { shortcode: string }[];
    expect(stickers).toHaveLength(YUGC_STICKERS.length);
    expect(stickers.every(row => row.shortcode.startsWith('yugc-'))).toBe(true);
    const pack = db.prepare('SELECT id FROM forum_sticker_packs WHERE id = ?').get(YUGC_STICKER_PACK_ID);
    expect(pack).toEqual({ id: YUGC_STICKER_PACK_ID });
    // 文件按 sha256 去重：不同表情码共用同一张图时，forum_sticker_files 的行数不必等于表情数，
    // 但每一行的 hash 都必须是真实 32 字节 sha256 的十六进制。
    const files = db.prepare('SELECT hash FROM forum_sticker_files').all() as { hash: string }[];
    expect(files.length).toBeGreaterThan(0);
    expect(files.every(row => /^[0-9a-f]{64}$/.test(row.hash))).toBe(true);
  });

  it('第二次运行不再新增或修改任何行（幂等）', () => {
    const { db } = makeStorage();
    const before = {
      categories: (db.prepare('SELECT COUNT(*) AS n FROM forum_category_settings').get() as { n: number }).n,
      packs: (db.prepare('SELECT COUNT(*) AS n FROM forum_sticker_packs').get() as { n: number }).n,
      stickers: (db.prepare('SELECT COUNT(*) AS n FROM forum_stickers').get() as { n: number }).n,
      files: (db.prepare('SELECT COUNT(*) AS n FROM forum_sticker_files').get() as { n: number }).n,
    };
    const report = runForumV2Migration(db, Date.now(), 'app/server/assets/stickers/yugc');
    expect(report.stickers_seeded_this_run).toBe(0);
    expect(report.stickers_recaptioned_this_run).toBe(0);
    for (const row of report.tables) expect(row.after, `${row.table} 在零输入变化下不应该变化`).toBe(row.before);
    const after = {
      categories: (db.prepare('SELECT COUNT(*) AS n FROM forum_category_settings').get() as { n: number }).n,
      packs: (db.prepare('SELECT COUNT(*) AS n FROM forum_sticker_packs').get() as { n: number }).n,
      stickers: (db.prepare('SELECT COUNT(*) AS n FROM forum_stickers').get() as { n: number }).n,
      files: (db.prepare('SELECT COUNT(*) AS n FROM forum_sticker_files').get() as { n: number }).n,
    };
    expect(after).toEqual(before);
  });

  it('还指着原图的换成带小字的新图，管理员换过的不动，原图文件留着；再跑一遍什么都不变', () => {
    const { db } = makeStorage();
    const fileHash = (id: string) => (db.prepare('SELECT file_hash FROM forum_stickers WHERE id = ?').get(id) as { file_hash: string }).file_hash;
    const addFile = db.prepare("INSERT OR IGNORE INTO forum_sticker_files(hash, mime, bytes, created_at) VALUES (?, 'image/webp', ?, 0)");
    // 模拟一个 10-25 之前种的库：打招呼还是原图；冲被管理员换成了别的图。
    addFile.run(YUGC_UNCAPTIONED.wave, Buffer.from('old'));
    db.prepare('UPDATE forum_stickers SET file_hash = ? WHERE id = ?').run(YUGC_UNCAPTIONED.wave, 'yugc-wave');
    addFile.run('f'.repeat(64), Buffer.from('admin'));
    db.prepare('UPDATE forum_stickers SET file_hash = ? WHERE id = ?').run('f'.repeat(64), 'yugc-go');

    const first = runForumV2Migration(db, Date.now(), 'app/server/assets/stickers/yugc');
    expect(first.stickers_recaptioned_this_run).toBe(1);
    const current = createHash('sha256').update(readFileSync('app/server/assets/stickers/yugc/wave.webp')).digest('hex');
    expect(current).not.toBe(YUGC_UNCAPTIONED.wave);
    expect(fileHash('yugc-wave')).toBe(current);
    expect(fileHash('yugc-go')).toBe('f'.repeat(64));
    expect(db.prepare('SELECT 1 AS ok FROM forum_sticker_files WHERE hash = ?').get(YUGC_UNCAPTIONED.wave)).toEqual({ ok: 1 });

    const second = runForumV2Migration(db, Date.now(), 'app/server/assets/stickers/yugc');
    expect(second.stickers_recaptioned_this_run).toBe(0);
    for (const row of second.tables) expect(row.after, row.table).toBe(row.before);
    expect(fileHash('yugc-wave')).toBe(current);
  });

  it('缺素材文件时跳过那一个表情，不抛错，也不种半条记录', () => {
    const { db } = makeStorage();
    const before = (db.prepare('SELECT COUNT(*) AS n FROM forum_stickers').get() as { n: number }).n;
    expect(() => runForumV2Migration(db, Date.now(), '/nonexistent/never-a-real-sticker-dir')).not.toThrow();
    // 这次目录整个不存在：不会把已经种过的表情删掉（只增不改），但也不会凭空多出新的。
    expect((db.prepare('SELECT COUNT(*) AS n FROM forum_stickers').get() as { n: number }).n).toBe(before);
  });
});
