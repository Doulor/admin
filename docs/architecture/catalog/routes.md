# 后端接口目录

> 真实 Fastify 注册的方法、路径、Schema 与源码位置；含根路由、嵌套插件、循环注册及自动 HEAD。

状态：`current` · 更新：2026-10-24 · 自动生成，不手工编辑。

来源摘要：`d3d74fe7b4c4f9f70250c97ca59fdbe62d6284972c1b04771fad7fc52ae16d5f`。更新日期指目录声明版本，数据新鲜度由摘要和 `pnpm check:catalog` 核对。

[使用与维护](README.md) · [总览](CATALOG.md) · [接口](routes.md) · [数据](data-model.md) · [权限](permissions.md) · [机器目录](catalog.json)

[接口行为契约](../../services/server/endpoint-contracts.md)按方法和路径说明成功响应、失败、资源授权及副作用；[业务流程](CATALOG.md#业务流程)关联数据库读写，地图中可沿接口与流程互相跳转。

Schema 完整内容在机器目录；这里的授权项只是源码检查证据，不是完整策略。没有直接检查不能解释为匿名可用。数据库、外部 HTTP 和发信均使用隔离配置，没有监听端口。

## 业务与认证

| 方法与路径 | 业务域 | 注册 | 请求 Schema | 响应 Schema | 授权检查证据 | 源码 |
|---|---|---|---|---|---|---|
| `DELETE /api/competitions/:id/signup` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:49](../../../app/server/src/routes/portal/competition-signups.ts#L49) |
| `DELETE /api/console/competitions/:competition_id` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competitions.ts:87](../../../app/server/src/routes/console/competitions.ts#L87) |
| `DELETE /api/console/feedback/:id` | `feedback` | 显式 | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/feedback.ts:31](../../../app/server/src/routes/console/feedback.ts#L31) |
| `DELETE /api/console/permission-groups/:id` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:208](../../../app/server/src/routes/console/permission-groups.ts#L208) |
| `DELETE /api/console/permission-groups/:id/members/:account_id` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:266](../../../app/server/src/routes/console/permission-groups.ts#L266) |
| `DELETE /api/forum/me/avatar` | `forum` | 显式 | `params`、`querystring` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/people.ts:91](../../../app/server/src/routes/forum-api/people.ts#L91) |
| `DELETE /api/forum/posts/:post_id` | `forum` | 显式 | `params`、`querystring` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/posts.ts:105](../../../app/server/src/routes/forum-api/posts.ts#L105) |
| `DELETE /api/teams/:id` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:92](../../../app/server/src/routes/portal/competition-signups.ts#L92) |
| `DELETE /api/teams/:id/lock` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:98](../../../app/server/src/routes/portal/competition-signups.ts#L98) |
| `GET /api/competitions/:id/free-agents` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:57](../../../app/server/src/routes/portal/competition-signups.ts#L57) |
| `GET /api/competitions/:id/leaderboard` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:101](../../../app/server/src/routes/portal/competition-signups.ts#L101) |
| `GET /api/competitions/:id/my-status` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:39](../../../app/server/src/routes/portal/competition-signups.ts#L39) |
| `GET /api/competitions/:id/teams` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:52](../../../app/server/src/routes/portal/competition-signups.ts#L52) |
| `GET /api/console/accounts/:id/activity` | `audit` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/activity.ts:117](../../../app/server/src/routes/console/activity.ts#L117) |
| `GET /api/console/accounts/:id/effective` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/accounts.ts:12](../../../app/server/src/routes/console/accounts.ts#L12) |
| `GET /api/console/activity` | `audit` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/activity.ts:88](../../../app/server/src/routes/console/activity.ts#L88) |
| `GET /api/console/activity.csv` | `audit` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/activity.ts:103](../../../app/server/src/routes/console/activity.ts#L103) |
| `GET /api/console/applications` | `recruitment` | 显式 | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:49](../../../app/server/src/routes/console/applications.ts#L49) |
| `GET /api/console/applications/:application_id` | `recruitment` | 显式 | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:105](../../../app/server/src/routes/console/applications.ts#L105) |
| `GET /api/console/applications/export.csv` | `recruitment` | 显式 | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:78](../../../app/server/src/routes/console/applications.ts#L78) |
| `GET /api/console/competitions` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competitions.ts:37](../../../app/server/src/routes/console/competitions.ts#L37) |
| `GET /api/console/competitions/:competition_id/roster` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:56](../../../app/server/src/routes/console/competition-roster.ts#L56) |
| `GET /api/console/competitions/:competition_id/roster.csv` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:66](../../../app/server/src/routes/console/competition-roster.ts#L66) |
| `GET /api/console/competitions/:competition_id/score-events` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:91](../../../app/server/src/routes/console/competition-roster.ts#L91) |
| `GET /api/console/departments` | `organization` | 显式 | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/departments.ts:13](../../../app/server/src/routes/console/departments.ts#L13) |
| `GET /api/console/feedback` | `feedback` | 显式 | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/feedback.ts:12](../../../app/server/src/routes/console/feedback.ts#L12) |
| `GET /api/console/gitlab/accounts` | `gitlab` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:19](../../../app/server/src/routes/console/gitlab.ts#L19) |
| `GET /api/console/gitlab/projects` | `gitlab` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:41](../../../app/server/src/routes/console/gitlab.ts#L41) |
| `GET /api/console/gitlab/settings` | `gitlab` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:43](../../../app/server/src/routes/console/gitlab.ts#L43) |
| `GET /api/console/gitlab/status` | `gitlab` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:32](../../../app/server/src/routes/console/gitlab.ts#L32) |
| `GET /api/console/invites` | `identity` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/invites.ts:17](../../../app/server/src/routes/console/invites.ts#L17) |
| `GET /api/console/me` | `organization` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/me.ts:28](../../../app/server/src/routes/console/me.ts#L28) |
| `GET /api/console/permission-groups` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:109](../../../app/server/src/routes/console/permission-groups.ts#L109) |
| `GET /api/console/permission-groups/:id/members` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:224](../../../app/server/src/routes/console/permission-groups.ts#L224) |
| `GET /api/console/permissions/explain` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permissions.ts:20](../../../app/server/src/routes/console/permissions.ts#L20) |
| `GET /api/console/permissions/nodes` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permissions.ts:15](../../../app/server/src/routes/console/permissions.ts#L15) |
| `GET /api/console/summary` | `organization` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/me.ts:59](../../../app/server/src/routes/console/me.ts#L59) |
| `GET /api/console/users` | `permissions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/users.ts:115](../../../app/server/src/routes/console/users.ts#L115) |
| `GET /api/docs` | `public_content` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/docs.ts:16](../../../app/server/src/routes/portal/docs.ts#L16) |
| `GET /api/docs/:id` | `public_content` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/docs.ts:23](../../../app/server/src/routes/portal/docs.ts#L23) |
| `GET /api/feedback/categories` | `feedback` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/feedback.ts:24](../../../app/server/src/routes/portal/feedback.ts#L24) |
| `GET /api/feedback/public` | `feedback` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/feedback.ts:66](../../../app/server/src/routes/portal/feedback.ts#L66) |
| `GET /api/forum/avatars/:file` | `forum` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/people.ts:99](../../../app/server/src/routes/forum-api/people.ts#L99) |
| `GET /api/forum/search` | `forum` | 显式 | `params`、`querystring` | 未声明 | `forumViewer(req)` | [app/server/src/routes/forum-api/topics.ts:44](../../../app/server/src/routes/forum-api/topics.ts#L44) |
| `GET /api/forum/state` | `forum` | 显式 | `params`、`querystring` | 未声明 | `forumViewer(req)` | [app/server/src/routes/forum-api/topics.ts:22](../../../app/server/src/routes/forum-api/topics.ts#L22) |
| `GET /api/forum/topics/:topic_id/posts` | `forum` | 显式 | `params`、`querystring` | 未声明 | `forumViewer(req)` | [app/server/src/routes/forum-api/topics.ts:33](../../../app/server/src/routes/forum-api/topics.ts#L33) |
| `GET /api/identity/avatar/:file` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:36](../../../app/server/src/routes/identity/profile.ts#L36) |
| `GET /api/identity/device` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:92](../../../app/server/src/routes/identity/device.ts#L92) |
| `GET /api/identity/me` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:47](../../../app/server/src/routes/identity/account.ts#L47) |
| `GET /api/identity/profile` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:23](../../../app/server/src/routes/identity/profile.ts#L23) |
| `GET /api/me/applications` | `recruitment` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/my-applications.ts:18](../../../app/server/src/routes/portal/my-applications.ts#L18) |
| `GET /api/me/competitions` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:37](../../../app/server/src/routes/portal/competition-signups.ts#L37) |
| `GET /api/public/competitions` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competitions.ts:13](../../../app/server/src/routes/portal/competitions.ts#L13) |
| `GET /api/public/competitions/:id` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competitions.ts:24](../../../app/server/src/routes/portal/competitions.ts#L24) |
| `GET /api/public/config` | `platform` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/public-config.ts:15](../../../app/server/src/routes/portal/public-config.ts#L15) |
| `GET /api/public/departments` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/departments.ts:17](../../../app/server/src/routes/portal/departments.ts#L17) |
| `GET /api/public/gitlab/projects` | `gitlab` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/gitlab.ts:12](../../../app/server/src/routes/portal/gitlab.ts#L12) |
| `GET /api/public/org` | `organization` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/org.ts:11](../../../app/server/src/routes/portal/org.ts#L11) |
| `GET /auth/callback` | `identity` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:45](../../../app/server/src/routes/admin/auth.ts#L45) |
| `GET /auth/device/userinfo` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:140](../../../app/server/src/routes/identity/device.ts#L140) |
| `GET /auth/github` | `identity` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:37](../../../app/server/src/routes/admin/auth.ts#L37) |
| `GET /auth/google` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/google.ts:24](../../../app/server/src/routes/identity/google.ts#L24) |
| `GET /auth/google/callback` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/google.ts:35](../../../app/server/src/routes/identity/google.ts#L35) |
| `GET /auth/me` | `identity` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:154](../../../app/server/src/routes/admin/auth.ts#L154) |
| `GET /auth/providers` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/providers.ts:30](../../../app/server/src/routes/identity/providers.ts#L30) |
| `GET /oidc/*` | `identity` | 显式 | 未声明 | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:167](../../../app/server/src/routes/oidc/index.ts#L167) |
| `GET /oidc/interaction/:uid` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:68](../../../app/server/src/routes/oidc/index.ts#L68) |
| `GET /oidc/interaction/:uid/details` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:117](../../../app/server/src/routes/oidc/index.ts#L117) |
| `HEAD /api/competitions/:id/free-agents` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:57](../../../app/server/src/routes/portal/competition-signups.ts#L57) |
| `HEAD /api/competitions/:id/leaderboard` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:101](../../../app/server/src/routes/portal/competition-signups.ts#L101) |
| `HEAD /api/competitions/:id/my-status` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:39](../../../app/server/src/routes/portal/competition-signups.ts#L39) |
| `HEAD /api/competitions/:id/teams` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:52](../../../app/server/src/routes/portal/competition-signups.ts#L52) |
| `HEAD /api/console/accounts/:id/activity` | `audit` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/activity.ts:117](../../../app/server/src/routes/console/activity.ts#L117) |
| `HEAD /api/console/accounts/:id/effective` | `permissions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/console/accounts.ts:12](../../../app/server/src/routes/console/accounts.ts#L12) |
| `HEAD /api/console/activity` | `audit` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/activity.ts:88](../../../app/server/src/routes/console/activity.ts#L88) |
| `HEAD /api/console/activity.csv` | `audit` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/activity.ts:103](../../../app/server/src/routes/console/activity.ts#L103) |
| `HEAD /api/console/applications` | `recruitment` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:49](../../../app/server/src/routes/console/applications.ts#L49) |
| `HEAD /api/console/applications/:application_id` | `recruitment` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:105](../../../app/server/src/routes/console/applications.ts#L105) |
| `HEAD /api/console/applications/export.csv` | `recruitment` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:78](../../../app/server/src/routes/console/applications.ts#L78) |
| `HEAD /api/console/competitions` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/competitions.ts:37](../../../app/server/src/routes/console/competitions.ts#L37) |
| `HEAD /api/console/competitions/:competition_id/roster` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:56](../../../app/server/src/routes/console/competition-roster.ts#L56) |
| `HEAD /api/console/competitions/:competition_id/roster.csv` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:66](../../../app/server/src/routes/console/competition-roster.ts#L66) |
| `HEAD /api/console/competitions/:competition_id/score-events` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:91](../../../app/server/src/routes/console/competition-roster.ts#L91) |
| `HEAD /api/console/departments` | `organization` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/departments.ts:13](../../../app/server/src/routes/console/departments.ts#L13) |
| `HEAD /api/console/feedback` | `feedback` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/feedback.ts:12](../../../app/server/src/routes/console/feedback.ts#L12) |
| `HEAD /api/console/gitlab/accounts` | `gitlab` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:19](../../../app/server/src/routes/console/gitlab.ts#L19) |
| `HEAD /api/console/gitlab/projects` | `gitlab` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:41](../../../app/server/src/routes/console/gitlab.ts#L41) |
| `HEAD /api/console/gitlab/settings` | `gitlab` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:43](../../../app/server/src/routes/console/gitlab.ts#L43) |
| `HEAD /api/console/gitlab/status` | `gitlab` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:32](../../../app/server/src/routes/console/gitlab.ts#L32) |
| `HEAD /api/console/invites` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/invites.ts:17](../../../app/server/src/routes/console/invites.ts#L17) |
| `HEAD /api/console/me` | `organization` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/me.ts:28](../../../app/server/src/routes/console/me.ts#L28) |
| `HEAD /api/console/permission-groups` | `permissions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:109](../../../app/server/src/routes/console/permission-groups.ts#L109) |
| `HEAD /api/console/permission-groups/:id/members` | `permissions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:224](../../../app/server/src/routes/console/permission-groups.ts#L224) |
| `HEAD /api/console/permissions/explain` | `permissions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permissions.ts:20](../../../app/server/src/routes/console/permissions.ts#L20) |
| `HEAD /api/console/permissions/nodes` | `permissions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permissions.ts:15](../../../app/server/src/routes/console/permissions.ts#L15) |
| `HEAD /api/console/summary` | `organization` | 自动 HEAD | `params`、`querystring` | 未声明 | `requireAuth` | [app/server/src/routes/console/me.ts:59](../../../app/server/src/routes/console/me.ts#L59) |
| `HEAD /api/console/users` | `permissions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/console/users.ts:115](../../../app/server/src/routes/console/users.ts#L115) |
| `HEAD /api/docs` | `public_content` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/docs.ts:16](../../../app/server/src/routes/portal/docs.ts#L16) |
| `HEAD /api/docs/:id` | `public_content` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/docs.ts:23](../../../app/server/src/routes/portal/docs.ts#L23) |
| `HEAD /api/feedback/categories` | `feedback` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/feedback.ts:24](../../../app/server/src/routes/portal/feedback.ts#L24) |
| `HEAD /api/feedback/public` | `feedback` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/feedback.ts:66](../../../app/server/src/routes/portal/feedback.ts#L66) |
| `HEAD /api/forum/avatars/:file` | `forum` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/people.ts:99](../../../app/server/src/routes/forum-api/people.ts#L99) |
| `HEAD /api/forum/state` | `forum` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/topics.ts:27](../../../app/server/src/routes/forum-api/topics.ts#L27) |
| `HEAD /api/identity/avatar/:file` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:36](../../../app/server/src/routes/identity/profile.ts#L36) |
| `HEAD /api/identity/device` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:92](../../../app/server/src/routes/identity/device.ts#L92) |
| `HEAD /api/identity/me` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:47](../../../app/server/src/routes/identity/account.ts#L47) |
| `HEAD /api/identity/profile` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:23](../../../app/server/src/routes/identity/profile.ts#L23) |
| `HEAD /api/me/applications` | `recruitment` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/my-applications.ts:18](../../../app/server/src/routes/portal/my-applications.ts#L18) |
| `HEAD /api/me/competitions` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:37](../../../app/server/src/routes/portal/competition-signups.ts#L37) |
| `HEAD /api/public/competitions` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competitions.ts:13](../../../app/server/src/routes/portal/competitions.ts#L13) |
| `HEAD /api/public/competitions/:id` | `competitions` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competitions.ts:24](../../../app/server/src/routes/portal/competitions.ts#L24) |
| `HEAD /api/public/config` | `platform` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/public-config.ts:15](../../../app/server/src/routes/portal/public-config.ts#L15) |
| `HEAD /api/public/departments` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/departments.ts:17](../../../app/server/src/routes/portal/departments.ts#L17) |
| `HEAD /api/public/gitlab/projects` | `gitlab` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/gitlab.ts:12](../../../app/server/src/routes/portal/gitlab.ts#L12) |
| `HEAD /api/public/org` | `organization` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/org.ts:11](../../../app/server/src/routes/portal/org.ts#L11) |
| `HEAD /auth/callback` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:45](../../../app/server/src/routes/admin/auth.ts#L45) |
| `HEAD /auth/device/userinfo` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:140](../../../app/server/src/routes/identity/device.ts#L140) |
| `HEAD /auth/github` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:37](../../../app/server/src/routes/admin/auth.ts#L37) |
| `HEAD /auth/google` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/google.ts:24](../../../app/server/src/routes/identity/google.ts#L24) |
| `HEAD /auth/google/callback` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/google.ts:35](../../../app/server/src/routes/identity/google.ts#L35) |
| `HEAD /auth/me` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:154](../../../app/server/src/routes/admin/auth.ts#L154) |
| `HEAD /auth/providers` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/providers.ts:30](../../../app/server/src/routes/identity/providers.ts#L30) |
| `HEAD /oidc/*` | `identity` | 自动 HEAD | 未声明 | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:167](../../../app/server/src/routes/oidc/index.ts#L167) |
| `HEAD /oidc/interaction/:uid` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:68](../../../app/server/src/routes/oidc/index.ts#L68) |
| `HEAD /oidc/interaction/:uid/details` | `identity` | 自动 HEAD | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:117](../../../app/server/src/routes/oidc/index.ts#L117) |
| `PATCH /api/console/applications/:application_id` | `recruitment` | 显式 | `params`、`querystring`、`body` | 未声明 | `requireAuth` | [app/server/src/routes/console/applications.ts:121](../../../app/server/src/routes/console/applications.ts#L121) |
| `PATCH /api/console/competitions/:competition_id` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competitions.ts:60](../../../app/server/src/routes/console/competitions.ts#L60) |
| `PATCH /api/console/feedback/:id` | `feedback` | 显式 | `params`、`querystring`、`body` | 未声明 | `requireAuth` | [app/server/src/routes/console/feedback.ts:18](../../../app/server/src/routes/console/feedback.ts#L18) |
| `PATCH /api/console/gitlab/settings` | `gitlab` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:47](../../../app/server/src/routes/console/gitlab.ts#L47) |
| `PATCH /api/console/invites/:id` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/invites.ts:30](../../../app/server/src/routes/console/invites.ts#L30) |
| `PATCH /api/console/permission-groups/:id` | `permissions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:134](../../../app/server/src/routes/console/permission-groups.ts#L134) |
| `PATCH /api/console/users/:id` | `permissions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/users.ts:161](../../../app/server/src/routes/console/users.ts#L161) |
| `PATCH /api/forum/me/profile` | `forum` | 显式 | `params`、`querystring`、`body` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/people.ts:32](../../../app/server/src/routes/forum-api/people.ts#L32) |
| `PATCH /api/forum/posts/:post_id` | `forum` | 显式 | `params`、`querystring`、`body` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/posts.ts:93](../../../app/server/src/routes/forum-api/posts.ts#L93) |
| `PATCH /api/identity/profile` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:25](../../../app/server/src/routes/identity/profile.ts#L25) |
| `POST /api/competitions/:id/signup` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:44](../../../app/server/src/routes/portal/competition-signups.ts#L44) |
| `POST /api/competitions/:id/teams` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:62](../../../app/server/src/routes/portal/competition-signups.ts#L62) |
| `POST /api/console/competitions` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competitions.ts:42](../../../app/server/src/routes/console/competitions.ts#L42) |
| `POST /api/console/competitions/:competition_id/score-events` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:100](../../../app/server/src/routes/console/competition-roster.ts#L100) |
| `POST /api/console/competitions/:competition_id/score-events/:event_id/revoke` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:119](../../../app/server/src/routes/console/competition-roster.ts#L119) |
| `POST /api/console/gitlab/accounts/:account_id/resync` | `gitlab` | 显式 | `params`、`querystring` | 已挂载 | `requireAuth` | [app/server/src/routes/console/gitlab.ts:23](../../../app/server/src/routes/console/gitlab.ts#L23) |
| `POST /api/console/invites` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/invites.ts:19](../../../app/server/src/routes/console/invites.ts#L19) |
| `POST /api/console/permission-groups` | `permissions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:111](../../../app/server/src/routes/console/permission-groups.ts#L111) |
| `POST /api/console/permission-groups/:id/members` | `permissions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/console/permission-groups.ts:241](../../../app/server/src/routes/console/permission-groups.ts#L241) |
| `POST /api/events` | `audit` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/events.ts:25](../../../app/server/src/routes/portal/events.ts#L25) |
| `POST /api/feedback` | `feedback` | 显式 | `params`、`querystring`、`body` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/feedback.ts:26](../../../app/server/src/routes/portal/feedback.ts#L26) |
| `POST /api/forum/notifications/:notification_id/read` | `forum` | 显式 | `params`、`querystring` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/people.ts:20](../../../app/server/src/routes/forum-api/people.ts#L20) |
| `POST /api/forum/notifications/read-all` | `forum` | 显式 | `params`、`querystring` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/people.ts:26](../../../app/server/src/routes/forum-api/people.ts#L26) |
| `POST /api/forum/posts` | `forum` | 显式 | `params`、`querystring`、`body` | 未声明 | `forumViewer(req)` | [app/server/src/routes/forum-api/posts.ts:41](../../../app/server/src/routes/forum-api/posts.ts#L41) |
| `POST /api/forum/posts/:post_id/bookmark` | `forum` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/posts.ts:124](../../../app/server/src/routes/forum-api/posts.ts#L124) |
| `POST /api/forum/posts/:post_id/like` | `forum` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/posts.ts:116](../../../app/server/src/routes/forum-api/posts.ts#L116) |
| `POST /api/forum/topics` | `forum` | 显式 | `params`、`querystring`、`body` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/topics.ts:55](../../../app/server/src/routes/forum-api/topics.ts#L55) |
| `POST /api/forum/topics/:topic_id/close` | `forum` | 显式 | `params`、`querystring`、`body` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/topics.ts:77](../../../app/server/src/routes/forum-api/topics.ts#L77) |
| `POST /api/forum/topics/:topic_id/pin` | `forum` | 显式 | `params`、`querystring`、`body` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/topics.ts:77](../../../app/server/src/routes/forum-api/topics.ts#L77) |
| `POST /api/forum/topics/:topic_id/view` | `forum` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/topics.ts:90](../../../app/server/src/routes/forum-api/topics.ts#L90) |
| `POST /api/forum/users/:forum_user_id/follow` | `forum` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/forum-api/people.ts:11](../../../app/server/src/routes/forum-api/people.ts#L11) |
| `POST /api/identity/device/approve` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:103](../../../app/server/src/routes/identity/device.ts#L103) |
| `POST /api/identity/email/remove` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:102](../../../app/server/src/routes/identity/account.ts#L102) |
| `POST /api/identity/email/start` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:63](../../../app/server/src/routes/identity/account.ts#L63) |
| `POST /api/identity/email/verify` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:77](../../../app/server/src/routes/identity/account.ts#L77) |
| `POST /api/identity/invite/redeem` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:74](../../../app/server/src/routes/identity/profile.ts#L74) |
| `POST /api/identity/password` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:115](../../../app/server/src/routes/identity/account.ts#L115) |
| `POST /api/identity/real-info` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/account.ts:140](../../../app/server/src/routes/identity/account.ts#L140) |
| `POST /api/portal/apply` | `recruitment` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/apply.ts:109](../../../app/server/src/routes/portal/apply.ts#L109) |
| `POST /api/teams/:id/apply` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:67](../../../app/server/src/routes/portal/competition-signups.ts#L67) |
| `POST /api/teams/:id/invite` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:72](../../../app/server/src/routes/portal/competition-signups.ts#L72) |
| `POST /api/teams/:id/leave` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:84](../../../app/server/src/routes/portal/competition-signups.ts#L84) |
| `POST /api/teams/:id/lock` | `competitions` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:95](../../../app/server/src/routes/portal/competition-signups.ts#L95) |
| `POST /api/teams/:id/respond` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:77](../../../app/server/src/routes/portal/competition-signups.ts#L77) |
| `POST /api/teams/:id/transfer` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/portal/competition-signups.ts:87](../../../app/server/src/routes/portal/competition-signups.ts#L87) |
| `POST /auth/device/code` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:34](../../../app/server/src/routes/identity/device.ts#L34) |
| `POST /auth/device/revoke` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:171](../../../app/server/src/routes/identity/device.ts#L171) |
| `POST /auth/device/token` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/device.ts:58](../../../app/server/src/routes/identity/device.ts#L58) |
| `POST /auth/email/password` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/email.ts:156](../../../app/server/src/routes/identity/email.ts#L156) |
| `POST /auth/email/reset` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/email.ts:184](../../../app/server/src/routes/identity/email.ts#L184) |
| `POST /auth/email/start` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/email.ts:89](../../../app/server/src/routes/identity/email.ts#L89) |
| `POST /auth/email/verify` | `identity` | 显式 | `params`、`querystring`、`body` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/email.ts:104](../../../app/server/src/routes/identity/email.ts#L104) |
| `POST /auth/signout` | `identity` | 显式 | `params`、`querystring` | 未声明 | 需查看 handler 与继承策略 | [app/server/src/routes/admin/auth.ts:95](../../../app/server/src/routes/admin/auth.ts#L95) |
| `POST /oidc/*` | `identity` | 显式 | 未声明 | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:167](../../../app/server/src/routes/oidc/index.ts#L167) |
| `POST /oidc/interaction/:uid/abort` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:151](../../../app/server/src/routes/oidc/index.ts#L151) |
| `POST /oidc/interaction/:uid/confirm` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/oidc/index.ts:134](../../../app/server/src/routes/oidc/index.ts#L134) |
| `PUT /api/console/competitions/:competition_id/signup-settings` | `competitions` | 显式 | `params`、`querystring`、`body` | 已挂载 | `requireAuth` | [app/server/src/routes/console/competition-roster.ts:36](../../../app/server/src/routes/console/competition-roster.ts#L36) |
| `PUT /api/forum/me/avatar` | `forum` | 显式 | `params`、`querystring` | 未声明 | `requireMember(req)` | [app/server/src/routes/forum-api/people.ts:80](../../../app/server/src/routes/forum-api/people.ts#L80) |
| `PUT /api/identity/avatar` | `identity` | 显式 | `params`、`querystring` | 已挂载 | 需查看 handler 与继承策略 | [app/server/src/routes/identity/profile.ts:53](../../../app/server/src/routes/identity/profile.ts#L53) |

## 基础设施与占位

| 方法与路径 | 业务域 | 注册 | 请求 Schema | 响应 Schema | 授权检查证据 | 源码 |
|---|---|---|---|---|---|---|
| `GET /` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:146](../../../app/server/src/app.ts#L146) |
| `GET /forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:126](../../../app/server/src/app.ts#L126) |
| `GET /forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:126](../../../app/server/src/app.ts#L126) |
| `GET /healthz` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:132](../../../app/server/src/app.ts#L132) |
| `HEAD /` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:146](../../../app/server/src/app.ts#L146) |
| `HEAD /forum` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:126](../../../app/server/src/app.ts#L126) |
| `HEAD /forum/*` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:126](../../../app/server/src/app.ts#L126) |
| `HEAD /healthz` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:132](../../../app/server/src/app.ts#L132) |

## 退役兼容

| 方法与路径 | 业务域 | 注册 | 请求 Schema | 响应 Schema | 授权检查证据 | 源码 |
|---|---|---|---|---|---|---|
| `DELETE /api/forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `DELETE /api/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `DELETE /auth/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `DELETE /forum/u/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `GET /api/forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `GET /api/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `GET /auth/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `GET /forum/u/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `HEAD /api/forum` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `HEAD /api/forum/*` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `HEAD /auth/forum/*` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `HEAD /forum/u/*` | `platform` | 自动 HEAD | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `OPTIONS /api/forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `OPTIONS /api/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `OPTIONS /auth/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `OPTIONS /forum/u/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PATCH /api/forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PATCH /api/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PATCH /auth/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PATCH /forum/u/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `POST /api/forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `POST /api/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `POST /auth/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `POST /forum/u/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PUT /api/forum` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PUT /api/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PUT /auth/forum/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |
| `PUT /forum/u/*` | `platform` | 显式 | 未声明 | 未声明 | 需查看 handler 与继承策略 | [app/server/src/app.ts:122](../../../app/server/src/app.ts#L122) |

## 核心之外：Nitro 与预渲染入口

以下是源码声明核对，不是本次运行时观测。路径相对于论坛应用，实际挂载前缀由论坛配置决定；没有启动 Nitro 或读取本机快照。静态文件与 SPA 回落不逐文件枚举。

| 方法与路径 | 范围 | 说明 | 源码 |
|---|---|---|---|
| `GET /__geek_forum` | `development-only` | 本机进程标记，不是业务 API 或认证；import.meta.dev 之外返回 404。 | [app/forum/server/routes/__geek_forum.get.ts:4](../../../app/forum/server/routes/__geek_forum.get.ts#L4) |
| `GET/HEAD /api/local-forum/state` | `development-only` | 只读快照；requireSnapshotRoute 检查开发态、配置和方法；本工具不读取快照。 | [app/forum/server/routes/api/local-forum/state.ts:13](../../../app/forum/server/routes/api/local-forum/state.ts#L13) |
| `GET/HEAD /api/local-forum/assets/:hash` | `development-only` | 按哈希白名单提供只读快照附件及单段 Range；本工具不读取附件。 | [app/forum/server/routes/api/local-forum/assets/[hash].ts:15](../../../app/forum/server/routes/api/local-forum/assets/[hash].ts#L15) |
| `GET/HEAD /llms.txt` | `nitro-and-prerender` | 论坛应用相对路径；Nitro 中间件提供，静态镜像使用预渲染文件，不代表动态读取当前核心论坛数据库。 | [app/forum/server/middleware/forum-markdown.ts:36](../../../app/forum/server/middleware/forum-markdown.ts#L36) |
| `GET/HEAD /t/:id.md` | `nitro-and-prerender` | 论坛应用相对路径；源码匹配的 Markdown 视图，部署时可用文件取决于构建时预渲染内容。 | [app/forum/server/middleware/forum-markdown.ts:26](../../../app/forum/server/middleware/forum-markdown.ts#L26) |
