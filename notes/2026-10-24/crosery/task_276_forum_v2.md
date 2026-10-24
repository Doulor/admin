# task/276/forum_v2 · crosery · 2026-10-24

负责人：crosery

## 16:46:04 +08:00 · 开工 · #276 · 从 stage 39ab81ab 开工 #276

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：读完 common.md、srv276.md 简报与 CONTRACT-276.md、SPEC.md §5；worktree 已在 task/276/forum_v2，HEAD 39ab81ab；补跑 pnpm install --frozen-lockfile --offline（开工前漏跑，现在补上）
- 结果：依赖安装完成，开始实现服务端分级可见、去游客回帖、表情包、表情回应、上传、@补全、控制台论坛管理接口
- 下一步：DB 迁移、forum-store 过滤函数、路由改造、测试、文档

## 17:13:54 +08:00 · 提交 · #276 · 数据库结构、迁移与表情素材

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：新增分类可见、表情包/表情文件、反应、上传文件四组表；forum_topics.visibility 改成可空列；写 runForumV2Migration（仿 2026-10-yugc-v2.ts 的幂等模式）；24 个表情素材拷进 app/server/assets，Dockerfile 补运行时 COPY
- 结果：d65f5c90，29 files changed
- 下一步：forum-rules/forum-store 的分级可见与表情/反应/上传域逻辑

## 17:14:16 +08:00 · 提交 · #276 · forum-store 分级可见/表情/反应/上传/称号部门

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：SQL 层共享可见过滤函数；去掉游客分支；用户/话题/帖子带 department/titles；加表情、反应、上传、@建议用户的存取方法；limits 桶留存表补新桶
- 结果：1b58529c，3 files changed
- 下一步：论坛与控制台路由接入这些方法，去掉游客回复路由

## 17:14:39 +08:00 · 提交 · #276 · 路由接入分级可见/表情/反应/上传/建议，去游客回复

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：viewer.ts 加分级可见判定；posts.ts 删游客 PoW/蜂蜜罐分支；新增话题可见度 PATCH、帖子反应 PUT/DELETE、图片上传、@建议用户路由；控制台新增论坛分类/表情管理，写操作 step-up
- 结果：fdf0e23b，12 files changed
- 下一步：测试：去掉游客测试、补分级可见/表情/反应/上传/建议测试

## 17:15:02 +08:00 · 提交 · #276 · 论坛测试去游客，补分级可见/称号部门断言

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：删/改写依赖游客 PoW、蜂蜜罐、名字占用、全站暂停的用例；写入矩阵与关闭话题用例补访客 401；TRUST_PROXY 用例改用成员回复触发 forum.reply.ip.hourly；/state 与帖子记录补 visibility/reactions/department/titles 断言；legacy-database 补 6 张新表
- 结果：8a0f8e8c，node_modules/.bin/vitest run tests/server → 30 files passed, 564 tests passed
- 下一步：补每个新端点的专项测试、迁移幂等测试与真实预发库演练、文档、check 脚本扫一遍

## 17:25:15 +08:00 · 提交 · #276 · 修迁移重建外键报错，补演练与回归测试

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：对预发布库副本演练迁移，第一次就在 DROP TABLE forum_topics 撞上 FOREIGN KEY constraint failed（forum_posts 等子表有真实行引用）；按 SQLite 重建表指南加关/开 FK 检查与 foreign_key_check 核对；补最小夹具回归测试与 forum-v2-migration.test.ts（分类可见/表情种子形状与幂等）
- 结果：a639b6b6；/tmp/c276 两次演练前后行数一致（见下）；node_modules/.bin/vitest run tests/server → 31 files passed, 570 tests passed
- 下一步：补每个新端点的专项测试、文档更新、common.md 的 check 脚本扫一遍

## 17:28:52 +08:00 · 提交 · #276 · 新路由/新表登记业务归属

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：ownership.json 补齐 3 个新路由文件与 6 张新表到 forum 域；check:catalog 下一道门禁（新接口缺少流程关联）未过，留给文档补齐一起做
- 结果：a9cf5293；pnpm check:catalog 仍失败于缺少流程关联（非本次范围内能速通的机械修复）
- 下一步：给每个新接口写 flows 条目、docs/changes/276.json、docs/services/server 的 API/endpoint-contracts/data-model/论坛服务文档

## 19:28:33 +08:00 · 提交 · #276 · 访客翻页上限、viewer 分级等级与写权限节点清单，修两个真实 bug

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：GET /api/forum/topics 游标分页接访客翻页上限（第二页起一天最多10页）；viewer.ts 的 viewerAndPolicy() 给 GET /state 与每个写接口的 viewer 加 level（分级可见等级）与 nodes（六个写权限节点里持有的子集，团队负责人追加，只做按钮显隐参考）；forum-api/contracts.ts、console/contracts.ts 给全部 16 个新增/改过请求形状的接口补响应 Schema（图片文件路由用占位 Schema，已核实 Fastify 对 Buffer 响应绕过 JSON Schema 序列化；复用通用 ForumWriteResponse 的两个接口用最宽松占位不裁字段）；自查修了两处真实 bug：http-policy.ts 的错误处理器没把 ForumError.extra（401 的 need、403 的 node）铺进响应体；forum-store.ts 的 reactionsByPost() 拿论坛用户 id 去比对 account_id 两种 id 格式不同，mine 字段恒为 false
- 结果：commit 47c89722，9 files changed
- 下一步：补前端 parseViewer 识别这两个新字段，再补回归测试

## 19:28:33 +08:00 · 提交 · #276 · parseViewer 认得服务端新加的 viewer.level/nodes 字段

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：app/forum/shared/forum-api.ts 的 ForumViewer/parseViewer 加 level/nodes（没给时退回保守默认值，不假装有权限）；两个测试文件（夹具常量、一处内联字面量）跟着补上，没有改任何组件或按钮显隐逻辑
- 结果：commit 041be951，3 files changed；app/forum 全部 30 个测试文件、553 条用例在 Node 24.21.0 下通过（本机 fnm 没有 engines 要求的 >=26，待团队负责人用真实版本复核）
- 下一步：补服务端新接口与两处修复的回归测试

## 19:28:50 +08:00 · 提交 · #276 · 补齐 15 个新接口与两处修复的回归测试

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：新建 tests/server/forum-v2-endpoints.test.ts（26 条用例）覆盖分级可见、话题游标分页（含访客翻页上限 429）、表情包、表情回应（含 429）、上传图片、@自动补全、控制台论坛管理权限矩阵；tests/server/forum.test.ts 补 guest/alice/frank 三种 viewer 的 level/nodes 精确断言（扩展原有三处 toEqual），以及表情 mine 字段的三方视角回归（加表情的人/别人/游客在 /state、话题正文、PUT/DELETE 回答三处口径一致）
- 结果：commit bce359e0，2 files changed；pnpm vitest run tests/server → 34 个文件、611 条全部通过
- 下一步：更新文档与架构对齐声明

## 19:28:50 +08:00 · 提交 · #276 · 响应 Schema、viewer 字段、表情 camelCase 形状入文档，清理 guestPolicy

- 执行者：agent-c276s（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：API.md/endpoint-contracts.md 补 viewer.level/nodes 说明与表情回应 camelCase 形状，去掉 guestPolicy 等已经不存在的响应字段描述（共 13+ 处）；data-model.md 补 6 张新表；docs/services/forum/README.md 只加「看的人」「表情回应」两条新内容，不动游客相关既有描述；新建 docs/changes/276.json（14 业务域、20 flows、8 项评估、7 条 coverage）；ownership.json 补 15 条 flows、1 条 moduleOwners（migrations/2026-10-forum-v2.ts 归 forum）、6 处 evidence 锚点，pnpm catalog:generate 重新生成 6 个产物
- 结果：commit 6dba73f9，12 files changed；node scripts/check-architecture.mjs --base gitlab/stage → 宏观对齐通过（65 个变更文件，142 个关联节点）；pnpm check:catalog 通过；check-doc-sync/check-docs/docs-index 通过
- 下一步：迁移演练、check:secrets/check:boundaries、给团队负责人的汇报
