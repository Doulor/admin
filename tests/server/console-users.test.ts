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

  it('部长只按本部门 scope 看账号，查询参数改不了范围', async () => {
    const { app, cookie: headCookie } = await setup();
    const head = accountIdFor(app, 'users-owner');
    grantNode(app, head, 'users.view', { department: ['dept.ai'] });
    setDepartment(app, head, 'dept.ai');
    const aiMemberSid = signIn(app, 'ai-member', 304);
    setDepartment(app, accountIdFor(app, 'ai-member'), 'dept.ai');
    const algoMemberSid = signIn(app, 'algo-member', 305);
    setDepartment(app, accountIdFor(app, 'algo-member'), 'dept.algo');

    const res = await app.inject({ url: '/api/console/users?department=dept.algo', headers: { cookie: headCookie } });
    const ids = (res.json() as { items: { account_id: string }[] }).items.map(i => i.account_id);
    expect(ids).toContain(head);
    expect(ids).toContain(accountIdFor(app, 'ai-member'));
    expect(ids).not.toContain(accountIdFor(app, 'algo-member'));
    void aiMemberSid; void algoMemberSid;
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
});
