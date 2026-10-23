import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createConfig } from '../../app/server/src/config';
import { gitlabUsername } from '../../app/server/src/lib/gitlab-sync';
import { signIn, testApp } from './helpers';

/**
 * GitLab 账号同步（#270）：每个成员在 GitLab 上有一个按 OIDC 身份认人的用户，进 geek 组；离开的封禁，回来的解封，从不删除。
 * GitLab 管理接口与 GitHub 公开资料都由下面的假实现回应，测试不出网。
 */
const GITLAB = 'https://git.example.test';
const SYNC_ENV = { GITLAB_SYNC: 'on', GITLAB_URL: GITLAB, GITLAB_API_TOKEN: 'test-gitlab-token', GITLAB_GROUP: 'geek' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

type FakeUser = { id: number; username: string; email: string; name: string; state: 'active' | 'blocked'; extern_uid: string | null; provider: string | null; bio?: string; location?: string; website_url?: string; avatar?: string };

/** 假 GitLab：只认管理员令牌，用户名和邮箱不分大小写唯一，组成员按 user id 记权限。`fail` 让下一次匹配的请求失败。 */
function fakeGitlab() {
  const users: FakeUser[] = [];
  const members = new Map<number, number>();
  const calls: string[] = [];
  const failures: { match: string; status: number }[] = [];
  let unreachable = false;
  let nextId = 100;
  const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  async function fetch(input: string, init: RequestInit = {}): Promise<Response> {
    if (unreachable) throw new TypeError('fetch failed');
    const url = new URL(input);
    expect(url.origin).toBe(GITLAB);
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('test-gitlab-token');
    const method = init.method ?? 'GET';
    const path = url.pathname.replace(/^\/api\/v4/, '');
    const call = `${method} ${path}`;
    calls.push(call);
    const failure = failures.findIndex(item => call.startsWith(item.match));
    if (failure >= 0) return json(failures.splice(failure, 1)[0].status, { message: 'injected failure' });
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
    let match: RegExpMatchArray | null;
    if (method === 'GET' && path === '/users') {
      return json(200, users.filter(user => user.extern_uid === url.searchParams.get('extern_uid') && user.provider === url.searchParams.get('provider')));
    }
    if (method === 'POST' && path === '/users') {
      const username = String(body!.username);
      const email = String(body!.email);
      if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) return json(409, { message: 'Username has already been taken' });
      if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) return json(409, { message: 'Email has already been taken' });
      expect(body).toMatchObject({ skip_confirmation: true, force_random_password: true, provider: 'openid_connect' });
      const user: FakeUser = {
        id: nextId++, username, email, name: String(body!.name), state: 'active', extern_uid: String(body!.extern_uid), provider: String(body!.provider),
        bio: String(body!.bio), location: String(body!.location), website_url: String(body!.website_url),
      };
      users.push(user);
      return json(201, { id: user.id, username: user.username });
    }
    if ((match = path.match(/^\/users\/(\d+)$/))) {
      const user = users.find(item => item.id === Number(match![1]));
      if (!user) return json(404, { message: '404 User Not Found' });
      if (method === 'GET') return json(200, user);
      if (method === 'PUT') {
        const avatar = (init.body as FormData).get('avatar') as File;
        user.avatar = `${avatar.type} ${avatar.size}`;
        return json(200, user);
      }
    }
    if (method === 'POST' && (match = path.match(/^\/users\/(\d+)\/(block|unblock)$/))) {
      const user = users.find(item => item.id === Number(match![1]))!;
      const wanted = match[2] === 'block' ? 'blocked' : 'active';
      if (user.state === wanted) return json(403, { message: `403 Forbidden - A ${user.state} user cannot be ${match[2]}ed` });
      user.state = wanted;
      return json(201, true);
    }
    if (method === 'POST' && path === '/groups/geek/members') {
      const userId = Number(body!.user_id);
      if (members.has(userId)) return json(409, { message: 'Member already exists' });
      members.set(userId, Number(body!.access_level));
      return json(201, { id: userId, access_level: body!.access_level });
    }
    if (method === 'PUT' && (match = path.match(/^\/groups\/geek\/members\/(\d+)$/))) {
      members.set(Number(match[1]), Number(body!.access_level));
      return json(200, { id: Number(match[1]), access_level: body!.access_level });
    }
    return json(404, { message: `unexpected ${call}` });
  }
  return {
    users, members, calls, fetch,
    fail(match: string, status: number) { failures.push({ match, status }); },
    setUnreachable(value: boolean) { unreachable = value; },
    writes: () => calls.filter(call => !call.startsWith('GET ')),
  };
}

/** 假 GitHub：只回公开资料和头像，其它地址都算测试漏洞。 */
function fakeGithub(profiles: Record<number, Record<string, unknown>> = {}) {
  const calls: string[] = [];
  async function fetch(input: string): Promise<Response> {
    calls.push(input);
    const profile = input.match(/^https:\/\/api\.github\.com\/user\/(\d+)$/);
    if (profile) {
      const data = profiles[Number(profile[1])];
      return data ? new Response(JSON.stringify(data), { status: 200 }) : new Response('{}', { status: 404 });
    }
    if (input.startsWith('https://avatars.githubusercontent.com/')) return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
    throw new Error(`unexpected GitHub request ${input}`);
  }
  return { calls, fetch };
}

const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const context of contexts.splice(0)) await context.close(); });

async function setup(env: Record<string, string> = SYNC_ENV, profiles: Record<number, Record<string, unknown>> = {}) {
  const gitlab = fakeGitlab();
  const github = fakeGithub(profiles);
  const context = await testApp({ gitlabFetch: gitlab.fetch, githubProfileFetch: github.fetch }, false, env);
  contexts.push(context);
  const { app } = context;
  const accountOf = (githubId: number) => app.services.identity.accountForGithub(githubId)!;
  const promote = (githubId: number) => app.services.identity.setSiteRole({ accountId: accountOf(githubId), role: 'admin', actor: 'system' });
  const subOf = (githubId: number) => app.services.oidcStore.subjectFor('git.example.test', accountOf(githubId));
  const row = (githubId: number) => app.services.storage.db.prepare('SELECT * FROM gitlab_accounts WHERE account_id = ?').get(accountOf(githubId)) as Record<string, unknown> | undefined;
  return { app, gitlab, github, accountOf, promote, subOf, row, db: app.services.storage.db };
}

function userNamed(gitlab: ReturnType<typeof fakeGitlab>, username: string) {
  return gitlab.users.find(user => user.username === username);
}

describe('GitLab account sync (#270)', () => {
  it('creates one GitLab user per member with the OIDC identity, profile, avatar and group access', async () => {
    const { app, gitlab, github, accountOf, promote, subOf, row } = await setup(SYNC_ENV, {
      101: { name: 'Alice Liu', bio: 'Rust 和编译器', blog: 'alice.dev', location: '荆州', avatar_url: 'https://avatars.githubusercontent.com/u/101?v=4' },
    });
    signIn(app, 'alice', 101, 'https://avatars.githubusercontent.com/u/101');
    signIn(app, 'admiral', 1);
    promote(1);

    const summary = await app.services.gitlab.reconcile();
    expect(summary).toMatchObject({ mode: 'on', accounts: 2, changed: 2, failed: 0 });

    const alice = userNamed(gitlab, 'alice')!;
    expect(alice).toMatchObject({
      extern_uid: subOf(101), provider: 'openid_connect', email: 'alice@noreply.git.example.test',
      name: 'Alice Liu', bio: 'Rust 和编译器', location: '荆州', website_url: 'https://alice.dev', avatar: `image/png ${PNG.length}`,
    });
    expect(alice.extern_uid).not.toBe(accountOf(101));
    const admiral = userNamed(gitlab, 'admiral')!;
    expect(gitlab.members.get(alice.id)).toBe(30);
    expect(gitlab.members.get(admiral.id)).toBe(50);
    expect(github.calls).toContain('https://api.github.com/user/101');
    expect(row(101)).toMatchObject({ gitlab_user_id: alice.id, username: 'alice', state: 'active', access_level: 30, last_error: null });
    expect(app.services.gitlab.gitlabUserFor(accountOf(101))).toEqual({ gitlabUserId: alice.id, username: 'alice', state: 'active' });
    expect(app.services.gitlab.accountForGitlabUser(admiral.id)).toBe(accountOf(1));

    // 第二次对账什么都不用做，也不再读 GitHub
    const writes = gitlab.writes().length;
    const githubCalls = github.calls.length;
    expect(await app.services.gitlab.reconcile()).toMatchObject({ changed: 0, failed: 0 });
    expect(gitlab.writes()).toHaveLength(writes);
    expect(github.calls).toHaveLength(githubCalls);
    // 两个账号同一毫秒建号，对账顺序由 ULID 的随机部分决定，这里不比较先后
    const audit = app.services.storage.db.prepare("SELECT actor, target FROM audit_logs WHERE action = 'gitlab.sync' ORDER BY target").all();
    expect(audit).toEqual([{ actor: 'system', target: 'admiral' }, { actor: 'system', target: 'alice' }]);
  });

  it('uses the verified email, and falls back to a noreply address when GitLab already has it', async () => {
    const { app, gitlab, db, accountOf } = await setup();
    signIn(app, 'carol', 103);
    signIn(app, 'dave', 104);
    db.prepare('UPDATE users SET canonical_email = ? WHERE id = ?').run('carol@example.test', accountOf(103));
    db.prepare('UPDATE users SET canonical_email = ? WHERE id = ?').run('dave@example.test', accountOf(104));
    gitlab.users.push({ id: 7, username: 'someone', email: 'dave@example.test', name: 'someone', state: 'active', extern_uid: null, provider: null });
    await app.services.gitlab.reconcile();
    expect(userNamed(gitlab, 'carol')!.email).toBe('carol@example.test');
    expect(userNamed(gitlab, 'dave')!.email).toBe('dave@noreply.git.example.test');
  });

  it('adds a suffix when the username is reserved, the group name or taken on GitLab, and keeps it afterwards', async () => {
    const { app, gitlab, row } = await setup();
    gitlab.users.push({ id: 5, username: 'Bob', email: 'bob@elsewhere.test', name: 'Bob', state: 'active', extern_uid: null, provider: null });
    signIn(app, 'bob', 202);
    signIn(app, 'admin', 303);
    signIn(app, 'geek', 304);
    signIn(app, 'repo.git', 305);
    const summary = await app.services.gitlab.reconcile();
    expect(summary.failed).toBe(0);
    expect(row(202)).toMatchObject({ username: 'bob_yz', state: 'active' });
    expect(row(303)).toMatchObject({ username: 'admin_yz' });
    expect(row(304)).toMatchObject({ username: 'geek_yz' });
    expect(row(305)).toMatchObject({ username: 'repo_git' });
    // GitLab 上那个 Bob 不是我们建的，不碰它
    expect(gitlab.users.find(user => user.id === 5)).toMatchObject({ username: 'Bob', state: 'active' });
    expect(gitlab.members.has(5)).toBe(false);
  });

  it('blocks accounts that leave or are disabled, unblocks them when they return, and never deletes', async () => {
    const { app, gitlab, accountOf, promote, row, db } = await setup();
    signIn(app, 'alice', 101);
    signIn(app, 'admiral', 1);
    promote(1);
    await app.services.gitlab.reconcile();
    const alice = userNamed(gitlab, 'alice')!;

    app.services.identity.setSiteRole({ accountId: accountOf(101), role: 'none', actor: 'system' });
    expect(app.services.gitlab.status().find(item => item.login === 'alice')!.pending).toEqual([{ kind: 'block' }]);
    await app.services.gitlab.reconcile();
    expect(alice.state).toBe('blocked');
    expect(row(101)).toMatchObject({ state: 'blocked' });

    app.services.identity.setSiteRole({ accountId: accountOf(101), role: 'admin', actor: 'system' });
    await app.services.gitlab.reconcile();
    expect(alice.state).toBe('active');
    expect(gitlab.members.get(alice.id)).toBe(50);
    expect(row(101)).toMatchObject({ state: 'active', access_level: 50 });

    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(accountOf(101));
    await app.services.gitlab.reconcile();
    expect(alice.state).toBe('blocked');
    // GitLab 那边已经被人手工封了：对账照样认成功
    db.prepare("UPDATE gitlab_accounts SET state = 'active' WHERE account_id = ?").run(accountOf(101));
    expect((await app.services.gitlab.reconcile()).failed).toBe(0);
    expect(row(101)).toMatchObject({ state: 'blocked', last_error: null });
    expect(gitlab.calls.some(call => call.startsWith('DELETE '))).toBe(false);
  });

  it('does not create users for accounts that are not members', async () => {
    const { app, gitlab, accountOf, row } = await setup();
    signIn(app, 'alice', 101);
    signIn(app, 'admiral', 1);
    app.services.identity.setSiteRole({ accountId: accountOf(1), role: 'admin', actor: 'system' });
    app.services.identity.setSiteRole({ accountId: accountOf(101), role: 'none', actor: 'system' });
    await app.services.gitlab.reconcile();
    expect(row(101)).toBeUndefined();
    expect(userNamed(gitlab, 'alice')).toBeUndefined();
  });

  it('adopts the GitLab user that already carries the OIDC identity instead of creating another', async () => {
    const { app, gitlab, subOf, row } = await setup();
    signIn(app, 'alice', 101);
    gitlab.users.push({ id: 42, username: 'alice-old', email: 'old@example.test', name: 'Alice', state: 'active', extern_uid: subOf(101), provider: 'openid_connect' });
    await app.services.gitlab.reconcile();
    expect(gitlab.calls).not.toContain('POST /users');
    expect(row(101)).toMatchObject({ gitlab_user_id: 42, username: 'alice-old', state: 'active', access_level: 30 });
    expect(gitlab.members.get(42)).toBe(30);
  });

  it('prefers the forum profile and its uploaded avatar over GitHub', async () => {
    const { app, gitlab, github, accountOf, db } = await setup();
    signIn(app, 'alice', 101, 'https://avatars.githubusercontent.com/u/101');
    const now = Date.now();
    db.prepare('INSERT INTO forum_avatars(hash, data, created_at) VALUES(?, ?, ?)').run('a'.repeat(64), Buffer.from('RIFF0000WEBPVP8 '), now);
    db.prepare(`INSERT INTO forum_users(id, kind, github_user_id, username, display_name, bio, location, website, avatar_color, avatar_hash, joined_at, updated_at, account_id)
      VALUES('fu-alice', 'member', 101, 'alice', '刘爱丽', '写编译器', '武汉', 'https://alice.dev', '#336699', ?, ?, ?, ?)`).run('a'.repeat(64), now, now, accountOf(101));
    await app.services.gitlab.reconcile();
    expect(userNamed(gitlab, 'alice')).toMatchObject({ name: '刘爱丽', bio: '写编译器', location: '武汉', website_url: 'https://alice.dev', avatar: 'image/webp 16' });
    expect(github.calls).toEqual([]);
  });

  it('records the failure, keeps the reserved username and finishes on the next run', async () => {
    const { app, gitlab, row } = await setup();
    signIn(app, 'alice', 101);
    gitlab.fail('POST /groups/geek/members', 500);
    const first = await app.services.gitlab.reconcile();
    expect(first).toMatchObject({ changed: 0, failed: 1 });
    expect(first.outcomes[0]).toMatchObject({ login: 'alice', error: 'gitlab_member_500', applied: false });
    expect(row(101)).toMatchObject({ username: 'alice', state: 'active', access_level: null, last_error: 'gitlab_member_500' });
    expect(app.services.gitlab.status()[0].pending).toEqual([{ kind: 'set_access', access_level: 30 }]);

    gitlab.setUnreachable(true);
    expect((await app.services.gitlab.reconcile()).outcomes[0].error).toBe('gitlab_unreachable');
    gitlab.setUnreachable(false);

    const second = await app.services.gitlab.reconcile();
    expect(second).toMatchObject({ changed: 1, failed: 0 });
    expect(row(101)).toMatchObject({ access_level: 30, last_error: null, last_error_at: null });
    expect(gitlab.users.filter(user => user.username === 'alice')).toHaveLength(1);
  });

  it('only plans in dry-run mode and does nothing when off', async () => {
    const dry = await setup({ GITLAB_SYNC: 'dry-run', GITLAB_URL: GITLAB });
    signIn(dry.app, 'alice', 101);
    const summary = await dry.app.services.gitlab.reconcile();
    expect(summary.outcomes).toEqual([{ account_id: dry.accountOf(101), login: 'alice', actions: [{ kind: 'create', username: 'alice', access_level: 30 }], applied: false, error: null }]);
    expect(dry.gitlab.calls).toEqual([]);
    expect(dry.db.prepare('SELECT COUNT(*) AS n FROM gitlab_accounts').get()).toEqual({ n: 0 });

    const off = await setup({});
    signIn(off.app, 'alice', 101);
    expect(await off.app.services.gitlab.reconcile()).toMatchObject({ mode: 'off', accounts: 0 });
    expect(off.app.services.gitlab.status()[0].pending).toEqual([]);
    expect(off.gitlab.calls).toEqual([]);
  });
});

describe('console GitLab sync endpoints (#270)', () => {
  async function consoleSetup(env: Record<string, string> = SYNC_ENV) {
    const context = await setup(env);
    const admiralSid = signIn(context.app, 'admiral', 1);
    context.promote(1);
    const memberSid = signIn(context.app, 'alice', 101);
    // 记下站内角色：没记过的账号解析权限时会去问 GitHub，测试里 GitHub 不通
    context.app.services.identity.setSiteRole({ accountId: context.accountOf(101), role: 'member', actor: 'system' });
    const as = (sid: string) => ({ cookie: `sid=${sid}`, origin: 'https://example.test' });
    return { ...context, admiral: as(admiralSid), member: as(memberSid) };
  }
  const sync = (app: FastifyInstance, accountId: string, headers: Record<string, string>) =>
    app.inject({ method: 'POST', url: `/api/console/gitlab/accounts/${accountId}/sync`, headers });

  it('lists every account with what is still to do, for the people who manage roles', async () => {
    const { app, admiral, member, accountOf } = await consoleSetup();
    const res = await app.inject({ url: '/api/console/gitlab/accounts', headers: admiral });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mode: 'on', gitlab_url: GITLAB, group: 'geek' });
    expect(res.json().accounts).toContainEqual({
      account_id: accountOf(101), login: 'alice', username: null, gitlab_user_id: null, state: null, access_level: null,
      last_error: null, last_error_at: null, synced_at: null, pending: [{ kind: 'create', username: 'alice', access_level: 30 }],
    });
    expect((await app.inject({ url: '/api/console/gitlab/accounts', headers: member })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/console/gitlab/accounts' })).statusCode).toBe(401);
  });

  it('syncs one account on request and records who asked', async () => {
    const { app, admiral, member, accountOf, gitlab } = await consoleSetup();
    expect((await sync(app, accountOf(101), member)).statusCode).toBe(403);
    const res = await sync(app, accountOf(101), admiral);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mode: 'on', account_id: accountOf(101), applied: true, error: null, actions: [{ kind: 'create', username: 'alice', access_level: 30 }] });
    expect(userNamed(gitlab, 'alice')).toBeDefined();
    const audit = app.services.storage.db.prepare("SELECT actor, actor_account_id FROM audit_logs WHERE action = 'gitlab.sync'").get();
    expect(audit).toEqual({ actor: 'admiral', actor_account_id: accountOf(1) });
    expect((await sync(app, '01ARZ3NDEKTSV4RRFFQ69G5FAV', admiral)).statusCode).toBe(404);
    expect((await sync(app, accountOf(101), { ...admiral, origin: 'https://evil.test' })).statusCode).toBe(403);
  });

  it('refuses a manual sync while sync is off', async () => {
    const { app, admiral, accountOf } = await consoleSetup({});
    const res = await sync(app, accountOf(101), admiral);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('gitlab_sync_off');
  });
});

describe('GitLab and OIDC configuration (#270)', () => {
  const env = () => ({
    NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://example.test', DB_PATH: ':memory:', FORUM_DB_PATH: ':memory:',
    SESSION_SECRET: 'configuration-test-secret-at-least-32', ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
    OAUTH_CLIENT_ID: 'test-client', OAUTH_CLIENT_SECRET: 'test-secret',
  });

  it('keeps sync off by default and asks for the URL and token when it is on', () => {
    expect(createConfig(env()).gitlab).toEqual({ mode: 'off', url: null, token: null, group: 'geek' });
    expect(createConfig({ ...env(), ...SYNC_ENV, GITLAB_URL: `${GITLAB}/` }).gitlab).toEqual({ mode: 'on', url: GITLAB, token: 'test-gitlab-token', group: 'geek' });
    expect(() => createConfig({ ...env(), GITLAB_SYNC: 'yes' })).toThrow('off, dry-run or on');
    // dry-run 只算出要做什么，不调 GitLab，不要令牌；on 才要
    expect(createConfig({ ...env(), GITLAB_SYNC: 'dry-run', GITLAB_URL: GITLAB }).gitlab).toEqual({ mode: 'dry-run', url: GITLAB, token: null, group: 'geek' });
    expect(() => createConfig({ ...env(), GITLAB_SYNC: 'dry-run' })).toThrow('GITLAB_SYNC needs GITLAB_URL');
    expect(() => createConfig({ ...env(), GITLAB_SYNC: 'on', GITLAB_URL: GITLAB })).toThrow('GITLAB_SYNC=on needs GITLAB_API_TOKEN');
    expect(() => createConfig({ ...env(), ...SYNC_ENV, GITLAB_URL: `${GITLAB}/gitlab` })).toThrow('plain HTTP(S) origin');
    expect(() => createConfig({ ...env(), ...SYNC_ENV, GITLAB_GROUP: 'geek group' })).toThrow('group path');
  });

  it('accepts a private RSA JWK Set as JSON or base64 and nothing else', async () => {
    const { generateKeyPairSync } = await import('node:crypto');
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const privateSet = JSON.stringify({ keys: [{ ...rsa.privateKey.export({ format: 'jwk' }), kid: 'k1' }] });
    expect(createConfig(env()).oidc).toBeNull();
    expect(createConfig({ ...env(), OIDC_JWKS: privateSet }).oidc!.issuer).toBe('https://example.test/oidc');
    expect(createConfig({ ...env(), OIDC_JWKS: Buffer.from(privateSet).toString('base64') }).oidc!.jwks.keys).toHaveLength(1);
    expect(() => createConfig({ ...env(), OIDC_JWKS: JSON.stringify({ keys: [rsa.publicKey.export({ format: 'jwk' })] }) })).toThrow('private keys');
    expect(() => createConfig({ ...env(), OIDC_JWKS: JSON.stringify({ keys: [ec.privateKey.export({ format: 'jwk' })] }) })).toThrow('RSA key');
    expect(() => createConfig({ ...env(), OIDC_JWKS: 'not json' })).toThrow('JWK Set');
  });

  it('turns logins into GitLab usernames', () => {
    expect(gitlabUsername('alice')).toBe('alice');
    expect(gitlabUsername('yz_小明')).toBe('yz___');
    expect(gitlabUsername('-dash.start')).toBe('dash.start');
    expect(gitlabUsername('trailing.')).toBe('trailing');
    expect(gitlabUsername('repo.atom')).toBe('repo_atom');
    expect(gitlabUsername('...')).toBe('member');
    expect(gitlabUsername('x'.repeat(80))).toHaveLength(60);
  });
});
