// GitLab 贡献收集与「有用」标记（#278，CONTRACT-278 §4，所有者 2026-10-24 13:45）：
// 只有标记「有用」的才加分；标签要由有 competition.score.review 的人加、不能是作者本人；标签拿掉时撤销经标签加的分；
// 控制台「标记有用」与驳回；重复收集不产生重复行。GitLab 用注入的 gitlabFetch 模拟，不连外网。
import { afterEach, describe, expect, it } from 'vitest';
import { activityRows, grantPermNode } from './helpers';
import { contestSetup, HOUR, type ContestContext } from './contest-fixtures';

const GITLAB = 'https://git.example.test';
const ENV = { GITLAB_SYNC: 'on', GITLAB_URL: GITLAB, GITLAB_API_TOKEN: 'test-gitlab-token', GITLAB_GROUP: 'geek' };
const GITLAB_IDS: Record<string, number> = { alice: 1001, bob: 1002, carol: 1003, dave: 1004 };

type Item = Record<string, unknown>;
type LabelEvent = { id: number; action: 'add' | 'remove'; user: { id: number; username: string }; created_at: string; label: { name: string } };

/** 一个只认比赛收集会发的那几个 GET 的假 GitLab。 */
function fakeGitlab() {
  const mrs: Item[] = [];
  const issues: Item[] = [];
  const diffs = new Map<number, { diff: string; new_path: string; too_large?: boolean }[]>();
  const labelEvents = new Map<string, LabelEvent[]>();
  const closedBy = new Map<number, Item[]>();
  const calls: string[] = [];
  const json = (status: number, data: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
  async function fetch(input: string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(input);
    expect(url.origin).toBe(GITLAB);
    expect(init.method ?? 'GET').toBe('GET');
    expect((init.headers as Record<string, string>)['PRIVATE-TOKEN']).toBe('test-gitlab-token');
    expect(init.redirect).toBe('error');
    const path = url.pathname.replace(/^\/api\/v4/, '');
    calls.push(`${path}${url.search}`);
    const project = '/projects/geek%2Fadmin';
    if (path === `${project}/merge_requests`) {
      expect(url.searchParams.get('state')).toBe('merged');
      return json(200, url.searchParams.get('page') === '1' ? mrs : []);
    }
    if (path === `${project}/issues`) return json(200, url.searchParams.get('page') === '1' ? issues : []);
    let match = /^\/projects\/geek%2Fadmin\/merge_requests\/(\d+)\/diffs$/.exec(path);
    if (match) return json(200, diffs.get(Number(match[1])) ?? []);
    match = /^\/projects\/geek%2Fadmin\/(merge_requests|issues)\/(\d+)\/resource_label_events$/.exec(path);
    if (match) return json(200, labelEvents.get(`${match[1]}:${match[2]}`) ?? []);
    match = /^\/projects\/geek%2Fadmin\/issues\/(\d+)\/closed_by$/.exec(path);
    if (match) return json(200, closedBy.get(Number(match[1])) ?? []);
    return json(404, { message: '404 Not Found' });
  }
  return { fetch, mrs, issues, diffs, labelEvents, closedBy, calls };
}

const contexts: ContestContext[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

async function setup() {
  const gitlab = fakeGitlab();
  const context = await contestSetup({ gitlabFetch: gitlab.fetch }, ENV);
  contexts.push(context);
  const { app, as, accountId, createCompetition, signUp } = context;
  const id = await createCompetition();
  for (const login of ['alice', 'carol']) await signUp(id, login);
  const rules = (await app.inject({ url: `/api/console/competitions/${id}/rules`, headers: as('owner') })).json();
  const saved = await app.inject({ method: 'PUT', url: `/api/console/competitions/${id}/rules`, headers: as('owner'), payload: { grade_factors: rules.grade_factors, prizes: [], gitlab_projects: ['geek/admin'] } });
  expect(saved.statusCode).toBe(200);
  const now = Date.now();
  for (const [login, gitlabId] of Object.entries(GITLAB_IDS)) {
    app.services.storage.db.prepare("INSERT INTO gitlab_accounts(account_id, gitlab_user_id, username, state, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)")
      .run(accountId(login), gitlabId, login, now, now);
  }
  grantPermNode(app, accountId('bob'), 'competition.score.review');
  const recent = new Date(now - HOUR / 2).toISOString();
  const author = (login: string) => ({ id: GITLAB_IDS[login] ?? 1099, username: login });
  const mr = (iid: number, login: string, labels: string[], mergedAt = recent) =>
    ({ iid, title: `MR ${iid}`, web_url: `${GITLAB}/geek/admin/-/merge_requests/${iid}`, author: author(login), labels, merged_at: mergedAt, state: 'merged' });
  const labelAdd = (key: string, login: string, action: 'add' | 'remove' = 'add', at = recent, eventId = 1) => {
    const list = gitlab.labelEvents.get(key) ?? [];
    list.push({ id: eventId, action, user: { id: GITLAB_IDS[login], username: login }, created_at: at, label: { name: '有用' } });
    gitlab.labelEvents.set(key, list);
  };
  const collect = async (login = 'bob') => {
    const res = await app.inject({ method: 'POST', url: `/api/console/competitions/${id}/candidates/collect`, headers: as(login) });
    expect(res.statusCode).toBe(200);
    return res.json().last_run;
  };
  const list = async (status?: string) =>
    (await app.inject({ url: `/api/console/competitions/${id}/candidates${status ? `?status=${status}` : ''}`, headers: as('bob') })).json();
  const scoreOf = async (login: string) => {
    const board = (await app.inject({ url: `/api/competitions/${id}/leaderboard`, headers: as('alice') })).json();
    return board.individuals.find((row: { person: { account_id: string } }) => row.person.account_id === accountId(login)).points as number;
  };
  return { ...context, gitlab, id, mr, labelAdd, collect, list, scoreOf, recent };
}

describe('收集候选贡献', () => {
  it('只收时间窗内、已报名作者的 MR 与合格 Issue，按改动行数和 size 标签给建议分；重复收集不产生重复行', async () => {
    const { app, gitlab, id, mr, collect, list } = await setup();
    const lines = (n: number) => Array.from({ length: n }, (_, k) => `+line ${k}`).join('\n');
    gitlab.mrs.push(mr(1, 'alice', []), mr(2, 'carol', []), mr(3, 'erin', []), mr(4, 'alice', [], new Date(Date.now() - 48 * HOUR).toISOString()));
    gitlab.diffs.set(1, [{ diff: `--- a/x\n+++ b/x\n${lines(60)}`, new_path: 'src/x.ts' }, { diff: lines(5000), new_path: 'pnpm-lock.yaml' }]);
    gitlab.diffs.set(2, [{ diff: lines(10), new_path: 'README.md' }]);
    gitlab.issues.push(
      { iid: 10, title: 'Issue 10', web_url: `${GITLAB}/geek/admin/-/issues/10`, author: { id: 1003 }, labels: ['size::l'], created_at: new Date().toISOString(), state: 'closed', merge_requests_count: 1 },
      { iid: 11, title: 'Issue 11', web_url: `${GITLAB}/geek/admin/-/issues/11`, author: { id: 1001 }, labels: [], created_at: new Date().toISOString(), state: 'opened', merge_requests_count: 0 },
    );
    gitlab.closedBy.set(10, [{ iid: 2, state: 'merged' }]);

    const first = await collect();
    expect(first).toMatchObject({ fetched: 4, created: 3, skipped: 1, accepted: 0, error: null });
    const page = await list();
    expect(page.counts).toEqual({ pending: 3, accepted: 0, rejected: 0 });
    const byIid = Object.fromEntries(page.items.map((item: { kind: string; gitlab_iid: number }) => [`${item.kind}${item.gitlab_iid}`, item]));
    expect(byIid.pr1).toMatchObject({ size_hint: 60, suggested: 30, url: `${GITLAB}/geek/admin/-/merge_requests/1`, status: 'pending' });
    expect(byIid.pr2).toMatchObject({ size_hint: 10, suggested: 15 });
    expect(byIid.issue10).toMatchObject({ suggested: 20 });
    expect(page.items[0].account).toEqual({ account_id: expect.any(String), username: expect.any(String), display_name: expect.any(String), avatar_url: null });
    expect(page.last_run).toMatchObject({ created: 3 });

    const again = await collect();
    expect(again).toMatchObject({ created: 0, fetched: 4 });
    expect((app.services.storage.db.prepare('SELECT COUNT(*) AS n FROM competition_score_candidates WHERE competition_id = ?').get(id) as { n: number }).n).toBe(3);
    // 已有候选不再取 diff
    expect(gitlab.calls.filter(call => call.includes('/merge_requests/1/diffs'))).toHaveLength(1);
  });

  it('GitLab 同步关着时不收集；概览的 candidates_pending 是真实的待确认数', async () => {
    const { app, as, gitlab, mr, collect, id } = await setup();
    gitlab.mrs.push(mr(1, 'alice', []));
    await collect();
    const summary = (await app.inject({ url: '/api/console/summary', headers: as('bob') })).json();
    expect(summary.candidates_pending).toBe(1);
    await app.services.gitlab.applySettings({ mode: 'off' });
    const off = await app.inject({ method: 'POST', url: `/api/console/competitions/${id}/candidates/collect`, headers: as('bob') });
    expect(off.json().error).toBe('gitlab_sync_off');
  });
});

describe('「有用」标签', () => {
  it('有审核权限的人加的标签自动按建议分加分；没有权限的人或作者自己加的不算，留在待确认并写明原因', async () => {
    const { app, gitlab, mr, labelAdd, collect, list, scoreOf, accountId, id } = await setup();
    gitlab.mrs.push(mr(1, 'alice', ['有用']), mr(2, 'alice', ['有用']), mr(3, 'carol', ['有用']));
    gitlab.diffs.set(1, [{ diff: Array.from({ length: 60 }, () => '+x').join('\n'), new_path: 'a.ts' }]);
    labelAdd('merge_requests:1', 'bob');
    labelAdd('merge_requests:2', 'dave');
    labelAdd('merge_requests:3', 'carol');
    const run = await collect();
    expect(run).toMatchObject({ created: 3, accepted: 1 });
    const items = (await list()).items as { gitlab_iid: number; status: string; accepted_via: string | null; note: string | null; final_points: number | null; reviewed_by: { account_id: string } | null }[];
    const one = items.find(item => item.gitlab_iid === 1)!;
    expect(one).toMatchObject({ status: 'accepted', accepted_via: 'label', final_points: 30, note: null });
    expect(one.reviewed_by?.account_id).toBe(accountId('bob'));
    expect(items.find(item => item.gitlab_iid === 2)).toMatchObject({ status: 'pending', note: expect.stringContaining('没有审核积分的权限') });
    expect(items.find(item => item.gitlab_iid === 3)).toMatchObject({ status: 'pending', note: '「有用」标签是作者自己加的，未计分' });
    expect(await scoreOf('alice')).toBe(30);
    expect(activityRows(app, { action: 'competition.candidate.accept' })[0]).toMatchObject({ surface: 'system', account_id: accountId('bob'), meta: { via: 'label', points: 30 } });
    const event = app.services.storage.db.prepare("SELECT created_by, repo, number, kind FROM competition_score_events WHERE status = 'active'").get();
    expect(event).toEqual({ created_by: accountId('bob'), repo: 'geek/admin', number: 1, kind: 'pr' });
    // 公开动态里带上 GitLab 的标题与链接
    const feed = (await app.inject({ url: `/api/public/competitions/${id}/feed` })).json();
    expect(feed.items[0]).toMatchObject({ kind: 'pr', title: 'MR 1', url: `${GITLAB}/geek/admin/-/merge_requests/1`, points: 30 });
  });

  it('标签被拿掉：经标签加的分撤销、候选回到待确认；控制台确认的不受影响', async () => {
    const { app, gitlab, mr, labelAdd, collect, list, scoreOf, recent } = await setup();
    gitlab.mrs.push(mr(1, 'alice', ['有用']));
    labelAdd('merge_requests:1', 'bob');
    await collect();
    expect(await scoreOf('alice')).toBe(15);
    gitlab.mrs[0].labels = [];
    labelAdd('merge_requests:1', 'bob', 'remove', new Date(Date.parse(recent) + 60_000).toISOString(), 2);
    const run = await collect();
    expect(run.revoked).toBe(1);
    expect(await scoreOf('alice')).toBe(0);
    const pending = (await list('pending')).items[0];
    expect(pending).toMatchObject({ status: 'pending', accepted_via: null, note: '「有用」标签被移除，经标签加的分已撤销' });
    expect(app.services.storage.db.prepare("SELECT status, revoke_reason FROM competition_score_events").get()).toEqual({ status: 'revoked', revoke_reason: 'GitLab 上的「有用」标签被移除' });
    expect(activityRows(app, { action: 'competition.candidate.label_removed' })).toHaveLength(1);
  });
});

describe('控制台标记有用与驳回', () => {
  it('要 competition.score.review 与 step-up，不能审自己的；分数默认建议分、可改但要在区间内；驳回会撤销已加的分', async () => {
    const { app, as, gitlab, mr, collect, list, scoreOf, makeStale, accountId, id } = await setup();
    gitlab.mrs.push(mr(1, 'alice', []), mr(2, 'carol', []));
    await collect();
    const items = (await list()).items as { id: string; gitlab_iid: number }[];
    const mine = items.find(item => item.gitlab_iid === 1)!.id;
    const carols = items.find(item => item.gitlab_iid === 2)!.id;
    const accept = (candidate: string, login: string, payload: Record<string, unknown> = {}) =>
      app.inject({ method: 'POST', url: `/api/console/competitions/${id}/candidates/${candidate}/accept`, headers: as(login), payload });
    expect((await accept(mine, 'alice')).json()).toMatchObject({ error: 'forbidden', node: 'competition.score.review' });
    grantPermNode(app, accountId('alice'), 'competition.score.review');
    expect((await accept(mine, 'alice')).json().error).toBe('self_review');
    expect((await accept(carols, 'alice', { points: 200 })).statusCode).toBe(400);
    expect((await accept(carols, 'alice', { points: 10 })).json().error).toBe('bad_points');
    const accepted = await accept(carols, 'alice', { points: 60, reason: '修了登录页的竞态' });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().candidate).toMatchObject({ status: 'accepted', accepted_via: 'console', final_points: 60, reason: '修了登录页的竞态' });
    expect(await scoreOf('carol')).toBe(60);
    expect((await accept(carols, 'alice')).json().error).toBe('already_accepted');
    expect(activityRows(app, { action: 'competition.candidate.accept' }).filter(row => row.outcome === 'ok')[0]).toMatchObject({ surface: 'console', meta: { via: 'console', points: 60 } });

    const reject = (candidate: string, login: string, reason = '和已有的重复') =>
      app.inject({ method: 'POST', url: `/api/console/competitions/${id}/candidates/${candidate}/reject`, headers: as(login), payload: { reason } });
    makeStale('bob');
    expect((await reject(carols, 'bob')).json().error).toBe('step_up_required');
    const rejected = await reject(carols, 'alice');
    expect(rejected.json().candidate).toMatchObject({ status: 'rejected', reason: '和已有的重复', final_points: null });
    expect(await scoreOf('carol')).toBe(0);
    // 积分记录页上撤销一条来自候选的积分，候选也变成驳回
    expect((await accept(carols, 'owner')).statusCode).toBe(200);
    const event = app.services.storage.db.prepare("SELECT id FROM competition_score_events WHERE status = 'active'").get() as { id: string };
    await app.inject({ method: 'POST', url: `/api/console/competitions/${id}/score-events/${event.id}/revoke`, headers: as('owner'), payload: { reason: '误判' } });
    expect((await list('rejected')).items.find((item: { id: string }) => item.id === carols)).toMatchObject({ status: 'rejected', reason: '误判' });
  });
});
