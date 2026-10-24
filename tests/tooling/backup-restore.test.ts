// scripts/backup-restore.mjs（#282）：恢复要核对 manifest 里每个文件的 sha256，拒绝覆盖非空目录除非
// --force，round-trip 到临时目录后文件内容原样还原。真实 manifest 的产出见 tests/server/system-backup.test.ts。
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { packTarGz } from '../../app/server/src/lib/tar-stream';
import { isNonEmptyDir, main, parseArgs, restoreBackup } from '../../scripts/backup-restore.mjs';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

/** 造一份和 lib/system-backup.ts 输出同形的归档：manifest.json 在前，再是 data.db 与可选的站点文件。 */
async function writeFakeArchive(archivePath: string, files: { path: string; data: Buffer }[]) {
  const manifest = {
    format: 'yzgc-system-backup@1',
    created_at: new Date().toISOString(),
    app: { version: '1.2.3', image_tag: 'abc123def456' },
    environment: 'test',
    database: { tables: ['users'], row_counts: { users: 1 }, excluded_tables: ['sessions'] },
    files: files.map(f => ({ path: f.path, sha256: sha256(f.data), size: f.data.length })),
    required_env: ['PUBLIC_ORIGIN', 'SESSION_SECRET'],
  };
  const manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
  const stream = packTarGz([
    { path: 'manifest.json', size: manifestBuffer.length, open: () => Buffer_from_single(manifestBuffer) },
    ...files.map(f => ({ path: f.path, size: f.data.length, open: () => Buffer_from_single(f.data) })),
  ]);
  await pipeline(stream, createWriteStream(archivePath));
  return manifest;
}
// packTarGz 的 open() 要返回异步可迭代的字节流；用一次性产出整段 Buffer 的小生成器，不需要额外依赖。
function Buffer_from_single(buffer: Buffer): NodeJS.ReadableStream {
  return (async function* () { yield buffer; })() as unknown as NodeJS.ReadableStream;
}

describe('parseArgs（#282 backup-restore.mjs）', () => {
  it('认识 --archive、--target、--force、--help，不认识的参数报错', () => {
    expect(parseArgs(['--archive', 'a.tar.gz', '--target', '/data', '--force'])).toEqual({ archive: 'a.tar.gz', target: '/data', force: true, help: false });
    expect(parseArgs(['--help'])).toMatchObject({ help: true });
    expect(() => parseArgs(['--nope'])).toThrow(/不认识的参数/);
  });
});

describe('restoreBackup（#282）', () => {
  it('round-trip：data.db 与站点文件原样还原，内容和 manifest 的 sha256 对得上', async () => {
    const workDir = tempDir('yzgc-restore-src-');
    const archivePath = join(workDir, 'backup.tar.gz');
    const dbBytes = Buffer.alloc(2000, 9);
    const siteBytes = Buffer.from('<html>站点</html>');
    const manifest = await writeFakeArchive(archivePath, [
      { path: 'data.db', data: dbBytes },
      { path: 'sites/comp-1/v1/index.html', data: siteBytes },
    ]);

    const target = tempDir('yzgc-restore-target-');
    const result = await restoreBackup({ archive: archivePath, target });
    expect(result.manifest).toEqual(manifest);
    expect(result.restored.sort()).toEqual(['data.db', 'sites/comp-1/v1/index.html']);
    expect(readFileSync(join(target, 'data.db')).equals(dbBytes)).toBe(true);
    expect(readFileSync(join(target, 'sites/comp-1/v1/index.html')).equals(siteBytes)).toBe(true);
  });

  it('某个文件的字节和 manifest 记的 sha256 不一致时抛错，不静默通过', async () => {
    const workDir = tempDir('yzgc-restore-bad-');
    const archivePath = join(workDir, 'backup.tar.gz');
    const manifest = {
      format: 'yzgc-system-backup@1', created_at: new Date().toISOString(), app: { version: '0.0.0', image_tag: null },
      environment: 'test', database: { tables: [], row_counts: {}, excluded_tables: [] },
      files: [{ path: 'data.db', sha256: 'f'.repeat(64), size: 3 }], required_env: [],
    };
    const manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf8');
    const stream = packTarGz([
      { path: 'manifest.json', size: manifestBuffer.length, open: () => Buffer_from_single(manifestBuffer) },
      { path: 'data.db', size: 3, open: () => Buffer_from_single(Buffer.from('xyz')) }, // 真实 sha256 和 manifest 里的假值不一致
    ]);
    await pipeline(stream, createWriteStream(archivePath));
    const target = tempDir('yzgc-restore-bad-target-');
    await expect(restoreBackup({ archive: archivePath, target })).rejects.toThrow(/校验不通过/);
  });

  it('manifest 格式不认识时拒绝', async () => {
    const workDir = tempDir('yzgc-restore-fmt-');
    const archivePath = join(workDir, 'backup.tar.gz');
    const manifestBuffer = Buffer.from(JSON.stringify({ format: 'something-else' }), 'utf8');
    await pipeline(packTarGz([{ path: 'manifest.json', size: manifestBuffer.length, open: () => Buffer_from_single(manifestBuffer) }]), createWriteStream(archivePath));
    await expect(restoreBackup({ archive: archivePath, target: tempDir('yzgc-restore-fmt-target-') })).rejects.toThrow(/不认识的备份格式/);
  });
});

describe('main（#282 命令行层：非空目标目录的确认）', () => {
  it('目标目录非空且没有 --force 时拒绝，不碰目标目录', async () => {
    const workDir = tempDir('yzgc-restore-cli-');
    const archivePath = join(workDir, 'backup.tar.gz');
    await writeFakeArchive(archivePath, [{ path: 'data.db', data: Buffer.from('ok') }]);
    const target = tempDir('yzgc-restore-cli-target-');
    writeFileSync(join(target, 'already-here.txt'), 'x');
    expect(isNonEmptyDir(target)).toBe(true);
    await expect(main({ archive: archivePath, target })).rejects.toThrow(/不是空的/);
    expect(existsSync(join(target, 'data.db'))).toBe(false); // 确认没有半路写进去
  });

  it('带 --force 时覆盖非空目录并完成恢复', async () => {
    const workDir = tempDir('yzgc-restore-cli2-');
    const archivePath = join(workDir, 'backup.tar.gz');
    await writeFakeArchive(archivePath, [{ path: 'data.db', data: Buffer.from('ok') }]);
    const target = tempDir('yzgc-restore-cli2-target-');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'already-here.txt'), 'x');
    await main({ archive: archivePath, target, force: true });
    expect(readFileSync(join(target, 'data.db'), 'utf8')).toBe('ok');
    expect(existsSync(join(target, 'already-here.txt'))).toBe(true); // 不相关的旧文件不会被清掉
  });

  it('缺 --archive 或 --target 时报用法', async () => {
    await expect(main({ archive: null, target: null, force: false })).rejects.toThrow(/用法/);
  });
});
