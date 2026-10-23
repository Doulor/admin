import { generateKeyPairSync, createSign, type JsonWebKey } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServiceOverrides } from '../../app/server/src/services';
import { GOOGLE_JWKS_URL, GOOGLE_TOKEN_URL } from '../../app/server/src/lib/google';
import { signIn, testApp } from './helpers';
import { requestLogFields } from '../../app/server/src/app';
import { CAPABILITY_IDS } from '../../app/server/src/lib/roles';
import { createLoginThrottle } from '../../app/server/src/lib/password-policy';

/**
 * 邮箱验证码与密码、Google、邀请码注册、控制台按站内称号授权（#262，所有者 2026-10-23 的决定，
 * docs/decisions/0005-sso-extend-core-server.md「2026-10-23 修订」）。发信商、Google 与 GitHub 一律是假的。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

const MAIL_ENV = { MAIL_RESEND_API_KEY: 're_test_resend_key_value', MAIL_RESEND_FROM: 'notify@example.test', MAIL_RECIPIENTS: 'all' };
const GOOGLE_ENV = { GOOGLE_CLIENT_ID: 'google-test-client', GOOGLE_CLIENT_SECRET: 'google-test-secret' };
const ORG = 'Yangtze-University-Geek-Class';

/** 假的发信商：记下每封信的收件人和正文，验证码从正文里取。 */
function mailbox() {
  const letters: { to: string; subject: string; text: string }[] = [];
  const fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { to: string[]; subject: string; text: string };
    letters.push({ to: body.to[0], subject: body.subject, text: body.text });
    return new Response(JSON.stringify({ id: `mail-${letters.length}` }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as ServiceOverrides['mailFetch'];
  /** 发信不阻塞响应：等到这个地址收到第 n 封信 */
  async function codeFor(to: string, nth = 1): Promise<string> {
    for (let i = 0; i < 200; i++) {
      const mine = letters.filter(letter => letter.to === to);
      if (mine.length >= nth) return /\b(\d{6})\b/.exec(mine[nth - 1].text)![1];
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`no letter for ${to}`);
  }
  return { letters, fetch, codeFor };
}

/** 假的 GitHub：组织角色按登录名查表；记下每次调用，用来证明邮箱会话没碰 GitHub。 */
function github(roles: Record<string, 'admin' | 'member' | null>, calls: string[]) {
  return ((token: string) => ({
    request: async (route: string, params: { username?: string }) => {
      calls.push(`${route} ${token}`);
      if (route === 'GET /orgs/{org}/memberships/{username}') {
        const role = roles[params.username!.toLowerCase()];
        if (!role) throw Object.assign(new Error('Not Found'), { status: 404 });
        return { data: { state: 'active', role } };
      }
      return { data: [] };
    },
    paginate: async () => [],
  })) as unknown as ServiceOverrides['octokitFactory'];
}

/** 假的 Google：token 端点回一个用测试私钥签的 ID Token，JWKS 端点回对应的公钥。 */
function googleStub() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as JsonWebKey), kid: 'test-kid', alg: 'RS256', use: 'sig' };
  const claims: Record<string, unknown> = { sub: 'google-sub-1', email: 'g.user@gmail.com', email_verified: true };
  const tokenRequests: string[] = [];
  let nonce = '';
  const sign = (payload: Record<string, unknown>) => {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const head = `${part({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' })}.${part(payload)}`;
    return `${head}.${createSign('RSA-SHA256').update(head).sign(privateKey).toString('base64url')}`;
  };
  const httpRequest = (async (url: string, options: { body?: string } = {}) => {
    if (url === GOOGLE_JWKS_URL) return { statusCode: 200, headers: { 'cache-control': 'public, max-age=3600' }, body: { json: async () => ({ keys: [jwk] }) } };
    if (url === GOOGLE_TOKEN_URL) {
      tokenRequests.push(options.body ?? '');
      const now = Math.floor(Date.now() / 1000);
      const idToken = sign({ iss: 'https://accounts.google.com', aud: 'google-test-client', iat: now, exp: now + 600, nonce, ...claims });
      return { statusCode: 200, headers: {}, body: { json: async () => ({ id_token: idToken, access_token: 'unused' }) } };
    }
    throw new Error(`unexpected request ${url}`);
  }) as unknown as ServiceOverrides['httpRequest'];
  return { claims, tokenRequests, httpRequest, setNonce: (value: string) => { nonce = value; } };
}

async function setup(options: { env?: Record<string, string>; roles?: Record<string, 'admin' | 'member' | null>; google?: ReturnType<typeof googleStub> } = {}) {
  const mail = mailbox();
  const calls: string[] = [];
  // 同一个邮箱 60 秒内只能获取一次验证码：用例里要再取一次时把时钟往前拨（tick）
  let now = Date.now();
  const tick = (ms: number) => { now += ms; };
  const context = await testApp({
    clock: () => now,
    mailFetch: mail.fetch, octokitFactory: github(options.roles ?? {}, calls),
    ...(options.google ? { httpRequest: options.google.httpRequest } : {}),
  }, false, { ...MAIL_ENV, ...(options.env ?? {}) });
  contexts.push(context);
  const { app } = context;
  const db = app.services.storage.db;
  const invite = (code: string, extra: { max_uses?: number | null; disabled?: boolean } = {}) => {
    const created = app.services.invites.create({ code, max_uses: extra.max_uses ?? null }, 'test');
    if (extra.disabled) app.services.invites.update(created.id, { disabled: true });
    return created;
  };
  return { app, db, mail, calls, invite, tick };
}

/** 带 cookie 的请求：把响应里的 Set-Cookie 合进一个小罐子，后面的请求自动带上。 */
function browser(app: FastifyInstance) {
  const jar = new Map<string, string>();
  async function send(method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) {
    const response = await app.inject({
      method, url, payload: payload as object | undefined,
      headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(method === 'GET' ? {} : { origin: 'https://example.test' }) },
    });
    for (const raw of ([] as string[]).concat((response.headers['set-cookie'] as string[] | string | undefined) ?? [])) {
      const [pair, ...attrs] = raw.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      if (!value || attrs.some(a => /max-age=0|expires=thu, 01 jan 1970/i.test(a))) jar.delete(name.trim());
      else jar.set(name.trim(), value);
    }
    return response;
  }
  return { send, jar };
}

describe('GET /auth/providers lists what this site has enabled (#262)', () => {
  it('shows GitHub alone without a mail provider, email with one, and Google only with both credentials', async () => {
    const bare = await testApp(); contexts.push(bare);
    expect((await bare.app.inject('/auth/providers')).json().providers.map((p: { id: string }) => p.id)).toEqual(['github']);
    const { app } = await setup({ env: GOOGLE_ENV });
    const providers = (await app.inject('/auth/providers')).json().providers;
    expect(providers.map((p: { id: string }) => p.id)).toEqual(['github', 'google', 'email']);
    expect(providers.find((p: { id: string }) => p.id === 'email')).toEqual({ id: 'email', name: '邮箱', kind: 'email_code', start: '/auth/email/start', can_register: true, password: '/auth/email/password' });
  });
});

describe('email code sign-in and invite-code registration (#262)', () => {
  it('registers a new account only with a valid invite code and never wastes the code on a missing invite', async () => {
    const { app, db, mail, invite } = await setup();
    invite('yugc-test-2026');
    const user = browser(app);
    const start = await user.send('POST', '/auth/email/start', { email: '  New.Member@Example.TEST ', return_to: '/forum/' });
    expect(start.statusCode).toBe(202);
    expect(start.json()).toEqual({ resend_after: 60 });
    const code = await mail.codeFor('new.member@example.test');
    expect(mail.letters[0].subject).toBe('你的极客班登录验证码');
    expect(mail.letters[0].text).not.toMatch(/https?:\/\/\S*(signin|auth)/);

    const missing = await user.send('POST', '/auth/email/verify', { code });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toBe('invite_required');
    const wrong = await user.send('POST', '/auth/email/verify', { code, invite_code: 'not-a-real-code' });
    expect(wrong.json()).toMatchObject({ error: 'invalid_invite', attempts_left: 4 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });

    const ok = await user.send('POST', '/auth/email/verify', { code, invite_code: ' YUGC-test-2026 ' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ return_to: 'https://example.test/forum/', registered: true });
    const me = (await user.send('GET', '/auth/me')).json();
    expect(me).toMatchObject({ signed_in: true, provider: 'email', user_id: null, console_link: false });
    expect(me.login).toMatch(/^yz_[0-9a-hjkmnp-tv-z]{8}$/);
    const account = db.prepare('SELECT org_state, org_role, invite_code_id, canonical_email, handle FROM users').get() as Record<string, unknown>;
    // 邀请码注册的是成员，站内角色记成 member（舰员，#262 第四期）
    expect(account).toMatchObject({ org_state: 'active', org_role: 'member', canonical_email: 'new.member@example.test', handle: me.login });
    expect(db.prepare('SELECT used_count FROM invite_codes').get()).toEqual({ used_count: 1 });
    expect(db.prepare("SELECT action FROM audit_logs WHERE action IN ('auth.register', 'auth.signin') ORDER BY id").all()).toEqual([{ action: 'auth.register' }, { action: 'auth.signin' }]);

    // 同一个验证码不能再用
    const again = browser(app);
    for (const [k, v] of user.jar) if (k === 'email_challenge') again.jar.set(k, v);
    expect((await again.send('POST', '/auth/email/verify', { code })).json().error).toBe('code_expired');
  });

  it('signs an existing account in without an invite and answers start the same for unknown addresses', async () => {
    const { app, mail, invite, tick } = await setup();
    invite('yugc-test-2026');
    const first = browser(app);
    await first.send('POST', '/auth/email/start', { email: 'member@example.test' });
    await first.send('POST', '/auth/email/verify', { code: await mail.codeFor('member@example.test'), invite_code: 'yugc-test-2026' });
    const accountId = (await first.send('GET', '/auth/me')).json().account_id;
    tick(61_000);

    const later = browser(app);
    const known = await later.send('POST', '/auth/email/start', { email: 'member@example.test' });
    const stranger = await browser(app).send('POST', '/auth/email/start', { email: 'nobody@example.test' });
    expect([known.statusCode, known.json()]).toEqual([stranger.statusCode, stranger.json()]);
    await new Promise(resolve => setTimeout(resolve, 0));
    // 60 秒内同一个邮箱不再发；登录页按 retry_after 倒计时
    const again = await later.send('POST', '/auth/email/start', { email: 'member@example.test' });
    expect(again.statusCode).toBe(429);
    expect(again.json()).toMatchObject({ error: 'rate_limited', retry_after: 60 });
    expect(again.headers['retry-after']).toBe('60');
    const ok = await later.send('POST', '/auth/email/verify', { code: await mail.codeFor('member@example.test', 2) });
    expect(ok.json()).toMatchObject({ registered: false });
    expect((await later.send('GET', '/auth/me')).json().account_id).toBe(accountId);
  });

  it('expires a challenge after five wrong codes and rejects malformed addresses', async () => {
    const { app } = await setup();
    const user = browser(app);
    expect((await user.send('POST', '/auth/email/start', { email: 'no-at-sign' })).json().error).toBe('bad_email');
    await user.send('POST', '/auth/email/start', { email: 'guess@example.test' });
    const answers = [];
    for (let i = 0; i < 5; i++) answers.push((await user.send('POST', '/auth/email/verify', { code: '000000' })).json());
    expect(answers.map(a => a.error)).toEqual(['invalid_code', 'invalid_code', 'invalid_code', 'invalid_code', 'code_expired']);
    expect(answers[0].attempts_left).toBe(4);
  });

  it('refuses a disabled or used-up invite code', async () => {
    const { app, mail, invite } = await setup();
    invite('closed-code', { disabled: true });
    invite('one-shot', { max_uses: 1 });
    const a = browser(app);
    await a.send('POST', '/auth/email/start', { email: 'a@example.test' });
    const codeA = await mail.codeFor('a@example.test');
    expect((await a.send('POST', '/auth/email/verify', { code: codeA, invite_code: 'closed-code' })).json().error).toBe('invalid_invite');
    expect((await a.send('POST', '/auth/email/verify', { code: codeA, invite_code: 'one-shot' })).statusCode).toBe(200);
    const b = browser(app);
    await b.send('POST', '/auth/email/start', { email: 'b@example.test' });
    expect((await b.send('POST', '/auth/email/verify', { code: await mail.codeFor('b@example.test'), invite_code: 'one-shot' })).json().error).toBe('invalid_invite');
  });
});

describe('email password sign-in (#262)', () => {
  it('sets a password only on a fresh session with a bound email, then signs in with it', async () => {
    const { app, mail, invite } = await setup();
    invite('yugc-test-2026');
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'pw@example.test' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('pw@example.test'), invite_code: 'yugc-test-2026' });

    expect((await user.send('POST', '/api/identity/password', { password: 'short' })).json().error).toBe('password_too_short');
    expect((await user.send('POST', '/api/identity/password', { password: 'abcd123' })).json()).toMatchObject({ error: 'password_too_short', message: '密码至少 8 位' });
    // 8 位以上就行，不要求大小写、数字或符号
    expect((await user.send('POST', '/api/identity/password', { password: 'abcd1234' })).json()).toEqual({ ok: true });
    const view = (await user.send('GET', '/api/identity/me')).json();
    expect(view).toMatchObject({ has_password: true, identities: [{ provider: 'email', label: 'p***@example.test' }] });
    // 响应合同不删字段：账号页用到的每一项都在
    expect(Object.keys(view).sort()).toEqual(['account_id', 'available', 'created_at', 'email_required', 'has_password', 'identities', 'login', 'membership', 'password_updated_at', 'recent', 'session']);
    expect(view.membership).toEqual({ state: 'active', org_role: 'member', via_invite: true });
    expect(view.session).toEqual(expect.objectContaining({ provider: 'email', step_up_until: view.session.created_at + 10 * 60 * 1000 }));
    expect(view.recent[0]).toEqual({ at: expect.any(Number), action: 'password_set', provider: 'email', result: 'ok' });

    const wrong = await browser(app).send('POST', '/auth/email/password', { email: 'pw@example.test', password: 'not the passphrase!!' });
    expect(wrong.json()).toEqual(expect.objectContaining({ error: 'invalid_credentials' }));
    const unknown = await browser(app).send('POST', '/auth/email/password', { email: 'ghost@example.test', password: 'abcd1234' });
    expect(unknown.json().error).toBe('invalid_credentials');
    const other = browser(app);
    const ok = await other.send('POST', '/auth/email/password', { email: 'PW@example.test', password: 'abcd1234', return_to: '/console' });
    expect(ok.json()).toEqual({ return_to: 'https://example.test/console' });
    expect((await other.send('GET', '/auth/me')).json()).toMatchObject({ signed_in: true, provider: 'email' });
  });

  it('asks a stale session to sign in again or give the current password', async () => {
    const { app, db, mail, invite } = await setup();
    invite('yugc-test-2026');
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'old@example.test' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('old@example.test'), invite_code: 'yugc-test-2026' });
    await user.send('POST', '/api/identity/password', { password: 'first passphrase is long' });
    db.prepare('UPDATE sessions SET created_at = created_at - 11 * 60 * 1000').run();
    expect((await user.send('POST', '/api/identity/password', { password: 'second passphrase is long' })).json()).toMatchObject({ error: 'step_up_required', reauth: { return_to: '/account' } });
    expect((await user.send('POST', '/api/identity/password', { password: 'second passphrase is long', current_password: 'nope' })).json().error).toBe('invalid_credentials');
    expect((await user.send('POST', '/api/identity/password', { password: 'second passphrase is long', current_password: 'first passphrase is long' })).json()).toEqual({ ok: true });
  });
});

describe('console permissions come only from the site account; GitHub is a connection the server makes (#262 第四期)', () => {
  it('gives the provisioned owner 提督 with every capability through email and reports GitHub as not connected without a GitHub App', async () => {
    const { app, mail, calls } = await setup();
    const owner = app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' });
    expect(owner).toMatchObject({ created: true, emailLinked: true });
    // 重跑不重复建
    expect(app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' })).toMatchObject({ accountId: owner.accountId, created: false, emailLinked: false });

    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'owner@example.test' });
    expect((await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('owner@example.test') })).json()).toMatchObject({ registered: false });
    expect((await user.send('GET', '/auth/me')).json()).toMatchObject({ login: 'Crosery', user_id: 130495739, account_id: owner.accountId, provider: 'email', console_link: true });
    const me = (await user.send('GET', '/api/console/me')).json();
    expect(me).toMatchObject({ provider: 'email', site_role: 'admin', github: 'none' });
    expect(me.title).toMatchObject({ id: 'admin', source: 'site' });
    expect(me.capabilities).toEqual(CAPABILITY_IDS);
    expect(me).not.toHaveProperty('blocked');

    // 有 github.* 能力，但服务器没配 GitHub App、这次也不是 GitHub 会话：GitHub 页面回 409，不是 403
    const overview = await user.send('GET', `/api/admin/${ORG}/overview`);
    expect([overview.statusCode, overview.json().error]).toEqual([409, 'github_not_connected']);
    expect(overview.json().message).toMatch(/GitHub 还没接上/);
    // 列本人加入的 GitHub 组织只对 GitHub 会话有意义
    expect((await user.send('GET', '/api/me/orgs')).json().error).toBe('github_session_required');
    // 成员与权限照常打开：名单来自极客班账号，GitHub 没接上就不并 GitHub 组织
    const people = await user.send('GET', '/api/console/people');
    expect(people.statusCode).toBe(200);
    expect(people.json()).toMatchObject({ github: 'none', github_listed: false });
    expect(people.json().people).toEqual([expect.objectContaining({
      account_id: owner.accountId, login: 'Crosery', user_id: 130495739, site_role: 'admin', member: true, status: 'active',
      providers: ['github', 'email'], role_unrecorded: false, titles: [expect.objectContaining({ id: 'admin' })],
    })]);
    // 名单不带邮箱：只管本部门的队长也能看名单
    expect(people.json().people[0]).not.toHaveProperty('github_role');
    expect(people.json().people[0]).not.toHaveProperty('email');
    // 没登录过本站的 GitHub 用户名，GitHub 又没接上：查不到这个人
    const unknown = await user.send('POST', '/api/console/assignments', { github_login: 'someone', role: 'alumni' });
    expect([unknown.statusCode, unknown.json().error]).toEqual([400, 'github_user_not_found']);
    // 绑定了 GitHub 的账号用邮箱登录，在论坛里照常是成员
    expect((await user.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('member');
    expect(calls).toEqual([]);
  });

  it('makes an invite-registered member a 舰员 who can be given titles by account, without GitHub', async () => {
    const { app, mail, invite, calls } = await setup();
    invite('yugc-test-2026');
    const owner = app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' });
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'crew@example.test' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('crew@example.test'), invite_code: 'yugc-test-2026' });
    expect((await user.send('GET', '/api/me/competitions')).statusCode).toBe(200);
    const me = (await user.send('GET', '/api/console/me')).json();
    expect([me.site_role, me.title.id, me.capabilities]).toEqual(['member', 'member', ['console.access', 'github.org.read']]);
    // 论坛用户按 GitHub id 建：没有绑定 GitHub 的账号在论坛里是游客
    expect((await user.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('guest');

    // 提督按账号给他队长称号，不用 GitHub 用户名
    const admiral = browser(app);
    await admiral.send('POST', '/auth/email/start', { email: 'owner@example.test' });
    await admiral.send('POST', '/auth/email/verify', { code: await mail.codeFor('owner@example.test') });
    const crewId = (await user.send('GET', '/auth/me')).json().account_id as string;
    const assigned = await admiral.send('POST', '/api/console/assignments', { account_id: crewId, role: 'head', department_id: 'recruitment' });
    expect(assigned.statusCode).toBe(201);
    expect(assigned.json().assignment).toMatchObject({ github_login: me.login, github_user_id: null, role: 'head', department_id: 'recruitment' });
    const after = (await user.send('GET', '/api/console/me')).json();
    expect(after.title).toMatchObject({ id: 'head', source: 'assignment' });
    expect(after.capabilities).toEqual(expect.arrayContaining(['applications.review', 'github.invites.manage']));
    const missing = await admiral.send('POST', '/api/console/assignments', { account_id: '01HZZZZZZZZZZZZZZZZZZZZZZZ', role: 'alumni' });
    expect([missing.statusCode, missing.json().error]).toEqual([404, 'account_not_found']);
    expect(owner.accountId).not.toBe(crewId);
    expect(calls).toEqual([]);
  });

  it('records the GitHub org role of an unrecorded account once, then keeps the site record whatever GitHub says later', async () => {
    const roles: Record<string, 'admin' | 'member' | null> = { octocat: 'member' };
    const { app, db, calls } = await setup({ roles });
    const sid = signIn(app, 'octocat', 42);
    expect((await app.inject({ url: '/auth/me', headers: { cookie: `sid=${sid}` } })).json().signed_in).toBe(true);
    expect(db.prepare('SELECT org_role, org_state FROM users').get()).toEqual({ org_role: 'member', org_state: 'active' });
    const asked = calls.length;
    roles.octocat = null;
    app.services.cache.invalidate('console:orgrole:');
    const accountId = (db.prepare('SELECT id FROM users').get() as { id: string }).id;
    const access = await app.services.access.resolve({ login: 'octocat', userId: 42, accountId, accessToken: 'token-octocat', provider: 'github' });
    expect([access.member, access.siteRole]).toEqual([true, 'member']);
    expect(db.prepare('SELECT org_role, org_state FROM users').get()).toEqual({ org_role: 'member', org_state: 'active' });
    expect(calls).toHaveLength(asked);
  });

  it('lists an unrecorded account as unrecorded rather than removed, and lets 提督 settle it as a member', async () => {
    const { app } = await setup();
    signIn(app, 'octocat', 42);
    const listed = () => app.services.identity.listAccounts().find(account => account.login === 'octocat')!;
    expect(listed()).toMatchObject({ site_role: null, role_unrecorded: true, member: true });
    expect(app.services.identity.setSiteRole({ accountId: listed().account_id, role: 'member', actor: { login: 'boss', account_id: null } })).toEqual({ ok: true, changed: true });
    expect(listed()).toMatchObject({ site_role: 'member', role_unrecorded: false, member: true });
  });
});

describe('site roles in 成员与权限 (#262 第四期)', () => {
  it('lets only 提督 change site roles, keeps one admin, and applies the change to live sessions at once', async () => {
    const { app, db, mail, invite, tick } = await setup();
    invite('yugc-test-2026');
    const owner = app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' });
    const signInByEmail = async (email: string, invite_code?: string, nth = 1) => {
      const user = browser(app);
      await user.send('POST', '/auth/email/start', { email });
      const verified = await user.send('POST', '/auth/email/verify', { code: await mail.codeFor(email, nth), ...(invite_code ? { invite_code } : {}) });
      return { user, verified };
    };
    const { user: admiral } = await signInByEmail('owner@example.test');
    const { user: crew } = await signInByEmail('crew@example.test', 'yugc-test-2026');
    const { user: captain } = await signInByEmail('cap@example.test', 'yugc-test-2026');
    const idOf = async (user: ReturnType<typeof browser>) => (await user.send('GET', '/auth/me')).json().account_id as string;
    const [crewId, captainId] = [await idOf(crew), await idOf(captain)];
    const patch = (user: ReturnType<typeof browser>, accountId: string, site_role: string) => user.send('PATCH', `/api/console/people/${accountId}/site-role`, { site_role });

    // 舰长有 roles.manage，也改不了站内角色
    expect((await admiral.send('POST', '/api/console/assignments', { account_id: captainId, role: 'captain' })).statusCode).toBe(201);
    const byCaptain = await patch(captain, crewId, 'admin');
    expect([byCaptain.statusCode, byCaptain.json().error]).toEqual([403, 'admiral_required']);
    expect((await patch(crew, crewId, 'admin')).json().error).toBe('missing_capability');
    expect((await patch(admiral, crewId, 'pirate')).statusCode).toBe(400);
    expect((await patch(admiral, '01HZZZZZZZZZZZZZZZZZZZZZZZ', 'member')).statusCode).toBe(404);

    // 提督把舰员升成管理员；同一个会话下一次请求就是提督
    expect((await patch(admiral, crewId, 'admin')).json()).toEqual({ account_id: crewId, site_role: 'admin', changed: true });
    expect((await patch(admiral, crewId, 'admin')).json()).toEqual({ account_id: crewId, site_role: 'admin', changed: false });
    expect((await crew.send('GET', '/api/console/me')).json()).toMatchObject({ site_role: 'admin', title: { id: 'admin' } });

    // 新提督把原来的移出极客班：原会话立刻没有任何能力，再登录被拒
    expect((await patch(crew, owner.accountId, 'none')).json()).toMatchObject({ site_role: 'none', changed: true });
    const removed = (await admiral.send('GET', '/api/console/me')).json();
    expect([removed.site_role, removed.title.id, removed.capabilities]).toEqual([null, 'guest', []]);
    expect((await admiral.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('guest');
    tick(61_000);
    const { verified: refused } = await signInByEmail('owner@example.test', undefined, 2);
    expect([refused.statusCode, refused.json().error]).toEqual([403, 'not_member']);

    // 至少留一位管理员
    const last = await patch(crew, crewId, 'member');
    expect([last.statusCode, last.json().error]).toEqual([409, 'last_admin']);
    expect(db.prepare("SELECT details FROM audit_logs WHERE action = 'account.role' ORDER BY id").all().map(row => JSON.parse((row as { details: string }).details)))
      .toEqual([{ account_id: crewId, from: 'member', to: 'admin' }, { account_id: owner.accountId, from: 'admin', to: 'none' }]);
    expect(db.prepare("SELECT user_id, reason FROM identity_audit WHERE action = 'role_change' ORDER BY id").all())
      .toEqual([{ user_id: crewId, reason: 'admin' }, { user_id: owner.accountId, reason: 'none' }]);
  });
});

describe('GitHub sign-in: the site decides once an account is recorded (#262 第四期)', () => {
  const user = { id: 42, login: 'octocat' };
  const httpRequest = (async (url: string) => ({
    statusCode: 200,
    body: { json: async () => url.includes('/access_token') ? { access_token: 'test-provider-token' } : { id: user.id, login: user.login, avatar_url: '' }, dump: async () => undefined },
  })) as unknown as ServiceOverrides['httpRequest'];
  function orgGate(roles: Record<string, 'admin' | 'member' | undefined>, calls: string[]) {
    return (() => ({
      request: async (route: string) => {
        calls.push(route);
        if (route !== 'GET /user/memberships/orgs/{org}') throw new Error(`Unexpected GitHub call ${route}`);
        const role = roles[user.login];
        if (!role) throw Object.assign(new Error('Not Found'), { status: 404 });
        return { data: { state: 'active', role } };
      },
    })) as unknown as ServiceOverrides['octokitFactory'];
  }
  async function callback(app: FastifyInstance) {
    const start = await app.inject('/auth/github?return_to=https%3A%2F%2Fexample.test%2Fforum%2F');
    const state = new URL(String(start.headers.location)).searchParams.get('state');
    const response = await app.inject({ url: `/auth/callback?code=ok&state=${state}`, headers: { cookie: String(start.headers['set-cookie']).split(';')[0] } });
    return String(response.headers.location);
  }

  it('asks GitHub only for new users, then signs a recorded member in after they leave the org, and refuses once the site removes them', async () => {
    const roles: Record<string, 'admin' | 'member' | undefined> = { octocat: 'admin' };
    const calls: string[] = [];
    const context = await testApp({ httpRequest, octokitFactory: orgGate(roles, calls) }); contexts.push(context);
    const { app } = context;
    const db = app.services.storage.db;
    Object.assign(user, { id: 42, login: 'octocat' });

    // 新 GitHub 用户：看组织资格；站内还没有管理员，组织 owner 注册成站内管理员（空库起步）
    expect(await callback(app)).toBe('https://example.test/forum/');
    expect(calls).toEqual(['GET /user/memberships/orgs/{org}']);
    expect(db.prepare('SELECT org_role, org_state FROM users').get()).toEqual({ org_role: 'admin', org_state: 'active' });

    // 退出 GitHub 组织：站内记着的账号不再看 GitHub，照常登录、照常是管理员
    roles.octocat = undefined;
    expect(await callback(app)).toBe('https://example.test/forum/');
    expect(calls).toHaveLength(1);
    expect(db.prepare('SELECT org_role, org_state FROM users').get()).toEqual({ org_role: 'admin', org_state: 'active' });

    // 站内移出之后再用 GitHub 登录：拒绝，不建会话
    const accountId = (db.prepare('SELECT id FROM users').get() as { id: string }).id;
    db.prepare("UPDATE users SET org_role = NULL, org_state = 'not_member' WHERE id = ?").run(accountId);
    const sessions = (db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n;
    expect(await callback(app)).toContain('signin=not_member');
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()).toEqual({ n: sessions });
    expect(calls).toHaveLength(1);
    expect(db.prepare("SELECT action, reason FROM identity_audit WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(accountId)).toEqual({ action: 'login_denied', reason: 'not_member' });

    // 不在组织里的新 GitHub 用户：照旧拒绝，不建号
    Object.assign(user, { id: 43, login: 'stranger' });
    expect(await callback(app)).toContain('signin=not_member');
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
    Object.assign(user, { id: 42, login: 'octocat' });
  });

  it('registers a later GitHub org owner as a member: once the site has an admin, GitHub ownership does not make site admins', async () => {
    const roles: Record<string, 'admin' | 'member' | undefined> = { octocat: 'admin', newowner: 'admin' };
    const calls: string[] = [];
    const context = await testApp({ httpRequest, octokitFactory: orgGate(roles, calls) }); contexts.push(context);
    const { app } = context;
    const db = app.services.storage.db;
    const roleOf = (githubId: number) => db.prepare(`SELECT u.org_role, u.org_state FROM users u JOIN identities i ON i.user_id = u.id
      WHERE i.provider = 'github' AND i.provider_uid = ?`).get(String(githubId));
    Object.assign(user, { id: 42, login: 'octocat' });
    expect(await callback(app)).toBe('https://example.test/forum/');
    expect(roleOf(42)).toEqual({ org_role: 'admin', org_state: 'active' });

    // 能改 GitHub 组织角色的人（例如经 GitHub App 有 github.members.manage 的舰长）把别人设成 owner，也造不出站内管理员
    Object.assign(user, { id: 44, login: 'newowner' });
    expect(await callback(app)).toBe('https://example.test/forum/');
    expect(roleOf(44)).toEqual({ org_role: 'member', org_state: 'active' });
    Object.assign(user, { id: 42, login: 'octocat' });
  });

  it('sends a GitHub account without an email to the bind page first, and straight back once one is bound (#273)', async () => {
    const context = await testApp({ httpRequest, octokitFactory: orgGate({ octocat: 'member' }, []) }, false, MAIL_ENV); contexts.push(context);
    const { app } = context;
    Object.assign(user, { id: 42, login: 'octocat' });
    expect(await callback(app)).toBe('https://example.test/bind-email?return_to=%2Fforum%2F');
    const accountId = (app.services.storage.db.prepare('SELECT id FROM users').get() as { id: string }).id;
    app.services.identity.linkEmail({ accountId, email: 'octo@example.test', login: 'octocat', claim: () => true });
    expect(await callback(app)).toBe('https://example.test/forum/');
  });
});

describe('binding an email to a GitHub account (#262)', () => {
  it('binds once, refuses an address that belongs to someone else, and then allows email sign-in', async () => {
    const { app, mail, invite, tick } = await setup({ roles: { octocat: 'member' } });
    invite('yugc-test-2026');
    const other = browser(app);
    await other.send('POST', '/auth/email/start', { email: 'taken@example.test' });
    await other.send('POST', '/auth/email/verify', { code: await mail.codeFor('taken@example.test'), invite_code: 'yugc-test-2026' });
    tick(61_000);

    const user = browser(app);
    user.jar.set('sid', signIn(app, 'octocat', 42));
    await user.send('POST', '/api/identity/email/start', { email: 'taken@example.test' });
    expect((await user.send('POST', '/api/identity/email/verify', { code: await mail.codeFor('taken@example.test', 2) })).json().error).toBe('identity_conflict');
    expect((await user.send('POST', '/api/identity/email/start', { email: 'octo@example.test' })).statusCode).toBe(202);
    expect((await user.send('POST', '/api/identity/email/verify', { code: await mail.codeFor('octo@example.test') })).json()).toEqual({ ok: true });
    expect((await user.send('GET', '/api/identity/me')).json().identities.map((i: { provider: string }) => i.provider)).toEqual(['github', 'email']);

    tick(61_000);
    const later = browser(app);
    await later.send('POST', '/auth/email/start', { email: 'octo@example.test' });
    await later.send('POST', '/auth/email/verify', { code: await mail.codeFor('octo@example.test', 2) });
    expect((await later.send('GET', '/auth/me')).json()).toMatchObject({ login: 'octocat', user_id: 42, provider: 'email' });
  });
});

describe('invite codes in the console (#262)', () => {
  it('lets 提督 create, list and disable codes and keeps everyone else out', async () => {
    const { app } = await setup({ roles: { boss: 'admin', crew: 'member' } });
    const boss = browser(app); boss.jar.set('sid', signIn(app, 'boss', 1));
    const crew = browser(app); crew.jar.set('sid', signIn(app, 'crew', 2));
    const refused = await crew.send('GET', '/api/console/invites');
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ capability: 'accounts.invites.manage' });
    const created = await boss.send('POST', '/api/console/invites', { code: 'Spring-2027', note: '春季招新', max_uses: 30 });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ code: 'spring-2027', note: '春季招新', max_uses: 30, used_count: 0, disabled: false, usable: true });
    expect((await boss.send('POST', '/api/console/invites', { code: 'SPRING-2027' })).json().error).toBe('invite_code_taken');
    expect((await boss.send('POST', '/api/console/invites', { code: 'no' })).statusCode).toBe(400);
    const disabled = await boss.send('PATCH', `/api/console/invites/${created.json().id}`, { disabled: true });
    expect(disabled.json()).toMatchObject({ disabled: true, usable: false });
    expect((await boss.send('GET', '/api/console/invites')).json().invites).toEqual([{
      id: created.json().id, code: 'spring-2027', note: '春季招新', max_uses: 30, used_count: 0, expires_at: null, disabled: true,
      created_by: 'boss', created_at: expect.any(Number), updated_at: expect.any(Number), usable: false,
    }]);
  });
});

describe('Google sign-in (#262)', () => {
  async function googleFlow(app: FastifyInstance, google: ReturnType<typeof googleStub>, query = '') {
    const user = browser(app);
    const start = await user.send('GET', `/auth/google?return_to=%2Fforum%2F${query}`);
    expect(start.statusCode).toBe(302);
    const location = new URL(String(start.headers.location));
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    google.setNonce(location.searchParams.get('nonce')!);
    const back = await user.send('GET', `/auth/google/callback?code=ok&state=${location.searchParams.get('state')}`);
    return { user, location: String(back.headers.location) };
  }

  it('is not there without credentials', async () => {
    const { app } = await setup();
    expect((await app.inject('/auth/google')).json().error).toBe('provider_not_enabled');
  });

  it('asks for an invite on first use, registers with one and signs the same account in later', async () => {
    const google = googleStub();
    const { app, db, mail, invite } = await setup({ env: GOOGLE_ENV, google });
    invite('yugc-test-2026');
    const first = await googleFlow(app, google);
    expect(first.location).toBe('https://example.test/signin?signin=invite_required&provider=google&return_to=%2Fforum%2F');
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });

    // Google 给的邮箱不算登录邮箱（#273）：注册后先到绑定邮箱页
    const second = await googleFlow(app, google, '&invite=yugc-test-2026');
    expect(second.location).toBe('https://example.test/bind-email?return_to=%2Fforum%2F');
    expect(google.tokenRequests.at(-1)).toContain('code_verifier=');
    const me = (await second.user.send('GET', '/auth/me')).json();
    expect(me).toMatchObject({ signed_in: true, provider: 'google', email_required: true });
    expect(db.prepare("SELECT provider_uid, email FROM identities WHERE provider = 'google'").get()).toEqual({ provider_uid: 'google-sub-1', email: 'g.user@gmail.com' });
    // 绑上同一个 Gmail 地址就行；之后用 Google 登录直接回原页
    expect((await second.user.send('POST', '/api/identity/email/start', { email: 'g.user@gmail.com' })).statusCode).toBe(202);
    expect((await second.user.send('POST', '/api/identity/email/verify', { code: await mail.codeFor('g.user@gmail.com') })).json()).toEqual({ ok: true });

    const third = await googleFlow(app, google);
    expect(third.location).toBe('https://example.test/forum/');
    expect((await third.user.send('GET', '/auth/me')).json().account_id).toBe(me.account_id);
  });

  it('does not create a second account for an email that already has one, and fails closed on a bad token', async () => {
    const google = googleStub();
    const { app, mail, invite } = await setup({ env: GOOGLE_ENV, google });
    invite('yugc-test-2026');
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'g.user@gmail.com' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('g.user@gmail.com'), invite_code: 'yugc-test-2026' });
    expect((await googleFlow(app, google, '&invite=yugc-test-2026')).location).toContain('signin=email_taken');

    google.claims.sub = 'google-sub-2';
    google.claims.email = 'other@gmail.com';
    google.claims.aud = 'someone-else';
    expect((await googleFlow(app, google, '&invite=yugc-test-2026')).location).toContain('signin=failed');
  });
});

describe('forgot password and the bind-email gate (#273)', () => {
  /** 用邀请码注册一个邮箱账号，passphrase 不为空时再在账号页设上密码；返回这个浏览器和账号 id。 */
  async function emailAccount(context: Awaited<ReturnType<typeof setup>>, email: string, passphrase?: string) {
    const user = browser(context.app);
    await user.send('POST', '/auth/email/start', { email });
    await user.send('POST', '/auth/email/verify', { code: await context.mail.codeFor(email), invite_code: 'yugc-test-2026' });
    if (passphrase) expect((await user.send('POST', '/api/identity/password', { password: passphrase })).json()).toEqual({ ok: true });
    return { user, accountId: (await user.send('GET', '/auth/me')).json().account_id as string };
  }

  it('resets a forgotten password with an emailed code, signs in, and keeps the code for a second try when the new password is too short', async () => {
    const context = await setup();
    const { app, db, mail, invite, tick } = context;
    invite('yugc-test-2026');
    const { accountId } = await emailAccount(context, 'forgot@example.test', 'old passphrase here');
    tick(61_000);

    const user = browser(app);
    expect((await user.send('POST', '/auth/email/start', { email: 'forgot@example.test', purpose: 'reset', return_to: '/console' })).statusCode).toBe(202);
    const code = await mail.codeFor('forgot@example.test', 2);
    expect(mail.letters[1].subject).toBe('你的极客班重设密码验证码');
    expect(mail.letters[1].text).toContain('你正在重设极客班账号的密码');

    const short = await user.send('POST', '/auth/email/reset', { code, password: 'abc' });
    expect([short.statusCode, short.json()]).toEqual([400, { error: 'password_too_short', message: '密码至少 8 位' }]);
    expect((await user.send('POST', '/auth/email/reset', { code: code === '000000' ? '111111' : '000000', password: 'new passphrase here' })).json()).toMatchObject({ error: 'invalid_code', attempts_left: 4 });
    const ok = await user.send('POST', '/auth/email/reset', { code, password: 'new passphrase here' });
    expect([ok.statusCode, ok.json()]).toEqual([200, { return_to: 'https://example.test/console' }]);
    expect((await user.send('GET', '/auth/me')).json()).toMatchObject({ signed_in: true, provider: 'email', account_id: accountId, email_required: false });
    // 同一个验证码不能再用
    expect((await user.send('POST', '/auth/email/reset', { code, password: 'third passphrase here' })).json().error).toBe('code_expired');

    expect((await browser(app).send('POST', '/auth/email/password', { email: 'forgot@example.test', password: 'old passphrase here' })).json().error).toBe('invalid_credentials');
    expect((await browser(app).send('POST', '/auth/email/password', { email: 'forgot@example.test', password: 'new passphrase here' })).statusCode).toBe(200);
    expect(db.prepare("SELECT action, provider, result FROM identity_audit WHERE user_id = ? AND action LIKE 'password_%' ORDER BY id").all(accountId))
      .toEqual([{ action: 'password_set', provider: 'email', result: 'ok' }, { action: 'password_reset', provider: 'email', result: 'ok' }]);
    expect(db.prepare("SELECT details FROM audit_logs WHERE action = 'account.password' ORDER BY id").all().map(row => JSON.parse((row as { details: string }).details)))
      .toEqual([{ action: 'set' }, { action: 'reset' }]);
    const view = (await user.send('GET', '/api/identity/me')).json();
    expect(view.recent[0]).toMatchObject({ action: 'login', provider: 'email' });
    expect(view.recent.map((r: { action: string }) => r.action)).toContain('password_reset');
  });

  it('sets a first password the same way for an email account that never had one', async () => {
    const context = await setup();
    const { app, mail, invite, tick } = context;
    invite('yugc-test-2026');
    await emailAccount(context, 'nopw@example.test');
    tick(61_000);
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'nopw@example.test', purpose: 'reset' });
    expect((await user.send('POST', '/auth/email/reset', { code: await mail.codeFor('nopw@example.test', 2), password: 'fresh passphrase' })).statusCode).toBe(200);
    expect((await user.send('GET', '/api/identity/me')).json()).toMatchObject({ has_password: true });
  });

  it('cannot register or open a disabled account, and leaves the code unused when there is no account', async () => {
    const context = await setup();
    const { app, db, mail, invite, tick } = context;
    invite('yugc-test-2026');
    const stranger = browser(app);
    await stranger.send('POST', '/auth/email/start', { email: 'ghost@example.test', purpose: 'reset' });
    const none = await stranger.send('POST', '/auth/email/reset', { code: await mail.codeFor('ghost@example.test'), password: 'some passphrase' });
    expect([none.statusCode, none.json().error]).toEqual([400, 'no_account']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT used_at FROM email_challenges WHERE email = ?').get('ghost@example.test')).toEqual({ used_at: null });

    const { accountId } = await emailAccount(context, 'off@example.test', 'old passphrase here');
    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(accountId);
    tick(61_000);
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'off@example.test', purpose: 'reset' });
    const refused = await user.send('POST', '/auth/email/reset', { code: await mail.codeFor('off@example.test', 2), password: 'new passphrase here' });
    expect([refused.statusCode, refused.json().error]).toEqual([403, 'account_disabled']);
    expect(user.jar.has('sid')).toBe(false);
    expect((await browser(app).send('POST', '/auth/email/password', { email: 'off@example.test', password: 'new passphrase here' })).json().error).toBe('invalid_credentials');
  });

  it('flags an account without a login email on /auth/me, the account page and the console, until one is bound', async () => {
    const { app, mail } = await setup({ roles: { octocat: 'member' } });
    const user = browser(app);
    user.jar.set('sid', signIn(app, 'octocat', 42));
    expect((await user.send('GET', '/auth/me')).json()).toMatchObject({ signed_in: true, email_required: true });
    expect((await user.send('GET', '/api/identity/me')).json()).toMatchObject({ email_required: true, available: ['email'] });
    expect((await user.send('GET', '/api/console/me')).json()).toMatchObject({ email_required: true });

    await user.send('POST', '/api/identity/email/start', { email: 'octo@example.test' });
    expect((await user.send('POST', '/api/identity/email/verify', { code: await mail.codeFor('octo@example.test') })).json()).toEqual({ ok: true });
    expect((await user.send('GET', '/auth/me')).json().email_required).toBe(false);
    expect((await user.send('GET', '/api/identity/me')).json().email_required).toBe(false);
    expect((await user.send('GET', '/api/console/me')).json().email_required).toBe(false);
  });

  it('does not ask for an email where this site cannot send one', async () => {
    const context = await testApp({ octokitFactory: github({ octocat: 'member' }, []) }); contexts.push(context);
    const headers = { cookie: `sid=${signIn(context.app, 'octocat', 42)}` };
    expect((await context.app.inject({ url: '/auth/me', headers })).json().email_required).toBe(false);
    expect((await context.app.inject({ url: '/api/identity/me', headers })).json().email_required).toBe(false);
    expect((await context.app.inject({ url: '/api/console/me', headers })).json().email_required).toBe(false);
  });
});

describe('hardening from the #262 review', () => {
  it('keeps a recorded admin role when GitHub refuses the same person: GitHub no longer takes site access away', async () => {
    const { app, mail } = await setup();
    app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' });
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'owner@example.test' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('owner@example.test') });
    expect((await user.send('GET', '/api/console/me')).json().title.id).toBe('admin');

    // 站内记着角色的账号，GitHub 那边的拒绝只记一条 login_denied，不改站内角色；移出极客班在「成员与权限」里做
    expect(app.services.identity.githubSigninPlan(130495739)).toBe('site');
    app.services.identity.recordGithubDenied({ github: { id: 130495739, login: 'Crosery', avatarUrl: null }, reason: 'not_member' });
    const me = (await user.send('GET', '/api/console/me')).json();
    expect([me.site_role, me.title.id]).toEqual(['admin', 'admin']);
    expect((await user.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('member');
  });

  it('lets only the same browser void an earlier code, so a stranger cannot cancel yours', async () => {
    const { app, db, mail, invite, tick } = await setup();
    invite('yugc-test-2026');
    const victim = browser(app);
    await victim.send('POST', '/auth/email/start', { email: 'v@example.test' });
    const code = await mail.codeFor('v@example.test');
    tick(61_000);
    await browser(app).send('POST', '/auth/email/start', { email: 'v@example.test' });
    expect((await victim.send('POST', '/auth/email/verify', { code, invite_code: 'yugc-test-2026' })).statusCode).toBe(200);

    const me = browser(app);
    await me.send('POST', '/auth/email/start', { email: 'w@example.test' });
    tick(61_000);
    await me.send('POST', '/auth/email/start', { email: 'w@example.test' });
    const used = db.prepare('SELECT used_at IS NOT NULL AS used FROM email_challenges WHERE email = ? ORDER BY created_at').all('w@example.test');
    expect(used).toEqual([{ used: 1 }, { used: 0 }]);
    expect((await me.send('POST', '/auth/email/verify', { code: await mail.codeFor('w@example.test', 2), invite_code: 'yugc-test-2026' })).statusCode).toBe(200);
  });

  it('rate-limits both Google endpoints', async () => {
    const { app } = await setup({ env: GOOGLE_ENV });
    const callback = [];
    for (let i = 0; i < 11; i++) callback.push((await app.inject('/auth/google/callback')).statusCode);
    expect(callback).toEqual([...Array(10).fill(400), 429]);
    const start = [];
    for (let i = 0; i < 21; i++) start.push((await app.inject('/auth/google')).statusCode);
    expect(start).toEqual([...Array(20).fill(302), 429]);
  });

  it('keeps the password throttle working for new addresses when its table is full', () => {
    const throttle = createLoginThrottle();
    for (let i = 0; i < 5000; i++) throttle.take(`filler-${i}@example.test`);
    expect(throttle.take('real@example.test')).toBe(true);
    for (let i = 0; i < 9; i++) throttle.take('real@example.test');
    expect(throttle.take('real@example.test')).toBe(false);
  });

  it('keeps OAuth codes and invite codes in /auth query strings out of request logs', () => {
    expect(requestLogFields({ method: 'GET', url: '/auth/google?invite=spring-2027&return_to=%2F', host: 'example.test', ip: '203.0.113.9' }))
      .toEqual({ method: 'GET', url: '/auth/google', host: 'example.test', remoteAddress: '203.0.113.9', remotePort: undefined });
    expect(requestLogFields({ method: 'GET', url: '/auth/callback?code=abc&state=xyz' }).url).toBe('/auth/callback');
    expect(requestLogFields({ method: 'GET', url: '/api/console/audit?limit=5' }).url).toBe('/api/console/audit?limit=5');
  });
});
