import { afterEach, describe, expect, it } from 'vitest';
import { testApp } from './helpers';

/** 访客 cookie `yugc_vid`（#274 SPEC §3.x）：门户、论坛接口第一次收到请求就发，HttpOnly、SameSite=Lax、1 年。 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

const setCookies = (response: { headers: Record<string, unknown> }) =>
  ([] as string[]).concat((response.headers['set-cookie'] as string[] | string | undefined) ?? []);
const vidCookie = (response: { headers: Record<string, unknown> }) => setCookies(response).find(c => c.startsWith('yugc_vid='));

describe('访客 cookie yugc_vid', () => {
  it('第一次打门户接口就发：HttpOnly、SameSite=Lax、一年，PUBLIC_ORIGIN 是 https 时带 Secure', async () => {
    const context = await testApp();
    contexts.push(context);
    const res = await context.app.inject('/api/public/departments');
    const cookie = vidCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^yugc_vid=[0-9a-f-]{36}; Max-Age=31536000; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
  });

  it('PUBLIC_ORIGIN 是 http 时不带 Secure（和 oauth_state 等其它 cookie 同一个开关，config.cookieSecure）', async () => {
    const context = await testApp({}, false, { PUBLIC_ORIGIN: 'http://example.test' });
    contexts.push(context);
    const res = await context.app.inject('/api/public/departments');
    expect(vidCookie(res)).not.toContain('Secure');
  });

  it('论坛接口同样会发', async () => {
    const context = await testApp();
    contexts.push(context);
    const res = await context.app.inject('/api/forum/state');
    expect(vidCookie(res)).toBeDefined();
  });

  it('已经带着合法的 cookie 就不重发', async () => {
    const context = await testApp();
    contexts.push(context);
    const first = vidCookie(await context.app.inject('/api/public/departments'))!.split(';')[0];
    const again = await context.app.inject({ url: '/api/public/departments', headers: { cookie: first } });
    expect(vidCookie(again)).toBeUndefined();
  });

  it('带来的格式不对（不是 UUID）就当没有，重发一个新的', async () => {
    const context = await testApp();
    contexts.push(context);
    const res = await context.app.inject({ url: '/api/public/departments', headers: { cookie: 'yugc_vid=not-a-real-uuid' } });
    const cookie = vidCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).not.toContain('not-a-real-uuid');
  });

  it('不是门户或论坛接口（管理端 /auth/me）不发这个 cookie', async () => {
    const context = await testApp();
    contexts.push(context);
    const res = await context.app.inject('/auth/me');
    expect(vidCookie(res)).toBeUndefined();
  });
});
