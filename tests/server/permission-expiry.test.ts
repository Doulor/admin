import { afterEach, describe, expect, it } from "vitest";
import { createPermissionEngine, setExclusiveGroupMembership } from "../../app/server/src/lib/permissions";
import { createDatabase } from "../../app/server/src/lib/db";
import { signIn, testApp } from "./helpers";

const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
const databases: ReturnType<typeof createDatabase>[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
  for (const storage of databases.splice(0)) storage.db.close();
});

function engineFixture() {
  const storage = createDatabase(":memory:");
  databases.push(storage);
  const { db } = storage;
  const time = { now: 10_000 };
  const id = "expiry-account";
  db.prepare("INSERT INTO users(id, created_at, updated_at) VALUES (?, ?, ?)").run(id, time.now, time.now);
  const engine = createPermissionEngine(db, () => time.now);
  return { db, id, time, engine };
}

describe("permission expiry through real requests", () => {
  it("rejects a reply at membership expiry after a successful request has warmed the permission cache", async () => {
    let now = Date.now();
    const context = await testApp({ clock: () => now });
    contexts.push(context);
    const { app } = context;
    const sid = signIn(app, "warm-expiring-member", 7201);
    const id = app.services.identity.accountForGithub(7201)!;
    const expiresAt = now + 1000;
    setExclusiveGroupMembership(app.services.storage.db, id, "level.member", now, "test", expiresAt);
    app.services.permissions.bump();
    const reply = (content: string) => app.inject({
      method: "POST", url: "/api/forum/posts",
      headers: { cookie: `sid=${sid}`, origin: "https://example.test" },
      payload: { topicId: "t9", content },
    });
    const warm = await reply("Synthetic reply before expiry");
    expect(warm.statusCode).toBe(201);
    now = expiresAt;
    const expired = await reply("Synthetic reply at expiry");
    console.log(JSON.stringify({
      path: "POST /api/forum/posts", warm: warm.statusCode, atExpiry: expired.statusCode,
      memberAtExpiry: app.services.identity.isMember(id), permissionAtExpiry: app.services.permissions.check(id, "forum.reply.create"),
    }));
    expect(expired.statusCode).toBe(403);
    expect(expired.json()).toMatchObject({ error: "forbidden" });
    expect(app.services.permissions.check(id, "forum.reply.create")).toBe(false);
  });
});

describe("createPermissionEngine temporal validity", () => {
  it("stops applying an expired direct deny without any revision bump", () => {
    const { db, id, time, engine } = engineFixture();
    setExclusiveGroupMembership(db, id, "level.registered", time.now, "test");
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, expires_at, granted_by, created_at)
      VALUES ('account', ?, 'apply.submit', 0, '{}', ?, 'test', ?)`).run(id, time.now + 1000, time.now);
    expect(engine.check(id, "apply.submit")).toBe(false);
    time.now += 1000;
    expect(engine.check(id, "apply.submit")).toBe(true);
    expect(engine.explainFor(id, "apply.submit").result).toBe("allow");
  });

  it("restores a previously filtered deny when the controlled clock moves backwards", () => {
    const { db, id, time, engine } = engineFixture();
    setExclusiveGroupMembership(db, id, "level.registered", time.now, "test");
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, expires_at, granted_by, created_at)
      VALUES ('account', ?, 'apply.submit', 0, '{}', ?, 'test', ?)`).run(id, time.now - 500, time.now - 2000);
    expect(engine.check(id, "apply.submit")).toBe(true);
    time.now -= 1000;
    expect(engine.check(id, "apply.submit")).toBe(false);
    expect(engine.explainFor(id, "apply.submit").result).toBe("deny");
  });

  it("expires a direct allow at equality and restores it when rewinding an empty cached result", () => {
    const { db, id, time, engine } = engineFixture();
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, expires_at, granted_by, created_at)
      VALUES ('account', ?, 'forum.topic.create', 1, ?, 'test', ?)`).run(id, 11_000, time.now);
    expect(engine.check(id, "forum.topic.create")).toBe(true);
    time.now = 11_000;
    expect(engine.check(id, "forum.topic.create")).toBe(false);
    expect(engine.effective(id).allow).not.toContain("forum.topic.create");
    time.now = 10_999;
    expect(engine.check(id, "forum.topic.create")).toBe(true);
    expect(engine.explainFor(id, "forum.topic.create").result).toBe("allow");
  });

  it("expires inherited ancestor entries without widening department scope or changing deny priority", () => {
    const { db, id, time, engine } = engineFixture();
    db.prepare(`INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at)
      VALUES ('custom.child', 'custom', 'Child', 1, ?, ?)`).run(time.now, time.now);
    db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES ('custom.child', 'dept.ai')").run();
    setExclusiveGroupMembership(db, id, "custom.child", time.now, "test");
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, expires_at, granted_by, created_at)
      VALUES ('group', 'dept.ai', 'forum.moderate.pin', 0, '{"category":"c-ai"}', 11000, 'test', ?)`).run(time.now);
    expect(engine.check(id, "forum.moderate.pin", { category: "c-ai" })).toBe(false);
    expect(engine.check(id, "forum.moderate.pin", { category: "c-exam" })).toBe(false);
    time.now = 11_000;
    expect(engine.check(id, "forum.moderate.pin", { category: "c-ai" })).toBe(true);
    expect(engine.check(id, "forum.moderate.pin", { category: "c-exam" })).toBe(false);
    expect(engine.check(id, "forum.moderate.pin")).toBe(false);
  });

  it("expires an inherited allow even while its root membership remains valid", () => {
    const { db, id, time, engine } = engineFixture();
    setExclusiveGroupMembership(db, id, "level.member", time.now, "test", 12_000);
    db.prepare(`UPDATE perm_entries SET expires_at = 11000
      WHERE subject_type = 'group' AND subject_id = 'level.registered' AND node = 'apply.submit'`).run();
    expect(engine.check(id, "apply.submit")).toBe(true);
    time.now = 11_000;
    expect(engine.check(id, "apply.submit")).toBe(false);
    expect(engine.check(id, "forum.topic.create")).toBe(true);
  });

  it("removes an ancestor deny when the only root membership granting it expires first", () => {
    const { db, id, time, engine } = engineFixture();
    db.prepare(`INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at)
      VALUES ('custom.deny_root', 'custom', 'Deny', 1, ?, ?)`).run(time.now, time.now);
    db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES ('custom.deny_root', 'level.visitor')").run();
    setExclusiveGroupMembership(db, id, "custom.deny_root", time.now, "test", 11_000);
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, granted_by, created_at)
      VALUES ('group', 'level.visitor', 'apply.submit', 0, 'test', ?),
             ('account', ?, 'apply.submit', 1, 'test', ?)`).run(time.now, id, time.now);
    expect(engine.check(id, "apply.submit")).toBe(false);
    time.now = 11_000;
    expect(engine.check(id, "apply.submit")).toBe(true);
    expect(engine.effective(id).deny).not.toContain("apply.submit");
  });

  it("keeps a diamond ancestor deny reachable until the last valid root expires", () => {
    const { db, id, time, engine } = engineFixture();
    for (const root of ["custom.left", "custom.right"]) {
      db.prepare("INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at) VALUES (?, 'custom', ?, 1, ?, ?)").run(root, root, time.now, time.now);
      db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES (?, 'level.visitor')").run(root);
      setExclusiveGroupMembership(db, id, root, time.now, "test", root === "custom.left" ? 11_000 : 12_000);
    }
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, granted_by, created_at)
      VALUES ('group', 'level.visitor', 'apply.submit', 0, 'test', ?),
             ('account', ?, 'apply.submit', 1, 'test', ?)`).run(time.now, id, time.now);
    expect(engine.check(id, "apply.submit")).toBe(false);
    time.now = 11_000;
    expect(engine.explainFor(id, "apply.submit").result).toBe("deny");
    time.now = 12_000;
    expect(engine.check(id, "apply.submit")).toBe(true);
    time.now = 11_999;
    expect(engine.check(id, "apply.submit")).toBe(false);
  });

  it("refreshes meta values at direct-entry and group-membership expiry", () => {
    const { db, id, time, engine } = engineFixture();
    setExclusiveGroupMembership(db, id, "level.member", time.now, "test", 12_000);
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, meta_value, expires_at, granted_by, created_at)
      VALUES ('account', ?, 'meta.limit.apply.daily', '5', 11000, 'test', ?)`).run(id, time.now);
    expect(engine.meta(id, "meta.limit.apply.daily")).toBe("5");
    time.now = 11_000;
    expect(engine.meta(id, "meta.limit.apply.daily")).toBe("-1");
    time.now = 12_000;
    expect(engine.meta(id, "meta.limit.apply.daily")).toBeNull();
    expect(engine.effective(id).meta).toEqual({});
    time.now = 10_999;
    expect(engine.meta(id, "meta.limit.apply.daily")).toBe("5");
  });

  it("does not freeze visitor deny or allow entries across expiry and clock rewind", () => {
    const { db, time, engine } = engineFixture();
    db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, expires_at, granted_by, created_at)
      VALUES ('group', 'level.visitor', 'forum.read.public', 0, 11000, 'test', ?),
             ('group', 'level.visitor', 'forum.topic.create', 1, 11000, 'test', ?)`).run(time.now, time.now);
    expect(engine.check(null, "forum.read.public")).toBe(false);
    expect(engine.check(null, "forum.topic.create")).toBe(true);
    time.now = 11_000;
    expect(engine.check(null, "forum.read.public")).toBe(true);
    expect(engine.check(null, "forum.topic.create")).toBe(false);
    time.now = 10_999;
    expect(engine.check(null, "forum.read.public")).toBe(false);
    expect(engine.check(null, "forum.topic.create")).toBe(true);
  });
});
