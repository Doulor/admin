# task/238/competition_app · crosery · 2026-10-20

负责人：crosery

## 03:08:11 +08:00 · 返工 · #238 · 按所有者要求把比赛方案改为 accepted，昵称头像取统一资料

- 执行者：agent-notion-geek-handoff（Notion AI，接手 Codex PR 跟进）
- 做了什么：所有者 2026-10-19 要求合并 #243、关闭 #238，并要求头像和昵称在比赛、官网、控制台、论坛用同一套、改了同步生效。COMPETITION-APP.md 状态改为 accepted（未实施）；队伍成员与名单按 account_id 批量取统一资料 ProfileCard（昵称、@用户名、头像），统一资料上线前同一形状里填绑定 GitHub 的登录名和头像，比赛表不存名字或头像快照；统一登录规格的链接从 fork 固定提交改为仓库内链接；ADR-0005 与 UNIFIED-LOGIN.md 各改 1 行指向仓库内方案；plan/README 与 portal.md 改为 accepted；238.json 补覆盖路径、交付与回滚说明
- 结果：只改方案文档、生成文件与记录，没改 app、tests、scripts、deploy、.github；#239 由 PR #261 实现，不改动它
- 下一步：提交并推送

## 03:08:11 +08:00 · 提交 · #238 · 合入 origin/stage（704cd642）并提交方案改为 accepted

- 执行者：agent-notion-geek-handoff（Notion AI，接手 Codex PR 跟进）
- 做了什么：先用 merge commit 合入 origin/stage（704cd642，带入 #242），冲突只有 docs/plan/README.md 的更新日期，取 2026-10-20，docs/INDEX.md 与项目目录在合并结果上重新生成；再提交上一条的改动
- 结果：pnpm check（Node 22.23.2）退出 0：文档同步、项目目录（179 方法路径/28 表/21 能力）、宏观对齐（87 个关联节点）、文档链接与执行记录全部通过，具体数字见提交正文
- 下一步：推到 fork，等 CI 与 e2e；更新 #243 正文后以 merge commit 合并，关闭 #238 并留关闭记录，在主目录 task.mjs finish 238；#239 保持打开
