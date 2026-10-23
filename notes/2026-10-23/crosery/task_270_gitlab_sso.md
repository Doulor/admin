# task/270/gitlab_sso · crosery · 2026-10-23

负责人：crosery

## 10:58:49 +08:00 · 开工 · #270 · 自建 GitLab 用极客班统一登录，每个极客班账号都有对应的 GitLab 账号

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 01:01「……对应的仓库也成为我们进入桌面的一个应用和论坛，控制台，那些一样统一一个sso登录身份，而且所有有极客班登录身份的都有对应的gitlab账号……相关的所有ui设计都全部由你负责」，10:32「二阶段可以继续进行，我这边同意的」，10:45「gitlab那边的登录可以走极客班的sso统一登录，因为毕竟数据都要一起统计」。GitHub 账号被封，issue 建在自建 GitLab geek/admin：先按 GitHub 编号建 #1–#269 占位（只开 #239、#262），再建 #270（https://git.yangtzeu.work/geek/admin/-/work_items/270）。task.mjs start 要连 GitHub，不可用，按 #262 的做法从本机 stage 候选 b542b3be 用 git worktree add 建 task/270/gitlab_sso；与 #262 的分工已和另一个会话（geek-main-56）对好：本分支不改 SignIn.vue、signin.ts
- 结果：worktree .claude/worktrees/task-270，基于 b542b3be
- 下一步：装依赖，写 OIDC 模块、授权页、gitlab-sync 与桌面应用

## 12:11:57 +08:00 · 提交 · #270 · 1b03781c 内嵌 OIDC 签发者、同意页、GitLab 账号同步与桌面「代码仓库」

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：提交 1b03781c（73 个文件）：server 内嵌 oidc-provider 9.12.2 的签发者 /oidc/*（授权码 + PKCE S256、pairwise sub、登录以 sid 为准，没配 OIDC_JWKS 时 404），交互入口与同意页三个接口，五张新表，cli/oidc.ts；GITLAB_SYNC=off/dry-run/on 的账号同步与控制台两个接口；控制台同意页 /authorize；nginx 的 /oidc/ 与 /authorize；官网桌面「代码仓库」；两个环境的 GITLAB_* 与两个密钥；文档与 docs/changes/270.json。截图时发现两处并当场改了：控制台开发代理的 "/auth" 前缀把 /authorize 也转给了核心，改成 ^/auth/；同意页应用图标的底色盖掉了图标的 mask，改成外层容器。宏观对齐的 migration 说明里有尖括号被判成占位，改写。文档核对：docs/services/web/README.md、portal.md、console/README.md、server/README.md、ops 三份都随改动改了。
- 结果：pnpm test 96 个文件 1573 条通过；pnpm typecheck 通过；check:catalog、check:environments、check:secrets、check:docs、check:notes 通过；check:architecture 与 check:doc-sync 按 --base b542b3be 通过（默认的 origin/stage 是 GitHub 上过时的那份，对它比较会把 #262 的改动也算进来）。ego-browser 截图：同意页 1440×900、390×844 无横向溢出、无 emoji；官网桌面 1440×900 图标、便签、Dock 第 3 位是代码仓库，图标列与便签不重叠。截图在 ~/work_file/geek-shots/270/。
- 下一步：合 GitLab stage 2101fe40（geek-main-56 已合 #262 第五轮），派独立审查，开 MR 交给 geek-main-56 合并

## 12:45:39 +08:00 · 提交 · #270 · 844cb9d9 合入 GitLab stage 2101fe40，5cd82f7a 修掉一条不稳定的断言

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：按 geek-main-56 的要求开 MR 前先合 GitLab stage 2101fe40（#262 第五轮已合）：844cb9d9 是 merge commit，冲突只有两处——console README 按 stage 的正文重放本分支的 3 处新增，项目目录的生成物重新生成。合完全量跑测试有 1 条失败，复跑定位到 gitlab-sync 的审计断言按 id 比较先后，两个账号同一毫秒建号时 ULID 的随机部分决定顺序，5 次失败 2 次；5cd82f7a 改成按 target 排序比较。
- 结果：合并后 pnpm test 96 个文件 1581 条通过；gitlab-sync 与 oidc 两个文件连跑 15 次 0 失败；typecheck 与 check:* 通过，check-architecture、check-doc-sync 按 --base 2101fe40 通过。两个提交已推到 GitLab 的 task/270/gitlab_sso。
- 下一步：派独立审查

## 12:45:39 +08:00 · 审查 · #270 · 第一轮独立审查：阻塞 1、应修 3、建议 7，944bd2f4 全部处理

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：独立审查 agent 只读审 git diff 2101fe40 5cd82f7a，结论阻塞：本地没有 gitlab_accounts 记录又已不是成员的账号 plan() 直接返回空，GitLab 在成员第一次用极客班登录时自动建的号，成员在下一轮对账前或同步关着时离开就永远不会被封禁（审查者的探针输出 actions=[]、gitlabState=active、没有 block 调用）。应修：控制台立即同步与定时对账不互斥（同一账号 3 次 POST /users、用户名漂移）；/oidc 回复 hijack 后 oidc-provider 的 server_error 没有日志；执行记录缺提交记录。建议：服务器调用与浏览器共用 120 次限流、同步的 sector 取 GITLAB_URL 与签发者不一致的风险、stop() 等整轮、details 没有 no-store、GitHub blog 可能不是网址、fetch 跟随跳转会带出管理员令牌、revokeByGrantId 不区分模型。944bd2f4 逐条处理：不是成员但在 GitLab sector 有 sub 的按身份找到就封禁、找不到记 blocked 不再找；sector 改取 gitlab 客户端的回调主机，没登记不建号；按账号排队同步；停止标志；不跟随跳转；网站校验；限流分服务器调用 600 与浏览器 120；server_error 记日志；/oidc/ 加 no-store；revokeByGrantId 加 model 条件；文档写明封禁时限只在 on 时成立、GitLab 的统一登录在 on 之后再开。
- 结果：审查者的探针加上登记 gitlab 客户端后复跑：actions=[block]、gitlabState=blocked、调用 POST /users/500/block。新增 5 条回归测试（没同步过就离开、立即同步与对账同时、sector 取客户端与没登记、网站、停下），限流测试改成两类分开算并核对浏览器不受服务器调用影响，details 核对 no-store。pnpm test 96 个文件 1586 条通过；typecheck 通过；check:docs、check:catalog、check:secrets 等通过；check-architecture 与 check-doc-sync 按 --base 2101fe40 通过（75 个变更文件，124 个关联节点）。
- 下一步：派第二轮审查核对 944bd2f4，通过后开 MR

## 12:45:39 +08:00 · 提交 · #270 · 944bd2f4 按第一轮审查修封禁遗漏、同步互斥与限流

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：提交 944bd2f4（21 个文件）：lib/gitlab-sync.ts、lib/oidc-store.ts、routes/oidc/index.ts、middleware/http-policy.ts、services.ts，测试两份，文档 oidc.md、SECURITY（中英）、API、endpoint-contracts、data-model、项目目录生成物与 docs/changes/270.json。文档核对：endpoint-contracts 原来写 GET 与 POST /oidc/* 各自计数，其实两者共用一个路由的计数，这次一并改成服务器调用与浏览器跳转两类。
- 结果：见上一条审查记录的验证结果
- 下一步：第二轮审查

## 13:08:40 +08:00 · 审查 · #270 · 第二轮独立审查：有条件通过，三条应修在 e414b92c 修完

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：独立审查 agent 只读审 git diff 5cd82f7a 944bd2f4：第一轮 11 条里 9 条已解决，第 1、2 条部分解决。新应修三条：944bd2f4 把「找过、GitLab 上没有这个人」记成 blocked 后不再找，这个人回来登录一次（GitLab 自动建号）、下一轮前又离开就漏封（探针 P2、P3 的 GitLab 状态是 active）；按账号排队后仍用这一轮开头的名单，一轮中途管理员封禁的人会被按旧名单解封（P6 afterRound=active）；ENVIRONMENTS.md 与 docs/changes/270.json 的开启顺序仍是先开 GitLab 统一登录再开同步。建议三条：client id 不是 gitlab 时同步静默不做事、noreply 邮箱用了 GITLAB_URL 的主机、server_error 日志缺错误代码。e414b92c 全部处理：每轮按身份找（find_and_block），没找到不写表不记审计；syncNow 重读账号；客户端没登记时整轮跳过并记错误日志、控制台多 client_registered；noreply 用 sector；日志带 code；两处开启顺序改成先开同步并写明 client id 是 gitlab。
- 结果：审查者的探针在 e414b92c 上复跑：P2、P3、P6 原来断言缺陷，现在都断言失败，输出的 GitLab 状态都是 blocked（P6 afterRound=blocked）；P1、P4、P5、P7 照常。新增回归测试 2 条（离开的人两轮之间回来登录又离开、按当下的账号判断）。pnpm test 96 个文件 1588 条通过，gitlab-sync 与 oidc 两个文件连跑 5 次每次 38 条通过；typecheck、build、forum:check（548 条）、forum:generate 通过；check:* 通过，check-architecture 与 check-doc-sync 按 --base 2101fe40 通过。
- 下一步：开 MR，交 geek-main-56 复核与合并

## 13:08:41 +08:00 · 提交 · #270 · e414b92c 按第二轮审查补齐封禁与按当下账号判断

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：提交 e414b92c（18 个文件）：lib/gitlab-sync.ts、routes/console/gitlab.ts 与 contracts.ts、routes/oidc/index.ts，测试一份，文档 oidc.md、API、endpoint-contracts、data-model、ENVIRONMENTS、项目目录生成物与 docs/changes/270.json。
- 结果：见上一条审查记录
- 下一步：开 MR

## 13:10:17 +08:00 · PR · #270 · 开 MR !2：task/270/gitlab_sso → stage

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：在自建 GitLab 开 MR !2（https://git.yangtzeu.work/geek/admin/-/merge_requests/2），正文按 PULL-REQUESTS 十段写：Closes #270、宏观对齐引用 docs/changes/270.json、解决链路、验证命令与真实接口请求、6 张截图（官网桌面与手机改前改后、同意页两种宽度）、人工验收步骤、两轮审查结论、风险与回滚；标签 server、portal、admin、func:api、func:auth、func:data、func:external、infra:deploy、ui:content、ui:interaction。合并按约定由 geek-main-56 来做。
- 结果：本地 node scripts/pr-contract.mjs check 通过（10 个段落齐全，有验收证据）；MR 建好时的 head 是 655cac48，merge_status checking。
- 下一步：通知 geek-main-56 复核 e414b92c 并合并、发 rc

## 13:48:48 +08:00 · 审查 · #270 · MR !2 复核结论：有条件通过，三条与建议在 0239136d、d8a6c73c 处理

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：geek-main-56 用两个独立子 agent 按 code-review 技能分规范、需求两条线审 e414b92c，再自己核对（MR !2 评论 311）：本机合并 2101fe40 + 0ead9e66 后树一致，pnpm test 1588 条通过，审查人的探针 P2、P3、P6 断言失败、GitLab 状态 blocked。合并前三条：1 应修，gitlab-sync.ts:306 查不到账号时退回用这一轮开头的旧数据，可能给已合并的账号建号或解封；2 应修，「按这一刻的账号判断」用例里 alice、bob 同一毫秒建号顺序随机，修复前的代码 15 次有 5 次通过；3 需求缺口，issue 写了控制台成员页要能看到 GitLab 账号和同步状态并重试，MR 只有接口。建议四条：e414b92c 提交说明没写验证命令；find_and_block 失败时没有这一行、last_error 写不进去、GitLab 出故障时每人每轮一条审计；findAndBlock 重算 sector 与 sub；两条新日志没有测试。处理：0239136d 修 1、2 和审计、日志两条建议；d8a6c73c 按第 3 条在成员页加 GitLab 列与立即同步。重算 sector 与 sub 那条不改：是一次本地查询，动作对象是对外的接口形状，不为它加字段。提交说明那条按建议在 MR 里注明，不改写旧提交。
- 结果：1、2：新用例在修复前的代码上失败，修复后通过；用例 2 配修复前的代码连跑 15 次 0 次通过、配修复后 15 次全过。3：本地控制台样板 1440 宽打开、预演两种样子没有溢出，队长视角没有立即同步，390 宽整表横向滚动后 GitLab 列完整。pnpm test 97 个文件 1596 条通过；typecheck、build、forum:check、forum:generate、check:* 通过，check-architecture 与 check-doc-sync 按 --base 2101fe40 通过。
- 下一步：推送，更新 MR 正文，把新分支头告诉 geek-main-56

## 13:48:48 +08:00 · 提交 · #270 · 0239136d、d8a6c73c 按 MR !2 复核修服务端两处并加成员页 GitLab 列

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：提交 0239136d（服务端，10 个文件）：lib/gitlab-sync.ts、两份测试、oidc.md 与项目目录生成物。提交 d8a6c73c（控制台，14 个文件）：pages/People.vue、lib/gitlab.ts、lib/types.ts、mock/console.ts、tests/console/gitlab.test.ts、控制台 README、oidc.md、ownership.json 与生成物、docs/changes/270.json。两个提交各自生成项目目录，单独检出时 check:catalog 一致。
- 结果：见上一条审查记录
- 下一步：推送并更新 MR

## 13:56:44 +08:00 · 提交 · #270 · 01fd42dd 预发布 GITLAB_SYNC 改成 on，GitLab 正式站上线前接预发布

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：geek-main-56 转来所有者 13:36 的选择「现在先接预发布（推荐）」（方案 A），并按所有者 12:35 的原话「必须统一接入我们的极客班登录才能访问仓库」定下四个仓库和 geek 组改 private、已有本地 GitLab 账号绑到对应极客班账号。提交 01fd42dd（12 个文件）：deploy/env/.env.preview 的 GITLAB_SYNC 从 dry-run 改成 on；oidc.md、ENVIRONMENTS、DEPLOY 写明正式站上线前接预发布、预发布数据库不能清空重建、上线后先把 GitLab 的 sub 迁到正式库再改 issuer；deployment-environment 的用例改成预发布模板是 on、没有令牌拒绝渲染；docs/changes/270.json 与项目目录。文档核对：SECURITY.md 不用改——残余风险写的是同步不是 on 时没人封禁、令牌外泄等于交出 GitLab，接哪个环境不影响这两条。
- 结果：pnpm test 97 个文件 1596 条通过；typecheck 通过；check:environments、check:docs、check:catalog、check:secrets、check:notes 通过；check-architecture 与 check-doc-sync 按 --base 2101fe40 通过。
- 下一步：推送；在 GitLab 上建同步用的管理员机器人与令牌

## 14:05:24 +08:00 · 推送 · #270 · 推 task/270/gitlab_sso 到 af4d05e3

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：推到自建 GitLab：0ead9e66..af4d05e3（0239136d、d8a6c73c、4c4c2de7、01fd42dd、af4d05e3）。
- 结果：pre-push 的分支与发布 tag 规则、task worktree 生命周期都通过。
- 下一步：改 MR 正文

## 14:05:24 +08:00 · PR · #270 · 改 MR !2 正文：第三轮复核、成员页截图、预发布改 on

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：MR !2 正文：变更范围加成员页 GitLab 列与预发布 on；验证命令与结果按 af4d05e3 重写（1596 条、三份连跑 5 次、修复前后对照、e414b92c 提交说明没写验证命令的说明）；验收证据加 5 张成员页截图（上传到项目，地址 /-/project/1/uploads/…，逐个 curl 200）；人工验收步骤改成预发布 on 之后看成员页与 GitLab 登录；审查结论加第三轮；风险写明接预发布与 sub 迁移。
- 结果：本地 node scripts/pr-contract.mjs check 通过（10 个段落齐全，有验收证据）；MR 的 sha 是 af4d05e3。
- 下一步：在 #270 记所有者的决定，建同步令牌

## 14:05:24 +08:00 · 方案 · #270 · 所有者选定 GitLab 先接预发布；建同步用的管理员机器人与令牌

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：在 #270 发追踪记录（评论 327，kind=plan）：所有者 13:36 的选择与选项说明原文、按 12:35 原话定下的仓库改 private 与绑定本地账号、分工。用凭据库里的 root 令牌只读查 GitLab：用户只有 root 和项目机器人两个，没有别的本地账号；admin_mode 关、令牌必须带有效期、社区版有 disable_password_authentication_for_users_with_sso_identities（现在 false）。建管理员用户 geek-sync（id 3，随机密码、不能建组、项目上限 0），给它建 api 令牌（到 2027-10-22），用 crosery-ct cred reveal --save 直接存进凭据库 GITLAB_SYNC_API_TOKEN，明文没有进对话和日志。从 GitLab 容器访问 prev.yangtzeu.work 的发现地址与 /signin 都是 200，网络通。
- 结果：用 GITLAB_SYNC_API_TOKEN 只读核对：personal_access_tokens/self 是 api、到 2027-10-22、有效，用户 geek-sync 是管理员；按身份查用户 200；读 geek 组成员 200。root 不绑 SSO：它是应急密码登录的账号，开了已绑定 SSO 禁用密码之后会失去应急入口。
- 下一步：把令牌名和新分支头告诉 geek-main-56；rc.13 部署、客户端登记后改 GitLab 的 omniauth
