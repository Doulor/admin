// #276 首场个人赛：真实 Fastify 路由 + 隔离 SQLite，外部网络拒绝。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activityRows, grantPermNode } from './helpers';
import { contestSetup, type ContestContext } from './contest-fixtures';

const contexts: ContestContext[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const context of contexts.splice(0)) await context.close();
});
async function setup() {
  const c = await contestSetup({ clock: () => Date.now() }); contexts.push(c);
  const id = await c.createCompetition();
  expect((await c.app.inject({ method: 'PUT', url: `/api/console/competitions/${id}/signup-settings`, headers: c.as('owner'),
    payload: { enabled: true, participation: 'individual', team_min: 1, team_max: 1, scoring: 'contribution' } })).statusCode).toBe(200);
  const my = (login = 'alice') => c.app.inject({ url: `/api/competitions/${id}/my-status`, headers: c.as(login) });
  const events = () => c.app.inject({ url: `/api/console/competitions/${id}/score-events`, headers: c.as('owner') });
  const final = () => c.app.inject({ method: 'POST', url: `/api/console/competitions/${id}/final`, headers: c.as('owner') });
  const blockAudit = (action: string) => c.app.services.storage.db.exec(`CREATE TRIGGER fail_competition_audit BEFORE INSERT ON activity_events
    WHEN NEW.action = '${action}' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END`);
  const unblockAudit = () => c.app.services.storage.db.exec('DROP TRIGGER fail_competition_audit');
  return { ...c, id, my, events, final, blockAudit, unblockAudit };
}

describe('个人赛后台事故回归', () => {
  it('有审核权限也不能通过手工积分口审核本人贡献', async () => {
    const c = await setup(); await c.signUp(c.id, 'alice');
    grantPermNode(c.app, c.accountId('alice'), 'competition.score.review');
    const res = await c.addScore(c.id, { account_id: c.accountId('alice'), kind: 'pr', repo: 'geek/admin', number: 1, importance: 'critical', core: 'core' }, 'alice');
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('self_review');
    expect((await c.events()).json().events).toEqual([]);
  });
  it('选手拿到审核权限也不能撤销自己的扣分', async () => {
    const c = await setup(); await c.signUp(c.id, 'alice');
    const event = (await c.addScore(c.id, { account_id: c.accountId('alice'), kind: 'penalty' })).json().event;
    grantPermNode(c.app, c.accountId('alice'), 'competition.score.review');
    const res = await c.app.inject({ method: 'POST', url: `/api/console/competitions/${c.id}/score-events/${event.id}/revoke`, headers: c.as('alice'), payload: { reason: '本人撤销' } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('self_review');
    expect((await c.events()).json().events[0].status).toBe('active');
  });
  it('报名与取消在操作记录失败时一起回滚，重试不留下幽灵报名', async () => {
    const c = await setup();
    c.blockAudit('competition.signup');
    expect((await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice'), payload: {} })).statusCode).toBe(500);
    expect((await c.my()).json().state).toBe('none');
    c.unblockAudit();
    await c.signUp(c.id, 'alice');
    c.blockAudit('competition.signup.cancel');
    expect((await c.app.inject({ method: 'DELETE', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice') })).statusCode).toBe(500);
    expect((await c.my()).json().state).toBe('confirmed');
    c.unblockAudit();
    expect((await c.app.inject({ method: 'DELETE', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice') })).statusCode).toBe(200);
    expect((await c.my()).json().state).toBe('none');
  });
  it('定榜后不能通过报名设置或延长日期重开报名，成员榜与公开榜沿用同一冻结名次', async () => {
    const c = await setup();
    await c.signUp(c.id, 'alice'); await c.signUp(c.id, 'bob');
    for (const [login, number] of [['alice', 1], ['bob', 2]] as const) {
      expect((await c.addScore(c.id, { account_id: c.accountId(login), kind: 'pr', repo: 'geek/admin', number, importance: 'important', core: 'business' })).statusCode).toBe(201);
    }
    await c.endCompetition(c.id);
    expect((await c.final()).statusCode).toBe(201);
    const settings = await c.app.inject({ method: 'PUT', url: `/api/console/competitions/${c.id}/signup-settings`, headers: c.as('owner'),
      payload: { enabled: true, participation: 'individual', team_min: 1, team_max: 1, scoring: 'none' } });
    expect(settings.statusCode).toBe(409);
    expect(settings.json().error).toBe('competition_finalized');
    // 日期仍可编辑，但不可以绕过最终名单冻结。
    expect((await c.app.inject({ method: 'PATCH', url: `/api/console/competitions/${c.id}`, headers: c.as('owner'),
      payload: { end_at: Date.now() + 100_000, signup_deadline: Date.now() + 50_000 } })).statusCode).toBe(200);
    expect((await c.my()).json()).toMatchObject({ writable: false, actions: [] });
    expect((await c.app.inject({ method: 'DELETE', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice') })).json().error).toBe('competition_finalized');
    const member = (await c.app.inject({ url: `/api/competitions/${c.id}/leaderboard`, headers: c.as('alice') })).json();
    const publicBoard = (await c.app.inject({ url: `/api/public/competitions/${c.id}/leaderboard` })).json();
    expect(member.individuals.map((row: { rank: number }) => row.rank)).toEqual([1, 2]);
    expect(publicBoard.individuals.map((row: { rank: number }) => row.rank)).toEqual([1, 2]);
  });
  it('人员分页游标解码也不包含账号 ID，跨页不重不漏', async () => {
    const c = await setup();
    for (const login of ['alice', 'bob', 'carol']) await c.signUp(c.id, login);
    const first = (await c.app.inject({ url: `/api/public/competitions/${c.id}/participants?limit=1` })).json();
    const decoded = Buffer.from(first.next_cursor, 'base64url').toString();
    for (const login of ['alice', 'bob', 'carol']) expect(decoded).not.toContain(c.accountId(login));
    const second = (await c.app.inject({ url: `/api/public/competitions/${c.id}/participants?limit=2&cursor=${first.next_cursor}` })).json();
    expect(new Set([...first.items, ...second.items].map(row => row.username)).size).toBe(3);
    expect(second.next_cursor).toBeNull();
  });
});

describe('首场演练有限矩阵', () => {
  it('P01 公开缓存预热后报名和取消立刻更新人员与人数', async () => {
    const c = await setup();
    const read = async () => (await c.app.inject({ url: `/api/public/competitions/${c.id}/participants` })).json().items;
    expect(await read()).toEqual([]);
    await c.signUp(c.id, 'alice');
    expect(await read()).toHaveLength(1);
    expect((await c.app.inject({ url: `/api/public/competitions/${c.id}/stats` })).json().participants).toBe(1);
    expect((await c.app.inject({ method: 'DELETE', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice') })).statusCode).toBe(200);
    expect(await read()).toEqual([]);
    expect((await c.app.inject({ url: `/api/public/competitions/${c.id}/stats` })).json().participants).toBe(0);
  });
  it.each([
    ['I01', 'visitor', 401], ['I02', 'registered', 403], ['I03', 'member', 200],
    ['I04', 'alumni', 403], ['I05', 'expired', 401], ['I06', 'disabled', 401],
    ['I07', 'alumni_allowed', 200], ['I08', 'membership_expired', 403],
  ] as const)('%s 身份 %s 报名响应 %i，无越权副作用', async (_id, kind, status) => {
    const c = await setup(); const headers = c.as('alice'); const account = c.accountId('alice');
    const db = c.app.services.storage.db;
    if (['registered', 'alumni', 'alumni_allowed'].includes(kind)) {
      db.prepare("UPDATE perm_members SET group_id = ? WHERE account_id = ? AND group_id = 'level.member'")
        .run(kind === 'registered' ? 'level.registered' : 'level.alumni', account);
      c.app.services.permissions.bump();
    }
    if (kind === 'alumni_allowed') grantPermNode(c.app, account, 'competition.signup');
    if (kind === 'expired') db.prepare('UPDATE sessions SET expires_at = ? WHERE openid = ?').run(Date.now() - 1, account);
    if (kind === 'disabled') db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(account);
    if (kind === 'membership_expired') {
      db.prepare('UPDATE perm_members SET expires_at = ? WHERE account_id = ?').run(Date.now() - 1, account);
      c.app.services.permissions.bump();
    }
    const response = await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers: kind === 'visitor' ? {} : headers, payload: {} });
    expect(response.statusCode).toBe(status);
    const roster = (await c.app.inject({ url: `/api/console/competitions/${c.id}/roster`, headers: c.as('owner') })).json();
    expect(roster.signups).toHaveLength(status === 200 ? 1 : 0);
  });

  it.each([
    ['T01', true, -1, 409, 'competition_planning'],
    ['T02', true, 0, 200, null],
    ['T03', false, -1, 200, null],
    ['T04', false, 1000, 200, null],
    ['T05', false, 1001, 409, 'signup_closed'],
    ['T06', false, 2000, 409, 'signup_closed'],
    ['T07', false, 2001, 409, 'signup_closed'],
  ] as const)('%s planning=%s 开始/截止/结束精确边界 offset=%i', async (_id, planning, offset, status, error) => {
    const c = await setup(); c.as('alice');
    const now = Date.now();
    expect((await c.app.inject({ method: 'PATCH', url: `/api/console/competitions/${c.id}`, headers: c.as('owner'),
      payload: { planning, start_at: now, signup_deadline: now + 1000, end_at: now + 2000 } })).statusCode).toBe(200);
    vi.spyOn(Date, 'now').mockReturnValue(now + offset);
    const result = await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice'), payload: {} });
    expect(result.statusCode).toBe(status);
    if (error) expect(result.json().error).toBe(error);
    expect((await c.my()).json().signup).toEqual(status === 200 ? expect.objectContaining({ status: 'active' }) : null);
  });

  it('T08 未开放报名，T09 截止等于结束时最后一毫秒允许、下一毫秒禁止；定榜只在结束后', async () => {
    const c = await setup(); const now = Date.now(); c.as('alice'); c.as('bob');
    const payload = { enabled: false, participation: 'individual', team_min: 1, team_max: 1, scoring: 'contribution' };
    await c.app.inject({ method: 'PUT', url: `/api/console/competitions/${c.id}/signup-settings`, headers: c.as('owner'), payload });
    expect((await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice'), payload: {} })).json().error).toBe('signup_not_enabled');
    await c.app.inject({ method: 'PUT', url: `/api/console/competitions/${c.id}/signup-settings`, headers: c.as('owner'), payload: { ...payload, enabled: true } });
    await c.app.inject({ method: 'PATCH', url: `/api/console/competitions/${c.id}`, headers: c.as('owner'),
      payload: { start_at: now - 1000, end_at: now, signup_deadline: now } });
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await c.signUp(c.id, 'alice');
    expect((await c.final()).json().error).toBe('not_ended');
    vi.mocked(Date.now).mockReturnValue(now + 1);
    expect((await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers: c.as('bob'), payload: {} })).json().error).toBe('signup_closed');
    expect((await c.final()).statusCode).toBe(201);
  });

  it('R01 本人报名不可指定他人，R02 个人赛拒绝建队，R03 错场记录不可撤销', async () => {
    const c = await setup();
    const bogus = await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers: c.as('alice'), payload: { account_id: c.accountId('bob') } });
    expect(bogus.statusCode).toBe(400); expect((await c.my()).json().state).toBe('none');
    await c.signUp(c.id, 'alice');
    expect((await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/teams`, headers: c.as('alice'), payload: { name: '不应出现' } })).json().error).toBe('individual_competition');
    const teams = await c.app.inject({ url: `/api/public/competitions/${c.id}/teams` });
    expect(teams.json()).toEqual({ enabled: false, team_min: 1, team_max: 1, teams: [] });
    const added = await c.addScore(c.id, { account_id: c.accountId('alice'), kind: 'issue', repo: 'geek/admin', number: 1, importance: 'normal', core: 'business' });
    const other = await c.createCompetition();
    expect((await c.app.inject({ method: 'POST', url: `/api/console/competitions/${other}/score-events/${added.json().event.id}/revoke`, headers: c.as('owner'), payload: { reason: '错场' } })).statusCode).toBe(404);
    expect((await c.events()).json().events[0].status).toBe('active');
  });

  it.each(['competition.manage', 'competition.score.review', 'competition.prize.redeem'] as const)('R04-%s 部门范围权限不能提升成全局比赛权限', async node => {
    const c = await setup(); grantPermNode(c.app, c.accountId('bob'), node, { department: 'dept.security' });
    const url = node === 'competition.manage' ? `/api/console/competitions/${c.id}/roster` : node === 'competition.score.review'
      ? `/api/console/competitions/${c.id}/score-events` : '/api/console/prizes/lookup';
    const res = await c.app.inject({ method: node === 'competition.prize.redeem' ? 'POST' : 'GET', url, headers: c.as('bob'),
      ...(node === 'competition.prize.redeem' ? { payload: { code: 'not-a-code' } } : {}) });
    expect(res.statusCode).toBe(403);
  });

  it('C01 并发报名只有一行，C02 并发记分只有一次，C03 并发定榜和核销各成功一次', async () => {
    const c = await setup(); const url = `/api/competitions/${c.id}/signup`;
    const joined = await Promise.all(Array.from({ length: 3 }, () => c.app.inject({ method: 'POST', url, headers: c.as('alice'), payload: {} })));
    expect(joined.map(row => row.statusCode)).toEqual([200, 200, 200]);
    const roster = (await c.app.inject({ url: `/api/console/competitions/${c.id}/roster`, headers: c.as('owner') })).json();
    expect(roster.signups).toHaveLength(1);
    const score = { account_id: c.accountId('alice'), kind: 'pr', repo: 'geek/admin', number: 1, importance: 'critical', core: 'core' };
    expect((await Promise.all([c.addScore(c.id, score), c.addScore(c.id, score)])).map(row => row.statusCode).sort()).toEqual([201, 409]);
    const rules = (await c.app.inject({ url: `/api/console/competitions/${c.id}/rules`, headers: c.as('owner') })).json();
    await c.app.inject({ method: 'PUT', url: `/api/console/competitions/${c.id}/rules`, headers: c.as('owner'),
      payload: { grade_factors: rules.grade_factors, gitlab_projects: [], prizes: [{ from: 1, to: 1, title: '合成奖励', amount_cny: 1 }] } });
    await c.endCompetition(c.id);
    expect((await Promise.all([c.final(), c.final()])).map(row => row.statusCode).sort()).toEqual([201, 409]);
    const code = (await c.app.inject({ url: '/api/me/competition-results', headers: c.as('alice') })).json().items[0].prize.code;
    expect((await c.app.inject({ url: '/api/me/competition-results', headers: c.as('bob') })).json().items).toEqual([]);
    const redeem = () => c.app.inject({ method: 'POST', url: '/api/console/prizes/redeem', headers: c.as('owner'), payload: { code } });
    expect((await Promise.all([redeem(), redeem()])).map(row => row.statusCode).sort()).toEqual([200, 409]);
    expect(activityRows(c.app, { action: 'competition.prize.redeem' }).filter(row => row.outcome === 'ok')).toHaveLength(1);
    expect((await c.app.inject({ method: 'DELETE', url: `/api/console/competitions/${c.id}/final`, headers: c.as('owner') })).json().error).toBe('prizes_redeemed');
  });

  it.each(['competition.score.add', 'competition.finalize', 'competition.prize.redeem'] as const)('A-%s 审计失败不能提交业务写入，重试恢复', async action => {
    const c = await setup(); await c.signUp(c.id, 'alice');
    const score = { account_id: c.accountId('alice'), kind: 'pr', repo: 'geek/admin', number: 1, importance: 'important', core: 'business' };
    if (action === 'competition.score.add') {
      c.blockAudit(action);
      expect((await c.addScore(c.id, score)).statusCode).toBe(500);
      expect((await c.events()).json().events).toEqual([]);
      c.unblockAudit(); expect((await c.addScore(c.id, score)).statusCode).toBe(201);
      return;
    }
    await c.addScore(c.id, score);
    const rules = (await c.app.inject({ url: `/api/console/competitions/${c.id}/rules`, headers: c.as('owner') })).json();
    await c.app.inject({ method: 'PUT', url: `/api/console/competitions/${c.id}/rules`, headers: c.as('owner'),
      payload: { grade_factors: rules.grade_factors, gitlab_projects: [], prizes: [{ from: 1, to: 1, title: '合成奖励', amount_cny: 1 }] } });
    await c.endCompetition(c.id);
    if (action === 'competition.finalize') {
      c.blockAudit(action); expect((await c.final()).statusCode).toBe(500);
      expect((await c.app.inject({ url: '/api/me/competition-results', headers: c.as('alice') })).json().items).toEqual([]);
      c.unblockAudit(); expect((await c.final()).statusCode).toBe(201);
    } else {
      await c.final();
      const code = (await c.app.inject({ url: '/api/me/competition-results', headers: c.as('alice') })).json().items[0].prize.code;
      c.blockAudit(action);
      const redeem = () => c.app.inject({ method: 'POST', url: '/api/console/prizes/redeem', headers: c.as('owner'), payload: { code } });
      expect((await redeem()).statusCode).toBe(500);
      expect((await c.app.inject({ method: 'POST', url: '/api/console/prizes/lookup', headers: c.as('owner'), payload: { code } })).json().prize.redeemed_at).toBeNull();
      c.unblockAudit(); expect((await redeem()).statusCode).toBe(200);
    }
  });
});
