import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DEVICE_GRANT_TYPE } from '../../app/server/src/lib/device-store';
import { accountIdOf, signIn, testApp } from './helpers';

/**
 * 我的投递状态（#277，geek apply status）：`applications` 表没有 account_id，`GET /api/me/applications`
 * 按账号已绑定的登录邮箱（小写）配 `applications.email`，只给本人、看不到别人的，没绑邮箱是空列表，
 * 只回 id/status/created_at——不回姓名、班级、邮箱、特长（#277 的硬约束：命令行拿不到这些）。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const context of contexts.splice(0)) await context.close(); });

async function setup() {
  const context = await testApp();
  contexts.push(context);
  return context;
}

function insertApplication(db: import('better-sqlite3').Database, patch: Record<string, unknown> = {}) {
  const row = {
    id: randomUUID(), name: '测试候选人', class_name: '计科2301', email: 'candidate@example.test',
    strengths: '熟悉 TypeScript，维护过一个开源小工具。', source_ip: '203.0.113.7', user_agent: 'fixture-agent/1.0',
    status: 'received', created_at: Date.now(), ...patch,
  };
  db.prepare('INSERT INTO applications(id, name, class_name, email, strengths, source_ip, user_agent, status, created_at) VALUES(@id, @name, @class_name, @email, @strengths, @source_ip, @user_agent, @status, @created_at)').run(row);
  return row;
}

// 设备码登录（和 tests/server/bearer-auth.test.ts 同一套手法）：只为了核对令牌缺 apply scope 时的拒绝。
const form = (payload: Record<string, string>) => new URLSearchParams(payload).toString();
function issueCode(app: FastifyInstance, scope: string) {
  return app.inject({
    method: 'POST', url: '/auth/device/code',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: form({ client_id: 'geek-cli', scope }),
  }).then(response => response.json());
}
function pollToken(app: FastifyInstance, deviceCode: string) {
  return app.inject({
    method: 'POST', url: '/auth/device/token',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: form({ grant_type: DEVICE_GRANT_TYPE, device_code: deviceCode, client_id: 'geek-cli' }),
  }).then(response => response.json());
}
function decide(app: FastifyInstance, sid: string, userCode: string) {
  return app.inject({
    method: 'POST', url: '/api/identity/device/approve',
    headers: { cookie: `sid=${sid}`, 'content-type': 'application/json' },
    payload: { user_code: userCode, decision: 'approve' },
  });
}
async function deviceLogin(app: FastifyInstance, sid: string, scope: string): Promise<string> {
  const code = await issueCode(app, scope);
  const approved = await decide(app, sid, code.user_code);
  if (approved.statusCode !== 200) throw new Error(`approve failed: ${JSON.stringify(approved.json())}`);
  const token = await pollToken(app, code.device_code);
  return token.access_token as string;
}
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('GET /api/me/applications（#277，geek apply status）', () => {
  it('没绑邮箱是空列表；绑了邮箱之后只看得到自己的投递，看不到别人的，也不回姓名/班级/邮箱/特长', async () => {
    const { app } = await setup();
    const db = app.services.storage.db;
    const sid = signIn(app, 'octocat', 4242);
    const accountId = accountIdOf(app, 'octocat');

    const empty = await app.inject({ url: '/api/me/applications', headers: { cookie: `sid=${sid}` } });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ applications: [] });

    app.services.identity.linkEmail({ accountId, email: 'octo@example.test', login: 'octocat', claim: () => true });
    const mine = insertApplication(db, { email: 'octo@example.test', status: 'interview' });
    insertApplication(db, { email: 'someone-else@example.test' }); // 别人的投递，不该出现

    const response = await app.inject({ url: '/api/me/applications', headers: { cookie: `sid=${sid}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ applications: [{ id: mine.id, status: 'interview', created_at: mine.created_at }] });

    const body = JSON.stringify(response.json());
    for (const secret of ['测试候选人', '计科2301', 'octo@example.test', '熟悉 TypeScript']) {
      expect(body).not.toContain(secret);
    }
  });

  it('大小写不同的邮箱照样能匹配到（投递表原样保存大小写，登录邮箱绑定时已经存成小写）', async () => {
    const { app } = await setup();
    const db = app.services.storage.db;
    const sid = signIn(app, 'octocat', 4242);
    const accountId = accountIdOf(app, 'octocat');
    app.services.identity.linkEmail({ accountId, email: 'mixed@example.test', login: 'octocat', claim: () => true });
    const mine = insertApplication(db, { email: 'Mixed@Example.test' });

    const response = await app.inject({ url: '/api/me/applications', headers: { cookie: `sid=${sid}` } });
    expect(response.json()).toEqual({ applications: [{ id: mine.id, status: mine.status, created_at: mine.created_at }] });
  });

  it('没登录是 401', async () => {
    const { app } = await setup();
    const response = await app.inject({ url: '/api/me/applications' });
    expect(response.statusCode).toBe(401);
  });

  it('geek 命令行令牌没有 apply scope 时是 insufficient_scope，不会直接放行', async () => {
    const { app } = await setup();
    const sid = signIn(app, 'octocat', 4242);
    const accountId = accountIdOf(app, 'octocat');
    app.services.identity.linkEmail({ accountId, email: 'octo@example.test', login: 'octocat', claim: () => true });
    app.services.storage.db.prepare(
      "INSERT INTO applications(id, name, class_name, email, strengths, source_ip, user_agent, status, created_at) VALUES(?, '测试候选人', '计科2301', 'octo@example.test', '熟悉 TypeScript。', '203.0.113.7', 'fixture-agent/1.0', 'received', ?)",
    ).run(randomUUID(), Date.now());
    const token = await deviceLogin(app, sid, 'openid profile'); // 没有 apply scope
    const response = await app.inject({ url: '/api/me/applications', headers: bearer(token) });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'insufficient_scope', scope: 'apply' });
  });

  it('geek 命令行令牌带 apply scope 时能看到自己的投递，和 cookie 会话的结果一样', async () => {
    const { app } = await setup();
    const db = app.services.storage.db;
    const sid = signIn(app, 'octocat', 4242);
    const accountId = accountIdOf(app, 'octocat');
    app.services.identity.linkEmail({ accountId, email: 'octo@example.test', login: 'octocat', claim: () => true });
    const mine = insertApplication(db, { email: 'octo@example.test' });
    const token = await deviceLogin(app, sid, 'openid profile forum apply competition repo');
    const response = await app.inject({ url: '/api/me/applications', headers: bearer(token) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ applications: [{ id: mine.id, status: mine.status, created_at: mine.created_at }] });
  });
});
