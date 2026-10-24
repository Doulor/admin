import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp, signIn } from './helpers';

/**
 * 权限节点目录、解释、有效权限与权限组 CRUD（#274 CONTRACT §5）。所有写操作都要求 step-up（#273，
 * 和账号页同一个 10 分钟窗口），测试里需要「没刚登录过」的场景时直接把 sessions.created_at 改到很早以前。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

async function setup() {
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  const sid = signIn(app, 'perm-owner', 201);
  return { app, cookie: `sid=${sid}` };
}

function accountIdFor(app: FastifyInstance, login: string): string {
  return (app.services.storage.db.prepare('SELECT openid FROM sessions WHERE login = ?').get(login) as { openid: string }).openid;
}

function grantNode(app: FastifyInstance, accountId: string, node: string, value = true) {
  app.services.storage.db.prepare(
    "INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, ?, ?, '{}', 'test', ?)",
  ).run(accountId, node, value ? 1 : 0, Date.now());
  app.services.permissions.bump();
}

function makeStale(app: FastifyInstance, login: string) {
  app.services.storage.db.prepare('UPDATE sessions SET created_at = ? WHERE login = ?').run(Date.now() - 20 * 60_000, login);
}

describe('权限节点目录（GET /api/console/permissions/nodes）', () => {
  it('没有 perm.view 回 403，有的话回全部节点与域', async () => {
    const { app, cookie } = await setup();
    const refused = await app.inject({ url: '/api/console/permissions/nodes', headers: { cookie } });
    expect(refused.statusCode).toBe(403);
    grantNode(app, accountIdFor(app, 'perm-owner'), 'perm.view');
    const res = await app.inject({ url: '/api/console/permissions/nodes', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { nodes: unknown[]; domains: unknown[] };
    expect(body.nodes.length).toBeGreaterThan(40);
    expect(body.domains.length).toBeGreaterThan(0);
  });
});

describe('权限解释（GET /api/console/permissions/explain）', () => {
  it('allow、unset、通配/未知节点 400、账号不存在 404', async () => {
    const { app, cookie } = await setup();
    const accountId = accountIdFor(app, 'perm-owner');
    grantNode(app, accountId, 'perm.view');
    const allow = await app.inject({ url: `/api/console/permissions/explain?account=${accountId}&node=account.profile.edit`, headers: { cookie } });
    expect(allow.statusCode).toBe(200);
    expect(allow.json()).toMatchObject({ node: 'account.profile.edit', result: 'allow' });
    expect((allow.json() as { hits: unknown[] }).hits.length).toBeGreaterThan(0);

    const unset = await app.inject({ url: `/api/console/permissions/explain?account=${accountId}&node=gitlab.sync`, headers: { cookie } });
    expect(unset.json()).toMatchObject({ node: 'gitlab.sync', result: 'unset', hits: [] });

    const wildcard = await app.inject({ url: `/api/console/permissions/explain?account=${accountId}&node=forum.moderate.*`, headers: { cookie } });
    expect(wildcard.statusCode).toBe(400);
    expect(wildcard.json().error).toBe('unknown_node');

    const unknown = await app.inject({ url: `/api/console/permissions/explain?account=${accountId}&node=not.a.real.node`, headers: { cookie } });
    expect(unknown.statusCode).toBe(400);

    const missing = await app.inject({ url: '/api/console/permissions/explain?account=0000000000000000000000000A&node=account.profile.edit', headers: { cookie } });
    expect(missing.statusCode).toBe(404);
  });
});

describe('账号的有效权限（GET /api/console/accounts/:id/effective）', () => {
  it('展开出具体节点与所在组', async () => {
    const { app, cookie } = await setup();
    const accountId = accountIdFor(app, 'perm-owner');
    grantNode(app, accountId, 'perm.view');
    const res = await app.inject({ url: `/api/console/accounts/${accountId}/effective`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { account_id: string; allow: string[]; groups: { id: string }[] };
    expect(body.account_id).toBe(accountId);
    expect(body.allow).toContain('account.profile.edit');
    expect(body.groups.some(g => g.id === 'level.registered')).toBe(true);
  });
});

describe('权限组（/api/console/permission-groups，#274 CONTRACT §5）', () => {
  it('列表需要 perm.view；新建校验 id 格式、重复与父组存在；成环与未知节点都挡在 400', async () => {
    const { app, cookie } = await setup();
    const accountId = accountIdFor(app, 'perm-owner');
    grantNode(app, accountId, 'perm.view');
    grantNode(app, accountId, 'perm.manage');

    expect((await app.inject({ url: '/api/console/permission-groups', headers: { cookie } })).statusCode).toBe(200);

    const badId = await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'Not-Valid', name: 'x', weight: 1 } });
    expect(badId.statusCode).toBe(400);
    expect(badId.json().error).toBe('invalid_group_id');

    const badParent = await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'custom.a', name: 'A组', weight: 5, parents: ['custom.nope'] } });
    expect(badParent.statusCode).toBe(400);
    expect(badParent.json().error).toBe('invalid_parent');

    const created = await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'custom.a', name: 'A组', weight: 5 } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ id: 'custom.a', kind: 'custom', name: 'A组', weight: 5, system: false, parents: [], member_count: 0 });

    const dup = await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'custom.a', name: '重复', weight: 1 } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error).toBe('group_exists');

    await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'custom.b', name: 'B组', weight: 5, parents: ['custom.a'] } });
    // custom.a 认 custom.b 当父组：custom.a -> custom.b -> custom.a，成环
    const cycle = await app.inject({ method: 'PATCH', url: '/api/console/permission-groups/custom.a', headers: { cookie }, payload: { parents: ['custom.b'] } });
    expect(cycle.statusCode).toBe(400);
    expect(cycle.json().error).toBe('group_cycle');

    const unknownNode = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/custom.a', headers: { cookie },
      payload: { entries: { add: [{ node: 'totally.fake.node', value: true }] } },
    });
    expect(unknownNode.statusCode).toBe(400);
    expect(unknownNode.json().error).toBe('unknown_node');

    const badEntry = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/custom.a', headers: { cookie },
      payload: { entries: { add: [{ node: 'forum.read.public' }] } },
    });
    expect(badEntry.statusCode).toBe(400);
    expect(badEntry.json().error).toBe('invalid_entry');

    const addEntry = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/custom.a', headers: { cookie }, payload: { weight: 9,
        entries: { add: [{ node: 'forum.read.public', value: true }, { node: 'forum.moderate.*', value: true, scope: { category: ['x'] } }] } },
    });
    expect(addEntry.statusCode).toBe(200);
    const afterAdd = addEntry.json() as { weight: number; entries: { id: number; node: string }[] };
    expect(afterAdd.weight).toBe(9);
    expect(afterAdd.entries.map(e => e.node)).toEqual(expect.arrayContaining(['forum.read.public', 'forum.moderate.*']));
    const removeId = afterAdd.entries.find(e => e.node === 'forum.read.public')!.id;
    const removed = await app.inject({ method: 'PATCH', url: '/api/console/permission-groups/custom.a', headers: { cookie }, payload: { entries: { remove: [removeId] } } });
    expect((removed.json() as { entries: { id: number }[] }).entries.some(e => e.id === removeId)).toBe(false);
  });

  it('system=1 的组不能删，自定义组删除后带走条目与成员', async () => {
    const { app, cookie } = await setup();
    const accountId = accountIdFor(app, 'perm-owner');
    grantNode(app, accountId, 'perm.manage');
    const system = await app.inject({ method: 'DELETE', url: '/api/console/permission-groups/dept.ai', headers: { cookie } });
    expect(system.statusCode).toBe(409);
    expect(system.json().error).toBe('system_group');

    await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'custom.temp', name: '临时组', weight: 1 } });
    await app.inject({ method: 'POST', url: '/api/console/permission-groups/custom.temp/members', headers: { cookie }, payload: { account_id: accountId } });
    const deleted = await app.inject({ method: 'DELETE', url: '/api/console/permission-groups/custom.temp', headers: { cookie } });
    expect(deleted.statusCode).toBe(200);
    expect(app.services.storage.db.prepare('SELECT 1 FROM perm_groups WHERE id = ?').get('custom.temp')).toBeUndefined();
    expect(app.services.storage.db.prepare('SELECT 1 FROM perm_members WHERE group_id = ?').get('custom.temp')).toBeUndefined();
  });

  it('写操作要求刚登录过，不是的话 403 step_up_required', async () => {
    const { app, cookie } = await setup();
    grantNode(app, accountIdFor(app, 'perm-owner'), 'perm.manage');
    makeStale(app, 'perm-owner');
    const res = await app.inject({ method: 'POST', url: '/api/console/permission-groups', headers: { cookie }, payload: { id: 'custom.late', name: '迟到', weight: 1 } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('step_up_required');
  });
});

describe('站长组的保护（#274 残留修复 B/E）', () => {
  it('只有站长自己才能改站长组的继承、条目或成员，哪怕持有 perm.manage', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'perm-owner'); // 只有 perm.manage/perm.view，不是站长
    grantNode(app, owner, 'perm.manage');
    grantNode(app, owner, 'perm.view');
    const other = signIn(app, 'perm-not-owner', 203);
    const otherAccount = accountIdFor(app, 'perm-not-owner');

    const addMember = await app.inject({ method: 'POST', url: '/api/console/permission-groups/title.site.owner/members', headers: { cookie }, payload: { account_id: otherAccount } });
    expect(addMember.statusCode).toBe(403);
    expect(addMember.json()).toMatchObject({ error: 'forbidden', node: 'title.site.owner' });

    const editEntries = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/title.site.owner', headers: { cookie },
      payload: { entries: { add: [{ node: 'forum.read.public', value: true }] } },
    });
    expect(editEntries.statusCode).toBe(403);
    expect(editEntries.json()).toMatchObject({ error: 'forbidden', node: 'title.site.owner' });

    const editParents = await app.inject({ method: 'PATCH', url: '/api/console/permission-groups/title.site.owner', headers: { cookie }, payload: { parents: [] } });
    expect(editParents.statusCode).toBe(403);
    // 改名字、权重这些和站长自己的权限无关的字段，不触发这条门禁
    const rename = await app.inject({ method: 'PATCH', url: '/api/console/permission-groups/title.site.owner', headers: { cookie }, payload: { weight: 100 } });
    expect(rename.statusCode).toBe(200);

    // 直接把 otherAccount 塞进 perm_members，再试删——同样要求操作者是站长
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(otherAccount, Date.now());
    app.services.permissions.bump();
    const removeMember = await app.inject({ method: 'DELETE', url: `/api/console/permission-groups/title.site.owner/members/${otherAccount}`, headers: { cookie } });
    expect(removeMember.statusCode).toBe(403);
    expect(removeMember.json()).toMatchObject({ error: 'forbidden', node: 'title.site.owner' });
  });

  it('站长组至少留一位成员、至少留一条通配条目', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'perm-owner');
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(owner, Date.now());
    app.services.permissions.bump();

    // 只有 owner 一位站长：摘掉自己 → 409
    const removeSelf = await app.inject({ method: 'DELETE', url: `/api/console/permission-groups/title.site.owner/members/${owner}`, headers: { cookie } });
    expect(removeSelf.statusCode).toBe(409);
    expect(removeSelf.json().error).toBe('last_owner');

    // 删掉种子给的那条 node:"*" 条目、不补一条等效的 → 409
    const wildcardId = (app.services.storage.db.prepare("SELECT id FROM perm_entries WHERE subject_type = 'group' AND subject_id = 'title.site.owner' AND node = '*'").get() as { id: number }).id;
    const removeWildcard = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/title.site.owner', headers: { cookie }, payload: { entries: { remove: [wildcardId] } },
    });
    expect(removeWildcard.statusCode).toBe(409);
    expect(removeWildcard.json().error).toBe('last_owner');
    // 条目还在，没有被两阶段里先删后面才发现超限的方式删掉
    expect(app.services.storage.db.prepare("SELECT 1 FROM perm_entries WHERE id = ?").get(wildcardId)).toBeTruthy();

    // 删掉同时换一条等效的（同样是 node:"*", value:true）：允许
    const swap = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/title.site.owner', headers: { cookie },
      payload: { entries: { remove: [wildcardId], add: [{ node: '*', value: true }] } },
    });
    expect(swap.statusCode).toBe(200);

    // 现在有两位站长：第二位摘掉 owner 就不再是「最后一位」
    const second = signIn(app, 'perm-second-owner', 204);
    app.services.storage.db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(accountIdFor(app, 'perm-second-owner'), Date.now());
    app.services.permissions.bump();
    const removeOk = await app.inject({ method: 'DELETE', url: `/api/console/permission-groups/title.site.owner/members/${owner}`, headers: { cookie } });
    expect(removeOk.statusCode).toBe(200);
    void second;
  });

  it('meta_value 必须是 -1 或非负整数（#274 残留修复 K）', async () => {
    const { app, cookie } = await setup();
    grantNode(app, accountIdFor(app, 'perm-owner'), 'perm.manage');
    const bad = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/dept.ai', headers: { cookie },
      payload: { entries: { add: [{ node: 'meta.limit.forum.topic.hourly', meta_value: 'abc' }] } },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe('invalid_meta_value');
    const belowRange = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/dept.ai', headers: { cookie },
      payload: { entries: { add: [{ node: 'meta.limit.forum.topic.hourly', meta_value: '-2' }] } },
    });
    expect(belowRange.statusCode).toBe(400);
    expect(belowRange.json().error).toBe('invalid_meta_value');
    const ok = await app.inject({
      method: 'PATCH', url: '/api/console/permission-groups/dept.ai', headers: { cookie },
      payload: { entries: { add: [{ node: 'meta.limit.forum.topic.hourly', meta_value: '-1' }] } },
    });
    expect(ok.statusCode).toBe(200);
  });
});

describe('权限组成员（/api/console/permission-groups/:id/members）', () => {
  it('level/department 组换组前先删旧的；成员不存在时删除回 404', async () => {
    const { app, cookie } = await setup();
    const owner = accountIdFor(app, 'perm-owner');
    grantNode(app, owner, 'perm.manage');
    grantNode(app, owner, 'perm.view');
    const other = signIn(app, 'perm-other', 202);
    const otherAccount = accountIdFor(app, 'perm-other');

    const notFound = await app.inject({ method: 'POST', url: '/api/console/permission-groups/dept.ai/members', headers: { cookie }, payload: { account_id: '0000000000000000000000000A' } });
    expect(notFound.statusCode).toBe(404);
    expect(notFound.json().error).toBe('account_not_found');

    await app.inject({ method: 'POST', url: '/api/console/permission-groups/dept.ai/members', headers: { cookie }, payload: { account_id: otherAccount } });
    await app.inject({ method: 'POST', url: '/api/console/permission-groups/dept.algo/members', headers: { cookie }, payload: { account_id: otherAccount } });
    const members = await app.inject({ url: '/api/console/permission-groups/dept.algo/members', headers: { cookie } });
    expect((members.json() as { members: { account_id: string }[] }).members.map(m => m.account_id)).toEqual([otherAccount]);
    const stillInAi = app.services.storage.db.prepare("SELECT 1 FROM perm_members WHERE account_id = ? AND group_id = 'dept.ai'").get(otherAccount);
    expect(stillInAi).toBeUndefined();

    const removed = await app.inject({ method: 'DELETE', url: `/api/console/permission-groups/dept.algo/members/${otherAccount}`, headers: { cookie } });
    expect(removed.statusCode).toBe(200);
    const again = await app.inject({ method: 'DELETE', url: `/api/console/permission-groups/dept.algo/members/${otherAccount}`, headers: { cookie } });
    expect(again.statusCode).toBe(404);
    void other;
  });
});
