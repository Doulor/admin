import { afterEach, expect, it } from 'vitest';
import { createRehearsal } from '../../scripts/contest-rehearsal-fixture.mjs';

const fixtures: Awaited<ReturnType<typeof createRehearsal>>[] = [];
afterEach(async () => { for (const fixture of fixtures.splice(0)) await fixture.close(); });

it('L01 合成 OAuth 登录至报名/贡献/审核/定榜/核销，重启保留冻结结果', async () => {
  const fixture = await createRehearsal({ staticRoot: false });
  fixtures.push(fixture);
  expect(await fixture.complete()).toEqual({
    participants: 2, candidates: 2, scores: [350, 18], prizes: 2, redeemed: 1,
  });
  await fixture.restart();
  const headers = await fixture.login('alice');
  const mine = await fixture.app.inject({ url: '/api/me/competition-results', headers });
  expect(mine.statusCode).toBe(200);
  expect(mine.json().items[0]).toMatchObject({ points: 350, rank: 1, prize: { amount_cny: 1, redeemed_at: expect.any(Number) } });
  expect((await fixture.app.inject({ url: `/api/competitions/${fixture.competitionId}/my-status`, headers })).json())
    .toMatchObject({ writable: false, actions: [] });
  const status = await fixture.app.inject('/__rehearsal/status');
  expect(status.statusCode).toBe(200);
  expect(status.body).not.toContain('sid=');
  expect(status.body).not.toContain(mine.json().items[0].prize.code);
});

it('L02 浏览器角色入口只转交真实 OAuth 签发 cookie；个人赛拒绝团队接口', async () => {
  const fixture = await createRehearsal({ staticRoot: false });
  fixtures.push(fixture);
  const logged = await fixture.app.inject('/__rehearsal/login/alice');
  expect(logged.statusCode).toBe(302);
  const cookie = ([] as string[]).concat(logged.headers['set-cookie'] ?? []).find(value => value.startsWith('sid='))!.split(';')[0];
  const headers = { cookie };
  expect((await fixture.app.inject({ url: '/auth/me', headers })).json()).toMatchObject({ signed_in: true, login: 'rehearsal_alice' });
  expect((await fixture.app.inject({ method: 'POST', url: `/api/competitions/${fixture.competitionId}/signup`, headers, payload: {} })).statusCode).toBe(200);
  expect((await fixture.app.inject({ method: 'POST', url: `/api/competitions/${fixture.competitionId}/teams`, headers, payload: { name: '拒绝组队' } })).json().error)
    .toBe('individual_competition');
  expect((await fixture.app.inject('/__rehearsal/login/stranger')).statusCode).toBe(404);
});
