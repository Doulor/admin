import { generateKeyPairSync, createSign, type JsonWebKey } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ServiceOverrides } from '../../app/server/src/services';
import { GOOGLE_JWKS_URL, GOOGLE_TOKEN_URL } from '../../app/server/src/lib/google';
import { signIn, testApp } from './helpers';
import { requestLogFields } from '../../app/server/src/app';
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
    expect(account).toMatchObject({ org_state: 'active', org_role: null, canonical_email: 'new.member@example.test', handle: me.login });
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
    expect((await user.send('POST', '/api/identity/password', { password: 'a long enough passphrase' })).json()).toEqual({ ok: true });
    const view = (await user.send('GET', '/api/identity/me')).json();
    expect(view).toMatchObject({ has_password: true, identities: [{ provider: 'email', label: 'p***@example.test' }] });
    // 响应合同不删字段：账号页用到的每一项都在
    expect(Object.keys(view).sort()).toEqual(['account_id', 'available', 'created_at', 'has_password', 'identities', 'login', 'membership', 'password_updated_at', 'recent', 'session']);
    expect(view.membership).toEqual({ state: 'active', org_role: null, via_invite: true });
    expect(view.session).toEqual(expect.objectContaining({ provider: 'email', step_up_until: view.session.created_at + 10 * 60 * 1000 }));
    expect(view.recent[0]).toEqual({ at: expect.any(Number), action: 'password_set', provider: 'email', result: 'ok' });

    const wrong = await browser(app).send('POST', '/auth/email/password', { email: 'pw@example.test', password: 'not the passphrase!!' });
    expect(wrong.json()).toEqual(expect.objectContaining({ error: 'invalid_credentials' }));
    const unknown = await browser(app).send('POST', '/auth/email/password', { email: 'ghost@example.test', password: 'a long enough passphrase' });
    expect(unknown.json().error).toBe('invalid_credentials');
    const other = browser(app);
    const ok = await other.send('POST', '/auth/email/password', { email: 'PW@example.test', password: 'a long enough passphrase', return_to: '/console' });
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

describe('console capabilities follow in-site titles; GitHub pages need a GitHub session (#262)', () => {
  it('gives the provisioned owner 提督 through email, locks github.* and never calls GitHub', async () => {
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
    expect(me.title.id).toBe('admin');
    expect(me.capabilities).toEqual(expect.arrayContaining(['console.access', 'roles.manage', 'accounts.invites.manage', 'competitions.manage']));
    expect(me.capabilities.some((c: string) => c.startsWith('github.'))).toBe(false);
    expect(me.blocked).toEqual(expect.arrayContaining([{ capability: 'github.org.read', reason: 'github_session_required' }]));

    for (const url of [`/api/admin/${ORG}/overview`, '/api/console/people', '/api/me/orgs']) {
      const response = await user.send('GET', url);
      expect([url, response.statusCode, response.json().error]).toEqual([url, 403, 'github_session_required']);
    }
    expect((await user.send('POST', '/api/console/assignments', { github_login: 'someone', role: 'alumni' })).json().error).toBe('github_session_required');
    // 绑定了 GitHub 的账号用邮箱登录，在论坛里照常是成员
    expect((await user.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('member');
    expect(calls).toEqual([]);
  });

  it('lets an invite-registered member sign up for competitions but not into the console', async () => {
    const { app, mail, invite, calls } = await setup();
    invite('yugc-test-2026');
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'crew@example.test' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('crew@example.test'), invite_code: 'yugc-test-2026' });
    expect((await user.send('GET', '/api/me/competitions')).statusCode).toBe(200);
    const me = (await user.send('GET', '/api/console/me')).json();
    expect([me.title.id, me.capabilities]).toEqual(['guest', []]);
    // 论坛用户按 GitHub id 建：没有绑定 GitHub 的账号在论坛里是游客
    expect((await user.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('guest');
    expect(calls).toEqual([]);
  });

  it('records the GitHub org role on the account and takes membership away when GitHub says not a member', async () => {
    const roles: Record<string, 'admin' | 'member' | null> = { octocat: 'member' };
    const { app, db } = await setup({ roles });
    const sid = signIn(app, 'octocat', 42);
    expect((await app.inject({ url: '/auth/me', headers: { cookie: `sid=${sid}` } })).json().signed_in).toBe(true);
    expect(db.prepare('SELECT org_role, org_state FROM users').get()).toEqual({ org_role: 'member', org_state: 'active' });
    roles.octocat = null;
    app.services.cache.invalidate('console:orgrole:');
    const accountId = (db.prepare('SELECT id FROM users').get() as { id: string }).id;
    const access = await app.services.access.resolve({ login: 'octocat', userId: 42, accountId, accessToken: 'token-octocat', provider: 'github' });
    expect([access.member, access.githubRole]).toEqual([false, null]);
    expect(db.prepare('SELECT org_role, org_state FROM users').get()).toEqual({ org_role: null, org_state: 'not_member' });
    expect(app.services.identity.membershipOf(accountId)).toEqual({ member: false, orgRole: null });
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
    const { app, db, invite } = await setup({ env: GOOGLE_ENV, google });
    invite('yugc-test-2026');
    const first = await googleFlow(app, google);
    expect(first.location).toBe('https://example.test/signin?signin=invite_required&provider=google&return_to=%2Fforum%2F');
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 0 });

    const second = await googleFlow(app, google, '&invite=yugc-test-2026');
    expect(second.location).toBe('https://example.test/forum/');
    expect(google.tokenRequests.at(-1)).toContain('code_verifier=');
    const me = (await second.user.send('GET', '/auth/me')).json();
    expect(me).toMatchObject({ signed_in: true, provider: 'google' });
    expect(db.prepare("SELECT provider_uid, email FROM identities WHERE provider = 'google'").get()).toEqual({ provider_uid: 'google-sub-1', email: 'g.user@gmail.com' });

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

describe('hardening from the #262 review', () => {
  it('drops the recorded admin role when GitHub refuses the same person, so email sessions lose 提督', async () => {
    const { app, mail, tick } = await setup();
    app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' });
    const user = browser(app);
    await user.send('POST', '/auth/email/start', { email: 'owner@example.test' });
    await user.send('POST', '/auth/email/verify', { code: await mail.codeFor('owner@example.test') });
    expect((await user.send('GET', '/api/console/me')).json().title.id).toBe('admin');

    // 被移出组织后再试 GitHub 登录：被拒的同时，账号上记的角色清空、不再是成员
    app.services.identity.recordGithubDenied({ github: { id: 130495739, login: 'Crosery', avatarUrl: null }, reason: 'not_member' });
    const me = (await user.send('GET', '/api/console/me')).json();
    expect([me.title.id, me.capabilities]).toEqual(['guest', []]);
    expect((await user.send('GET', '/api/forum/state')).json().state.viewer.kind).toBe('guest');
    tick(61_000);
    const again = browser(app);
    await again.send('POST', '/auth/email/start', { email: 'owner@example.test' });
    const refused = await again.send('POST', '/auth/email/verify', { code: await mail.codeFor('owner@example.test', 2) });
    expect([refused.statusCode, refused.json().error]).toEqual([403, 'not_member']);
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
