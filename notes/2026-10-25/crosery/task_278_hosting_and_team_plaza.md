# task/278/hosting_and_team_plaza · crosery · 2026-10-25

负责人：crosery

## 00:04:55 +08:00 · 返工 · #278 · 更正迁移演练记录，第一期改回个人赛

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：data-model.md 与 278.json 把组队广场迁移演练的记录改成实情（/tmp 复制 .tools/yugc-v2/db/preview-copy-278.db 验证，原件未动，55 张表行数前后一致），之前写的「没有找到预发布库副本、改用内存库」「54 张表」都是假的，更正掉；另外所有者 23:38 更正第一期开源贡献赛不是团队赛——db.ts 的种子改成个人赛（participation=individual，team_min/team_max 留空），并加一段幂等修复：已经按团队赛种过但还没人报名/组队的库（预发布库副本核对过是这种情况）启动时自动改回个人赛，真的有人报名/组队就不动、留给组织者手工处理；contest-site.mjs 的 dev 示例、_starter 模板、quickstart 文档本来就默认个人赛，不用改
- 结果：server 793+3 测试全过（含改掉的 competition-scores.test.ts 一处旧断言），typecheck/check:secrets/check:docs/check:doc-sync/check:catalog/check:architecture 全绿；oss-2026-1 官网的真实 HTML/文案（队伍 tab、FAQ 一人一队说法）还是按团队赛写的，没有读 getTeams().enabled，这部分留给主 session 做 UI
- 下一步：主 session 接手时按「个人赛、不组队」改 oss-2026-1 官网文案与队伍 tab 的显隐

## 02:57:39 +08:00 · 提交 · #278 · 比赛新增规划中状态：迁移、状态规则、报名组队拒绝、控制台与门户类型同步

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：给 competitions 加 planning 列（幂等迁移，PRAGMA table_info 先查再加，默认 0）；competitionStatus 新增 planning 分支（打开且未到开赛时间才生效，过了开赛时间自动失效，照原规则走进行中/已结束）；writeFailure 统一拒绝路径新增 competition_planning 错误码（409），报名、取消报名、建队与队伍全部写操作在 planning 期间一律拒绝；控制台创建/更新契约新增可选 planning 字段，公开与控制台响应原样回传；控制台类型、mock 与门户 SDK/标签同步加 planning 以保持 TypeScript 编译通过，不建表单勾选控件（UI 由主会话负责）
- 结果：commit 7465394c；tsc --noEmit（server、web）与 vue-tsc --noEmit（console）全过；tests/server+console+web+tooling 共 2059 项，2056 通过、3 项失败且与本次改动无关（#280 补资料页跳转，核对过涉及文件 HEAD 与 stage 无差异）
- 下一步：主会话在控制台编辑表单补勾选 planning 的控件；下次有预发布库副本时补演练这一列迁移

## 02:58:07 +08:00 · 提交 · #278 · contest-site.mjs dev 新增 --api 本地对接线上公开接口

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：dev 子命令加 --api <https 源/127.0.0.1/localhost>：公开比赛只读接口转发到该源而非写死样例数据，只转发 GET/HEAD，剔除响应里的 Set-Cookie，不转发 cookie 或鉴权头，非法源拒绝、上游不可达回 502；_starter/vite.config.ts 的代理目标改读 CONTEST_API 环境变量，默认值不变
- 结果：commit bf650554；tests/tooling 共 36 个文件 803 项全过
- 下一步：无

## 02:58:32 +08:00 · 提交 · #278 · 同步规划中状态与本地代理文档、重建目录，补齐 278.json 宏观对齐声明

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：API.md、endpoint-contracts.md、data-model.md、console 与 web 的 README、portal.md 补新状态值、新字段、新错误码与六状态枚举；contest-site-quickstart.md 新增本地对接线上数据一节；重新执行 pnpm catalog:generate；docs/changes/278.json 补齐 console 应用、github 业务域、planning 与 --api 相关的 flows/coverage/assessments，data 评估写明新列与幂等迁移、未在预发布库副本上演练
- 结果：commit 86141b14；node scripts/check-architecture.mjs --base f00e9966 打印「宏观对齐通过：51 个变更文件，145 个关联节点」；check:secrets/check:docs/check:doc-sync 全绿；pnpm typecheck 全过
- 下一步：无

## 03:28:38 +08:00 · 提交 · #278 · 合并 stage d1f64ec5 并重建目录

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：主会话接手后把 GitLab stage d1f64ec5 合进本分支（4f583acd，冲突在 services.ts 与 server README，两边都保留，目录取 stage 后重新生成），再提交重建的项目目录（8f732742）
- 结果：commit 4f583acd、8f732742；合并后 #280 那 3 项既有失败消失
- 下一步：无

## 03:28:38 +08:00 · 提交 · #278 · 控制台新建比赛分内外部、规划中开关、官网页签开发说明

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：新建/编辑弹窗先选类型，外部比赛链接必填，新建内部比赛时一并设参赛形式与人数（建完再 PUT signup-settings）；规划中 TxSwitch；窄屏单栏弹窗与卡片列表；官网页签加三步开发说明与 SDK 指南链接，官网地址改上下排修 390 溢出；邀请码状态列 120px；控制台 README 同步
- 结果：commit d7083b9d；tests/console/competitions.test.ts 16 项通过；ego-browser 本地样板数据 1440 与 390 看过新建弹窗三种形态、官网页签、卡片列表、邀请码列
- 下一步：无

## 03:28:38 +08:00 · 提交 · #278 · 门户比赛窗口加组队广场

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：新增 TeamPlaza 视图读 GET /api/team-plaza（类型、比赛、关键词筛选，300ms 防抖），卡片回到队伍页签申请或邀请；TeamHub 领队开关广场招人，HubDialog 加 PlazaDialog；规划中标签样式；mock-api 在 member 预览身份下补广场样板；portal.md 同步
- 结果：commit 830296af；tests/web 全过（含新增 portal-team-plaza.test.ts）；ego-browser 1440 与 390 看过组队广场
- 下一步：无

## 03:28:38 +08:00 · 提交 · #278 · geek comp plaza 与中文状态

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：CLI 加 comp plaza（--competition、--kind recruiting|seeking、--keyword、--json），状态显示中文并认规划中；bearer-auth 前缀表加 /api/team-plaza → competition；技能文档与 CLI 服务文档同步
- 结果：commit 70a5ce61；check:cli（fmt、clippy -D warnings、cargo test 28 项）通过；tests/server/bearer-auth.test.ts 新增范围用例通过
- 下一步：无

## 03:28:38 +08:00 · 提交 · #278 · 第一期官网按个人赛显示

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：html 标 data-participation，个人赛隐藏队伍页签、队伍区块与队伍统计，区块编号跳过隐藏的重新排；静态默认文案改个人赛口径
- 结果：commit 269e6f4d；本地起官网看过 participation=individual、区块 01–07、统计四格
- 下一步：无

## 03:28:38 +08:00 · 提交 · #278 · 补齐宏观对齐声明并重建目录

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：278.json 加 cli 应用、三个已登记流程与新改文件的覆盖说明，ownership.json 给组队广场三个流程补界面与令牌前缀的源码证据，重建目录与 docs/INDEX.md；在预发布库副本（/tmp 0600，用完删除）上跑两次迁移，第二次表数、列数、各表行数不变
- 结果：commit d7232c51；check-architecture --base d1f64ec5 通过（73 个变更文件，148 个关联节点）；vitest 136 文件 2086 项全过；pnpm typecheck 与 check:runtime/site-config/environments/boundaries/docs/doc-sync/secrets/catalog/cli 全过
- 下一步：推送并开 MR，作者自审
