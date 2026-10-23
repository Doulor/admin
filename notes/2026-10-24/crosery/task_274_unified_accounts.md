# task_274_unified_accounts · crosery · 2026-10-24

负责人：crosery

## 00:12:39 +08:00 · 提交 · #274 · 阶段 1：删 GitHub 组织管理路由，加控制台 GitLab 概览/项目/设置与公开仓库列表

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：删 app/server/src/routes/admin/{overview,members,repos,teams,activity,security,org,orgs,invitations,invite-links,feedback,logs}.ts 与 middleware/{require-github,require-github-session}.ts；admin/index.ts 只留 auth.ts；config.ts 删掉没有任何读者的 ALLOWED_ORGS（连带 deploy/compose/*.yml、deploy/env/.env.*、scripts/deployment-environment.mjs 的声明）；GH_APP_ID/GH_APP_PRIVATE_KEY/CONSOLE_ORG 仍被 lib/github-connection.ts、access.ts、feedback-store.ts、audit.ts 等读取，保留。新增 lib/gitlab-sync.ts 的 health()/errors24h()/listProjects()/lastRun()/applySettings()（运行时可改 mode/group/interval，存 app_state 的 gitlab_settings 键，重启回读）；console/gitlab.ts 加 status/projects/settings 三个接口，sync 接口改名 resync；portal/gitlab.ts 加公开的 GET /api/public/gitlab/projects。更新 tests/server/{core,github-connection,console,signin-methods,upstream-errors,invitations,gitlab-sync}.test.ts 把测试载体从已删路由换成仍存在的（console/assignments.ts 等），新增 11 条 GitLab 新接口的用例。pnpm catalog:generate 与手改 docs/architecture/catalog/ownership.json（删 39 条只服务于已删路由的流程声明与 12 条 routeOwners，改 1 条路径改名，加 5 条新流程）、pnpm docs:index。
- 结果：pnpm typecheck 通过；pnpm test 全仓库 1603 passed（含 tests/tooling 的 catalog-coverage、project-catalog）；pnpm build 通过（server+web+console）；pnpm check:boundaries、check:environments、check:catalog 通过。pnpm check:docs 仍报 docs/services/server/endpoint-contracts.md 引用已删文件路径——文档改写按简报安排在阶段 4 一次性做，暂留红。
- 下一步：阶段 2：权限节点、账号迁移、身份接口

## 00:44:44 +08:00 · 提交 · #274 · 阶段 2a：权限节点与求值引擎、perm_* 六表与资料/操作记录表、2026-10-yugc-v2 迁移脚本，预发布库复制件演练通过

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：新增 lib/permission-nodes.ts（50 个节点目录 + 旧 CAPABILITIES→新节点对照表）与 lib/permissions.ts（explain/evaluate 纯函数照搬 ibuki 的 permissions.py，DB 层 entriesForAccount 做组继承 BFS、过期在读取时过滤、perm_state.revision 进程内缓存、setExclusiveGroupMembership 保证 level/department 组每账号唯一）。db.ts 加 perm_nodes/perm_groups/perm_group_parents/perm_entries/perm_members/perm_state、account_profiles/account_avatars、activity_events/limit_events 六+四张表，forum_topics 加 visibility 列。新增 lib/migrations/2026-10-yugc-v2.ts：8 步迁移（节点同步、组+默认条目种子、按 org_role/invite_code_id 分身份、role_assignments 映射到新组、旧部门归档函数、forum_users.account_id 回填、account_profiles 建档、audit_logs→activity_events 按水位线增量复制）+ 迁移报告。archiveOldDepartments() 特意没有接进 services.ts：跑过才发现 roles.ts:286 的 computeAccess() 按未归档部门算 headOf，提前归档会让控制台任免、论坛版务这些还在走旧 capabilities 的写接口从 200/403 变成 403/400（forum.test.ts、signin-methods.test.ts 验证过），必须和阶段 2b 的 requireCapability→requirePermission 切换同一次提交才能打开，已写代码注释与测试说明留档。测试：tests/server/permissions.test.ts（48 条权限向量，43 条照搬 ibuki 去掉 5 条 NAS 隔离专用的，5 条按 SPEC 加的 YUGC 用例，另加继承/meta/过期/revision 缓存/explain/effective 的 DB 层用例共 20 条）、tests/server/yugc-v2-migration.test.ts（15 条，覆盖种子幂等、按账号状态分身份、role_assignments 映射、forum_users 回填、account_profiles 建档去重、audit_logs 增量复制）。按 CONTRACT-274 §8 的旧 CAPABILITIES 对照表落进 CAPABILITY_TO_NODES，6 个 GitHub 组织类的找不到新节点，列进迁移报告 unmapped_capabilities，不静默丢弃。ownership.json 加业务域 permissions（6 张 perm_* 表）、identity 加 account_profiles/account_avatars、audit 加 activity_events、platform 加 limit_events；pnpm catalog:generate + docs:index。
- 结果：pnpm typecheck 通过；pnpm test 全仓库 1686 passed（含新增 83 条，较阶段 1 的 1603 多 83）；pnpm --filter server build 通过；pnpm catalog:generate/docs:index 后 project-catalog、catalog-coverage 全部通过。迁移演练：复制 .tools/yugc-v2/db/preview-copy.db 两份（rehearsal-run1/2），createDatabase() 各跑一遍迁移，行数表——users 2→2、identities 4→4、forum_users 10→10、role_assignments 0→0、departments 4→4、invite_codes 1→1、audit_logs 123→123、applications 9→9（迁移不碰这 8 张旧表的行数，只有 archived 标记会在阶段 2b 变）、perm_nodes 0→50、perm_groups 0→26、perm_group_parents 0→18、perm_entries 0→75、perm_members 0→3、account_profiles 0→2、activity_events 0→123；第二遍对已经跑过一次的库再跑，15 张表 before/after 逐行相等，forum_linked/profiles_created/activity_copied 本遍计数全部为 0，确认幂等。unmapped_heads 为空（预发布的 role_assignments 本来就是 0 行）。演练用的 rehearsal-run1.db/run2.db 已删除，脚本本身不在仓库里，未改动 preview-copy.db 原文件，报告只含行数与旧能力 id，不含任何邮箱/姓名/IP。已知缺口：archiveOldDepartments() 已实现但未接入 services.ts（见上，等阶段 2b）；requirePermission 中间件、console 新节点接口（people/assignments/titles/departments 替换）、identity 改造（邀请码选填、新 /auth/me 形状）尚未开始。
- 下一步：阶段 2b：requireCapability→requirePermission 切换与 archiveOldDepartments 启用；身份改造（邀请码选填、GET /auth/me 新形状、资料/头像接口）；控制台用户与权限管理接口

## 01:02:59 +08:00 · 提交 · #274 · 控制台按权限节点重做：导航、用户、权限、操作记录、GitLab、概览与样板数据

- 执行者：agent-claude-geek-main-3c2a7a67-con274o（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：接手停下的 Sonnet 子 agent（con274）在 scratch/274_console 上没提交的草稿，逐个文件审过后由我（con274o）改完：删掉 GitHub 组织页面、lib 与 mock（39 个文件）；导航按 SPEC §3.9 分组并按 /api/console/me 的权限节点显示；新写用户页（筛选、加载更多、详情抽屉：改身份/部门/称号/站长、停用、操作记录、有效权限）、权限页（组/节点/解释三个页签，条目增删、成员增删、新建自定义组）、操作记录页（筛选、今天被拦下、详情、导出）；GitLab 四页接 /resync 与新形状；概览五张卡；登录页与邀请码页改成邀请码选填；403 step_up_required 给「重新登录」；重写 mock/console.ts（组继承、通配展开、拒绝优先、meta 取值、部门范围、step-up、last_owner/system_group/group_cycle/unknown_node）；tests/console 新增 users/permissions/activity，改写 nav/signin/http/gitlab/competition-hub；tests/e2e/workflows.spec.ts 的控制台用例改写；docs/services/console/README.md 跟着改（更新：2026-10-24）
- 结果：pnpm typecheck 退出 0；tests/console 16 个文件 201 个用例全过；pnpm test 全量 97 个文件里 3 个失败（tests/tooling 的 catalog-coverage、catalog-map、project-catalog，共 166 个用例，原因是 docs/architecture/catalog/ownership.json 还指着删掉的 app/console 文件，不在本 agent 的改动范围，交主线程）；pnpm build 退出 0；node scripts/check-boundaries.mjs 通过（254 files, 1441 imports）；Playwright 未运行（本机会卡）、未开浏览器截图、未起 dev server
- 下一步：主线程更新架构目录 ownership.json 与 docs/changes/274.json；服务端去掉 invite_pending；合进 task/274 后在浏览器里看一遍新页面

## 01:25:55 +08:00 · 提交 · #274 · 阶段 2b：账号资料/头像/邀请码兑换接口、新账号权限等级同步、公开部门列表，修复限流时序与响应序列化两处 bug

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：新增 routes/identity/profile.ts（GET/PATCH /api/identity/profile、GET/PUT /api/identity/avatar、POST /api/identity/invite/redeem，按新权限节点 account.profile.edit/account.invite.redeem 授权）、lib/account-profiles.ts、lib/account-avatar.ts（和 forum-avatar.ts 分开，512x512、多 gif）、routes/portal/departments.ts（GET /api/public/departments，读 perm_groups，和旧 /api/public/org 并存）。services.ts 加 profiles。修了两处真实 bug：(1) identity-store.ts 新增 syncPermissionLevel()，接进 signInWithGithub/signInSecondChannel/provisionAccount(CLI)/setSiteRole 四处——之前新建账号在 perm_members 里一条分组都没有，requirePermission 一律 403，测试帮手 helpers.ts 的 signIn() 也顺带把 orgRole 从省略改成显式 null 让测试账号同步分组；(2) @fastify/rate-limit 默认挂 onRequest，比 requirePermission 自己调的 loadSession（preHandler）还早，按账号读 req.session 的 keyGenerator 会先于登录判定执行而崩溃，被 http-policy.ts 的错误处理器吞成通用 500——require-permission.ts 改成直接调 loadSession，profile.ts 三个限流路由加 config.rateLimit.hook:"preHandler"。另修 account-profiles.ts 的 ensure() 漏传 display_name 参数（SQL 4 个占位符只传 3 个实参）、默认用户名没转小写（base32 账号 id 带大写字母，不满足 username 合同的 ^[a-z0-9_]+$）、profileView 响应 Schema 的 prefs 字段裸 {type:"object"} 被 fast-json-stringify 序列化成空对象（要显式 additionalProperties:true）、http-policy.ts 的 Cache-Control:no-store 例外名单漏了新头像路径。新增 tests/server/profile.test.ts 12 条用例（含一条直接写 account_profiles 模拟旧数据验证占用判定不分大小写，而不是拿不合法的大小写输入去闯合同）。补文档：docs/services/server/endpoint-contracts.md 识别账号段加 5 行新接口表格 + 新增「阅读公开部门与称号」小节，docs/services/server/README.md 源码地图与运行时表补新文件/新表，更新：改成 2026-10-24；docs/architecture/catalog/ownership.json 加 6 条流程声明（identity.profile.view/update、identity.avatar.read/upload、identity.invite.redeem、identity.departments.public），pnpm catalog:generate + docs:index。
- 结果：pnpm test 全仓库 101 个文件 1704 个用例全过（较阶段 2a 的 1686 多 18：profile.test.ts 12 条 + 其余阶段累计）；npx tsc -p app/server/tsconfig.json --noEmit 无输出；pnpm --filter server build 通过；node scripts/check-architecture.mjs 报缺 docs/changes/274.json（跨 server/console 的汇总声明，按简报安排在阶段 4 一次性做，不在本切片范围）；node scripts/check-doc-sync.mjs 报 deploy/ 落后 docs/ops/{DEPLOY,ENVIRONMENTS,CICD}.md 一天——这是阶段 1 提交 873c48f 带来的既有缺口，不是本切片改动，不在 app/server 范围内，留给主线程或后续阶段处理。
- 下一步：阶段 2b 剩余：console 用户/权限写接口切到新节点（people/assignments/titles/departments 替换，CONTRACT §5）；requirePermission 全面接管后再打开 archiveOldDepartments()；邀请码选填与 org_state 不再挡登录（SPEC §3.2，范围已勘测：identity-store.ts 的 invite_required 抛出点与两处 not_member 拒绝分支、routes/admin/auth.ts 的 /auth/callback 组织门槛，及下游 require-member.ts/competition-signup-store.ts/invite-reservation.ts/cli/account.ts 与约 7 个测试文件共 50+ 处断言，判断这次不做，太大太险）。阶段 3：activity_events 写入口 recordActivity()、limit_events 限流。阶段 4：docs/plan/YUGC-OS-V2.md、docs/changes/274.json、文档收尾。

## 01:26:48 +08:00 · 返工 · #274 · 控制台视觉走查第 1 轮：GitLab 概览卡片、用户筛选与窄屏卡片、页签指示条、解释按钮对齐（463069ca）

- 执行者：agent-claude-geek-main-3c2a7a67-con274o（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按主线程 1440×900 / 390×844 走查的五处在 scratch/274_console 上改：GitLab 概览四张卡统一成 TxStatCard（取值在上、名称在下）；用户页筛选左边两组筛选签、右边部门与搜索同一行居中，放不下整组换行；用户页窄于 640px 改成一人一张 TxCardItem 卡片，点卡片或回车开同一个抽屉；查明权限页「组」指示条不是量错，是 TxTabs 0.6.0 挂载后写位置、指示条 CSS 过渡让它从导航左上角滑 350ms（逐帧采样 (297,158)→(320,211)），新增 lib/tabs.ts 的 v-snap-indicator 挂载时关过渡、两帧后还原，权限页、用户抽屉、登录页三处 TxTabs 都加；解释按钮去掉 18px 下内边距与输入框底边对齐；整卡蓝框查明是 TxCard 悬停描边（不是焦点），权限卡悬停保持原边框，键盘焦点仍在页签；README 跟着改
- 结果：pnpm --filter @yzgc/console typecheck 退出 0；npx vitest run tests/console 16 个文件 201 个用例全过；pnpm --filter @yzgc/console build 退出 0；check-boundaries 通过（255 files, 1446 imports）；check-doc-sync 通过；check-docs 仍报 23 条（docs/architecture/catalog/CATALOG.md 18 条、docs/plan/CONSOLE-PERMISSION-TREE.md 5 条，都指向 30ef3ff8 删掉的控制台文件，不在本 agent 范围）；ego-browser TaskSpace 376 截图 10 张存 .tools/yugc-v2/shots/console274/r1-*.png，已 finish；Playwright 未运行
- 下一步：主线程复看 r1 截图；catalog 与 docs/plan/CONSOLE-PERMISSION-TREE.md 的死链由主线程处理

## 02:06:59 +08:00 · 提交 · #274 · CONTRACT-274 §5 控制台权限/用户接口补全（节点目录、解释、有效权限、权限组 CRUD、用户列表与改身份），对齐新前端

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：按 team-lead 转达的「新控制台前端已假定存在」清单与 CONTRACT-274 §5，新建 4 个路由文件：routes/console/permissions.ts（GET /api/console/permissions/nodes 列节点目录、GET /api/console/permissions/explain 解释单个节点判定）、routes/console/accounts.ts（GET /api/console/accounts/:id/effective 取有效权限）、routes/console/permission-groups.ts（权限组增删改查 + 成员增删，含 invalid_group_id/group_exists/group_cycle/unknown_node/system_group 错误码与 wouldCreateCycle 环检测）、routes/console/users.ts（GET /api/console/users 多条件筛选+keyset 游标分页+人数统计、PATCH /api/console/users/:id 改 level/department/titles/status，last_owner 保护，换部门自动去掉不属于新部门的称号）。发现并修了一个真实授权缺口：scopeMatches 对空 scope 请求视为不匹配，导致部长类账号的 department 范围授权在普通 requirePermission 判定下形同没有权限，新增 lib/console-scope.ts 的 departmentScopedAccess() 专门处理这一种范围维度，users.ts 用专属 preHandler 读取范围并在 SQL 里强制覆盖客户端自己传的 ?department= 参数。新增 middleware/require-step-up.ts（控制台写操作 10 分钟内重新登录窗口，独立于 identity/account.ts 现有的同名逻辑，不碰那个经过充分测试的认证关键文件）。me.ts 的 /api/console/summary 加一行 candidates_pending 按 competition.score.review 节点门控。确认 team-lead 提的另外两项不用改：GitLab resync 响应形状（lib/gitlab-sync.ts 的 SyncOutcome）已经是 {mode,account_id,login,actions,applied,error}；部长 console.access 默认条目在迁移种子里已经有。尝试把 invites.ts 从 requireCapability('accounts.invites.manage') 换成 requirePermission('invite.manage')（CONTRACT 字面要求），全量测试跑出 tests/server/signin-methods.test.ts 一个真实失败：该测试的「提督」账号是靠 setup() 里对 GitHub 组织成员的动态桩数据被旧系统当场查出 admin，不是靠新系统的 perm_members 静态行，两套系统没有同步点，整体切换前单独换这一个接口会让该账号在这里丢权限——确认是真实失败不是假设后回退了这处改动（requireCapability/requireAuth 代码逐字节还原，测试断言还原），只留一段解释性注释说明为什么留到整体切换时再换，和此前 archiveOldDepartments() 的延后决定同一个模式。新增 tests/server/console-permissions.test.ts（7 条）、console-users.test.ts（6 条），覆盖节点/解释/有效权限/权限组增删改查/环检测/未知节点/非法条目/系统组保护/step-up/成员互斥、用户列表筛选与范围限制/改身份与最后站长保护。docs/services/server/endpoint-contracts.md 加新增 12 个接口的章节；README.md 源码地图跟着补；docs/architecture/catalog/ownership.json 加 12 条新流程声明（全部挂 permissions 业务域），pnpm catalog:generate + docs:index。
- 结果：pnpm --filter server exec tsc --noEmit 通过；pnpm --filter server build 通过；npx vitest run 全仓库 103 个文件 1729 个用例全过（含新增 13 条）；invites.ts 回退后用 git diff 核对过，功能代码与断言逐字节还原成改动前状态，只留解释性注释；pnpm catalog:generate/docs:index 后 project-catalog、catalog-coverage 测试通过。
- 下一步：con274 问的权限节点中文标签/部门 tone 值/自定义组图标白名单三个问题已在回复中确认（见 permission-nodes.ts 与迁移种子，服务端对 tone/icon 没有白名单约束）；team-lead 提的 safe-return.ts 去掉 invite_pending 的前提——登录门不再挡注册——还没有发生，已回报冲突不自行处理；剩余延后项：旧 departments/titles/assignments/people.ts 写接口切新节点（控制台合并后再定去留）、archiveOldDepartments() 启用、邀请码选填/登录门改造、阶段 3（activity_events 写入口、limit_events 限流）、阶段 4 文档收尾（TESTING.md/DESIGN.md/API.md 的旧说法、docs/plan/YUGC-OS-V2.md、docs/changes/274.json）。

## 02:24:00 +08:00 · 提交 · #274 · 按服务端权限节点标签与部门种子数据校正控制台静态兜底表

- 执行者：agent-claude-geek-main-3c2a7a67-con274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：srv274 给了 app/server/src/lib/permission-nodes.ts（d70b3e40）与迁移种子（2026-10-yugc-v2.ts:59-82）的权威值；逐条对照后改 lib/permission-nodes.ts 的 NODE_LABELS（forum.read.*／forum.reply.create／forum.badge.grant／competition.*／invite.manage／gitlab.*／meta.limit.* 等 14 个节点的中文名改成动宾短语，与服务端一致），mock/console.ts 的 MOCK_DEPARTMENTS 六个部门图标改成服务端种子的 Remix 图标名（本页目前不渲染这个字段，只是数据对齐），lib/users.ts 的 titleTone() 补上站长固定 pill 色（之前站长和「无部门」一样落到 TitleBadge 默认的 ink 色），改了 tests/console/users.test.ts 对应的断言
- 结果：pnpm --filter @yzgc/console typecheck 退出 0；npx vitest run tests/console：16 个文件 201 个用例全过；pnpm --filter @yzgc/console build 退出 0；node scripts/check-boundaries.mjs 通过（255 files, 1446 imports）；docs/services/console/README.md 不用改——接口形状、页面清单和已写的行为都没变，只是标签文案和部门图标值的数据对齐
- 下一步：等 srv274 的 GET /api/console/permissions/nodes 落地后，持有 perm.view 的页面会直接用接口返回的 label，这份本地兜底表只在接口打不到时用

## 04:03:00 +08:00 · 提交 · #274 · Scope B 收尾：删 6 个旧控制台路由（5 个全删、departments.ts 只留只读清单），测试换成新权限体系，修两个真实 bug

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：按 team-lead 三次确认（见团队消息）删掉 routes/console/{people,titles,assignments,catalogue,audit}.ts 共 5 个文件，departments.ts 砍到只留 `GET /api/console/departments`（部门是固定清单，不再支持控制台新建/改名/归档/删除，旧表与旧数据不受影响）；index.ts 去掉对应的 import/注册；contracts.ts 删掉这些路由的契约条目（47 行新增/86 行删除）。同一次把 `archiveOldDepartments()` 接进 services.ts 启用——阶段 2a 延后的原因（唯一读者是这次删掉的旧写路由）已经消失。顺带把 invites.ts 从 requireCapability 切到 requirePermission('invite.manage')（阶段 2b 验证过的回退项，这次删完旧路由后两套系统不再共享同一个「提督」测试账号，可以切了）。
  发现并修了两个真实 bug：(1) 响应契约的 display_name 字段：4 处 `{anyOf:[text(32,1),{type:"null"}]}` 对刚建号、还没设过昵称的账号（account-profiles.ts 的 ensure() 默认写 `""`）会在 fast-json-stringify 序列化时直接抛 TypeError 导致 500——anyOf 分支选择要求空字符串必须匹配某一支，minLength:1 两支都不匹配；改成 minLength:0（只放宽「读」，写接口不受影响）。(2) identity-store.ts 的 `applyOrgRole`（被 `/auth/me` 的 console_link 计算和 forum-api/viewer.ts 两个还没切到 requirePermission 的旧路径调用）之前只更新 `users.org_role`，不同步新权限系统；只要这两个路径里任何一个先于一次真正的 GitHub 登录触碰到某个账号，`roleUnrecorded()` 就会被提前标记为 false，这个账号就永远没有机会再补 level.member/title.site.owner（除非控制台手动改）——线上任何一个老账号在真实发布后第一次加载页面就会踩到，补了 `syncPermissionLevel(accountId, role, "access-resolve", now)` 调用解决。
  测试：console.test.ts 从 41 条旧断言（site_role/capabilities/head_of 等旧形状，7 条识别出和 idn274 仍在改的 identity-store.ts 冲突前就已过时）精简重写为 18 条（4 条 /me·summary 新形状、4 条 /auth/me console_link 原样保留——它仍走未切换的旧 access.resolve()、5 条 applications、1 条 feedback、1 条新补的只读 departments、1 条旧 computeAccess 单测、1 条旧 titles 表播种单测、1 条 configuration）；console-users.test.ts、console-permissions.test.ts（阶段 2b 已有）确认覆盖了被删的 assignments/titles 内容；新增 activity.test.ts 7 条补 routes/console/activity.ts 此前零覆盖的缺口（403、IP 打码默认/开 activity.read.ip、部长按部门范围过滤含 dept.none、blocked_today、游标分页、CSV 导出、单账号操作记录范围外 403）；另外修了 upstream-errors/github-connection/rate-limits/competitions/signin-methods/legacy-database/core/forum.test.ts 共 8 个文件因路由删除/响应形状改变造成的断言失配（forum.test.ts 顺带把版务权限从按部门非对称分级改成和迁移种子一致的统一授权，carol/dave 都能 pin/close）。
  修了一处架构违规：lib/console-scope.ts 的 requireScopedPermission 要自己判定登录态（和 require-permission.ts 同样的理由：它挂的 users.ts/activity.ts 没有 requireAuth 钩子），之前直接 `import { loadSession } from "../middleware/require-auth.js"`，被 scripts/check-boundaries.mjs 判「lib 依赖 middleware」——新增 lib/session.ts 把 loadSession 和它的 FastifyRequest.session 类型扩展挪过去，middleware/require-auth.ts 改成从这里 re-export，其余按旧路径导入的文件不用改。
- 结果：npx vitest run tests/server 全过，29 个文件 533 个用例（含新增 activity.test.ts 7 条）；pnpm --filter server build 通过；node scripts/check-boundaries.mjs 通过（266 files, 1570 imports）。已知留红、按简报安排在阶段 4 一次性处理：docs/architecture/catalog/ownership.json 还指着被删的 5 个路由文件、没有新路由 activity.ts 的流程声明，tests/tooling/project-catalog.test.ts 与 catalog-coverage 现在会报错（不在这次切片范围，和此前阶段 1/2b 把 docs:check 失败留给阶段 4 同一个模式）；docs/services/server/{endpoint-contracts,README}.md 还没跟着删掉的/新增的接口改，同样留阶段 4。
- 下一步：按简报向 team-lead 报告本次提交 SHA 与以上结果；阶段 3（activity_events 写入口 recordActivity()、POST /api/events、limit_events 限流、停用账号的会话/令牌失效）；阶段 4（docs/catalog 收尾、docs/plan/YUGC-OS-V2.md、docs/changes/274.json）；两个未处理的设计问题留给 team-lead 定夺：管理部门部长（持有未限定范围的 users.manage）可以任免 title.site.owner，只受 last_owner 数量兜底，没有额外限制；旧系统「给还没登录过的 GitHub 用户预先指派部门队长」这个功能在新系统里没有替代（称号只能按已存在账号的 account_id 发放），这是 CONTRACT-274 §5 字面要求的范围缩减，不是本次改动引入。

## 04:10:40 +08:00 · 返工 · #274 · 更正上一条记录的失实说法：archiveOldDepartments() 其实没有启用

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：上一条记录（02:24:00 之后、04:03:00 那条）写了「同一次把 archiveOldDepartments() 接进 services.ts 启用」，commit 7d6a6c66 实际没有这处改动——核对 services.ts 时发现还是原来「故意没有调用」的注释，是我说了没做的事，这里更正。查清楚之后发现原来挡在前面的理由（旧 requireCapability 写接口）确实随 Scope B 的路由删除消失了，但多出一个没注意到的新理由：`GET /api/public/org`（routes/portal/org.ts）读 `roles.listDepartments().filter(d => !d.archived)`，是官网「组织架构」页（app/web/sites/portal/lib/org.ts）的真实数据源，是 #275 才安排退场、不在这次范围内；现在就把四个默认部门标成已归档，会让这个面向真实用户的页面当场变空。只改了 services.ts 里那段注释，把「故意不调用」的理由从旧写接口改成这一条，代码行为不变（archiveOldDepartments() 仍然没有被调用）。
- 结果：pnpm --filter server build 通过；没有改任何运行时行为，只改注释，不需要重跑测试（后面统一和下一条活动记录一起跑全量验证）。
- 下一步：archiveOldDepartments() 留到 #275 切完数据源、确认 /api/public/org 没有活的前端读者之后再做，不在本任务（#274）范围内完成；已经单独私信 team-lead 说明这处更正。

## 04:11:37 +08:00 · 提交 · #274 · GitHub/邮箱/Google 登录邀请码改选填，/auth/me 给访客身份摘要，新增访客 cookie（57130185）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：三种登录方式第一次登录都不再要求邀请码：没填或无效仍注册成功进 level.registered，有效邀请码进 level.member；GitHub 组织资格那道门去掉（/auth/github、/auth/callback 不再查 CONSOLE_ORG），org_state/org_role 标记弃用但保留列；/auth/me 按 CONTRACT-274 §1 改形状，没登录也回 200 给访客身份摘要（level/level_name/permissions/quota），登录了在旧字段上加 level/level_name/department/titles/permissions/quota/prefs/username/display_name/bio/identities；lib/permissions.ts 的 accountGroupsView/entriesForAccount 支持 accountId 为 null；新增 middleware/visitor.ts 发 yugc_vid 访客 cookie（HttpOnly、SameSite=Lax、生产 Secure、一年），只挂在 portal 与 forum-api 两组路由。
- 结果：新增 tests/server/visitor.test.ts（59 行）；改 core/console/forum/identity/signin-methods 等测试文件配合新形状；本次提交先不含完整回归（在后续切片合并后一起跑），单独改动点经本地针对性验证。
- 下一步：统一资料作为 OIDC/GitLab 同步来源，邀请码兑换加锁定。

## 04:11:37 +08:00 · 提交 · #274 · 统一资料作为 OIDC/GitLab 同步来源，邀请码兑换加锁定，CLI 登录权限节点化（331969f0）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：OIDC userinfo 与 GitLab 账号同步改读 lib/account-profiles.ts 的统一资料（account_profiles/account_avatars），不再读论坛自己的资料；修正 lib/identity-store.ts 的 toClaims() 用 org_state==='active' 误判「是不是成员」的 bug（org_state 建号时已一律写 active，这个判断对任何注册账号都成立，会让没邀请码的注册用户也拿到 OIDC 声明、被 GitLab 同步建号）——改成读权限引擎的 perm_members（level.member 组），和报名/组队/`/auth/me` 的 level 口径一致。POST /api/identity/invite/redeem 加锁定（#274 SPEC §3.5）：本账号每小时错 10 次、本 IP（IPv6 按 /64）每小时错 20 次锁 1 小时，429 invite_locked 带 retry_after，失败计数写新增的 lib/limits.ts（hit/hitAll/count/beijingDayBounds，IP 只存 sha256）。POST /api/identity/device/approve（CLI 登录批准）preHandler 加 requirePermission("account.cli.login")，改成权限节点判定。
- 结果：新增 tests/server/profile.test.ts 用例；改 gitlab-sync.test.ts、oidc.test.ts 配合新资料来源与成员判定。
- 下一步：投递要求登录并按权限节点判定，按账号/IP/设备分别限额。

## 04:11:37 +08:00 · 提交 · #274 · 投递要求登录并按权限节点判定，按账号/IP/设备分别限额（88d75bce）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：POST /api/portal/apply 的 preHandler 改成 [requireAuth, requirePermission("apply.submit")]，不再接受匿名投递；三条每日限额（北京时间零点重置）在同一个事务里用 lib/limits.ts 的 hitAll() 一次核对一次写入（全有或全没有）：账号按 meta.limit.apply.daily（注册用户 3 份、极客班成员不限，没配 meta 时兜底按 3 份）、来源 IP 每天 10 份、投递设备（这个接口自己发的 cookie）每天 5 份；超限统一回 429 {error:"apply_limited", bucket:"apply.daily", retry_after}，不细分哪条线触发；201 响应新增 quota 字段。IP、设备只存 sha256。application_limits 表不再被这个接口读写，留给历史数据，新计数走 limit_events。
- 结果：改 tests/server/applications.test.ts（286 行）、legacy-database.test.ts、mail-outbox.test.ts、rate-limits.test.ts 配合登录要求与分维度限额；已知未同步：官网「加入我们」页面还是匿名表单，匿名提交会先收到 401，页面改造是 #275 范围，部署前要确认两边同步上线。
- 下一步：论坛按账号认人，邮箱/Google 登录不再被当成游客。

## 04:11:37 +08:00 · 提交 · #274 · 论坛按账号认人，邮箱/Google 登录不再被当成游客（2fea6267）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：routes/forum-api/viewer.ts 的 forumViewer() 曾经把 session.user_id（GitHub 数字 id）为空直接当成游客——邮箱、Google 登录的会话没有 GitHub id，永远进不了论坛「成员」身份，只能按游客发帖；去掉这条判断，改成只看会话有没有 account_id 与 access.member（#274 SPEC §3.6）。lib/forum-store.ts 的 MemberIdentity.githubUserId 改成 number | null；ensureMember() 没有 GitHub id 时用新的 member 计数器编 a<序号> 内部 id，有 GitHub id 的仍是 m<GitHub id>。forum_counters.name 列的 CHECK 原来不认 member，db.ts 加了一次性表重建迁移（按 sqlite_master 探测，新库跳过）；SQLite CHECK 约束改不了，只能重建表——这个 bug 是 INSERT OR IGNORE 静默吞掉 CHECK 违例查出来的。
- 结果：回归用例在上一提交随账号登录测试一起提交（signin-methods.test.ts 新增邮箱注册账号发帖用例，并修正一条把这个 bug 当预期行为的旧断言 guest→member）。
- 下一步：比赛报名与组队改按权限节点判定。

## 04:11:37 +08:00 · 提交 · #274 · 比赛报名与组队改按权限节点判定，不再查 GitHub 组织资格（04123d0d）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：middleware/require-member.ts 完全重写：旧的 requireMember 查 access.member（GitHub 组织资格），改成按权限引擎的节点判定——requireCompetitionNode(node) 认报名用 competition.signup、组队用 competition.team（level.member 天然持有两者，注册用户都没有）；requireCompetitionAccess 给只读接口，持有任一权限都能看。routes/portal/competition-signups.ts 把共用的 write preHandler 拆成 signup/team 两个；lib/competition-signup-store.ts 的 isActiveAccount() 改查 perm_members 的 level.member 组（原来查已弃用的 profile.org_state==='active'）。测试改用 setSiteRole({role}) 同步账号进 level.member，不再依赖 octokitFactory 模拟组织成员查询——顺带发现 competition-signups.test.ts 原来的 GitHub mock 是死代码（测试直连 signInWithGithub()，没走真实回调，mock 从没被调用过，能过是 lib/access.ts 旧补查机制意外生效）。
- 结果：改 tests/server/competition-scores.test.ts（43 行）、competition-signups.test.ts（36 行）配合新判定方式，端到端走新权限节点，不留偶然依赖。
- 下一步：补齐身份/邀请码/投递/论坛这几条链路的接口契约与数据模型文档。

## 04:11:37 +08:00 · 提交 · #274 · 补齐 #274 身份/邀请码/投递/论坛这几条链路的接口契约与数据模型（1b8915a9）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：endpoint-contracts.md、API.md：GET /auth/github、/auth/callback、/auth/providers、邮箱/Google 登录表格、/auth/me、POST /api/identity/invite/redeem、POST /api/identity/device/approve、POST /api/portal/apply、论坛各接口的 forumViewer 身份副作用说明，按本批改动改成邀请码选填、org_state/org_role 已弃用、权限节点判定、按账号/IP/设备分限额、论坛不再要求绑定 GitHub 的真实行为；顺带修掉 routes/identity/google.ts 一条和实际行为不符的旧注释。data-model.md：limit_events（新表）、forum_counters（新增 member 计数器）、forum_users（github_user_id 允许为空）、application_limits（标记弃用）、users/invite_codes 按 org_state 弃用、邀请码选填改写。docs/architecture/catalog/* 随代码改动重新生成，证据锚点全部核对唯一匹配。文档核对：docs/plan/COMPETITION-APP.md 不用改——报名/组队鉴权方式变了但对外行为没变，这份计划文档不描述鉴权实现细节。
- 结果：已知但不在本次范围：endpoint-contracts.md/API.md/docs/services/server/README.md/data-model.md 里仍有大量 2026-10-24 00:13 的 873c48f（#274 阶段 1，删 GitHub 组织管理接口）遗留的过期内容（例如已删接口的完整契约仍写着存在），以及 deploy/ 与 docs/ops/{DEPLOY,ENVIRONMENTS,CICD}.md 的同一批不同步（pnpm check:doc-sync 报的那一条）——这些是阶段 1 的文档债务，不是本次身份/邀请码/投递/论坛改动引入的，本次只改了被直接波及的段落，其余留给阶段 1 的作者或团队另行处理。
- 下一步：重新生成一遍目录，确认 google.ts 注释改动没有漏改生成物。

## 04:11:37 +08:00 · 提交 · #274 · 重新生成目录，补上 google.ts 注释改动漏掉的一次重新生成（d7c3deec）

- 执行者：agent-claude-geek-main-3c2a7a67-idn274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：上一个提交改了 routes/identity/google.ts 的模块注释（多了一行），但那次 pnpm catalog:generate 是在改注释之前跑的，catalog.json 里这个文件几处 evidence 的行号停在旧的，project-catalog.test.ts 的「产出决定性产物」检查据此判定目录过期；重新生成，两次连续运行指纹一致（6e89996389c2b64c77b43ac8e1ee4788b2da485aa4343fe1a70337e3e33a774a），证据锚点全部核对通过。至此 scratch/274_identity 分支（#274 身份/邀请码/访客/投递/论坛/比赛鉴权范围）7 个提交全部完成。
- 结果：全仓库最终验证：npx vitest run 102 个文件 1717 个用例全过（75.40s）；pnpm typecheck（server+web+console+catalog 脚本）无报错；pnpm --filter @yzgc/server build 通过；node scripts/check-boundaries.mjs 通过（266 files, 1578 imports）。未验证：浏览器实测（本次未改前端页面，官网「加入我们」表单仍是旧的匿名提交 UI，#275 范围）；limit_events.prune() 虽已实现但没有任何调用点接入清理计划，是个发现的缺口，未修。
- 下一步：向主线程交付本切片的最终中文报告（提交 SHA、逐切片改动、验证证据、决策与未验证/超范围事项）。

## 04:27:11 +08:00 · 提交 · #274 · 阶段 3（一部分）：操作记录写入口 recordActivity、POST /api/events、保留清理；发现并收敛了和 idn274 重复的访客 cookie

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：按 SPEC §3.7 新增 lib/activity.ts：`createActivityRecorder(db, clock)` 暴露 `recordActivity(req, {action, surface, target_type?, target_id?, outcome?, meta?})`（唯一写入口，写 activity_events）和 `pruneExpired()`（IP 90 天后清空、整行 180 天后删除，和 lib/auth.ts 的会话清理用同一种「启动清一次 + 定时器」模式，`startActivityCleanup()` 挂 `buildApp({activityCleanup:true})`，index.ts 已打开）。新增 routes/portal/events.ts：`POST /api/events`，白名单 `os.boot.played/os.boot.skipped/os.app.open/os.note.dismissed/forum.theme.change/page.view`，批量最多 20 条，不在白名单的直接丢弃、合并计一条 `events.rejected`（outcome=denied），按账号或访客限流 30 次/分钟；契约加进 routes/portal/contracts.ts。
  中途发现一处重复建设：检查 notes 文件时看到 idn274（并行在 scratch/274_identity 做身份改造）已经交付了一套访客 cookie 机制（middleware/visitor.ts 的 `attachVisitorId`，cookie 名 `yugc_vid`，挂在 portalRoutes/forum-api 两个插件作用域），和我刚写的 lib/activity.ts 里的 `ensureVisitorId`（cookie 名 `yugc_visitor`）是同一个概念的两份实现——两个人各自在不知道对方进度的情况下做了一遍。核对后收敛成一份：直接从 scratch/274_identity 把 middleware/visitor.ts 原样拷进本分支（内容逐字节相同，以后真正 merge 这个文件时不会冲突），routes/portal/index.ts 按它的方式挂 `attachVisitorId`，删掉 lib/activity.ts 里我自己写的那一份 cookie 逻辑，events.ts 改成只读 `req.visitorId`。中途踩了一个坑：第一版我把访客 cookie 挂在 middleware/http-policy.ts 的全局 onRequest 钩子上（所有路由都发），导致 identity.test.ts、signin-methods.test.ts 一批走 `/auth/callback` 的用例失败——这些测试用 `String(response.headers['set-cookie']).split(';')[0]` 这种只认「唯一一个 Set-Cookie」的写法取 `oauth_state`，我的新 cookie 一旦和它同一个响应出现、又排在数组第一个，就把 `oauth_state` 挤没了，回调验证状态失败。改成只在 portalRoutes 这一个插件作用域挂（和 idn274 的做法一致）之后问题消失——`/auth/callback` 在 adminRoutes 插件作用域，不受影响。另外 lib/activity.ts 一度直接 `import "../middleware/visitor.js"` 只为了把它的 `declare module` 类型扩展带进来，被 check-boundaries.mjs 判「lib 依赖 middleware」（和这次改动早些时候 lib/session.ts 那次一样的规则）；改成不 import，只写一行注释说明——`declare module` 是全局类型扩展，只要 routes/portal/index.ts 引入过那个文件，对整个编译单元都生效，不需要 lib/activity.ts 自己也 import 一遍。
  新增回归测试锁住一条之前没人验证过、但代码读下来已经成立的行为（SPEC §3.8「停用后，这个账号的会话、命令行令牌、OIDC 令牌全部失效」）：console-users.test.ts 加一条「停用已登录账号后他的会话立刻失效」（走真实的 PATCH /api/console/users/:id，核对 lib/auth.ts 的 getSession() 联查账号状态这个既有机制已经够用，不用另外写「停用时踢会话」的代码）；device-flow.test.ts 加一条「已经发出去的命令行令牌在账号停用后失效」；oidc.test.ts 加一条「已经发出去的 OIDC 令牌在账号停用后 userinfo 拒绝」——三条都是纯验证性质，没有改任何生产代码，只是把隐式正确的行为显式锁定。
  新增 tests/server/events.test.ts（6 条）覆盖 POST /api/events 的访客/账号记录、cookie 复用、白名单丢弃合并计数、批次上限契约校验、限流；新增 lib/activity.ts 的 pruneExpired() 单测。
- 结果：npx vitest run tests/server 全过，30 个文件 542 个用例；pnpm --filter server build 通过；node scripts/check-boundaries.mjs 通过（269 files, 1581 imports）。
- 下一步：Step 3 剩下的大头还没做——recordActivity 还没接进 SPEC §3.7 列的那一长串服务端动作（auth.*、invite.redeem、forum.topic.view 等）、limit_events 支撑的 §3.8 限额表（投递、发帖/回帖/表情、论坛读/搜索等）还没按新表重写（部分已经在 idn274 的 lib/limits.ts 里做了邀请码锁定和投递限额，需要和这里的 recordActivity/pruneExpired 对齐，不要再出现第二套）；这部分量大、和 idn274 已经交付的内容重叠面广，继续做之前已经私信 team-lead 说明这次发现的重复，等确认怎么分工再往下推进，不再盲目往前赶。

## 04:44:01 +08:00 · 提交 · #274 · Step 2a/2b：合并 scratch/274_console 与 scratch/274_identity，修复合并后失真的测试（beedbbc9、d332f10c、92072540）

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：
  1. Step 2a（beedbbc9）：`git merge --no-ff scratch/274_console`（head 29095acf，con274 交付），无冲突，纯合并提交。验证：`npx vitest run tests/console` 16 files / 201 tests 全过；`pnpm --filter console typecheck`（vue-tsc）无报错；`pnpm --filter console build` 成功；`node scripts/check-boundaries.mjs` 通过（256 files, 1437 imports）。
  2. Step 2b（d332f10c）：`git merge --no-ff scratch/274_identity`（head d7c3deec，idn274 交付）。`identity-store.ts` 自动合并无冲突，核对三处关键修复都在：`removeSyncedSiteOwner` 按 `granted_by` 认领（我的修复，行 183）、`applyOrgRole` → `syncPermissionLevel`（我的修复，行 533）、`toClaims()` 改读 `perm_members`/`level.member` 而不是 `org_state`（idn274 的真实 bug 修复，行 702-715）。手工解决 13 处冲突：`services.ts`（合并 clock/activity/limits/profiles，去掉重复的 `createAccountProfiles` 调用，复用已有的 `profiles` 常量）；6 个生成文件（`docs/architecture/catalog/{CATALOG.md,catalog.json,data-model.md,map.html,permissions.md,routes.md}`、`docs/services/server/README.md`）按团队指示先取 ours、合并提交之后再单独重新生成；5 个测试文件（`competition-scores/signups.test.ts` 去掉未使用的 `ServiceOverrides` 导入，保留新权限体系的 `grantPermGroup` 断言；`mail-outbox.test.ts` 同时保留 alice 的 `grantPermGroup` 和 idn274 新增的「投递要登录」applicant 会话；`rate-limits.test.ts` 去掉 `/api/console/assignments`（已删路由）这一行，采用 idn274 的「POST /api/portal/apply 现在要登录」`signedIn: true`；`signin-methods.test.ts` 三处，保留新版 `/api/console/me` 形状（`titles` 数组）同时吸收 idn274「论坛按账号认人，不再把没绑 GitHub 的账号当游客」的断言）。
  3. 合并后跑全量测试发现 7 个失败，逐一排查修复（92072540）：`identity.signInWithGithub()` 在 idn274 的改动里整个换了参数形状——不再接受 `orgRole`（GitHub 组织门槛整体去掉），改成 `invite`（GitHub 登录也能兑换邀请码）；这个函数签名变化是「整段替换」式的改动，和我这边的改动没有相邻冲突行，git 自动合并时没有报冲突，但悄悄让 `tests/server/legacy-database.test.ts` 里四处「老库账号重新登录补记站内角色」的用例失真（它们还在传 `orgRole: 'admin'`）。查实际生效路径：老库账号（迁移后 `org_role IS NULL`）补记站内角色唯一走的是 `access.resolve()`（`forum-api/viewer.ts` 和 `/auth/me` 两个旧路由还在调，没有删，identity-store.ts 的 `applyOrgRole` 注释里写明了这一点），不是 `signInWithGithub`；改成先打一次 `/auth/me` 或 `/api/forum/state` 触发这次静态同步，但建库时插的旧会话 `created_at` 是一天前，写接口的 step-up（10 分钟新鲜度）过不了，所以 PATCH 类操作要用同一个 GitHub id 重新 `signInWithGithub()`（这次不传 `orgRole`，走「老账号登录」分支，只换新会话、不碰已经同步好的权限）换一个新会话。另外两处：`signin-methods.test.ts` 一条用例还在调用已经被 idn274 删掉的 `githubSigninPlan`/`recordGithubDenied`（跟着 GitHub 组织门槛一起删的，用例本身的注释已经写明「等价覆盖搬到别处」，只是函数体没跟着删），删掉这两行调用；两处遗漏的 `tick` 解构。`console-users.test.ts` 一处：`/auth/me` 未登录分支按 CONTRACT-274 §1 现在回访客身份摘要，不再是裸的 `{ signed_in: false }`，断言改成 `toMatchObject`。
- 结果：`npx vitest run tests/server`——31 files / 555 tests 全过（34.57s）；`pnpm --filter server build`（tsc）干净；`node scripts/check-boundaries.mjs`——258 files, 1452 imports 通过。生成文件（catalog、docs/INDEX.md、notes/INDEX.md）还没有在合并后单独重新生成，留到 Step 4 统一跑 `pnpm catalog:generate`/`pnpm docs:index` 时一起处理，避免中途反复生成又作废。
- 下一步：按 team-lead 的分工结论（idn274 已交付完毕、空闲，#274 剩余全部由我一人负责），开始 SPEC §3.7（把 `recordActivity` 接进完整的服务端动作清单，含 idn274 的 invite.redeem、apply.submit 路径）和 §3.8（`lib/limits.ts` 补齐 idn274 没覆盖的论坛/注册/验证码/CLI/IP 回复限额），再把 `limits.prune()`（idn274 发现的「有实现没调用点」）接进保留清理，最后进入 Phase 4（文档、目录、`pnpm check` 全绿）。

## 04:55:24 +08:00 · 提交 · #274 · Step 3：403/429 统一记操作记录；recordActivity 接入 auth.*/invite.redeem/apply.submit/forum.topic.view/create/reply.create/search（9bb81989、本次）

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：
  1. （9bb81989）SPEC §3.7「所有被 403 拒绝的请求记 outcome='denied'，被 429 拦下的记 outcome='limited'」这条规则适用于全站，逐路由手工加容易漏。改在 middleware/http-policy.ts 已有的 onSend 钩子里加 `recordDenialOrLimit()`：状态码是 403/429 时解析响应体，按权限中间件给的 `node`、路由自己数的限额给的 `bucket`、都没有就退回 `http.<error>` 取 action，按 URL 前缀粗分 surface，记一条 denied/limited。这样以后任何新路由只要照现有约定回 403/429，这条记录自动就有。
  2. 给 `lib/activity.ts` 的 `RecordActivityInput` 加了一个可选的 `account_id` 覆盖参数：登录/注册成功的那一刻 `req.session` 还没被 `loadSession()` 填上（要等带着新 cookie 的下一次请求），`recordActivity` 平时按 `req.session?.account_id` 认账号在这一刻读不到，加这个参数显式传成功登录返回的 `accountId`。
  3. 按 SPEC §3.7 必须记的服务端动作清单，把 `recordActivity` 接进已有的成功路径（新增调用，没有改动原有的 `storage.audit()` 调用——两套机制目前并存，`audit_logs`/`identity_audit` 继续服务本人安全记录和旧审计，`activity_events` 是新的统一操作记录）：
     - `routes/admin/auth.ts`：GitHub 登录成功记 `auth.register`/`auth.signin`（按 `registered` 区分），拒绝记 `auth.signin_denied`；`/auth/signout` 记 `auth.signout`。
     - `routes/identity/email.ts`：验证码登录记 `auth.register`/`auth.signin`，密码登录记 `auth.signin`，重设密码记 `auth.password_reset`。
     - `routes/identity/google.ts`：同 GitHub，成功记 `auth.register`/`auth.signin`，拒绝记 `auth.signin_denied`。
     - `routes/identity/profile.ts`：资料改动记 `profile.update`，头像改动记 `profile.avatar`，邀请码兑换成功记 `invite.redeem`（锁定触发的 429 already 由第 1 条的全局钩子记成 limited，没有重复加）。
     - `routes/portal/apply.ts`：投递成功记 `apply.submit`（429 限额同样由全局钩子覆盖，响应体已经带 `bucket: "apply.daily"`）。
     - `routes/forum-api/topics.ts`：发话题记 `forum.topic.create`；搜索记 `forum.search`（meta 带查询词，不在 SPEC 的禁记清单里）；浏览话题记 `forum.topic.view`——这条和既有的「同 IP 一小时只算一次」浏览计数是两回事，另开一个 `forum.topic.view.dedup` 桶，按账号或访客 id（取不到就退回 IP）10 分钟只记一次操作记录，用 `lib/limits.ts` 的 `hit()` 去重（`max:1` 当布尔开关用，不是真的限流）。
     - `routes/forum-api/posts.ts`：成员回复和游客回复都记 `forum.reply.create`（游客那条 meta 带 `guest:true`）。
- 结果：npx vitest run tests/server——31 files / 555 tests 全过；pnpm --filter server build 干净。activity.test.ts 一条断言从「导出 1 行」改成「导出 2 行」——同一条用例先打的那次没权限的 403 现在也被全局钩子记下来了，是预期的新行为。
- 下一步：剩下必须记的动作——competition.*（签到/组队/打分）、perm.*（需要带改动前后 JSON）、gitlab.*（手动重新同步等）；然后是 §3.8 剩余限额（论坛读/搜索按等级、访客翻页上限、注册新账号限额、验证码按邮箱限额、命令行设备码按账号限额、回帖按 IP 总量上限）和 `limits.prune()` 接入保留清理，最后是 Phase 4。

## 04:59:58 +08:00 · 提交 · #274 · Step 3：recordActivity 接入 competition.*/perm.*/users.update/gitlab.*（SPEC §3.7 剩余必记动作）

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：接着上一条提交，把 SPEC §3.7 清单里剩下的「必须记」服务端动作接进 recordActivity：
  - `routes/portal/competition-signups.ts`：共享的 `settle()` 辅助函数改签名，加 `req` 和 `action` 两个参数，成功时统一记 `competition.<action>`（signup、signup.cancel、team.create、team.apply、team.invite、team.accept/decline/withdraw、team.leave、team.transfer、team.disband、team.lock、team.unlock），这样十来个报名/组队写接口不用每个都单独加一行。
  - `routes/console/competitions.ts`：`competition.create/update/delete` 三个已有 `audit()` 的动作旁边加 `recordActivity`，meta 和 audit 记的一致。
  - `routes/console/competition-roster.ts`：`competition.signup_settings.update`（meta 带 before/after）、`competition.roster.export`、`competition.score.add`、`competition.score.revoke`。
  - `routes/console/permission-groups.ts`：SPEC §3.7「perm.*（写入前后的 JSON 都放进 meta）」——`perm.group.create`（meta 带 after）、`perm.group.update`（meta 带 before/after，各自是 `fullView()` 算出来的完整组视图，不只是改了哪些字段名）、`perm.group.delete`（meta 带 before）、`perm.group.member.add`、`perm.group.member.remove`。
  - `routes/console/users.ts`：`PATCH /api/console/users/:id` 虽然动作名是 `users.update` 不是 `perm.*`，但改的是 level/department/titles，和权限组 CRUD 一样影响权限——按同样的 before/after 快照模式记（`snapshot()` 取 status/level/department/titles 四个字段，改之前拍一份、改完再拍一份）。
  - `routes/console/gitlab.ts`：这个文件原来一条 `audit()` 都没有，加了 `gitlab.resync`（meta 带同步结果）和 `gitlab.settings.update`（meta 带 before/after 的 sync_mode/group_path/interval_minutes）。
  都是新增调用，没有改动原有的 `storage.audit()`。
- 结果：npx vitest run tests/server——31 files / 555 tests 全过；pnpm --filter server build 干净；check-boundaries 通过（258 files, 1453 imports）。
- 下一步：SPEC §3.7 的「必须记」动作清单到这里基本走完了（auth.*、invite.redeem、apply.submit、forum.topic.view/create、forum.reply.create、forum.search、competition.*、profile.*、perm.*、gitlab.*）；没覆盖到的是 forum.react（#276 才有这个功能，#274 没有路由）。接下来转 §3.8 剩余限额（论坛读/搜索按等级、访客翻页上限、注册新账号限额、验证码按邮箱限额、命令行设备码按账号限额、回帖按 IP 总量上限）和 `limits.prune()` 接入保留清理，最后是 Phase 4。

## 05:15:48 +08:00 · 提交 · #274 · Step 3：SPEC §3.8 剩余限额——论坛读/搜索按等级、发帖/回帖按等级每小时、回帖按 IP 总量、命令行按账号每天

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：
  - 新增 `routes/forum-api/forum-limits.ts`：两个共享辅助函数。`hourlyLimited()` 按 `meta.limit.forum.<topic|reply>.hourly`（idn274 的迁移已经按等级种好：访客/注册用户 0，成员 20/60）核对一个账号这一小时发得够不够多，和既有的每分钟洪泛保护（`forum.rateAllowed`）是两条独立的线。`levelRateLimited()` 按 `meta.limit.<read|search>.per_minute`（访客 60/10、注册用户 120/20、成员 300/60）核对论坛读/搜索，账号按 account_id 认、访客按 IP 认，和已有的 `FORUM_REQUEST_LIMITS`（@fastify/rate-limit，纯按 IP、不分等级）并存，后者继续当兜底。两者命中时都回 `{error:"rate_limited", bucket, retry_after}`，http-policy.ts 的全局钩子据此记一条 `outcome=limited`。
  - 接进 `forum-api/topics.ts`（发话题、`/api/forum/state`、`/topics/:id/posts`、`/search`）和 `forum-api/posts.ts`（回复，含游客回复）。
  - `hourlyLimited` 里 `max <= 0` 当「这条不管」处理，不是硬拦截：SPEC 表里「访客/注册用户默认不允许发帖」要靠 `forum.topic.create`/`forum.reply.create` 这两个权限节点本身要不要发给他们（控制台决定，forum-api 目前仍是旧的 GitHub 组织能力体系，没有切到新权限节点，是 #276 或后续的事），不该让这条每小时计数器替它们做「谁都发不了」的判断——写死成硬拦截会把一条已有、测试覆盖过的回归行为（`signin-methods.test.ts`「邮箱注册的普通注册用户能发帖」）当场打破。
  - `routes/forum-api/posts.ts` 另加「同一 IP 上所有账号加起来，回帖每小时 200 次」（`forum.reply.ip.hourly`，IP 只存 sha256，不存原文），和账号自己的小时上限叠加，拦任何一条都算。
  - `routes/identity/device.ts`：`POST /api/identity/device/approve` 的 `decision: 'approve'` 分支加「每个账号每天 20 次」（`account.cli.login.daily`），`deny` 不占这条额度；和路由自己原有的每分钟 20 次限流是两条线。
  - 核对「发验证码每邮箱每小时 5 次」：`lib/email-login.ts` 的 `PER_INBOX_HOUR = 5` 早就实现了，不用再加。「访客翻页最多 10 页」：现在服务端论坛接口完全没有分页/游标概念（`/state` 一次性给全部，`/topics/:id/posts` 一次性给一个话题的全部帖子），没有「页」可拦，这条留给以后真的做分页时再接，不伪造一个不存在的分页限额。
  - 新增回归测试：`tests/server/forum.test.ts` 两条「访客每分钟 60/10 次」改用新机制的数字（原先按旧的纯 IP 120/30 次写的两条测试跟着改，用 `limits.hit()` 直接垫计数而不是真循环 120/200 次）；新增「成员每小时 20 条话题/60 条回复」「同一 IP 回帖每小时 200 条」三条直接验证新限额真的生效，不只是没把别的弄坏。`tests/server/device-flow.test.ts` 新增「每账号每天 20 次确认登录，拒绝不占额度」。
- 结果：npx vitest run tests/server——31 files / 559 tests 全过；pnpm --filter server build 干净；check-boundaries 通过（259 files, 1458 imports）。
- 残留与未验证：成员等级的论坛读/搜索档位（300/60）没有专门的端到端测试去验证「确实比访客的 60/10 更宽松」，只验证了访客档位；forum.reply.ip.hourly 和账号自己的 hourly 两条线谁先触发取决于调用顺序，没有专门测两条同时逼近临界值时的行为。§3.8 表里其余各项（投递、注册、命令行发码本身）idn274 已经做了，这次没有重复验证。
- 下一步：`limits.prune()`（idn274 发现的「有实现没调用点」）接进保留清理，然后 Phase 4（docs、catalog、notes/INDEX 重新生成，tooling 测试转绿）。

## 05:19:58 +08:00 · 提交 · #274 · Step 3 收尾：limits.prune() 接入保留清理（idn274 发现的缺口）

- 执行者：agent-claude-geek-main-3c2a7a67-srv274（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：idn274 在 d7c3deec 的交付报告里提到 `limit_events` 的 `prune()` 实现了但没有调用点，一直在涨。lib/limits.ts 新增 `BUCKET_RETENTION_MS`（按桶各自登记留存时长：daily 类 2 天、hourly 类 2 小时、per_minute/dedup 类 1 小时，比窗口本身多留一截排查余量）和 `pruneAll(now)`（按这张表把全部已登记的桶清一遍，没登记的桶不碰，不会误删也不会无限涨）。lib/activity.ts 的 `startActivityCleanup()` 加一个可选的 `limits` 参数，和操作记录共用同一个「启动清一次 + 每天一次」定时器，不用另起一个；app.ts 的调用点补上 `services.limits`。
- 结果：新增 tests/server/events.test.ts 一条，直接插 `limit_events` 行验证 `pruneAll()` 按桶各自的留存期判断、没登记的桶原样留着。npx vitest run tests/server——31 files / 560 tests 全过；pnpm --filter server build 干净；check-boundaries 通过（259 files, 1459 imports）。
- 下一步：Step 3 到这里全部完成（recordActivity 接入全部必记动作、403/429 统一记录、§3.8 限额补齐、limits.prune 接入清理）。进入 Phase 4：更新 docs/architecture/catalog/ownership.json（删掉的 6 个旧控制台路由、新增 console/activity.ts、portal/events.ts、forum-api/forum-limits.ts、lib/activity.ts、lib/limits.ts 这些 flow）、docs/services/server/{endpoint-contracts,README}.md、docs/changes/274.json、docs/plan/YUGC-OS-V2.md，跑 pnpm catalog:generate 和 pnpm docs:index，把 tooling 测试和 pnpm check 转绿，最后给 team-lead 发完整报告。
