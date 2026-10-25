# task/292/boot_burst_perf · crosery · 2026-10-25

负责人：crosery

## 16:43:59 +08:00 · 开工 · #292 · 开工：启动动画切到晴空的瞬间卡顿

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：从 GitLab stage 486a4667 建 task/292/boot_burst_perf 与独立 worktree .claude/worktrees/task-292；GitHub origin/stage 落后，基线取 GitLab
- 结果：worktree 已建；依据：Crosery 2026-10-25 16:11 的消息，issue #292 已在 GitLab 建立并写入所有者确认
- 下一步：用真实浏览器量出卡顿的帧与函数，再改

## 17:18:34 +08:00 · 开发 · #292 · 开发：公式位图与起步门预热，去掉播放途中的首次绘制开销

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：用 ego-browser 逐回调计时与 CPU 剖析定位：播放第 3.8 秒 HUD 公式打到下标 n（U+2099）时 fillText 找回退字体，单帧脚本 44 到 161 毫秒，随后约 1 秒画面冻住，基准 5 次全部复现。engine.ts：起步门停着时用 setTimeout 链按 WARM_TIMES 六个时间点各预画一帧，start() 先同步补完；两行公式在 prep() 里各预画成位图，drawHUD 按字数裁剪 drawImage。timeline.ts 导出 WARM_TIMES。补预热时间点单测，portal.md 补预热小节，写影响声明
- 结果：修复版连测 6 次（手机与桌面交替），2.4 到 4.1 秒窗口单帧脚本最多 9 到 20 毫秒，3.8 秒尖峰与 4.83 秒的 1 秒冻结都没再出现；固定时钟下 T=2.6、5.4、5.9、6.5 秒前后帧逐像素相同，3.4、3.9、4.7 秒只在公式区域有抗锯齿差异
- 下一步：压缩构建交替重测、跑门禁、提交并开 MR

## 17:24:55 +08:00 · 提交 · #292 · 提交：预热与公式位图、预热时间点单测、合同、目录与影响声明

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：3 个提交：c10c7d44 perf(web) 引擎预热与公式位图加 WARM_TIMES 单测；303b3de6 docs(web) Portal 合同补预热小节；目录与 docs/changes/292.json 一起提交。压缩构建交替测量：第 2.4 到 4.1 秒单次回调最长，桌面 27、73、66 毫秒降到 21、16、14，手机 51、55、65 降到 9、40、7；约 4.85 秒的 1 秒停顿改前 5/6 次，改后 0/6 次。固定时钟逐像素比对：T=2.6、5.4、5.9、6.5 与起步门静帧前后相同，3.4、3.9、4.7 只有公式区域的抗锯齿差异
- 结果：门禁：vitest tests/web tests/tooling 72 个文件 1170 条通过；typecheck、check:catalog、check-architecture、check-doc-sync、check-docs、check-secrets、check-boundaries 全部通过
- 下一步：推送并开 MR，写审查记录
