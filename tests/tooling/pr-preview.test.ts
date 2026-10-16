import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error 纯 .mjs 脚本，没有类型声明
import { assemble } from '../../scripts/pr-preview.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

function put(root: string, path: string, content: string) {
  const file = join(root, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

function fixture() {
  const tmp = mkdtempSync(join(tmpdir(), 'pr-preview-'));
  put(tmp, 'web/sites/portal/index.html', 'portal');
  put(tmp, 'web/assets/a.js', 'a');
  put(tmp, 'console/sites/console/index.html', 'console');
  put(tmp, 'console/console-assets/b.js', 'b');
  put(tmp, 'forum/200.html', 'forum');
  put(tmp, 'forum/_nuxt/c.js', 'c');
  return tmp;
}

describe('scripts/pr-preview.mjs assemble', () => {
  it('merges web and console at the root and the forum under /forum/', () => {
    const tmp = fixture();
    try {
      const result = assemble({ web: join(tmp, 'web'), console: join(tmp, 'console'), forum: join(tmp, 'forum'), out: join(tmp, 'out') });
      expect(result.files).toBe(6);
      expect(readFileSync(join(tmp, 'out/sites/portal/index.html'), 'utf8')).toBe('portal');
      expect(readFileSync(join(tmp, 'out/sites/console/index.html'), 'utf8')).toBe('console');
      expect(readFileSync(join(tmp, 'out/forum/200.html'), 'utf8')).toBe('forum');
      expect(readdirSync(join(tmp, 'out/forum/_nuxt'))).toEqual(['c.js']);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  it('works without the forum', () => {
    const tmp = fixture();
    try {
      const result = assemble({ web: join(tmp, 'web'), console: join(tmp, 'console'), out: join(tmp, 'out') });
      expect(result.files).toBe(4);
      expect(() => statSync(join(tmp, 'out/forum'))).toThrow();
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  it('fails when an entry page is missing or two outputs disagree on a file', () => {
    const tmp = fixture();
    try {
      rmSync(join(tmp, 'console/sites'), { recursive: true });
      expect(() => assemble({ web: join(tmp, 'web'), console: join(tmp, 'console'), out: join(tmp, 'out') })).toThrow(/控制台入口/);
      put(tmp, 'console/sites/console/index.html', 'console');
      put(tmp, 'console/assets/a.js', 'different');
      expect(() => assemble({ web: join(tmp, 'web'), console: join(tmp, 'console'), out: join(tmp, 'out') })).toThrow(/内容不同/);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe('PR preview build flag (#245)', () => {
  const FLAG = 'VITE_PREVIEW_MOCK';

  it('is set only by netlify.toml, never by image builds or release workflows', () => {
    expect(read('netlify.toml')).toContain(`${FLAG}=1 pnpm --filter @yzgc/web build`);
    expect(read('netlify.toml')).toContain(`${FLAG}=1 pnpm --filter @yzgc/console build`);
    for (const path of [
      'app/web/Dockerfile', 'app/forum/Dockerfile', 'app/server/Dockerfile',
      'deploy/compose/production.yml', 'deploy/compose/preview.yml',
      '.github/workflows/ci.yml', '.github/workflows/deploy-preview.yml', '.github/workflows/deploy-production.yml',
    ]) expect(read(path), path).not.toContain(FLAG);
  });

  it('is read only through the two compile-time constants that keep the mock out of release builds', () => {
    expect(read('app/web/shared/config/index.ts')).toContain(`import.meta.env.${FLAG} === "1"`);
    expect(read('app/console/src/lib/runtime.ts')).toContain(`import.meta.env.${FLAG} === "1"`);
    expect(read('app/web/shared/lib/api.ts')).toContain('(import.meta.env.DEV || PREVIEW_MOCK)');
    expect(read('app/console/src/lib/http.ts')).toContain('(import.meta.env.DEV || PREVIEW_MOCK)');
  });
});

describe('netlify.toml routing', () => {
  const toml = read('netlify.toml');
  const rules = [...toml.matchAll(/\[\[redirects\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"\s+status = (\d+)(\s+force = true)?/g)]
    .map(match => ({ from: match[1], to: match[2], status: Number(match[3]), force: Boolean(match[4]) }));

  it('blocks the backend first and falls back to the entry pages last', () => {
    expect(rules[0]).toMatchObject({ from: '/api/*', status: 404, force: true });
    expect(rules[1]).toMatchObject({ from: '/auth/*', status: 404, force: true });
    expect(rules.at(-1)).toMatchObject({ from: '/*', to: '/sites/portal/index.html', status: 200, force: false });
  });

  it('sends the console routes to the console entry without forcing over real files', () => {
    for (const from of ['/admin', '/admin/*', '/console', '/console/*', '/signin']) {
      expect(rules.find(rule => rule.from === from), from).toMatchObject({ to: '/sites/console/index.html', status: 200, force: false });
    }
  });

  it('publishes the assembled directory and keeps previews out of search engines', () => {
    expect(toml).toContain('publish = "preview-site"');
    expect(toml).toContain('X-Robots-Tag = "noindex, nofollow"');
  });
});
