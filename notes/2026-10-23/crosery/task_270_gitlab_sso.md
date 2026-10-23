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
