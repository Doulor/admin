// 控制台左侧导航：每一项声明所需能力（任一满足即可）。纯数据 + 纯函数，tests/console 直接测。
import type { Capability, ConsoleMe } from "./types";

export type NavItem = { id: string; to: string; label: string; anyOf: Capability[]; icon: string; group?: NavGroupId; end?: boolean };
export type NavGroupId = "recruit" | "community" | "github" | "class";
export type NavState = "visible" | "hidden";

export const FORUM_CAPABILITIES: Capability[] = ["forum.topic.pin", "forum.topic.close", "forum.post.moderate", "forum.category.manage", "forum.badge.assign"];
export const ROLE_CAPABILITIES: Capability[] = ["roles.manage", "roles.department.manage"];

export const NAV_GROUPS: { key: NavGroupId; label: string }[] = [
  { key: "recruit", label: "招新" },
  { key: "community", label: "社区" },
  { key: "github", label: "GitHub 组织" },
  { key: "class", label: "班务" },
];

export const CONSOLE_NAV: NavItem[] = [
  { id: "overview", to: "/console", label: "概览", anyOf: ["console.access"], icon: "i-carbon-dashboard", end: true },
  { id: "applications", to: "/console/applications", label: "投递管理", anyOf: ["applications.read"], icon: "i-carbon-document-attachment", group: "recruit" },
  { id: "forum", to: "/console/forum", label: "论坛管理", anyOf: FORUM_CAPABILITIES, icon: "i-carbon-forum", group: "community" },
  { id: "github-overview", to: "/console/github", label: "概况", anyOf: ["github.org.read"], icon: "i-carbon-logo-github", group: "github", end: true },
  { id: "github-members", to: "/console/github/members", label: "成员", anyOf: ["github.org.read"], icon: "i-carbon-user-multiple", group: "github" },
  { id: "github-repos", to: "/console/github/repos", label: "仓库", anyOf: ["github.org.read"], icon: "i-carbon-repo-source-code", group: "github" },
  { id: "github-teams", to: "/console/github/teams", label: "团队", anyOf: ["github.org.read"], icon: "i-carbon-group", group: "github" },
  { id: "github-activity", to: "/console/github/activity", label: "活动", anyOf: ["github.org.read"], icon: "i-carbon-activity", group: "github" },
  { id: "github-security", to: "/console/github/security", label: "安全", anyOf: ["github.org.manage"], icon: "i-carbon-security", group: "github" },
  { id: "github-org", to: "/console/github/org", label: "组织资料", anyOf: ["github.org.read"], icon: "i-carbon-building", group: "github" },
  { id: "github-invitations", to: "/console/github/invitations", label: "邀请", anyOf: ["github.invites.manage"], icon: "i-carbon-email", group: "github" },
  { id: "github-invite-links", to: "/console/github/invite-links", label: "邀请链接", anyOf: ["github.invites.manage"], icon: "i-carbon-link", group: "github" },
  { id: "people", to: "/console/people", label: "成员与权限", anyOf: ROLE_CAPABILITIES, icon: "i-carbon-user-admin", group: "class" },
  { id: "competitions", to: "/console/competitions", label: "比赛", anyOf: ["competitions.manage"], icon: "i-carbon-trophy", group: "community" },
  { id: "feedback", to: "/console/feedback", label: "意见箱", anyOf: ["feedback.read"], icon: "i-carbon-chat", group: "class" },
  { id: "audit", to: "/console/audit", label: "审计日志", anyOf: ["audit.read"], icon: "i-carbon-catalog", group: "class" },
  { id: "invites", to: "/console/invites", label: "注册邀请码", anyOf: ["accounts.invites.manage"], icon: "i-carbon-ticket", group: "class" },
];

type Identity = Pick<ConsoleMe, "capabilities">;

/**
 * 只显示实际持有的能力（站内称号给的，#262 第四期）。GitHub 组织的页面在 GitHub 还没接上时照常显示，
 * 点进去由能力门说明（components/CapabilityGate.vue）。
 */
export function navState(item: Pick<NavItem, "anyOf">, me: Identity): NavState {
  return item.anyOf.some(capability => me.capabilities.includes(capability)) ? "visible" : "hidden";
}

/** 这一组能力是不是 GitHub 组织的：这些页面要服务器接上 GitHub 才能用。 */
export const needsGithubConnection = (anyOf: Capability[]): boolean => anyOf.length > 0 && anyOf.every(capability => capability.startsWith("github."));

/** 按当前生效能力裁剪导航；直接访问仍由页面与服务端分别校验。 */
export function visibleNav(me: Identity, items: NavItem[] = CONSOLE_NAV): NavItem[] {
  return items.filter(item => navState(item, me) === "visible");
}

/** 当前路径对应的导航项：取最长匹配；`end` 项只精确匹配。 */
export function activeNavId(path: string, items: NavItem[] = CONSOLE_NAV): string | null {
  const clean = path.replace(/\/+$/, "") || "/";
  let best: NavItem | null = null;
  for (const item of items) {
    const hit = item.end ? clean === item.to : clean === item.to || clean.startsWith(`${item.to}/`);
    if (hit && (!best || item.to.length > best.to.length)) best = item;
  }
  return best?.id ?? null;
}
