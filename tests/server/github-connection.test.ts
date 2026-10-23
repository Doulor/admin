import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ServiceOverrides } from '../../app/server/src/services';
import { createConfig } from '../../app/server/src/config';
import { appJwt, createGithubConnection, GithubConnectionFailed, GithubNotConnected } from '../../app/server/src/lib/github-connection';
import { testApp } from './helpers';

type Octokit = ReturnType<NonNullable<ServiceOverrides['octokitFactory']>>;

/**
 * 服务器接入的 GitHub（#262 第四期，lib/github-connection.ts）：GitHub App 的 JWT、安装令牌的换取与缓存、
 * App 令牌被拒时回 503 而不结束会话；没配 App 时退回本人的 GitHub 会话，都没有时 409。GitHub 一律是假的。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

const ORG = 'Yangtze-University-Geek-Class';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const APP_ENV = { GH_APP_ID: '123456', GH_APP_PRIVATE_KEY: PEM };

function env() {
  return {
    NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://example.test', DB_PATH: ':memory:', FORUM_DB_PATH: ':memory:',
    SESSION_SECRET: 'configuration-test-secret-at-least-32', ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
    OAUTH_CLIENT_ID: 'test-client', OAUTH_CLIENT_SECRET: 'test-secret',
  };
}

/** 假的 GitHub App 端点：查安装、换安装令牌；记下每次请求和带的 JWT。 */
function appEndpoints(options: { clock: () => number; fail?: number; ttlMs?: number; installation?: { id: number } } = { clock: Date.now }) {
  const installation = options.installation ?? { id: 9001 };
  const requests: { method: string; path: string; jwt: string }[] = [];
  let issued = 0;
  const fetch = (async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const jwt = String((init.headers as Record<string, string>).authorization).replace(/^Bearer /, '');
    requests.push({ method: init.method ?? 'GET', path, jwt });
    if (options.fail) return new Response('{}', { status: options.fail });
    if (path === `/orgs/${ORG}/installation`) return Response.json({ id: installation.id });
    if (path === `/app/installations/${installation.id}/access_tokens`) {
      issued++;
      return Response.json({ token: `ghs_installation_${issued}`, expires_at: new Date(options.clock() + (options.ttlMs ?? 60 * 60_000)).toISOString() }, { status: 201 });
    }
    return new Response('{}', { status: 404 });
  }) as (input: string, init?: RequestInit) => Promise<Response>;
  return { fetch, requests };
}

describe('GH_APP_ID and GH_APP_PRIVATE_KEY', () => {
  it('stay optional, come as a pair, and accept PEM, PEM with \\n escapes or base64 PEM', () => {
    const none = createConfig(env());
    expect(none.githubApp).toBeNull();
    expect(none.oauth.scope).toBe('read:user user:email admin:org read:org repo');
    expect(() => createConfig({ ...env(), GH_APP_ID: '123456' })).toThrow('must be set together');
    expect(() => createConfig({ ...env(), GH_APP_PRIVATE_KEY: PEM })).toThrow('must be set together');
    for (const key of [PEM, PEM.replace(/\n/g, '\\n'), Buffer.from(PEM).toString('base64')]) {
      const config = createConfig({ ...env(), GH_APP_ID: '123456', GH_APP_PRIVATE_KEY: key });
      expect(config.githubApp?.appId).toBe('123456');
      expect(config.githubApp?.privateKey.asymmetricKeyType).toBe('rsa');
      // 配了 App，GitHub 登录只用来认人，不再要组织和仓库的写权限
      expect(config.oauth.scope).toBe('read:user user:email read:org');
    }
  });

  it('refuse a non-numeric App ID, an unreadable key and a non-RSA key without echoing the value', () => {
    expect(() => createConfig({ ...env(), ...APP_ENV, GH_APP_ID: 'geek-app' })).toThrow('numeric App ID');
    // 保留生成密钥的首尾两行、把正文换掉；不在仓库里写私钥头（scripts/check-secrets.mjs 拒绝它）
    const lines = PEM.trim().split('\n');
    const unreadable = [lines[0], 'not-a-key', lines.at(-1)].join('\\n');
    expect(() => createConfig({ ...env(), ...APP_ENV, GH_APP_PRIVATE_KEY: unreadable })).toThrow(/^GH_APP_PRIVATE_KEY is not a readable private key$/);
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    let message = '';
    try { createConfig({ ...env(), ...APP_ENV, GH_APP_PRIVATE_KEY: ec }); } catch (cause) { message = (cause as Error).message; }
    expect(message).toBe('GH_APP_PRIVATE_KEY must be the RSA key GitHub generated for the App');
    expect(message).not.toContain('BEGIN');
  });
});

describe('createGithubConnection', () => {
  const app = { appId: '123456', privateKey: createConfig({ ...env(), ...APP_ENV }).githubApp!.privateKey };
  const octokitWith = (token: string) => ({ token }) as unknown as Octokit;

  it('signs an RS256 JWT for the App that GitHub accepts: issued 60 s early, valid for 9 minutes', () => {
    const now = Date.UTC(2026, 9, 23, 0, 0, 0);
    const [head, payload, signature] = appJwt(app, now).split('.');
    expect(JSON.parse(Buffer.from(head, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({ iat: now / 1000 - 60, exp: now / 1000 + 540, iss: '123456' });
    expect(createVerify('RSA-SHA256').update(`${head}.${payload}`).verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
  });

  it('mints one installation token, shares it with concurrent callers, caches it and renews it 5 minutes before expiry', async () => {
    let now = Date.UTC(2026, 9, 23, 0, 0, 0);
    const clock = () => now;
    const endpoints = appEndpoints({ clock });
    const connection = createGithubConnection({ app, org: ORG, octokitWith, fetch: endpoints.fetch, clock });
    expect(await Promise.all([connection.appToken(), connection.appToken(), connection.appToken()])).toEqual(['ghs_installation_1', 'ghs_installation_1', 'ghs_installation_1']);
    expect(endpoints.requests.map(r => `${r.method} ${r.path}`)).toEqual([`GET /orgs/${ORG}/installation`, 'POST /app/installations/9001/access_tokens']);
    now += 54 * 60_000;
    expect(await connection.appToken()).toBe('ghs_installation_1');
    now += 2 * 60_000;
    expect(await connection.appToken()).toBe('ghs_installation_2');
    // 安装 id 记下了，不再查
    expect(endpoints.requests.map(r => `${r.method} ${r.path}`).slice(2)).toEqual(['POST /app/installations/9001/access_tokens']);
  });

  it('turns an App failure into 503 github_connection_failed and a 401 on the App token into the same, dropping the cached token', async () => {
    const clock = () => Date.UTC(2026, 9, 23);
    const broken = createGithubConnection({ app, org: ORG, octokitWith, fetch: appEndpoints({ clock, fail: 404 }).fetch, clock });
    const failure = await broken.appToken().catch(cause => cause);
    expect(failure).toBeInstanceOf(GithubConnectionFailed);
    expect(failure).toMatchObject({ statusCode: 503, code: 'github_connection_failed', upstreamStatus: 404 });

    const endpoints = appEndpoints({ clock });
    let reject = true;
    const octokit = (token: string) => ({
      request: async () => { if (reject) throw Object.assign(new Error('Bad credentials'), { status: 401 }); return { data: { token } }; },
      paginate: async () => [],
    }) as unknown as Octokit;
    const connection = createGithubConnection({ app, org: ORG, octokitWith: octokit, fetch: endpoints.fetch, clock });
    const client = await connection.clientFor(null);
    expect(client.via).toBe('app');
    const rejected = await client.request('GET /orgs/{org}', { org: ORG }).catch(cause => cause);
    expect(rejected).toBeInstanceOf(GithubConnectionFailed);
    expect(rejected).toMatchObject({ statusCode: 503, upstreamStatus: 401 });
    reject = false;
    expect((await (await connection.clientFor(null)).request('GET /orgs/{org}', { org: ORG })).data).toEqual({ token: 'ghs_installation_2' });
  });

  it('looks the installation up again after the App is reinstalled, and a late 401 only drops the token it was sent with', async () => {
    let now = Date.UTC(2026, 9, 23);
    const clock = () => now;
    const installation = { id: 9001 };
    const endpoints = appEndpoints({ clock, installation });
    const connection = createGithubConnection({ app, org: ORG, octokitWith, fetch: endpoints.fetch, clock });
    expect(await connection.appToken()).toBe('ghs_installation_1');
    // App 重装后安装 id 变了：换令牌失败一次，下一次重新查安装 id，不用重启
    installation.id = 9002;
    now += 56 * 60_000;
    await expect(connection.appToken()).rejects.toMatchObject({ upstreamStatus: 404 });
    expect(await connection.appToken()).toBe('ghs_installation_2');
    expect(endpoints.requests.map(r => `${r.method} ${r.path}`)).toEqual([
      `GET /orgs/${ORG}/installation`, 'POST /app/installations/9001/access_tokens', 'POST /app/installations/9001/access_tokens',
      `GET /orgs/${ORG}/installation`, 'POST /app/installations/9002/access_tokens',
    ]);

    // 旧令牌慢回来的 401 不能把别的请求刚换好的新令牌也丢掉
    const refusing = (token: string) => ({
      request: async () => { if (token === 'ghs_installation_3') throw Object.assign(new Error('Bad credentials'), { status: 401 }); return { data: { token } }; },
      paginate: async () => [],
    }) as unknown as Octokit;
    const fresh = appEndpoints({ clock });
    const shared = createGithubConnection({ app, org: ORG, octokitWith: refusing, fetch: fresh.fetch, clock });
    expect(await shared.appToken()).toBe('ghs_installation_1');
    const stale = await shared.clientFor(null);
    expect((await stale.request('GET /orgs/{org}', { org: ORG })).data).toEqual({ token: 'ghs_installation_1' });
    now += 56 * 60_000;
    const late = await shared.clientFor(null);
    expect((await late.request('GET /orgs/{org}', { org: ORG })).data).toEqual({ token: 'ghs_installation_2' });
    now += 56 * 60_000;
    const refused = await shared.clientFor(null);
    await expect(refused.request('GET /orgs/{org}', { org: ORG })).rejects.toMatchObject({ upstreamStatus: 401 });
    const renewed = await shared.clientFor(null);
    expect((await renewed.request('GET /orgs/{org}', { org: ORG })).data).toEqual({ token: 'ghs_installation_4' });
    await expect(refused.request('GET /orgs/{org}', { org: ORG })).rejects.toMatchObject({ upstreamStatus: 401 });
    expect((await (await shared.clientFor(null)).request('GET /orgs/{org}', { org: ORG })).data).toEqual({ token: 'ghs_installation_4' });
  });

  it('falls back to the caller\'s own GitHub session without an App and answers 409 for anything else', async () => {
    const connection = createGithubConnection({ app: null, org: ORG, octokitWith, fetch: (() => { throw new Error('no App calls'); }) as never });
    expect(connection.via({ provider: 'github', accessToken: 'gho_user' })).toBe('session');
    expect(connection.via({ provider: 'email', accessToken: '' })).toBe('none');
    expect(connection.via(null)).toBe('none');
    expect(await connection.clientFor({ provider: 'github', accessToken: 'gho_user' })).toMatchObject({ via: 'session', token: 'gho_user' });
    const missing = await connection.clientFor({ provider: 'google', accessToken: '' }).catch(cause => cause);
    expect(missing).toBeInstanceOf(GithubNotConnected);
    expect(missing).toMatchObject({ statusCode: 409, code: 'github_not_connected' });
    await expect(connection.appToken()).rejects.toBeInstanceOf(GithubNotConnected);
  });
});

describe('console GitHub pages through the GitHub App', () => {
  async function setup(options: { appFail?: number; orgStatus?: number; inviteStatus?: number } = {}) {
    const tokens: string[] = [];
    const clock = () => Date.now();
    const octokitFactory = ((token: string) => ({
      request: async (route: string) => {
        tokens.push(token);
        if (options.orgStatus) throw Object.assign(new Error('stub rejection'), { status: options.orgStatus });
        if (route === 'GET /orgs/{org}') return { data: { login: ORG, name: '极客班', public_repos: 3, created_at: '2024-09-01T00:00:00Z' } };
        if (route === 'GET /users/{username}') return { data: { login: 'alpha', id: 7 } };
        if (route === 'POST /orgs/{org}/invitations') {
          if (options.inviteStatus) throw Object.assign(new Error('stub rejection'), { status: options.inviteStatus });
          return { data: { id: 99 } };
        }
        throw new Error(`Unexpected GitHub call ${route}`);
      },
      paginate: async () => { tokens.push(token); return []; },
    })) as unknown as ServiceOverrides['octokitFactory'];
    const context = await testApp({ octokitFactory, githubAppFetch: appEndpoints({ clock, fail: options.appFail }).fetch }, false, APP_ENV);
    contexts.push(context);
    const { app } = context;
    // 所有者的账号由运维命令预置（cli/account.ts provision）；这里不走邮件，直接签一个邮箱会话
    const owner = app.services.identity.provisionAccount({ githubId: 130495739, githubLogin: 'Crosery', orgRole: 'admin', email: 'owner@example.test' });
    const sid = app.services.auth.createSession({ accountId: owner.accountId, provider: 'email', login: 'Crosery', userId: 130495739, avatarUrl: null, accessToken: '' });
    return { app, tokens, headers: { cookie: `sid=${sid}` }, sid };
  }

  it('serves an email-signed-in 提督 the GitHub org through the App installation token', async () => {
    const { app, tokens, headers } = await setup();
    expect((await app.inject({ url: '/api/console/me', headers })).json()).toMatchObject({ provider: 'email', site_role: 'admin', github: 'app' });
    const overview = await app.inject({ url: `/api/admin/${ORG}/overview`, headers });
    expect(overview.statusCode).toBe(200);
    expect(overview.json()).toMatchObject({ via: 'app', org: { login: ORG, name: '极客班' } });
    expect(new Set(tokens)).toEqual(new Set(['ghs_installation_1']));
    // 控制台只管 CONSOLE_ORG：别的组织在调 GitHub 之前就拒绝
    const other = await app.inject({ url: '/api/admin/other-org/overview', headers });
    expect([other.statusCode, other.json().error]).toEqual([403, 'org_not_managed']);
  });

  it('records a join request as failed, not as waiting for review, when GitHub refuses the App token at the invitation', async () => {
    const { app } = await setup({ inviteStatus: 401 });
    const db = app.services.storage.db;
    db.prepare('INSERT INTO invite_links(token,org,created_by,created_by_token_encrypted,max_uses,current_uses,expires_at,disabled,created_at) VALUES(?,?,?,?,5,0,?,0,?)')
      .run('app-link', ORG, 'Crosery', app.services.crypto.encrypt(''), Date.now() + 60_000, Date.now());
    const response = await app.inject({ method: 'POST', url: '/api/join/app-link', payload: { github_login: 'alpha', pow: { timestamp: Date.now(), nonce: 'test' } } });
    expect(response.statusCode).toBe(400);
    expect(db.prepare('SELECT status FROM invitations').all()).toEqual([{ status: 'failed' }]);
    expect(db.prepare('SELECT current_uses FROM invite_links').get()).toEqual({ current_uses: 0 });
  });

  it('says plainly that the GitHub App is not working and keeps the session when the App or its token is refused', async () => {
    for (const options of [{ appFail: 401 }, { orgStatus: 401 }]) {
      const { app, headers, sid } = await setup(options);
      const response = await app.inject({ url: `/api/admin/${ORG}/overview`, headers });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ error: 'github_connection_failed', message: 'GitHub App 暂时用不了，请联系管理员检查 App 的配置' });
      expect(app.services.auth.getSession(sid)).not.toBeNull();
    }
  });
});
