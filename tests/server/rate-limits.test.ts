import { afterEach, expect, it } from 'vitest';
import type { ServiceOverrides } from '../../app/server/src/services';
import { accountIdOf, grantPermGroup, signIn, testApp } from './helpers';

const CONSOLE_ORG = 'Yangtze-University-Geek-Class';
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

/** 路由级限流（@fastify/rate-limit）超额时的错误体，和论坛自己数次数的 429 是同一个（#191）。 */
const LIMITED = { error: 'rate_limited', message: '操作太频繁，请稍后再试', request_id: expect.stringMatching(/\S/) };

/** 模拟 GitHub：alice 是 CONSOLE_ORG 的 owner（控制台的全部能力），别的调用一律当测试漏洞。 */
const github = (() => ({
  request: async (route: string, params: Record<string, string>) => {
    if (route === 'GET /orgs/{org}/memberships/{username}' && params.org === CONSOLE_ORG && params.username === 'alice') return { data: { state: 'active', role: 'admin' } };
    throw new Error(`Unexpected GitHub call ${route}`);
  },
})) as unknown as ServiceOverrides['octokitFactory'];

// 限流在 onRequest 里先于鉴权、校验和处理器计数，额度内的请求回什么都占一次。
it.each([
  // #274 review round 1（SPEC §3.8）：/auth/github 原来没有限流，补成和 /auth/google 一样的按 IP 每分钟 20 次。
  { name: 'GET /auth/github', method: 'GET', url: '/auth/github', max: 20, within: 302, signedIn: false },
  { name: 'GET /api/console/applications/export.csv', method: 'GET', url: '/api/console/applications/export.csv', max: 5, within: 200, signedIn: true },
  // #274 删掉了 /api/console/assignments；邀请码写接口（invite.manage + step-up）沿用同样的 30/分钟限额。
  { name: 'POST /api/console/invites', method: 'POST', url: '/api/console/invites', payload: {}, max: 30, within: 400, signedIn: false },
  // #274 SPEC §3.2：投递要先登录（level.registered 就有 apply.submit），不再接受匿名投递。
  { name: 'POST /api/portal/apply', method: 'POST', url: '/api/portal/apply', payload: {}, max: 5, within: 400, signedIn: true },
  { name: 'POST /api/feedback', method: 'POST', url: '/api/feedback', payload: {}, max: 10, within: 400, signedIn: false },
] as const)('answers $name over its $max-a-minute limit with 429 rate_limited, a Chinese message and the request_id', async ({ method, url, max, within, signedIn, ...rest }) => {
  const context = await testApp({ octokitFactory: github });
  contexts.push(context);
  const { app } = context;
  const headers = signedIn ? { cookie: `sid=${signIn(app, 'alice', 101, null, 'token-alice')}` } : {};
  if (signedIn) grantPermGroup(app, accountIdOf(app, 'alice'), 'title.site.owner'); // #274：apply.export 等按新权限体系判定
  const send = () => app.inject({ method, url, headers, remoteAddress: '198.51.100.20', ...('payload' in rest ? { payload: rest.payload } : {}) });
  const statuses: number[] = [];
  for (let i = 0; i < max; i += 1) statuses.push((await send()).statusCode);
  expect(statuses).toEqual(Array(max).fill(within));
  const limited = await send();
  expect(limited.statusCode).toBe(429);
  expect(limited.json()).toEqual(LIMITED);
  expect(limited.headers['cache-control']).toBe('no-store');
  // 另一个 IP 的额度是自己的
  expect((await app.inject({ method, url, headers, remoteAddress: '198.51.100.21', ...('payload' in rest ? { payload: rest.payload } : {}) })).statusCode).toBe(within);
});

it('同一个访客反复撞同一个限额，429 只在操作记录里留一行，meta.count 往上加（#274 残留修复 F）', async () => {
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  context.app.services.storage.db.prepare("DELETE FROM activity_events").run(); // 迁移自带的 identity.backfill 记录不参与这里的断言
  // #274 删掉了 /api/join/:token（GitHub 组织邀请链接随组织那道门一起去掉），改用另一个匿名、路由级
  // max=5/分钟限流的接口来撞同一个限额：/api/portal/apply 的限流在 onRequest 里跑，先于 requirePermission
  // 的 401（见 apply.ts 的注释），没登录时前 5 次回 401，不影响这里只看限流次数的断言。要带着同一个
  // yugc_vid 访客 cookie 复用同一个访客编号，否则每次没带 cookie 都会现发一个新的，三次限流会落进三个
  // 不同的访客编号，撞不上「同一主体」的合并条件。
  let cookie: string | undefined;
  const send = async () => {
    const res = await app.inject({ method: 'POST', url: '/api/portal/apply', payload: {}, remoteAddress: '198.51.100.40', headers: cookie ? { cookie } : {} });
    const setCookie = ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []).find(c => c.startsWith('yugc_vid='));
    if (setCookie && !cookie) cookie = setCookie.split(';')[0];
    return res;
  };
  for (let i = 0; i < 5; i += 1) await send(); // 用满额度（max=5），都不是限流响应
  for (let i = 0; i < 3; i += 1) expect((await send()).statusCode).toBe(429); // 再撞 3 次
  const rows = app.services.storage.db.prepare("SELECT outcome, action, meta FROM activity_events WHERE outcome = 'limited'").all() as
    { outcome: string; action: string; meta: string }[];
  expect(rows).toHaveLength(1); // 3 次限流只留一行，没有一条一条插
  expect(rows[0].action).toBe('http.rate_limited');
  expect(JSON.parse(rows[0].meta)).toEqual({ count: 3 });
});
