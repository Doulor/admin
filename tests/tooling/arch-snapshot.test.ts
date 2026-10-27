import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const image = process.env.ARCH_SNAPSHOT_IMAGE ?? 'yzgc-preview/server:02cb751c0b83';
const available = spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore', timeout: 5000 }).status === 0;
const require = createRequire(join(root, 'app/server/package.json'));
const Database = require('better-sqlite3');
const roots: string[] = [];
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'geek-arch-snapshot-'));
  roots.push(dir);
  const source = join(dir, 'source');
  const output = join(dir, 'output');
  mkdirSync(source);
  mkdirSync(output);
  const db = new Database(join(source, 'data.db'));
  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users VALUES (1, 'Fixture'); CREATE TABLE sessions (id TEXT); INSERT INTO sessions VALUES ('synthetic_session'); CREATE TABLE oauth_subjects (account_id INTEGER, sub TEXT); INSERT INTO oauth_subjects VALUES (1, 'stable_synthetic_sub');");
  db.close();
  mkdirSync(join(source, 'sites/demo/v1'), { recursive: true });
  writeFileSync(join(source, 'sites/demo/v1/index.html'), '<h1>Synthetic competition</h1>');
  const run = () => spawnSync('docker', [
    'run', '--rm', '--pull', 'never', '--network', 'none',
    '--mount', `type=bind,src=${source},dst=/source,readonly`,
    '--mount', `type=bind,src=${output},dst=/output`,
    '--mount', `type=bind,src=${join(root, 'deploy/remote/export-stack-snapshot.mjs')},dst=/work/export.mjs,readonly`,
    '--entrypoint', 'node', image, '/work/export.mjs', 'production', '0.1.0', 'd4a24749d077',
  ], { encoding: 'utf8', timeout: 15000 });
  return { source, output, run };
}

describe.skipIf(!available)('Arch snapshot exporter CLI (synthetic read-only source)', () => {
  it('refuses an existing output directory before writing a partial new backup', () => {
    const f = fixture();
    writeFileSync(join(f.output, 'manifest.json'), 'keep existing snapshot metadata');
    const result = f.run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(readFileSync(join(f.output, 'manifest.json'), 'utf8')).toBe('keep existing snapshot metadata');
    expect(existsSync(join(f.output, 'system-backup.tar.gz'))).toBe(false);
  });

  it('exports restorable data and site files while removing transient grants only from the snapshot', () => {
    const f = fixture();
    const before = readFileSync(join(f.source, 'data.db'));
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    const archive = join(f.output, 'system-backup.tar.gz');
    const manifest = JSON.parse(readFileSync(join(f.output, 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({
      format: 'yzgc-system-backup@1', environment: 'production', app: { version: '0.1.0', image_tag: 'd4a24749d077' },
      database: { row_counts: { users: 1, sessions: 0, oauth_subjects: 1 }, excluded_tables: ['sessions'] },
    });
    const restored = join(f.output, 'restored');
    mkdirSync(restored);
    const unpack = spawnSync('tar', ['-xzf', archive, '-C', restored], { encoding: 'utf8' });
    expect(unpack.status, unpack.stderr).toBe(0);
    const db = new Database(join(restored, 'data.db'), { readonly: true });
    try {
      expect(db.prepare('SELECT sub FROM oauth_subjects WHERE account_id = 1').get()).toEqual({ sub: 'stable_synthetic_sub' });
      expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: 0 });
      expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally { db.close(); }
    expect(readFileSync(join(restored, 'sites/demo/v1/index.html'), 'utf8')).toBe('<h1>Synthetic competition</h1>');
    expect(readFileSync(join(f.source, 'data.db')).equals(before)).toBe(true);
    expect(statSync(archive).mode & 0o777).toBe(0o600);
    expect(statSync(join(f.output, 'manifest.json')).mode & 0o777).toBe(0o600);
  });
});

it('source preparation refuses an output directory created concurrently before inspecting source containers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'geek-arch-source-'));
  roots.push(dir);
  const bin = join(dir, 'bin');
  const output = join(dir, 'new-snapshot');
  const touched = join(dir, 'docker-touched');
  mkdirSync(bin);
  // Simulate another exporter claiming the destination between the initial check and mkdir.
  writeFileSync(join(bin, 'mkdir'), '#!/bin/sh\n/bin/mkdir -p "$RACE_OUTPUT"\nprintf preserved > "$RACE_OUTPUT/sentinel"\nexec /bin/mkdir "$@"\n', { mode: 0o700 });
  writeFileSync(join(bin, 'docker'), '#!/bin/sh\nprintf touched > "$DOCKER_TOUCHED"\nexit 99\n', { mode: 0o700 });
  const result = spawnSync('bash', [join(root, 'deploy/remote/prepare-arch-source.sh'), output], {
    encoding: 'utf8', timeout: 10000, env: { PATH: `${bin}:/usr/bin:/bin`, RACE_OUTPUT: output, DOCKER_TOUCHED: touched },
  });
  expect(result.status).not.toBe(0);
  expect(readFileSync(join(output, 'sentinel'), 'utf8')).toBe('preserved');
  expect(existsSync(touched)).toBe(false);
});
