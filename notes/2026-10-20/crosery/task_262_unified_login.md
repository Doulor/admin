# task/262/unified_login · crosery · 2026-10-20

负责人：crosery

## 17:56:56 +08:00 · 开工 · #262 · 从 origin/stage b51bf137626f 建 task/262/unified_login

- 执行者：agent-notion-geek（Notion AI，经 wanctl 操作公司 Mac）
- 做了什么：node scripts/task.mjs start 262 unified_login：建分支与 worktree .claude/worktrees/task-262，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 23:37:41 +08:00 · 开发 · #262 · 交付 1：极客班账号底座与 GitHub 登录事务

- 执行者：agent-notion-geek（Notion AI，经 wanctl 操作公司 Mac）
- 做了什么：按 docs/plan/UNIFIED-LOGIN.md 交付 1 只做后端。db.ts 新建 users、identities、identity_audit，给 sessions（openid、provider）、role_assignments（account_id）、forum_users（account_id）、audit_logs（actor_account_id）加可空列和索引，启动时按 GitHub id 在一个事务里幂等回填（console_seeds 记 identity_v1，审计记 system 的 identity.backfill）。新增 lib/identity-store.ts：GitHub 回调的外部请求在事务外，写库在一个事务里建号或复用账号、跟随合并链（最多 8 跳）、认领称号与论坛用户、作废旧会话并签新会话、写 identity_audit；停用账号拒绝登录、结束会话并撤销授权，回跳 ?signin=account_disabled；任何一步失败整体回滚，旧会话仍有效。新增 GET /auth/providers（交付 1 只有 GitHub）；/auth/me 增加 account_id、provider；审计多写 actor_account_id。登录页、失败回跳方式与三端入口不改。测试：helpers 新增 signIn 走真实登录事务，13 个服务端测试文件与 2 个 e2e 改用它；新增 tests/server/identity.test.ts 与 legacy-database 的回填用例。文档：SECURITY、API、endpoint-contracts、server README、data-model、UNIFIED-LOGIN 同步，ownership 登记新表、新路由与 identity.providers，重建项目目录与 docs/INDEX.md，写 docs/changes/262.json。改动先在 Notion AI 沙箱副本（同样基于 stage 4beda55e）里做完并跑过服务端测试，再以补丁应用到本 worktree。
- 结果：公司 Mac（Node 22.23.2）：pnpm check 退出 0（宏观对齐 #262：63 个变更文件、205 个关联节点；项目目录 181 方法路径、31 表；执行记录 89 条链路）；pnpm test 84 个文件 1308 条通过，其中 identity 7 条、legacy-database 6 条。本地预览（本分支服务端、内存库、GitHub 登录关闭）：GET /auth/providers 200 只有 github，GET /auth/me 200 {"signed_in":false}；预发布 rc.6 的 GET /auth/providers 是 404。改前（rc.6）改后（本地预览）的官网登录入口截图，桌面 1440×900 与手机 390×844 文案和跳转一致，存在 Crosery 名下的 gist。

## 23:37:41 +08:00 · 提交 · #262 · 提交账号底座、登录事务与测试文档

- 执行者：agent-notion-geek（Notion AI，经 wanctl 操作公司 Mac）
- 做了什么：git commit：feat(server): 统一登录交付 1：极客班账号底座与 GitHub 登录事务（实现、测试、文档、项目目录与本执行记录），父提交 cd7cf402（#265 收尾记录）。
- 结果：提交前 pnpm check 与 pnpm test 已通过（见上一条）；提交号和钩子结果记在推送那一条。
