import { afterEach, describe, expect, it } from 'vitest';
import { createApplySettings } from '../../app/server/src/lib/apply-settings';
import { accountIdOf, activityRows, grantPermGroup, grantPermNode, signIn, testApp } from './helpers';

/**
 * 招新总开关（#284）：控制台「投递」页的开关写进 app_state，官网公开配置、投递接口和控制台读写的是同一个值。
 * 默认开放；关闭只拦新的投递（403 apply_closed），不写 applications、不消耗每天的投递份数；已收到的投递照常审核。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

const VALID = {
  name: '张三',
  className: '计算机 2101',
  email: 'zhangsan@example.test',
  strengths: '熟悉 Go 与 TypeScript，做过两个开源项目，长期维护自己的技术博客。',
};
const POW = { timestamp: 0, nonce: 'test' };

async function setup() {
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  const db = app.services.storage.db;
  const sids = new Map<string, string>();
  const users: Record<string, number> = { owner: 801, applicant: 802, reader: 803, head: 804 };
  const as = (login: string) => {
    if (!sids.has(login)) sids.set(login, signIn(app, login, users[login]));
    return { cookie: `sid=${sids.get(login)}` };
  };
  const accountId = (login: string) => { as(login); return accountIdOf(app, login); };
  grantPermGroup(app, accountId('owner'), 'title.site.owner');
  grantPermNode(app, accountId('reader'), 'apply.view');
  grantPermGroup(app, accountId('head'), 'title.ai.head');
  const submit = (payload: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => app.inject({
    method: 'POST', url: '/api/portal/apply', headers: as('applicant'),
    payload: { pow: { ...POW, timestamp: Date.now() }, ...VALID, ...payload },
    ...extra,
  });
  const toggle = (open: unknown, login = 'owner') => app.inject({ method: 'PATCH', url: '/api/console/applications/settings', headers: as(login), payload: { open } });
  const publicOpen = async () => (await app.inject('/api/public/config')).json().apply_open;
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return { app, db, as, accountId, submit, toggle, publicOpen, count };
}

describe('开关的读写', () => {
  it('升级后默认开放：公开配置 apply_open 为 true，控制台读到开放且没有改动时间，投递照常收下', async () => {
    const { app, as, publicOpen, submit, count } = await setup();
    expect(await publicOpen()).toBe(true);
    const read = await app.inject({ url: '/api/console/applications/settings', headers: as('reader') });
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual({ open: true, updated_at: null });
    expect((await submit()).statusCode).toBe(201);
    expect(count('applications')).toBe(1);
  });

  it('站长（根通配）关闭：回新状态，公开配置和控制台读到的都是关闭，操作记录有这次修改', async () => {
    const { app, as, accountId, toggle, publicOpen } = await setup();
    const closed = await toggle(false);
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual({ open: false, updated_at: expect.any(Number) });
    expect(await publicOpen()).toBe(false);
    expect((await app.inject({ url: '/api/console/applications/settings', headers: as('reader') })).json()).toEqual(closed.json());

    const rows = activityRows(app, { action: 'application.settings.update' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ account_id: accountId('owner'), surface: 'console', outcome: 'ok', target_type: 'application_settings', meta: { open: false } });

    const reopened = await toggle(true);
    expect(reopened.json().open).toBe(true);
    expect(await publicOpen()).toBe(true);
    expect(activityRows(app, { action: 'application.settings.update' }).map(row => row.meta)).toEqual([{ open: false }, { open: true }]);
  });

  it('重复设成同一个状态：回当前状态，改动时间不动，也不多记一条操作', async () => {
    const { app, toggle } = await setup();
    const first = (await toggle(false)).json();
    const again = await toggle(false);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first);
    expect(activityRows(app, { action: 'application.settings.update' })).toHaveLength(1);
    // 从没动过时要求「开放」也是空操作
    const fresh = await setup();
    expect((await fresh.toggle(true)).json()).toEqual({ open: true, updated_at: null });
    expect(activityRows(fresh.app, { action: 'application.settings.update' })).toEqual([]);
  });

  it('改开关要 apply.settings：没登录 401，只有 apply.view 的账号 403 并点明节点，状态不变', async () => {
    const { app, toggle, publicOpen } = await setup();
    expect((await app.inject({ method: 'PATCH', url: '/api/console/applications/settings', payload: { open: false } })).statusCode).toBe(401);
    const denied = await toggle(false, 'reader');
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toEqual({ error: 'forbidden', node: 'apply.settings', message: '需要「apply.settings」权限' });
    expect((await toggle(false, 'applicant')).statusCode).toBe(403);
    expect(await publicOpen()).toBe(true);
    expect(activityRows(app, { action: 'application.settings.update' })).toEqual([]);
  });

  it('改开关要刚登录过：会话超过 10 分钟回 403 step_up_required，状态不变', async () => {
    const { app, db, toggle, publicOpen } = await setup();
    db.prepare('UPDATE sessions SET created_at = ? WHERE login = ?').run(Date.now() - 20 * 60_000, 'owner');
    const res = await toggle(false);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('step_up_required');
    expect(await publicOpen()).toBe(true);
    expect(activityRows(app, { action: 'application.settings.update' })).toEqual([]);
  });

  it('请求体不是 {open: 布尔} 一律 400 validation_error，状态不变', async () => {
    const { app, as, toggle, publicOpen } = await setup();
    for (const payload of [{}, { open: 'false' }, { open: 0 }, { open: null }, { open: false, extra: 1 }]) {
      const res = await app.inject({ method: 'PATCH', url: '/api/console/applications/settings', headers: as('owner'), payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
      expect(res.json().error).toBe('validation_error');
    }
    expect(await publicOpen()).toBe(true);
    expect((await toggle(false)).statusCode).toBe(200);
  });

  it('读开关随 apply.view：部门部长（只有按部门限定的 apply.view）能读不能改，没有节点的账号 403', async () => {
    const { app, as, toggle, publicOpen } = await setup();
    const read = await app.inject({ url: '/api/console/applications/settings', headers: as('head') });
    expect(read.statusCode).toBe(200);
    expect(read.json().open).toBe(true);
    expect((await toggle(false, 'head')).statusCode).toBe(403);
    const none = await app.inject({ url: '/api/console/applications/settings', headers: as('applicant') });
    expect(none.statusCode).toBe(403);
    expect(none.json()).toMatchObject({ error: 'forbidden', node: 'apply.view' });
    expect(await publicOpen()).toBe(true);
  });
});

describe('关闭期间的投递', () => {
  it('回 403 apply_closed：不写 applications，不消耗额度，不发设备 cookie，不发信，记一条 denied', async () => {
    const { app, toggle, submit, count } = await setup();
    await toggle(false);
    const res = await submit();
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'apply_closed', message: '招新暂未开放' });
    expect(res.cookies.find(cookie => cookie.name === 'yugc_apply_device')).toBeUndefined();
    expect(count('applications')).toBe(0);
    expect(count('limit_events')).toBe(0);
    expect(count('mail_outbox')).toBe(0);
    expect(activityRows(app, { action: 'apply.submit' })).toEqual([]);

    const denied = activityRows(app, { action: 'http.apply_closed' });
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ surface: 'portal', outcome: 'denied' });
  });

  it('蜜罐被填、字段不合规的请求同样回 403，不装成功', async () => {
    const { toggle, submit, count } = await setup();
    await toggle(false);
    const honeypot = await submit({ website: 'https://spam.example' });
    expect(honeypot.statusCode).toBe(403);
    expect(honeypot.json().error).toBe('apply_closed');
    const invalid = await submit({ name: 'A' });
    expect(invalid.statusCode).toBe(403);
    expect(invalid.json().error).toBe('apply_closed');
    expect(count('applications')).toBe(0);
  });

  it('登录判定排在开关前面：没登录仍是 401 unauthenticated', async () => {
    const { app, toggle } = await setup();
    await toggle(false);
    const res = await app.inject({ method: 'POST', url: '/api/portal/apply', payload: { ...VALID, pow: { ...POW, timestamp: Date.now() } } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('unauthenticated');
  });

  it('重新开启后恢复，被拒的那几次没有占用每天 3 份：照常能投满 3 份，第 4 份才撞 apply.daily', async () => {
    const { toggle, submit, count } = await setup();
    await toggle(false);
    // 换 IP 避开接口每分钟 5 次的粗限流，单独看额度
    for (let i = 0; i < 6; i++) expect((await submit({ email: `closed${i}@example.test` }, { remoteAddress: `198.51.100.${i + 1}` })).statusCode).toBe(403);
    expect(count('limit_events')).toBe(0);

    await toggle(true);
    for (let i = 0; i < 3; i++) expect((await submit({ email: `open${i}@example.test` }, { remoteAddress: `203.0.113.${i + 1}` })).statusCode).toBe(201);
    const fourth = await submit({ email: 'open3@example.test' }, { remoteAddress: '203.0.113.9' });
    expect(fourth.statusCode).toBe(429);
    expect(fourth.json()).toMatchObject({ error: 'rate_limited', bucket: 'apply.daily' });
    expect(count('applications')).toBe(3);
  });

  it('已经收到的投递照常看、照常审核：关闭只拦新的投递', async () => {
    const { app, as, submit, toggle } = await setup();
    const sent = await submit();
    expect(sent.statusCode).toBe(201);
    await toggle(false);

    const list = await app.inject({ url: '/api/console/applications', headers: as('owner') });
    expect(list.statusCode).toBe(200);
    expect(list.json().total).toBe(1);
    const review = await app.inject({
      method: 'PATCH', url: `/api/console/applications/${sent.json().id}`, headers: as('owner'),
      payload: { status: 'interview', expected_status: 'received', expected_review_id: 0, notify: false },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().application.status).toBe('interview');
  });
});

describe('createApplySettings', () => {
  // 用测试应用自己的库（表由 createDatabase 建好）；再造一个实例等于服务重启后重新读库
  async function store() {
    const { app } = await setup();
    return { db: app.services.storage.db };
  }

  it('没有这一行是开放；关闭后新建的实例（重启）读回来还是关闭，改动时间用注入的时钟', async () => {
    const { db } = await store();
    let now = 1_000;
    const first = createApplySettings(db, () => now);
    expect(first.get()).toEqual({ open: true, updated_at: null });
    expect(first.setOpen(false)).toEqual({ settings: { open: false, updated_at: 1_000 }, changed: true });
    now = 2_000;
    const restarted = createApplySettings(db, () => now);
    expect(restarted.isOpen()).toBe(false);
    expect(restarted.setOpen(false)).toEqual({ settings: { open: false, updated_at: 1_000 }, changed: false });
    expect(restarted.setOpen(true)).toEqual({ settings: { open: true, updated_at: 2_000 }, changed: true });
  });

  it('读不懂的值按开放算：只有明确写下的 0 才关', async () => {
    const { db } = await store();
    db.prepare("INSERT INTO app_state(key, value, updated_at) VALUES('apply_open', 'garbage', 5)").run();
    expect(createApplySettings(db).get()).toEqual({ open: true, updated_at: 5 });
  });
});
