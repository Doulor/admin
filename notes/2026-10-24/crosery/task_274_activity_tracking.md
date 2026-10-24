# task/274/activity_tracking · crosery · 2026-10-24

负责人：crosery

## 23:33:23 +08:00 · 开工 · #274 · 重开 #274：操作记录按埋点方式覆盖全端

- 执行者：agent-claude-sonnet-track274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：读取 #274 重开要求与现状：控制台操作记录页因为多传 limit 被服务端 activityQuery 契约拒绝（400）；/api/events 只认门户来源；表情回应没写审计行。
- 结果：确认范围：修 400、按来源拆分事件白名单并给论坛/控制台补埋点、补表情回应的审计写入、控制台操作记录页来源筛选与文案同步。
- 下一步：改 app/console/src/lib/activity.ts 的 limit 传参与 mock 校验，再铺开服务端白名单与论坛/控制台埋点。

## 23:36:37 +08:00 · 提交 · #274 · ce4a4984 fix(server): 按来源拆分事件白名单，补上表情回应缺失的审计记录

- 执行者：agent-claude-sonnet-track274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：按来源拆分 EVENT_WHITELIST，POST /api/events 加可选 surface 字段；forum-api/posts.ts 的表情回应新增/取消各补一次 recordActivity。
- 结果：vitest tests/server/events.test.ts tests/server/forum.test.ts 全绿（11+58 条）。
- 下一步：改控制台侧：去掉 limit 传参，mock 校验未知字段。

## 23:36:38 +08:00 · 提交 · #274 · a56bff11 fix(console): 操作记录页不再传 limit 触发 400，mock 校验未知查询字段

- 执行者：agent-claude-sonnet-track274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：activityParams 去掉 limit；mock/console.ts 新增 assertKnownQuery；新增 lib/events.ts 控制台页面浏览埋点，router.ts afterEach 上报；ACTION_TEXT 补 forum.sticker.use。
- 结果：vitest tests/console/activity.test.ts 全绿（10 条）；vue-tsc 类型检查通过。
- 下一步：补论坛侧埋点。

## 23:36:38 +08:00 · 提交 · #274 · ffef8efd feat(forum): 补页面浏览、换主题、插表情的操作记录埋点

- 执行者：agent-claude-sonnet-track274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：新增 useActivityBeacon 组合式函数与 activity-beacon.client.ts 插件上报 page.view；useForumTheme 换主题、PostEditor 插表情各补一次上报。话题浏览和搜索服务端已直接记录，不重复上报；没有编辑模式开关，不做这一项。
- 结果：forum 自己的 vitest 32 个文件 583 条全绿；nuxt typecheck 通过。
- 下一步：同步目录与文档，收尾架构对齐声明。

## 23:36:38 +08:00 · 提交 · #274 · df70f556 docs(tooling): 操作记录三端埋点同步目录、契约文档与宏观对齐声明

- 执行者：agent-claude-sonnet-track274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：ownership.json 补模块归属与流程证据锚点，catalog:generate 重新生成产物；docs/changes/274.json 改写成只覆盖这次改动；三份服务文档与 endpoint-contracts.md 同步，顺手修正一处过期的匿名限流描述。
- 结果：check:catalog/check:docs/check:doc-sync/check:secrets 全部通过；check-architecture.mjs --base gitlab/stage 通过（32 个变更文件，29 个关联节点）。
- 下一步：交给主会话走 PR、审查与合并。
