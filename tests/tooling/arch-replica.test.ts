import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../../deploy/remote/verify-arch-replica.mjs', import.meta.url));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fingerprint(path: string) {
  const stat = statSync(path, { bigint: true });
  return { sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), mtime: stat.mtimeNs, mode: stat.mode, size: stat.size };
}

function fixture(settings: string | null = '{"mode":"off"}', environment: 'production' | 'preview' = 'preview') {
  const root = mkdtempSync(join(tmpdir(), 'geek-arch-replica-'));
  roots.push(root);
  const database = join(root, 'data.db');
  const envFile = join(root, `.env.${environment}`);
  const port = environment === 'production' ? 18100 : 18200;
  const origin = environment === 'production' ? 'https://yangtzeu.work' : 'https://prev.yangtzeu.work';
  const text = [
    `GEEK_DEPLOYMENT_ENVIRONMENT=${environment}`, `GEEK_ENVIRONMENT_ORIGIN=${origin}`, `PUBLIC_ORIGIN=${origin}`,
    `COMPOSE_PROJECT_NAME=yzgc-${environment}`, `STACK_ROOT=/opt/yzgc/${environment}`,
    `IMAGE_TAG=${environment === 'production' ? 'd4a24749d077' : '02cb751c0b83'}`,
    `WEB_BIND=10.66.0.2:${port}`, `SERVER_BIND=127.0.0.1:${port + 1}`, 'TRUST_PROXY=2',
    'GITLAB_SYNC=off', 'MAIL_RECIPIENTS=allowlist', 'MAIL_ALLOWLIST=',
    'ENCRYPTION_KEY=synthetic_encryption_never_log', 'SESSION_SECRET=synthetic_session_never_log', '',
  ].join('\n');
  writeFileSync(envFile, text, { mode: 0o600 });
  const db = new DatabaseSync(database);
  db.exec('CREATE TABLE app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER);');
  if (settings !== null) db.prepare('INSERT INTO app_state (key, value) VALUES (?, ?)').run('gitlab_settings', settings);
  db.close();
  const run = (args: string[] = [], runtime = process.execPath) => spawnSync(runtime, [cli, '--environment', environment, '--env-file', envFile, '--database', database, ...args], { encoding: 'utf8', timeout: 5000 });
  return { root, database, envFile, text, run };
}

describe('Arch replica read-only verification CLI', () => {
  it('accepts env off plus persisted off without modifying either input', () => {
    const f = fixture();
    const before = { env: fingerprint(f.envFile), db: fingerprint(f.database), files: readdirSync(f.root) };
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ environment: 'preview', replica_verified: true, gitlab_sync: 'off', mail_recipients: 'allowlist', mail_allowlist_empty: true });
    expect(JSON.parse(result.stdout)).toMatchObject({ scope: 'configuration', encryption_key_match_verified: false });
    expect({ env: fingerprint(f.envFile), db: fingerprint(f.database), files: readdirSync(f.root) }).toEqual(before);
    expect(`${result.stdout}${result.stderr}`).not.toContain('synthetic_encryption_never_log');
    expect(`${result.stdout}${result.stderr}`).not.toContain('synthetic_session_never_log');
  });

  it.each([
    ['enabled', '{"mode":"on","debug":"synthetic_db_never_log"}'],
    ['dry run', '{"mode":"dry-run"}'],
    ['unknown mode', '{"mode":"unexpected_mode_never_log"}'],
    ['invalid JSON', '{"mode":"off", "debug":"malformed_value_never_log"'],
    ['null settings', 'null'],
    ['array settings', '[{"mode":"off"}]'],
  ])('rejects env off with %s persisted settings without changing inputs or leaking values', (_name, settings) => {
    const f = fixture(settings);
    const before = { env: fingerprint(f.envFile), db: fingerprint(f.database), files: readdirSync(f.root) };
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/synthetic_\w+_never_log|unexpected_mode_never_log|malformed_value_never_log/);
    expect({ env: fingerprint(f.envFile), db: fingerprint(f.database), files: readdirSync(f.root) }).toEqual(before);
  });

  it.each([
    ['GEEK_DEPLOYMENT_ENVIRONMENT=preview', 'GEEK_DEPLOYMENT_ENVIRONMENT=production'],
    ['GEEK_ENVIRONMENT_ORIGIN=https://prev.yangtzeu.work', 'GEEK_ENVIRONMENT_ORIGIN=https://yangtzeu.work'],
    ['IMAGE_TAG=02cb751c0b83', 'IMAGE_TAG=d4a24749d077'],
    ['WEB_BIND=10.66.0.2:18200', 'WEB_BIND=10.66.0.2:18100'],
    ['SERVER_BIND=127.0.0.1:18201', 'SERVER_BIND=0.0.0.0:18201'],
    ['TRUST_PROXY=2', 'TRUST_PROXY=true'],
    ['GITLAB_SYNC=off', 'GITLAB_SYNC=on'],
    ['MAIL_RECIPIENTS=allowlist', 'MAIL_RECIPIENTS=all'],
    ['MAIL_ALLOWLIST=', 'MAIL_ALLOWLIST=synthetic_mail_never_log@example.test'],
  ])('rejects unsafe or mixed environment input: %s', (before, after) => {
    const f = fixture();
    writeFileSync(f.envFile, f.text.replace(before, after));
    const files = { env: fingerprint(f.envFile), db: fingerprint(f.database) };
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain('synthetic_mail_never_log');
    expect({ env: fingerprint(f.envFile), db: fingerprint(f.database) }).toEqual(files);
  });

  it.each([
    ['empty', 'ENCRYPTION_KEY='],
    ['absent', ''],
    ['blank quoted', 'ENCRYPTION_KEY="  "'],
  ])('rejects an %s original encryption key on standalone invocation without changing inputs', (_name, replacement) => {
    const f = fixture();
    writeFileSync(f.envFile, f.text.replace(/^ENCRYPTION_KEY=.*$/m, replacement));
    const before = { env: fingerprint(f.envFile), db: fingerprint(f.database), files: readdirSync(f.root) };
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain('synthetic_session_never_log');
    expect({ env: fingerprint(f.envFile), db: fingerprint(f.database), files: readdirSync(f.root) }).toEqual(before);
  });

  it('fails closed on an absent database without creating one', () => {
    const f = fixture();
    rmSync(f.database);
    const result = f.run();
    expect(result.status).toBe(1);
    expect(readdirSync(f.root)).toEqual(['.env.preview']);
  });

  it('does not mistake an empty file for a verified replica database', () => {
    const f = fixture();
    writeFileSync(f.database, '');
    const before = fingerprint(f.database);
    const result = f.run();
    expect(result.status).toBe(1);
    expect(fingerprint(f.database)).toEqual(before);
  });

  it('rejects a WAL copy without modifying the database or its sidecars', () => {
    const f = fixture();
    const writer = new DatabaseSync(f.database);
    try {
      writer.exec('PRAGMA journal_mode=WAL');
      writer.prepare('UPDATE app_state SET value = ? WHERE key = ?').run('{"mode":"on"}', 'gitlab_settings');
      const paths = [f.envFile, f.database, `${f.database}-wal`, `${f.database}-shm`];
      const before = paths.map(fingerprint);
      const result = f.run();
      expect(result.status).toBe(1);
      expect(paths.map(fingerprint)).toEqual(before);
    } finally { writer.close(); }
  });

  it('accepts legacy production snapshots without an app_state table and performs no migrations', () => {
    const f = fixture(null, 'production');
    const db = new DatabaseSync(f.database);
    db.exec('DROP TABLE app_state; CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users VALUES (1);');
    db.close();
    const before = fingerprint(f.database);
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ environment: 'production', persisted_gitlab_mode: 'absent' });
    expect(fingerprint(f.database)).toEqual(before);
  });

  it('allows a missing persisted mode to inherit env off', () => {
    const f = fixture('{"group":"synthetic_group"}');
    expect(f.run().status).toBe(0);
  });

  it('redacts dotenv parser errors which contain the original invalid line', () => {
    const f = fixture();
    writeFileSync(f.envFile, `${f.text}\nsynthetic_parser_never_log\n`);
    const before = fingerprint(f.envFile);
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain('synthetic_parser_never_log');
    expect(fingerprint(f.envFile)).toEqual(before);
  });

  it('rejects closed WAL-mode copies without creating new WAL or SHM files', () => {
    const f = fixture();
    const db = new DatabaseSync(f.database);
    db.exec('PRAGMA journal_mode=WAL');
    db.close();
    const before = { db: fingerprint(f.database), files: readdirSync(f.root) };
    expect(f.run().status).toBe(1);
    expect({ db: fingerprint(f.database), files: readdirSync(f.root) }).toEqual(before);
  });

  it.skipIf(!process.env.ARCH_REPLICA_NODE)('verifies both safe and unsafe fixtures with the target standalone Node runtime', () => {
    const safe = fixture();
    const unsafe = fixture('{"mode":"on"}');
    const accepted = safe.run([], process.env.ARCH_REPLICA_NODE!);
    expect(accepted.status, accepted.stderr).toBe(0);
    expect(JSON.parse(accepted.stdout).replica_verified).toBe(true);
    const rejected = unsafe.run([], process.env.ARCH_REPLICA_NODE!);
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toBe('');
  });
});
