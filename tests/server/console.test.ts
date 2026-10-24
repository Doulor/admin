import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ServiceOverrides } from '../../app/server/src/services';
import { createConfig } from '../../app/server/src/config';
import { computeAccess, DEFAULT_DEPARTMENTS, DEFAULT_TITLE_CONFIGS, LEGACY_TITLE_DESCRIPTIONS } from '../../app/server/src/lib/roles';
import { createRoleStore } from '../../app/server/src/lib/role-store';
import { accountIdOf, grantPermGroup, grantPermNode, signIn, testApp } from './helpers';

const CONSOLE_ORG = 'Yangtze-University-Geek-Class';
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

function insertApplication(db: import('better-sqlite3').Database, patch: Record<string, unknown> = {}) {
  const row = {
    id: randomUUID(), name: '测试候选人', class_name: '计科2301', email: 'candidate@example.test',
    strengths: '熟悉 TypeScript，维护过一个开源小工具，愿意参与社区。', source_ip: '203.0.113.7', user_agent: 'fixture-agent/1.0',
    status: 'received', created_at: Date.now(), ...patch,
  };
  db.prepare('INSERT INTO applications(id, name, class_name, email, strengths, source_ip, user_agent, status, created_at) VALUES(@id, @name, @class_name, @email, @strengths, @source_ip, @user_agent, @status, @created_at)').run(row);
  return row;
}

/** #274 新权限体系的测试夹具：没有 GitHub 角色桩，权限直接用 grantPermNode/grantPermGroup 写进 perm_entries/perm_members。 */
const CONSOLE_USERS: Record<string, number> = { alice: 901, bob: 902, carol: 903, dave: 904, erin: 905, frank: 906, gina: 907 };
async function setupConsole() {
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  const sids = new Map<string, string>();
  const as = (login: string) => {
    if (!sids.has(login)) sids.set(login, signIn(app, login, CONSOLE_USERS[login]));
    return { cookie: `sid=${sids.get(login)}` };
  };
  // 先确保登录过（grantPermNode/grantPermGroup 按账号 id 写，账号 id 来自 sessions 表），再查账号 id。
  const accountId = (login: string) => { as(login); return accountIdOf(app, login); };
  const audits = () => app.services.storage.db.prepare('SELECT org, actor, action, target, details FROM audit_logs ORDER BY id').all() as { org: string | null; actor: string; action: string; target: string; details: string | null }[];
  return { app, as, accountId, audits, db: app.services.storage.db };
}

describe('GET /api/console/me、/api/console/summary（CONTRACT-274 §5、§7：按权限节点判定，取代旧的 site_role/capabilities 形状）', () => {
  it('rejects anonymous callers with 401', async () => {
    const { app } = await setupConsole();
    for (const url of ['/api/console/me', '/api/console/applications', '/api/console/feedback']) {
      const response = await app.inject(url);
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('not_signed_in');
    }
    // /api/console/users 没有单独挂 requireAuth 钩子，直接靠 requireScopedPermission 兜底判定登录态，回的 error 不一样。
    const users = await app.inject('/api/console/users');
    expect(users.statusCode).toBe(401);
    expect(users.json().error).toBe('unauthenticated');
  });

  it('刚登录、还没用邀请码的账号：注册等级、没有称号、拿不到 console.access', async () => {
    const { app, as } = await setupConsole();
    const me = (await app.inject({ url: '/api/console/me', headers: as('dave') })).json();
    expect(me).toMatchObject({ login: 'dave', level: 'registered', level_name: '注册用户', department: null, titles: [] });
    expect(me.permissions).not.toContain('console.access');
    const denied = await app.inject({ url: '/api/console/applications', headers: as('dave') });
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toEqual({ error: 'forbidden', node: 'apply.view', message: '需要「apply.view」权限' });
  });

  it('部门部长的 /me 带着范围内的节点，部门信息来自单独的部门分组（和称号分组是两回事）', async () => {
    const { app, as, accountId } = await setupConsole();
    const erinId = accountId('erin');
    grantPermGroup(app, erinId, 'dept.ai');
    grantPermGroup(app, erinId, 'title.ai.head');
    const me = (await app.inject({ url: '/api/console/me', headers: as('erin') })).json();
    expect(me.department).toMatchObject({ id: 'dept.ai', name: 'AI部门', tone: 'y' });
    expect(me.titles).toEqual([expect.objectContaining({ id: 'title.ai.head', department_id: 'dept.ai' })]);
    // console.access 是全站授权；users.view/apply.view/apply.review/activity.read 只在本部门范围内授权，
    // /me 靠 SCOPE_AWARE_NODES 把它们也并进 permissions，供前端判断导航显隐（见 routes/console/me.ts）。
    // dept.manage 不在这张清单里（#274 残留修复 J）：种子发了这个节点，但没有任何接口按它判定，放进
    // SCOPE_AWARE_NODES 只会让前端多出一个没有对应功能的导航项。
    expect(me.permissions).toEqual(expect.arrayContaining(['console.access', 'users.view', 'apply.view', 'apply.review', 'activity.read']));
    expect(me.permissions).not.toContain('apply.export');
    expect(me.permissions).not.toContain('dept.manage');
  });

  it('summary 只给有权限看的键', async () => {
    const { app, as, accountId, db } = await setupConsole();
    insertApplication(db);
    grantPermNode(app, accountId('alice'), 'apply.view');
    const ownerSummary = (await app.inject({ url: '/api/console/summary', headers: as('alice') })).json();
    expect(Object.keys(ownerSummary)).toEqual(['applications']);
    expect(ownerSummary.applications).toMatchObject({ total: 1, last_7d: 1 });

    expect((await app.inject({ url: '/api/console/summary', headers: as('bob') })).json()).toEqual({});

    grantPermNode(app, accountId('gina'), 'feedback.view');
    expect(Object.keys((await app.inject({ url: '/api/console/summary', headers: as('gina') })).json())).toEqual(['feedback']);
  });
});

describe('/auth/me console_link', () => {
  type Role = 'admin' | 'member';
  /** #274 残留修复：console_link 改按权限引擎的 console.access 节点判定（routes/admin/auth.ts），不再读
   * `access.resolve()` 返回的旧 capabilities。`access.resolve()` 本身仍然会调用一次——老账号第一次来
   * （roleUnrecorded）时靠它补查 GitHub 组织角色、同步进新权限表，这里的 GitHub 角色桩就是为了测这个
   * 副作用和它失败时的会话处理（#164），不是为了算 console_link。仍然模拟 GitHub 成员角色表，不走 setupConsole()。 */
  function github(roles: Record<string, Role>, users: Record<string, number> = {}, calls: string[] = []) {
    return (() => ({
      request: async (route: string, params: Record<string, string>) => {
        calls.push(`${route} ${params.org ?? ''} ${params.username}`);
        if (route === 'GET /orgs/{org}/memberships/{username}') {
          const role = params.org === CONSOLE_ORG ? roles[params.username.toLowerCase()] : undefined;
          if (!role) throw Object.assign(new Error('stub not found'), { status: 404 });
          return { data: { state: 'active', role } };
        }
        throw new Error(`Unexpected GitHub call ${route}`);
      },
    })) as unknown as ServiceOverrides['octokitFactory'];
  }
  const LEGACY_USERS: Record<string, number> = { alice: 101, bob: 102, carol: 103, dave: 104, erin: 105, frank: 106 };
  async function setupLegacyRoles(roles: Record<string, Role> = {}) {
    const context = await testApp({ octokitFactory: github(roles, LEGACY_USERS) });
    contexts.push(context);
    const { app } = context;
    const sids = new Map<string, string>();
    const as = (login: string) => {
      if (!sids.has(login)) sids.set(login, signIn(app, login, LEGACY_USERS[login], null, `token-${login}`));
      return { cookie: `sid=${sids.get(login)}` };
    };
    const assign = (login: string, role: 'captain' | 'head' | 'member' | 'alumni', department_id = '') =>
      app.services.roles.insertAssignment({ github_login: login, github_user_id: LEGACY_USERS[login], role, department_id, note: null, granted_by: 'fixture' });
    return { app, as, assign };
  }

  it('shows the console link to site owners and department heads, not plain crew, alumni or non-members (console_link now reads console.access off the permission engine)', async () => {
    const { app, as } = await setupLegacyRoles({ alice: 'admin', bob: 'member', carol: 'member', dave: 'member', erin: 'member' });
    // #274 残留修复：console_link 不再走 role_assignments/旧 capabilities（「持有任何能力就自动获得
    // console.access」），改按权限引擎的 console.access 节点判定。部门舰员（dept.ai）只拿到
    // forum.moderate.*，没有 console.access；部门部长（title.ai.head）才有（见迁移种子）。
    as('alice'); as('carol'); as('dave'); as('erin');
    grantPermGroup(app, accountIdOf(app, 'alice'), 'title.site.owner');
    grantPermGroup(app, accountIdOf(app, 'carol'), 'dept.ai');
    grantPermGroup(app, accountIdOf(app, 'dave'), 'dept.ai');
    grantPermGroup(app, accountIdOf(app, 'dave'), 'title.ai.head');
    grantPermGroup(app, accountIdOf(app, 'erin'), 'level.alumni');
    const me = async (login: string) => (await app.inject({ url: '/auth/me', headers: as(login) })).json();
    expect(await me('alice')).toMatchObject({ signed_in: true, login: 'alice', user_id: 101, console_link: true });
    expect((await me('dave')).console_link).toBe(true);
    // 普通部门舰员（只有 forum.moderate.*）、往届成员、普通注册舰员、不在组织里的人都不显示。
    expect((await me('carol')).console_link).toBe(false);
    expect((await me('bob')).console_link).toBe(false);
    expect((await me('erin')).console_link).toBe(false);
    expect((await me('frank')).console_link).toBe(false);
    // 没登录按访客处理（#274）：仍是 200，带 level/permissions/quota，不再是裸 { signed_in: false }
    expect((await app.inject('/auth/me')).json()).toMatchObject({ signed_in: false, level: 'level.visitor' });
  });

  it('stays signed in without the link when GitHub cannot be reached', async () => {
    const failing = (() => ({ request: async () => { throw Object.assign(new Error('upstream down'), { status: 502 }); } })) as unknown as ServiceOverrides['octokitFactory'];
    const broken = await testApp({ octokitFactory: failing }); contexts.push(broken);
    const sid = signIn(broken.app, 'alice', 101, null, 'token');
    const response = await broken.app.inject({ url: '/auth/me', headers: { cookie: `sid=${sid}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ signed_in: true, login: 'alice', console_link: false });
  });

  it('ends the session and says signed out when GitHub rejects its token (#164)', async () => {
    const rejecting = (() => ({ request: async () => { throw Object.assign(new Error('Bad credentials'), { status: 401 }); } })) as unknown as ServiceOverrides['octokitFactory'];
    const broken = await testApp({ octokitFactory: rejecting }); contexts.push(broken);
    const sid = signIn(broken.app, 'alice', 101, null, 'revoked-token');
    const response = await broken.app.inject({ url: '/auth/me', headers: { cookie: `sid=${sid}` } });
    expect(response.statusCode).toBe(200);
    // 会话被结束后按访客处理（#274），不再是裸 { signed_in: false, session_expired: true }
    expect(response.json()).toMatchObject({ signed_in: false, session_expired: true, level: 'level.visitor' });
    expect(([] as string[]).concat((response.headers['set-cookie'] as string[] | string | undefined) ?? []).some(cookie => cookie.startsWith('sid=;'))).toBe(true);
    expect(broken.app.services.auth.getSession(sid)).toBeNull();
    // 论坛同样按会话失效回答，前端据此带人去重新登录（#133）。#274 的 /api/console/me 不再现查 GitHub
    // （静态权限，见 CONTRACT-274 §5），撤销令牌这件事现在只在会调用 GitHub 的接口上才发现得到；控制台
    // 和论坛共用同一次 /auth/me 判断登录态，日常页面加载时仍然会带到这一次检查。
    const other = signIn(broken.app, 'alice', 101, null, 'revoked-token');
    const forum = await broken.app.inject({ url: '/api/forum/state', headers: { cookie: `sid=${other}` } });
    expect(forum.statusCode).toBe(401);
    expect(forum.json().error).toBe('session_expired');
    expect(broken.app.services.auth.getSession(other)).toBeNull();
  });

  it('audits an ended session once when two requests find the token rejected at the same time (#164)', async () => {
    // 页面加载时 /api/forum/state 和 /auth/me 一起到，组织角色缓存不合并同时在途的请求，两边都会问 GitHub。
    const slow = (() => ({ request: async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      throw Object.assign(new Error('Bad credentials'), { status: 401 });
    } })) as unknown as ServiceOverrides['octokitFactory'];
    const broken = await testApp({ octokitFactory: slow }); contexts.push(broken);
    const sid = signIn(broken.app, 'alice', 101, null, 'revoked-token');
    const headers = { cookie: `sid=${sid}` };
    const [state, me] = await Promise.all([
      broken.app.inject({ url: '/api/forum/state', headers }),
      broken.app.inject({ url: '/auth/me', headers }),
    ]);
    expect(state.statusCode).toBe(401);
    expect(state.json().error).toBe('session_expired');
    expect(me.json()).toMatchObject({ signed_in: false, session_expired: true, level: 'level.visitor' });
    expect(broken.app.services.storage.db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'auth.session_rejected'").get()).toEqual({ n: 1 });
  });
});

describe('GET /api/console/applications 与审核（CONTRACT-274 §5：apply.view / apply.review / apply.export）', () => {
  it('lists applications with an exact field set and no source IP or user agent', async () => {
    const { app, as, accountId, db } = await setupConsole();
    grantPermNode(app, accountId('erin'), 'apply.view');
    insertApplication(db, { strengths: '长'.repeat(300), created_at: Date.now() - 1000 });
    insertApplication(db, { name: '另一位', email: 'other_1@example.test', status: 'interview' });
    const response = await app.inject({ url: '/api/console/applications', headers: as('erin') });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(2);
    expect(body.counts).toEqual({ received: 1, interview: 1, accepted: 0, rejected: 0, cancelled: 0 });
    expect(Object.keys(body.items[0]).sort()).toEqual(['class_name', 'created_at', 'email', 'id', 'last_review', 'name', 'status', 'strengths_excerpt']);
    expect(body.items[1].strengths_excerpt).toHaveLength(121);
    expect(response.body).not.toMatch(/203\.0\.113\.7|fixture-agent/);

    const searched = (await app.inject({ url: `/api/console/applications?q=${encodeURIComponent('other_')}`, headers: as('erin') })).json();
    expect(searched.items.map((item: { name: string }) => item.name)).toEqual(['另一位']);
    expect((await app.inject({ url: '/api/console/applications?q=%25', headers: as('erin') })).json().total).toBe(0);
    expect((await app.inject({ url: '/api/console/applications?status=interview&limit=1', headers: as('erin') })).json().items).toHaveLength(1);
  });

  it('部门部长（只有按部门限定的 apply.view/apply.review）能看列表、详情，也能审核（#274 残留修复 J.1）', async () => {
    const { app, as, accountId, db } = await setupConsole();
    grantPermGroup(app, accountId('dave'), 'title.ai.head'); // 种子只给这个节点按部门限定，没有任何人直接持有不限定的 apply.view/apply.review（除了站长的通配 `*`）
    const row = insertApplication(db);
    const list = await app.inject({ url: '/api/console/applications', headers: as('dave') });
    expect(list.statusCode).toBe(200); // 改之前 requirePermission 一律 403，部长完全看不到投递
    expect(list.json().total).toBe(1);
    expect((await app.inject({ url: `/api/console/applications/${row.id}`, headers: as('dave') })).statusCode).toBe(200);
    const review = await app.inject({
      method: 'PATCH', url: `/api/console/applications/${row.id}`, headers: as('dave'),
      payload: { status: 'interview', expected_status: 'received', expected_review_id: 0, notify: false },
    });
    expect(review.statusCode).toBe(200);
  });

  it('records a review in a transaction and keeps the note out of the audit log', async () => {
    const { app, as, accountId, audits, db } = await setupConsole();
    grantPermNode(app, accountId('erin'), 'apply.view');
    grantPermNode(app, accountId('erin'), 'apply.review');
    const row = insertApplication(db);
    const url = `/api/console/applications/${row.id}`;
    expect((await app.inject({ method: 'PATCH', url, headers: as('erin'), payload: { status: 'received' } })).json().error).toBe('no_change');

    const note = '一面表现不错，约二面时间';
    const response = await app.inject({ method: 'PATCH', url, headers: as('erin'), payload: { status: 'interview', expected_status: 'received', expected_review_id: 0, note, notify: false } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ application: { id: row.id, status: 'interview' }, review: { from_status: 'received', to_status: 'interview', note, reviewer: 'erin', mail: null } });
    const detail = (await app.inject({ url, headers: as('erin') })).json();
    expect(detail.application.strengths).toBe(row.strengths);
    expect(detail.application.source_ip).toBeUndefined();
    expect(detail.reviews).toHaveLength(1);

    const reviewAudit = audits().find(item => item.action === 'application.review')!;
    expect(reviewAudit.org).toBe(CONSOLE_ORG);
    expect(JSON.parse(reviewAudit.details!)).toEqual({ from: 'received', to: 'interview', has_note: true, mail: false });
    expect(JSON.stringify(audits())).not.toContain(note);
    expect(audits().some(item => item.action === 'application.view' && item.org === CONSOLE_ORG)).toBe(true);
    expect((await app.inject({ url: `/api/console/applications/${randomUUID()}`, headers: as('erin') })).statusCode).toBe(404);
  });

  it('includes cancelled applications in filters, counts, summary and CSV', async () => {
    const { app, as, accountId, audits, db } = await setupConsole();
    grantPermNode(app, accountId('erin'), 'apply.view');
    grantPermNode(app, accountId('erin'), 'apply.review');
    grantPermNode(app, accountId('erin'), 'apply.export');
    const older = insertApplication(db, { name: '撤回甲', email: 'cancel_a@example.test', created_at: Date.now() - 1000 });
    const newer = insertApplication(db, { name: '撤回乙', email: 'cancel_b@example.test' });
    insertApplication(db, { name: '保留投递', email: 'active@example.test' });
    const headers = as('erin');
    for (const row of [older, newer]) {
      const result = await app.inject({
        method: 'PATCH', url: `/api/console/applications/${row.id}`, headers,
        payload: { status: 'cancelled', expected_status: 'received', expected_review_id: 0 },
      });
      expect(result.statusCode).toBe(200);
      expect(result.json().review.mail).toBeNull();
    }
    const counts = { received: 1, interview: 0, accepted: 0, rejected: 0, cancelled: 2 };
    const all = await app.inject({ url: '/api/console/applications', headers });
    expect(all.statusCode).toBe(200);
    expect(all.json()).toMatchObject({ total: 3, counts });
    const filtered = await app.inject({ url: '/api/console/applications?status=cancelled&limit=1&offset=1', headers });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json()).toMatchObject({ total: 2, counts, items: [{ id: older.id, status: 'cancelled', last_review: { to_status: 'cancelled', reviewer: 'erin' } }] });
    const searched = await app.inject({ url: '/api/console/applications?status=cancelled&q=cancel_b', headers });
    expect(searched.statusCode).toBe(200);
    expect(searched.json().items.map((item: { id: string }) => item.id)).toEqual([newer.id]);
    expect(searched.json().total).toBe(1);
    // summary 的 by_status 和列表接口的 counts 不是一回事：summary 只按实际出现的状态分组（不补 0），这里只有
    // received 和 cancelled 两种状态被用到。
    const summary = await app.inject({ url: '/api/console/summary', headers });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().applications).toEqual({ total: 3, last_7d: 3, by_status: { received: 1, cancelled: 2 } });
    const csv = await app.inject({ url: '/api/console/applications/export.csv?status=cancelled', headers });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('cancel_a@example.test');
    expect(csv.body).toContain('cancel_b@example.test');
    expect(csv.body).not.toContain('active@example.test');
    expect(csv.body.match(/,cancelled,/g)).toHaveLength(2);
    expect(JSON.parse(audits().find(item => item.action === 'application.export')!.details!)).toEqual({ count: 2, status: 'cancelled' });
  });

  it('requires review permission and the correct origin to cancel without changing data on denial', async () => {
    const { app, as, accountId, audits, db } = await setupConsole();
    grantPermNode(app, accountId('gina'), 'apply.view');
    as('bob');
    const row = insertApplication(db);
    const url = `/api/console/applications/${row.id}`;
    const payload = { status: 'cancelled', expected_status: 'received', expected_review_id: 0 };
    expect((await app.inject({ method: 'PATCH', url, payload })).statusCode).toBe(401);
    for (const login of ['bob', 'gina']) {
      const denied = await app.inject({ method: 'PATCH', url, payload, headers: as(login) });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toMatchObject({ error: 'forbidden', node: 'apply.review' });
    }
    expect((await app.inject({ url, headers: as('gina') })).statusCode).toBe(200);
    const origin = await app.inject({ method: 'PATCH', url, payload, headers: { ...as('gina'), origin: 'https://foreign.example.test' } });
    expect(origin.statusCode).toBe(403);
    expect(origin.json().error).toBe('invalid_origin');
    expect(db.prepare('SELECT status FROM applications WHERE id = ?').get(row.id)).toEqual({ status: 'received' });
    expect(db.prepare('SELECT * FROM application_reviews').all()).toEqual([]);
    expect(db.prepare('SELECT * FROM mail_outbox').all()).toEqual([]);
    expect(audits().filter(item => item.action === 'application.review')).toEqual([]);
  });

  it('exports CSV with a BOM and neutralises spreadsheet formulas', async () => {
    const { app, as, accountId, audits, db } = await setupConsole();
    grantPermNode(app, accountId('gina'), 'apply.view');
    grantPermNode(app, accountId('erin'), 'apply.export');
    // 北京时间 9 月 27 日 01:05 投递的：CSV 里写北京时间，不写 UTC 的 26 日 17:05
    insertApplication(db, { name: '=cmd', strengths: '@SUM(A1), "quoted" 的特长描述', created_at: Date.UTC(2026, 8, 26, 17, 5) });
    expect((await app.inject({ url: '/api/console/applications/export.csv', headers: as('gina') })).json()).toMatchObject({ error: 'forbidden', node: 'apply.export' });
    // 文件名的日期也按北京时间：UTC 26 日 23:30 是北京时间 27 日 07:30
    const saved = process.env.TZ;
    process.env.TZ = 'UTC';
    const realNow = Date.now.bind(Date);
    let exporting = false;
    vi.spyOn(Date, 'now').mockImplementation(() => (exporting ? Date.UTC(2026, 8, 26, 23, 30) : realNow()));
    let response: Awaited<ReturnType<typeof app.inject>>;
    try {
      exporting = true;
      response = await app.inject({ url: '/api/console/applications/export.csv', headers: as('erin') });
    } finally {
      exporting = false;
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe('attachment; filename="applications-20260927.csv"');
    expect(response.body.startsWith('﻿name,class_name,email,strengths,status,created_at_beijing\r\n')).toBe(true);
    expect(response.body).toContain(',received,2026-09-27 01:05:00\r\n');
    expect(response.body).toContain("'=cmd,");
    expect(response.body).toContain('"\'@SUM(A1), ""quoted"" 的特长描述"');
    expect(response.body).not.toContain('203.0.113.7');
    const exported = audits().find(item => item.action === 'application.export')!;
    expect(exported.org).toBe(CONSOLE_ORG);
    expect(JSON.parse(exported.details!)).toEqual({ count: 1, status: null });
  });
});

describe('控制台意见箱（CONTRACT-274 §5：feedback.view / feedback.handle）', () => {
  it('serves the console feedback box for CONSOLE_ORG only and audits every write under it', async () => {
    const { app, as, accountId, audits, db } = await setupConsole();
    const now = Date.now();
    const insert = db.prepare('INSERT INTO feedback(org, content, status, source_ip, user_agent, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)');
    const ours = Number(insert.run(CONSOLE_ORG, '希望多一些项目复盘', 'open', '203.0.113.9', 'agent', now, now).lastInsertRowid);
    const theirs = Number(insert.run('other-org', '别的组织', 'open', null, null, now, now).lastInsertRowid);
    grantPermNode(app, accountId('gina'), 'feedback.view');
    grantPermNode(app, accountId('alice'), 'feedback.view');
    grantPermNode(app, accountId('alice'), 'feedback.handle');
    const listed = (await app.inject({ url: '/api/console/feedback', headers: as('gina') })).json();
    expect(listed.items.map((item: { id: number }) => item.id)).toEqual([ours]);
    expect(JSON.stringify(listed)).not.toContain('203.0.113.9');
    expect((await app.inject({ method: 'PATCH', url: `/api/console/feedback/${ours}`, headers: as('gina'), payload: { status: 'done' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/api/console/feedback/${theirs}`, headers: as('alice'), payload: { status: 'done' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: `/api/console/feedback/${ours}`, headers: as('alice'), payload: { status: 'done', reply: '已安排' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/api/console/feedback/${ours}`, headers: as('alice') })).statusCode).toBe(200);
    expect(audits().filter(row => row.action.startsWith('feedback.')).map(row => [row.org, row.action])).toEqual([[CONSOLE_ORG, 'feedback.update'], [CONSOLE_ORG, 'feedback.delete']]);
  });
});

describe('GET /api/console/departments（固定部门名册，和权限节点的 dept.* 分组是两回事，见 routes/console/departments.ts）', () => {
  it('列出固定的四个部门、人数与队长', async () => {
    const { app, as, accountId } = await setupConsole();
    grantPermNode(app, accountId('bob'), 'console.access');
    const listed = (await app.inject({ url: '/api/console/departments', headers: as('bob') })).json().departments;
    expect(listed.map((item: { id: string }) => item.id)).toEqual(['recruitment', 'tech', 'community', 'projects']);
    expect(listed[0]).toMatchObject({ name: '招新部', heads: [], crew_count: 0, archived: false });
  });
});

describe('旧的 computeAccess（#274 范围外：/auth/me 的 console_link 和论坛旧能力展示仍在用，见上面的 console_link 块）', () => {
  it('keeps explicit alumni from also deriving the member title', () => {
    const access = computeAccess({
      login: 'gina', siteRole: 'member', departments: DEFAULT_DEPARTMENTS.map(item => ({ ...item, archived: false })),
      assignments: [{ id: 1, github_login: 'gina', github_user_id: 107, account_id: null, role: 'alumni', department_id: '', note: null, granted_by: 'x', created_at: 0 }],
    });
    expect(access.titles.map(title => title.label)).toEqual(['领航员']);
    expect([...access.capabilities]).toEqual(['console.access', 'github.org.read', 'feedback.read']);
  });
});

describe('旧 titles 表的启动播种（#274 范围外：这张表只给旧能力系统的说明文案用，和权限节点的 title.* 分组无关）', () => {
  it('renews the old GitHub wording of the 提督 and 舰员 descriptions on boot and keeps edited ones (#262 第四期)', async () => {
    const { db } = await setupConsole();
    db.prepare("UPDATE titles SET description = ? WHERE id = 'admin'").run(LEGACY_TITLE_DESCRIPTIONS.admin);
    db.prepare("UPDATE titles SET description = '班长改过的说明' WHERE id = 'member'").run();
    createRoleStore(db);
    expect(db.prepare("SELECT id, description FROM titles WHERE id IN ('admin', 'member') ORDER BY id").all()).toEqual([
      { id: 'admin', description: DEFAULT_TITLE_CONFIGS.admin.description },
      { id: 'member', description: '班长改过的说明' },
    ]);
    expect(DEFAULT_TITLE_CONFIGS.admin.description).not.toMatch(/GitHub/);
  });
});

describe('configuration', () => {
  const env = {
    NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://example.test', DB_PATH: ':memory:',
    SESSION_SECRET: 'console-config-test-secret-at-least-32', ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    OAUTH_CLIENT_ID: 'test-client', OAUTH_CLIENT_SECRET: 'test-secret',
  };
  // #274 删掉了 ALLOWED_ORGS（唯一的读者 /api/me/orgs 随 GitHub 组织管理一起删除了），只剩 CONSOLE_ORG 自己的形状校验。
  it('defaults and validates the shape of CONSOLE_ORG', () => {
    expect(createConfig(env).consoleOrg).toBe(CONSOLE_ORG);
    expect(createConfig({ ...env, CONSOLE_ORG: 'other-org' }).consoleOrg).toBe('other-org');
    expect(() => createConfig({ ...env, CONSOLE_ORG: 'bad org' })).toThrow('CONSOLE_ORG');
  });
});
