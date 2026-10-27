import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('site forum keeps authoritative content out of the static/client artifact', () => {
  it('boots from an empty projection and does not import published bodies into client code', () => {
    expect(read('app/forum/shared/site-state.ts')).not.toMatch(/publishedContent|content\/published|curatedCategories|curatedTags/);
    expect(read('app/forum/app/composables/useSiteAccount.ts')).not.toMatch(/shared\/published|publishedTopicIds/);
    expect(read('app/forum/nuxt.config.ts')).not.toMatch(/publishedTopicIds|shared\/published/);
    const adoption = read('app/forum/ADOPTION.json');
    expect(adoption).toContain('empty client/bootstrap projection');
    expect(adoption).not.toContain('with its own categories and tags plus the old-forum documents');
  });

  it('site builds do not prerender or retain llms, topic Markdown or published images', () => {
    const dockerfile = read('app/forum/Dockerfile');
    expect(dockerfile).not.toMatch(/test -s \.output\/public\/llms\.txt|test -s \.output\/public\/t\/t\d+\.md/);
    expect(dockerfile).toContain('rm -rf .output/public/llms.txt .output/public/t/*.md .output/public/published');
    expect(dockerfile).not.toMatch(/try_files \$uri =404;[\s\S]{0,300}给 AI 读取/);
  });

  it('site dev proxies docs and published assets to the same core /forum authorization surface', () => {
    const middleware = read('app/forum/server/middleware/forum-markdown.ts');
    expect(middleware).toContain("useRuntimeConfig().public.contentSource === 'site'");
    expect(middleware).toContain('proxyRequest(event');
    expect(middleware).toContain('/forum');
    expect(middleware).toContain('published');
  });
});
