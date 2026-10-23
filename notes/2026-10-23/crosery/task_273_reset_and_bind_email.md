# task/273/reset_and_bind_email · crosery · 2026-10-23

负责人：crosery

## 19:34:51 +08:00 · 开工 · #273 · #273 统一登录补忘记密码与改密码入口，没有邮箱的账号先绑邮箱

- 执行者：agent-claude-geek-main-8f7d12b7-273（Claude Code 分身，claude-opus-5-5）
- 做了什么：所有者 19:22 提出登录页缺忘记密码、改密码的说明，只绑了 GitHub 的账号再次进来或登录时必须绑邮箱；GitLab issue #273 已建（主会话建）；GitHub 账号停用，task.mjs start 用不了 gh，改用 git worktree：从 stage 1c3f0d64 拉 task/273/reset_and_bind_email 到 .claude/worktrees/task-273，pnpm install --frozen-lockfile
- 结果：工作区干净，HEAD 1c3f0d64；依赖装好
- 下一步：服务端加 /auth/email/reset 与 email_required，回调、GitLab 授权、设备授权拦截；控制台登录页忘记密码与 /bind-email 页；官网、论坛跳转
