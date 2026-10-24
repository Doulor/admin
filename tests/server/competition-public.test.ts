// 比赛公开接口（#278，CONTRACT-278 §2）与年级系数（所有者 2026-10-24 13:45）：
// 只给公开字段、跨域放开但不带凭据、按 IP 限流、写入后缓存马上清；记分那一刻按年级乘系数，之后不回头重算。
import { afterEach, describe, expect, it } from 'vitest';
import { academicYear } from '../../app/server/src/lib/grade';
import { PUBLIC_COMPETITION_LIMIT } from '../../app/server/src/routes/portal/competitions';
import { activityRows } from './helpers';
import { contestSetup, type ContestContext } from './contest-fixtures';

const contexts: ContestContext[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});
async function setup() {
  const context = await contestSetup();
  contexts.push(context);
  return context;
}

describe('公开接口只给公开字段', () => {
  it('天梯、动态、统计与快照：有昵称、@用户名、头像、队名、分数，没有账号 id、真实姓名、邮箱和扣分原因', async () => {
    const { app, as, accountId, createCompetition, signUp, addScore } = await setup();
    const id = await createCompetition();
    for (const login of ['alice', 'bob', 'carol']) await signUp(id, login);
    await app.inject({ method: 'POST', url: `/api/competitions/${id}/teams`, headers: as('alice'), payload: { name: '夜猫子' } });
    const db = app.services.storage.db;
    app.services.profiles.get(accountId('alice'));
    db.prepare("UPDATE account_profiles SET display_name = '爱丽丝', real_name = '张三丰' WHERE account_id = ?").run(accountId('alice'));
    expect((await addScore(id, { account_id: accountId('alice'), kind: 'pr', repo: 'geek/admin', number: 3, points: 30, reason: '内部备注' })).statusCode).toBe(201);
    expect((await addScore(id, { account_id: accountId('bob'), kind: 'penalty', points: -50, reason: '刷量，不能公开的原因' })).statusCode).toBe(201);

    const board = await app.inject({ url: `/api/public/competitions/${id}/leaderboard`, headers: { origin: 'null' } });
    expect(board.statusCode).toBe(200);
    expect(board.headers['access-control-allow-origin']).toBe('*');
    expect(board.headers['access-control-allow-credentials']).toBeUndefined();
    const body = board.json();
    expect(body.individuals[0]).toEqual({ rank: 1, username: expect.any(String), display_name: '爱丽丝', avatar_url: null, team_name: '夜猫子', score: 30 });
    expect(body.teams[0]).toMatchObject({ rank: 1, name: '夜猫子', score: 30, members: [{ display_name: '爱丽丝' }] });
    expect(Object.keys(body.teams[0].members[0]).sort()).toEqual(['avatar_url', 'display_name', 'username']);

    const feed = (await app.inject({ url: `/api/public/competitions/${id}/feed` })).json();
    expect(feed.items).toHaveLength(2);
    expect(feed.items.find((item: { kind: string }) => item.kind === 'penalty')).toMatchObject({ title: null, url: null, points: -50 });
    expect(Object.keys(feed.items[0]).sort()).toEqual(['at', 'avatar_url', 'display_name', 'id', 'kind', 'points', 'title', 'url', 'username']);
    const stats = (await app.inject({ url: `/api/public/competitions/${id}/stats` })).json();
    expect(stats).toMatchObject({ participants: 3, teams: 1, merged_prs: 1, accepted_issues: 0, total_points: -20 });
    const snapshot = await app.inject({ url: `/api/public/competitions/${id}/snapshot` });
    expect(Object.keys(snapshot.json()).sort()).toEqual(['competition', 'feed', 'leaderboard', 'stats']);

    const everything = [board.body, JSON.stringify(feed), JSON.stringify(stats), snapshot.body].join('\n');
    for (const login of ['alice', 'bob', 'carol']) expect(everything).not.toContain(accountId(login));
    expect(everything).not.toMatch(/account_id|real_name|张三丰|email|刷量|内部备注|"ip"|login/);
  });

  it('不存在或下线的比赛回 404，404 也带跨域头；cursor 翻页不重复', async () => {
    const { app, as, accountId, createCompetition, signUp, addScore } = await setup();
    const missing = await app.inject({ url: '/api/public/competitions/nope/leaderboard' });
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['access-control-allow-origin']).toBe('*');
    const id = await createCompetition();
    await signUp(id, 'alice');
    for (let n = 1; n <= 3; n++) await addScore(id, { account_id: accountId('alice'), kind: 'issue', repo: 'geek/admin', number: n, points: 5 });
    const first = (await app.inject({ url: `/api/public/competitions/${id}/feed?limit=2` })).json();
    expect(first.items).toHaveLength(2);
    expect(first.next_cursor).toEqual(expect.any(String));
    const second = (await app.inject({ url: `/api/public/competitions/${id}/feed?limit=2&cursor=${first.next_cursor}` })).json();
    expect(second.items).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item: { id: string }) => item.id)).size).toBe(3);
    await app.inject({ method: 'PATCH', url: `/api/console/competitions/${id}`, headers: as('owner'), payload: { offline: true } });
    for (const part of ['', '/leaderboard', '/feed', '/stats', '/snapshot']) {
      expect((await app.inject({ url: `/api/public/competitions/${id}${part}` })).statusCode).toBe(404);
    }
  });

  it('写入后缓存马上清：加分、撤销之后再读就是新的天梯', async () => {
    const { app, as, accountId, createCompetition, signUp, addScore } = await setup();
    const id = await createCompetition();
    await signUp(id, 'alice');
    const read = async () => (await app.inject({ url: `/api/public/competitions/${id}/leaderboard` })).json().individuals[0].score;
    expect(await read()).toBe(0);
    const added = await addScore(id, { account_id: accountId('alice'), kind: 'issue', repo: 'geek/admin', number: 1, points: 10 });
    expect(await read()).toBe(10);
    const revoked = await app.inject({ method: 'POST', url: `/api/console/competitions/${id}/score-events/${added.json().event.id}/revoke`, headers: as('owner'), payload: { reason: '重复' } });
    expect(revoked.statusCode).toBe(200);
    expect(await read()).toBe(0);
  });

  it(`按 IP 每分钟 ${PUBLIC_COMPETITION_LIMIT.max} 次，超出回 429 并带 bucket、Retry-After 与跨域头，记一条 limited`, async () => {
    const { app, createCompetition } = await setup();
    const id = await createCompetition();
    for (let n = 0; n < PUBLIC_COMPETITION_LIMIT.max; n++) {
      const res = await app.inject({ url: `/api/public/competitions/${id}/stats`, remoteAddress: '203.0.113.9' });
      expect(res.statusCode).toBe(200);
    }
    const limited = await app.inject({ url: `/api/public/competitions/${id}/snapshot`, remoteAddress: '203.0.113.9' });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: 'rate_limited', bucket: 'public.competition.per_minute' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['access-control-allow-origin']).toBe('*');
    // 换一个 IP 不受影响；计数里存的是散列，不是 IP 原文
    expect((await app.inject({ url: `/api/public/competitions/${id}/stats`, remoteAddress: '198.51.100.7' })).statusCode).toBe(200);
    const subjects = app.services.storage.db.prepare("SELECT DISTINCT subject FROM limit_events WHERE bucket = 'public.competition.per_minute'").all() as { subject: string }[];
    expect(subjects.every(row => /^[0-9a-f]{64}$/.test(row.subject))).toBe(true);
    expect(activityRows(app, { action: 'public.competition.per_minute' })[0]).toMatchObject({ outcome: 'limited' });
  });
});

describe('年级系数', () => {
  it('记分那一刻按年级乘系数：大一 1.5、大二 1.3、没填 1.0；扣分不乘；改系数只影响之后的记录', async () => {
    const { app, as, accountId, createCompetition, signUp, addScore, setEnrollment, makeStale } = await setup();
    const id = await createCompetition();
    for (const login of ['alice', 'bob', 'carol']) await signUp(id, login);
    const year = academicYear(Date.now());
    setEnrollment('alice', year); // 大一
    setEnrollment('bob', year - 1); // 大二
    const pr = await addScore(id, { account_id: accountId('alice'), kind: 'pr', repo: 'geek/admin', number: 1, points: 30 });
    expect(pr.json().event).toMatchObject({ points: 30, grade: 'year1', grade_factor: 150, weighted_points: 45 });
    expect((await addScore(id, { account_id: accountId('bob'), kind: 'issue', repo: 'geek/admin', number: 2, points: 10 })).json().event)
      .toMatchObject({ grade: 'year2', grade_factor: 130, weighted_points: 13 });
    expect((await addScore(id, { account_id: accountId('carol'), kind: 'issue', repo: 'geek/admin', number: 3, points: 10 })).json().event)
      .toMatchObject({ grade: 'none', grade_factor: 100, weighted_points: 10 });
    expect((await addScore(id, { account_id: accountId('alice'), kind: 'penalty', points: -50 })).json().event)
      .toMatchObject({ grade: 'year1', grade_factor: 100, weighted_points: -50 });
    expect(activityRows(app, { action: 'competition.score.add' })[0].meta).toMatchObject({ grade: 'year1', grade_factor: 150, weighted_points: 45 });

    const rules = (await app.inject({ url: `/api/console/competitions/${id}/rules`, headers: as('owner') })).json();
    expect(rules.grade_factors).toEqual({ year1: 150, year2: 130, year3: 110, year4: 100, graduated: 100, none: 100 });
    expect(rules.prizes).toEqual([]);
    const put = (payload: Record<string, unknown>, login = 'owner') =>
      app.inject({ method: 'PUT', url: `/api/console/competitions/${id}/rules`, headers: as(login), payload });
    const factors = { ...rules.grade_factors, year1: 200 };
    expect((await put({ grade_factors: factors, prizes: [], gitlab_projects: [] }, 'alice')).statusCode).toBe(403);
    expect((await put({ grade_factors: { ...factors, year1: 20 }, prizes: [], gitlab_projects: [] })).statusCode).toBe(400);
    expect((await put({ grade_factors: factors, prizes: [{ from: 2, to: 1, amount_cny: 5, title: '' }], gitlab_projects: [] })).json().error).toBe('bad_prizes');
    expect((await put({ grade_factors: factors, prizes: [{ from: 1, to: 3, amount_cny: 5, title: '' }, { from: 3, to: 4, amount_cny: 1, title: '' }], gitlab_projects: [] })).json().error).toBe('bad_prizes');
    const saved = await put({ grade_factors: factors, prizes: [{ from: 1, to: 1, amount_cny: 700, title: '一等' }], gitlab_projects: ['geek/admin'] });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ grade_factors: factors, prizes: [{ from: 1, to: 1, amount_cny: 700, title: '一等' }], gitlab_projects: ['geek/admin'] });
    expect(activityRows(app, { action: 'competition.rules.update' })[0].meta).toMatchObject({ before: { grade_factors: { year1: 150 } }, after: { grade_factors: { year1: 200 } } });

    // 已经记下的分不重算，新记的按新系数
    const board = (await app.inject({ url: `/api/public/competitions/${id}/leaderboard` })).json();
    expect(board.individuals.find((row: { score: number }) => row.score === -5)).toBeTruthy(); // alice：45 - 50
    expect((await addScore(id, { account_id: accountId('alice'), kind: 'issue', repo: 'geek/admin', number: 9, points: 10 })).json().event.weighted_points).toBe(20);
    const publicCompetition = (await app.inject({ url: `/api/public/competitions/${id}` })).json();
    expect(publicCompetition.grade_factors[0]).toEqual({ grade: 'year1', label: '大一', factor: 2 });
    expect(publicCompetition.prizes).toEqual([{ from: 1, to: 1, amount_cny: 700, title: '一等' }]);

    makeStale('owner');
    expect((await put({ grade_factors: factors, prizes: [], gitlab_projects: [] })).json().error).toBe('step_up_required');
  });

  it('第一期比赛带种子：默认系数、三档奖项和 geek/admin', async () => {
    const { app } = await setup();
    const seeded = (await app.inject({ url: '/api/public/competitions/oss-challenge-2026-1' })).json();
    expect(seeded.prizes).toEqual([
      { from: 1, to: 1, amount_cny: 700, title: 'GPT 5x 订阅的价格' },
      { from: 2, to: 3, amount_cny: 140, title: 'GPT Plus 订阅的价格' },
      { from: 4, to: 8, amount_cny: 70, title: '' },
    ]);
    expect(seeded.grade_factors.map((item: { factor: number }) => item.factor)).toEqual([1.5, 1.3, 1.1, 1, 1, 1]);
    expect(app.services.competitionRules.get('oss-challenge-2026-1').gitlab_projects).toEqual(['geek/admin']);
  });
});
