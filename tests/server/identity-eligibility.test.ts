import { afterEach, describe, expect, it } from "vitest";
import { setExclusiveGroupMembership } from "../../app/server/src/lib/permissions";
import { signIn, testApp } from "./helpers";

const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const context of contexts.splice(0)) await context.close(); });

async function setup() {
  const time = { now: Date.now() };
  const deny = async () => { throw new Error("Unexpected external request in eligibility regression"); };
  const context = await testApp({ clock: () => time.now, gitlabFetch: deny, githubProfileFetch: deny });
  contexts.push(context);
  return { ...context, time };
}

describe("createIdentityStore claims eligibility", () => {
  it("accepts an active alumni for downstream login without granting member write permissions", async () => {
    const { app, time } = await setup();
    signIn(app, "eligible-alumni", 7101);
    const id = app.services.identity.accountForGithub(7101)!;
    setExclusiveGroupMembership(app.services.storage.db, id, "level.alumni", time.now, "test");
    app.services.permissions.bump();

    expect(app.services.identity.getAccountClaims(id)).toMatchObject({ account_id: id, member: true, site_role: "member" });
    expect(app.services.identity.listAccountsForSync()).toEqual([
      expect.objectContaining({ account_id: id, member: true, site_role: "member" }),
    ]);
    expect(app.services.identity.isMember(id)).toBe(true);
    expect(app.services.permissions.check(id, "forum.read.member")).toBe(true);
    expect(app.services.permissions.check(id, "forum.topic.create")).toBe(false);
    expect(app.services.permissions.check(id, "forum.reply.create")).toBe(false);
  });

  it("ends member login eligibility at the exact membership expiry and re-evaluates a clock rewind", async () => {
    const { app, time } = await setup();
    signIn(app, "expiring-member", 7102);
    const id = app.services.identity.accountForGithub(7102)!;
    const expiresAt = time.now + 1000;
    setExclusiveGroupMembership(app.services.storage.db, id, "level.member", time.now, "test", expiresAt);

    for (const [now, member] of [[expiresAt - 1, true], [expiresAt, false], [expiresAt + 1, false], [expiresAt - 1, true]] as const) {
      time.now = now;
      expect(app.services.identity.getAccountClaims(id)).toMatchObject({ member, site_role: member ? "member" : null });
      expect(app.services.identity.listAccountsForSync()).toEqual([expect.objectContaining({ account_id: id, member })]);
      expect(app.services.identity.isMember(id)).toBe(member);
    }
  });

  it("reports an alumni owner as admin only while the direct owner membership is valid", async () => {
    const { app, time } = await setup();
    signIn(app, "alumni-owner", 7103);
    const id = app.services.identity.accountForGithub(7103)!;
    const expiresAt = time.now + 1000;
    const db = app.services.storage.db;
    setExclusiveGroupMembership(db, id, "level.alumni", time.now, "test");
    setExclusiveGroupMembership(db, id, "title.site.owner", time.now, "test", expiresAt);

    for (const [now, siteRole] of [[expiresAt - 1, "admin"], [expiresAt, "member"], [expiresAt + 1, "member"], [expiresAt - 1, "admin"]] as const) {
      time.now = now;
      expect(app.services.identity.getAccountClaims(id)).toMatchObject({ member: true, site_role: siteRole });
      expect(app.services.identity.listAccountsForSync()).toEqual([expect.objectContaining({ account_id: id, site_role: siteRole })]);
    }
  });

  it("uses the same eligibility for the access summary and claims, ignoring stale legacy admin fields", async () => {
    const { app, time } = await setup();
    signIn(app, "legacy-admin", 7104);
    const id = app.services.identity.accountForGithub(7104)!;
    const db = app.services.storage.db;
    db.prepare("UPDATE users SET org_state = 'active', org_role = 'admin' WHERE id = ?").run(id);
    const input = { login: "legacy-admin", userId: 7104, accountId: id, accessToken: "", provider: "github" as const };

    expect(app.services.identity.membershipOf(id)).toEqual({ member: false, orgRole: null });
    expect(await app.services.access.resolve(input)).toMatchObject({ member: false, siteRole: null, capabilities: new Set() });
    setExclusiveGroupMembership(db, id, "level.member", time.now, "test", time.now + 1000);
    expect(app.services.identity.membershipOf(id)).toEqual({ member: true, orgRole: "member" });
    expect(await app.services.access.resolve(input)).toMatchObject({ member: true, siteRole: "member" });
    time.now += 1000;
    expect(app.services.identity.membershipOf(id)).toEqual({ member: false, orgRole: null });
    expect(await app.services.access.resolve(input)).toMatchObject({ member: false, siteRole: null, capabilities: new Set() });
  });

  it.each([
    { name: "registered", level: "level.registered", owner: false, levelExpiry: null, ownerExpiry: null, status: "active", member: false, role: null },
    { name: "member", level: "level.member", owner: false, levelExpiry: null, ownerExpiry: null, status: "active", member: true, role: "member" },
    { name: "alumni", level: "level.alumni", owner: false, levelExpiry: null, ownerExpiry: null, status: "active", member: true, role: "member" },
    { name: "owner-only", level: "level.registered", owner: true, levelExpiry: null, ownerExpiry: null, status: "active", member: false, role: null },
    { name: "alumni-owner", level: "level.alumni", owner: true, levelExpiry: null, ownerExpiry: null, status: "active", member: true, role: "admin" },
    { name: "expired-member-owner", level: "level.member", owner: true, levelExpiry: 0, ownerExpiry: null, status: "active", member: false, role: null },
    { name: "expired-alumni", level: "level.alumni", owner: false, levelExpiry: -1, ownerExpiry: null, status: "active", member: false, role: null },
    { name: "expired-owner", level: "level.member", owner: true, levelExpiry: null, ownerExpiry: 0, status: "active", member: true, role: "member" },
    { name: "disabled-owner", level: "level.member", owner: true, levelExpiry: null, ownerExpiry: null, status: "disabled", member: false, role: null },
    { name: "merged-owner", level: "level.member", owner: true, levelExpiry: null, ownerExpiry: null, status: "merged", member: false, role: null },
  ] as const)("keeps claims, membership and sync eligibility consistent for $name", async fixture => {
    const { app, time } = await setup();
    signIn(app, fixture.name, 7110);
    const id = app.services.identity.accountForGithub(7110)!;
    const { db } = app.services.storage;
    setExclusiveGroupMembership(db, id, fixture.level, time.now, "test", fixture.levelExpiry === null ? null : time.now + fixture.levelExpiry);
    if (fixture.owner) setExclusiveGroupMembership(db, id, "title.site.owner", time.now, "test", fixture.ownerExpiry === null ? null : time.now + fixture.ownerExpiry);
    if (fixture.status === "merged") {
      signIn(app, "merge-terminal", 7111);
      db.prepare("UPDATE users SET status = 'merged', merged_into = ? WHERE id = ?").run(app.services.identity.accountForGithub(7111)!, id);
    } else if (fixture.status === "disabled") {
      db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
    }
    expect(app.services.identity.membershipOf(id)).toEqual({ member: fixture.member, orgRole: fixture.role });
    expect(app.services.identity.isMember(id)).toBe(fixture.member);
    const claims = app.services.identity.getAccountClaims(id);
    const sync = app.services.identity.listAccountsForSync().find(account => account.account_id === id);
    if (fixture.status === "merged") {
      expect(claims).toBeNull();
      expect(sync).toBeUndefined();
    } else {
      expect(claims).toMatchObject({ account_id: id, status: fixture.status, member: fixture.member, site_role: fixture.role });
      expect(sync).toEqual(claims);
    }
  });

  it("does not infer login eligibility from inherited member permissions", async () => {
    const { app, time } = await setup();
    signIn(app, "inherited-member-nodes", 7120);
    const id = app.services.identity.accountForGithub(7120)!;
    const { db } = app.services.storage;
    db.prepare(`INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at)
      VALUES ('custom.member_nodes', 'custom', 'Member nodes', 1, ?, ?)`).run(time.now, time.now);
    db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES ('custom.member_nodes', 'level.member')").run();
    setExclusiveGroupMembership(db, id, "custom.member_nodes", time.now, "test");
    app.services.permissions.bump();
    expect(app.services.permissions.check(id, "forum.topic.create")).toBe(true);
    expect(app.services.identity.getAccountClaims(id)).toMatchObject({ member: false, site_role: null });
    expect(app.services.identity.membershipOf("missing-account")).toEqual({ member: false, orgRole: null });
    expect(app.services.identity.getAccountClaims("missing-account")).toBeNull();
  });
});

describe("real forum requests retain read and write separation", () => {
  it.each(["level.registered", "level.alumni"] as const)("retains the real %s read path without granting topic or reply writes", async level => {
    const { app, time } = await setup();
    const ownerSid = signIn(app, "read-fixture-owner", 7130);
    const ownerId = app.services.identity.accountForGithub(7130)!;
    setExclusiveGroupMembership(app.services.storage.db, ownerId, "title.site.owner", time.now, "test");
    app.services.permissions.bump();
    for (const [topicId, visibility] of [["t9", "registered"], ["t73", "member"]] as const) {
      const changed = await app.inject({
        method: "PATCH", url: `/api/forum/topics/${topicId}/visibility`,
        headers: { cookie: `sid=${ownerSid}`, origin: "https://example.test" }, payload: { visibility },
      });
      expect(changed.statusCode).toBe(200);
    }
    const sid = signIn(app, "read-only-account", 7131);
    const id = app.services.identity.accountForGithub(7131)!;
    setExclusiveGroupMembership(app.services.storage.db, id, level, time.now, "test");
    app.services.permissions.bump();
    const headers = { cookie: `sid=${sid}`, origin: "https://example.test" };
    const state = await app.inject({ url: "/api/forum/state", headers });
    expect(state.statusCode).toBe(200);
    expect(state.json().state.viewer).toMatchObject({ kind: "member", level: level === "level.alumni" ? "member" : "registered", nodes: [] });
    const registeredRead = await app.inject({ url: "/api/forum/topics/t9/posts", headers });
    expect(registeredRead.statusCode).toBe(200);
    expect(registeredRead.json().posts.length).toBeGreaterThan(0);
    const memberRead = await app.inject({ url: "/api/forum/topics/t73/posts", headers });
    expect(memberRead.statusCode).toBe(level === "level.alumni" ? 200 : 403);
    const guestRead = await app.inject({ url: "/api/forum/topics/t9/posts" });
    expect(guestRead.statusCode).toBe(401);
    for (const request of [
      { url: "/api/forum/topics", payload: { title: "Synthetic topic", categoryId: "c-exam", content: "Read-only write attempt" } },
      { url: "/api/forum/posts", payload: { topicId: "t9", content: "Read-only reply attempt" } },
    ]) {
      const denied = await app.inject({ method: "POST", ...request, headers });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toMatchObject({ error: "forbidden" });
    }
  });

  it("keeps normal member topic creation but rejects the same warm request path at exact expiry", async () => {
    const { app, time } = await setup();
    const sid = signIn(app, "expiring-topic-writer", 7132);
    const id = app.services.identity.accountForGithub(7132)!;
    setExclusiveGroupMembership(app.services.storage.db, id, "level.member", time.now, "test", time.now + 1000);
    app.services.permissions.bump();
    const create = () => app.inject({
      method: "POST", url: "/api/forum/topics", headers: { cookie: `sid=${sid}`, origin: "https://example.test" },
      payload: { title: "Synthetic expiring topic", categoryId: "c-exam", content: "Synthetic content" },
    });
    expect((await create()).statusCode).toBe(201);
    time.now += 1000;
    const expired = await create();
    expect(expired.statusCode).toBe(403);
    expect(expired.json()).toMatchObject({ error: "forbidden" });
  });
});
