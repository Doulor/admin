import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'deploy/remote/garage-archive.mjs');
const roots: string[] = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'geek-garage-archive-'));
  roots.push(dir);
  const bin = join(dir, 'bin');
  const objects = join(dir, 'objects');
  const log = join(dir, 'calls.jsonl');
  mkdirSync(bin);
  mkdirSync(objects);
  writeFileSync(join(bin, 'rclone'), `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, config: {
  type: process.env.RCLONE_CONFIG_GEEKGARAGE_TYPE,
  provider: process.env.RCLONE_CONFIG_GEEKGARAGE_PROVIDER,
  endpoint: process.env.RCLONE_CONFIG_GEEKGARAGE_ENDPOINT,
  region: process.env.RCLONE_CONFIG_GEEKGARAGE_REGION,
  pathStyle: process.env.RCLONE_CONFIG_GEEKGARAGE_FORCE_PATH_STYLE,
  hasAccess: Boolean(process.env.RCLONE_CONFIG_GEEKGARAGE_ACCESS_KEY_ID),
  hasSecret: Boolean(process.env.RCLONE_CONFIG_GEEKGARAGE_SECRET_ACCESS_KEY),
} }) + '\\n');
if (process.env.FAKE_RCLONE_FAIL === '1') {
  console.error('provider error ' + process.env.RCLONE_CONFIG_GEEKGARAGE_SECRET_ACCESS_KEY);
  process.exit(91);
}
function remote(value) {
  const match = /^geekgarage:([^/]+)\\/(.+)$/.exec(value || '');
  if (!match) process.exit(92);
  return { bucket: match[1], key: match[2], file: path.join(${JSON.stringify(objects)}, match[1], ...match[2].split('/')) };
}
if (args[0] === 'lsjson' && args.includes('--stat')) {
  const item = remote(args[1]);
  if (!fs.existsSync(item.file) || !fs.statSync(item.file).isFile()) process.exit(3);
  const info = fs.statSync(item.file);
  console.log(JSON.stringify({ Path: path.basename(item.file), Name: path.basename(item.file), Size: info.size, IsDir: false }));
} else if (args[0] === 'copyto') {
  const item = remote(args[2]);
  if (fs.existsSync(item.file)) process.exit(4);
  fs.mkdirSync(path.dirname(item.file), { recursive: true });
  fs.copyFileSync(args[1], item.file);
} else if (args[0] === 'cat') {
  const item = remote(args[1]);
  if (!fs.existsSync(item.file)) process.exit(3);
  process.stdout.write(fs.readFileSync(item.file));
} else if (args[0] === 'lsjson' && args.includes('--recursive')) {
  const item = remote(args[1]);
  const base = item.file;
  const output = [];
  function walk(current, prefix = '') {
    if (!fs.existsSync(current)) return;
    for (const name of fs.readdirSync(current).sort()) {
      const file = path.join(current, name);
      const rel = prefix ? prefix + '/' + name : name;
      const info = fs.statSync(file);
      if (info.isDirectory()) walk(file, rel);
      else output.push({ Path: rel, Name: name, Size: info.size, IsDir: false });
    }
  }
  walk(base);
  console.log(JSON.stringify(output));
} else {
  console.error('unexpected rclone command');
  process.exit(93);
}
`, { mode: 0o700 });
  const credentials = {
    GITLAB_BACKUP_S3_ACCESS_KEY_ID: 'synthetic-access',
    GITLAB_BACKUP_S3_SECRET_ACCESS_KEY: 'synthetic-secret-never-disclose',
    PLATFORM_PREVIEW_BACKUP_S3_ACCESS_KEY_ID: 'preview-access',
    PLATFORM_PREVIEW_BACKUP_S3_SECRET_ACCESS_KEY: 'preview-secret-never-disclose',
    PLATFORM_PRODUCTION_BACKUP_S3_ACCESS_KEY_ID: 'production-access',
    PLATFORM_PRODUCTION_BACKUP_S3_SECRET_ACCESS_KEY: 'production-secret-never-disclose',
    PREVIEW_PRIVATE_INDEX_S3_ACCESS_KEY_ID: 'preview-index-access',
    PREVIEW_PRIVATE_INDEX_S3_SECRET_ACCESS_KEY: 'preview-index-secret-never-disclose',
    PRODUCTION_PRIVATE_INDEX_S3_ACCESS_KEY_ID: 'production-index-access',
    PRODUCTION_PRIVATE_INDEX_S3_SECRET_ACCESS_KEY: 'production-index-secret-never-disclose',
  };
  const run = (args: string[], extraEnv: Record<string, string> = {}) => spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', timeout: 15000,
    env: { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, HOME: dir, FAKE_RCLONE_ROOT: objects, ...credentials, ...extraEnv },
  });
  const calls = () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  return { dir, bin, objects, log, credentials, run, calls };
}

describe('Garage immutable archive adapter', () => {
  it('uploads a GitLab run additively, reuses byte-identical objects and rejects a conflicting key', () => {
    const f = fixture();
    const source = join(f.dir, 'gitlab-run');
    mkdirSync(source);
    writeFileSync(join(source, 'backup.tar.gpg'), 'encrypted backup', { mode: 0o600 });
    writeFileSync(join(source, 'SHA256SUMS'), 'synthetic checksum\n', { mode: 0o600 });
    const args = ['put-tree', '--role', 'gitlab-backup', '--source', source, '--prefix', 'gitlab/2026-10-27/20261027T040500/'];
    const first = f.run(args);
    expect(first.status, first.stderr).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({ stored: 2, exists: 0, bucket: 'geek-backup' });
    expect(readFileSync(join(f.objects, 'geek-backup/gitlab/2026-10-27/20261027T040500/backup.tar.gpg'), 'utf8')).toBe('encrypted backup');

    const second = f.run(args);
    expect(second.status, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({ stored: 0, exists: 2 });
    expect(f.calls().filter(call => call.args[0] === 'copyto')).toHaveLength(2);

    writeFileSync(join(source, 'backup.tar.gpg'), 'different encrypted backup', { mode: 0o600 });
    const conflict = f.run(args);
    expect(conflict.status).toBe(1);
    expect(conflict.stderr).toContain('同键内容冲突');
    expect(conflict.stdout + conflict.stderr).not.toContain('synthetic-secret-never-disclose');
    expect(readFileSync(join(f.objects, 'geek-backup/gitlab/2026-10-27/20261027T040500/backup.tar.gpg'), 'utf8')).toBe('encrypted backup');

    for (const call of f.calls()) {
      expect(call.config).toEqual({
        type: 's3', provider: 'Other', endpoint: 'https://cdn.yangtzeu.work', region: 'garage', pathStyle: 'true', hasAccess: true, hasSecret: true,
      });
      expect(['lsjson', 'copyto', 'cat']).toContain(call.args[0]);
      expect(call.args).not.toContain('sync');
      expect(call.args).not.toContain('purge');
      expect(call.args).not.toContain('delete');
    }
  });

  it('downloads every object by full GET into a new tree and never overwrites local evidence', () => {
    const f = fixture();
    const source = join(f.dir, 'source');
    mkdirSync(source);
    writeFileSync(join(source, 'a.gpg'), 'alpha', { mode: 0o600 });
    mkdirSync(join(source, 'nested'));
    writeFileSync(join(source, 'nested/b.gpg'), 'beta', { mode: 0o600 });
    expect(f.run(['put-tree', '--role', 'gitlab-backup', '--source', source, '--prefix', 'gitlab/2026-10-27/run-a/']).status).toBe(0);
    const destination = join(f.dir, 'download');
    const downloaded = f.run(['get-tree', '--role', 'gitlab-backup', '--prefix', 'gitlab/2026-10-27/run-a/', '--destination', destination]);
    expect(downloaded.status, downloaded.stderr).toBe(0);
    expect(JSON.parse(downloaded.stdout)).toMatchObject({ downloaded: 2, bucket: 'geek-backup' });
    expect(readFileSync(join(destination, 'a.gpg'), 'utf8')).toBe('alpha');
    expect(readFileSync(join(destination, 'nested/b.gpg'), 'utf8')).toBe('beta');
    expect(statSync(join(destination, 'a.gpg')).mode & 0o777).toBe(0o600);
    writeFileSync(join(destination, 'a.gpg'), 'preserve me', { mode: 0o600 });
    const repeated = f.run(['get-tree', '--role', 'gitlab-backup', '--prefix', 'gitlab/2026-10-27/run-a/', '--destination', destination]);
    expect(repeated.status).toBe(1);
    expect(readFileSync(join(destination, 'a.gpg'), 'utf8')).toBe('preserve me');
  });

  it('keeps preview/production content indexes in separate private buckets and requires a 0600 validated index', () => {
    const f = fixture();
    const commit = 'a'.repeat(40);
    const index = join(f.dir, 'sha256.json');
    writeFileSync(index, `${JSON.stringify({ schema_version: 1, hashes: { ['b'.repeat(64)]: { bytes: 3, keys: ['static/site/assets/app-12345678.js'] } } })}\n`, { mode: 0o600 });
    for (const environment of ['preview', 'production'] as const) {
      const result = f.run(['put-file', '--role', `${environment}-content-index`, '--source', index, '--key', `indexes/content/${commit}/sha256.json`]);
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout).bucket).toBe(`geek-${environment}-private`);
      expect(readFileSync(join(f.objects, `geek-${environment}-private/indexes/content/${commit}/sha256.json`), 'utf8')).toContain('schema_version');
    }
    chmodSync(index, 0o644);
    expect(f.run(['put-file', '--role', 'preview-content-index', '--source', index, '--key', `indexes/content/${'c'.repeat(40)}/sha256.json`]).status).toBe(1);
    chmodSync(index, 0o600);
    expect(f.run(['put-file', '--role', 'preview-content-index', '--source', index, '--key', 'indexes/content/not-a-commit/sha256.json']).status).toBe(1);
  });

  it('resolves the latest GitLab day/run while preserving an explicit date selector', () => {
    const f = fixture();
    for (const prefix of [
      'gitlab/2026-10-26/20261026T030000/',
      'gitlab/2026-10-27/20261027T030000/',
      'gitlab/2026-10-27/20261027T040000/',
    ]) {
      const source = join(f.dir, prefix.replaceAll('/', '_'));
      mkdirSync(source);
      writeFileSync(join(source, 'SHA256SUMS'), 'fixture\n', { mode: 0o600 });
      expect(f.run(['put-tree', '--role', 'gitlab-backup', '--source', source, '--prefix', prefix]).status).toBe(0);
    }
    const latest = f.run(['resolve-gitlab-run']);
    expect(latest.status, latest.stderr).toBe(0);
    expect(JSON.parse(latest.stdout)).toEqual({ day: '2026-10-27', prefix: 'gitlab/2026-10-27/20261027T040000/' });
    const selected = f.run(['resolve-gitlab-run', '--day', '2026-10-26']);
    expect(selected.status, selected.stderr).toBe(0);
    expect(JSON.parse(selected.stdout)).toEqual({ day: '2026-10-26', prefix: 'gitlab/2026-10-26/20261026T030000/' });
    expect(f.run(['resolve-gitlab-run', '--day', '2026/10/27']).status).toBe(1);
  });

  it('fails closed for missing role credentials or rclone errors without leaking provider output', () => {
    const f = fixture();
    const source = join(f.dir, 'one.gpg');
    writeFileSync(source, 'encrypted', { mode: 0o600 });
    const missing = f.run(['put-file', '--role', 'gitlab-backup', '--source', source, '--key', 'gitlab/2026-10-27/run/one.gpg'], { GITLAB_BACKUP_S3_SECRET_ACCESS_KEY: '' });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('GITLAB_BACKUP_S3_SECRET_ACCESS_KEY');
    const failed = f.run(['put-file', '--role', 'gitlab-backup', '--source', source, '--key', 'gitlab/2026-10-27/run/one.gpg'], { FAKE_RCLONE_FAIL: '1' });
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('rclone');
    expect(failed.stdout + failed.stderr).not.toContain('synthetic-secret-never-disclose');
  });
});
