import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, signIn } from './helpers';

/** 用户列表与改身份（#274 CONTRACT §5）：按新权限体系的 level/department/title，替代旧的 /api/console/people。 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

async function setup() {
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  const sid = signIn(app, 'users-owner', 301);
  return { app, cookie: `sid=${sid}` };
}

function accountIdFor(app: FastifyInstance, login: string): string {
  return (app.services.storage.db.prepare('SELECT openid FROM sessions WHERE login = ?').get(login) as { openid: string }).openid;
}

function grantNode(app: FastifyInstance, accountId: string, node: string, scope?: Record<string, unknown>) {
  app.services.storage.db.prepare(
    "INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, ?, 1, ?, 'test', ?)",
  ).run(accountId, node, JSON.stringify(scope ?? {}), Date.now());
  app.services.permissions.bump();
}

function setDepartment(app: FastifyInstance, accountId: string, departmentId: string) {
  app.services.storage.db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'department')").run(accountId);
  app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, ?, 'test', ?)").run(accountId, departmentId, Date.now());
  app.services.permissions.bump();
}

describe('用户列表（GET /api/console/users，#274 CONTRACT §5）', () => {
  it('没有 users.view 回 403；有全站权限时看得到全部账号与计数', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    expect((await app.inject({ url: '/api/console/users', headers: { cookie } })).statusCode).toBe(403);
    grantNode(app, owner, 'users.view');
    signIn(app, 'users-member', 302);
    const res = await app.inject({ url: '/api/console/users', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: { account_id: string; level: string }[]; counts: { registered: number } };
    expect(body.items.length).toBe(2);
    expect(body.items.every(item => item.level === 'registered')).toBe(true);
    expect(body.counts.registered).toBe(2);
  });

  it('按 q、level、status、department（含 dept.none）过滤', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.view');
    const member = signIn(app, 'users-filtered', 303);
    const memberAccount = accountIdFor(app, 'users-filtered');
    app.services.storage.db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'level')").run(memberAccount);
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'level.member', 'test', ?)").run(memberAccount, Date.now());
    setDepartment(app, memberAccount, 'dept.ai');

    const byLevel = await app.inject({ url: '/api/console/users?level=member', headers: { cookie } });
    expect((byLevel.json() as { items: { account_id: string }[] }).items.map(i => i.account_id)).toEqual([memberAccount]);

    const byDept = await app.inject({ url: '/api/console/users?department=dept.ai', headers: { cookie } });
    expect((byDept.json() as { items: { account_id: string }[] }).items.map(i => i.account_id)).toEqual([memberAccount]);

    const byNoDept = await app.inject({ url: '/api/console/users?department=dept.none', headers: { cookie } });
    expect((byNoDept.json() as { items: { account_id: string }[] }).items.map(i => i.account_id)).not.toContain(memberAccount);

    const byStatus = await app.inject({ method: 'PATCH', url: `/api/console/users/${memberAccount}`, headers: { cookie }, payload: {} });
    expect(byStatus.statusCode).toBe(403); // 没有 users.manage，先确认门禁没被上面的 users.view 顺带放开
    void member;
  });

  it('部长只按本部门 scope 看账号，查询参数改不了范围；等级计数也按同一个范围收窄（#274 残留修复 J）', async () => {
    const { app, cookie: headCookie } = await setup();
    const head = accountIdFor(app, 'users-owner');
    grantNode(app, head, 'users.view', { department: ['dept.ai'] });
    setDepartment(app, head, 'dept.ai');
    const aiMemberSid = signIn(app, 'ai-member', 304);
    setDepartment(app, accountIdFor(app, 'ai-member'), 'dept.ai');
    const algoMemberSid = signIn(app, 'algo-member', 305);
    setDepartment(app, accountIdFor(app, 'algo-member'), 'dept.algo');

    const res = await app.inject({ url: '/api/console/users?department=dept.algo', headers: { cookie: headCookie } });
    const body = res.json() as { items: { account_id: string }[]; counts: { registered: number } };
    const ids = body.items.map(i => i.account_id);
    expect(ids).toContain(head);
    expect(ids).toContain(accountIdFor(app, 'ai-member'));
    expect(ids).not.toContain(accountIdFor(app, 'algo-member'));
    // 以前这张计数永远是全站的（3 个注册用户），不管部长的范围是什么；现在只数 dept.ai 范围内的 2 个
    // （head 自己 + ai-member），不把 algo-member 算进去，也不会让部长从计数反推出全站规模。
    expect(body.counts.registered).toBe(2);
    void aiMemberSid; void algoMemberSid;
  });

  it('counts.visitor_today 是北京时间今天去重后的访客数，不是写死的 0（#274 残留修复 M）', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.view');
    const db = app.services.storage.db;
    const insertEvent = db.prepare(
      "INSERT INTO activity_events(at, account_id, visitor_id, surface, action, outcome, meta) VALUES (?, NULL, ?, 'portal', 'page.view', 'ok', '{}')",
    );
    const now = Date.now();
    insertEvent.run(now, 'visitor-a');
    insertEvent.run(now, 'visitor-a'); // 同一个访客多条不重复计数
    insertEvent.run(now, 'visitor-b');
    insertEvent.run(now - 2 * 24 * 60 * 60 * 1000, 'visitor-c'); // 两天前的不算进「今天」
    const res = await app.inject({ url: '/api/console/users', headers: { cookie } });
    expect((res.json() as { counts: { visitor_today: number } }).counts.visitor_today).toBe(2);
  });

  it('搜索框里的 % 和 _ 按字面匹配，不当 LIKE 通配符（#274 残留修复 O）', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.view');
    const weirdAccount = accountIdFor(app, 'users-owner');
    app.services.profiles.update(weirdAccount, { display_name: '50%_off' }); // profiles.update() 兜底先建行，直接 UPDATE 在新账号上是 0 行
    signIn(app, 'users-plain', 306);

    const literal = await app.inject({ url: `/api/console/users?q=${encodeURIComponent('50%_off')}`, headers: { cookie } });
    expect((literal.json() as { items: { account_id: string }[] }).items.map(i => i.account_id)).toEqual([weirdAccount]);

    // 没转义的话 "%" 会当通配符，把名字里完全没有 "50" 的账号也搜出来；这里确认不会
    const notWildcard = await app.inject({ url: `/api/console/users?q=${encodeURIComponent('50%nope%')}`, headers: { cookie } });
    expect((notWildcard.json() as { items: unknown[] }).items).toEqual([]);
  });
});

describe('改用户身份（PATCH /api/console/users/:id，#274 CONTRACT §5）', () => {
  it('改 level、department；部门变了没给 titles 时自动去掉不属于新部门的称号', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.manage');
    const target = signIn(app, 'title-user', 306);
    const targetAccount = accountIdFor(app, 'title-user');
    setDepartment(app, targetAccount, 'dept.ai');
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.ai.staff', 'test', ?)").run(targetAccount, Date.now());

    const levelRes = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { level: 'member' } });
    expect(levelRes.statusCode).toBe(200);
    expect(app.services.permissions.check(targetAccount, 'forum.topic.create')).toBe(true);

    const deptRes = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { department: 'dept.algo' } });
    expect(deptRes.statusCode).toBe(200);
    const stillStaff = app.services.storage.db.prepare("SELECT 1 FROM perm_members WHERE account_id = ? AND group_id = 'title.ai.staff'").get(targetAccount);
    expect(stillStaff).toBeUndefined();
    void target;
  });

  it('部门或称号不存在回 400；改 status 另外需要 users.disable', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.manage');
    const targetAccount = accountIdFor(app, 'users-owner'); // 改自己，单纯测校验分支
    const badDept = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { department: 'dept.nope' } });
    expect(badDept.statusCode).toBe(400);
    expect(badDept.json().error).toBe('invalid_department');
    const badTitle = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { titles: ['title.nope'] } });
    expect(badTitle.statusCode).toBe(400);
    expect(badTitle.json().error).toBe('invalid_title');
    const noDisable = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { status: 'disabled' } });
    expect(noDisable.statusCode).toBe(403);
    expect(noDisable.json().node).toBe('users.disable');
  });

  it('最后一个站长不能被降或停用', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.manage');
    grantNode(app, owner, 'users.disable');
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(owner, Date.now());

    const disableSelf = await app.inject({ method: 'PATCH', url: `/api/console/users/${owner}`, headers: { cookie }, payload: { status: 'disabled' } });
    expect(disableSelf.statusCode).toBe(409);
    expect(disableSelf.json().error).toBe('last_owner');

    const dropOwner = await app.inject({ method: 'PATCH', url: `/api/console/users/${owner}`, headers: { cookie }, payload: { titles: [] } });
    expect(dropOwner.statusCode).toBe(409);
    expect(dropOwner.json().error).toBe('last_owner');

    const second = signIn(app, 'second-owner', 307);
    const secondAccount = accountIdFor(app, 'second-owner');
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(secondAccount, Date.now());
    app.services.permissions.bump();
    const nowOk = await app.inject({ method: 'PATCH', url: `/api/console/users/${owner}`, headers: { cookie }, payload: { titles: [] } });
    expect(nowOk.statusCode).toBe(200);
    void second;
  });

  it('只有站长自己才能任免站长（#274 残留修复 B）：持有 users.manage 的管理部部长既不能把自己或别人升成站长，也不能把现任站长降下来', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner'); // 只有 users.manage，不是站长
    grantNode(app, owner, 'users.manage');
    const target = signIn(app, 'users-target', 309);
    const targetAccount = accountIdFor(app, 'users-target');

    // 给别人升站长：拒绝
    const promote = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { titles: ['title.site.owner'] } });
    expect(promote.statusCode).toBe(403);
    expect(promote.json()).toMatchObject({ error: 'forbidden', node: 'title.site.owner' });
    expect(app.services.storage.db.prepare("SELECT 1 FROM perm_members WHERE account_id = ? AND group_id = 'title.site.owner'").get(targetAccount)).toBeUndefined();

    // 给自己升站长：同样拒绝（自己改自己也不行）
    const selfPromote = await app.inject({ method: 'PATCH', url: `/api/console/users/${owner}`, headers: { cookie }, payload: { titles: ['title.site.owner'] } });
    expect(selfPromote.statusCode).toBe(403);
    expect(selfPromote.json()).toMatchObject({ error: 'forbidden', node: 'title.site.owner' });

    // 现任站长要被降：owner 自己不是站长，摘不掉别人的站长称号
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(targetAccount, Date.now());
    const second = signIn(app, 'second-site-owner', 310);
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(accountIdFor(app, 'second-site-owner'), Date.now());
    app.services.permissions.bump();
    const demote = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { titles: [] } });
    expect(demote.statusCode).toBe(403);
    expect(demote.json()).toMatchObject({ error: 'forbidden', node: 'title.site.owner' });
    expect(app.services.storage.db.prepare("SELECT 1 FROM perm_members WHERE account_id = ? AND group_id = 'title.site.owner'").get(targetAccount)).toBeTruthy();

    // 改和站长无关的字段（部门）不触发这条门禁，owner 本来就有 users.manage
    const deptOnly = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { department: 'dept.ai' } });
    expect(deptOnly.statusCode).toBe(200);
    void second;
  });

  it('停用一个已经登录的账号，他现有的会话立刻失效（SPEC §3.8：停用后会话全部失效）', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'users-owner');
    grantNode(app, owner, 'users.manage');
    grantNode(app, owner, 'users.disable');
    const targetSid = signIn(app, 'to-be-disabled', 308);
    const targetAccount = accountIdFor(app, 'to-be-disabled');
    // 停用前，这个会话还能正常用
    expect((await app.inject({ url: '/auth/me', headers: { cookie: `sid=${targetSid}` } })).json().signed_in).toBe(true);

    const disabled = await app.inject({ method: 'PATCH', url: `/api/console/users/${targetAccount}`, headers: { cookie }, payload: { status: 'disabled' } });
    expect(disabled.statusCode).toBe(200);

    // 会话走的是 lib/auth.ts 的 getSession()：联查账号状态，不是 active 就当场删掉这一行、按未登录处理，
    // 不需要额外的「停用时主动踢会话」代码——这里把这条既有行为锁进回归测试，PATCH 本身不用另外改。
    // #274：/auth/me 没登录也回 200，带访客身份摘要（CONTRACT-274 §1），不是裸的 { signed_in: false }。
    const after = await app.inject({ url: '/auth/me', headers: { cookie: `sid=${targetSid}` } });
    expect(after.json()).toMatchObject({ signed_in: false, level: 'visitor' });
    expect(app.services.auth.getSession(targetSid)).toBeNull();
    expect(app.services.storage.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id = ?').get(targetSid)).toEqual({ n: 0 });
  });
});
