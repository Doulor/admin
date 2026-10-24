// 比赛官网托管（#278，CONTRACT-278 §1）：站点包校验、上传与发布的权限和 step-up、/c/<slug>/ 的响应头、预览的签名路径。
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSitePackage, SITE_LIMITS, writeZip } from '../../app/server/src/lib/site-package';
import { SITE_CSP } from '../../app/server/src/routes/sites/index';
import { activityRows } from './helpers';
import { contestSetup, sitePackage, upload, type ContestContext } from './contest-fixtures';

const contexts: ContestContext[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});
async function setup() {
  const context = await contestSetup();
  contexts.push(context);
  return context;
}

/** 改中央目录里某个文件的「生成系统 + 外部属性」，造出符号链接或带加密标记的条目。 */
function patchCentral(zip: Buffer, name: string, patch: (central: Buffer, at: number) => void): Buffer {
  const copy = Buffer.from(zip);
  for (let at = 0; at < copy.length - 4; at++) {
    if (copy.readUInt32LE(at) !== 0x02014b50) continue;
    const length = copy.readUInt16LE(at + 28);
    if (copy.subarray(at + 46, at + 46 + length).toString('utf8') === name) patch(copy, at);
  }
  return copy;
}

describe('站点包校验（lib/site-package.ts）', () => {
  it('收下合规的包，按声明的大小与 CRC 解出文件', () => {
    const result = checkSitePackage(sitePackage(), 'oss');
    expect(result.ok).toBe(true);
    expect(result.files.map(file => file.path).sort()).toEqual(['assets/app.js', 'index.html', 'yzgc-site.json']);
    expect(result.manifest).toEqual({ name: '第一期官网', version: '1.0.0', sdk: 'competition/v1' });
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('逐条写出拒绝原因：路径、隐藏文件、扩展名、缺文件、清单和比赛不一致', () => {
    const bad = writeZip([
      { path: 'index.html', data: Buffer.from('x') },
      { path: '../escape.js', data: Buffer.from('x') },
      { path: '/abs.js', data: Buffer.from('x') },
      { path: 'assets/.env.js', data: Buffer.from('x') },
      { path: 'run.sh', data: Buffer.from('x') },
      { path: 'a//b.js', data: Buffer.from('x') },
      { path: 'yzgc-site.json', data: Buffer.from(JSON.stringify({ name: 'x', version: '1', sdk: 'v1', competition_id: 'other' })) },
    ]);
    const result = checkSitePackage(bad, 'oss');
    expect(result.ok).toBe(false);
    expect(result.files).toEqual([]);
    const text = result.report.join('\n');
    expect(text).toContain('../escape.js：不能包含 ..');
    expect(text).toContain('/abs.js：不能用绝对路径');
    expect(text).toContain('assets/.env.js：不能包含以 . 开头的文件或目录');
    expect(text).toContain('run.sh：扩展名不在允许的列表里');
    expect(text).toContain('a//b.js：路径里有空段或 .');

    const mismatch = checkSitePackage(sitePackage([], { competition_id: 'other' }), 'oss');
    expect(mismatch.report.join('\n')).toContain('和要上传到的比赛 oss 不一致');
    expect(checkSitePackage(writeZip([{ path: 'yzgc-site.json', data: Buffer.from('{}') }]), null).report).toContain('根目录必须有 index.html');
    expect(checkSitePackage(writeZip([{ path: 'index.html', data: Buffer.from('x') }]), null).report).toContain('根目录必须有 yzgc-site.json');
    expect(checkSitePackage(sitePackage([], { version: '' }), null).ok).toBe(false);
    expect(checkSitePackage(Buffer.from('not a zip'), null).report).toEqual(['不是 zip 文件（找不到中央目录）']);
  });

  it('拒绝符号链接、加密条目、重复文件、超过 500 个文件和超过 20MB 的包', () => {
    const symlink = patchCentral(sitePackage([{ path: 'link.js', data: Buffer.from('/etc/passwd') }]), 'link.js', (zip, at) => {
      zip.writeUInt32LE(((0o120777 << 16) >>> 0), at + 38);
    });
    expect(checkSitePackage(symlink, null).report).toContain('link.js：不能是符号链接');
    const encrypted = patchCentral(sitePackage(), 'assets/app.js', (zip, at) => zip.writeUInt16LE(zip.readUInt16LE(at + 8) | 1, at + 8));
    expect(checkSitePackage(encrypted, null).report).toContain('assets/app.js：加密的文件不收');
    const duplicate = writeZip([
      { path: 'index.html', data: Buffer.from('x') }, { path: 'INDEX.html', data: Buffer.from('y') },
      { path: 'yzgc-site.json', data: Buffer.from(JSON.stringify({ name: 'x', version: '1', sdk: 'v1' })) },
    ]);
    expect(checkSitePackage(duplicate, null).report).toContain('INDEX.html：重复的文件（不分大小写）');
    const many = sitePackage(Array.from({ length: SITE_LIMITS.files }, (_, index) => ({ path: `f/${index}.txt`, data: Buffer.from('1') })));
    expect(checkSitePackage(many, null).report.join('\n')).toContain('超过 500 个');
    const big = Buffer.alloc(SITE_LIMITS.zipBytes + 1);
    expect(checkSitePackage(big, null).report[0]).toContain('超过 20MB');
  });

  it('解压后比声明的大的条目当压缩炸弹拒绝', () => {
    const zip = sitePackage([{ path: 'big.txt', data: Buffer.alloc(4096, 97) }]);
    const lying = patchCentral(zip, 'big.txt', (copy, at) => copy.writeUInt32LE(10, at + 24));
    expect(checkSitePackage(lying, null).report.join('\n')).toContain('big.txt：解压失败或比声明的大小大');
  });
});

describe('上传、发布与托管（/api/console/competitions/:id/site、/c/:slug/）', () => {
  it('上传要 competition.site.publish 与 step-up，外部赛不能传；不合规的包只留一条 rejected 版本、不落文件', async () => {
    const { app, as, createCompetition, makeStale } = await setup();
    const id = await createCompetition();
    expect((await upload(app, id, sitePackage(), {})).statusCode).toBe(401);
    expect((await upload(app, id, sitePackage(), as('alice'))).json()).toMatchObject({ error: 'forbidden', node: 'competition.site.publish' });
    const external = await createCompetition({ kind: 'external', url: 'https://example.org/contest' });
    expect((await upload(app, external, sitePackage(), as('owner'))).json().error).toBe('competition_not_internal');

    const rejected = await upload(app, id, sitePackage([{ path: 'evil.sh', data: Buffer.from('x') }]), as('owner'));
    expect(rejected.statusCode).toBe(422);
    expect(rejected.json()).toMatchObject({ error: 'site_rejected', report: ['evil.sh：扩展名不在允许的列表里'] });
    const state = await app.inject({ url: `/api/console/competitions/${id}/site`, headers: as('owner') });
    expect(state.json().versions).toHaveLength(1);
    expect(state.json().versions[0]).toMatchObject({ status: 'rejected', preview_url: null, files: 0 });
    expect(existsSync(join(app.services.competitionSites.root, id))).toBe(false);

    makeStale('owner');
    expect((await upload(app, id, sitePackage(), as('owner'))).json().error).toBe('step_up_required');
  });

  it('发布时定下 slug，之后托管带 sandbox CSP、不回 Set-Cookie；回滚是发布旧版本，下线后 404', async () => {
    const { app, as, createCompetition } = await setup();
    const id = await createCompetition();
    const first = await upload(app, id, sitePackage(), as('owner'));
    expect(first.statusCode).toBe(201);
    const v1 = first.json();
    expect(v1).toMatchObject({ status: 'passed', version: '1.0.0', files: 3, report: ['通过：3 个文件，解压后 ' + v1.report[0].match(/(\d+) 字节/)[1] + ' 字节'] });
    expect(v1.preview_url).toBe(`/c/${id}/~preview/${v1.id}/`);
    expect(readdirSync(join(app.services.competitionSites.root, id))).toEqual([v1.id]);

    const publish = (payload: Record<string, unknown>, login = 'owner') =>
      app.inject({ method: 'POST', url: `/api/console/competitions/${id}/site/publish`, headers: as(login), payload });
    expect((await publish({ version_id: v1.id })).json().error).toBe('slug_required');
    expect((await publish({ version_id: v1.id, slug: 'Bad Slug' })).statusCode).toBe(400);
    expect((await publish({ version_id: v1.id, slug: 'oss-2026' }, 'alice')).statusCode).toBe(403);
    const published = await publish({ version_id: v1.id, slug: 'oss-2026' });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ slug: 'oss-2026', live_version_id: v1.id, site_url: '/c/oss-2026/' });
    expect((await publish({ version_id: v1.id, slug: 'other-slug' })).json().error).toBe('slug_locked');
    const another = await createCompetition({ name: '另一场' });
    const otherVersion = (await upload(app, another, sitePackage(), as('owner'))).json();
    expect((await app.inject({ method: 'POST', url: `/api/console/competitions/${another}/site/publish`, headers: as('owner'), payload: { version_id: otherVersion.id, slug: 'oss-2026' } })).json().error).toBe('slug_taken');

    const page = await app.inject({ url: '/c/oss-2026/', headers: as('alice') });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-security-policy']).toBe(SITE_CSP);
    expect(SITE_CSP).toContain('sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox');
    expect(page.headers['cache-control']).toBe('public, max-age=300');
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    expect(page.headers['access-control-allow-origin']).toBe('*');
    expect(page.headers['set-cookie']).toBeUndefined();
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(page.body).toContain('<title>oss</title>');
    expect((await app.inject({ url: '/c/oss-2026/assets/app.js' })).headers['content-type']).toBe('text/javascript; charset=utf-8');
    const bare = await app.inject({ url: '/c/oss-2026' });
    expect(bare.statusCode).toBe(301);
    expect(bare.headers.location).toBe('/c/oss-2026/');
    expect((await app.inject({ url: '/c/oss-2026/missing.js' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/c/oss-2026/..%2F..%2Fdata.db' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/c/no-such-site/' })).statusCode).toBe(404);

    // 回滚：传第二版、发布，再发布第一版
    const v2 = (await upload(app, id, sitePackage([{ path: 'index.html', data: Buffer.from('<title>v2</title>') }], { version: '2.0.0' }), as('owner'))).json();
    await publish({ version_id: v2.id });
    expect((await app.inject({ url: '/c/oss-2026/' })).body).toContain('v2');
    await publish({ version_id: v1.id });
    expect((await app.inject({ url: '/c/oss-2026/' })).body).toContain('<title>oss</title>');
    const actions = activityRows(app, { actionLike: 'competition.site.%' }).filter(row => row.outcome === 'ok').map(row => row.action);
    expect(actions.filter(action => action === 'competition.site.publish')).toHaveLength(3);
    expect(actions).toContain('competition.site.upload');

    // 已发布的比赛不能改成外部赛
    const toExternal = await app.inject({ method: 'PATCH', url: `/api/console/competitions/${id}`, headers: as('owner'), payload: { kind: 'external' } });
    expect(toExternal.json().error).toBe('competition_site_published');
    // 下线比赛 → 官网 404；恢复后又能看
    await app.inject({ method: 'PATCH', url: `/api/console/competitions/${id}`, headers: as('owner'), payload: { offline: true } });
    expect((await app.inject({ url: '/c/oss-2026/' })).statusCode).toBe(404);
    await app.inject({ method: 'PATCH', url: `/api/console/competitions/${id}`, headers: as('owner'), payload: { offline: false } });
    expect((await app.inject({ url: '/c/oss-2026/' })).statusCode).toBe(200);
    // 下线官网：版本保留，地址 404，公开接口的 site_url 变回 null
    const unpublished = await app.inject({ method: 'DELETE', url: `/api/console/competitions/${id}/site`, headers: as('owner') });
    expect(unpublished.json()).toMatchObject({ slug: 'oss-2026', live_version_id: null, site_url: null });
    expect(unpublished.json().versions).toHaveLength(2);
    expect((await app.inject({ url: '/c/oss-2026/' })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/public/competitions/${id}` })).json().site_url).toBeNull();
  });

  it('预览：没有权限一律 404；有权限的会话跳到带签名的地址，签名地址不带 cookie 也能读，改过或过期的签名 404', async () => {
    const { app, as, createCompetition } = await setup();
    const id = await createCompetition();
    const version = (await upload(app, id, sitePackage(), as('owner'))).json();
    const url = `/c/${id}/~preview/${version.id}/`;
    expect((await app.inject({ url })).statusCode).toBe(404);
    expect((await app.inject({ url, headers: as('alice') })).statusCode).toBe(404);
    const redirected = await app.inject({ url, headers: as('owner') });
    expect(redirected.statusCode).toBe(302);
    const location = redirected.headers.location as string;
    expect(location).toMatch(new RegExp(`^/c/${id}/~preview/${version.id}\\.[0-9]+\\.[A-Za-z0-9_-]{32}/$`));
    const page = await app.inject({ url: location });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-security-policy']).toBe(SITE_CSP);
    expect(page.headers['cache-control']).toBe('private, no-store');
    expect((await app.inject({ url: `${location}assets/app.js` })).statusCode).toBe(200);
    const tampered = location.replace(/[A-Za-z0-9_-](\/)$/, ch => (ch[0] === 'A' ? 'B' : 'A') + '/');
    expect((await app.inject({ url: tampered })).statusCode).toBe(404);
    const [, , , token] = location.split('/');
    const [versionId, , signature] = token.split('.');
    expect((await app.inject({ url: `/c/${id}/~preview/${versionId}.1000000000.${signature}/` })).statusCode).toBe(404);
    // 不合规的版本没有预览；别的比赛的版本也对不上
    const rejected = (await upload(app, id, sitePackage([{ path: 'x.exe', data: Buffer.from('x') }]), as('owner'))).json();
    expect(rejected.error).toBe('site_rejected');
    const other = await createCompetition({ name: '别的比赛' });
    expect((await app.inject({ url: `/c/${other}/~preview/${version.id}/`, headers: as('owner') })).statusCode).toBe(404);
  });

  it('删比赛时连同站点文件一起删', async () => {
    const { app, as, createCompetition } = await setup();
    const id = await createCompetition();
    await upload(app, id, sitePackage(), as('owner'));
    expect(existsSync(join(app.services.competitionSites.root, id))).toBe(true);
    const removed = await app.inject({ method: 'DELETE', url: `/api/console/competitions/${id}`, headers: as('owner') });
    expect(removed.statusCode).toBe(200);
    expect(existsSync(join(app.services.competitionSites.root, id))).toBe(false);
    expect(app.services.storage.db.prepare('SELECT COUNT(*) AS n FROM competition_site_versions WHERE competition_id = ?').get(id)).toEqual({ n: 0 });
  });
});
