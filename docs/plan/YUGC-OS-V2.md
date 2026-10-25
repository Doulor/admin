# YUGC OS v2 批次（#274-#278）

> 批次源自开机动画视觉令牌与门户桌面改版，所有者 2026-10-23 批准按 `#274 账号/权限地基 → #275 门户桌面 → #276 论坛可见范围 → #277 geek 命令行 → #278 第一期比赛官网` 顺序推进。本文件收录设计方案第 1–3 章的要点（视觉令牌去向、执行顺序与分工、#274 的设计与落地结论）；第 1 章的令牌取值写进 `docs/design/DESIGN.md`（由 #275 补充），逐字段的接口契约在各自服务契约文档里；#275-#278 各章的要点由对应 issue 的 MR 补进本文件。

状态：`current` · 更新：2026-10-24 · 适用：`app/server`、`app/console`、`app/web`、`app/forum` 跨批次协调。

## 1. 批次范围与执行顺序

| issue | 内容 | 依赖 |
|---|---|---|
| #274 | 账号/权限/操作记录/防盗刷地基，控制台改接 GitLab | 无，其余 issue 的地基 |
| #275 | 门户桌面（开机动画移植、桌面换肤、窗口外框、个人资料卡、新生便签） | 界面部分可用 mock 先做，真实身份/权限接口要等 #274 合并 |
| #276 | 论坛分类可见范围（`forum_topics`/`forum_categories.visibility`） | 依赖 #274 的权限节点 |
| #277 | geek 命令行搬进主仓库 `app/cli`（Rust），改走设备码登录，业务接口认 Bearer 令牌（`forum`/`apply`/`competition`/`repo` 按 scope） | 依赖 #274 的身份、权限与操作记录 |
| #278 | 第一期比赛（`oss-challenge-2026-1`）官网与站点托管（`/c/:slug/`）、公开排行榜与 feed 接口、`competition-sdk` | 依赖 #274 的权限节点与操作记录 |

执行顺序：#274 先做先合进 stage，是其余四个 issue 的地基；#275/#276/#277/#278 在 #274 合入后各自一个 worktree、一个 MR 并行推进，全部合进 stage 后统一打 rc 发预发布，由所有者一次性验收。#275 的开机动画移植、桌面换肤、窗口外框这些纯界面部分，在 #274 开发期间可以先用 mock 数据做，等 #274 合并后再接真接口。

模型分工（所有者 2026-10-23 22:52 定）：Opus 负责界面设计、总体把控、拆任务、审查、集成、发布与所有面向所有者的文字；Sonnet 负责难活（权限引擎、数据迁移、Bearer 鉴权、防盗刷、论坛可见性过滤、站点托管与 CSP、命令行登录与网络层、开机动画的前端移植）；Haiku 负责简单活（删旧图和引用、文案替换、文档同步、测试样例、截图核对、目录重新生成）。子 agent 只接收自己那一块的简报，不整份塞给它；一个 worktree 只给一个写入者；子 agent 的 worktree 先快进到当前 stage 的提交。

执行顺序、视觉令牌取值与各 issue 的逐字段规则详见 SPEC.md、各 issue 的 CONTRACT 文档；这两类文档本身因含方案细节不进仓库（`.gitignore` 排除 `.tools/`），由主控 agent 在交接时转交对应 worktree，但其中跨 issue 共享的结构性结论已经收进本文件，不需要依赖那些文档才能理解这个批次做了什么。

## 2. 视觉令牌（SPEC §1，取自开机动画最后一帧）

视觉令牌按用途分组：桌面背景渐变与网格（`--os-sky-*`、`--os-grid`）、窗口（标题栏渐变、描边、三个圆点）、面板与文字（`--os-panel`、`--os-ink`、`--os-ink-soft`、`--os-accent`）、按钮渐变（`--os-pill-*`）、YUGC 四个字母各自的亮面/主体/描边三色、心形点缀、进度条渐变、成功态、终端背景。字体用 `PingFang SC`/`HarmonyOS Sans SC`/`Microsoft YaHei`/`Noto Sans SC` 系统字体族；等宽字体用 `SF Mono`/`JetBrains Mono`/`Menlo`/`Consolas`。形状：窗口圆角 18px、卡片 14px、按钮全圆角；窗口打开动效 220ms 缩放加淡入，`prefers-reduced-motion` 时只保留淡入。

四个字母的颜色同时是部门色：AI部门用 Y（青绿）、算法部门用 U（蓝）、硬件部门用 C（靛蓝）、网安部门用 G（粉）、管理部门用按钮渐变终点色、无部门用次要文字色。

令牌的具体取值（十六进制、渐变角度等）写进 `docs/design/DESIGN.md`（#275 的 MR 负责落库），资产文件在 `app/web` 对应目录；本文件不重复列数值，只记分组与去向，避免两处维护同一份颜色表。开机动画里的 emoji/颜文字（♡✓✧♪ 和颜文字对话）全部换成 Remix 图标或 Path2D 图形与平实中文，不在界面上留 emoji，这一条对所有批次内的 issue 都适用（AGENTS.md「禁止事项」同样覆盖）。

## 3. #274 设计与结论（账号/权限/操作记录/防盗刷/控制台只接 GitLab）

基线 `9c5b74f7`（`task/273/reset_and_bind_email` 合入后的提交，`#270-#273` 已在同一条本地历史里合完）。

### 3.1 设计

- **三种身份**（回顾第 1–2 轮复核收紧后的口径：GitHub 组织资格完全不参与登录与权限判定）：访客 `level.visitor`（没登录，按 `yugc_vid` 认同一浏览器）→ 注册用户 `level.registered`（任一方式注册，不填邀请码）→ 极客班成员 `level.member`（注册时填邀请码，或注册后兑换）；往届成员 `level.alumni` 是成员的平行分支，由管理员设置。身份升级互斥，写在 `perm_members` 表，数据库约束保证每个账号同时只在一个 level 组里。
- **权限节点**：小写点分（`^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`），通配只认 `*` 与前缀 `.*`；按域分组——论坛（`forum.read.*`/`forum.topic.*`/`forum.moderate.*`/`forum.category.manage`/`forum.sticker.manage` 等）、投递（`apply.*`）、比赛（`competition.*`）、账号（`account.*`）、控制台（`console.access`/`users.*`/`perm.*`/`activity.*`/`feedback.*`/`dept.manage`）、GitLab（`gitlab.*`）、限额 meta（`meta.limit.*`）。
- **组与继承**：level/department/title/custom 四类组按权重排序（level 0–20，department 30，title 40–100，站长 `title.site.owner` 为 100 且持有 `*`），称号组继承对应部门组，账号条目覆盖组继承条目（deny-first，unset 按拒绝处理）；meta 节点不参与 allow/deny，按命中组里权重最高、同权重取更宽松值的规则取值。
- **数据表**：`perm_nodes`/`perm_groups`/`perm_group_parents`/`perm_entries`/`perm_members`/`perm_state` 为加法迁移，旧表（`role_assignments`、`departments`）不删，标记弃用；另加 `account_profiles`/`account_avatars`/`activity_events`/`limit_events`，`forum_users`/`forum_topics`/`forum_categories` 各加列。
- **操作记录**：`recordActivity()` 是唯一可信写入口，覆盖登录/投递/比赛/论坛/权限变更与全部 403/429；前端白名单动作经 `POST /api/events` 批量上报；不记密码、验证码、令牌、完整请求体，IP 按权限脱敏显示，记录保留 180 天按天清理。
- **防盗刷限额**：`limit_events` 统一计数表，按北京时间或滚动窗口限投递、注册、验证码、发帖回帖、读接口、搜索、邀请码兑换、设备码；超限统一回 429 并写一条操作记录。
- **控制台改版**：删除整个「GitHub 组织」管理（路由、页面、`lib/github*.ts` 里组织相关的部分、`ALLOWED_ORGS`/`GH_APP_*`/`CONSOLE_ORG` 等 env），改接 GitLab 概览/项目/设置；导航与用户、权限、操作记录三组页面按权限节点重做，原「成员与权限」页拆成「用户」「权限」两组；GitHub 登录本身保留（`OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET` 仍在用），只删组织管理能力。

### 3.2 落地结论

- 部门的论坛分类 scope 用 `app/forum/content/curation.json` 的真实分类 id（本任务修了迁移种子按部门 id 占位的 bug）；迁移在预发布库复制件上两轮演练验证：第二轮零变化。
- 复核发现并堵上的洞：`access.resolve()`/`roleUnrecorded()` 曾在请求路径上实时补查 GitHub 组织角色并回写站内角色，使任何 GitHub 组织管理员调用一次已登录接口就能绕开邀请码制度被悄悄提升；现在 `access.resolve()` 纯读本地权限记录，不再调用 GitHub，站长与成员身份只认账号自己在 `perm_members` 里的记录，不会再被一次路由调用悄悄改写。
- 注册限额（IP 每天 5 个、设备每天 3 个）、邀请码猜测锁定（按 IP/账号计失败次数共用同一套桶）覆盖邮箱、Google、GitHub 三种注册方式；论坛写权限（发话题/回复/表情）改按权限节点判定，不再是「登录就算数」。
- `GET /auth/me` 按 CONTRACT-274 §1 收口：`level` 不带 `level.` 前缀，`permissions` 是节点名数组，`identities` 为 `{emails, google, github}`，`console_link` 直接查 `console.access` 节点。

验证：`pnpm --filter server test`、`pnpm --filter console test`、`tests/tooling`、`pnpm typecheck`、`pnpm check:catalog`、`pnpm check:architecture` 均已跑绿；逐项命令输出见本任务执行记录 [`notes/2026-10-24/crosery/task_274_unified_accounts.md`](../../notes/2026-10-24/crosery/task_274_unified_accounts.md) 与 [`notes/2026-10-23/crosery/task_274_unified_accounts.md`](../../notes/2026-10-23/crosery/task_274_unified_accounts.md)。预发布/正式环境的人工验收、真实浏览器走查、GitLab 同步真实往返不在本任务范围内，由所有者按发布流程另行验收。

## 4. 后续

#275-#278 由批次内其他分支/worktree 各自推进，各自落地结论将追加或压缩进对应 issue 与服务契约，不在本文件重复维护；本文件的「批次范围」表格随每个 issue 收尾更新状态。
