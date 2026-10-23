import { describe, expect, it } from "vitest";
import { CONSOLE_NAV, NAV_GROUPS, activeNavId, navState, visibleNav } from "../../app/console/src/lib/nav";
import { MOCK_PERSONAS, mockMe } from "../../app/console/src/mock/console";

const identity = (permissions: string[]) => ({ permissions });

describe("navState", () => {
  const item = { anyOf: ["invite.manage"] };
  it("shows an item whose node is held", () => {
    expect(navState(item, identity(["console.access", "invite.manage"]))).toBe("visible");
  });
  it("hides an item whose node is missing", () => {
    expect(navState(item, identity(["console.access"]))).toBe("hidden");
  });
  it("treats anyOf as a union", () => {
    expect(navState({ anyOf: ["perm.view", "perm.manage"] }, identity(["perm.manage"]))).toBe("visible");
  });
});

describe("console navigation per persona (#274)", () => {
  const me = (name: string) => mockMe(MOCK_PERSONAS[name]);
  const ids = (name: string) => visibleNav(me(name)).map(item => item.id);

  it("follows SPEC §3.9: 概览, then 招新, 社区, 用户, GitLab, 记录, with no GitHub organisation pages", () => {
    expect(NAV_GROUPS.map(group => group.label)).toEqual(["招新", "社区", "用户", "GitLab", "记录"]);
    expect(CONSOLE_NAV.map(item => item.id)).toEqual([
      "overview", "applications", "forum", "competitions", "users", "permissions", "invites",
      "gitlab-overview", "gitlab-accounts", "gitlab-projects", "gitlab-settings", "activity", "feedback",
    ]);
    for (const item of CONSOLE_NAV) {
      expect(item.to.startsWith("/console")).toBe(true);
      expect(`${item.id} ${item.to} ${item.label}`).not.toMatch(/github/i);
    }
  });
  it("gives the site owner every page, whichever way they signed in", () => {
    expect(ids("owner")).toEqual(CONSOLE_NAV.map(item => item.id));
    expect(ids("owner_email")).toEqual(ids("owner"));
  });
  it("gives the management head users, permissions (read only), invites, GitLab and the activity log", () => {
    const list = ids("management_head");
    for (const id of ["overview", "users", "permissions", "invites", "gitlab-overview", "gitlab-settings", "activity", "competitions"]) expect(list, id).toContain(id);
    expect(list).not.toContain("applications");
    expect(list).not.toContain("feedback");
    expect(me("management_head").permissions).toContain("perm.view");
    expect(me("management_head").permissions).not.toContain("perm.manage");
  });
  it("gives a department head the overview, applications, users and the activity log of their own department", () => {
    const list = ids("ai_head");
    for (const id of ["overview", "applications", "users", "activity"]) expect(list, id).toContain(id);
    for (const id of ["permissions", "invites", "gitlab-overview", "feedback"]) expect(list, id).not.toContain(id);
  });
  it("lets a custom group open the console for one job: the AI staff member in 活动志愿者 sees competitions", () => {
    expect(me("ai_staff").permissions).toContain("console.access");
    expect(ids("ai_staff")).toContain("competitions");
    expect(ids("ai_staff")).not.toContain("users");
  });
  it("keeps members, alumni and registered users out: /api/console/me answers but without console.access", () => {
    for (const name of ["member", "alumni", "registered"]) expect(me(name).permissions, name).not.toContain("console.access");
    expect(me("registered").level).toBe("registered");
    expect(me("registered").permissions).toContain("apply.submit");
  });
});

describe("activeNavId", () => {
  it("matches the overview only exactly", () => {
    expect(activeNavId("/console")).toBe("overview");
    expect(activeNavId("/console/")).toBe("overview");
    expect(activeNavId("/console/applications/abc")).toBe("applications");
  });
  it("keeps the GitLab overview exact and picks the longest prefix below it", () => {
    expect(activeNavId("/console/gitlab")).toBe("gitlab-overview");
    expect(activeNavId("/console/gitlab/accounts")).toBe("gitlab-accounts");
    expect(activeNavId("/console/gitlab/settings")).toBe("gitlab-settings");
  });
  it("returns null outside the console", () => {
    expect(activeNavId("/signin")).toBeNull();
  });
});
