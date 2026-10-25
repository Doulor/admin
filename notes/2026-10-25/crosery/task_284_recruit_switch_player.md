# task/284/recruit_switch_player · crosery · 2026-10-25

负责人：crosery

## 12:58:01 +08:00 · 开工 · #284 · portal 招新开关、关闭页与桌面窗口播放器

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：从 GitLab stage 130a58b8（rc.22）建 task/284/recruit_switch_player 与独立 worktree .claude/worktrees/task-284；GitHub origin/stage 落后 378 个提交，所以基线取 GitLab
- 结果：worktree 已建；依据：Crosery 2026-10-25 12:52 接手指令，issue #284 已在 GitLab 建立并写入所有者确认
- 下一步：装依赖后按 issue 验收条件实现

## 13:24:18 +08:00 · 提交 · #284 · 招新总开关的服务端

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 lib/apply-settings.ts（app_state 里 apply_open 一行，没有就是开放）；GET /api/public/config 多下发 apply_open；POST /api/portal/apply 在 apply.submit 之后判断开关，关闭回 403 apply_closed，不落库不占额度；控制台 GET/PATCH /api/console/applications/settings（apply.view 读，新节点 apply.settings 加 requireStepUp 写，状态真的变了才记 application.settings.update）；补 tests/server/apply-switch.test.ts 共 14 条；同步 server README、endpoint-contracts、API、SECURITY、data-model 与项目目录（ownership.json 两条新流程、app_state 说明、模块归属）。没有新增表，不需要迁移。
- 结果：npx vitest run tests/server：45 个文件 709 条通过（含新 14 条）；把 requireApplyOpen 暂时拿掉后关闭期间的 3 条用例变红，恢复后变绿；tsc -p app/server/tsconfig.json 无错误；pnpm catalog:generate 与 pnpm check:catalog 通过；pnpm check:docs、node scripts/check-doc-sync.mjs 通过。控制台页面与官网还没做，浏览器未验证。
- 下一步：控制台「投递」页顶部加开关，再做官网关闭页和宣传片窗口
