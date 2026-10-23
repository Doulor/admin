import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { FORUM_CAPABILITIES, ROLE_CAPABILITIES } from "./lib/nav";

/**
 * 路由。控制台拥有 /console/**、/signin、/device、/account、/authorize、/bind-email；旧的 /admin 与 /admin/:org/** 不再保留多组织页面，
 * 一律跳到 /console（组织固定为 CONSOLE_ORG，服务端 /api/admin/:org/* 接口不变）。
 * `meta.anyOf` 是页面所需能力（任一即可），components/ConsoleShell.vue 把它交给 components/CapabilityGate.vue 显示「没有权限」。
 */
// githubOptional：页面没接上 GitHub 也能打开（只有部分操作要 GitHub，页面自己说明），能力门不拦
const gated = (anyOf: string[], load: () => Promise<unknown>, githubOptional = false) => ({ component: load, meta: { anyOf, githubOptional } });

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/console" },
  { path: "/signin", component: () => import("./pages/SignIn.vue") },
  // 设备授权确认页（RFC 8628，给 `geek login`）：和 /signin 一样不在控制台壳子里，只要登录、不要控制台能力。
  { path: "/device", component: () => import("./pages/Device.vue") },
  // 对外授权的同意页（#270，GitLab 等不同源的应用第一次用极客班账号登录时）：同样不在控制台壳子里，只要登录。
  { path: "/authorize", component: () => import("./pages/Authorize.vue") },
  // 账号页（#262）：登录方式、绑定邮箱、密码、成员资格。任何登录的人都能来，不在控制台壳子里。
  { path: "/account", component: () => import("./pages/Account.vue") },
  // 绑定邮箱页（#273）：账号还没有登录邮箱时官网、论坛、控制台都先带人来这里。只有绑定和退出，不在控制台壳子里。
  { path: "/bind-email", component: () => import("./pages/BindEmail.vue") },
  { path: "/console/signin", redirect: to => ({ path: "/signin", query: to.query }) },
  { path: "/admin/signin", redirect: to => ({ path: "/signin", query: to.query }) },
  { path: "/admin/:rest(.*)*", redirect: "/console" },
  {
    path: "/console",
    component: () => import("./pages/ConsoleRoot.vue"),
    children: [
      { path: "", ...gated(["console.access"], () => import("./pages/Overview.vue")) },
      { path: "applications", ...gated(["applications.read"], () => import("./pages/Applications.vue")) },
      { path: "applications/:applicationId", ...gated(["applications.read"], () => import("./pages/ApplicationDetail.vue")) },
      { path: "forum", ...gated(FORUM_CAPABILITIES, () => import("./pages/Forum.vue")) },
      { path: "people", ...gated(ROLE_CAPABILITIES, () => import("./pages/People.vue")) },
      { path: "competitions", ...gated(["competitions.manage"], () => import("./pages/Competitions.vue")) },
      { path: "competitions/:id", ...gated(["competitions.manage"], () => import("./pages/CompetitionHub.vue")) },
      { path: "feedback", ...gated(["feedback.read"], () => import("./pages/Feedback.vue")) },
      { path: "audit", ...gated(["audit.read"], () => import("./pages/Audit.vue")) },
      { path: "invites", ...gated(["accounts.invites.manage"], () => import("./pages/Invites.vue")) },
      { path: "github", ...gated(["github.org.read"], () => import("./pages/github/Overview.vue")) },
      { path: "github/members", ...gated(["github.org.read"], () => import("./pages/github/Members.vue")) },
      { path: "github/repos", ...gated(["github.org.read"], () => import("./pages/github/Repos.vue")) },
      { path: "github/repos/new", ...gated(["github.repos.manage"], () => import("./pages/github/CreateRepo.vue")) },
      { path: "github/repos/:repo/:tab(commits|issues|pulls|settings)?", ...gated(["github.org.read"], () => import("./pages/github/RepoDetail.vue")) },
      { path: "github/repos/:repo/:tab(issues|pulls)/:number(\\d+)", ...gated(["github.org.read"], () => import("./pages/github/RepoDetail.vue")) },
      { path: "github/teams", ...gated(["github.org.read"], () => import("./pages/github/Teams.vue")) },
      { path: "github/activity", ...gated(["github.org.read"], () => import("./pages/github/Activity.vue")) },
      { path: "github/security", ...gated(["github.org.manage"], () => import("./pages/github/Security.vue")) },
      { path: "github/org", ...gated(["github.org.read"], () => import("./pages/github/OrgSettings.vue")) },
      { path: "github/invitations", ...gated(["github.invites.manage"], () => import("./pages/github/Invitations.vue")) },
      { path: "github/invite-links", ...gated(["github.invites.manage"], () => import("./pages/github/InviteLinks.vue"), true) },
      { path: ":rest(.*)*", redirect: "/console" },
    ],
  },
  { path: "/:rest(.*)*", redirect: "/console" },
];

export const router = createRouter({
  history: createWebHistory("/"),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
});
