// lib/system-backup.ts（#282）：排除表确实被清空、保留表确实被保留、manifest 的行数与归档内容一致、
// sha256 能验证、站点文件原样带走。路由层的权限、限流与操作记录见下面第二个 describe。
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../app/server/src/lib/db';
import { BACKUP_EXCLUDED_TABLES, prepareSystemBackup, readEnvKeyNames } from '../../app/server/src/lib/system-backup';
import { unpackTarGz } from '../../app/server/src/lib/tar-stream';

// better-sqlite3 只装在 app/server 下（同 tests/server/session-cleanup.test.ts）
const SqliteDatabase = createRequire(new URL('../../app/server/package.json', import.meta.url))('better-sqlite3') as typeof import('better-sqlite3');

async function readEntry(entry: { consume(onChunk: (chunk: Buffer) => void): Promise<void> }): Promise<Buffer> {
  const parts: Buffer[] = [];
  await entry.consume(chunk => parts.push(chunk));
  return Buffer.concat(parts);
}

async function extractAll(stream: NodeJS.ReadableStream) {
  const files = new Map<string, Buffer>();
  for await (const entry of unpackTarGz(stream)) files.set(entry.path, await readEntry(entry));
  return files;
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function seedSensitiveRows(db: Database.Database, now: number) {
  db.prepare("INSERT INTO users(id, status, org_state, created_at, updated_at) VALUES ('u1','active','active',?,?)").run(now, now);
  db.prepare(
    "INSERT INTO sessions(id, login, access_token_encrypted, created_at, expires_at) VALUES ('s1','octocat','enc-token',?,?)",
  ).run(now, now + 1000);
  db.prepare(
    `INSERT INTO device_grants(id, device_code_hash, user_code, client_id, scope, status, interval_s, created_at, expires_at)
     VALUES ('d1','hash1','ABCD-EFGH','geek-cli','openid','pending',5,?,?)`,
  ).run(now, now + 1000);
  db.prepare(
    `INSERT INTO email_challenges(id, purpose, email, limit_key, code_hmac, ip_key, created_at, expires_at)
     VALUES ('e1','signin','a@example.com','a@example.com','hmac','ip-key',?,?)`,
  ).run(now, now + 1000);
  db.prepare("INSERT INTO limit_events(bucket, subject, at) VALUES ('apply.daily','u1',?)").run(now);
}

describe('prepareSystemBackup（#282）', () => {
  it('清空短时安全数据，保留账号与业务数据，manifest 行数与归档里的实际数据一致', async () => {
    const storage = createDatabase(':memory:');
    const now = Date.now();
    seedSensitiveRows(storage.db, now);
    const sitesRoot = tempDir('yzgc-backup-sites-');
    mkdirSync(join(sitesRoot, 'comp-1', 'v1'), { recursive: true });
    writeFileSync(join(sitesRoot, 'comp-1', 'v1', 'index.html'), '<html>站点</html>');

    const { manifest, stream } = await prepareSystemBackup({
      db: storage.db, sitesRoot, environment: 'test', imageTag: 'abc123def456', appVersion: '1.2.3',
      requiredEnv: ['PUBLIC_ORIGIN', 'SESSION_SECRET'],
    });

    expect(manifest.format).toBe('yzgc-system-backup@1');
    expect(manifest.app).toEqual({ version: '1.2.3', image_tag: 'abc123def456' });
    expect(manifest.environment).toBe('test');
    expect(manifest.required_env).toEqual(['PUBLIC_ORIGIN', 'SESSION_SECRET']);
    expect(new Set(manifest.database.excluded_tables)).toEqual(new Set(BACKUP_EXCLUDED_TABLES));
    for (const table of BACKUP_EXCLUDED_TABLES) expect(manifest.database.row_counts[table]).toBe(0);
    expect(manifest.database.row_counts.users).toBe(1);
    expect(manifest.database.tables).toContain('users');

    const files = await extractAll(stream);
    expect(files.has('manifest.json')).toBe(true);
    expect(JSON.parse(files.get('manifest.json')!.toString('utf8'))).toEqual(manifest);
    expect(files.has('data.db')).toBe(true);
    expect(files.has('sites/comp-1/v1/index.html')).toBe(true);
    expect(files.get('sites/comp-1/v1/index.html')!.toString('utf8')).toBe('<html>站点</html>');

    // 归档里的 data.db 字节真的和 manifest 记的 sha256/size 对得上
    const dbEntry = manifest.files.find(f => f.path === 'data.db')!;
    const dbBytes = files.get('data.db')!;
    expect(dbBytes.length).toBe(dbEntry.size);
    expect(createHash('sha256').update(dbBytes).digest('hex')).toBe(dbEntry.sha256);

    // 打开归档里的 data.db：排除表真的是空的，users 真的还在
    const snapshotPath = join(tempDir('yzgc-backup-open-'), 'data.db');
    writeFileSync(snapshotPath, dbBytes);
    const reopened = new SqliteDatabase(snapshotPath, { readonly: true });
    try {
      for (const table of BACKUP_EXCLUDED_TABLES) {
        expect((reopened.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n).toBe(0);
      }
      expect((reopened.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(1);
    } finally {
      reopened.close();
    }

    storage.db.close();
  });

  it('sitesRoot 不存在时也能正常打包（只有 data.db 和 manifest）', async () => {
    const storage = createDatabase(':memory:');
    const missingRoot = join(tempDir('yzgc-backup-missing-'), 'does-not-exist');
    const { manifest, stream } = await prepareSystemBackup({
      db: storage.db, sitesRoot: missingRoot, environment: 'test', imageTag: null, appVersion: '0.0.0', requiredEnv: [],
    });
    expect(manifest.files.map(f => f.path)).toEqual(['data.db']);
    const files = await extractAll(stream);
    expect([...files.keys()].sort()).toEqual(['data.db', 'manifest.json']);
    storage.db.close();
  });

  it('打包完成后清理临时目录（不留下快照文件）', async () => {
    // 用隔离的 TMPDIR：直接扫 os.tmpdir() 会和同时跑在另一个 worker 里的测试文件（vitest maxWorkers: 2）
    // 共享同一个系统临时目录，彼此的 mkdtemp 互相干扰计数；os.tmpdir() 每次都重新读 TMPDIR，可以借它
    // 把这次调用完全隔离到一个只有这个用例在用的目录里。
    const isolatedRoot = tempDir('yzgc-backup-cleanup-root-');
    const previousTmpdir = process.env.TMPDIR;
    process.env.TMPDIR = isolatedRoot;
    try {
      const storage = createDatabase(':memory:');
      const { stream } = await prepareSystemBackup({
        db: storage.db, sitesRoot: join(isolatedRoot, 'nope'), environment: 'test', imageTag: null, appVersion: '0.0.0', requiredEnv: [],
      });
      const closed = new Promise<void>(resolve => stream.once('close', resolve));
      for await (const _chunk of stream as AsyncIterable<Buffer>) void _chunk; // 读完才会触发 close
      await closed; // close 是异步发出的，光是读完 for-await 不保证这一刻 cleanup() 已经跑完
      expect(readdirSync(isolatedRoot)).toEqual([]);
      storage.db.close();
    } finally {
      if (previousTmpdir === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previousTmpdir;
    }
  });
});

describe('readEnvKeyNames（#282）', () => {
  it('只取键名，跳过注释与空行，不读值', () => {
    const dir = tempDir('yzgc-backup-env-');
    const file = join(dir, '.env.fixture');
    writeFileSync(file, '# 注释\n\nPUBLIC_ORIGIN=https://example.test\nSESSION_SECRET=\nDB_PATH=data/data.db\n');
    expect(readEnvKeyNames(file)).toEqual(['PUBLIC_ORIGIN', 'SESSION_SECRET', 'DB_PATH']);
  });

  it('文件不存在时返回空数组，不抛错', () => {
    expect(readEnvKeyNames('/nonexistent/.env.nope')).toEqual([]);
    expect(existsSync('/nonexistent/.env.nope')).toBe(false);
  });
});
