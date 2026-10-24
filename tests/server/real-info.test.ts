import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { accountIdOf, activityRows, completeProfile, grantPermGroup, grantPermNode, signIn, testApp } from './helpers';

/**
 * 真实姓名和年级（#280）：缺了先补资料，本人只能填一次，之后由有 users.manage 的管理员在控制台改；
 * 年级按北京时间每年 9 月 1 日自动升一级；真实姓名只回给本人和有 users.manage 的管理员。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const context of contexts.splice(0)) await context.close(); });

// 北京时间的某一刻：传 UTC 毫秒，减 8 小时
const bj = (y: number, m: number, d: number, hh = 0, mm = 0) => Date.UTC(y, m - 1, d, hh - 8, mm);

async function setup(start = bj(2026, 10, 24, 10)) {
  let now = start;
  const context = await testApp({ clock: () => now });
  contexts.push(context);
  return { app: context.app, setNow: (at: number) => { now = at; } };
}

function bare(app: FastifyInstance, login: string, githubId: number) {
  const sid = signIn(app, login, githubId);
  const accountId = accountIdOf(app, login);
  app.services.profiles.setRealInfo(accountId, null, null);
  return { sid, accountId, cookie: `sid=${sid}` };
}

const post = (app: FastifyInstance, cookie: string, url: string, payload: unknown) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie, origin: 'https://example.test' } });
const me = async (app: FastifyInstance, cookie: string) => (await app.inject({ url: '/auth/me', headers: { cookie } })).json();

describe('补资料关口与本人填写（#280）', () => {
  it('缺姓名和年级时三个 me 接口都报 profile_required，命令行确认被拦，userinfo 也带着这个标记', async () => {
    const { app } = await setup();
    const { cookie, accountId } = bare(app, 'alice', 101);
    // 普通注册用户不用填
    expect(await me(app, cookie)).toMatchObject({ signed_in: true, profile_required: false, real_name: null, grade: null });
    grantPermGroup(app, accountId, 'level.member');
    expect(await me(app, cookie)).toMatchObject({ signed_in: true, profile_required: true, real_name: null, grade: null, grade_label: null });
    expect((await app.inject({ url: '/api/identity/me', headers: { cookie } })).json()).toMatchObject({ profile_required: true, real_name: null, grade: null });
    grantPermNode(app, accountIdOf(app, 'alice'), 'console.access');
    expect((await app.inject({ url: '/api/console/me', headers: { cookie } })).json()).toMatchObject({ profile_required: true });

    const code = (await app.inject({ method: 'POST', url: '/auth/device/code', payload: { client_id: 'geek-cli', scope: 'openid profile' } })).json();
    const held = await post(app, cookie, '/api/identity/device/approve', { user_code: code.user_code, decision: 'approve' });
    expect([held.statusCode, held.json().error]).toEqual([403, 'profile_required']);
    // 拒绝不拦
    expect((await post(app, cookie, '/api/identity/device/approve', { user_code: code.user_code, decision: 'deny' })).statusCode).toBe(200);
  });

  it('本人只能填一次：校验姓名，填好后年级按学年算，再提交回 409；操作记录不留姓名', async () => {
    const { app } = await setup();
    const { cookie, accountId } = bare(app, 'alice', 101);
    const badName = await post(app, cookie, '/api/identity/real-info', { real_name: 'a1', grade: 2 });
    expect([badName.statusCode, badName.json().error]).toEqual([400, 'bad_real_name']);
    expect((await post(app, cookie, '/api/identity/real-info', { real_name: '刘爱丽', grade: 5 })).statusCode).toBe(400);
    expect((await post(app, cookie, '/api/identity/real-info', { real_name: '刘爱丽' })).statusCode).toBe(400);

    const filled = await post(app, cookie, '/api/identity/real-info', { real_name: '  刘爱丽 ', grade: 2 });
    expect(filled.statusCode).toBe(200);
    expect(filled.json()).toEqual({ real_name: '刘爱丽', grade: 2, grade_label: '大二', profile_required: false });
    expect(app.services.profiles.realInfo(accountId).enrollment_year).toBe(2025);
    expect(await me(app, cookie)).toMatchObject({ profile_required: false, real_name: '刘爱丽', grade: 2, grade_label: '大二' });

    const again = await post(app, cookie, '/api/identity/real-info', { real_name: '别的名字', grade: 1 });
    expect([again.statusCode, again.json().error]).toEqual([409, 'real_info_locked']);
    expect(app.services.profiles.realInfo(accountId)).toMatchObject({ real_name: '刘爱丽', grade: 2 });

    const rows = activityRows(app, { action: 'account.real_info' });
    expect(rows.map(row => row.meta)).toEqual([{ filled: ['real_name', 'grade'], grade: 2 }]);
    expect(JSON.stringify(activityRows(app))).not.toContain('刘爱丽');
  });

  it('只缺一项时只补缺的那一项，已有的不被覆盖', async () => {
    const { app } = await setup();
    const { cookie, accountId } = bare(app, 'alice', 101);
    app.services.profiles.setRealInfo(accountId, '刘爱丽', null);
    const res = await post(app, cookie, '/api/identity/real-info', { real_name: '换个名字', grade: 3 });
    expect(res.json()).toEqual({ real_name: '刘爱丽', grade: 3, grade_label: '大三', profile_required: false });
    expect(activityRows(app, { action: 'account.real_info' })[0].meta).toEqual({ filled: ['grade'], grade: 3 });
  });

  it('每年 9 月 1 日（北京时间）零点升一级，大四之后是已毕业，已毕业不算缺资料', async () => {
    const { app, setNow } = await setup(bj(2026, 10, 24, 10));
    const junior = bare(app, 'junior', 101);
    const senior = bare(app, 'senior', 102);
    await post(app, junior.cookie, '/api/identity/real-info', { real_name: '大一同学', grade: 1 });
    await post(app, senior.cookie, '/api/identity/real-info', { real_name: '大四同学', grade: 4 });

    // 会话 7 天就过期：每次拨表后重新登录一次再读 /auth/me
    const meAt = async (at: number, login: string, githubId: number) => { setNow(at); return me(app, `sid=${signIn(app, login, githubId)}`); };
    expect(await meAt(bj(2027, 8, 31, 23, 59), 'junior', 101)).toMatchObject({ grade: 1, grade_label: '大一' });
    expect(await meAt(bj(2027, 8, 31, 23, 59), 'senior', 102)).toMatchObject({ grade: 4, grade_label: '大四' });
    expect(await meAt(bj(2027, 9, 1, 0, 0), 'junior', 101)).toMatchObject({ grade: 2, grade_label: '大二', profile_required: false });
    expect(await meAt(bj(2027, 9, 1, 0, 0), 'senior', 102)).toMatchObject({ grade: 'graduated', grade_label: '已毕业', profile_required: false });
  });
});

describe('控制台用户页的姓名和年级（#280）', () => {
  async function adminSetup() {
    const { app } = await setup();
    const admin = signIn(app, 'admin', 201);
    const adminId = accountIdOf(app, 'admin');
    grantPermNode(app, adminId, 'users.view');
    signIn(app, 'member', 202);
    const memberId = accountIdOf(app, 'member');
    completeProfile(app, memberId, '王小明', 3);
    return { app, adminCookie: `sid=${admin}`, adminId, memberId };
  }
  const list = async (app: FastifyInstance, cookie: string, q = '') =>
    (await app.inject({ url: `/api/console/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, headers: { cookie } })).json() as { items: Record<string, unknown>[] };
  const patch = (app: FastifyInstance, cookie: string, id: string, payload: unknown) =>
    app.inject({ method: 'PATCH', url: `/api/console/users/${id}`, payload: payload as object, headers: { cookie, origin: 'https://example.test' } });

  it('只有 users.view 时看得到年级、看不到真实姓名，也不能按姓名搜；有 users.manage 才看得到和搜得到', async () => {
    const { app, adminCookie, adminId, memberId } = await adminSetup();
    const viewOnly = (await list(app, adminCookie)).items.find(item => item.account_id === memberId)!;
    expect(viewOnly).toMatchObject({ grade: 3, grade_label: '大三' });
    expect(viewOnly).not.toHaveProperty('real_name');
    expect((await list(app, adminCookie, '王小明')).items).toEqual([]);

    grantPermNode(app, adminId, 'users.manage');
    const managed = (await list(app, adminCookie)).items.find(item => item.account_id === memberId)!;
    expect(managed).toMatchObject({ real_name: '王小明', grade: 3, grade_label: '大三' });
    expect((await list(app, adminCookie, '小明')).items.map(item => item.account_id)).toEqual([memberId]);
  });

  it('改姓名和年级要 users.manage；改了写操作记录但不记姓名；清空后本人要重新填', async () => {
    const { app, adminCookie, adminId, memberId } = await adminSetup();
    expect((await patch(app, adminCookie, memberId, { real_name: '王晓明' })).statusCode).toBe(403);
    grantPermNode(app, adminId, 'users.manage');
    const bad = await patch(app, adminCookie, memberId, { real_name: '<b>' });
    expect([bad.statusCode, bad.json().error]).toEqual([400, 'bad_real_name']);

    const changed = await patch(app, adminCookie, memberId, { real_name: '王晓明', grade: 1 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ real_name: '王晓明', grade: 1, grade_label: '大一' });
    const [record] = activityRows(app, { action: 'users.update' });
    expect(record.meta).toEqual({
      before: expect.objectContaining({ has_real_name: true, enrollment_year: 2024 }),
      after: expect.objectContaining({ has_real_name: true, enrollment_year: 2026 }),
      real_name_changed: true,
    });
    expect(JSON.stringify(activityRows(app))).not.toMatch(/王小明|王晓明/);

    // 只改年级：姓名不变，记录里 real_name_changed 为 false
    await patch(app, adminCookie, memberId, { grade: 2 });
    expect(activityRows(app, { action: 'users.update' })[1].meta.real_name_changed).toBe(false);
    expect(app.services.profiles.realInfo(memberId)).toMatchObject({ real_name: '王晓明', grade: 2 });

    await patch(app, adminCookie, memberId, { real_name: null, grade: null });
    expect(app.services.profiles.profileRequired(memberId)).toBe(true);
  });
});

describe('真实姓名不出现在公开的地方（#280）', () => {
  // 读 account_profiles.real_name 的服务端文件只有这些：账号资料本身、本人的 me 接口和补资料、邮箱注册、控制台用户页。
  // 论坛、天梯、比赛、OIDC/GitLab 同步要是读了它，这里会失败，先确认是不是真的要公开再加进来。
  const ALLOWED = [
    'lib/account-profiles.ts', 'routes/admin/auth.ts', 'routes/console/contracts.ts', 'routes/console/users.ts',
    'routes/identity/account.ts', 'routes/identity/contracts.ts', 'routes/identity/email.ts', 'lib/db.ts',
  ];
  it('只有本人和用户管理相关的文件读写 real_name', () => {
    const root = fileURLToPath(new URL('../../app/server/src', import.meta.url));
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
    });
    const readers = walk(root).filter(path => readFileSync(path, 'utf8').includes('real_name')).map(path => relative(root, path)).sort();
    expect(readers).toEqual([...ALLOWED].sort());
  });

  it('GitLab 同步用的账号目录和 OIDC 的账号资料里没有真实姓名', async () => {
    const { app } = await setup();
    signIn(app, 'alice', 101);
    const accountId = accountIdOf(app, 'alice');
    completeProfile(app, accountId, '刘爱丽');
    const claims = app.services.identity.getAccountClaims(accountId);
    const synced = app.services.identity.listAccountsForSync();
    expect(JSON.stringify([claims, synced])).not.toContain('刘爱丽');
  });
});
