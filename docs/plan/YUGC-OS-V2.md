# YUGC OS v2 批次（#274-#278）

> 批次源自开机动画视觉令牌与门户桌面改版，所有者 2026-10-23 批准按 `#274 账号/权限地基 → #275 门户桌面 → #276 论坛可见范围 → #277 Bearer 令牌 → #278 候选人页` 顺序推进。规则正文在各自 issue 与服务契约；这里只记批次总览和已落地部分的结论。

状态：`current` · 更新：2026-10-24 · 适用：`app/server`、`app/console`、`app/web`、`app/forum` 跨批次协调。

## 1. 批次范围

| issue | 内容 | 依赖 |
|---|---|---|
| #274 | 账号/权限/操作记录/防盗刷地基，控制台改接 GitLab | 无，其余 issue 的地基 |
| #275 | 门户桌面（开机动画移植、桌面换肤、窗口外框、个人资料卡、新生便签） | 界面部分可用 mock 先做，真实身份/权限接口要等 #274 合并 |
| #276 | 论坛分类可见范围（`forum_topics`/`forum_categories.visibility`） | 依赖 #274 的权限节点 |
| #277 | Bearer 令牌（带 Bearer、不带 cookie 的请求放开 Origin 校验） | 依赖 #274 的身份与会话模型 |
| #278 | 候选人页（控制台概览的 `candidates_pending`） | 依赖 #274 的操作记录 |

执行顺序、视觉令牌与各 issue 的详细规则见批次内部工作文档（不在仓库里，由主控 agent 持有）；本文件只记跨 issue 需要共享的结论，以及 #274 作为地基的落地情况。

## 2. #274 结论（账号/权限/操作记录/防盗刷/控制台只接 GitLab）

基线 `9c5b74f7`（`task/273/reset_and_bind_email` 合入后的提交，`#270-#273` 已在同一条本地历史里合完）。

- **身份**：访客 `level.visitor`、注册用户 `level.registered`、极客班成员 `level.member`、往届成员 `level.alumni` 取代旧的 `org_role` 与「GitHub 组织成员」门槛；`not_member` 不再拒绝登录。
- **权限引擎**：点分节点（`^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`，通配只认 `*` 与前缀 `.*`）+ 可继承的组（level/department/title/custom）+ scope/meta 求值，账号级条目覆盖组继承条目（deny-first）；`perm_nodes`/`perm_groups`/`perm_group_parents`/`perm_entries`/`perm_members`/`perm_state` 为加法迁移，旧表不删。部门的论坛分类 scope 用 `app/forum/content/curation.json` 的真实分类 id（本任务修了迁移种子按部门 id 占位的 bug）。两轮演练在预发布库复制件上验证：第二轮零变化。
- **操作记录**：`recordActivity()` 唯一写入口，覆盖登录/投递/比赛/论坛/权限变更与全部 403/429；前端白名单动作经 `POST /api/events` 批量上报；`activity_events` 保留 180 天，按天清理。
- **防盗刷限额**：`limit_events` 统一计数表，按北京时间或滚动窗口限投递/注册/验证码/发帖回帖/读接口/搜索/邀请码兑换/设备码，超限统一 429 并写操作记录。
- **控制台**：删除整个「GitHub 组织」管理（路由、页面、`ALLOWED_ORGS`），改接 GitLab 概览/项目/设置；导航与用户、权限、操作记录三组页面按权限节点重做；原「成员与权限」页拆成「用户」「权限」两组。
- **GitHub 登录**保留（`OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET` 仍在用），只删组织管理能力，不影响登录本身。

验证：`pnpm --filter server test`、`pnpm --filter console test`、`tests/tooling`（33 文件/722 项）、`pnpm typecheck`、`pnpm check:catalog`、`pnpm check:architecture` 均已跑绿；逐项命令输出见本任务执行记录 [`notes/2026-10-24/crosery/task_274_unified_accounts.md`](../../notes/2026-10-24/crosery/task_274_unified_accounts.md) 与 [`notes/2026-10-23/crosery/task_274_unified_accounts.md`](../../notes/2026-10-23/crosery/task_274_unified_accounts.md)。预发布/正式环境的人工验收、真实浏览器走查、GitLab 同步真实往返不在本任务范围内，由所有者按发布流程另行验收。

## 3. 后续

#275-#278 由批次内其他分支/worktree 各自推进，各自落地结论将追加或压缩进对应 issue 与服务契约，不在本文件重复维护；本文件的「批次范围」表格随每个 issue 收尾更新状态。
