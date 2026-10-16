# task/245/pr_front_preview · crosery · 2026-10-16

负责人：crosery

## 12:01:43 +08:00 · 开工 · #245 · 从 origin/stage 4d1bdef74a9c 建 task/245/pr_front_preview

- 执行者：agent-claude-geek-245（Claude Code，sonnet-5-5）
- 做了什么：node scripts/task.mjs start 245 pr_front_preview：建分支与 worktree .claude/worktrees/task-245，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 13:20:01 +08:00 · 开发 · #245 · 改走 Netlify Deploy Preview，加预览构建开关与组装脚本

- 执行者：agent-claude-geek-245（Claude Code，sonnet-5-5）
- 做了什么：所有者在会话里给出 Netlify 团队页，要求看 Netlify 的 PR 自动部署，所以主方案从 Cloudflare Pages 改成 Netlify Deploy Preview（它在自家服务器构建、免费版部署预览不扣额度，且 200 回落默认不盖真实文件，不用自写 Worker）。web 与 console 加 VITE_PREVIEW_MOCK 编译期常量（未设置时仍被构建删掉样板数据），新增 scripts/pr-preview.mjs assemble 与根目录 netlify.toml，tests/tooling/pr-preview.test.ts 8 条。已建的 Cloudflare 令牌与两个 Actions secret 不再需要，待所有者确认后撤销。文档核对：docs/services/web/README.md、docs/services/console/README.md、docs/ops/CICD.md 已改
- 结果：web、console 类型检查通过；带开关构建后本机预览官网与控制台均无 /api 请求且显示样板数据；tests/tooling/pr-preview.test.ts 通过
