// #278 比赛官网、公开接口、贡献收集、定榜与兑奖几组测试共用的夹具：一场开了报名与积分的内部赛，
// 站长 owner（title.site.owner，什么权限都有）和 alice、bob、carol、dave 四个成员。
import type { FastifyInstance } from 'fastify';
import { expect } from 'vitest';
import { writeZip, type SiteFile } from '../../app/server/src/lib/site-package';
import type { ServiceOverrides } from '../../app/server/src/services';
import { grantPermGroup, signIn, testApp } from './helpers';

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;
export const USERS: Record<string, number> = { owner: 201, alice: 202, bob: 203, carol: 204, dave: 205, erin: 206 };

export type ContestContext = Awaited<ReturnType<typeof contestSetup>>;

export async function contestSetup(overrides: ServiceOverrides = {}, env: Record<string, string> = {}) {
  const context = await testApp(overrides, false, env);
  const { app } = context;
  const sessions = new Map<string, string>();
  const as = (login: string) => {
    if (!sessions.has(login)) {
      const sid = signIn(app, login, USERS[login], null);
      sessions.set(login, sid);
      const accountId = app.services.auth.getSession(sid)!.account_id;
      app.services.identity.setSiteRole({ accountId, role: login === 'owner' ? 'admin' : 'member', actor: 'system' });
      // signIn() 按 #280 给新账号填了大二；比赛用例从「没填年级、系数 1」起步，要年级的用 setEnrollment 自己写
      app.services.storage.db.prepare('UPDATE account_profiles SET enrollment_year = NULL WHERE account_id = ?').run(accountId);
    }
    return { cookie: `sid=${sessions.get(login)!}` };
  };
  const accountId = (login: string) => {
    as(login);
    return app.services.auth.getSession(sessions.get(login)!)!.account_id;
  };
  grantPermGroup(app, accountId('owner'), 'title.site.owner');

  /** 会话签发时间拨回 20 分钟前：控制台写操作的 step-up 不再满足。 */
  const makeStale = (login: string) => {
    as(login);
    app.services.storage.db.prepare('UPDATE sessions SET created_at = ? WHERE login = ?').run(Date.now() - 20 * 60_000, login);
  };

  /** 一场开了报名、组队与积分的比赛（内部赛默认），返回 id。 */
  const createCompetition = async (fields: Record<string, unknown> = {}) => {
    const now = Date.now();
    const created = await app.inject({
      method: 'POST', url: '/api/console/competitions', headers: as('owner'),
      payload: { name: '开源赛', kind: 'internal', start_at: now - HOUR, end_at: now + 30 * DAY, signup_deadline: now + 7 * DAY, url: null, description: '', ...fields },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().competition.id as string;
    const configured = await app.inject({
      method: 'PUT', url: `/api/console/competitions/${id}/signup-settings`, headers: as('owner'),
      payload: { enabled: true, participation: 'team', team_min: 1, team_max: 3, scoring: 'contribution' },
    });
    expect(configured.statusCode).toBe(200);
    return id;
  };
  const signUp = async (id: string, login: string) => {
    const res = await app.inject({ method: 'POST', url: `/api/competitions/${id}/signup`, headers: as(login), payload: {} });
    expect(res.statusCode).toBe(200);
  };
  const addScore = (id: string, payload: Record<string, unknown>, login = 'owner') =>
    app.inject({ method: 'POST', url: `/api/console/competitions/${id}/score-events`, headers: as(login), payload });
  /** 把比赛挪到已经结束（定榜要在结束后）。 */
  const endCompetition = async (id: string) => {
    const now = Date.now();
    const res = await app.inject({
      method: 'PATCH', url: `/api/console/competitions/${id}`, headers: as('owner'),
      payload: { start_at: now - 10 * DAY, end_at: now - HOUR, signup_deadline: now - 2 * HOUR },
    });
    expect(res.statusCode).toBe(200);
  };
  /** 直接写入学年份（#280 的列，测试可以直接写）。 */
  const setEnrollment = (login: string, year: number | null) => {
    app.services.profiles.get(accountId(login)); // 资料行按需建，先确保有
    app.services.storage.db.prepare('UPDATE account_profiles SET enrollment_year = ? WHERE account_id = ?').run(year, accountId(login));
  };

  return { ...context, app, as, accountId, makeStale, createCompetition, signUp, addScore, endCompetition, setEnrollment };
}

/** 一个最小的合规站点包；`extra` 覆盖或追加文件，`manifest` 覆盖清单字段。 */
export function sitePackage(extra: SiteFile[] = [], manifest: Record<string, unknown> = {}): Buffer {
  const files: SiteFile[] = [
    { path: 'index.html', data: Buffer.from('<!doctype html><title>oss</title><script type="module" src="./assets/app.js"></script>') },
    { path: 'assets/app.js', data: Buffer.from('console.log("hi")') },
    { path: 'yzgc-site.json', data: Buffer.from(JSON.stringify({ name: '第一期官网', version: '1.0.0', sdk: 'competition/v1', ...manifest })) },
  ];
  for (const file of extra) {
    const at = files.findIndex(item => item.path === file.path);
    if (at >= 0) files[at] = file; else files.push(file);
  }
  return writeZip(files);
}

export const upload = (app: FastifyInstance, id: string, zip: Buffer, headers: Record<string, string>) =>
  app.inject({ method: 'POST', url: `/api/console/competitions/${id}/site/versions`, headers: { ...headers, 'content-type': 'application/zip' }, payload: zip });
