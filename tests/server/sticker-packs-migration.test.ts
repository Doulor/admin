import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../app/server/src/lib/db';
import { loadStickerManifest } from '../../app/server/src/lib/sticker-manifest';
import { buildManifest, manifestText } from '../../scripts/sticker-manifest.mjs';

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
