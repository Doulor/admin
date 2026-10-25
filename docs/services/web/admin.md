# Admin 模块合同（已迁出 `app/web`）

> 管理端前端已从 `app/web/sites/admin`（React）迁到独立的 Vue 包 `app/console`；本页只记录迁移事实与仍然有效的服务端约定。

状态：`current` · 更新：2026-10-23 · 前端：`app/console/`（见 [console 合同](../console/README.md)） · 后端：`app/server/src/routes/admin`、`app/server/src/routes/console`

## 迁移

2026-09-24（#13）起，`app/web/sites/admin` 与它独占的共享组件（`FeedbackFab`、`DiffView`、`NumberInput`）已删除。极客班控制台与 GitHub 组织管理页面都在 `app/console`，用 Tuffex 组件实现，路由是 `/console/**`；旧的多组织入口 `/admin`、`/admin/:org/*` 不再有页面，统一跳到 `/console`，组织固定为 `CONSOLE_ORG`。`app/web` 现在只剩官网 `sites/portal` 与 `shared`。

## 仍然有效的服务端约定

组织 API `/api/admin/:org/*` 先 requireAuth，再按称号给的能力授权（`requireGithub` / `requireManagedOrg`，#262 第四期），`:org` 必须是 `CONSOLE_ORG`，不看本人在 GitHub 组织里的角色。读写 GitHub 由服务器接入：配了 GitHub App 用 App 的安装令牌，没配时用本人的 GitHub 会话令牌（这时 Issue/PR 还受他自己在 GitHub 上的仓库权限限制），都没有回 409 `github_not_connected`。按钮不是授权机制。

公开邀请兑换时用服务器的 GitHub App，没配 App 时用链接发起人存下的令牌（这是唯一的代持 token 场景，不推广为通用 GitHub 代理）。组织审计不可暴露其他组织或全局登录事件。

危险操作先确认，取消时不应已经发送评论等部分操作。PR 合并携带用户检查的 head SHA。没有对应能力的人不显示写入口。前端怎样落实这些约定见 [console 合同](../console/README.md)「状态」。

服务端回归测试验证只管 `CONSOLE_ORG`、能力、GitHub App 与会话两种接入、邀请、合并 SHA；外部客户端全部明确模拟，不操作真实仓库。前端的确认取消、移动导航见 `tests/e2e/workflows.spec.ts`。
