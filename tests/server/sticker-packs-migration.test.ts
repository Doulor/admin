import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../app/server/src/lib/db';
import { loadStickerManifest } from '../../app/server/src/lib/sticker-manifest';
import { STICKER_ASSETS_DIR, buildManifest, manifestText } from '../../scripts/sticker-manifest.mjs';

/**
 * 内置表情包的播种（#286，lib/migrations/2026-10-sticker-packs.ts）：加一个包就是加一个目录（pack.json 和图片）、
 * 重新生成清单；迁移只补库里没有的，站长改过的包和表情一概不动。夹具是临时目录里的两个包，
 * 「启动」就是对同一个文件库再调一次 createDatabase，和服务重启做的是同一件事。
 */
type PackSpec = { id: string; name: string; order?: number; stickers: { id: string; label: string; file?: string }[] };

const dirs: string[] = [];
const opened: { close(): void }[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) try { db.close(); } catch { /* 已经关了 */ }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** 一个能过清单校验的假 WebP：RIFF 头加上按名字不同的内容，迁移只存字节，不解码。 */
function fakeWebp(seed: string): Buffer {
  const payload = Buffer.from(seed.repeat(8));
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(payload.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, payload]);
}

function writePack(root: string, spec: PackSpec) {
  const dir = join(root, spec.id);
  mkdirSync(dir, { recursive: true });
  const body = { id: spec.id, name: spec.name, ...(spec.order === undefined ? {} : { order: spec.order }), stickers: spec.stickers };
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(body, null, 2));
  for (const sticker of spec.stickers) writeFileSync(join(dir, sticker.file ?? `${sticker.id}.webp`), fakeWebp(`${spec.id}/${sticker.id}`));
}
/** 和站点维护者做的一样：改完目录，运行一次生成脚本。 */
const regenerate = (root: string) => writeFileSync(join(root, 'manifest.json'), manifestText(buildManifest(root)));

const CATS: PackSpec = { id: 'cats', name: '猫猫', order: 10, stickers: [{ id: 'hi', label: '招手' }, { id: 'bye', label: '再见' }] };
const DOGS: PackSpec = { id: 'dogs', name: '狗狗', order: 20, stickers: [{ id: 'run', label: '跑', file: 'running-dog.webp' }, { id: 'sit', label: '坐下' }] };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'geek-sticker-packs-'));
  dirs.push(root);
  const assets = join(root, 'stickers');
  mkdirSync(assets);
  writePack(assets, CATS);
  writePack(assets, DOGS);
  regenerate(assets);
  return { root, assets, dbPath: join(root, 'data', 'data.db') };
}
function start(dbPath: string, assets: string) {
  const storage = createDatabase(dbPath, assets);
  opened.push(storage.db);
  return storage;
}
const rows = <T>(db: ReturnType<typeof createDatabase>['db'], sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];
type PackRow = { id: string; name: string; sort: number; enabled: number };
type StickerRow = { id: string; pack_id: string; shortcode: string; label: string; file_hash: string; sort: number; enabled: number };
const PACKS = 'SELECT id, name, sort, enabled FROM forum_sticker_packs ORDER BY sort, rowid';
const STICKERS = 'SELECT id, pack_id, shortcode, label, file_hash, sort, enabled FROM forum_stickers WHERE pack_id = ? ORDER BY sort, rowid';
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('第一次启动：目录里的包都建出来', () => {
  it('两个包按清单的顺序建出来，表情的短码是 <包 id>-<表情 id>，图片按文件真实内容存', () => {
    const { assets, dbPath } = fixture();
    const first = start(dbPath, assets);
    const packs = rows<PackRow>(first.db, PACKS).filter(pack => pack.id === 'cats' || pack.id === 'dogs');
    expect(packs).toEqual([
      { id: 'cats', name: '猫猫', sort: expect.any(Number), enabled: 1 },
      { id: 'dogs', name: '狗狗', sort: expect.any(Number), enabled: 1 },
    ]);
    expect(packs[1].sort).toBeGreaterThan(packs[0].sort);
    expect(rows<StickerRow>(first.db, STICKERS, 'cats').map(row => [row.shortcode, row.label, row.sort, row.enabled])).toEqual([['cats-hi', '招手', 0, 1], ['cats-bye', '再见', 1, 1]]);
    const dogs = rows<StickerRow>(first.db, STICKERS, 'dogs');
    expect(dogs.map(row => row.shortcode)).toEqual(['dogs-run', 'dogs-sit']);
    // 图片按 pack.json 里写的文件名读（running-dog.webp），哈希是文件内容的 sha256。
    expect(dogs[0].file_hash).toBe(sha(join(assets, 'dogs', 'running-dog.webp')));
    expect(rows<{ hash: string }>(first.db, 'SELECT hash FROM forum_sticker_files WHERE hash = ?', dogs[0].file_hash)).toHaveLength(1);
    expect(first.forumV2Migration).toMatchObject({ packs_seeded_this_run: 2, stickers_seeded_this_run: 4, stickers_missing_files: [] });
  });

  it('启动读到的清单就是接口之后用的那份', () => {
    const { assets, dbPath } = fixture();
    expect(start(dbPath, assets).stickerManifest).toEqual(loadStickerManifest(assets));
  });
});

describe('再启动：站长改过的不被覆盖，行数不变', () => {
  it('改名、停用、排序、改表情名之后重启，什么都还是站长改的样子；第二次启动一行都不新增', () => {
    const { assets, dbPath } = fixture();
    const first = start(dbPath, assets);
    first.db.prepare("UPDATE forum_sticker_packs SET name = '猫猫乐园', sort = 50, enabled = 0 WHERE id = 'cats'").run();
    first.db.prepare("UPDATE forum_sticker_packs SET enabled = 0 WHERE id = 'dogs'").run();
    first.db.prepare("UPDATE forum_stickers SET label = '招手呀', sort = 9, enabled = 0 WHERE id = 'cats-hi'").run();
    const before = {
      packs: rows<PackRow>(first.db, PACKS), cats: rows<StickerRow>(first.db, STICKERS, 'cats'), dogs: rows<StickerRow>(first.db, STICKERS, 'dogs'),
      stickerCount: rows<{ n: number }>(first.db, 'SELECT COUNT(*) AS n FROM forum_stickers')[0].n,
      fileCount: rows<{ n: number }>(first.db, 'SELECT COUNT(*) AS n FROM forum_sticker_files')[0].n,
    };
    first.db.close();

    const second = start(dbPath, assets);
    expect(second.forumV2Migration).toMatchObject({ packs_seeded_this_run: 0, stickers_seeded_this_run: 0, stickers_missing_files: [] });
    for (const row of second.forumV2Migration.tables) expect(row.after, row.table).toBe(row.before);
    expect(rows<PackRow>(second.db, PACKS)).toEqual(before.packs);
    expect(rows<StickerRow>(second.db, STICKERS, 'cats')).toEqual(before.cats);
    expect(rows<StickerRow>(second.db, STICKERS, 'dogs')).toEqual(before.dogs);
    expect(rows<{ n: number }>(second.db, 'SELECT COUNT(*) AS n FROM forum_stickers')[0].n).toBe(before.stickerCount);
    expect(rows<{ n: number }>(second.db, 'SELECT COUNT(*) AS n FROM forum_sticker_files')[0].n).toBe(before.fileCount);
    const edited = rows<StickerRow>(second.db, STICKERS, 'cats').find(row => row.id === 'cats-hi')!;
    expect(edited).toMatchObject({ label: '招手呀', sort: 9, enabled: 0 });
    expect(rows<PackRow>(second.db, PACKS).find(pack => pack.id === 'cats')).toMatchObject({ name: '猫猫乐园', sort: 50, enabled: 0 });
  });

  it('后来加了一个新包、给老包多加了一张：只补这两样，新包排在现有的包后面，老包的新表情排在这个包的最后', () => {
    const { assets, dbPath } = fixture();
    const first = start(dbPath, assets);
    first.db.prepare("UPDATE forum_sticker_packs SET name = '猫猫乐园', sort = 50, enabled = 0 WHERE id = 'cats'").run();
    first.db.prepare("UPDATE forum_stickers SET label = '招手呀', sort = 9, enabled = 0 WHERE id = 'cats-hi'").run();
    const maxPackSort = Math.max(...rows<PackRow>(first.db, PACKS).map(pack => pack.sort));
    first.db.close();

    writePack(assets, { ...CATS, stickers: [...CATS.stickers, { id: 'nap', label: '打盹' }] });
    writePack(assets, { id: 'birds', name: '小鸟', order: 30, stickers: [{ id: 'fly', label: '飞' }] });
    regenerate(assets);

    const second = start(dbPath, assets);
    expect(second.forumV2Migration).toMatchObject({ packs_seeded_this_run: 1, stickers_seeded_this_run: 2, stickers_missing_files: [] });
    const packs = rows<PackRow>(second.db, PACKS);
    expect(packs.find(pack => pack.id === 'birds')).toMatchObject({ name: '小鸟', enabled: 1 });
    expect(packs.find(pack => pack.id === 'birds')!.sort).toBeGreaterThan(maxPackSort);
    expect(packs.find(pack => pack.id === 'cats')).toMatchObject({ name: '猫猫乐园', sort: 50, enabled: 0 });
    const cats = rows<StickerRow>(second.db, STICKERS, 'cats');
    expect(cats.map(row => row.id)).toEqual(['cats-bye', 'cats-hi', 'cats-nap']);
    expect(cats.find(row => row.id === 'cats-nap')).toMatchObject({ label: '打盹', sort: 10, enabled: 1 });
    expect(cats.find(row => row.id === 'cats-hi')).toMatchObject({ label: '招手呀', sort: 9, enabled: 0 });
    expect(rows<StickerRow>(second.db, STICKERS, 'birds').map(row => row.shortcode)).toEqual(['birds-fly']);

    second.db.close();
    const third = start(dbPath, assets);
    expect(third.forumV2Migration).toMatchObject({ packs_seeded_this_run: 0, stickers_seeded_this_run: 0 });
  });

  it('清单里列了、目录里没有的图片跳过并报告，其余照常种；图片补回来以后下次启动补上', () => {
    const { assets, dbPath } = fixture();
    const missing = join(assets, 'dogs', 'running-dog.webp');
    const bytes = readFileSync(missing);
    unlinkSync(missing);
    const first = start(dbPath, assets);
    expect(first.forumV2Migration.stickers_missing_files).toEqual(['dogs/running-dog.webp']);
    expect(first.forumV2Migration.stickers_seeded_this_run).toBe(3);
    expect(rows<StickerRow>(first.db, STICKERS, 'dogs').map(row => row.id)).toEqual(['dogs-sit']);
    first.db.close();

    writeFileSync(missing, bytes);
    const second = start(dbPath, assets);
    expect(second.forumV2Migration).toMatchObject({ stickers_seeded_this_run: 1, stickers_missing_files: [] });
    expect(rows<StickerRow>(second.db, STICKERS, 'dogs').map(row => row.id).sort()).toEqual(['dogs-run', 'dogs-sit']);
  });
});

describe('清单读不出来', () => {
  const write = (assets: string, text: string) => writeFileSync(join(assets, 'manifest.json'), text);

  it('没有清单文件算没有内置表情包，启动照常；已经有的库不受影响', () => {
    const { root, dbPath } = fixture();
    const empty = join(root, 'empty-stickers');
    mkdirSync(empty);
    const storage = start(dbPath, empty);
    expect(storage.stickerManifest).toEqual({ version: 1, packs: [] });
    expect(storage.forumV2Migration).toMatchObject({ packs_seeded_this_run: 0, stickers_seeded_this_run: 0 });
  });

  it.each([
    ['不是 JSON', '{'],
    ['版本不对', JSON.stringify({ version: 2, packs: [] })],
    ['对象键和内容哈希对不上', JSON.stringify({ version: 1, packs: [{ id: 'a', name: 'A', stickers: [{ id: 'b', label: 'B', file: 'b.webp', sha256: 'a'.repeat(64), size: 5, key: `forum/stickers/${'b'.repeat(64)}.webp` }] }] })],
    ['短码不合规', JSON.stringify({ version: 1, packs: [{ id: 'a', name: 'A', stickers: [{ id: 'B_', label: 'B', file: 'b.webp', sha256: 'a'.repeat(64), size: 5, key: `forum/stickers/${'a'.repeat(64)}.webp` }] }] })],
    ['同一个包列了两次', JSON.stringify({ version: 1, packs: [CATS, CATS].map(pack => ({ id: pack.id, name: pack.name, stickers: [{ id: 'hi', label: '招手', file: 'hi.webp', sha256: 'a'.repeat(64), size: 5, key: `forum/stickers/${'a'.repeat(64)}.webp` }] })) })],
  ])('清单%s：在打开数据库之前就失败，不带着不知道对不对的清单上线', (_name, text) => {
    const { assets, dbPath } = fixture();
    write(assets, text);
    expect(() => createDatabase(dbPath, assets)).toThrow(/sticker manifest/);
  });
});

describe('仓库里的三个内置包：极客娘、极客日常、聊天回应（#286）', () => {
  const NEW_PACKS = [['geekdaily', '极客日常'], ['chatreply', '聊天回应']] as const;
  /** 把仓库里真实的一个包（pack.json 和图片）原样拷进临时目录。 */
  const realPack = (assets: string, id: string) => cpSync(join(STICKER_ASSETS_DIR, id), join(assets, id), { recursive: true });
  const count = (db: ReturnType<typeof createDatabase>['db'], table: string) => rows<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`)[0].n;
  const totals = (db: ReturnType<typeof createDatabase>['db']) => ({ packs: count(db, 'forum_sticker_packs'), stickers: count(db, 'forum_stickers'), files: count(db, 'forum_sticker_files') });

  it('新库直接用仓库里的目录启动：三个包依次排好，56 张表情，库里存的图片字节就是目录里的文件', () => {
    const root = mkdtempSync(join(tmpdir(), 'geek-sticker-real-'));
    dirs.push(root);
    const storage = start(join(root, 'data', 'data.db'), STICKER_ASSETS_DIR);
    expect(rows<PackRow>(storage.db, PACKS).map(pack => [pack.id, pack.name, pack.enabled])).toEqual([['yugc', '极客娘', 1], ['geekdaily', '极客日常', 1], ['chatreply', '聊天回应', 1]]);
    expect(storage.forumV2Migration).toMatchObject({ packs_seeded_this_run: 3, stickers_seeded_this_run: 56, stickers_missing_files: [] });
    for (const pack of storage.stickerManifest.packs) {
      const stored = rows<StickerRow>(storage.db, STICKERS, pack.id);
      expect(stored.map(row => [row.shortcode, row.label, row.sort])).toEqual(pack.stickers.map((sticker, index) => [`${pack.id}-${sticker.id}`, sticker.label, index]));
      for (const [index, sticker] of pack.stickers.entries()) {
        expect(stored[index].file_hash, sticker.id).toBe(sticker.sha256);
        const file = readFileSync(join(STICKER_ASSETS_DIR, pack.id, sticker.file));
        expect(rows<{ bytes: Buffer }>(storage.db, 'SELECT bytes FROM forum_sticker_files WHERE hash = ?', sticker.sha256)[0].bytes.equals(file), sticker.id).toBe(true);
      }
    }
    expect(totals(storage.db)).toEqual({ packs: 3, stickers: 56, files: 56 });
  });

  it('旧库只有极客娘：升级后多出两个包和 32 张表情，极客娘的包和 24 张表情一行不动（站长改过的还在），再启动一次行数不变', () => {
    const root = mkdtempSync(join(tmpdir(), 'geek-sticker-upgrade-'));
    dirs.push(root);
    const assets = join(root, 'stickers');
    mkdirSync(assets);
    realPack(assets, 'yugc');
    regenerate(assets);
    const dbPath = join(root, 'data', 'data.db');

    // 升级前的库：只有极客娘，站长在控制台改过它。
    const old = start(dbPath, assets);
    expect(rows<PackRow>(old.db, PACKS).map(pack => pack.id)).toEqual(['yugc']);
    old.db.prepare("UPDATE forum_sticker_packs SET name = '小极客', enabled = 0 WHERE id = 'yugc'").run();
    old.db.prepare("UPDATE forum_stickers SET label = '招招手', sort = 40, enabled = 0 WHERE id = 'yugc-wave'").run();
    const yugc = { pack: rows<PackRow>(old.db, PACKS)[0], stickers: rows<StickerRow>(old.db, STICKERS, 'yugc') };
    expect(yugc.stickers).toHaveLength(24);
    expect(totals(old.db)).toEqual({ packs: 1, stickers: 24, files: 24 });
    old.db.close();

    // 部署新版本：目录里多了两个包，清单重新生成。
    for (const [id] of NEW_PACKS) realPack(assets, id);
    regenerate(assets);
    const upgraded = start(dbPath, assets);
    expect(upgraded.forumV2Migration).toMatchObject({ packs_seeded_this_run: 2, stickers_seeded_this_run: 32, stickers_missing_files: [] });
    const packs = rows<PackRow>(upgraded.db, PACKS);
    expect(packs.map(pack => pack.id)).toEqual(['yugc', 'geekdaily', 'chatreply']);
    expect(packs[0]).toEqual(yugc.pack);
    expect(packs[0]).toMatchObject({ name: '小极客', enabled: 0 });
    expect(packs[1].sort).toBeGreaterThan(packs[0].sort);
    expect(packs[2].sort).toBeGreaterThan(packs[1].sort);
    expect(packs.slice(1)).toMatchObject([{ id: 'geekdaily', name: '极客日常', enabled: 1 }, { id: 'chatreply', name: '聊天回应', enabled: 1 }]);
    expect(rows<StickerRow>(upgraded.db, STICKERS, 'yugc')).toEqual(yugc.stickers);
    for (const [id] of NEW_PACKS) {
      const stickers = rows<StickerRow>(upgraded.db, STICKERS, id);
      const pack = upgraded.stickerManifest.packs.find(item => item.id === id)!;
      expect(stickers, id).toHaveLength(16);
      expect(stickers.map(row => row.sort), id).toEqual(Array.from({ length: 16 }, (_, index) => index));
      expect(stickers.map(row => [row.shortcode, row.label, row.file_hash, row.enabled]), id).toEqual(pack.stickers.map(sticker => [`${id}-${sticker.id}`, sticker.label, sticker.sha256, 1]));
    }
    const after = totals(upgraded.db);
    expect(after).toEqual({ packs: 3, stickers: 56, files: 56 });
    upgraded.db.close();

    // 再启动一次：什么都不新增，什么都不改。
    const again = start(dbPath, assets);
    expect(again.forumV2Migration).toMatchObject({ packs_seeded_this_run: 0, stickers_seeded_this_run: 0, stickers_missing_files: [] });
    for (const row of again.forumV2Migration.tables) expect(row.after, row.table).toBe(row.before);
    expect(rows<PackRow>(again.db, PACKS)).toEqual(packs);
    expect(rows<StickerRow>(again.db, STICKERS, 'yugc')).toEqual(yugc.stickers);
    expect(totals(again.db)).toEqual(after);
  });
});
