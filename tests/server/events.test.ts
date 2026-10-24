import { afterEach, describe, expect, it } from 'vitest';
import { accountIdOf, grantPermNode, signIn, testApp } from './helpers';

/**
 * POST /api/events（CONTRACT-274 §4，SPEC §3.7）：前端批量上报白名单动作，访客也能调；
 * 非白名单动作直接丢弃，合并计一条 events.rejected。lib/activity.ts 的 pruneExpired()（保留策略）单独测。
 */
const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close(); });

async function setup() {
  const context = await testApp();
  contexts.push(context);
  // 一个全新的库启动时，迁移会把首次回填账号系统写的 identity.backfill 审计复制进 activity_events（见
  // lib/migrations/2026-10-yugc-v2.ts 步骤 7），和这里测试要插入的记录无关，先清掉以免干扰计数断言。
  context.app.services.storage.db.prepare("DELETE FROM activity_events WHERE action = 'identity.backfill'").run();
  return context;
}

function activityRows(db: import('better-sqlite3').Database) {
  return db.prepare('SELECT account_id, visitor_id, surface, action, outcome, meta FROM activity_events ORDER BY id').all() as
    { account_id: string | null; visitor_id: string | null; surface: string; action: string; outcome: string; meta: string }[];
}

describe('POST /api/events（访客也能调）', () => {
  it('接受白名单动作，按访客编号记录；第一次调用顺手发一个 yugc_vid cookie（middleware/visitor.ts），之后复用同一个', async () => {
    const { app } = await setup();
    const first = await app.inject({ method: 'POST', url: '/api/events', payload: { events: [{ action: 'os.boot.played' }] } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ accepted: 1, rejected: 0 });
    const cookie = ([] as string[]).concat(first.headers['set-cookie'] as string[] | string).find(c => c.startsWith('yugc_vid='))!;
    const visitorId = cookie.split(';')[0].slice('yugc_vid='.length);
    expect(visitorId).toMatch(/^[0-9a-f-]{36}$/);

    const rows = activityRows(app.services.storage.db);
    expect(rows).toEqual([{ account_id: null, visitor_id: visitorId, surface: 'portal', action: 'os.boot.played', outcome: 'ok', meta: '{}' }]);

    // 再调一次，带上第一次发的 cookie：访客编号不变，不会每次都发一个新的
    const second = await app.inject({ method: 'POST', url: '/api/events', headers: { cookie: `yugc_vid=${visitorId}` }, payload: { events: [{ action: 'page.view', target_type: 'page', target_id: '/forum' }] } });
    expect(second.statusCode).toBe(200);
    expect(([] as string[]).concat((second.headers['set-cookie'] as string[] | string | undefined) ?? []).some(c => c.startsWith('yugc_vid='))).toBe(false);
    const after = activityRows(app.services.storage.db);
    expect(after[1]).toMatchObject({ visitor_id: visitorId, action: 'page.view' });
  });

  it('登录的人按账号记录，不记访客编号', async () => {
    const { app } = await setup();
    const sid = signIn(app, 'alice', 101);
    const response = await app.inject({ method: 'POST', url: '/api/events', headers: { cookie: `sid=${sid}` }, payload: { events: [{ action: 'page.view', target_type: 'page', target_id: '/forum' }] } });
    expect(response.statusCode).toBe(200);
    const accountId = accountIdOf(app, 'alice');
    expect(activityRows(app.services.storage.db)).toEqual([{ account_id: accountId, visitor_id: null, surface: 'portal', action: 'page.view', outcome: 'ok', meta: '{}' }]);
  });

  it('不在白名单里的动作直接丢弃，合并计一条 events.rejected，不逐条记垃圾数据', async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { events: [{ action: 'os.boot.played' }, { action: 'evil.script' }, { action: 'another.unknown' }] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accepted: 1, rejected: 2 });
    const rows = activityRows(app.services.storage.db);
    expect(rows.map(row => row.action)).toEqual(['os.boot.played', 'events.rejected']);
    const rejectedRow = rows.find(row => row.action === 'events.rejected')!;
    expect(rejectedRow.outcome).toBe('denied');
    expect(JSON.parse(rejectedRow.meta)).toEqual({ count: 2, actions: ['evil.script', 'another.unknown'] });
  });

  it('论坛、控制台各自上报各自的白名单，互不混用（#274：surface 不传按门户算）', async () => {
    const { app } = await setup();
    const forum = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { surface: 'forum', events: [{ action: 'forum.theme.change', meta: { theme: 'dark' } }, { action: 'forum.sticker.use', target_type: 'sticker', target_id: 'cat_wave' }, { action: 'os.boot.played' }] },
    });
    expect(forum.statusCode).toBe(200);
    expect(forum.json()).toEqual({ accepted: 2, rejected: 1 }); // os.boot.played 不在论坛名单里，被丢弃
    const console_ = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { surface: 'console', events: [{ action: 'page.view', target_type: 'route', target_id: 'activity' }, { action: 'forum.theme.change' }] },
    });
    expect(console_.statusCode).toBe(200);
    expect(console_.json()).toEqual({ accepted: 1, rejected: 1 }); // forum.theme.change 不在控制台名单里
    const rows = activityRows(app.services.storage.db);
    expect(rows.filter(row => row.outcome === 'ok').map(row => ({ surface: row.surface, action: row.action }))).toEqual([
      { surface: 'forum', action: 'forum.theme.change' }, { surface: 'forum', action: 'forum.sticker.use' }, { surface: 'console', action: 'page.view' },
    ]);
  });

  it('不认识的 surface 按契约拒绝', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'POST', url: '/api/events', payload: { surface: 'cli', events: [{ action: 'page.view' }] } });
    expect(response.statusCode).toBe(400);
  });

  it('批次最多 20 条、必须至少 1 条、动作名之外的字段按契约拒绝', async () => {
    const { app } = await setup();
    const tooMany = await app.inject({ method: 'POST', url: '/api/events', payload: { events: Array.from({ length: 21 }, () => ({ action: 'page.view' })) } });
    expect(tooMany.statusCode).toBe(400);
    const empty = await app.inject({ method: 'POST', url: '/api/events', payload: { events: [] } });
    expect(empty.statusCode).toBe(400);
    const extraField = await app.inject({ method: 'POST', url: '/api/events', payload: { events: [{ action: 'page.view', nonsense: true }] } });
    expect(extraField.statusCode).toBe(400);
  });

  it('按访客或账号限流 30 次每分钟', async () => {
    const { app } = await setup();
    const hit = () => app.inject({ method: 'POST', url: '/api/events', headers: { cookie: 'yugc_vid=11111111-1111-1111-1111-111111111111' }, payload: { events: [{ action: 'page.view' }] } });
    for (let i = 0; i < 30; i++) expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(429);
  });

  it('同一个 IP 换着造新的访客 cookie 绕不开限流（#274 残留修复 K.2：限流键拼了 IP 哈希，不是只看访客 cookie）', async () => {
    const { app } = await setup();
    // 每次都是一个全新、格式合法的访客 cookie（没有真的调过 /api/events 发过这个 cookie），但 remoteAddress 不变：
    // 如果限流只按访客 cookie 算，这 31 次会被当成 31 个不同的人，全部放行；按 IP 哈希算，额度是共享的。
    const hit = (i: number) => app.inject({
      method: 'POST', url: '/api/events', remoteAddress: '198.51.100.77',
      headers: { cookie: `yugc_vid=${String(i).padStart(8, '0')}-0000-4000-8000-000000000000` },
      payload: { events: [{ action: 'page.view' }] },
    });
    for (let i = 0; i < 30; i++) expect((await hit(i)).statusCode).toBe(200);
    expect((await hit(30)).statusCode).toBe(429);
  });

  it('meta 序列化之后超过 2KB 的事件按拒绝处理，不落一条白名单记录（#274 残留修复 K.2）', async () => {
    const { app } = await setup();
    const hugeMeta = { blob: 'x'.repeat(3000) };
    const response = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { events: [{ action: 'os.boot.played' }, { action: 'page.view', meta: hugeMeta }] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ accepted: 1, rejected: 1 });
    const rows = activityRows(app.services.storage.db);
    expect(rows.map(row => row.action)).toEqual(['os.boot.played', 'events.rejected']);
    expect(JSON.parse(rows[1].meta)).toEqual({ count: 1, actions: ['page.view'] });
  });
});

describe('lib/activity.ts 的保留策略（SPEC §3.7：IP 存 90 天，记录存 180 天）', () => {
  it('pruneExpired 删掉 180 天前的记录，180 天内但超过 90 天的只清掉 IP', async () => {
    const start = Date.UTC(2026, 5, 1);
    let now = start;
    const { app } = await testApp({ clock: () => now }).then(async context => { contexts.push(context); return context; });
    const db = app.services.storage.db;
    db.prepare("DELETE FROM activity_events WHERE action = 'identity.backfill'").run();
    const insert = (atDaysAgo: number, action: string) => db.prepare(`
      INSERT INTO activity_events(at, account_id, visitor_id, surface, action, target_type, target_id, outcome, ip, ua, request_id, meta)
      VALUES (?, NULL, 'v1', 'portal', ?, NULL, NULL, 'ok', '203.0.113.9', NULL, NULL, '{}')
    `).run(start - atDaysAgo * 24 * 60 * 60 * 1000, action);
    insert(1, 'recent');
    insert(100, 'ip_should_be_cleared');
    insert(200, 'should_be_deleted');

    const result = app.services.activity.pruneExpired(start);
    expect(result).toEqual({ deleted: 1, ipMasked: 1 });
    const left = db.prepare('SELECT action, ip FROM activity_events ORDER BY id').all() as { action: string; ip: string | null }[];
    expect(left).toEqual([{ action: 'recent', ip: '203.0.113.9' }, { action: 'ip_should_be_cleared', ip: null }]);
  });
});

describe('lib/limits.ts 的 pruneAll（SPEC §3.8：limit_events 按桶各自的留存时长清理）', () => {
  it('只清掉登记过的桶里早于留存期的行，按桶各自的时长判断，没登记的桶原样留着', async () => {
    const start = Date.UTC(2026, 5, 1);
    const { app } = await testApp({ clock: () => start }).then(async context => { contexts.push(context); return context; });
    const db = app.services.storage.db;
    const insert = (bucket: string, ageMs: number) => db.prepare('INSERT INTO limit_events(bucket, subject, at) VALUES (?, ?, ?)').run(bucket, 's', start - ageMs);
    insert('apply.daily', 1 * 24 * 60 * 60 * 1000); // 1 天前，留存 2 天，留着
    insert('apply.daily', 3 * 24 * 60 * 60 * 1000); // 3 天前，超过留存，删
    insert('forum.topic.hourly', 30 * 60 * 1000); // 半小时前，留存 2 小时，留着
    insert('forum.topic.hourly', 3 * 60 * 60 * 1000); // 3 小时前，超过留存，删
    insert('some.unregistered.bucket', 365 * 24 * 60 * 60 * 1000); // 没登记在 BUCKET_RETENTION_MS 里，不碰

    const deleted = app.services.limits.pruneAll(start);
    expect(deleted).toBe(2);
    const left = db.prepare('SELECT bucket, at FROM limit_events ORDER BY bucket, at').all() as { bucket: string; at: number }[];
    expect(left.map(row => row.bucket)).toEqual(['apply.daily', 'forum.topic.hourly', 'some.unregistered.bucket']);
  });
});
