# ADR-0005：统一登录先在核心服务里建内部身份，对外授权接在它之上

> 多个渠道（现在只有 GitHub，之后有微信等）登录后落到同一个内部 OpenID，会话、权限和审计都以它为主语；先在 `app/server` 里建身份表、改会话、改三端的登录界面，不引入成品 IdP 或认证库；对外授权（OIDC）等第一个下游应用出现时接在内部身份之上，内嵌在 `app/server`，不另起授权服务器。GitHub 组织门槛不动。

状态：`proposed` · 更新：2026-10-18 · 依据：#237 正文「确认依据」里 2026-10-16 00:22 的会话原话，以及 2026-10-18 的两条补充（见「背景」）；本方案由 #237 追踪，在 #237 或本 PR 的评论里留下确认记录后，本行改为 `accepted`。

## 背景

2026-10-18 的会话原话：

- 02:58：「登录本质是多个授权登录，然后最后统一一个sso登录的openid，我们这个可以用于后面其他的授权登录」
- 03:01：「关于登录和注册啥的这些都是要跟后端，数据库，以及对应的前端ui相关联系的」

所以本方案同时回答三件事：数据库里身份怎么存，后端怎么签发会话、以后怎么对外授权，三端界面怎么改。

**现在的事实**（来自 2026-10-18 的 `origin/stage`，不是规划）：

- 全站只有一个登录：核心服务的 GitHub OAuth 回调（`app/server/src/routes/admin/auth.ts:44-79`）换到 token 后，用这个 token 查登录者自己的 `GET /user/memberships/orgs/{CONSOLE_ORG}`（`app/server/src/lib/github.ts:38-47`），只有 `active` 成员才签发 `sid`；`pending` 与非成员不建会话、审计 `auth.signin_denied`，并尽力撤销这次授权。
- 会话是 SQLite 里的 `sessions` 一行（`app/server/src/lib/db.ts:23-31`）：`id`、`login`、`user_id`（GitHub 数字 id）、`avatar_url`、`access_token_encrypted`（`NOT NULL`）、`created_at`、`expires_at`，没有外键，索引只有 `login` 上的 `idx_sessions_login`，`user_id` 上没有。GitHub token 用 AES-256-GCM 加密（`app/server/src/lib/crypto.ts:12-27`），有效期 7 天（`app/server/src/lib/auth.ts` 的 `SESSION_TTL_MS`）。每次登录都签发一个新的随机 `sid`，不处理请求里已有的旧 `sid`，也没有续期。
- 官网、论坛、控制台同域，共用这个 host-only `sid`（[ADR-0004](0004-forum-backend-in-core-server.md)、[ARCHITECTURE](../architecture/ARCHITECTURE.md)）；host-only 来自部署配置（两个环境的 `COOKIE_DOMAIN` 都留空），不是代码写死的。论坛没有自己的登录。
- 会话里的 GitHub token 不只是身份，还是管理操作的上游凭据。直接读 `session.accessToken` 的有 14 个文件、36 处（`git grep -n 'session[!?]*\.accessToken' app/server/src`；`routes/admin/repos.ts` 占 17 处，另有 `middleware/require-capability.ts:15`、`middleware/require-org-role.ts:18`、`routes/admin/invite-links.ts:48`，邀请链接用发起人的 token）；`routes/admin/auth.ts:103` 与 `middleware/require-auth.ts:34` 经局部变量 `s.accessToken` 传递，不在这 36 处里。访问判定 `lib/access.ts:24` 每次都用这个 token 向 GitHub 查组织角色（缓存 60 秒），没有按渠道分支。控制台的 `github.*` 能力 = 称号给的能力 ∩ 这个 token 在组织里的角色上限（[SECURITY](../architecture/SECURITY.md)）。
- 业务数据以 GitHub 账号为主语：`role_assignments` 存 `github_login` 与 `github_user_id`（`lib/role-store.ts:184`）、论坛的 `forum_users`（`app/server/src/lib/db.ts:199-218`，id 形如 `m<github_user_id>`）、审计的 actor 是登录名。库里没有通用的 `users` / `identities` / `identity_audit`；没有迁移框架，建表一律 `CREATE TABLE IF NOT EXISTS` + 启动幂等回填 + `console_seeds` 标记（`docs/services/server/data-model.md`）。
- 前端：官网、控制台、论坛各有一套登录入口，网址都写死 `/auth/github?return_to=…`，失败文案都专指 GitHub。官网在 `app/web/sites/portal/lib/account.ts:14`（登录地址）、`:29`（读 `/auth/me`）、`:44`（退出）；控制台在 `app/console/src/lib/runtime.ts:42`、`lib/signin.ts:22-32`（「这个 GitHub 账号不在极客班的 GitHub 组织里」）、`pages/ConsoleRoot.vue:26`；论坛在 `app/forum/app/composables/useSiteLinks.ts:14`、`useSiteAccount.ts`、`components/LoginModal.vue`、`shared/signin-outcomes.ts:9-14`。`/auth/me`（`routes/admin/auth.ts:98`）返回 `signed_in`、`login`、`user_id`、`avatar_url`、`console_link`，三端按这几个字段显示头像菜单。
- 「注册」：没有自助注册。想加入的人在官网「加入我们」投递（`routes/portal/apply.ts`），通过后被邀请进 GitHub 组织（`routes/portal/join.ts`、`routes/admin/invite-links.ts`），接受邀请后第一次用 GitHub 登录才有会话。控制台登录失败的 `not_member` 引到 `/join-us`（`app/console/src/lib/signin.ts:29`）。
- 部署是一台 2 核 2 GB 的目标机、同机两套完整 Docker 栈（`/opt/yzgc/production`、`/opt/yzgc/preview`，[DEPLOY](../ops/DEPLOY.md)、[ENVIRONMENTS](../ops/ENVIRONMENTS.md)），单实例 SQLite + 命名卷，没有多实例协调（`docs/services/server/README.md`「已知限制」）。

**谁在等**：#229（内部 OpenID 底座）与 #228（绑定/解绑/合并接口）都以 `not planned` 关闭，等本方案决定是否沿用。后续内部服务都用同一个极客班账号登录，是 2026-10-05 的调研稿（本地，未入库）和 2026-10-18 的会话反复提出的目标，现在还没有哪个下游应用已经开工。#203（CLI 设备授权）同样以 `not planned` 关闭，不算需求方。

**要回答的问题**：#237 正文列的五个——谁要 SSO、选型怎么选、身份模型是否采用 `users`/`identities`、现有会话与论坛账号怎么迁、拆出哪些实现 issue；加上 2026-10-18 补充的一条：三层（数据库、后端、前端）各改什么。

## 决策

1. 内部身份先行，在 `app/server` 里做，阶段 1、2 不新增容器、数据库和进程。不引入成品 IdP（Casdoor），也不引入认证库（Auth.js、better-auth），理由见「考虑过的方案」。
2. 身份模型采用内部 OpenID 底座（#229 的方案）：`users`（内部 OpenID 为主键，绝不用自增或渠道 id）、`identities`（一个用户挂 N 条第三方凭据，`provider_uid` 用不可变的 GitHub 数字 id，`UNIQUE(provider, provider_uid)`）、`identity_audit`（`link` / `unlink` / `login` / `merge` 留痕）。`sessions` 加可空影子列 `openid` / `provider` 并双写，读写路径先继续以旧列为准。DDL 沿用 #229，按审查结果改六处：
   - `users.id` 用 128 位纯随机，不含时间戳（#229 用的 ULID 前 10 个字符是毫秒时间，对外发出去会泄露首次登录时间）。ULID 只留给 `identities.id`、`identity_audit.id` 这类不外发的内部 id。
   - `users` 加 `CHECK`：`status='merged'` 时 `merged_into` 非空；`merged_into` 加外键。
   - `canonical_email` 加 `WHERE canonical_email IS NOT NULL` 的唯一索引（统一小写），让「邮箱全库唯一才能自动合并」落到库里。
   - `provider_union_id` 的唯一索引改成普通索引：同一个人在微信的网站应用和小程序下是两个 `openid`、同一个 `unionid`，两行 `identities` 会撞上原来的唯一约束。`provider` 带应用标识（`wechat:<appid>`）或另加 `provider_app` 列并入唯一约束。
   - 登录命中已有身份后要检查 `users.status`：`disabled` 拒绝并写审计，`merged` 沿 `merged_into` 走到终点（限制链长、检测环）。
   - 登录事务、部分升级回滚、ULID 时间上限这三处按 Kaiserunix/geek-admin 的补丁 `463d95e` 改（#229 原版里 `createSession` 失败时旧 `sid` 已销毁、`users` 行已提交）。
3. 对外主体标识要稳定。`users.id` 是内部主键，永不改、永不复用、永不删，合并或停用的 id 也保留。将来对外授权用的 `sub` 另外派生，默认按下游应用各算一个（`HMAC(服务端密钥, 应用标识 ‖ users.id)`），内部 id 不下发给下游。`rollback-identity.mjs` 只在地基阶段可用：`identities` 里出现非 GitHub 渠道、或有下游持有 `sub` 之后，不再回滚，只向前修复。
4. 准入门槛不动：只有 `CONSOLE_ORG` 的 `active` 成员能建内部身份、能拿到会话，非组织成员不建身份（#226 的决定记录，2026-10-14）。顺序是先过组织门槛，再落内部身份、建会话；不是成员的人既没有会话也不留身份。
5. GitHub 是唯一能建身份的渠道。微信（已定的第二渠道）的 OAuth 只给 `openid` / `unionid` / 昵称 / 头像，不给邮箱、不带组织身份，所以只能命中已绑定过微信的既有内部身份，否则拒绝并提示先用 GitHub 登录再绑定。QQ 不做：需要主体资质，服务器在境外且站点无国内备案（#237 正文）。
6. 非 GitHub 渠道的会话要有明确语义，现在的代码里没有：
   - `sessions.provider` 必填；`login` 取内部身份对应的 GitHub 登录名，不取第三方昵称（否则可能撞上别人的 GitHub 登录名，拿到别人的指派和缓存的组织角色）。
   - `access_token_encrypted` 改为可空，不用空串占位；`lib/access.ts`、`middleware/require-org-role.ts`、`/auth/me` 按 `provider` 分支，非 GitHub 会话不调用 GitHub，`github.*` 能力为空。
   - 微信登录没有 GitHub token，拿不到「是否仍是组织成员」。`users` 记录 `org_state` 与 `org_checked_at`，GitHub 登录时更新；非 GitHub 会话的有效期不超过这个快照的有效期，过期要求重新用 GitHub 登录。快照时长在实现 issue 里定。
   - 控制台的 `github.*` 继续依赖用户自己的 GitHub token，不改成组织级 Bot / GitHub App 凭据：那会改变「控制台不能授予任何 GitHub 权力」这条既有安全口径（[SECURITY](../architecture/SECURITY.md)），是另一件事，需要单独授权。
7. 三端界面不再各写一份 GitHub 入口。后端提供可用渠道列表和登录地址（`GET /auth/providers`），官网、控制台、论坛按它渲染登录入口；失败文案按渠道写，不专指 GitHub；`/auth/me` 只加字段（`provider`），已有字段不改，没改的前端照常能用。账号页（列出渠道、绑定、解绑）放在哪一端，在拆分清单第 3 项的方案里定；控制台和论坛用 Tuffex，官网桌面沿用现有的 DOM 界面做法。注册流程（投递、邀请、第一次登录）不变，第一次登录时自动建 `users` 与 `identities`，没有单独的注册页。
8. 对外授权（OIDC）推迟，不否决。它建在内部身份之上，内嵌在 `app/server`（`node-oidc-provider` 官方文档有挂进 Fastify 的写法），`sid` 不换，授权码与令牌放单独的表。现在不加依赖，立项条件见「对外授权的立项条件与重新评估」。
9. 本次不接第二 provider、不做绑定/解绑/合并接口、不改现有登录准入、不动 #229 的分支，也不写任何 `app/` 代码（#237 正文的「不做什么」）。它们进「拆分清单」，等本方案被确认后逐个建 issue。

## 考虑过的方案

按本项目的真实约束对比（2 核 2 GB 且同机两套栈；单实例 SQLite、无迁移框架、三端同源）：

| 维度 | A. 内嵌 OIDC 授权服务（node-oidc-provider） | B. 成品 IdP（Casdoor） | C. 扩展现有后端，先立内部身份（采用） | D. 认证库（Auth.js、better-auth） |
|---|---|---|---|---|
| 新增组件 | 不需要新容器；在 `app/server` 的 Fastify 里挂 authorize / token / userinfo / jwks，要加 `oidc-provider` 与 `@fastify/middie` 两个生产依赖，另做客户端注册、同意页、签名密钥轮换 | 新容器 + 自己的数据库 + 管理界面 | 无 | 新依赖，自带 user / session / account 表和 cookie |
| 2C2G 上的代价 | 进程内的库，不另占容器；Node 22 上能否跑通、内存增加多少没有实测。`app/server` 镜像是 `node:22`，与 forum 的 Node ≥26 构建无关 | 多一个数据库和常驻进程，两套栈各一份 | 低 | 低 |
| 攻击面 | 新增授权端点，需要单独安全评审 | 默认配置与升级节奏在上游，密钥与回调在第三方界面里 | 复用已验证的签名 state、`return_to` 白名单、Origin 校验、会话模型 | 换掉会话层，等于把登录与会话重新评审一遍 |
| 与现有 `sid` 的关系 | `sid` 不换：授权码与令牌放单独的表，登录页读 `sid` 判断是否已登录；库自带的 `_interaction`、`_session` cookie 要和 `sid` 一起设计 | 多维护一份用户目录 | 直接演进 `sessions` | 要把 `sessions` 与 `sid` 换成库的会话；14 个文件、36 处读 `session.accessToken` 的代码都受影响。Auth.js 的 JWT 策略不落库，与「服务端可撤销、GitHub token 加密存库」冲突 |
| 能否支撑「多渠道 → 统一 openid → 以后对外授权」 | 只负责对外那一半，需要先有稳定的 `users.id` 当 `sub` | 能，但用户目录在别处 | 负责前一半：身份、会话、审计 | Auth.js 是登录客户端，不是授权服务器，不能给别的应用发授权；better-auth 的 oidcProvider 插件在 1.7 rc 被移除，改由 `@better-auth/oauth-provider` 取代，接口仍在变 |
| 维护状态 | 活跃（OpenID 认证过的 Node 实现） | 活跃 | 自己维护 | Auth.js 自 2025-09-22 由 Better Auth 团队接手，只做安全与紧急修复，官方建议新项目用 Better Auth；官方适配只有 Next、Express、SvelteKit 等，没有 Fastify |
| 结论 | 推迟，接在 C 之上 | 不采用 | 采用，先做 | 不采用 |

A 和 C 不是二选一，是先后：A 需要稳定的 `users.id` 当 `sub`，C 先把它立起来。原稿否决 A 的几条理由——要新进程、要把 `sid` 换成 OIDC 会话、与 forum 的 Node ≥26 构建共存——核对后都不成立（见上表），保留的理由只有一条：现在没有下游应用已经开工，提前接 A 只会先付出安全评审和维护成本。2026-10-05 与 2026-10-18 的目标是后续内部服务都用同一个账号，所以这是推迟，不是否决。

不用 D 的原因：要解决的核心是数据模型（`users` 随机 id + `identities` 唯一约束 + 审计），库帮不上；而会话表、`sid`、组织门槛、签名 state、撤销授权这些定制逻辑，换库等于重写。将来新增渠道觉得协议代码重复时，再单独评估 `arctic`、`openid-client` 这类只做上游客户端的库（新增生产依赖需要批准）。

身份模型的取舍：另有一种做法是「不动 `sessions`，直接再加一张渠道表」。被否：渠道表与 `sessions.login` 之间没有稳定主键可挂（`login` 可改、`user_id` 有的旧会话为空），迟早要补一次内部主键；#229 的「先双写影子列、不读」把这次切换拆成可回滚的两步。

## 三层各改什么

| 层 | 现在 | 要改的（拆分清单项号） |
|---|---|---|
| 数据库 | `sessions` 以 GitHub 账号为主语；`role_assignments`、`forum_users`、审计也是 | 建 `users` / `identities` / `identity_audit`，`sessions` 加 `openid` / `provider`（1）；业务表加 `users.id` 引用，回填后再切读（2）；`org_state` / `org_checked_at`（2） |
| 后端 | `routes/admin/auth.ts` 只有 GitHub 一条路；访问判定一律带 GitHub token | 登录事务里落身份（1）；会话读 `openid`，访问判定按 `provider` 分支（2）；`GET /auth/providers`、绑定/解绑/合并接口、微信回调（3）；授权端点（4） |
| 官网 | `lib/account.ts` 写死 `/auth/github` | 登录入口按渠道列表渲染，账号页（3） |
| 控制台 | `runtime.ts`、`signin.ts`、`ConsoleRoot.vue` 写死 GitHub 与专指 GitHub 的文案 | 同上，登录页与失败文案按渠道；授权客户端管理页（4） |
| 论坛 | `useSiteLinks.ts`、`LoginModal.vue`、`signin-outcomes.ts` 同样写死 | 同上 |

## 后果

- 好处：不增加常驻组件与数据库，2C2G 上的余量留给现有三端；身份切换分步、地基阶段可回滚；`users`/`identities` 落地后，微信、将来的 Hub、对外授权都挂得上，不必再改一次身份模型。
- 代价：核心服务继续承担认证职责，`app/server` 的职责面不再收窄；`sessions` 会带着两个只写不读的影子列跑一段时间（阶段 1 的正常中间态，不是遗漏）；三端的登录界面要各改一遍。
- 明确不做、也不因为本决策而改变：非 GitHub 登录在控制台里拿不到 `github.*`（36 处用户 token 调用点）；不做 QQ；不做非组织成员注册；不引入迁移框架（沿用 `CREATE TABLE IF NOT EXISTS` + 幂等回填 + 独立回滚脚本）。
- 风险：改动触及核心登录与会话，阶段 1 没有用户可见收益，#229 正因此被暂缓。所以阶段 1 的验收必须是「行为零变化 + 影子列与身份表正确」的机器证明，不能放宽既有登录测试；阶段 2 起三端界面才有可见变化。

## 实施状态

未实施。本 ADR 只产出方案：没有改任何 `app/` 代码，没有建表，没有接第二 provider，没有动 #229 的分支与 PR。`sessions.openid` / `provider` 两个影子列、`users` / `identities` / `identity_audit` 三张表在当前 `stage` 上都不存在。

拆分清单（#237 验收条件 3：每项要有痛点、方案、最终效果，由逐个确认后才建 issue；同一个目标的相关步骤放进同一项，不按步骤拆开）：

| 序 | 事项 | 依赖 | 内容概要 |
|---|---|---|---|
| 1 | 内部身份地基（数据库 + 后端，行为零变化） | 无 | 痛点：`sessions` 直接以 GitHub 账号为主语，没有内部身份，渠道加不进来。方案：建三张表，DDL 按决策 2 的六处修改；`sessions` 双写影子列；登录事务；启动幂等回填；独立回滚脚本；登录成功后轮换 `sid`（现在不会使旧 `sid` 失效，这是新行为，单独写进文档和验收）。最终效果：库里每个登录者都有一个内部 OpenID，影子列与新表一致，三端界面和 `/auth/me` 的返回逐字不变（即 #229 加 `463d95e` 的内容，按本 ADR 重新提交）。 |
| 2 | 以内部身份为主语（数据库 + 后端 + 三端回归） | 1 | 痛点：影子列只写不读，改渠道要先登录；业务表仍以 GitHub 登录名为主语。方案：会话读 `openid`；`role_assignments`、`forum_users`、审计加 `users.id` 引用，回填后再切读；`sessions.provider` 与非 GitHub 会话的语义（决策 6）；`/auth/me` 加 `provider` 字段；三端回归确认不依赖新增字段。最终效果：会话主语是内部 OpenID，换渠道不影响会话、称号和论坛账号。 |
| 3 | 多渠道登录与绑定（数据库 + 后端 + 三端界面） | 1、2；**微信开放平台备案与主体资质**，未满足前本项不启动 | 痛点：成员只有 GitHub 一条进路，三端登录入口和失败文案写死 GitHub，也没有任何管理渠道的入口。方案：`GET /auth/providers`；`GET /api/identity/me`、`POST /api/identity/link|unlink|merge` 与 step-up 重认证（解绑前校验剩余可登录身份至少一个，`provider_uid` 已被他人绑定时回 409 引导合并，合并要两边验证，解绑与合并限流，全程写 `identity_audit`，即 #228 的内容）；微信上游只绑定登录，新建一律拒绝；三端登录入口按渠道渲染，失败文案按渠道；账号页。最终效果：成员能在账号页绑定微信并用微信登录，不会把自己锁在门外；未绑定的人得到明确提示。 |
| 4 | 对外授权（后端 + 控制台客户端管理页 + 同意页） | 1、2，且第一个下游应用已经提出 | 痛点：后续内部服务想用极客班账号登录，现在没有对外的授权入口。方案：内嵌 `node-oidc-provider`，`findAccount` 返回按应用派生的 `sub`；客户端由管理员登记，不开放动态注册，强制 PKCE，`redirect_uri` 精确匹配；授权码与令牌放单独的表；用户被移出组织或解绑身份时撤销对应授权；先做小验证（Node 22、内存增量、与 `sid` 和 Tuffex 登录页的接线）再定。最终效果：下游应用能用极客班账号登录，单点登出。**本项现在不建**。 |

## 对外授权的立项条件与重新评估

出现下面第 1 条时，建第 4 项的 issue（仍需逐个确认）；出现第 2 条及以后任一条时，回到本 ADR 重新评估选型（是否改选 B 或别的方案）：

1. 第一个下游应用（内部服务、独立子域或第三方）提出要用极客班账号登录；或者出现第二个 origin 或第二个后勤服务，host-only `sid` 不再够用。
2. 需要非 GitHub 身份建号：出现「没有 GitHub 账号也必须是成员」的真实场景（今天被 #226 的决定否掉）。
3. 控制台要脱离用户 GitHub token：36 处用户 token 调用点改走应用级凭据时（那是一次安全模型变更，会同时改变 `github.*` 的裁决口径）。
4. 单实例假设被打破：上多实例或迁 Postgres 时，会话与身份存储需要重新设计。
5. 第二个 provider 被要求独立完成认证（而不是只做上游绑定）——那意味着平台要自己签发身份。

已有下游持有 `sub` 之后，回滚脚本停止使用，改为只向前修复。

## 参考资料

- #237（本方案）：统一登录（SSO）规划：先定方案，再拆实现。
- PR #229（`task/226/openid_identity`，已关闭）：内部 OpenID 底座；本 ADR 采用它的三表 DDL、影子列双写与回滚脚本口径，并按决策 2 改六处。后续补丁：Kaiserunix/geek-admin 的 `463d95e`（登录事务、影子列读路径、部分升级回滚、ULID 时间上限）。
- #226（`not planned`）：身份底座；其决定记录「不允许非组织成员建内部身份」「第二渠道选微信，微信只能命中已绑定身份」是决策 4、5 的依据。
- #228（`not planned`）：绑定/解绑/合并与 step-up；进拆分清单第 3 项。
- #203（`not planned`）：CLI 设备授权，已取消，不作为需求方。
- Auth.js 并入 Better Auth 的公告（https://better-auth.com/blog/authjs-joins-better-auth，2025-09-22）。
- panva/node-oidc-provider 官方文档：Fastify 挂载、Adapter 接口、`findAccount`。
- [SECURITY](../architecture/SECURITY.md)「登录门槛」、[ADR-0004](0004-forum-backend-in-core-server.md)、[ARCHITECTURE](../architecture/ARCHITECTURE.md)「目标结构，尚未完整实现」。
