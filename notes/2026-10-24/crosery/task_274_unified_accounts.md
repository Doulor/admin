# task/274/unified_accounts · crosery · 2026-10-24

负责人：crosery

## 00:12:39 +08:00 · 提交 · #274 · 阶段 1：删 GitHub 组织管理路由，加控制台 GitLab 概览/项目/设置与公开仓库列表

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：删 app/server/src/routes/admin/{overview,members,repos,teams,activity,security,org,orgs,invitations,invite-links,feedback,logs}.ts 与 middleware/{require-github,require-github-session}.ts；admin/index.ts 只留 auth.ts；config.ts 删掉没有任何读者的 ALLOWED_ORGS（连带 deploy/compose/*.yml、deploy/env/.env.*、scripts/deployment-environment.mjs 的声明）；GH_APP_ID/GH_APP_PRIVATE_KEY/CONSOLE_ORG 仍被 lib/github-connection.ts、access.ts、feedback-store.ts、audit.ts 等读取，保留。新增 lib/gitlab-sync.ts 的 health()/errors24h()/listProjects()/lastRun()/applySettings()（运行时可改 mode/group/interval，存 app_state 的 gitlab_settings 键，重启回读）；console/gitlab.ts 加 status/projects/settings 三个接口，sync 接口改名 resync；portal/gitlab.ts 加公开的 GET /api/public/gitlab/projects。更新 tests/server/{core,github-connection,console,signin-methods,upstream-errors,invitations,gitlab-sync}.test.ts 把测试载体从已删路由换成仍存在的（console/assignments.ts 等），新增 11 条 GitLab 新接口的用例。pnpm catalog:generate 与手改 docs/architecture/catalog/ownership.json（删 39 条只服务于已删路由的流程声明与 12 条 routeOwners，改 1 条路径改名，加 5 条新流程）、pnpm docs:index。
- 结果：pnpm typecheck 通过；pnpm test 全仓库 1603 passed（含 tests/tooling 的 catalog-coverage、project-catalog）；pnpm build 通过（server+web+console）；pnpm check:boundaries、check:environments、check:catalog 通过。pnpm check:docs 仍报 docs/services/server/endpoint-contracts.md 引用已删文件路径——文档改写按简报安排在阶段 4 一次性做，暂留红。
- 下一步：阶段 2：权限节点、账号迁移、身份接口
