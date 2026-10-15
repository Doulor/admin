# task/240/csp_connect_blob · crosery · 2026-10-16

负责人：crosery

## 00:44:41 +08:00 · 开工 · #240 · 从 origin/stage 21035dab71f1 建 task/240/csp_connect_blob

- 执行者：agent-claude-geek-main-240（Claude Code，claude-sonnet-5-5）
- 做了什么：node scripts/task.mjs start 240 csp_connect_blob：建分支与 worktree .claude/worktrees/task-240，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 00:48:25 +08:00 · 方案 · #240 · 根因与修法

- 执行者：agent-claude-geek-main-240（Claude Code，claude-sonnet-5-5）
- 做了什么：抓预发布响应头：connect-src 无 blob:；three 0.186 GLTFLoader 对 GLB 内嵌贴图先 URL.createObjectURL 再由 ImageBitmapLoader fetch(blob:)；实测 34 次 securitypolicyviolation 全是 connect-src blob。修法：两份 nginx 模板 connect-src 加 blob:，文档与回归测试同步
- 结果：论坛 CSP 取自 production.conf，会一起带上 blob:

## 00:48:25 +08:00 · 开发 · #240 · 模板、文档、测试改完

- 执行者：agent-claude-geek-main-240（Claude Code，claude-sonnet-5-5）
- 做了什么：deploy/nginx/{preview,production}.conf connect-src 加 blob:；DEPLOY.md、portal.md 说明；tests/tooling/web-nginx.test.ts 新增 blob: 回归；文档核对：docs/services/web/ 不用改——app/web 没有改动，portal.md 只是补一句 CSP 说明
- 结果：web-nginx、forum-csp、hashed-asset-cache 三个文件 41 用例通过（Node 22.23.2）
