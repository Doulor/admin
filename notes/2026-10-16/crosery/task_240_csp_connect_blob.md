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

## 00:53:52 +08:00 · 提交 · #240 · 62f829b4 修复提交

- 执行者：agent-claude-geek-main-240（Claude Code，claude-sonnet-5-5）
- 做了什么：fix(deploy): 宿主 CSP 的 connect-src 放行 blob:；pnpm check 退出码 0；三份 tooling 测试 41 用例通过
- 结果：提交 62f829b4，已推送 origin/task/240/csp_connect_blob

## 00:53:53 +08:00 · PR · #240 · 开 PR #241

- 执行者：agent-claude-geek-main-240（Claude Code，claude-sonnet-5-5）
- 做了什么：gh pr create，九段正文；改前取自预发布响应，改后用 CDP 改写文档响应头模拟模板生效，两张图经 ego-browser 上传
- 结果：PR #241，标签 infra:deploy ui:visual deploy portal

## 00:53:53 +08:00 · 审查 · #240 · 对 62f829b4 的审查：有条件通过

- 执行者：agent-claude-geek-main-240（Claude Code，claude-sonnet-5-5）
- 做了什么：按 CODE-REVIEW 核对范围、同构、文档日期，写入 PR 正文审查结论
- 结果：有条件通过，条件是模板装到预发布后核对控制台与 /forum/ 响应头
