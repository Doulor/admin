# task/271/gitlab_avatar · crosery · 2026-10-23

负责人：crosery

## 17:08:31 +08:00 · 开工 · #271 · #271 同步到 GitLab 的账号补上头像

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 16:54 让把 #270 头像这一项修完；按 ISSUES §2 开续作 #271（Refs #270）；GitHub 账号停用，task.mjs start 用不了 gh，改用 git worktree：把同在 cfb9b0fb 的 merge-270 工作区移成 .claude/worktrees/task-271，从 stage cfb9b0fb 拉 task/271/gitlab_avatar
- 结果：工作区干净，HEAD cfb9b0fb；GitLab issue #271 已建（标签 bug、P2、server、admin、func:api、func:data、func:external）
- 下一步：改 gitlab-sync.ts：要 256 像素的 GitHub 头像，200 KiB 上限，按类型取文件名，检查 PUT 返回码，失败下一轮重试，已有账号补传
