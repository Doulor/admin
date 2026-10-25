// 比赛积分账本与天梯（#239 第二部分）：两档评定查表（#278）、重复与撤销、审计，以及天梯的排序与并列名次。
// 认人是会话里的极客班账号（#262）；#274 SPEC §3.2 去掉 GitHub 组织那道门之后，成员资格按权限节点
// competition.signup/competition.team/competitions.manage 判定，不再查 GitHub 组织成员资格。
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { activityRows, grantPermGroup, signIn, testApp } from './helpers';

const SEED_ID = 'oss-challenge-2026-1';
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const USERS: Record<string, number> = { alice: 101, bob: 102, carol: 103, dave: 104 };
const HOUR = 3600_000;
const DAY = 24 * HOUR;

async function setup() {
  // 不传 octokitFactory：默认拒绝（helpers.ts），这组接口真的调了 GitHub 这个用例就会报错——
  // 证明新的权限节点守卫不依赖 GitHub 组织资格。
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  const sessions = new Map<string, string>();
  const granted = new Set<string>();
  const as = (login: string) => {
    if (!sessions.has(login)) {
      const sid = signIn(app, login, USERS[login], null);
      sessions.set(login, sid);
      // alice 是提督（控制台建比赛、登记积分要 competitions.manage，旧能力系统）；bob/carol/dave 是普通成员；
      // 两者都会被 syncPermissionLevel 同步进新权限引擎的 level.member 组（报名、组队都要它）。
      if (!granted.has(login)) {
        granted.add(login);
        const accountId = app.services.auth.getSession(sid)!.account_id;
        app.services.identity.setSiteRole({ accountId, role: login === 'alice' ? 'admin' : 'member', actor: 'system' });
        // signIn() 按 #280 给新账号填了大二；#278 起积分按年级加权，这组用例只看名次与合计，从「没填年级、系数 1」起步
        app.services.storage.db.prepare('UPDATE account_profiles SET enrollment_year = NULL WHERE account_id = ?').run(accountId);
      }
    }
    return { cookie: `sid=${sessions.get(login)!}` };
  };
  const accountId = (login: string) => {
    as(login);
    return app.services.auth.getSession(sessions.get(login)!)!.account_id;
  };
  grantPermGroup(app, accountId('alice'), 'title.site.owner'); // #274：控制台比赛/积分接口按新权限体系判定
  /** 一场已开放报名、可组队、可计分的比赛（1–3 人）。 */
  const scoreCompetition = async (settings: Record<string, unknown> = {}) => {
    const now = Date.now();
    const created = await app.inject({
      method: 'POST', url: '/api/console/competitions', headers: as('alice'),
      payload: {
        name: '积分赛', kind: 'internal', start_at: now - HOUR, end_at: now + 30 * DAY,
        signup_deadline: now + 7 * DAY, url: null, description: '',
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().competition.id as string;
    const configured = await app.inject({
      method: 'PUT', url: `/api/console/competitions/${id}/signup-settings`, headers: as('alice'),
      payload: { enabled: true, participation: 'team', team_min: 1, team_max: 3, scoring: 'contribution', ...settings },
    });
    expect(configured.statusCode).toBe(200);
    return id;
  };
  const signUp = (id: string, login: string) =>
    app.inject({ method: 'POST', url: `/api/competitions/${id}/signup`, headers: as(login), payload: {} });
  const addScore = (id: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: `/api/console/competitions/${id}/score-events`, headers: as('alice'), payload });
  const revoke = (id: string, eventId: string, reason = '重复登记') =>
    app.inject({ method: 'POST', url: `/api/console/competitions/${id}/score-events/${eventId}/revoke`, headers: as('alice'), payload: { reason } });
  const board = async (id: string, login = 'alice') => {
    const res = await app.inject({ url: `/api/competitions/${id}/leaderboard`, headers: as(login) });
    expect(res.statusCode).toBe(200);
    return res.json();
  };
  const joinTeam = async (id: string, leader: string, login: string) => {
    const created = await app.inject({ method: 'POST', url: `/api/competitions/${id}/teams`, headers: as(leader), payload: { name: `${leader} 队` } });
    expect(created.statusCode).toBe(201);
    const teamId = created.json().team.id;
    expect((await app.inject({ method: 'POST', url: `/api/teams/${teamId}/apply`, headers: as(login), payload: {} })).statusCode).toBe(201);
    const pending = (await app.inject({ url: `/api/competitions/${id}/my-status`, headers: as(leader) })).json().pending;
    expect((await app.inject({
      method: 'POST', url: `/api/teams/${teamId}/respond`, headers: as(leader),
      payload: { membership_id: pending[0].membership_id, action: 'accept' },
    })).statusCode).toBe(200);
    return teamId as string;
  };
  return { app, as, accountId, scoreCompetition, signUp, addScore, revoke, board, joinTeam };
}

describe('seeded competition', () => {
  it('inserts the first open-source challenge once and never puts it back after deletion', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'geek-competition-seed-'));
    dirs.push(dir);
    const dbPath = join(dir, 'data.db');

    const first = await testApp({}, false, { DB_PATH: dbPath });
    try {
      const sid1 = signIn(first.app, 'alice', 101);
      const headers = { cookie: `sid=${sid1}` };
      grantPermGroup(first.app, first.app.services.auth.getSession(sid1)!.account_id, 'title.site.owner'); // #274：控制台比赛接口按新权限体系判定
      const listed = (await first.app.inject({ url: '/api/console/competitions', headers })).json().competitions;
      const seed = listed.find((row: { id: string }) => row.id === SEED_ID);
      expect(seed).toMatchObject({ name: '极客班开源实战贡献挑战赛 · 2026 第一期', kind: 'internal' });
      expect(seed.start_at).toBe(Date.parse('2026-10-21T00:00:00+08:00'));
      expect(seed.end_at).toBe(Date.parse('2026-11-15T23:59:59.999+08:00'));
      expect(seed.signup_deadline).toBe(seed.end_at);
      expect(seed.description).toContain('计分');

      const publicRow = (await first.app.inject({ url: '/api/public/competitions' })).json().competitions
        .find((row: { id: string }) => row.id === SEED_ID);
      // 个人赛（所有者 2026-10-24 23:38 更正：第一期不是团队赛），没有队伍人数上下限
      expect(publicRow.signup).toEqual({ enabled: true, participation: 'individual', team_min: 1, team_max: 1, scoring: 'contribution' });

      // 组织者删掉之后重启不再补
      expect((await first.app.inject({ method: 'DELETE', url: `/api/console/competitions/${SEED_ID}`, headers })).statusCode).toBe(200);
    } finally {
      await first.close();
    }

    // 同一份数据库文件：alice 的站内管理员角色已经落了盘，第二次打开不用再设。
    const second = await testApp({}, false, { DB_PATH: dbPath });
    try {
      const headers = { cookie: `sid=${signIn(second.app, 'alice', 101)}` };
      const listed = (await second.app.inject({ url: '/api/console/competitions', headers })).json().competitions;
      expect(listed.map((row: { id: string }) => row.id)).not.toContain(SEED_ID);
      expect(second.app.services.storage.db.prepare("SELECT COUNT(*) AS n FROM console_seeds WHERE name = 'competition_oss_2026_1'").get())
        .toEqual({ n: 1 });
    } finally {
      await second.close();
    }
  });
});

describe('score events', () => {
  it('scores Issue and PR from the two levels, takes no free points, and checks the repository shape', async () => {
    const { signUp, scoreCompetition, addScore, accountId } = await setup();
    const id = await scoreCompetition();
    await signUp(id, 'alice');
    const alice = accountId('alice');
    const levels = { importance: 'normal', core: 'edge' };

    // 不收手填分数，两档缺一个、档位不认识、扣分带两档都拒绝
    const freePoints = await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 1, points: 30 });
    expect(freePoints.statusCode).toBe(400);
    expect(freePoints.json().error).toBe('validation_error');
    expect((await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 2 })).json().error).toBe('bad_levels');
    expect((await addScore(id, { account_id: alice, kind: 'pr', repo: 'org/repo', number: 3, importance: 'critical' })).json().error).toBe('bad_levels');
    expect((await addScore(id, { account_id: alice, kind: 'pr', repo: 'org/repo', number: 4, importance: 'huge', core: 'core' })).statusCode).toBe(400);
    expect((await addScore(id, { account_id: alice, kind: 'penalty', ...levels })).json().error).toBe('bad_levels');
    expect((await addScore(id, { account_id: alice, kind: 'issue', number: 5, ...levels })).json().error).toBe('bad_repo');
    expect((await addScore(id, { account_id: alice, kind: 'issue', repo: 'no-slash', number: 5, ...levels })).json().error).toBe('bad_repo');
    expect((await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 0, ...levels })).statusCode).toBe(400);

    const top = await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 6, importance: 'critical', core: 'core' });
    expect(top.statusCode).toBe(201);
    expect(top.json().event).toMatchObject({
      kind: 'issue', points: 30, importance: 'critical', core: 'core', damp_percent: 100, weighted_points: 30,
      contributed_at: expect.any(Number), repo: 'org/repo', number: 6, status: 'active', created_by_login: 'alice',
      person: { login: 'alice' }, revoked_at: null, revoke_reason: null, reason: '',
    });
    // 同样两档，PR 比 Issue 高
    const pr = await addScore(id, { account_id: alice, kind: 'pr', repo: 'org/repo', number: 7, importance: 'critical', core: 'core' });
    expect(pr.json().event).toMatchObject({ points: 100, weighted_points: 100 });
    const penalty = await addScore(id, { account_id: alice, kind: 'penalty' });
    expect(penalty.statusCode).toBe(201);
    expect(penalty.json().event).toMatchObject({ points: -50, importance: null, core: null, weighted_points: -50 });
  });

  it('counts only the first 一般 × 边缘 per person per week; the rest score 0 and stay on record', async () => {
    const { app, as, signUp, scoreCompetition, addScore, revoke, accountId } = await setup();
    const id = await scoreCompetition();
    await signUp(id, 'alice');
    await signUp(id, 'bob');
    const alice = accountId('alice');
    const trivial = { importance: 'normal', core: 'edge' };

    const first = (await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 1, ...trivial })).json().event;
    expect(first).toMatchObject({ points: 5, damp_percent: 100, weighted_points: 5 });
    const second = (await addScore(id, { account_id: alice, kind: 'pr', repo: 'org/repo', number: 2, ...trivial })).json().event;
    expect(second).toMatchObject({ points: 15, damp_percent: 0, weighted_points: 0, status: 'active' });
    // 别的格子不受影响；别人的第一条照算
    expect((await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 3, importance: 'normal', core: 'business' })).json().event)
      .toMatchObject({ points: 8, damp_percent: 100, weighted_points: 8 });
    expect((await addScore(id, { account_id: accountId('bob'), kind: 'issue', repo: 'org/repo', number: 4, ...trivial })).json().event)
      .toMatchObject({ damp_percent: 100, weighted_points: 5 });

    // 试算和登记是同一套算法：现在再登一条一般 × 边缘会是 0 分
    const preview = await app.inject({ url: `/api/console/competitions/${id}/score-preview?account_id=${alice}&kind=pr&importance=normal&core=edge`, headers: as('alice') });
    expect(preview.json()).toEqual({ points: 15, grade: 'none', grade_factor: 100, damp_percent: 0, weighted_points: 0 });
    // 撤销照算的那条之后，新登记的又能照算一条；已经记成 0 的那条不回头改
    expect((await revoke(id, first.id)).statusCode).toBe(200);
    expect((await addScore(id, { account_id: alice, kind: 'issue', repo: 'org/repo', number: 5, ...trivial })).json().event)
      .toMatchObject({ damp_percent: 100, weighted_points: 5 });
    const events = (await app.inject({ url: `/api/console/competitions/${id}/score-events`, headers: as('alice') })).json().events;
    expect(events.find((event: { id: string }) => event.id === second.id)).toMatchObject({ damp_percent: 0, weighted_points: 0 });
    // 天梯里 0 分的那条照样算一个 PR
    const board = (await app.inject({ url: `/api/competitions/${id}/leaderboard`, headers: as('alice') })).json();
    expect(board.individuals.find((row: { person: { login: string } }) => row.person.login === 'alice')).toMatchObject({ points: 13, issues: 2, prs: 1 });
  });

  it('keeps rows written before the two levels as they were: points count, levels and discount stay empty', async () => {
    const { app, as, signUp, scoreCompetition, accountId } = await setup();
    const id = await scoreCompetition();
    await signUp(id, 'alice');
    const alice = accountId('alice');
    // #239 时代手填分数登记的一条：没有年级、两档和折扣
    app.services.storage.db.prepare(`INSERT INTO competition_score_events(id, competition_id, account_id, kind, repo, number, points, reason, status, created_by, created_at)
      VALUES ('00000000-0000-4000-8000-000000000239', ?, ?, 'pr', 'org/old', 1, 37, '', 'active', ?, ?)`).run(id, alice, alice, Date.now() - HOUR);
    const events = (await app.inject({ url: `/api/console/competitions/${id}/score-events`, headers: as('alice') })).json().events;
    expect(events[0]).toMatchObject({ points: 37, weighted_points: 37, importance: null, core: null, grade: null, grade_factor: null, damp_percent: null, contributed_at: null });
    const board = (await app.inject({ url: `/api/competitions/${id}/leaderboard`, headers: as('alice') })).json();
    expect(board.individuals[0]).toMatchObject({ points: 37, prs: 1 });
  });

  it('refuses duplicates, unsigned-up members and competitions without scoring', async () => {
    const { signUp, scoreCompetition, addScore, revoke, accountId } = await setup();
    const id = await scoreCompetition();
    await signUp(id, 'alice');

    const payload = { account_id: accountId('alice'), kind: 'pr', repo: 'org/repo', number: 9, importance: 'normal', core: 'business' };
    const created = await addScore(id, payload);
    expect(created.statusCode).toBe(201);
    const duplicate = await addScore(id, payload);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toBe('duplicate_score_event');

    // 撤销之后同一条可以重新登记
    expect((await revoke(id, created.json().event.id)).statusCode).toBe(200);
    expect((await addScore(id, payload)).statusCode).toBe(201);

    const notSignedUp = await addScore(id, { account_id: accountId('bob'), kind: 'issue', repo: 'org/repo', number: 10, importance: 'normal', core: 'business' });
    expect(notSignedUp.statusCode).toBe(409);
    expect(notSignedUp.json().error).toBe('not_signed_up');

    const plain = await scoreCompetition({ scoring: 'none' });
    await signUp(plain, 'alice');
    const disabled = await addScore(plain, { account_id: accountId('alice'), kind: 'issue', repo: 'org/repo', number: 11, importance: 'normal', core: 'business' });
    expect(disabled.statusCode).toBe(409);
    expect(disabled.json().error).toBe('scoring_not_enabled');
  });

  it('revokes once, keeps the trail, and audits both writes', async () => {
    const { app, signUp, scoreCompetition, addScore, revoke, accountId } = await setup();
    const id = await scoreCompetition();
    await signUp(id, 'alice');
    const created = (await addScore(id, {
      account_id: accountId('alice'), kind: 'issue', repo: 'org/repo', number: 12, importance: 'normal', core: 'business', reason: '修了文档',
    })).json().event;

    const revoked = await revoke(id, created.id);
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().event).toMatchObject({
      id: created.id, status: 'revoked', revoked_at: expect.any(Number), revoke_reason: '重复登记', reason: '修了文档',
    });
    const again = await revoke(id, created.id);
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe('already_revoked');
    expect((await revoke(id, 'missing-event')).statusCode).toBe(404);

    const actions = activityRows(app, { actionLike: 'competition.score.%' }).map(row => row.action);
    expect(actions).toEqual(['competition.score.add', 'competition.score.revoke']);
  });

  it('lists events newest first and hides them from anonymous callers', async () => {
    const { app, as, signUp, scoreCompetition, addScore, accountId } = await setup();
    const id = await scoreCompetition();
    await signUp(id, 'alice');
    await addScore(id, { account_id: accountId('alice'), kind: 'issue', repo: 'org/one', number: 1, importance: 'normal', core: 'edge' });
    await addScore(id, { account_id: accountId('alice'), kind: 'issue', repo: 'org/two', number: 2, importance: 'normal', core: 'business' });
    await addScore(id, { account_id: accountId('alice'), kind: 'penalty' });

    const events = (await app.inject({ url: `/api/console/competitions/${id}/score-events`, headers: as('alice') })).json().events;
    expect(events.map((event: { kind: string }) => event.kind)).toEqual(['penalty', 'issue', 'issue']);
    expect(events[1].repo).toBe('org/two');

    expect((await app.inject({ url: `/api/console/competitions/${id}/score-events` })).statusCode).toBe(401);
    expect((await app.inject({ url: `/api/competitions/${id}/leaderboard` })).statusCode).toBe(401);
  });
});

describe('leaderboard', () => {
  it('ranks individuals by points with competition ranks, lists zero-point signups, and sums team points', async () => {
    const { signUp, scoreCompetition, addScore, board, joinTeam, accountId } = await setup();
    const id = await scoreCompetition();
    for (const login of ['alice', 'bob', 'carol', 'dave']) expect((await signUp(id, login)).statusCode).toBe(200);
    const teamId = await joinTeam(id, 'alice', 'bob');
    const alice = accountId('alice');

    await addScore(id, { account_id: alice, kind: 'pr', repo: 'org/alpha', number: 1, importance: 'important', core: 'business' });
    await addScore(id, { account_id: accountId('bob'), kind: 'pr', repo: 'org/beta', number: 2, importance: 'important', core: 'business' });
    await addScore(id, { account_id: accountId('carol'), kind: 'issue', repo: 'org/gamma', number: 3, importance: 'normal', core: 'edge' });

    const leaderboard = await board(id);
    expect(leaderboard.updated_at).toBeGreaterThan(0);
    expect(leaderboard.individuals.map((row: { person: { login: string } }) => row.person.login)).toEqual(['alice', 'bob', 'carol', 'dave']);
    expect(leaderboard.individuals.map((row: { rank: number }) => row.rank)).toEqual([1, 1, 3, 4]);
    expect(leaderboard.individuals.map((row: { points: number }) => row.points)).toEqual([45, 45, 5, 0]);
    expect(leaderboard.individuals[0]).toMatchObject({
      team: { id: teamId, name: 'alice 队' }, prs: 1, issues: 0, penalties: 0,
      person: { account_id: alice, login: 'alice' },
    });
    expect(leaderboard.individuals[2].team).toBeNull();
    expect(leaderboard.individuals[2]).toMatchObject({ issues: 1, prs: 0 });
    expect(leaderboard.teams).toEqual([
      { rank: 1, team: { id: teamId, name: 'alice 队', status: 'recruiting' }, points: 90, member_count: 2 },
    ]);

    // 扣分计入个人分，也计入队伍分
    await addScore(id, { account_id: accountId('carol'), kind: 'penalty' });
    const afterPenalty = await board(id);
    expect(afterPenalty.individuals.find((row: { person: { login: string } }) => row.person.login === 'carol'))
      .toMatchObject({ points: -45, penalties: 1 });
  });

  it('drops revoked events and skips ranks on ties', async () => {
    const { signUp, scoreCompetition, addScore, revoke, board, accountId } = await setup();
    const id = await scoreCompetition();
    for (const login of ['alice', 'bob', 'carol']) await signUp(id, login);
    const first = (await addScore(id, {
      account_id: accountId('alice'), kind: 'pr', repo: 'org/alpha', number: 1, importance: 'important', core: 'business',
    })).json().event;
    await addScore(id, { account_id: accountId('carol'), kind: 'issue', repo: 'org/gamma', number: 2, importance: 'normal', core: 'edge' });

    expect((await revoke(id, first.id)).statusCode).toBe(200);
    const leaderboard = await board(id);
    expect(leaderboard.individuals.map((row: { points: number; rank: number }) => [row.points, row.rank]))
      .toEqual([[5, 1], [0, 2], [0, 2]]);
    expect(leaderboard.teams).toEqual([]);
  });

  it('refuses a competition without scoring', async () => {
    const { app, as, signUp, scoreCompetition } = await setup();
    const id = await scoreCompetition({ scoring: 'none' });
    await signUp(id, 'alice');
    const response = await app.inject({ url: `/api/competitions/${id}/leaderboard`, headers: as('alice') });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('scoring_not_enabled');
  });
});
