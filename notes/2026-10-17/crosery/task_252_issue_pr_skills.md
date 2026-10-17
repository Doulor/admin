# task/252/issue_pr_skills · crosery · 2026-10-17

负责人：crosery

## 15:59:06 +08:00 · 开工 · #252 · 从 origin/stage 8e9bcbb03e00 建 task/252/issue_pr_skills

- 执行者：agent-claude-geek-main-252（Claude Code，claude-sonnet-5-5）
- 做了什么：node scripts/task.mjs start 252 issue_pr_skills：建分支与 worktree .claude/worktrees/task-252，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 18:01:24 +08:00 · 开发 · #252 · 接手 #253：改写为经验性技能，并用 omp 的 3 个模型做对照实验

- 执行者：agent-claude-geek-main-252（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 issue-intake、pr-delivery 两个经验性技能（各 16、19 行），ISSUES 与 PULL-REQUESTS 各加一句指针，check-docs.mjs 改为遍历 .agents/skills/*；在 omp 上用 deepseek-v4.1-flash、gemini-3.1-flash-lite、gemini-3.8-flash-high 跑 A（无技能）、B1（第一版技能）、B2（加完成判据与自检）、B3（B2 加 AGENTS.md 常驻指针）四组，共 120 次，评分调用仓库真实的 checkIssue 与 checkPullRequest，gh 换成桩记录调用
- 结果：写入类 gh 调用 0/108；查重 ds 四组都是 6/6，gem 5/6 到 6/6，lite 0/6 到 1/6；伪造截图占位 A 2/27、B1 3/27、B2 0/27、B3 2/27；t2 可避免报错均值 0.3 到 0.6。各组差异在 n=9 下不超过一次运行，未测出技能对遵循度的稳定提升。未验证：codex、gemini CLI、更弱模型、长流程
