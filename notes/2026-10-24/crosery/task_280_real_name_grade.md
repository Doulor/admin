# task_280_real_name_grade · crosery · 2026-10-24

负责人：crosery

## 13:54:04 +08:00 · 开工 · #280 · #280 实名信息：真实姓名、年级、强制邮箱，登录页改成极客班内部登录

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：从 stage e43df562 建 task/280/real_name_grade 和 worktree .claude/worktrees/task-280（GitHub 的 issue 不在用，task.mjs start 查不到 GitLab issue，worktree 手工建），pnpm install --offline。先提交年级函数和两个新列（6c 开头的提交），#278 从这个提交拉分支，两边算年级用同一份代码。
- 结果：worktree 已建好；grade.test.ts 4 条、profile.test.ts 14 条通过
- 下一步：接 /auth/me、补资料接口、注册、控制台用户页、各端拦截和登录页文案
