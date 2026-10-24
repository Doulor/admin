# task/279/window_terminal_join · crosery · 2026-10-24

负责人：crosery

## 13:56:17 +08:00 · 开工 · #279 · #279 窗口按钮重做、终端改成仿真 Linux、「加入我们」改成桌面窗口

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：rc.18 验收 A5 发现「加入我们」仍跳旧版 /join-us 三维信封页；所有者 13:45 要求窗口按钮定制、终端仿真 Linux。从 stage e43df562 手工建 task/279/window_terminal_join 和 worktree（task.mjs start 只认 GitHub issue），pnpm install --offline。
- 结果：worktree 已建好
- 下一步：读 Windows.tsx、osApps.ts 终端部分和 JoinUs.tsx，先做加入我们窗口
