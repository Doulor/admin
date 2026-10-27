// #276 的身份集成哨兵：失败交 #271 统一身份实现修复，不在比赛模块复制身份判定。
import { afterEach, expect, it, vi } from 'vitest';
import { contestSetup, type ContestContext } from './contest-fixtures';

const contexts: ContestContext[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const c of contexts.splice(0)) await c.close();
});
async function setup() {
  const c = await contestSetup({ clock: () => Date.now() });
  contexts.push(c);
  const id = await c.createCompetition();
  return { ...c, id };
}

it('I09 会话 expires_at 精确时刻已失效，不能报名', async () => {
  const c = await setup();
  const headers = c.as('alice');
  const now = Date.now();
  c.app.services.storage.db.prepare('UPDATE sessions SET expires_at = ? WHERE login = ?').run(now, 'alice');
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const res = await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers, payload: {} });
  expect(res.statusCode).toBe(401);
});

it('I10 预热权限缓存后成员组到期，不得继续报名', async () => {
  const c = await setup();
  const headers = c.as('alice'), now = Date.now();
  c.app.services.storage.db.prepare("UPDATE perm_members SET expires_at = ? WHERE account_id = ? AND group_id = 'level.member'")
    .run(now + 1000, c.accountId('alice'));
  c.app.services.permissions.bump();
  expect((await c.app.inject({ url: `/api/competitions/${c.id}/my-status`, headers })).statusCode).toBe(200);
  vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
  const res = await c.app.inject({ method: 'POST', url: `/api/competitions/${c.id}/signup`, headers, payload: {} });
  expect(res.statusCode).toBe(403);
});
