import { afterEach, describe, expect, it } from "vitest";
import { isSiteOwner, setExclusiveGroupMembership, siteOwnerCount, SITE_OWNER_GROUP_ID } from "../../app/server/src/lib/permissions";
import { grantPermNode, signIn, testApp } from "./helpers";

const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => { for (const context of contexts.splice(0)) await context.close(); });

async function setup() {
  const time = { now: Date.now() + 120_000 };
  const context = await testApp({ clock: () => time.now });
  contexts.push(context);
  const { app } = context;
  let seq = 7300;
  function user(login: string, owner = false, expiry: number | null = null) {
    const githubId = ++seq;
    const sid = signIn(app, login, githubId);
    const id = app.services.identity.accountForGithub(githubId)!;
    if (owner) setExclusiveGroupMembership(app.services.storage.db, id, SITE_OWNER_GROUP_ID, time.now, "test", expiry);
    app.services.permissions.bump();
    return { id, sid };
  }
  const headers = (sid: string) => ({ cookie: `sid=${sid}`, origin: "https://example.test" });
  return { ...context, time, user, headers, db: app.services.storage.db };
}

describe("console direct active owner protection", () => {
  it("does not count disabled, merged or already expired memberships as a replacement for the last owner", async () => {
    const { app, time, user, headers, db } = await setup();
    const owner = user("only-effective-owner", true);
    const disabled = user("disabled-owner", true);
    const merged = user("merged-owner", true);
    const expired = user("expired-owner", true, time.now);
    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(disabled.id);
    db.prepare("UPDATE users SET status = 'merged', merged_into = ? WHERE id = ?").run(owner.id, merged.id);
    const response = await app.inject({
      method: "DELETE", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members/${owner.id}`,
      headers: headers(owner.sid),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(siteOwnerCount(db, time.now)).toBe(1);
    expect(isSiteOwner(db, owner.id, time.now)).toBe(true);
    for (const id of [disabled.id, merged.id, expired.id]) expect(isSiteOwner(db, id, time.now)).toBe(false);
  });

  it.each([-1, 0])("rejects replacing the sole owner membership with expires_at = now %+d", async offset => {
    const { app, time, user, headers, db } = await setup();
    const owner = user("owner-overwrite", true);
    const response = await app.inject({
      method: "POST", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members`,
      headers: headers(owner.sid), payload: { account_id: owner.id, expires_at: time.now + offset },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(isSiteOwner(db, owner.id, time.now)).toBe(true);
    expect(app.services.permissions.check(owner.id, "perm.manage")).toBe(true);
  });

  it("prevents a non-effective owner with users.manage/users.disable from disabling a current owner", async () => {
    const { app, time, user, headers } = await setup();
    const target = user("disable-target-owner", true);
    user("second-effective-owner", true);
    const actor = user("expired-owner-manager", true, time.now);
    grantPermNode(app, actor.id, "users.manage");
    grantPermNode(app, actor.id, "users.disable");
    const response = await app.inject({
      method: "PATCH", url: `/api/console/users/${target.id}`,
      headers: headers(actor.sid), payload: { status: "disabled" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "forbidden", node: SITE_OWNER_GROUP_ID });
    expect(app.services.identity.getAccountClaims(target.id)).toMatchObject({ status: "active" });
  });

  it("requires a current owner to reactivate a disabled account with an unexpired owner membership", async () => {
    const { app, user, headers, db } = await setup();
    user("current-owner", true);
    const target = user("disabled-latent-owner", true);
    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(target.id);
    const actor = user("status-manager");
    grantPermNode(app, actor.id, "users.manage");
    grantPermNode(app, actor.id, "users.disable");
    const response = await app.inject({
      method: "PATCH", url: `/api/console/users/${target.id}`,
      headers: headers(actor.sid), payload: { status: "active" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "forbidden", node: SITE_OWNER_GROUP_ID });
    expect(app.services.identity.getAccountClaims(target.id)).toMatchObject({ status: "disabled" });
  });

  it("does not let a non-owner turn a temporary owner into a permanent owner by retaining the title", async () => {
    const { app, time, user, headers, db } = await setup();
    const target = user("temporary-owner", true, time.now + 1000);
    const actor = user("titles-manager");
    grantPermNode(app, actor.id, "users.manage");
    const response = await app.inject({
      method: "PATCH", url: `/api/console/users/${target.id}`,
      headers: headers(actor.sid), payload: { titles: [SITE_OWNER_GROUP_ID] },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "forbidden", node: SITE_OWNER_GROUP_ID });
    time.now += 1000;
    expect(isSiteOwner(db, target.id, time.now)).toBe(false);
  });

  it.each(["past", "now", "scoped"] as const)("rejects replacing the global root allow with a %s wildcard", async kind => {
    const { app, time, user, headers } = await setup();
    const owner = user("root-owner", true);
    const groups = await app.inject({ url: "/api/console/permission-groups", headers: headers(owner.sid) });
    expect(groups.statusCode).toBe(200);
    const group = groups.json().groups.find((item: { id: string }) => item.id === SITE_OWNER_GROUP_ID);
    const rootId = group.entries.find((entry: { node: string; value: boolean }) => entry.node === "*" && entry.value).id;
    const addition = {
      node: "*", value: true,
      ...(kind === "scoped" ? { scope: { department: "dept.ai" } } : { expires_at: time.now + (kind === "past" ? -1 : 0) }),
    };
    const response = await app.inject({
      method: "PATCH", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`,
      headers: headers(owner.sid), payload: { entries: { remove: [rootId], add: [addition] } },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(app.services.permissions.check(owner.id, "perm.manage")).toBe(true);
  });

  it("rejects a global deny wildcard that would lock every owner out even when a root allow remains", async () => {
    const { app, user, headers } = await setup();
    const owner = user("deny-root-owner", true);
    const other = user("deny-root-other", true);
    const response = await app.inject({
      method: "PATCH", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`,
      headers: headers(owner.sid), payload: { entries: { add: [{ node: "*", value: false }] } },
    });
    const readBack = await app.inject({ url: "/api/console/permission-groups", headers: headers(other.sid) });
    console.log(JSON.stringify({ path: "PATCH /api/console/permission-groups/title.site.owner", denyWildcard: response.statusCode, subsequentOwnerRead: readBack.statusCode }));
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(readBack.statusCode).toBe(200);
  });

  it("rejects a metadata wildcard that the permission engine treats as a global deny", async () => {
    const { app, user, headers } = await setup();
    const owner = user("metadata-root-owner", true);
    const other = user("metadata-root-other", true);
    const response = await app.inject({
      method: "PATCH", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`,
      headers: headers(owner.sid), payload: { entries: { add: [{ node: "*", meta_value: "1" }] } },
    });
    const readBack = await app.inject({ url: "/api/console/permission-groups", headers: headers(other.sid) });
    console.log(JSON.stringify({ path: "PATCH /api/console/permission-groups/title.site.owner", metadataWildcard: response.statusCode, subsequentOwnerRead: readBack.statusCode }));
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(readBack.statusCode).toBe(200);
  });

  it.each([{ status: "disabled" }, { titles: [] }])("protects the last active owner through users PATCH %j", async payload => {
    const { app, time, user, headers, db } = await setup();
    const owner = user("last-user-owner", true);
    const invalid = user("disabled-user-backup", true);
    user("expired-user-backup", true, time.now);
    db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(invalid.id);
    const response = await app.inject({
      method: "PATCH", url: `/api/console/users/${owner.id}`, headers: headers(owner.sid), payload,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(isSiteOwner(db, owner.id, time.now)).toBe(true);
  });

  it.each(["expired", "inherited"] as const)("rejects a %s owner actor on both console owner-management routes", async kind => {
    const { app, time, user, headers, db } = await setup();
    const owner = user("protected-owner", true);
    user("protected-backup", true);
    const actor = user("non-direct-owner", kind === "expired", time.now);
    if (kind === "inherited") {
      db.prepare(`INSERT INTO perm_groups(id, kind, name, weight, created_at, updated_at)
        VALUES ('custom.inherited_owner', 'custom', 'Inherited', 1, ?, ?)`).run(time.now, time.now);
      db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES ('custom.inherited_owner', ?)").run(SITE_OWNER_GROUP_ID);
      setExclusiveGroupMembership(db, actor.id, "custom.inherited_owner", time.now, "test");
    } else {
      grantPermNode(app, actor.id, "perm.manage");
      grantPermNode(app, actor.id, "users.manage");
    }
    app.services.permissions.bump();
    expect(app.services.permissions.check(actor.id, "perm.manage")).toBe(true);
    expect(isSiteOwner(db, actor.id, time.now)).toBe(false);
    const requests = [
      { method: "PATCH" as const, url: `/api/console/users/${owner.id}`, payload: { titles: [] } },
      { method: "PATCH" as const, url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`, payload: { parents: [] } },
      { method: "POST" as const, url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members`, payload: { account_id: actor.id } },
      { method: "DELETE" as const, url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members/${owner.id}` },
    ];
    for (const request of requests) {
      const response = await app.inject({ ...request, headers: headers(actor.sid) });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ error: "forbidden", node: SITE_OWNER_GROUP_ID });
    }
  });

  it("allows temporary owners and revokes owner-management authority exactly at expiry", async () => {
    const { app, time, user, headers, db } = await setup();
    const owner = user("temporary-acting-owner", true);
    const target = user("temporary-appointed-owner");
    const expiry = time.now + 1000;
    // 唯一 owner 也可以设未来有效期，不擅自引入「至少一位永久 owner」政策。
    const temporary = await app.inject({
      method: "POST", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members`,
      headers: headers(owner.sid), payload: { account_id: owner.id, expires_at: expiry },
    });
    expect(temporary.statusCode).toBe(201);
    const appointed = await app.inject({
      method: "POST", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members`,
      headers: headers(owner.sid), payload: { account_id: target.id, expires_at: expiry },
    });
    expect(appointed.statusCode).toBe(201);
    grantPermNode(app, target.id, "perm.manage");
    expect(app.services.permissions.check(target.id, "perm.manage")).toBe(true);
    time.now = expiry;
    expect(siteOwnerCount(db, time.now)).toBe(0);
    const expired = await app.inject({
      method: "POST", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}/members`,
      headers: headers(target.sid), payload: { account_id: target.id },
    });
    expect(expired.statusCode).toBe(403);
    expect(expired.json()).toMatchObject({ error: "forbidden", node: SITE_OWNER_GROUP_ID });
  });

  it.each(["expired", "scoped"] as const)("does not count an existing %s root allow as the remaining global root", async kind => {
    const { app, time, user, headers } = await setup();
    const owner = user("remaining-root-owner", true);
    const groups = await app.inject({ url: "/api/console/permission-groups", headers: headers(owner.sid) });
    const group = groups.json().groups.find((item: { id: string }) => item.id === SITE_OWNER_GROUP_ID);
    const rootId = group.entries.find((entry: { node: string; value: boolean }) => entry.node === "*" && entry.value).id;
    const added = await app.inject({
      method: "PATCH", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`,
      headers: headers(owner.sid), payload: { entries: { add: [{
        node: "*", value: true,
        ...(kind === "expired" ? { expires_at: time.now } : { scope: { department: "dept.ai" } }),
      }] } },
    });
    expect(added.statusCode).toBe(200);
    const response = await app.inject({
      method: "PATCH", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`,
      headers: headers(owner.sid), payload: { entries: { remove: [rootId] } },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "last_owner" });
    expect(app.services.permissions.check(owner.id, "perm.manage")).toBe(true);
  });

  it("allows a future global root replacement but does not reuse it after expiry", async () => {
    const { app, time, user, headers } = await setup();
    const owner = user("temporary-root-owner", true);
    const groups = await app.inject({ url: "/api/console/permission-groups", headers: headers(owner.sid) });
    const group = groups.json().groups.find((item: { id: string }) => item.id === SITE_OWNER_GROUP_ID);
    const rootId = group.entries.find((entry: { node: string; value: boolean }) => entry.node === "*" && entry.value).id;
    const response = await app.inject({
      method: "PATCH", url: `/api/console/permission-groups/${SITE_OWNER_GROUP_ID}`, headers: headers(owner.sid),
      payload: { entries: { remove: [rootId], add: [
        { node: "*", value: true, expires_at: time.now + 1000 },
        { node: "*", value: false, expires_at: time.now },
      ] } },
    });
    expect(response.statusCode).toBe(200);
    const warm = await app.inject({ url: "/api/console/permission-groups", headers: headers(owner.sid) });
    expect(warm.statusCode).toBe(200);
    time.now += 1000;
    const expired = await app.inject({ url: "/api/console/permission-groups", headers: headers(owner.sid) });
    expect(expired.statusCode).toBe(403);
  });

  it("preserves normal non-owner account management", async () => {
    const { app, user, headers } = await setup();
    const actor = user("ordinary-manager");
    const target = user("ordinary-target");
    grantPermNode(app, actor.id, "users.manage");
    grantPermNode(app, actor.id, "users.disable");
    const disabled = await app.inject({
      method: "PATCH", url: `/api/console/users/${target.id}`,
      headers: headers(actor.sid), payload: { status: "disabled", titles: [] },
    });
    expect(disabled.statusCode).toBe(200);
    const restored = await app.inject({
      method: "PATCH", url: `/api/console/users/${target.id}`,
      headers: headers(actor.sid), payload: { status: "active", titles: [] },
    });
    expect(restored.statusCode).toBe(200);
  });
});
