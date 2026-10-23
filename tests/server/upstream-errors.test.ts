import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../../app/server/src/app';
import { requireAuth } from '../../app/server/src/middleware/require-auth';
import type { ServiceOverrides } from '../../app/server/src/services';
import { signIn, testConfig } from './helpers';

const contexts: Awaited<ReturnType<typeof upstreamFixture>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.app.close(); });

/**
 * #274 删掉了 /api/admin/:org/*（通用 GitHub 组织管理）和称号指派（POST /api/console/assignments，
 * routes/console/assignments.ts 整个文件删掉）：产品里现在没有「带着会话调一个会抛 status 的上游接口、
 * 自己不接错误」的业务路由了（唯一还会调 GitHub 的 /api/join/:token 不加载会话，也自己接住每一种上游失败，
 * 见 routes/portal/join.ts 和 middleware/http-policy.ts 里的说明）。但 middleware/http-policy.ts 的通用错误
 * 映射（上游 4xx 原样透传成 upstream_rejected、401 结束会话、5xx 统一打码成「服务暂时不可用」）仍是以后任何
 * 这类路由的基础设施，不该因为暂时没有业务路由在用就失去测试。这里直接挂一个只在测试里存在的路由，复用真实的
 * requireAuth 和 app.ts 的错误处理钩子，单独钉住这份契约，不依赖某个具体业务功能。
 */
async function upstreamFixture() {
  const config = testConfig({
    NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://example.test', DB_PATH: ':memory:',
    FORUM_DB_PATH: '/nonexistent/never-open-legacy-forum.db',
    SESSION_SECRET: 'isolated-upstream-test-secret-at-least-32',
    ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    OAUTH_CLIENT_ID: 'test-client', OAUTH_CLIENT_SECRET: 'test-only-placeholder', POW_DIFFICULTY: '0',
  });
  const deny = () => { throw new Error('Unexpected external network request in isolated upstream-errors test'); };
  const overrides: ServiceOverrides = { httpRequest: deny as unknown as ServiceOverrides['httpRequest'], octokitFactory: deny, mailFetch: deny as unknown as ServiceOverrides['mailFetch'] };
  const app = await buildApp({ config, staticRoot: false, overrides });
  await app.register(async instance => {
    instance.addHook('preHandler', requireAuth);
    // 模拟一个调用上游（如 GitHub）、自己不接错误的路由：payload.failure 原样抛出，和 Octokit 的 RequestError 一样只带 status。
    instance.post<{ Body: { failure?: Record<string, unknown> } }>('/__test/upstream', async req => {
      throw Object.assign(new Error('stub upstream rejection'), req.body?.failure ?? {});
    });
  });
  await app.ready();
  const sid = signIn(app, 'test-admin', 1);
  contexts.push({ app, sid });
  return { app, sid, headers: { cookie: `sid=${sid}` } };
}
const hitUpstream = (headers: Record<string, string>, failure: Record<string, unknown> = {}) => ({
  method: 'POST' as const, url: '/__test/upstream', headers, payload: { failure },
});

// 404 不在这张表里：assignments.ts 原来把上游 404 当「GitHub 上找不到这个用户名」的业务语义自己接住，映射成
// 400 github_user_not_found（那段业务逻辑随整个文件一起删了，不再是本文件要测的通用透传契约）。
it.each([403, 409, 422])('maps an upstream GitHub %s to the same 4xx instead of internal_error', async status => {
  const { app, headers } = await upstreamFixture();
  const response = await app.inject(hitUpstream(headers, { status }));
  expect(response.statusCode).toBe(status);
  const body = response.json();
  expect(body.error).toBe('upstream_rejected');
  expect(body.message).toMatch(/GitHub/);
  expect(body.message).not.toContain('stub upstream rejection');
  expect(body.request_id).toEqual(expect.any(String));
});
it('ends the session instead of passing on a GitHub 401: the token stored in it no longer works (#164)', async () => {
  const { app, sid, headers } = await upstreamFixture();
  const response = await app.inject(hitUpstream(headers, { status: 401 }));
  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ error: 'session_expired', message: '登录已失效，请重新登录', request_id: expect.any(String) });
  const cookies = ([] as string[]).concat((response.headers['set-cookie'] as string[] | string | undefined) ?? []);
  expect(cookies.some(cookie => cookie.startsWith('sid=;'))).toBe(true);
  expect(app.services.auth.getSession(sid)).toBeNull();
  // 同一个 sid 再来就是普通的会话失效，不再问 GitHub。
  expect((await app.inject(hitUpstream(headers, { status: 401 }))).json()).toEqual({ error: 'session_expired' });
});
it.each([[{ status: 502 }, 502], [{ status: 0 }, 500], [{}, 500]] as const)('keeps upstream failure %j sanitized as %i', async (failure, expected) => {
  const { app, headers } = await upstreamFixture();
  const response = await app.inject(hitUpstream(headers, failure));
  expect(response.statusCode).toBe(expected);
  expect(response.json()).toMatchObject({ error: 'internal_error', message: '服务暂时不可用，请稍后重试' });
});
it('keeps Fastify statusCode errors on their own machine code and message', async () => {
  const { app } = await upstreamFixture();
  const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: { 'content-type': 'application/json' }, payload: '{' });
  expect(response.statusCode).toBe(400);
  expect(response.json().error).not.toBe('upstream_rejected');
});
