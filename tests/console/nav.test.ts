import { describe, expect, it } from "vitest";
import { CONSOLE_NAV, activeNavId, navState, needsGithubConnection, visibleNav } from "../../app/console/src/lib/nav";
import { MOCK_PERSONAS } from "../../app/console/src/mock/console";

const identity = (capabilities: string[]) => ({ capabilities });

describe("navState", () => {
  const item = { anyOf: ["github.invites.manage"] };
  it("shows an item whose capability is held", () => {
    expect(navState(item, identity(["console.access", "github.invites.manage"]))).toBe("visible");
  });
  it("tells GitHub organisation pages apart: they need the server to be connected to GitHub (#262 第四期)", () => {
    expect(needsGithubConnection(["github.invites.manage"])).toBe(true);
    expect(needsGithubConnection(["github.org.read", "github.org.manage"])).toBe(true);
    expect(needsGithubConnection(["roles.manage", "roles.department.manage"])).toBe(false);
    expect(needsGithubConnection([])).toBe(false);
  });
  it("hides an item the title never granted", () => {
    expect(navState(item, identity(["console.access"]))).toBe("hidden");
  });
  it("treats anyOf as a union", () => {
    expect(navState({ anyOf: ["roles.manage", "roles.department.manage"] }, identity(["roles.department.manage"]))).toBe("visible");
  });
});

describe("console navigation per persona", () => {
  const ids = (name: string) => visibleNav(MOCK_PERSONAS[name] as never).map(item => item.id);
  const groups = (name: string) => [...new Set(visibleNav(MOCK_PERSONAS[name] as never).map(item => item.group ?? "home"))];

  it("gives the admin (GitHub organisation owner) every page", () => {
    expect(ids("admin")).toEqual(CONSOLE_NAV.map(item => item.id));
  });
  it("gives the captain every GitHub page from the title alone, whatever the GitHub org role", () => {
    expect(ids("captain")).toContain("github-invitations");
    expect(ids("captain")).toContain("github-security");
    expect(MOCK_PERSONAS.captain.site_role).toBe("member");
  });
  it("gives a plain member only the overview and the GitHub read pages", () => {
    expect(groups("member")).toEqual(["home", "github"]);
    expect(ids("member")).not.toContain("github-invitations");
    expect(ids("member")).not.toContain("people");
  });
  it("gives a recruitment head the invitation pages but not the security page, which needs github.org.manage", () => {
    expect(ids("recruitment")).toContain("github-invitations");
    expect(ids("recruitment")).toContain("github-invite-links");
    expect(ids("recruitment")).not.toContain("github-security");
  });
  it("gives a department head the people page but not the audit log unless the bundle grants it", () => {
    expect(ids("recruitment")).toContain("people");
    expect(ids("recruitment")).not.toContain("audit");
    expect(ids("tech")).toContain("audit");
  });
  it("keeps the owner's every page when they signed in by email; GitHub pages explain the missing connection on open", () => {
    expect(ids("admin_email")).toEqual(ids("admin"));
    expect(ids("admin_email")).toContain("invites");
    expect(MOCK_PERSONAS.admin_email.capabilities).toEqual(MOCK_PERSONAS.admin.capabilities);
    expect(MOCK_PERSONAS.admin_email.github).toBe("none");
  });
  it("shows invite codes only to holders of accounts.invites.manage", () => {
    expect(ids("captain")).toContain("invites");
    expect(ids("tech")).not.toContain("invites");
  });
  it("gives a guest nothing", () => {
    expect(ids("guest")).toEqual([]);
  });
  it("only links to console routes", () => {
    for (const item of CONSOLE_NAV) expect(item.to.startsWith("/console")).toBe(true);
  });
});

describe("activeNavId", () => {
  it("matches the overview only exactly", () => {
    expect(activeNavId("/console")).toBe("overview");
    expect(activeNavId("/console/")).toBe("overview");
    expect(activeNavId("/console/applications/abc")).toBe("applications");
  });
  it("prefers the longest prefix and keeps the GitHub overview exact", () => {
    expect(activeNavId("/console/github")).toBe("github-overview");
    expect(activeNavId("/console/github/repos/geek-main/issues/3")).toBe("github-repos");
    expect(activeNavId("/console/github/invite-links")).toBe("github-invite-links");
  });
  it("returns null outside the console", () => {
    expect(activeNavId("/signin")).toBeNull();
  });
});
