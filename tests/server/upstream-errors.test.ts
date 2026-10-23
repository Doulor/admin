import { afterEach, expect, it } from 'vitest';
import type { ServiceOverrides } from '../../app/server/src/services';
import { signIn, testApp } from './helpers';
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

/**
 * Signed-in org admin whose stub GitHub client answers the role lookup and rejects every other call with `failure`.
 * #274 删掉了 /api/admin/:org/* 这组通用「GitHub 组织管理」路由；这里改用称号指派
 * （POST /api/console/assignments 的 github_login 查找，routes/console/assignments.ts）作为仍然会调用
 * GitHub、仍然经同一个全局错误处理器（middleware/http-policy.ts）映射上游错误的载体。
 */
async function adminFixture(failure: Record<string, unknown> = {}) {
  const octokitFactory = (() => ({ request: async (route: string) => {
    if (route === 'GET /orgs/{org}/memberships/{username}') return { data: { state: 'active', role: 'admin' } };
    throw Object.assign(new Error('stub upstream rejection'), failure);
  } })) as unknown as ServiceOverrides['octokitFactory'];
  // 控制台只管 CONSOLE_ORG（#262 第四期）：夹具把它设成 test-org
  const context = await testApp({ octokitFactory }, false, { CONSOLE_ORG: 'test-org' }); contexts.push(context);
  const sid = signIn(context.app, 'test-admin', 1, null, 'test-access');
  return { ...context, sid, headers: { cookie: `sid=${sid}` } };
}
const assignGhost = (headers: Record<string, string>) => ({ method: 'POST' as const, url: '/api/console/assignments', headers, payload: { github_login: 'ghost', role: 'member' as const } });

// 404 不在这张表里：assignments.ts 唯一还会调用的 lib/github.ts#getUser 把上游 404 当成「GitHub 上找不到这个用户名」
// 的业务语义，自己映射成 400 github_user_not_found（console.test.ts、signin-methods.test.ts 已覆盖），不再是
// 走到这里被当成未分类上游错误透传的 4xx。
it.each([403, 409, 422])('maps an upstream GitHub %s to the same 4xx instead of internal_error', async status => {
  const { app, headers } = await adminFixture({ status });
  const response = await app.inject(assignGhost(headers));
  expect(response.statusCode).toBe(status);
  const body = response.json();
  expect(body.error).toBe('upstream_rejected');
  expect(body.message).toMatch(/GitHub/);
  expect(body.message).not.toContain('stub upstream rejection');
  expect(body.request_id).toEqual(expect.any(String));
});
it('ends the session instead of passing on a GitHub 401: the token stored in it no longer works (#164)', async () => {
  const { app, sid, headers } = await adminFixture({ status: 401 });
  const response = await app.inject(assignGhost(headers));
  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ error: 'session_expired', message: '登录已失效，请重新登录', request_id: expect.any(String) });
  const cookies = ([] as string[]).concat((response.headers['set-cookie'] as string[] | string | undefined) ?? []);
  expect(cookies.some(cookie => cookie.startsWith('sid=;'))).toBe(true);
  expect(app.services.auth.getSession(sid)).toBeNull();
  // 同一个 sid 再来就是普通的会话失效，不再问 GitHub。
  expect((await app.inject(assignGhost(headers))).json()).toEqual({ error: 'session_expired' });
});
it.each([[{ status: 502 }, 502], [{ status: 0 }, 500], [{}, 500]] as const)('keeps upstream failure %j sanitized as %i', async (failure, expected) => {
  const { app, headers } = await adminFixture(failure);
  const response = await app.inject(assignGhost(headers));
  expect(response.statusCode).toBe(expected);
  expect(response.json()).toMatchObject({ error: 'internal_error', message: '服务暂时不可用，请稍后重试' });
});
it('keeps Fastify statusCode errors on their own machine code and message', async () => {
  const { app } = await adminFixture();
  const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: { 'content-type': 'application/json' }, payload: '{' });
  expect(response.statusCode).toBe(400);
  expect(response.json().error).not.toBe('upstream_rejected');
});
