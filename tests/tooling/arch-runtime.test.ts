import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../deploy/remote/prepare-arch-runtime.mjs', import.meta.url));
const image = process.env.ARCH_RUNTIME_IMAGE ?? 'node:22-bookworm-slim';
const available = spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore', timeout: 5000 }).status === 0;
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(environment: 'production' | 'preview' = 'production') {
  const root = mkdtempSync(join(tmpdir(), 'geek-arch-runtime-'));
  roots.push(root);
  const config = join(root, 'config');
  const templates = join(root, 'templates');
  mkdirSync(config);
  mkdirSync(templates);
  const port = environment === 'production' ? 18100 : 18200;
  const origin = environment === 'production' ? 'https://yangtzeu.work' : 'https://prev.yangtzeu.work';
  const source = [
    `GEEK_DEPLOYMENT_ENVIRONMENT=${environment}`, `GEEK_ENVIRONMENT_ORIGIN=${origin}`,
    `COMPOSE_PROJECT_NAME=yzgc-${environment}`, `STACK_ROOT=/opt/yzgc/${environment}`,
    `IMAGE_TAG=${environment === 'production' ? 'd4a24749d077' : '02cb751c0b83'}`, `PUBLIC_ORIGIN=${origin}`,
    'TRUST_PROXY=2', 'ENCRYPTION_KEY=synthetic_encryption_material', 'SESSION_SECRET=synthetic_session_material',
    'OAUTH_CLIENT_ID=synthetic_client', 'OAUTH_CLIENT_SECRET=synthetic_client_material',
    'GITLAB_SYNC=on', 'MAIL_RECIPIENTS=all', 'MAIL_ALLOWLIST=fixture@example.test',
    'OLD_VERSION_KEY="keep this legacy value"', '# preserve the old image configuration', '',
  ].join('\n');
  const template = [
    `GEEK_DEPLOYMENT_ENVIRONMENT=${environment}`, `GEEK_ENVIRONMENT_ORIGIN=${origin}`, `PUBLIC_ORIGIN=${origin}`,
    `COMPOSE_PROJECT_NAME=yzgc-${environment}`, `STACK_ROOT=/opt/yzgc/${environment}`,
    'IMAGE_TAG=unset', 'DEPLOY_HOST=10.66.0.2', 'DEPLOY_PORT=22', 'DEPLOY_USER=root',
    'DEPLOY_PROXY_JUMP=root@156.238.244.78:22', `WEB_BIND=10.66.0.2:${port}`, `SERVER_BIND=127.0.0.1:${port + 1}`,
    'TRUST_PROXY=2', 'ENCRYPTION_KEY=', 'SESSION_SECRET=', 'OAUTH_CLIENT_ID=', 'OAUTH_CLIENT_SECRET=',
    'GITLAB_SYNC=on', 'MAIL_RECIPIENTS=all', 'MAIL_ALLOWLIST=', '',
  ].join('\n');
  const file = join(config, `.env.${environment}`);
  const templateFile = join(templates, `.env.${environment}`);
  writeFileSync(file, source, { mode: 0o644 });
  writeFileSync(templateFile, template);
  const run = () => spawnSync('docker', [
    'run', '--rm', '--pull', 'never', '--network', 'none',
    '--mount', `type=bind,src=${config},dst=/config`,
    '--mount', `type=bind,src=${templates},dst=/templates,readonly`,
    '--mount', `type=bind,src=${script},dst=/work/prepare-arch-runtime.mjs,readonly`,
    image, 'node', '/work/prepare-arch-runtime.mjs', environment,
  ], { encoding: 'utf8', timeout: 15000 });
  return { file, templateFile, source, template, run };
}

describe.skipIf(!available)('Arch runtime preparation CLI (isolated Node 22 container)', () => {
  it('rejects duplicate control keys even with dotenv whitespace without changing the original', () => {
    const f = fixture();
    const source = `${f.source}  GITLAB_SYNC = on\n`;
    writeFileSync(f.file, source);
    const result = f.run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(readFileSync(f.file, 'utf8')).toBe(source);
  });

  it.each([
    ['GEEK_ENVIRONMENT_ORIGIN=https://yangtzeu.work', 'GEEK_ENVIRONMENT_ORIGIN=https://prev.yangtzeu.work'],
    ['COMPOSE_PROJECT_NAME=yzgc-production', 'COMPOSE_PROJECT_NAME=yzgc-preview'],
    ['STACK_ROOT=/opt/yzgc/production', 'STACK_ROOT=/opt/yzgc/preview'],
    ['IMAGE_TAG=d4a24749d077', 'IMAGE_TAG=02cb751c0b83'],
  ])('rejects mixed environment identity: %s', (before, after) => {
    const f = fixture();
    const source = f.source.replace(before, after);
    writeFileSync(f.file, source);
    const result = f.run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(readFileSync(f.file, 'utf8')).toBe(source);
  });

  it('rejects unsupported dotenv syntax without echoing configuration or modifying the file', () => {
    const f = fixture();
    const source = `${f.source}export GITLAB_SYNC=on\n`;
    writeFileSync(f.file, source);
    const result = f.run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(readFileSync(f.file, 'utf8')).toBe(source);
    expect(`${result.stdout}${result.stderr}`).not.toContain('synthetic_encryption_material');
  });

  it.each(['production', 'preview'] as const)('prepares %s safely with quoted identity and preserves old keys and credentials', environment => {
    const f = fixture(environment);
    writeFileSync(f.file, f.source.replace(/^((?:GEEK_[A-Z_]+|COMPOSE_PROJECT_NAME|STACK_ROOT|IMAGE_TAG|PUBLIC_ORIGIN))=(.*)$/gm, '  $1 = "$2"'));
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ scope: 'env', replica_verified: false });
    const output = readFileSync(f.file, 'utf8');
    expect(output).toContain('GITLAB_SYNC=off\n');
    expect(output).toContain('MAIL_RECIPIENTS=allowlist\nMAIL_ALLOWLIST=\n');
    expect(output).toContain('ENCRYPTION_KEY=synthetic_encryption_material\n');
    expect(output).toContain('OLD_VERSION_KEY="keep this legacy value"\n');
    expect(statSync(f.file).mode & 0o777).toBe(0o600);
    expect(`${result.stdout}${result.stderr}`).not.toContain('synthetic_encryption_material');
    expect(`${result.stdout}${result.stderr}`).not.toContain('fixture@example.test');
    expect(f.run().status).toBe(0);
    expect(readFileSync(f.file, 'utf8')).toBe(output);
  });

  it.each([
    ['PUBLIC_ORIGIN=https://yangtzeu.work', 'PUBLIC_ORIGIN=https://prev.yangtzeu.work'],
    ['WEB_BIND=10.66.0.2:18100', 'WEB_BIND=10.66.0.2:18200'],
    ['TRUST_PROXY=2', 'TRUST_PROXY=true'],
  ])('rejects a target template from the wrong environment or topology: %s', (before, after) => {
    const f = fixture();
    writeFileSync(f.templateFile, f.template.replace(before, after));
    const result = f.run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(readFileSync(f.file, 'utf8')).toBe(f.source);
  });

  it('refuses to prepare encrypted data without the original encryption key', () => {
    const f = fixture();
    const source = f.source.replace('ENCRYPTION_KEY=synthetic_encryption_material', 'ENCRYPTION_KEY=');
    writeFileSync(f.file, source);
    const result = f.run();
    expect(result.status, result.stderr).not.toBe(0);
    expect(readFileSync(f.file, 'utf8')).toBe(source);
  });
});
