# task/279/window_terminal_join · crosery · 2026-10-24

负责人：crosery

## 13:56:17 +08:00 · 开工 · #279 · #279 窗口按钮重做、终端改成仿真 Linux、「加入我们」改成桌面窗口

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：rc.18 验收 A5 发现「加入我们」仍跳旧版 /join-us 三维信封页；所有者 13:45 要求窗口按钮定制、终端仿真 Linux。从 stage e43df562 手工建 task/279/window_terminal_join 和 worktree（task.mjs start 只认 GitHub issue），pnpm install --offline。
- 结果：worktree 已建好
- 下一步：读 Windows.tsx、osApps.ts 终端部分和 JoinUs.tsx，先做加入我们窗口

## 14:20:12 +08:00 · 提交 · #279 · 加入我们改成桌面窗口

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：提交 596f9718：JoinUs 整页与 three/join.ts 退场归档到 docs/history/portal-yugc-os-v1/files/，新增 components/os/JoinBox.tsx 窗口，/join-us、/apply 跳 /?open=join，宣传片门控挂到 body；目录归属把投递流程前端证据换成 JoinBox、PromoLazy、PromoPlayer、envelope.ts 并重新生成；写 docs/changes/279.json。
- 结果：tsc 通过；vitest tests/web + tests/tooling 63 个文件 1004 个用例全过；check:runtime/site-config/environments/boundaries/docs/doc-sync/notes/secrets/catalog、typecheck 全过；check-architecture --base e43df562 通过（43 个文件）。pnpm check 整条默认拿本地 origin/stage（GitHub 旧快照 4beda55e）当基线会误报，已改用 GitLab stage 单独跑。
- 下一步：重做窗口左上角三个按钮，终端改仿真 Linux。
