// 定榜与兑奖码（#278，所有者 2026-10-24 13:45）：结束后才能定榜，名次冻结、给分数大于 0 的得奖者发码；
// 得奖的人在「我的参赛」看码，公开接口从不给码；核销要 competition.prize.redeem 与 step-up，重复和查不到都说清楚；
// 以及新表与种子在同一个库上重复启动不出错、不重复。
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generatePrizeCode, normalizePrizeCode } from '../../app/server/src/lib/competition-prizes';
import { activityRows, grantPermNode, testApp } from './helpers';
import { contestSetup, type ContestContext } from './contest-fixtures';

const contexts: ContestContext[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** 四个人报名，各自记一些分；奖项：第 1 名 700，第 2–3 名 140，第 4–8 名 70。 */
async function finalSetup() {
  const context = await contestSetup();
  contexts.push(context);
  const { app, as, accountId, createCompetition, signUp, addScore } = context;
  const id = await createCompetition();
  for (const login of ['alice', 'bob', 'carol', 'dave']) await signUp(id, login);
  const rules = (await app.inject({ url: `/api/console/competitions/${id}/rules`, headers: as('owner') })).json();
  const prizes = [
    { from: 1, to: 1, amount_cny: 700, title: 'GPT 5x 订阅的价格' },
    { from: 2, to: 3, amount_cny: 140, title: 'GPT Plus 订阅的价格' },
    { from: 4, to: 8, amount_cny: 70, title: '' },
  ];
  expect((await app.inject({ method: 'PUT', url: `/api/console/competitions/${id}/rules`, headers: as('owner'), payload: { grade_factors: rules.grade_factors, prizes, gitlab_projects: [] } })).statusCode).toBe(200);
  // alice 60，bob 30，carol 30（比 bob 晚到这个分），dave 0
  await addScore(id, { account_id: accountId('alice'), kind: 'pr', repo: 'geek/admin', number: 1, points: 60 });
  await addScore(id, { account_id: accountId('bob'), kind: 'pr', repo: 'geek/admin', number: 2, points: 30 });
  app.services.storage.db.prepare("UPDATE competition_score_events SET created_at = created_at - 60000 WHERE number = 2").run();
  await addScore(id, { account_id: accountId('carol'), kind: 'pr', repo: 'geek/admin', number: 3, points: 30 });
  const finalize = (login = 'owner') => app.inject({ method: 'POST', url: `/api/console/competitions/${id}/final`, headers: as(login) });
  return { ...context, id, finalize };
}

describe('兑奖码格式', () => {
  it('YUGC- 加 16 位 Crockford base32，输入时不分大小写、去掉连字符，I/L 当 1、O 当 0', () => {
    const code = generatePrizeCode();
    expect(code).toMatch(/^YUGC-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    expect(new Set(Array.from({ length: 200 }, generatePrizeCode)).size).toBe(200);
    const plain = code.slice(5).replace(/-/g, '');
    expect(normalizePrizeCode(code.toLowerCase())).toBe(plain);
    expect(normalizePrizeCode(` ${plain} `)).toBe(plain);
    expect(normalizePrizeCode('YUGC-OOOO-IIII-LLLL-0000')).toBe('0000111111110000');
    expect(normalizePrizeCode('YUGC-1234')).toBeNull();
    expect(normalizePrizeCode('YUGC-UUUU-UUUU-UUUU-UUUU')).toBeNull();
  });
});

describe('定榜', () => {
  it('比赛结束前不能定；定榜后名次冻结、只给分数大于 0 的人发码，之后加分、撤销和改规则都 409', async () => {
    const { app, as, accountId, id, finalize, endCompetition, addScore, makeStale } = await finalSetup();
    expect((await finalize()).json().error).toBe('not_ended');
    await endCompetition(id);
    const preview = (await app.inject({ url: `/api/console/competitions/${id}/final`, headers: as('owner') })).json();
    expect(preview.finalized_at).toBeNull();
    expect(preview.preview.map((row: { rank: number; amount_cny: number | null }) => [row.rank, row.amount_cny])).toEqual([[1, 700], [2, 140], [3, 140], [4, null]]);
    expect((await finalize('alice')).statusCode).toBe(403);
    makeStale('owner');
    expect((await finalize()).json().error).toBe('step_up_required');
    contexts[0].app.services.storage.db.prepare('UPDATE sessions SET created_at = ? WHERE login = ?').run(Date.now(), 'owner');

    const done = await finalize();
    expect(done.statusCode).toBe(201);
    const view = done.json();
    expect(view.standings.map((row: { account: { account_id: string }; rank: number; points: number }) => [row.account.account_id, row.rank, row.points])).toEqual([
      [accountId('alice'), 1, 60], [accountId('bob'), 2, 30], [accountId('carol'), 3, 30], [accountId('dave'), 4, 0],
    ]);
    expect(view.prizes.map((row: { rank: number; amount_cny: number; title: string }) => [row.rank, row.amount_cny, row.title])).toEqual([
      [1, 700, 'GPT 5x 订阅的价格'], [2, 140, 'GPT Plus 订阅的价格'], [3, 140, 'GPT Plus 订阅的价格'],
    ]);
    expect(view.prizes[0].code_hint).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(JSON.stringify(view)).not.toMatch(/YUGC-/);
    expect((await finalize()).json().error).toBe('already_finalized');
    expect(activityRows(app, { action: 'competition.finalize' })[0].meta).toMatchObject({ standings: 4 });
    expect(JSON.stringify(activityRows(app))).not.toMatch(/YUGC-/);

    expect((await addScore(id, { account_id: accountId('dave'), kind: 'issue', repo: 'geek/admin', number: 9, points: 5 })).json().error).toBe('competition_finalized');
    const event = app.services.storage.db.prepare("SELECT id FROM competition_score_events LIMIT 1").get() as { id: string };
    expect((await app.inject({ method: 'POST', url: `/api/console/competitions/${id}/score-events/${event.id}/revoke`, headers: as('owner'), payload: { reason: 'x' } })).json().error).toBe('competition_finalized');
    const rules = (await app.inject({ url: `/api/console/competitions/${id}/rules`, headers: as('owner') })).json();
    expect(rules.finalized).toBe(true);
    expect((await app.inject({ method: 'PUT', url: `/api/console/competitions/${id}/rules`, headers: as('owner'), payload: { grade_factors: rules.grade_factors, prizes: [], gitlab_projects: [] } })).json().error).toBe('competition_finalized');

    // 公开接口：天梯用定榜的严格名次，有定榜时间，没有任何兑奖码
    const snapshot = await app.inject({ url: `/api/public/competitions/${id}/snapshot` });
    expect(snapshot.json().competition.finalized_at).toEqual(expect.any(Number));
    expect(snapshot.json().leaderboard.individuals.map((row: { rank: number }) => row.rank)).toEqual([1, 2, 3, 4]);
    expect(snapshot.body).not.toMatch(/YUGC|code/);
  });

  it('得奖的人在「我的参赛」看到名次、奖项和兑奖码，没得奖的只看到名次；撤销定榜后码作废', async () => {
    const { app, as, id, finalize, endCompetition } = await finalSetup();
    await endCompetition(id);
    await finalize();
    const mine = (await app.inject({ url: '/api/me/competition-results', headers: as('alice') })).json();
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ competition_id: id, rank: 1, points: 60, prize: { amount_cny: 700, title: 'GPT 5x 订阅的价格', redeemed_at: null } });
    expect(mine.items[0].prize.code).toMatch(/^YUGC-/);
    const dave = (await app.inject({ url: '/api/me/competition-results', headers: as('dave') })).json();
    expect(dave.items[0]).toMatchObject({ rank: 4, points: 0, prize: null });
    expect((await app.inject({ url: '/api/me/competition-results' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/me/competition-results', headers: as('alice') })).headers['cache-control']).toBe('no-store');

    const undone = await app.inject({ method: 'DELETE', url: `/api/console/competitions/${id}/final`, headers: as('owner') });
    expect(undone.statusCode).toBe(200);
    expect(undone.json().finalized_at).toBeNull();
    expect((await app.inject({ method: 'POST', url: '/api/console/prizes/lookup', headers: as('owner'), payload: { code: mine.items[0].prize.code } })).json().error).toBe('code_not_found');
    expect((await app.inject({ url: '/api/me/competition-results', headers: as('alice') })).json().items).toEqual([]);
  });
});

describe('兑奖核销', () => {
  it('查找与核销要 competition.prize.redeem；核销要 step-up；重复核销与查不到都有明确的错误；结果里没有真实姓名', async () => {
    const { app, as, accountId, id, finalize, endCompetition, makeStale } = await finalSetup();
    await endCompetition(id);
    await finalize();
    app.services.profiles.setRealInfo(accountId('alice'), '张三丰', null);
    const code = (await app.inject({ url: '/api/me/competition-results', headers: as('alice') })).json().items[0].prize.code as string;
    const lookup = (login: string, value = code) => app.inject({ method: 'POST', url: '/api/console/prizes/lookup', headers: as(login), payload: { code: value } });
    const redeem = (login: string, value = code) => app.inject({ method: 'POST', url: '/api/console/prizes/redeem', headers: as(login), payload: { code: value } });

    expect((await app.inject({ method: 'POST', url: '/api/console/prizes/lookup', payload: { code } })).statusCode).toBe(401);
    expect((await lookup('bob')).json()).toMatchObject({ error: 'forbidden', node: 'competition.prize.redeem' });
    expect((await redeem('bob')).statusCode).toBe(403);

    grantPermNode(app, accountId('erin'), 'competition.prize.redeem');
    const seen = (await lookup('erin', code.toLowerCase().replace(/-/g, ' '))).json().prize;
    expect(seen).toMatchObject({ rank: 1, amount_cny: 700, title: 'GPT 5x 订阅的价格', competition_name: '开源赛', redeemed_at: null, account: { account_id: accountId('alice') } });
    const byOwner = await lookup('owner');
    expect(byOwner.json().prize).not.toHaveProperty('real_name');
    expect(byOwner.body).not.toContain('张三丰');

    makeStale('erin');
    expect((await redeem('erin')).json().error).toBe('step_up_required');
    const done = await redeem('owner');
    expect(done.statusCode).toBe(200);
    expect(done.json().prize).toMatchObject({ redeemed_at: expect.any(Number), redeemed_by: { account_id: accountId('owner') } });
    const twice = await redeem('owner');
    expect(twice.statusCode).toBe(409);
    expect(twice.json()).toMatchObject({ error: 'already_redeemed', message: '这个兑奖码已经核销过了', prize: { redeemed_by: { account_id: accountId('owner') } } });
    const unknown = await redeem('owner', 'YUGC-0000-0000-0000-0000');
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toMatchObject({ error: 'code_not_found', message: '没有这个兑奖码，请核对后再输入' });
    expect((await app.inject({ url: '/api/me/competition-results', headers: as('alice') })).json().items[0].prize.redeemed_at).toEqual(expect.any(Number));

    // 第一条是 bob 没有权限被 403 的拒绝记录（http-policy 按节点名记），这里只看核销本身
    const records = activityRows(app, { action: 'competition.prize.redeem' }).filter(row => row.meta.result !== undefined);
    expect(records.map(row => [row.outcome, row.meta.result])).toEqual([['ok', 'redeemed'], ['denied', 'already_redeemed'], ['denied', 'code_not_found']]);
    expect(records[0].meta.code_hint).toBe(code.slice(-4));
    expect(JSON.stringify(activityRows(app))).not.toContain(code.slice(5, 14));
    // 已经核销过的不能撤销定榜
    expect((await app.inject({ method: 'DELETE', url: `/api/console/competitions/${id}/final`, headers: as('owner') })).json().error).toBe('prizes_redeemed');
  });

  it('输错的兑奖码每人每小时 20 次，之后 429', async () => {
    const { app, as, id, finalize, endCompetition } = await finalSetup();
    await endCompetition(id);
    await finalize();
    for (let n = 0; n < 20; n++) {
      const res = await app.inject({ method: 'POST', url: '/api/console/prizes/lookup', headers: as('owner'), payload: { code: `YUGC-0000-0000-0000-${String(n).padStart(4, '0')}` } });
      expect(res.statusCode).toBe(404);
    }
    const blocked = await app.inject({ method: 'POST', url: '/api/console/prizes/lookup', headers: as('owner'), payload: { code: 'YUGC-0000-0000-0000-0001' } });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ error: 'rate_limited', bucket: 'competition.prize.lookup.fail' });
  });
});

describe('迁移可以重复执行', () => {
  it('同一个库启动两次：新表各一份、种子只插一次，所有者删掉的种子不会补回来', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yzgc-278-'));
    dirs.push(dir);
    const env = { DB_PATH: join(dir, 'data.db') };
    const first = await testApp({}, false, env);
    const db = first.app.services.storage.db;
    const tables = () => (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'competition_%' ORDER BY name").all() as { name: string }[]).map(row => row.name);
    expect(tables()).toEqual(expect.arrayContaining(['competition_finals', 'competition_gitlab_sources', 'competition_prizes', 'competition_rules', 'competition_score_candidates', 'competition_site_versions', 'competition_sites']));
    expect((db.prepare("SELECT name FROM pragma_table_info('competition_score_events') WHERE name IN ('grade', 'grade_factor', 'weighted_points')").all() as unknown[]).length).toBe(3);
    db.prepare("DELETE FROM competition_gitlab_sources WHERE competition_id = 'oss-challenge-2026-1'").run();
    db.prepare("UPDATE competition_rules SET prizes = '[]' WHERE competition_id = 'oss-challenge-2026-1'").run();
    await first.close();

    const second = await testApp({}, false, env);
    const again = second.app.services.storage.db;
    expect(again.prepare("SELECT COUNT(*) AS n FROM console_seeds WHERE name = 'competition_oss_2026_1_rules'").get()).toEqual({ n: 1 });
    expect(again.prepare("SELECT COUNT(*) AS n FROM competition_gitlab_sources").get()).toEqual({ n: 0 });
    expect(second.app.services.competitionRules.get('oss-challenge-2026-1').prizes).toEqual([]);
    expect(second.app.services.competitionSites.root).toBe(join(dir, 'sites'));
    await second.close();
  });
});
