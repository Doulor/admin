import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../app/server/src/lib/db";
import {
  createPermissionEngine, entriesForAccount, evaluate, metaValueFromEntries, setExclusiveGroupMembership,
  type PermEntryLike, type Scope,
} from "../../app/server/src/lib/permissions";

/**
 * 权限引擎（#274 SPEC §3.5）。向量部分直接搬自 ibuki-next 的 `permission-vectors.json`（去掉它
 * NAS 子树隔离的 5 条用例——那是它应用特有的保护，SPEC 没有对应需求），按 SPEC §3.5 第 6 条
 * 另加了继承、meta 取值和过期三类用例，放在向量文件末尾（yugc- 前缀）。
 * 继承、meta、DB 层过期这三类天然需要组/权重概念，向量的 explain/evaluate 纯函数格式装不下，
 * 放在下面用真实（内存）数据库测，而不是塞进向量 JSON。
 */

type Vector = { name: string; entries: (PermEntryLike & { expires_in?: number })[]; request: { node: string; scope: Scope }; expect: boolean };
const vectors: Vector[] = JSON.parse(readFileSync(new URL("../../app/server/test/fixtures/permission-vectors.json", import.meta.url), "utf8"));

describe("权限向量（explain/evaluate 纯函数）", () => {
  for (const vector of vectors) {
    it(vector.name, () => {
      // SPEC §3.5 第 3 条：过期的条目在读取时就过滤掉，纯函数本身不知道「现在」是什么时候。
      const live = vector.entries.filter(entry => entry.expires_in === undefined || entry.expires_in > 0);
      expect(evaluate(live, vector.request.node, vector.request.scope)).toBe(vector.expect);
    });
  }
});

function makeDb() {
  return createDatabase(":memory:").db;
}
let seq = 0;
function makeAccount(db: ReturnType<typeof makeDb>, now: number) {
  const id = `u-${++seq}`;
  db.prepare("INSERT INTO users(id, created_at, updated_at) VALUES (?, ?, ?)").run(id, now, now);
  return id;
}

describe("组继承（真实种子数据：level.member → level.registered → level.visitor）", () => {
  it("顶层成员继承到访客与注册用户的全部条目", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.read.public")).toBe(true); // 来自 level.visitor
    expect(engine.check(account, "forum.read.registered")).toBe(true); // 来自 level.registered
    expect(engine.check(account, "forum.read.member")).toBe(true); // 来自 level.member 自己
    expect(engine.check(account, "forum.topic.create")).toBe(true);
  });

  it("注册用户拿不到成员专属节点，但拿得到访客的公开节点", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.registered", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.read.public")).toBe(true);
    expect(engine.check(account, "forum.read.registered")).toBe(true);
    expect(engine.check(account, "forum.read.member")).toBe(false);
    expect(engine.check(account, "forum.topic.create")).toBe(false); // unset 按拒绝处理
  });

  it("账号自己的 deny 盖过组继承来的 allow", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.topic.create")).toBe(true);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, 'forum.topic.create', 0, '{}', 'test', ?)").run(account, now);
    engine.bump();
    expect(engine.check(account, "forum.topic.create")).toBe(false);
  });

  // 迁移种子（lib/migrations/2026-10-yugc-v2.ts 的 DEPARTMENT_FORUM_CATEGORIES）按
  // app/forum/content/curation.json 的真实分类 id 发放，不再是部门 id 占位。
  it("部门的 scope 通配只覆盖本部门对应的真实论坛分类", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    setExclusiveGroupMembership(db, account, "dept.ai", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.moderate.pin", { category: "c-ai" })).toBe(true);
    expect(engine.check(account, "forum.moderate.pin", { category: "c-exam" })).toBe(false);
  });

  it("账号级 deny 盖过部门组继承来的分类版务权限（deny-first）", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    setExclusiveGroupMembership(db, account, "dept.ai", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.moderate.pin", { category: "c-ai" })).toBe(true); // 部门组本来允许
    // 这个账号被单独禁了版务权限（例如滥权后收回）：账号自己的 deny 不限分类，盖过部门组按分类的 allow。
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, 'forum.moderate.*', 0, '{}', 'test', ?)").run(account, now);
    engine.bump();
    expect(engine.check(account, "forum.moderate.pin", { category: "c-ai" })).toBe(false);
  });

  it("部门部长在本部门拿到用户与投递查看、操作记录与部门管理", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    setExclusiveGroupMembership(db, account, "dept.ai", now, "test");
    db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.ai.head', 'test', ?)").run(account, now);
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "console.access")).toBe(true);
    expect(engine.check(account, "users.view", { department: "dept.ai" })).toBe(true);
    expect(engine.check(account, "users.view", { department: "dept.algo" })).toBe(false);
    expect(engine.check(account, "dept.manage", { department: "dept.ai" })).toBe(true);
  });

  it("站长拥有根通配，覆盖任何节点", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', 'test', ?)").run(account, now);
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "perm.manage")).toBe(true);
    expect(engine.check(account, "gitlab.settings")).toBe(true);
  });
});

describe("meta 取值（SPEC §3.5 第 4 条）", () => {
  it("账号自己有 meta 条目时优先于组", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test"); // 组里是 -1（不限）
    const engine = createPermissionEngine(db);
    expect(engine.meta(account, "meta.limit.apply.daily")).toBe("-1");
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, meta_value, scope, granted_by, created_at) VALUES ('account', ?, 'meta.limit.apply.daily', '5', '{}', 'test', ?)").run(account, now);
    engine.bump();
    expect(engine.meta(account, "meta.limit.apply.daily")).toBe("5"); // 即使比组里的 -1 更严格，账号自己的仍然优先
  });

  it("命中多个组时取权重最高的那个", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    // 注册用户的 apply.daily 是 3；成员是 -1，权重更高，应该用成员的
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.meta(account, "meta.limit.apply.daily")).toBe("-1");
  });

  it("同权重时取更宽松的值，与插入顺序无关", () => {
    const db = makeDb();
    const now = Date.now();
    db.prepare("INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at) VALUES ('custom.a', 'custom', 'A', 5, ?, ?)").run(now, now);
    db.prepare("INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at) VALUES ('custom.b', 'custom', 'B', 5, ?, ?)").run(now, now);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, meta_value, scope, granted_by, created_at) VALUES ('group', 'custom.a', 'meta.limit.search.per_minute', '10', '{}', 'test', ?)").run(now);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, meta_value, scope, granted_by, created_at) VALUES ('group', 'custom.b', 'meta.limit.search.per_minute', '-1', '{}', 'test', ?)").run(now);
    const accountAB = makeAccount(db, now);
    db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'custom.a', 'test', ?)").run(accountAB, now);
    db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'custom.b', 'test', ?)").run(accountAB, now);
    const accountBA = makeAccount(db, now);
    db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'custom.b', 'test', ?)").run(accountBA, now);
    db.prepare("INSERT INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'custom.a', 'test', ?)").run(accountBA, now);
    const engine = createPermissionEngine(db);
    expect(engine.meta(accountAB, "meta.limit.search.per_minute")).toBe("-1");
    expect(engine.meta(accountBA, "meta.limit.search.per_minute")).toBe("-1");
  });
});

describe("过期在读取时过滤（SPEC §3.5 第 3 条）", () => {
  it("过期的组成员资格不再生效，连带的继承也一起消失", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, 'level.member', ?, 'test', ?)").run(account, now - 1000, now);
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.read.public")).toBe(false);
  });

  it("过期的账号级条目不再生效", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, expires_at, granted_by, created_at) VALUES ('account', ?, 'apply.submit', 1, '{}', ?, 'test', ?)").run(account, now - 1000, now);
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "apply.submit")).toBe(false);
  });

  it("未过期（将来过期）的条目仍然生效", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, expires_at, granted_by, created_at) VALUES ('account', ?, 'apply.submit', 1, '{}', ?, 'test', ?)").run(account, now + 60_000, now);
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "apply.submit")).toBe(true);
  });
});

describe("perm_state.revision 进程内缓存", () => {
  it("写入不经过 bump() 时沿用旧判定，调用 bump() 之后才刷新", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    const engine = createPermissionEngine(db);
    expect(engine.check(account, "forum.topic.create")).toBe(true);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, 'forum.topic.create', 0, '{}', 'test', ?)").run(account, now);
    expect(engine.check(account, "forum.topic.create")).toBe(true); // 还没 bump，缓存没失效
    engine.bump();
    expect(engine.check(account, "forum.topic.create")).toBe(false);
  });
});

describe("explain() 与 effective()（控制台「解释」「某账号的有效权限」用）", () => {
  it("explainFor 报出命中来源与继承链", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    const engine = createPermissionEngine(db);
    const result = engine.explainFor(account, "forum.read.public");
    expect(result.result).toBe("allow");
    expect(result.hits.some(hit => hit.group?.id === "level.visitor" && hit.via.includes("level.member") && hit.via.includes("level.visitor"))).toBe(true);
  });

  it("effective 汇总 allow/deny/meta 与所在组", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    setExclusiveGroupMembership(db, account, "level.member", now, "test");
    const engine = createPermissionEngine(db);
    const result = engine.effective(account);
    expect(result.groups.map(group => group.id).sort()).toEqual(["level.member", "level.registered", "level.visitor"]);
    expect(result.allow).toContain("forum.topic.create");
    expect(result.meta["meta.limit.apply.daily"]).toBe("-1");
  });
});

describe("entriesForAccount 不读数据库之外的东西（纯读取）", () => {
  it("账号没有任何分组时只返回账号自己的条目", () => {
    const db = makeDb();
    const now = Date.now();
    const account = makeAccount(db, now);
    db.prepare("INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, 'apply.submit', 1, '{}', 'test', ?)").run(account, now);
    const entries = entriesForAccount(db, account, now);
    expect(entries).toHaveLength(1);
    expect(entries[0].group).toBeNull();
    expect(metaValueFromEntries(entries, "meta.limit.apply.daily")).toBeNull();
  });
});
