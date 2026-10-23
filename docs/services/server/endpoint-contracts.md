# 业务接口契约与用例

> 按真实 handler、授权执行点与存储实现核对现有接口；关联目录中的业务用例，区分存量人工说明与已挂载的机器响应契约。

状态：`current` · 更新：2026-10-23

## 口径与共同边界

本文是人工维护的行为契约，不是完整 OpenAPI。`application.cancel` 保留既有取消投递不变量，公共授权依赖与其他审核分支通过同一 PATCH 的 `application.review` 及本节追溯，不另造第二套取消规则。请求字段的机器约束仍以对应 routes 下的 contracts.ts 与 handler 为准；下文响应是源码分支的形状，未把测试入口标成每个分支均已验证。业务操作按显式非 HEAD 的方法路径计数；自动 HEAD 派生于 GET，论坛显式 HEAD /api/forum/state 另为 405，不能计为第二个业务用例。补充 Nitro 入口按声明单列。

- 核心写请求先由 middleware/http-policy.ts 校验 Origin / Fetch Metadata，外域拒绝 403 invalid_origin；缺 Origin 不自动拒绝所有非浏览器调用。输入 Schema 失败为 400 validation_error。全局错误体通常为 error、message、request_id，handler 自行 reply.send 的错误形状保留原样。
- 会话型接口读取 sessions；getSession 遇过期行会删除，不能把 GET 一律标为没有任何写入。经 http-policy 处理的会话自身令牌 401 会删当前会话、清 cookie，并仅在实际删除时写 auth.session_rejected 审计；服务器 GitHub App 的令牌被拒为 503 github_connection_failed、不删会话，GitHub 没接上为 409 github_not_connected；其他上游 4xx 为同状态 upstream_rejected，5xx 为 internal_error。PR 合并代理与 OAuth 回跳的局部 catch 另见各用例。
- /api/admin/:org/* 按称号给的能力授权（requireGithub / requireManagedOrg），URL 中 org 必须是 CONSOLE_ORG（否则 403 org_not_managed），不看调用者的 GitHub 组织角色（#262 第四期）。上游由服务器接入的 GitHub 执行：配了 GitHub App 用安装令牌，没配用调用者自己的 GitHub 会话令牌（这时还受他自己的 GitHub 权限限制）。
- 控制台能力由 sessions、users（站内角色与成员资格）、role_assignments、departments、titles 计算，不调用 GitHub；只有还没记过站内角色的老账号补记一次 GitHub 组织角色（缓存 60 秒）；权限包每次读取。不是成员的账号没有任何能力。requireCapability 的多个参数是“任一满足”，并非全部同时拥有。缺能力 403 missing_capability；部门与对象范围仍在 handler 中继续校验。
- 流程 reads/writes 包含授权依赖与可能的条件写入，不能据数组推断每次请求都会写。forumViewer 对有效成员创建或刷新 forum_users，游客不写成员记录。外部 HTTP、文件读取、缓存和通知等副作用在各用例文字中明确，不能假装成 SQLite 外键。
- 测试路径只表示可复查入口。GitHub 代理多数尚无逐端点成功响应测试，已有 core/upstream-errors 只覆盖通用门禁和部分错误映射；Nitro 的纯函数/配置测试不等于启动服务器验证。

## 基础设施、退役路径与 HEAD 继承

当前隔离注册清单合计 **188 条方法路径**：103 个显式非 HEAD 业务操作（下文逐项说明）+ 24 个显式非 HEAD 退役项 + 4 个基础设施 GET + 56 个自动 HEAD + 1 个显式 HEAD。另有 5 个 Nitro/预渲染声明入口，独立列于文末，不混入 Fastify 注册数。

| 清单类别 | 方法路径 / 分组 | 实际行为及边界 | 源码与已有验证入口 |
|---|---|---|---|
| 基础设施（1） | `GET /healthz` | 200 `{ok:true,ts:Date.now()}`；handler 不查询数据库或外部依赖，因此不是全链路健康证明。 | [app.ts](../../../app/server/src/app.ts)，[catalog.test.ts](../../../tests/server/catalog.test.ts) |
| 基础设施（1） | `GET /` | 仅静态根目录不存在或明确 `staticRoot:false` 时注册占位响应：200 `{ok:true,note:"app/web/dist and app/console/dist not built yet"}`。目录工具关闭静态托管，故本次清单包含这一项。 | [app.ts](../../../app/server/src/app.ts)，[core.test.ts](../../../tests/server/core.test.ts) |
| 基础设施（2） | `GET /forum`、`GET /forum/*` | 直连核心服务时：production 为503 `{error:"forum_service_not_ready",message}`；开发为302到 `http://127.0.0.1:3456/`。正常 Docker 入口由 web 反代论坛，这两个 handler 不证明已配置反代。 | [app.ts](../../../app/server/src/app.ts)，[core.test.ts](../../../tests/server/core.test.ts) |
| 退役（24） | `/api/forum`、`/api/forum/*`、`/auth/forum/*`、`/forum/u/*` 各自的 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`OPTIONS` | 共用 retired handler，410 `{error:"legacy_forum_retired",message}`，不映射或写入旧论坛。先匹配现有具体论坛接口，再由通配路径接住剩余请求；共同写请求Origin校验可能先回403。 | [app.ts](../../../app/server/src/app.ts)，[core.test.ts](../../../tests/server/core.test.ts) |
| 自动 HEAD（54） | 清单中 `registration: automatic-head` 的所有项 | 按相同 path 找对应 `GET`，继承其状态码、响应头、鉴权、限流和 handler 行为，最终不发送body。不会因为没有body就跳过会话处理、上游查询、投递查看/导出审计等副作用。4个基础设施和4个退役GET的HEAD也包含在54内。 | [目录注册观测](../../../scripts/catalog/collect.ts)，[project-catalog.test.ts](../../../tests/tooling/project-catalog.test.ts)；各GET的行为验证见各用例 |
| 显式 HEAD（1） | `HEAD /api/forum/state` | 405、`Allow: GET`、空体；单独handler不计算整份state，不花GET的120次额度，不调用forumViewer刷新用户。 | [topics.ts](../../../app/server/src/routes/forum-api/topics.ts)，[forum.test.ts](../../../tests/server/forum.test.ts) |

自动 HEAD 规则只适用于清单实际注册的56项，不能对所有GET自行补造。例如论坛 state、search、topic posts 显式关闭自动HEAD；state另有上述405处理器，其他未单独注册的HEAD仍受实际路由匹配和退役通配项约束。HEAD是读取方法，不经过核心写请求Origin门禁，但对应GET的会话、能力及资源范围校验仍有效。

有静态产物的模式另经 `@fastify/static` 和 app.ts 的 not-found handler：API/auth/healthz未知路径、含扩展名的缺失资源及非GET/HEAD请求为404；其他GET/HEAD按路径回控制台或官网SPA，并设no-cache。该模式的静态文件枚举不属于这188条关闭静态托管的隔离基线，也不由此文档声称已部署。

## 发起 GitHub 登录

`GET /auth/github` · `flow:identity.authorize`

权限与资源：匿名可发起；return_to仅接受PUBLIC_ORIGIN，否则回控制台。

响应与错误：302跳到GitHub授权地址。

数据与副作用：生成随机state并写签名oauth_state cookie，不创建会话；本次响应不向GitHub发送token交换请求。

本地表读取：无。本地表写入：无。

源码：[app/server/src/routes/admin/auth.ts:40](../../../app/server/src/routes/admin/auth.ts#L40)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 列出本站启用的登录方式

`GET /auth/providers` · `flow:identity.providers`

权限与资源：匿名可读，不读会话、不需要能力。

响应与错误：200 {providers:[...]}，按GitHub、Google、邮箱的顺序，每项含id、name、kind、start、can_register，邮箱另有password；GitHub恒在（kind=redirect，start=/auth/github）；Google只在配了GOOGLE_CLIENT_ID与GOOGLE_CLIENT_SECRET时出现（kind=redirect，start=/auth/google）；邮箱只在配了发信商时出现（kind=email_code，start=/auth/email/start，password=/auth/email/password）。三种的can_register都是true：GitHub要是组织成员，邮箱和Google第一次登录要邀请码。响应Schema固定字段。

数据与副作用：只读进程内的配置，不读写数据库、不请求GitHub或Google。

本地表读取：无。本地表写入：无。

源码：[app/server/src/routes/identity/providers.ts:23](../../../app/server/src/routes/identity/providers.ts#L23)。验证入口：[tests/server/identity.test.ts](../../../tests/server/identity.test.ts)。

## 命令行申请设备授权码（RFC 8628）

`POST /auth/device/code` · `flow:identity.device.code`

权限与资源：匿名；只有登记过的公开客户端geek-cli能发码，scope只认openid、profile；每分钟10次。

响应与错误：200 {device_code,user_code,verification_uri,verification_uri_complete,expires_in=600,interval=5}，user_code显示为XXXX-XXXX，verification_uri是<PUBLIC_ORIGIN>/device，Cache-Control: no-store；未登记客户端400 invalid_client，未知scope400 invalid_scope。

数据与副作用：写一行pending的device_grants，device_code只存sha256；顺手删掉过期超过一天且令牌已失效的旧行；不读会话、不请求GitHub。表单（application/x-www-form-urlencoded）与JSON都收。

本地表读取：无。本地表写入：device_grants。

源码：[app/server/src/routes/identity/device.ts:33](../../../app/server/src/routes/identity/device.ts#L33)、[app/server/src/lib/device-store.ts](../../../app/server/src/lib/device-store.ts)（`createGrant`）。验证入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。

## 命令行轮询设备授权，批准后换一次性访问令牌

`POST /auth/device/token` · `flow:identity.device.token`

权限与资源：匿名，凭device_code与发码时相同的client_id；每分钟60次。

响应与错误：按RFC 8628 §3.5回400 authorization_pending、slow_down（轮询间隔加5秒写回）、access_denied（用户拒绝或账号不是active）、expired_token、invalid_grant（不存在或已换过令牌）、invalid_client、unsupported_grant_type；批准后200 {access_token,token_type:Bearer,expires_in=2592000,scope,account_id}，Cache-Control: no-store。

数据与副作用：判定顺序是invalid_grant（已换过令牌）、invalid_client、access_denied（已拒绝）、expired_token，pending再判slow_down并记last_poll_at，approved才发令牌；换令牌在一个BEGIN IMMEDIATE事务里，令牌只签发一次，库里只存sha256与到期时间，明文只在这条响应里。

本地表读取：device_grants、users、identities。本地表写入：device_grants。

源码：[app/server/src/routes/identity/device.ts:57](../../../app/server/src/routes/identity/device.ts#L57)、[app/server/src/lib/device-store.ts](../../../app/server/src/lib/device-store.ts)（`poll`）。验证入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。

## 确认页按 user_code 读一次设备授权

`GET /api/identity/device` · `flow:identity.device.view`

权限与资源：要极客班会话（requireAuth），不要控制台能力；每分钟30次，user_code空间有限，查询也限流。

响应与错误：200 {user_code,client_id,client_name,scope,status,expires_at}，status是pending、approved、denied、consumed或expired；user_code不合法或不存在404 device_code_not_found；没登录401。

数据与副作用：只读，不改状态、不续期；不返回device_code与令牌。user_code输入对大小写、连字符和空格不敏感。

本地表读取：device_grants。本地表写入：无。

源码：[app/server/src/routes/identity/device.ts:91](../../../app/server/src/routes/identity/device.ts#L91)、[app/server/src/lib/device-store.ts](../../../app/server/src/lib/device-store.ts)（`describe`）。验证入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)、[tests/console/device.test.ts](../../../tests/console/device.test.ts)。

## 登录的人允许或拒绝一次设备授权

`POST /api/identity/device/approve` · `flow:identity.device.approve`

权限与资源：要极客班会话；授权绑定到会话的account_id（极客班账号，不是GitHub id）；每分钟20次；跨站写入受共同Origin校验与SameSite=Lax会话Cookie限制。

响应与错误：200 {ok:true,status:approved|denied}；不存在404 device_code_not_found；不是pending或已过期409 device_code_not_pending；decision不合法400 invalid_decision；允许时账号还没有登录邮箱（这个环境能发信）403 email_required，拒绝不拦（#273）。

数据与副作用：条件UPDATE只改pending且未过期的行，并发的确认只有一次生效；拒绝不写account_id；写audit_logs的identity.device.approve或identity.device.deny，只含client_id与scope，不含device_code与令牌。

本地表读取：device_grants。本地表写入：device_grants、audit_logs。

源码：[app/server/src/routes/identity/device.ts:102](../../../app/server/src/routes/identity/device.ts#L102)、[app/server/src/lib/device-store.ts](../../../app/server/src/lib/device-store.ts)（`decide`）。验证入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。

## 命令行凭设备令牌读极客班账号（OpenID）

`GET /auth/device/userinfo` · `flow:identity.device.userinfo`

权限与资源：只认Authorization: Bearer <access_token>（geek login换到的gk_…令牌），不读cookie、不要会话；这个令牌只在这个接口有效，其它接口仍只认会话Cookie。

响应与错误：200 {sub,account_id,login,avatar_url,scope}，sub与account_id都是极客班账号；令牌缺失、不存在、过期或账号不是active时401 invalid_token，并带WWW-Authenticate: Bearer error="invalid_token"。

数据与副作用：只读；按令牌的sha256查行，联查users与GitHub身份的登录名、头像；不记录令牌明文。

本地表读取：device_grants、users、identities。本地表写入：无。

源码：[app/server/src/routes/identity/device.ts:125](../../../app/server/src/routes/identity/device.ts#L125)、[app/server/src/lib/device-store.ts](../../../app/server/src/lib/device-store.ts)（`authenticate`）。验证入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。

## 邮箱、Google 登录、账号页与注册邀请码（#262 第二、三期；资料/头像/邀请码兑换见 #274）

所有者 2026-10-23 定的规则：邮箱验证码和密码都能登录；用邮箱或 Google 第一次登录、还没有极客班账号时凭邀请码注册（默认邀请码只存在运维的钥匙串里，用 `dist/cli/account.js invite` 写进库）；GitHub 新用户第一次登录只对组织成员开放、不用邀请码。#262 第四期起权限只认极客班账号：不论用哪种方式登录，成员资格与提督、舰员称号都按账号记下的站内角色给；邮箱、Google 会话没有 GitHub 令牌，控制台的 GitHub 页面在没配 GitHub App 时回 409 `github_not_connected`，`GET /api/me/orgs` 回 403 `github_session_required`。以下接口都挂了响应 Schema；失败体保留 `attempts_left`、`retry_after`、`reauth`、`capability` 等扩展字段。

| 接口 · 流程 | 权限与资源 | 响应、错误与副作用 |
|---|---|---|
| `POST /auth/email/start` · `flow:identity.email.start` | 匿名；每分钟 10 次（按 IP）；同一邮箱 60 秒一封、每小时 5 封，同一 IP（IPv6 按 /64）每小时 20 封，计数存在 `email_challenges`，重启不清零 | 202 `{resend_after:60}`，写签名、HttpOnly 的 `email_challenge` cookie（path=/auth/email，10 分钟）；有没有账号响应都一样，没有账号的邮箱也真的发（填邀请码就能注册）。body 可带 `purpose:"reset"`（忘了密码，#273）：只把信换成「你的极客班重设密码验证码」，挑战还是登录用的那一种。邮箱格式不对 400 `bad_email`；太频繁 429 `rate_limited`，带 `Retry-After` 与 `retry_after`。只存验证码的 HMAC，这个浏览器上一次的码作废（别人替这个邮箱要码不影响本人手上的码）；信由 `mail.sendNow` 直接发，不进 `mail_outbox`，日志不记地址和验证码。 |
| `POST /auth/email/verify` · `flow:identity.email.verify` | 匿名，凭挑战 cookie；每分钟 30 次；同一个码最多错 5 次 | 200 `{return_to,registered}` 并写 `sid`；验证码不对 400 `invalid_code`（带 `attempts_left`），过期、用过或错满 5 次 400 `code_expired`；没有账号又没带 `invite_code` 400 `invite_required`（验证码不作废）；邀请码不对 400 `invalid_invite`，同时记一次错；账号停用 403 `account_disabled`，不是成员 403 `not_member`。建号、兑换邀请码、占用验证码、建会话（provider=email）、删旧会话、写 `identity_audit` 与 `auth.register`/`auth.signin` 在一个 `BEGIN IMMEDIATE` 事务里，任何一步不成整体回滚。 |
| `POST /auth/email/password` · `flow:identity.email.password` | 匿名；每分钟 10 次（按 IP），另按邮箱 15 分钟 10 次 | 200 `{return_to}` 并写 `sid`；没账号、没设密码、密码不对一律 400 `invalid_credentials`，没有账号时也跑一次 bcrypt，响应时间不泄露邮箱是否注册；按邮箱超次数 429 `rate_limited`；停用 403 `account_disabled`，不是成员 403 `not_member`。会话 provider=email。 |
| `POST /auth/email/reset` · `flow:identity.email.reset` | 匿名，凭 `/auth/email/start` 发的挑战 cookie；每分钟 10 次；同一个码最多错 5 次（#273，忘了密码） | body `{code,password}`；200 `{return_to}` 并写 `sid`（provider=email）。先看新密码：不到 8 位 400 `password_too_short`、超过 72 字节 400 `password_exceeds_bcrypt_limit`，这时不碰验证码；验证码不对 400 `invalid_code`（带 `attempts_left`），过期、用过或错满 400 `code_expired`；邮箱没有账号时和验证码登录一样 400 `invite_required`（不注册，验证码不作废，登录页转到「注册」）；停用 403 `account_disabled`，不是成员 403 `not_member`。占用验证码、建会话、删旧会话、写 `users.password_hash`、`identity_audit`（`login` 与 `password_reset`）、审计 `auth.signin`（method=reset）与 `account.password`（action=reset）在一个 `BEGIN IMMEDIATE` 事务里；成功后这个邮箱的密码错误计数清零。 |
| `GET /auth/google` · `flow:identity.google.start` | 匿名；每分钟 20 次（按 IP）；没配凭据时 404 `provider_not_enabled` | 302 到 Google 授权页（openid email profile，带 state、nonce 与 PKCE S256）；state、nonce、verifier、return_to 和 `invite` 存进签名 cookie `google_oauth_state`。 |
| `GET /auth/google/callback` · `flow:identity.google.callback` | 每分钟 10 次（按 IP）；state 与签名 cookie 相符；ID Token 用 Google JWKS 验签（RS256），核对 iss、aud、exp、nonce；按 Google `sub` 认人，不按邮箱合并账号 | 成功 302 回 `return_to`，账号还没有登录邮箱、这个环境又能发信时改为 302 到 `/bind-email?return_to=<原路径>`（#273，Google 给的邮箱不算登录邮箱）；取消、上游失败、没有账号又没带邀请码、邀请码无效、Google 邮箱已属于别的账号、停用或不是成员时 302 到 `/signin?signin=<cancelled|failed|invite_required|invalid_invite|email_taken|account_disabled|not_member>&provider=google&return_to=<原路径>`；缺参数或 state 无效 400。外部请求在事务外，建号与会话同上一个事务；日志不输出令牌。 |
| `GET /api/identity/me` · `flow:identity.account.view` | 任何有效会话，不要控制台能力 | 200 `{account_id,login,identities,has_password,password_updated_at,membership{state,org_role,via_invite},created_at,recent,available,email_required,session{provider,created_at,expires_at,step_up_until}}`；`email_required`（#273）是账号还没有邮箱登录方式、这个环境又能发信，绑定邮箱页 `/bind-email` 读它；邮箱只给打码后的样子，每个邮箱另带身份 `id`（删邮箱用）和 `primary`（主邮箱，排在别的邮箱前面，#272）；`recent` 是本人最近 20 条 `identity_audit`；`available` 只可能是 `["email"]` 或 `[]`：发信打开、还不到 5 个邮箱时是 `["email"]`，满了或发信关着时是 `[]`（GitHub、Google 的绑定没做，不列）。没登录 401。只读。 |
| `POST /api/identity/email/start` · `flow:identity.account.email.start` | 有效会话，这次登录不超过 10 分钟；每分钟 10 次，发码限额同登录 | 202 `{resend_after:60}`，挑战绑定这个账号与这次会话，cookie path=/api/identity/email；一个账号最多 5 个邮箱（#272），这个邮箱已经绑在本账号上 409 `identity_exists`、已经有 5 个 409 `email_limit`，都不发信；超过 10 分钟 403 `step_up_required`（带 `reauth.return_to:"/account"`）；400 `bad_email`；429 `rate_limited`。 |
| `POST /api/identity/email/verify` · `flow:identity.account.email.verify` | 同一会话 | 200 `{ok:true}`；换了账号或会话、过期 400 `code_expired`；码不对 400 `invalid_code`；邮箱已属于别的账号 409 `identity_conflict`；已经绑在本账号上 409 `identity_exists`；已经有 5 个 409 `email_limit`。占用验证码、插入邮箱身份、写 `identity_audit` 在一个事务里；账号还没有主邮箱时这个就是主邮箱（`canonical_email`）。 |
| `POST /api/identity/email/remove` · `flow:identity.account.email.remove` | 有效会话，这次登录不超过 10 分钟；每分钟 10 次 | 200 `{ok:true}`：body `{identity_id}`（`GET /api/identity/me` 给的邮箱 `id`），删掉这个邮箱，之后不能再用它登录，下一轮 GitLab 同步从 GitLab 上删掉（#272）；主邮箱 409 `primary_email`，不是本账号的邮箱 404 `not_found`；超过 10 分钟 403 `step_up_required`。删身份、写 `identity_audit`（`unlink`）与 `identity.unlink` 在一个事务里，用这个邮箱登录的会话不动。 |
| `POST /api/identity/password` · `flow:identity.account.password` | 有效会话，账号已绑邮箱；每分钟 10 次 | 200 `{ok:true}`；没绑邮箱 409 `email_required`；不到 8 位 400 `password_too_short`，超过 72 字节 400 `password_exceeds_bcrypt_limit`；已有密码且登录超过 10 分钟时要 `current_password`，不对 400 `invalid_credentials`，没填 403 `step_up_required`；没有密码又超过 10 分钟 403 `step_up_required`。bcrypt cost 12，写 `users.password_hash` 与 `identity_audit`（`password_set` 或 `password_change`）。 |
| `GET /api/console/invites` · `flow:identity.invites.list` | `accounts.invites.manage`（提督默认有）；只看身份与称号，不调用 GitHub | 200 `{invites:[{id,code,note,max_uses,used_count,expires_at,disabled,created_by,created_at,updated_at,usable}]}`；401、403 `missing_capability`。只读。 |
| `POST /api/console/invites` · `flow:identity.invites.create` | 同上；每分钟 30 次 | 201 邀请码一行；邀请码 4–40 位字母、数字、`_`、`-`，存小写，重复 409 `invite_code_taken`，其他不合格 400；写 `invite.create` 审计。 |
| `PATCH /api/console/invites/:id` · `flow:identity.invites.update` | 同上；每分钟 30 次 | 200 邀请码一行；只改 note、max_uses、expires_at、disabled，邀请码本身不能改、不能删；没有这一行 404 `not_found`；有改动才写 `invite.update` 审计（记改了哪些字段）。 |
| `GET /api/identity/profile` · `flow:identity.profile.view` | 有效会话；不要控制台能力 | 200 `{username,display_name,bio,avatar_url,prefs}`；账号第一次读时由 `account_profiles` 兜底建一行（用户名按账号 id 派生，小写），不是 500。没登录 401 `not_signed_in`。只读。 |
| `PATCH /api/identity/profile` · `flow:identity.profile.update` | 需要 `account.profile.edit`；每账号每小时 30 次 | body 任选 `{display_name(1–32),bio(0–200),username(3–24，`^[a-z0-9_]+$`，不分大小写唯一),prefs:{start_note_seen_at,forum_theme}}`，回同 GET 形状；`prefs` 是合并写，不是整份替换；`username` 已被别的账号占用（不分大小写）409 `username_taken`，改回自己原来的名字不算占用。写 `account_profiles` 与审计 `profile.update`。 |
| `GET /api/identity/avatar/:file` · `flow:identity.avatar.read` | 匿名；`:file` 必须是 `^[0-9a-f]{64}\.webp$` | 200 `image/webp` 二进制，`Cache-Control: public, max-age=31536000, immutable`、`Content-Security-Policy: default-src 'none'`；哈希不存在 404。只读 `account_avatars`。 |
| `PUT /api/identity/avatar` · `flow:identity.avatar.upload` | 需要 `account.profile.edit`；每账号每小时 10 次 | 请求体就是图片本身（png/jpeg/webp/gif，≤2MB，像素 ≤4096×4096），sharp 转正方形 512×512 webp 后按内容 sha256 寻址存 `account_avatars`，回 `{avatar_url}`；类型不支持 415，字节解不出图片 400 `invalid_image`，超过像素上限 400 `image_too_large`，超过 2MB 由内容类型解析器直接 413 `avatar_too_large`。写 `account_profiles.avatar_hash` 与审计 `profile.avatar`。 |
| `POST /api/identity/invite/redeem` · `flow:identity.invite.redeem` | 需要 `account.invite.redeem`；每账号每小时 10 次 | body `{code}`；成功 200 `{level:"member"}`，把账号换成 `level.member`（事务里先查重、兑换邀请码、换组、提交后再让权限引擎的 revision 失效）；码不对或已用完 400 `invite_invalid`；已经是成员 409 `already_member`。写 `perm_members`、`invite_codes` 与审计 `invite.redeem`。 |

本地表：邮箱登录读写 `email_challenges`、`users`、`identities`、`invite_codes`、`sessions`、`identity_audit`、`audit_logs`；账号页读 `users`、`identities`、`identity_audit`，删邮箱时删 `identities`，写 `email_challenges`、`identities`、`users`、`identity_audit`；邀请码页只读写 `invite_codes` 与 `audit_logs`；账号资料与头像（#274）读写 `account_profiles`、`account_avatars`，邀请码兑换另外读写 `perm_members`。

没有登录邮箱的账号（#273，所有者 2026-10-23 19:22：「之前只绑定了github账号没有绑定邮箱的再次进来或者登录的时候必须绑定邮箱」）：判定在 [lib/email-gate.ts](../../../app/server/src/lib/email-gate.ts)，只在这个环境能发信时要求。GitHub、Google 登录回调跳绑定邮箱页，对外授权的交互入口与同意页、设备授权的允许在服务端拦，`/auth/me`、`/api/identity/me`、`/api/console/me` 的 `email_required` 交给官网、论坛、控制台自己跳。

源码：[routes/identity/email.ts](../../../app/server/src/routes/identity/email.ts)、[routes/identity/google.ts](../../../app/server/src/routes/identity/google.ts)、[routes/identity/account.ts](../../../app/server/src/routes/identity/account.ts)、[routes/identity/profile.ts](../../../app/server/src/routes/identity/profile.ts)、[routes/console/invites.ts](../../../app/server/src/routes/console/invites.ts)、[lib/email-gate.ts](../../../app/server/src/lib/email-gate.ts)、[lib/email-login.ts](../../../app/server/src/lib/email-login.ts)、[lib/google.ts](../../../app/server/src/lib/google.ts)、[lib/invite-codes.ts](../../../app/server/src/lib/invite-codes.ts)、[lib/identity-store.ts](../../../app/server/src/lib/identity-store.ts)、[lib/account-profiles.ts](../../../app/server/src/lib/account-profiles.ts)、[lib/account-avatar.ts](../../../app/server/src/lib/account-avatar.ts)。验证入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)、[tests/console/signin.test.ts](../../../tests/console/signin.test.ts)、[tests/console/account.test.ts](../../../tests/console/account.test.ts)、[tests/server/profile.test.ts](../../../tests/server/profile.test.ts)。

## 对外授权（OIDC）与 GitLab 账号同步（#270）

不同源的应用（第一个是自建 GitLab）用极客班账号登录：核心服务内嵌的 OpenID Connect 签发者挂在 `/oidc/*`，签发者 `<PUBLIC_ORIGIN>/oidc`；没配 `OIDC_JWKS` 时下面 6 个 `/oidc` 操作照样注册，请求一律 404。协议细节、客户端登记和 GitLab 一侧的配置见 [对外授权与 GitLab 账号同步](oidc.md)。交互接口按核心写请求的 Origin 门禁处理；协议端点由下游服务器调用，不带 Origin。

| 接口 · 流程 | 权限与资源 | 响应、错误与副作用 |
|---|---|---|
| `GET /oidc/*` · `flow:identity.oidc.protocol` | 匿名或带 `sid`；按 IP 每分钟计数，发现文档、JWKS、userinfo 与 `POST /oidc/*` 合计 600 次，授权端点另计 120 次；授权端点只认登记过的 `client_id` 和完全一致的回调地址，PKCE 必须 `S256` | 原样交给 `oidc-provider`：发现文档、JWKS（只有公钥）、授权端点、userinfo。授权端点按本站 `sid` 判断是否登录：`sid` 账号与签发者会话一致且仍是成员时直接 303 回下游带 `code`，否则 303 到 `/oidc/interaction/<uid>`；未知客户端、错回调不跳转，回 400 的 HTML 错误页。读写 `oidc_payloads`，首次给某 sector 的账号写 `oauth_subjects`。 |
| `POST /oidc/*` · `flow:identity.oidc.token` | 下游服务器凭 `client_secret_basic` 或 `client_secret_post`；与发现文档、JWKS、userinfo 合计每个 IP 每分钟 600 次 | 换令牌 200 `{access_token,id_token,token_type,expires_in,scope}`（不发 refresh token）；客户端认证失败 401 `invalid_client`，授权码过期、用过或 PKCE 不对 400 `invalid_grant`；授权码重放时撤销这份授权和它发出的令牌。userinfo 对已停用或不再是成员的账号 401。另有 `POST /oidc/token/revocation`。读写 `oidc_payloads`，读 `oauth_clients`、`oauth_subjects`、`users`。 |
| `GET /oidc/interaction/:uid` · `flow:identity.oidc.interaction` | 浏览器；每分钟 30 次；交互按签名 cookie `oidc_interaction` 找，不认就回 400 HTML 错误页 `session_not_found` | 没 `sid` 303 到 `/signin?return_to=/oidc/interaction/<uid>`；账号不是成员时 303 回下游带 `error=access_denied`；账号还没有登录邮箱时 303 到 `/bind-email?return_to=/oidc/interaction/<uid>`（#273，绑好回到同一个交互；允许过这个应用、签发者会话还在时也先进交互，不直接发码）；要登录时按 `sid` 账号登录（换过账号先删掉签发者里旧账号的会话），要同意时 303 到 `/authorize?uid=<uid>`。写 `oidc_payloads`。 |
| `GET /oidc/interaction/:uid/details` · `flow:identity.oidc.details` | 有效会话，且就是发起这次登录的账号；每分钟 30 次 | 200 `{client:{id,name,host},scopes,account:{login,name,picture},expires_at}`；没会话 401，账号还没有登录邮箱 403 `email_required`（#273），交互过期或客户端已停用 404 `interaction_expired`，不是要同意的交互或换了账号 409 `interaction_mismatch`。只读。 |
| `POST /oidc/interaction/:uid/confirm` · `flow:identity.oidc.confirm` | 同上；每分钟 20 次 | 200 `{redirect_to}`（浏览器去这里，由签发者 303 回下游带 `code`）；错误同 details，含 403 `email_required`。保存授权（`oidc_payloads`），记进 `oauth_grants`，写审计 `oidc.consent`。 |
| `POST /oidc/interaction/:uid/abort` · `flow:identity.oidc.abort` | 同上；每分钟 20 次 | 200 `{redirect_to}`，下游收到 `error=access_denied`；错误同 details，但没有登录邮箱也能拒绝。把拒绝结果存进交互（`oidc_payloads`），写审计 `oidc.deny`。 |
| `GET /api/console/gitlab/accounts` · `flow:gitlab.accounts.list` | `roles.manage` 或 `roles.department.manage` | 200 `{mode,gitlab_url,group,client_registered,accounts:[…]}`（`client_registered`：`gitlab` 客户端登记了没有），每行是一个极客班账号的 GitLab 用户 id、用户名、状态、组权限、最后一次错误和还要做的事（`dry-run` 时就是会做什么）；`off` 时照样列出。只读。 |
| `POST /api/console/gitlab/accounts/:account_id/sync` · `flow:gitlab.accounts.sync` | `roles.manage`；每分钟 30 次 | 200 `{mode,…这个账号同步后的状态}`；同步关着 409 `gitlab_sync_off`，没有这个账号 404 `account_not_found`。`on` 时调用 GitLab 管理接口建号、改组权限、封禁或解封、传头像（下载 GitHub 头像，#271）、同步邮箱（#272），写 `gitlab_accounts` 与审计 `gitlab.sync`，账号还没有 GitLab sector 的 `sub` 时写 `oauth_subjects`；`dry-run` 不写表、不调 GitLab。 |

本地表：签发者读 `oauth_clients`，读写 `oauth_subjects`、`oauth_grants`、`oidc_payloads`，读 `users`、`identities`、`forum_users` 拼声明，同意与拒绝写 `audit_logs`；同步读 `users`、`identities`、`forum_users`、`forum_avatars`，读写 `oauth_subjects`、`gitlab_accounts`，写 `audit_logs`。各流程的完整读写见[项目目录](../../architecture/catalog/CATALOG.md#业务流程)。

源码：[routes/oidc/index.ts](../../../app/server/src/routes/oidc/index.ts)、[routes/console/gitlab.ts](../../../app/server/src/routes/console/gitlab.ts)、[lib/oidc-provider.ts](../../../app/server/src/lib/oidc-provider.ts)、[lib/oidc-store.ts](../../../app/server/src/lib/oidc-store.ts)、[lib/account-directory.ts](../../../app/server/src/lib/account-directory.ts)、[lib/gitlab-sync.ts](../../../app/server/src/lib/gitlab-sync.ts)。验证入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts)、[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts)、[tests/console/authorize.test.ts](../../../tests/console/authorize.test.ts)。

## 校验登录回调，在一个事务里建号或找到账号并建立统一会话

`GET /auth/callback` · `flow:identity.callback`

权限与资源：state与签名cookie必须相符且未过期；按GitHub数字id匹配身份，不用会变的登录名。这个GitHub id已有账号且站内记过角色的由站内决定（停用、不是成员拒绝），不查GitHub组织；新用户和还没记过站内角色的老账号要是CONSOLE_ORG active成员才成功：新用户记为成员（站内一位管理员都没有时owner记为管理员），老账号按查到的组织角色补记（users.org_role，owner记为管理员）（#262 第四期）。

响应与错误：成功302回return_to；账号还没有登录邮箱、这个环境又能发信时改为302到<PUBLIC_ORIGIN>/bind-email?return_to=<原来要回的本站路径>，绑好再回去（#273）；取消/上游失败/非成员/账号停用一律302到<PUBLIC_ORIGIN>/signin?signin=<cancelled|failed|not_member|invite_pending|account_disabled>&return_to=<原来要回的本站路径>，原路径里残留的signin参数会去掉（#262）；合并链超过8跳、成环或事务失败按failed；缺参数或无效state为400，旧forum-state为410。

数据与副作用：外部请求在事务外做完；建号、刷新身份、沿merged_into走到终点、按GitHub id认领称号与论坛用户、写sessions（含openid、provider）、删请求带来的旧会话、写identity_audit与auth.signin在一个BEGIN IMMEDIATE事务里，失败整体回滚、旧会话照常有效。非成员与停用账号不建会话、审计拒绝并尽力撤销授权；被组织拒绝的GitHub id已经有还没记过站内角色的老账号时，把它的成员资格记成not_member或pending（#262审查）；站内记过角色的账号不受GitHub组织变动影响；失败日志不输出token。

本地表读取：identities, users。本地表写入：sessions, audit_logs, users, identities, identity_audit, role_assignments, forum_users。

源码：[app/server/src/routes/admin/auth.ts:47](../../../app/server/src/routes/admin/auth.ts#L47)、[app/server/src/lib/identity-store.ts](../../../app/server/src/lib/identity-store.ts)（`signInWithGithub`）。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/identity.test.ts](../../../tests/server/identity.test.ts)。

## 退出当前会话

`POST /auth/signout` · `flow:identity.signout`

权限与资源：仅销毁cookie sid对应本站会话；允许没有会话的幂等退出，仍受共同写请求Origin校验。

响应与错误：200 {ok:true}；不向调用者泄露sid是否存在。

数据与副作用：清sid和旧forum_sid cookie；实际读取到会话才写auth.signout（带actor_account_id）和本人的identity_audit退出记录，不撤销GitHub授权。

本地表读取：sessions。本地表写入：sessions, audit_logs, identity_audit。

源码：[app/server/src/routes/admin/auth.ts:94](../../../app/server/src/routes/admin/auth.ts#L94)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/session-cleanup.test.ts](../../../tests/server/session-cleanup.test.ts)、[tests/server/identity.test.ts](../../../tests/server/identity.test.ts)。

## 读取统一登录状态与控制台入口

`GET /auth/me` · `flow:identity.current`

权限与资源：只返回当前sid的身份；console_link是显示提示，不赋予后端权限。

响应与错误：200 {signed_in:false}或身份字段（login、user_id、avatar_url、account_id、provider）及console_link、email_required（账号还没有登录邮箱、这个环境又能发信，官网、论坛、控制台读到true就跳绑定邮箱页，#273）；GitHub拒绝token时200 {signed_in:false,session_expired:true}，其他角色查询失败仍保持登录但入口false。

数据与副作用：会话联查账号，过期、没有账号（启动回填映射不到的旧会话）或账号不是active的会话按未登录处理并删除；按账号记下的站内角色和称号算权限（还没记过站内角色的老账号用GitHub会话第一次请求时查一次GitHub组织角色并记下），被拒token才删会话并写审计；无其他业务写入。

本地表读取：sessions, role_assignments, departments, titles, users。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/auth.ts:114](../../../app/server/src/routes/admin/auth.ts#L114)、[app/server/src/lib/auth.ts](../../../app/server/src/lib/auth.ts)（`getSession`）。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/identity.test.ts](../../../tests/server/identity.test.ts)、[tests/server/legacy-database.test.ts](../../../tests/server/legacy-database.test.ts)。

## 列出本人组织

`GET /api/me/orgs` · `flow:github.organizations.list`

权限与资源：仅有效会话，读取本人active组织并按ALLOWED_ORGS过滤。

响应与错误：200 {orgs,allowed_orgs}；仅active成员组织并按配置过滤。

数据与副作用：GET /user/memberships/orgs，按登录名缓存120秒。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/orgs.ts:10](../../../app/server/src/routes/admin/orgs.ts#L10)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 浏览组织活动

`GET /api/admin/:org/activity` · `flow:github.activity.read`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {events}，输出actor、repo、时间及摘要。

数据与副作用：请求GitHub组织最近100条事件，不写本地活动表。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/activity.ts:9](../../../app/server/src/routes/admin/activity.ts#L9)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 读取组织资料

`GET /api/admin/:org/org` · `flow:github.organization.read`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 GitHub组织响应对象。

数据与副作用：向GitHub读取URL组织资料。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/org.ts:21](../../../app/server/src/routes/admin/org.ts#L21)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看组织概览

`GET /api/admin/:org/overview` · `flow:github.overview.read`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {role,org,counts}；成员/邀请/仓库子查询失败各降为空数组，组织主查询失败仍抛错。

数据与副作用：聚合GitHub组织、成员、邀请、仓库与本地24小时邀请数和活跃链接数，不发出邀请。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：invitations, invite_links, sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/overview.ts:10](../../../app/server/src/routes/admin/overview.ts#L10)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看组织安全能力

`GET /api/admin/:org/security` · `flow:github.security.read`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {plan,two_factor_required,dependabot,secret_scanning,audit_log}；Dependabot失败落入嵌套error字段。

数据与副作用：读取GitHub组织计划，非free再查Dependabot；此接口是摘要，不配置安全策略或购买服务。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/security.ts:9](../../../app/server/src/routes/admin/security.ts#L9)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看组织成员角色

`GET /api/admin/:org/members` · `flow:github.members.list`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {members,viewer_role}；单个成员详情失败将role/state设为?，名单请求失败仍抛错。

数据与副作用：分页读取GitHub成员并补角色，不改变组织成员关系。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/members.ts:10](../../../app/server/src/routes/admin/members.ts#L10)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看团队及规模

`GET /api/admin/:org/teams` · `flow:github.teams.list`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {teams}，每项增加member_count/repo_count；计数子请求失败记0。

数据与副作用：分页读取团队及成员/仓库计数，不缓存成数据库实体。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/teams.ts:10](../../../app/server/src/routes/admin/teams.ts#L10)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 移除组织成员

`DELETE /api/admin/:org/members/:login` · `flow:github.members.remove`

权限与资源：有效会话且是极客班成员，站内称号带 github.members.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}；login等于本人时400，其他失败保留上游状态映射。

数据与副作用：向GitHub删除组织membership，成功写member.remove审计。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/members.ts:29](../../../app/server/src/routes/admin/members.ts#L29)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 调整组织成员角色

`PATCH /api/admin/:org/members/:login/role` · `flow:github.members.role`

权限与资源：有效会话且是极客班成员，站内称号带 github.members.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}；role不是admin/member为400。

数据与副作用：PUT GitHub membership角色，成功写member.role审计。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/members.ts:40](../../../app/server/src/routes/admin/members.ts#L40)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 修改组织资料与策略

`PATCH /api/admin/:org/org` · `flow:github.organization.update`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 GitHub组织响应；没有允许编辑字段为400。

数据与副作用：仅转发EDITABLE_KEYS字段，成功写org.update审计；并不修改本地部署配置。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/org.ts:30](../../../app/server/src/routes/admin/org.ts#L30)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 创建组织团队

`POST /api/admin/:org/teams` · `flow:github.teams.create`

权限与资源：有效会话且是极客班成员，站内称号带 github.teams.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true,team}；缺name为400。

数据与副作用：调用GitHub创建团队，记录team.create审计。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/teams.ts:28](../../../app/server/src/routes/admin/teams.ts#L28)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 删除组织团队

`DELETE /api/admin/:org/teams/:slug` · `flow:github.teams.delete`

权限与资源：有效会话且是极客班成员，站内称号带 github.teams.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}。

数据与副作用：删除URL组织中指定slug的GitHub团队，记录team.delete审计。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/teams.ts:42](../../../app/server/src/routes/admin/teams.ts#L42)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看组织仓库列表

`GET /api/admin/:org/repos` · `flow:github.repositories.list`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {repos}，仅下发列表所需字段。

数据与副作用：经接入的 GitHub（App 或本人令牌）分页读取组织仓库，按login/org缓存60秒。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:11](../../../app/server/src/routes/admin/repos.ts#L11)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看仓库信息与成员

`GET /api/admin/:org/repos/:repo` · `flow:github.repositories.detail`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {info,branches,collaborators,hooks}；后三个子查询失败降为空数组。

数据与副作用：经接入的 GitHub 读取仓库、分支、协作者和hooks，按login/org/repo缓存60秒。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:41](../../../app/server/src/routes/admin/repos.ts#L41)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 浏览仓库目录

`GET /api/admin/:org/repos/:repo/tree` · `flow:github.repositories.tree`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {path,entries}；目录优先排序。

数据与副作用：按path/ref读取GitHub contents，不接触服务端本地文件。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:63](../../../app/server/src/routes/admin/repos.ts#L63)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 阅读仓库文件

`GET /api/admin/:org/repos/:repo/file` · `flow:github.repositories.file`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 文件元数据和解码content；超过1MB返回too_large且不附正文；缺path或目录为400。

数据与副作用：按path/ref从GitHub读文件，base64仅转utf8，不执行内容。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:81](../../../app/server/src/routes/admin/repos.ts#L81)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 浏览提交列表

`GET /api/admin/:org/repos/:repo/commits` · `flow:github.repositories.commits`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {commits}，包含摘要、完整message及作者；per_page最多100。

数据与副作用：按sha/path/page读取GitHub提交并缓存30秒。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:98](../../../app/server/src/routes/admin/repos.ts#L98)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 查看提交差异

`GET /api/admin/:org/repos/:repo/commits/:sha` · `flow:github.repositories.commit`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {sha,message,author,actor,stats,files,html_url}；单文件patch截到30000字符。

数据与副作用：从GitHub取指定提交，不本地checkout。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:130](../../../app/server/src/routes/admin/repos.ts#L130)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 浏览仓库议题

`GET /api/admin/:org/repos/:repo/issues` · `flow:github.repositories.issues`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {issues}，过滤pull_request项。

数据与副作用：按state分页读GitHub issues，缓存30秒；不创建issue。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:154](../../../app/server/src/routes/admin/repos.ts#L154)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 阅读议题及评论

`GET /api/admin/:org/repos/:repo/issues/:n` · `flow:github.repositories.issue`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 议题详情与comments；数字n传给GitHub。

数据与副作用：读取GitHub议题和评论，不把评论写入本地库。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:202](../../../app/server/src/routes/admin/repos.ts#L202)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 浏览合并请求

`GET /api/admin/:org/repos/:repo/pulls` · `flow:github.repositories.pulls`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {pulls}，含head/base/draft/mergeable等上游字段。

数据与副作用：按state读取GitHub PR并缓存30秒。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:177](../../../app/server/src/routes/admin/repos.ts#L177)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 阅读合并请求差异

`GET /api/admin/:org/repos/:repo/pulls/:n` · `flow:github.repositories.pull`

权限与资源：有效会话且是极客班成员，站内称号带 github.org.read（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 PR详情、comments、files；files请求失败为空，单patch截到20000字符。

数据与副作用：读取GitHub PR/评论/文件，不执行分支内容、不合并。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/repos.ts:228](../../../app/server/src/routes/admin/repos.ts#L228)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 合并仓库请求

`PUT /api/admin/:org/repos/:repo/pulls/:n/merge` · `flow:github.repositories.merge`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true,merged,sha,message}，merged取上游；局部catch返回上游status或500及merge_failed/message，不走同一脱敏路径。

数据与副作用：按merge_method、可选sha调用GitHub merge，成功写pr.merge审计并清repo/repos缓存；授权和分支保护仍由GitHub决定。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:259](../../../app/server/src/routes/admin/repos.ts#L259)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 变更议题状态

`PATCH /api/admin/:org/repos/:repo/issues/:n` · `flow:github.repositories.issue_state`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true,state}。

数据与副作用：向GitHub PATCH open/closed状态，写issue.<state>审计并清repo缓存。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:285](../../../app/server/src/routes/admin/repos.ts#L285)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 回复仓库议题

`POST /api/admin/:org/repos/:repo/issues/:n/comments` · `flow:github.repositories.comment`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true,id,html_url}；空白body为400 empty_body。

数据与副作用：POST GitHub评论，写issue.comment审计；评论正文不写审计。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:301](../../../app/server/src/routes/admin/repos.ts#L301)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 创建组织仓库

`POST /api/admin/:org/create-repo` · `flow:github.repositories.create`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true,repo:{name,full_name,html_url}}；非法name为400。

数据与副作用：向GitHub创建仓库（auto_init默认true），写repo.create审计并清repos缓存。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:317](../../../app/server/src/routes/admin/repos.ts#L317)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 删除组织仓库

`DELETE /api/admin/:org/repos/:repo` · `flow:github.repositories.delete`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}。

数据与副作用：DELETE GitHub仓库，成功审计repo.delete，清repo/repos缓存。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:338](../../../app/server/src/routes/admin/repos.ts#L338)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 授权仓库协作者

`PUT /api/admin/:org/repos/:repo/collaborators/:login` · `flow:github.repositories.collaborator_put`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}；permission默认push。

数据与副作用：PUT GitHub协作者权限，可能触发GitHub邀请；写repo.collab.add审计并清repo缓存。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:352](../../../app/server/src/routes/admin/repos.ts#L352)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 移除仓库协作者

`DELETE /api/admin/:org/repos/:repo/collaborators/:login` · `flow:github.repositories.collaborator_delete`

权限与资源：有效会话且是极客班成员，站内称号带 github.repos.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}。

数据与副作用：DELETE GitHub协作者，审计repo.collab.remove并清repo缓存。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

验证边界：core/upstream-errors 是通用鉴权或部分上游错误回归；本接口专属的成功负载与GitHub真实副作用尚未由这些测试完整证明。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/repos.ts:366](../../../app/server/src/routes/admin/repos.ts#L366)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/upstream-errors.test.ts](../../../tests/server/upstream-errors.test.ts)。

## 核对组织邀请与本地历史

`GET /api/admin/:org/invitations` · `flow:invitation.admin.list`

权限与资源：有效会话且是极客班成员，站内称号带 github.invites.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {pending,history}；本地最近200条历史含邮箱、备注、source_ip和链接token，只对带 github.invites.manage 的称号开放。

数据与副作用：分页读取GitHub待接受邀请及本组织本地历史，不发信或补发。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

本地表读取：invitations, sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/invitations.ts:10](../../../app/server/src/routes/admin/invitations.ts#L10)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 取消尚未接受的组织邀请

`DELETE /api/admin/:org/invitations/:id` · `flow:invitation.admin.cancel`

权限与资源：有效会话且是极客班成员，站内称号带 github.invites.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true}；非有限数id为400。

数据与副作用：调用GitHub取消邀请，写invitation.cancel审计；不回写历史invitations状态或返还链接额度。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

本地表读取：sessions。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/admin/invitations.ts:22](../../../app/server/src/routes/admin/invitations.ts#L22)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 查看组织邀请链接

`GET /api/admin/:org/invite-links` · `flow:invitation.links.list`

权限与资源：有效会话且是极客班成员，站内称号带 github.invites.manage（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {links}；包含完整token及配额，不包含发起人加密token。

数据与副作用：仅按URL org读取链接，持有token即可走公开邀请流程，应保留 github.invites.manage 门槛。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

这个接口不调用 GitHub，不会因 GitHub 令牌失效结束会话。

本地表读取：invite_links, sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/invite-links.ts:18](../../../app/server/src/routes/admin/invite-links.ts#L18)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 创建限时组织邀请链接

`POST /api/admin/:org/invite-links` · `flow:invitation.links.create`

权限与资源：有效会话且是极客班成员，站内称号带 github.invites.manage（requireGithub）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看本人在 GitHub 组织里的角色。上游用服务器 GitHub App 的安装令牌，没配 App 时用本人的 GitHub 会话令牌（GitHub 再按本人权限限制一层），都没有 409 github_not_connected（#262 第四期）。

响应与错误：200 {ok:true,token,url,expires_at}；hours范围或max_uses整数范围不合法为400。

数据与副作用：生成18字节随机token，经 GitHub App 接时不存发起人令牌、兑换时也用 App，经本人会话接时保存发起人token密文、有效期与配额，写invite_link.create；不立即发送邀请。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

GitHub 调用：本人会话令牌被 GitHub 拒绝时经全局错误处理结束当前会话并审计；服务器 GitHub App 的令牌被拒回 503 github_connection_failed，不结束会话；普通成功读取不写操作审计。

本地表读取：sessions。本地表写入：invite_links, audit_logs, sessions。

源码：[app/server/src/routes/admin/invite-links.ts:28](../../../app/server/src/routes/admin/invite-links.ts#L28)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 启停组织邀请链接

`PATCH /api/admin/:org/invite-links/:token` · `flow:invitation.links.toggle`

权限与资源：有效会话且是极客班成员，站内称号带 github.invites.manage（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {ok:true}；token不属于该org为404 not_found。

数据与副作用：按token和org找链接后更新disabled并审计，不撤回已经发出的GitHub邀请。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

这个接口不调用 GitHub，不会因 GitHub 令牌失效结束会话。

本地表读取：invite_links, sessions。本地表写入：invite_links, audit_logs, sessions。

源码：[app/server/src/routes/admin/invite-links.ts:60](../../../app/server/src/routes/admin/invite-links.ts#L60)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 删除组织邀请链接

`DELETE /api/admin/:org/invite-links/:token` · `flow:invitation.links.delete`

权限与资源：有效会话且是极客班成员，站内称号带 github.invites.manage（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {ok:true}；没有匹配org/token为404 not_found。

数据与副作用：删除匹配链接并审计invite_link.delete；不删除邀请历史，不撤销GitHub既有邀请。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

这个接口不调用 GitHub，不会因 GitHub 令牌失效结束会话。

本地表读取：invite_links, sessions。本地表写入：invite_links, audit_logs, sessions。

源码：[app/server/src/routes/admin/invite-links.ts:74](../../../app/server/src/routes/admin/invite-links.ts#L74)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 读取组织管理员审计

`GET /api/admin/:org/logs` · `flow:audit.organization.read`

权限与资源：有效会话且是极客班成员，站内称号同时带 audit.read 与 github.invites.manage（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {logs}；details解析为对象，limit最多500。

数据与副作用：只按URL org查询审计。与console审计不同，此处带 audit.read 与 github.invites.manage 的称号能看到完整邀请token；org为null的登录审计不返回。

会话读取遇到过期会话才删除 sessions；没有有效会话返回401，不把界面显隐作为授权。

这个接口不调用 GitHub，不会因 GitHub 令牌失效结束会话。

本地表读取：audit_logs, sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/logs.ts:9](../../../app/server/src/routes/admin/logs.ts#L9)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 解析本人控制台身份

`GET /api/console/me` · `flow:console.identity`

权限与资源：只需有效会话；回答当前登录者的站内角色、称号与能力，以及控制台这次经什么接GitHub（app、session或none），不接受自报role（#262 第四期）。

响应与错误：200 {login,avatar_url,org,provider,site_role,github,title,titles,capabilities,head_of,email_required}；email_required为true时控制台先带人去绑定邮箱页（#273）。

数据与副作用：只计算当前身份；不是成员的账号保留称号展示但没有任何能力；补记站内角色时查GitHub失败按错误处理，不降级为非成员；存在会话不等于拥有console.access。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/me.ts:14](../../../app/server/src/routes/console/me.ts#L14)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 按能力读取工作概览

`GET /api/console/summary` · `flow:console.summary`

权限与资源：console.access；applications、feedback、people三块分别再按applications.read、feedback.read及roles.manage或roles.department.manage过滤。

响应与错误：200 只含获授权的统计键；投递计数含全部五状态和7日数。

数据与副作用：读全局投递统计、CONSOLE_ORG意见数及指派/未归档部门数；不返回无权查看的统计键。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：applications, feedback, sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/me.ts:27](../../../app/server/src/routes/console/me.ts#L27)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 读取称号与能力目录

`GET /api/console/catalogue` · `flow:organization.catalogue`

权限与资源：console.access；供渲染的能力清单不能替代服务端授权。

响应与错误：200 {titles,crew,tones,capabilities,domains,role_base,implies,captain_only,department_icons,application_statuses}。

数据与副作用：称号显示与权限包来自titles；能力、色调、蕴含等来自源码常量，不写权限配置。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/catalogue.ts:12](../../../app/server/src/routes/console/catalogue.ts#L12)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 读取部门及成员计数

`GET /api/console/departments` · `flow:organization.departments.list`

权限与资源：console.access，读取全部部门配置；不是仅本人部门。

响应与错误：200 {departments}，含heads和crew_count，也保留归档标记。

数据与副作用：读取departments和role_assignments，写权限包不在此入口。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/departments.ts:30](../../../app/server/src/routes/console/departments.ts#L30)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 新建组织部门

`POST /api/console/departments` · `flow:organization.departments.create`

权限与资源：roles.manage且站内角色是管理员（提督，requireAdmiral）；舰长仅有roles.manage仍403 admiral_required。

响应与错误：201 {department}；400 captain_only_capability，409 department_exists。

数据与副作用：写新部门，roles.manage不得装进部门权限包；成功写department.create审计。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：departments, audit_logs, sessions。

源码：[app/server/src/routes/console/departments.ts:37](../../../app/server/src/routes/console/departments.ts#L37)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 修改或归档组织部门

`PATCH /api/console/departments/:department_id` · `flow:organization.departments.update`

权限与资源：roles.manage且站内角色是管理员（提督，requireAdmiral）；舰长仅有roles.manage仍403 admiral_required。

响应与错误：200 {department}；未知id 404，非法舰长专属能力400。

数据与副作用：更新传入字段/归档标记；仅实际变化时审计department.update，未直接撤销其他称号。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：departments, audit_logs, sessions。

源码：[app/server/src/routes/console/departments.ts:47](../../../app/server/src/routes/console/departments.ts#L47)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 删除部门并撤销该部门指派

`DELETE /api/console/departments/:department_id` · `flow:organization.departments.delete`

权限与资源：roles.manage且站内角色是管理员（提督，requireAdmiral）；舰长仅有roles.manage仍403 admiral_required。

响应与错误：200 {ok:true,removed}；不存在404 not_found。

数据与副作用：同一数据库事务删除该部门和其head/member指派，其他指派不变；审计被撤销者，种子标记防止重启复活。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：departments, role_assignments, audit_logs, sessions。

源码：[app/server/src/routes/console/departments.ts:63](../../../app/server/src/routes/console/departments.ts#L63)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 修改称号显示与权限包

`PATCH /api/console/titles/:title_id` · `flow:organization.titles.update`

权限与资源：roles.manage；admin/captain两级只有提督能改；提督固定全能力、乘客固定无能力，roles.manage只能进captain包。

响应与错误：200 {title}；400 title_capabilities_fixed/captain_only_capability，403 admiral_required，404 not_found。

数据与副作用：只更新允许的称号字段；实际变化才写title.update（不含旧新值），下一次请求读取新权限包。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：titles, audit_logs, sessions。

源码：[app/server/src/routes/console/titles.ts:17](../../../app/server/src/routes/console/titles.ts#L17)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 查看可管理的称号指派

`GET /api/console/assignments` · `flow:organization.assignments.list`

权限与资源：任一能力即可；roles.manage查全部，部门队长仅headOf范围，显式查询其他部门403 out_of_department_scope。

响应与错误：200 {assignments,captain}；captain只给登录名。

数据与副作用：读取筛选指派及现任舰长，不任命或移交。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/assignments.ts:34](../../../app/server/src/routes/console/assignments.ts#L34)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 指派称号或移交舰长

`POST /api/console/assignments` · `flow:organization.assignments.grant`

权限与资源：任一能力；队长只任免自己部门member，captain只由提督或现任舰长任命；指派对象给account_id（极客班账号，没绑GitHub的也行）或github_login，二选一（#262 第四期）。

响应与错误：201 {assignment}；400 部门错误或github_user_not_found，404 account_not_found，403 跨部门或captain_required，409 assignment_exists；30次/分钟限流。

数据与副作用：先校验部门存在且未归档；github_login在接上GitHub时经接入的GitHub（App或本人令牌）查数字id再找账号（登录名会改，旧名可能被别人注册），GitHub没接上时只认本站认识的人、按他上次登录时的用户名找；captain通过事务删旧插新保持唯一；审计指派/移交，不改变GitHub membership。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles, identities, users。本地表写入：role_assignments, audit_logs, sessions。

源码：[app/server/src/routes/console/assignments.ts:73](../../../app/server/src/routes/console/assignments.ts#L73)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)、[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。

## 撤销称号指派

`DELETE /api/console/assignments/:id` · `flow:organization.assignments.revoke`

权限与资源：任一能力；队长只能撤自己部门member；captain仅提督或该行对应舰长本人可撤。

响应与错误：200 {ok:true}；404 not_found，403 out_of_department_scope/missing_capability，409 captain_transfer_required。

数据与副作用：删除指定指派并记role.revoke，其他指派不变；不删除GitHub组织成员。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles。本地表写入：role_assignments, audit_logs, sessions。

源码：[app/server/src/routes/console/assignments.ts:98](../../../app/server/src/routes/console/assignments.ts#L98)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 查看组织成员与称号持有者

`GET /api/console/people` · `flow:organization.people`

权限与资源：任一能力；队长也能看全名单，不按部门收窄；名单以极客班账号为准，接上GitHub（App或本人GitHub会话）时并上组织里还没登录过本站的人，接不上照常给名单（#262 第四期）。

响应与错误：200 {people,github,github_listed}；每人含account_id/login/user_id/avatar_url/site_role/role_unrecorded/member/status/providers/last_login_at/titles（不含邮箱），列出了GitHub组织成员时带github_role；按最高称号层级和登录名排序。

数据与副作用：读取账号、身份与指派；接上GitHub时取组织成员（失败只记日志、github_listed为false），再合并有指派但两边都没有的人；按数字id优先匹配改名用户，不同步写远端。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles, users, identities。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/people.ts:35](../../../app/server/src/routes/console/people.ts#L35)、[app/server/src/lib/github-connection.ts](../../../app/server/src/lib/github-connection.ts)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。

## 改账号的站内角色

`PATCH /api/console/people/:account_id/site-role` · `flow:organization.people.site_role`

权限与资源：roles.manage且站内角色是管理员（提督）；舰长仅有roles.manage仍403 admiral_required；不看GitHub组织角色（#262 第四期）。

响应与错误：200 {account_id,site_role,changed}；site_role不是admin/member/none为400，账号不存在或已合并404 not_found，改掉最后一位管理员409 last_admin；30次/分钟限流。

数据与副作用：在一个BEGIN IMMEDIATE事务里改users的org_role/org_state，写identity_audit的role_change与account.role审计；改成none后对方下一次请求起没有任何能力、不能再登录，称号指派保留；不改GitHub组织成员关系。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：sessions, role_assignments, departments, titles, users。本地表写入：users, identity_audit, audit_logs, sessions。

源码：[app/server/src/routes/console/people.ts:91](../../../app/server/src/routes/console/people.ts#L91)、[app/server/src/lib/identity-store.ts](../../../app/server/src/lib/identity-store.ts)（`setSiteRole`）。验证入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 按能力读取脱敏审计

`GET /api/console/audit` · `flow:audit.console.read`

权限与资源：audit.read；仅CONSOLE_ORG，action按转义后的字面前缀筛选；不是全库日志。

响应与错误：200 {logs}；details解析为对象；invite_link目标token及public:token操作者只保留前6位。

数据与副作用：读日志分页，不修改历史；org为空的登录/公开投递审计不在该结果中。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：audit_logs, sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/audit.ts:29](../../../app/server/src/routes/console/audit.ts#L29)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 新权限体系：节点、权限组与用户列表（控制台，#274 CONTRACT §5）

和上面「读取部门及成员计数」「修改称号显示与权限包」「查看组织成员与称号持有者」「改账号的站内角色」几节描述的旧
Capability 体系（`departments`/`titles`/`role_assignments`，`routes/console/{departments,titles,assignments,people}.ts`）
并存，不是替换：这批新接口按 #274 的权限节点判定（`perm_nodes`/`perm_groups`/`perm_group_parents`/`perm_entries`/
`perm_members`），旧接口继续服务旧控制台前端，两边同时能用；等新控制台前端（独立开发中）合并进来后再把旧的一起删掉。
`GET /api/console/summary` 额外加了 `candidates_pending`（固定 0，#278 之前）键，门槛是新节点
`competition.score.review`，和这节同一批改动，但端点本身还是旧的 `routes/console/me.ts`，不在下表里。

| 接口 · 流程 | 权限与资源 | 响应、错误与副作用 |
|---|---|---|
| `GET /api/console/permissions/nodes` · `flow:permissions.nodes.list` | 需要节点 `perm.view` | 200 `{nodes:[{node,domain,label,description,meta}],domains:[{id,label}]}`；节点目录是代码里 `lib/permission-nodes.ts` 的只读镜像，不查库。 |
| `GET /api/console/permissions/explain?account=&node=` · `flow:permissions.explain` | 同上 | 200 `{node,result:allow\|deny\|unset,hits:[{source,group,via,entry}],meta_value?}`；`node` 是通配或未登记节点 400 `unknown_node`；账号不存在 404。直接复用求值引擎自带的 `explainFor`（`lib/permissions.ts`），不重复判定逻辑。 |
| `GET /api/console/accounts/:id/effective` · `flow:permissions.accounts.effective` | 同上 | 200 `{account_id,groups:[{id,name,kind,via}],allow:[nodes],deny:[nodes],meta:{...}}`；账号不存在 404；复用引擎的 `effective()`。 |
| `GET /api/console/permission-groups` · `flow:permissions.groups.list` | 同上 | 200 `{groups:[{id,kind,name,description,weight,department_id,icon,tone,sort,system,parents,member_count,entries}]}`，按 `sort` 升序；`entries[].value` 保留原始三态（`true`/`false`/`null`，`null` 配 `meta_value`），不像判定引擎那样把 `null` 当 `false`。 |
| `POST /api/console/permission-groups` · `flow:permissions.groups.create` | 需要节点 `perm.manage` 且刚登录过（step-up，#273 同一个 10 分钟窗口，没有 403 `step_up_required`）；每分钟 30 次 | body `{id(custom.<slug>),name,description?,weight,parents?,icon?,tone?}`；201 权限组一行；`id` 格式不对 400 `invalid_group_id`；已存在 409 `group_exists`；父组不存在 400 `invalid_parent`。只能新建 `kind=custom`、`system=0` 的组。 |
| `PATCH /api/console/permission-groups/:id` · `flow:permissions.groups.update` | 同上 | body 任选 `{name,description,weight,parents,icon,tone,sort,entries:{add:[{node,value?,meta_value?,scope?,expires_at?}],remove:[entry_id]}}`；对 `system=1` 的种子组（部门、称号、身份等级）同样能改，不限自定义组；继承成环 400 `group_cycle`；父组不存在 400 `invalid_parent`；`entries.add` 的节点不是已登记节点、也匹配不到任何已登记节点的通配前缀 400 `unknown_node`；一条条目必须只给 `value` 或只给 `meta_value` 400 `invalid_entry`。 |
| `DELETE /api/console/permission-groups/:id` · `flow:permissions.groups.delete` | 同上 | `system=1` 的种子组 409 `system_group`，不能删；自定义组删除时一并删掉这个组的全部条目与成员资格（不另行提示在组里的账号）。 |
| `GET /api/console/permission-groups/:id/members` · `flow:permissions.groups.members.list` | 需要节点 `perm.view` | 200 `{members:[{account_id,username,display_name,avatar_url,expires_at,granted_by,created_at}]}`，按加入时间升序；组不存在 404。 |
| `POST /api/console/permission-groups/:id/members` · `flow:permissions.groups.members.add` | 需要节点 `perm.manage` 且刚登录过；body `{account_id,expires_at?}` | 组或账号不存在 404（`not_found`/`account_not_found`）；`level`、`department` 组每账号最多一个，同一事务里先删旧的再插入新的（和 `setExclusiveGroupMembership` 同一条规则）。 |
| `DELETE /api/console/permission-groups/:id/members/:account_id` · `flow:permissions.groups.members.remove` | 同上 | 这个账号本来就不在这个组里 404 `not_found`。 |
| `GET /api/console/users?q=&level=&department=&status=&cursor=` · `flow:users.list` | 有全站 `users.view` 的 allow 就看全部账号；只有按部门限定 scope 的 allow（部长）就只看本部门，查询参数改不了范围；两种都没有 403 `forbidden` | 200 `{items:[{account_id,username,display_name,avatar_url,status,level,department,titles,providers,gitlab,last_login_at,created_at}],next_cursor,counts:{visitor_today,registered,member,alumni}}`；`department=dept.none` 筛出没有部门成员资格的账号；`cursor` 是按 `created_at,id` 的不透明游标，固定 50 条一页；`gitlab.state` 由 `gitlab_accounts.state`/`last_error` 映射成 `synced\|pending\|failed\|blocked\|none`；`counts.visitor_today` 在操作记录（阶段 3）落地前固定 0。 |
| `PATCH /api/console/users/:id` · `flow:users.update` | 需要节点 `users.manage` 且刚登录过；改 `status` 另外需要 `users.disable` | body 任选 `{status,level,department,titles}`；账号不存在 404；部门不存在 400 `invalid_department`；称号不存在 400 `invalid_title`；会让站长一个不剩（停用最后一个站长，或把 `titles` 改成不含 `title.site.owner`）409 `last_owner`。`level`/`department` 按唯一约束换组；`department` 变了且这次请求没有同时给 `titles` 时，自动去掉不属于新部门的称号（站长等无部门称号不受影响）。 |

本地表：这批接口都只读写 #274 新权限体系自己的表——`perm_nodes`（只读，代码镜像）、`perm_groups`、`perm_group_parents`、`perm_entries`、`perm_members`；用户列表另外读 `users`、`account_profiles`、`identities`、`gitlab_accounts`，改身份另外写 `users.status`；成员列表再读 `account_profiles` 取用户名/头像。所有写操作都调用 `permissions.bump()` 让判定引擎的进程内缓存失效，并写一条 `perm.group.*`/`users.update` 审计。

权限范围的实现细节：`requirePermission` 中间件按「不给 scope 就查全局」判定，命中的是全站无限定条目；但部长拿到的条目本身带了 `scope:{department:[...]}}`，用空 scope 去查永远查不到。所以 `GET /api/console/users` 不能只靠 `requirePermission` 当门禁，改用 `lib/console-scope.ts` 的 `departmentScopedAccess()`：先查有没有全站 allow，没有再查有没有按部门限定的 allow，两种都没有才真的是没权限；只处理 `department` 这一个 scope 维度，不是通用的 scope 求交实现。

源码：[routes/console/permissions.ts](../../../app/server/src/routes/console/permissions.ts)、[routes/console/permission-groups.ts](../../../app/server/src/routes/console/permission-groups.ts)、[routes/console/accounts.ts](../../../app/server/src/routes/console/accounts.ts)、[routes/console/users.ts](../../../app/server/src/routes/console/users.ts)、[lib/console-scope.ts](../../../app/server/src/lib/console-scope.ts)、[middleware/require-step-up.ts](../../../app/server/src/middleware/require-step-up.ts)、[lib/permissions.ts](../../../app/server/src/lib/permissions.ts)（`explainFor`、`effective`）。验证入口：[tests/server/console-permissions.test.ts](../../../tests/server/console-permissions.test.ts)、[tests/server/console-users.test.ts](../../../tests/server/console-users.test.ts)。

## 筛选招新投递列表

`GET /api/console/applications` · `flow:application.list`

权限与资源：applications.read；无部门/个人记录限制，有此能力可读全部候选人列表。

响应与错误：200 {items,total,counts}；特长摘要120字、last_review可空，来源IP/UA不下发；counts为未筛选的全局五状态计数。

数据与副作用：转义q中的LIKE通配符，按姓名/班级/邮箱搜索；查询latest review，不为列表记application.view。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：applications, application_reviews, sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/applications.ts:48](../../../app/server/src/routes/console/applications.ts#L48)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 查看候选人详情与邮件状态

`GET /api/console/applications/:application_id` · `flow:application.detail`

权限与资源：applications.read；按UUID定位任意候选人，无部门范围限制。

响应与错误：200 {application,reviews,received_mail,mail}；404 not_found。邮件摘要不含地址/正文，application不含source_ip/UA。

数据与副作用：读简历、审核历史和mail_outbox摘要，写application.view审计，不触发发信。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：applications, application_reviews, mail_outbox, sessions, role_assignments, departments, titles。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/console/applications.ts:104](../../../app/server/src/routes/console/applications.ts#L104)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts)。

## 导出候选人CSV

`GET /api/console/applications/export.csv` · `flow:application.export`

权限与资源：applications.export；可选status过滤，其余不按部门收窄；5次/分钟。

响应与错误：200 text/csv附件，UTF-8 BOM、北京时间列、公式前缀转义；429 rate_limited。

数据与副作用：读取简历并记录application.export数量/状态；不写候选人或发信队列，文件导出后不由系统追踪。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：applications, sessions, role_assignments, departments, titles。本地表写入：audit_logs, sessions。

源码：[app/server/src/routes/console/applications.ts:77](../../../app/server/src/routes/console/applications.ts#L77)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。

## 审核投递、补备注与安排通知

`PATCH /api/console/applications/:application_id` · `flow:application.review`

权限与资源：applications.review；按id审核，状态变更必须携带expected_status和expected_review_id；取消分支规则仍唯一见application.cancel。

响应与错误：200 {application,review}；400 invalid_status/no_change/letter_required/letter_invalid，404 not_found，409 status_changed。

数据与副作用：变更到interview/accepted/rejected且notify不为false才渲染邮件；状态、审核行和邮件入队同事务，实际发送由后台worker。备注不写信或审计正文；本路由不新增任何取消规则。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：applications, application_reviews, mail_outbox, sessions, role_assignments, departments, titles。本地表写入：applications, application_reviews, mail_outbox, audit_logs, sessions。

源码：[app/server/src/routes/console/applications.ts:120](../../../app/server/src/routes/console/applications.ts#L120)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts)。

## 提交加入我们申请

`POST /api/portal/apply` · `flow:application.submit`

权限与资源：匿名；蜜罐、PoW、可选Turnstile、每IP分钟5次和IP(/64)/设备24小时各5份。

响应与错误：201 {id,submitted_at,message}；字段错误400附fields，429 apply_limited/rate_limited。蜜罐回相同201形状但不落库。

数据与副作用：计数与投递同事务，发设备cookie；记脱敏application.received审计，尽力入队已收到邮件（每小时总量限制），入队失败仅日志不回滚投递；无需会话。

本地表读取：application_limits, mail_outbox。本地表写入：applications, application_limits, mail_outbox, audit_logs。

源码：[app/server/src/routes/portal/apply.ts:118](../../../app/server/src/routes/portal/apply.ts#L118)。验证入口：[tests/server/applications.test.ts](../../../tests/server/applications.test.ts)、[tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts)、[tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。

## 读取公开防滥用配置

`GET /api/public/config` · `flow:platform.public_config`

权限与资源：匿名可读；仅公开site key或null与PoW难度，不含Turnstile secret。

响应与错误：200 {turnstile_site_key,pow_difficulty}。

数据与副作用：只读配置，无业务数据库读取和写入，不调用验证码服务。

本地表读取：无。本地表写入：无。

源码：[app/server/src/routes/portal/join.ts:47](../../../app/server/src/routes/portal/join.ts#L47)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/configuration.test.ts](../../../tests/server/configuration.test.ts)。

## 阅读公开组织架构

`GET /api/public/org` · `flow:organization.public`

权限与资源：匿名可读；只下发称号/未归档部门显示信息及色调，不含人员或权限包。

响应与错误：200 {tones,titles,departments}。

数据与副作用：读取数据库显示配置与源码rank/tone，不修改组织结构。

本地表读取：titles, departments。本地表写入：无。

源码：[app/server/src/routes/portal/org.ts:11](../../../app/server/src/routes/portal/org.ts#L11)。验证入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。

## 阅读公开部门与称号（新权限体系，#274）

`GET /api/public/departments` · `flow:identity.departments.public`

权限与资源：匿名可读；60 秒缓存。读的是 #274 新权限体系的 `perm_groups`（`kind='department'`/`title`），不是上面 `GET /api/public/org` 读的旧 `departments`/`titles` 表——新旧两套分组表在迁移完成前并存，旧接口继续服务旧前端，这个新接口给新前端（控制台、门户的部门展示）用。

响应与错误：200 `{departments:[{id,name,tone,icon,description,titles:[{id,name,weight}]}]}`；按 `perm_groups.sort` 升序排列（AI/算法/硬件/网安/管理在前，`dept.none` 固定排最后，`sort` 字段本身不下发），每个部门下的称号按 `weight` 升序。

数据与副作用：只读 `perm_groups`，不修改组织结构，不需要会话。

本地表读取：perm_groups。本地表写入：无。

源码：[app/server/src/routes/portal/departments.ts](../../../app/server/src/routes/portal/departments.ts)。验证入口：[tests/server/profile.test.ts](../../../tests/server/profile.test.ts)。

## 浏览公开文档清单

`GET /api/docs` · `flow:documentation.list`

权限与资源：匿名，只收DOC_FILES允许列表且文件存在。

响应与错误：200 {items:[{id,label,lang,file}]}。

数据与副作用：仅检查仓库公开文件是否存在；内部规范、运维和目录不会通过此API公开。

本地表读取：无。本地表写入：无。

源码：[app/server/src/routes/portal/docs.ts:16](../../../app/server/src/routes/portal/docs.ts#L16)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 阅读允许公开的文档

`GET /api/docs/:id` · `flow:documentation.read`

权限与资源：匿名；id必须命中固定DOC_FILES，不能用任意路径读取文件。

响应与错误：200 {id,label,lang,file,content}；未列入或文件缺失404。

数据与副作用：读取允许的UTF-8 Markdown，不访问业务数据库、不执行内容。

本地表读取：无。本地表写入：无。

源码：[app/server/src/routes/portal/docs.ts:23](../../../app/server/src/routes/portal/docs.ts#L23)。验证入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 检查公开邀请链接

`GET /api/join/:token` · `flow:invitation.public.inspect`

权限与资源：持有token可访问；不需要登录，不返回发起人的token密文。

响应与错误：200 {org,note,team_slug,expires_at,remaining_uses,valid,reason}；未知token404。

数据与副作用：读取链接状态并计算剩余额度，不预留额度、不调用GitHub、不发邀请。

本地表读取：invite_links。本地表写入：无。

源码：[app/server/src/routes/portal/join.ts:52](../../../app/server/src/routes/portal/join.ts#L52)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)。

## 兑换组织邀请链接

`POST /api/join/:token` · `flow:invitation.public.redeem`

权限与资源：持有token，PoW/蜜罐/可选Turnstile及分钟限流；额度、禁用和过期在事务预留时再次校验；发邀请用服务器的 GitHub App，没配 App 时用链接发起人密文中的token（经 App 建的链接不存令牌，#262 第四期）。

响应与错误：200 {ok:true,invitation_id,message}；404不存在，400输入/明确失败，409 invite_pending_review/invite_unavailable，503 GitHub App 用不了、发起人凭据失效或结果待核对。

数据与副作用：先事务预留再请求GitHub（可查团队和用户名），成功写邀请/尝试/审计；sent重放不重复发送，明确失败返还额度，不确定结果保留unknown待核对，不删除访问者会话。

本地表读取：invite_links, invite_attempts。本地表写入：invite_links, invite_attempts, invitations, audit_logs。

源码：[app/server/src/routes/portal/join.ts:67](../../../app/server/src/routes/portal/join.ts#L67)。验证入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)、[tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。

## 读取意见分类与提交参数

`GET /api/feedback/categories` · `flow:feedback.categories`

权限与资源：匿名，只返回本部署CONSOLE_ORG及固定分类。

响应与错误：200 {categories,pow_difficulty,org}。

数据与副作用：读源码配置，不写数据库、不发信。

本地表读取：无。本地表写入：无。

源码：[app/server/src/routes/portal/feedback.ts:24](../../../app/server/src/routes/portal/feedback.ts#L24)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 浏览已公开的意见与回复

`GET /api/feedback/public` · `flow:feedback.public.list`

权限与资源：匿名；org按大小写不敏感匹配CONSOLE_ORG，否则回空列表；spam不公开。

响应与错误：200 {items}；正文截280字、含回复/状态/票数，不含contact/IP/UA；limit由合同限制且最终最多100。

数据与副作用：只读本组织反馈，不查询其他组织是否有记录。

本地表读取：feedback。本地表写入：无。

源码：[app/server/src/routes/portal/feedback.ts:62](../../../app/server/src/routes/portal/feedback.ts#L62)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 提交组织意见

`POST /api/feedback` · `flow:feedback.submit`

权限与资源：匿名可提交；仅CONSOLE_ORG，5至5000字，固定分类，PoW/蜜罐/Turnstile与每分钟10次限流；sid仅补充提交人身份。

响应与错误：200 {ok:true,id,message}；非法org/内容/分类或人机校验失败400，超额429。

数据与副作用：写feedback及feedback.submit审计（80字预览）；有效sid补账号，过期sid可删除；联系方式截200字，不发送邮件。

本地表读取：sessions。本地表写入：feedback, audit_logs, sessions。

源码：[app/server/src/routes/portal/feedback.ts:26](../../../app/server/src/routes/portal/feedback.ts#L26)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)、[tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。

## 组织管理员读取待处理意见

`GET /api/admin/:org/feedback` · `flow:feedback.admin.list`

权限与资源：有效会话且是极客班成员，站内称号带 feedback.read（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {items,counts}；最多500条，管理DTO不下发source_ip/UA/数字账号id。

数据与副作用：按org及可选status读列表与状态计数，不记查看审计。

本地表读取：feedback, sessions。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/admin/feedback.ts:13](../../../app/server/src/routes/admin/feedback.ts#L13)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 组织管理员处理意见状态与回复

`PATCH /api/admin/:org/feedback/:id` · `flow:feedback.admin.update`

权限与资源：有效会话且是极客班成员，站内称号带 feedback.manage（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {ok:true}；记录不属于org返回404，非法状态被合同/handler拒绝。

数据与副作用：更新status、reply、replied_by/replied_at及updated_at，审计feedback.update；回复将由公开列表展示，不发邮件。

本地表读取：feedback, sessions。本地表写入：feedback, audit_logs, sessions。

源码：[app/server/src/routes/admin/feedback.ts:19](../../../app/server/src/routes/admin/feedback.ts#L19)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 组织管理员删除组织意见

`DELETE /api/admin/:org/feedback/:id` · `flow:feedback.admin.delete`

权限与资源：有效会话且是极客班成员，站内称号带 feedback.manage（requireManagedOrg）；URL 组织必须是 CONSOLE_ORG，否则 403 org_not_managed；不看 GitHub 组织角色，不调用 GitHub（#262 第四期）。

响应与错误：200 {ok:true}；org/id不匹配404。

数据与副作用：删除反馈并审计feedback.delete，不能越过组织条件删除其他记录。

本地表读取：feedback, sessions。本地表写入：feedback, audit_logs, sessions。

源码：[app/server/src/routes/admin/feedback.ts:32](../../../app/server/src/routes/admin/feedback.ts#L32)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 控制台读取待处理意见

`GET /api/console/feedback` · `flow:feedback.console.list`

权限与资源：feedback.read；资源固定CONSOLE_ORG，不接受客户端自报org。

响应与错误：200 {items,counts}；最多500条，管理DTO不下发source_ip/UA/数字账号id。

数据与副作用：按org及可选status读列表与状态计数，不记查看审计。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：feedback, sessions, role_assignments, departments, titles。本地表写入：sessions, audit_logs。

源码：[app/server/src/routes/console/feedback.ts:12](../../../app/server/src/routes/console/feedback.ts#L12)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 控制台处理意见状态与回复

`PATCH /api/console/feedback/:id` · `flow:feedback.console.update`

权限与资源：feedback.manage；资源固定CONSOLE_ORG，不接受客户端自报org。

响应与错误：200 {ok:true}；记录不属于org返回404，非法状态被合同/handler拒绝。

数据与副作用：更新status、reply、replied_by/replied_at及updated_at，审计feedback.update；回复将由公开列表展示，不发邮件。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：feedback, sessions, role_assignments, departments, titles。本地表写入：feedback, audit_logs, sessions。

源码：[app/server/src/routes/console/feedback.ts:18](../../../app/server/src/routes/console/feedback.ts#L18)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 控制台删除组织意见

`DELETE /api/console/feedback/:id` · `flow:feedback.console.delete`

权限与资源：feedback.manage；资源固定CONSOLE_ORG，不接受客户端自报org。

响应与错误：200 {ok:true}；org/id不匹配404。

数据与副作用：删除反馈并审计feedback.delete，不能越过组织条件删除其他记录。

共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

本地表读取：feedback, sessions, role_assignments, departments, titles。本地表写入：feedback, audit_logs, sessions。

源码：[app/server/src/routes/console/feedback.ts:31](../../../app/server/src/routes/console/feedback.ts#L31)。验证入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts)、[tests/server/console.test.ts](../../../tests/server/console.test.ts)、[tests/server/core.test.ts](../../../tests/server/core.test.ts)。

## 浏览论坛状态与本人私有列表

`GET /api/forum/state` · `flow:forum.state`

权限与资源：游客与成员均可读；通知、书签和真实通知设置仅本人可见，其他用户设置给默认值；关注关系公开。

响应与错误：200 {state}，帖子只有字段和摘要、没有正文；每IP(/64)分钟120次，超额429；显式HEAD回405且不计算state。

数据与副作用：读论坛表与公开内容分类；GET也可能通过forumViewer刷新本人用户；不发送邮件、不写帖子。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_counters, forum_users, forum_tags, forum_topics, forum_posts, forum_likes, forum_notifications, forum_bookmarks, forum_follows, sessions, role_assignments, departments, titles。本地表写入：forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/topics.ts:21](../../../app/server/src/routes/forum-api/topics.ts#L21)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 阅读单话题帖子正文

`GET /api/forum/topics/:topic_id/posts` · `flow:forum.topic_posts`

权限与资源：游客与成员均可读，无额外帖子级权限；与state可见性一致。

响应与错误：200 {posts}含正文；话题不存在404；每IP分钟60次。

数据与副作用：按话题读取帖子及点赞投影；软删正文为空；不把全论坛正文再次塞进首屏。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_topics, forum_posts, forum_likes, sessions, role_assignments, departments, titles, forum_users。本地表写入：forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/topics.ts:28](../../../app/server/src/routes/forum-api/topics.ts#L28)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 搜索话题帖子和用户

`GET /api/forum/search` · `flow:forum.search`

权限与资源：游客与成员均可搜索；只本人用户记录显示真实通知设置，不搜索已删帖子正文。

响应与错误：200 {results:{topics,posts,users}}；空词空结果；词过长400 validation_error，每IP分钟60次。

数据与副作用：标题、正文、username/displayName按转义的LIKE搜索，各类限量；返回帖子命中摘要，不将%当通配符。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_topics, forum_posts, forum_users, forum_likes, sessions, role_assignments, departments, titles。本地表写入：forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/topics.ts:38](../../../app/server/src/routes/forum-api/topics.ts#L38)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 发布成员话题与首帖

`POST /api/forum/topics` · `flow:forum.topics.create`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。

响应与错误：201 {changes,viewer,guestPolicy,topicId,postId}，帖子带正文；非法标题/分类/tag/空正文400，成员限流429。

数据与副作用：单事务创建话题、首帖、编号和必要新tag，处理最多10个@提及通知；成功后记topic限流事件，不发邮件。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_topics, forum_posts, forum_tags, forum_users, forum_notifications, forum_counters, forum_rate_events, sessions, role_assignments, departments, titles, forum_likes。本地表写入：forum_topics, forum_posts, forum_tags, forum_notifications, forum_counters, forum_rate_events, forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/topics.ts:47](../../../app/server/src/routes/forum-api/topics.ts#L47)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 置顶或取消置顶话题

`POST /api/forum/topics/:topic_id/pin` · `flow:forum.topics.pin`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 此外必须具备forum.topic.pin，作用于指定话题。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；缺能力403，话题不存在404。

数据与副作用：更新pinned；以CONSOLE_ORG记forum.topic.pin审计，只含话题id及开关，不含正文。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_topics, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_topics, audit_logs, forum_users, sessions。

源码：[app/server/src/routes/forum-api/topics.ts:67](../../../app/server/src/routes/forum-api/topics.ts#L67)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 关闭或重新打开话题

`POST /api/forum/topics/:topic_id/close` · `flow:forum.topics.close`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 此外必须具备forum.topic.close，作用于指定话题。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；缺能力403，话题不存在404。

数据与副作用：更新closed；以CONSOLE_ORG记forum.topic.close审计，只含话题id及开关，不含正文。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_topics, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_topics, audit_logs, forum_users, sessions。

源码：[app/server/src/routes/forum-api/topics.ts:67](../../../app/server/src/routes/forum-api/topics.ts#L67)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 记录话题浏览数

`POST /api/forum/topics/:topic_id/view` · `flow:forum.topics.view`

权限与资源：游客或成员都可调用，不解析登录身份；按IP(/64)与话题去重。

响应与错误：204空体；不存在404，分钟60次超额429。

数据与副作用：事务清理超过1小时的去重记录，首次浏览才+1；IP只保留在短期去重表，不随帖子返回。

本地表读取：forum_topics, forum_topic_views。本地表写入：forum_topics, forum_topic_views。

源码：[app/server/src/routes/forum-api/topics.ts:80](../../../app/server/src/routes/forum-api/topics.ts#L80)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 成员或游客回复话题

`POST /api/forum/posts` · `flow:forum.posts.reply`

权限与资源：成员直接回复；游客需合法昵称、空蜜罐、PoW、可选Turnstile与IP/全站限流；已关闭话题仅forum.post.moderate可回，replyTo须同一话题。

响应与错误：201 {changes,viewer,guestPolicy,postId}含正文；404话题不存在；403关闭；400正文/昵称/冒名/PoW/验证码失败；429 rate_limited或guest_replies_paused。

数据与副作用：事务创建回复并更新最后活动、处理回复与提及通知；游客用户与回复同事务；PoW通过就记该IP尝试额度，成功才记全站额度；冒名检查读指派、历史登录审计及会话；不发送邮件。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_topics, forum_posts, forum_users, forum_notifications, forum_counters, forum_rate_events, role_assignments, audit_logs, sessions, departments, titles, forum_likes。本地表写入：forum_posts, forum_topics, forum_users, forum_notifications, forum_counters, forum_rate_events, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/posts.ts:36](../../../app/server/src/routes/forum-api/posts.ts#L36)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 编辑自己的帖子或执行版务

`PATCH /api/forum/posts/:post_id` · `flow:forum.posts.edit`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 必须是作者本人，或者持有forum.post.moderate；能力不是作者分支的共同前提。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；帖子正文随changes返回；404不存在、403他人帖子、409 post_deleted、400 empty_content。

数据与副作用：只更新正文/edited_at；只有编辑他人帖子才写forum.post.edit审计，不记录正文；不会因编辑重新发送提及通知。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_posts, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_posts, audit_logs, forum_users, sessions。

源码：[app/server/src/routes/forum-api/posts.ts:78](../../../app/server/src/routes/forum-api/posts.ts#L78)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 软删除回复

`DELETE /api/forum/posts/:post_id` · `flow:forum.posts.delete`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 作者本人或forum.post.moderate；第一帖禁止删除。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404不存在、403他人帖子、400 first_post；已软删重试返回现状。

数据与副作用：置deleted并清正文，保留点赞和书签；只在删除他人帖子时记forum.post.delete审计；幂等重试不重复执行删除。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_posts, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_posts, audit_logs, forum_users, sessions。

源码：[app/server/src/routes/forum-api/posts.ts:90](../../../app/server/src/routes/forum-api/posts.ts#L90)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 切换本人点赞

`POST /api/forum/posts/:post_id/like` · `flow:forum.posts.like`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 点赞主体固定本人，不接受代他人点赞。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404不存在，409 post_deleted；帖子投影不带全文。

数据与副作用：事务切换点赞；新点赞按作者通知设置生成一次通知（同人同帖不重复），取消不撤回已有通知，不写操作审计。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_posts, forum_likes, forum_users, forum_notifications, forum_counters, sessions, role_assignments, departments, titles。本地表写入：forum_likes, forum_notifications, forum_counters, forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/posts.ts:101](../../../app/server/src/routes/forum-api/posts.ts#L101)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 切换本人书签

`POST /api/forum/posts/:post_id/bookmark` · `flow:forum.posts.bookmark`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 只能操作本人的书签；handler只检查帖子存在，未禁止为已软删帖子加书签。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404不存在；删除书签用changes.removed反馈。

数据与副作用：事务按userId/postId切换书签，不通知作者，不修改帖子正文。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_posts, forum_bookmarks, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_bookmarks, forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/posts.ts:109](../../../app/server/src/routes/forum-api/posts.ts#L109)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 切换本人关注关系

`POST /api/forum/users/:forum_user_id/follow` · `flow:forum.users.follow`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 关注发起人固定本人，目标须存在且不是本人。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404未知用户，400 cannot_follow_self。

数据与副作用：事务切换关注；首次关注在对方允许通知且未曾通知时写通知与编号，取消关注不删除旧通知。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_users, forum_follows, forum_notifications, forum_counters, sessions, role_assignments, departments, titles, forum_likes。本地表写入：forum_follows, forum_notifications, forum_counters, forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/people.ts:11](../../../app/server/src/routes/forum-api/people.ts#L11)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 标记本人通知已读

`POST /api/forum/notifications/:notification_id/read` · `flow:forum.notifications.read`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 SQL同时匹配通知id与recipient_id，不能读取/标记他人通知。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；不存在或属于他人均404。

数据与副作用：仅更新本人该条read=1，不删通知；其他人的通知设置不下发。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_notifications, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_notifications, forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/people.ts:20](../../../app/server/src/routes/forum-api/people.ts#L20)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 标记本人全部通知已读

`POST /api/forum/notifications/read-all` · `flow:forum.notifications.read_all`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 仅recipient_id等于本人。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；没有未读通知仍返回合法空变更。

数据与副作用：UPDATE本人未读行并RETURNING id，据此只回变动通知，不清除别人的未读数。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_notifications, sessions, role_assignments, departments, titles, forum_users, forum_likes。本地表写入：forum_notifications, forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/people.ts:26](../../../app/server/src/routes/forum-api/people.ts#L26)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 修改本人论坛资料

`PATCH /api/forum/me/profile` · `flow:forum.profile.update`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 只修改本人记录；允许昵称、签名、所在地、https网站与通知设置，不接收用户角色授权。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；400昵称/控制字符/网址等错误；旧昵称未变时不因新昵称规则阻止修改其他字段。

数据与副作用：昵称NFKC与冒名检查后保存；冒名来源含已有成员/官方用户名、指派和登录过的组织账号；只更新提交字段，不更改GitHub资料。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_users, role_assignments, sessions, audit_logs, departments, titles, forum_likes。本地表写入：forum_users, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/people.ts:32](../../../app/server/src/routes/forum-api/people.ts#L32)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 上传本人论坛头像

`PUT /api/forum/me/avatar` · `flow:forum.avatar.upload`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 onRequest阶段即鉴权并消费每小时10次额度，失败解码也算；只改本人头像。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；413 avatar_too_large，415 unsupported_media_type，400非法图像/尺寸，429限流。

数据与副作用：PNG/JPEG/WebP最多2MB、4096×4096；sharp取首帧转256×256 WebP去元数据；按哈希写库并更新本人引用，同事务清理无人引用的旧头像。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_avatars, forum_users, forum_rate_events, sessions, role_assignments, departments, titles, forum_likes。本地表写入：forum_avatars, forum_users, forum_rate_events, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/people.ts:80](../../../app/server/src/routes/forum-api/people.ts#L80)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 恢复本人默认头像

`DELETE /api/forum/me/avatar` · `flow:forum.avatar.clear`

权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 只清本人自定义头像。

响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。

数据与副作用：事务移除avatar_hash引用并删除无用户引用的旧头像，保留GitHub头像字段用于回退，不删除用户。

身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

本地表读取：forum_users, forum_avatars, sessions, role_assignments, departments, titles, forum_likes。本地表写入：forum_users, forum_avatars, sessions, audit_logs。

源码：[app/server/src/routes/forum-api/people.ts:91](../../../app/server/src/routes/forum-api/people.ts#L91)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 读取公开头像文件

`GET /api/forum/avatars/:file` · `flow:forum.avatar.read`

权限与资源：匿名；按合同限定的哈希.webp取文件，不接受磁盘路径。

响应与错误：200 image/webp二进制，immutable一年缓存、default-src none和nosniff；不存在404。

数据与副作用：按哈希读取SQLite内WebP数据，不读取私有快照文件或解析sid。

本地表读取：forum_avatars。本地表写入：无。

源码：[app/server/src/routes/forum-api/people.ts:99](../../../app/server/src/routes/forum-api/people.ts#L99)。验证入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。

## 辨认本机论坛运行模式

`interface:forum.local-supervisor` · `GET /__geek_forum` · `flow:forum.local.supervisor`

权限与资源：仅import.meta.dev，非开发404；不是登录身份或业务权限接口。

响应与错误：200 {module,instance,mode,contentSource,snapshotConfigured,realAuthentication:false,serverPersistence:false}，no-store。

数据与副作用：只读运行时配置与进程标识；snapshotConfigured只检查配置是否非空，不连接数据库或校验文件可用。

验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

SQLite读写：无。源码：[app/forum/server/routes/__geek_forum.get.ts](../../../app/forum/server/routes/__geek_forum.get.ts)。验证入口：[app/forum/tests/content-source.test.ts](../../../app/forum/tests/content-source.test.ts)。

## 读取开发快照状态

`interface:forum.local-state` · `GET,HEAD /api/local-forum/state` · `flow:forum.local.state`

权限与资源：仅开发且配置快照目录，GET/HEAD；不实现成员认证，不能把游客展示认成权限校验。

响应与错误：GET 200 {schemaVersion,mode,capturedAt,summary,state}；HEAD空体；未配置404，其他方法405，快照不可读/不合法503。

数据与副作用：读取content.json、asset-index.json和内容编辑层，解析后缓存当前进程；失败缓存清除以便重试；no-store/nosniff，无SQLite或写文件。

验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

SQLite读写：无。源码：[app/forum/server/routes/api/local-forum/state.ts](../../../app/forum/server/routes/api/local-forum/state.ts)。验证入口：[app/forum/tests/local-snapshot.test.ts](../../../app/forum/tests/local-snapshot.test.ts)、[app/forum/tests/local-curation.test.ts](../../../app/forum/tests/local-curation.test.ts)、[app/forum/tests/content-source.test.ts](../../../app/forum/tests/content-source.test.ts)。

## 读取开发快照附件

`interface:forum.local-asset` · `GET,HEAD /api/local-forum/assets/:hash` · `flow:forum.local.asset`

权限与资源：仅开发配置快照且GET/HEAD；hash须在资产索引中、文件必须位于assets目录，不根据原始文件名开放路径。

响应与错误：200完整或206单段Range；HEAD同头无体；404缺条目/文件，416不可满足范围，500大小不符，503快照失败。

数据与副作用：读取索引及资产stat/文件流，类型和disposition来自索引；CSP禁止脚本，断连销毁流；多段/不识别Range回完整体；不修改快照。

验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

SQLite读写：无。源码：[app/forum/server/routes/api/local-forum/assets/[hash].ts](../../../app/forum/server/routes/api/local-forum/assets/[hash].ts)。验证入口：[app/forum/tests/local-snapshot.test.ts](../../../app/forum/tests/local-snapshot.test.ts)。

## 提供论坛Markdown索引

`interface:forum.llms` · `GET,HEAD /llms.txt` · `flow:forum.markdown.index`

权限与资源：匿名GET/HEAD；只拦截llms.txt；其它方法/路径交后续处理器。

响应与错误：200 text/plain UTF-8加nosniff；快照加载失败503。

数据与副作用：site构建使用siteForumState，开发快照模式读只读投影，否则进程示例种子；预渲染可落成静态文件，不动态读取核心forum_*数据库。

验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

SQLite读写：无。源码：[app/forum/server/middleware/forum-markdown.ts](../../../app/forum/server/middleware/forum-markdown.ts)。验证入口：[app/forum/tests/forum-markdown.test.ts](../../../app/forum/tests/forum-markdown.test.ts)、[app/forum/tests/site-state.test.ts](../../../app/forum/tests/site-state.test.ts)、[app/forum/tests/content-source.test.ts](../../../app/forum/tests/content-source.test.ts)。

## 提供话题Markdown正文

`interface:forum.topic-markdown` · `GET,HEAD /t/:id.md` · `flow:forum.markdown.topic`

权限与资源：匿名GET/HEAD；路径按TOPIC_MARKDOWN匹配，不能二次解码冒充其他路由。

响应与错误：200 text/markdown UTF-8；未知话题404 text/plain；快照失败503。

数据与副作用：与索引同源：site内容/开发快照/示例种子；不包含浏览器新写内容或实时核心数据库帖子，构建静态输出与在线核心API分别取证。

验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

SQLite读写：无。源码：[app/forum/server/middleware/forum-markdown.ts](../../../app/forum/server/middleware/forum-markdown.ts)。验证入口：[app/forum/tests/forum-markdown.test.ts](../../../app/forum/tests/forum-markdown.test.ts)、[app/forum/tests/site-state.test.ts](../../../app/forum/tests/site-state.test.ts)。


## 比赛信息发布

五个比赛操作（#238）的请求字段、成功响应以及共同 `4xx` / `5xx` 错误体由 [competition-contract.ts](../../../app/server/src/lib/competition-contract.ts) 与所属路由 `contracts.ts` 实际挂载。公开 DTO 与控制台 DTO 分开，控制台仅多 `offline`；内部创建/更新时间、成员和权限信息不混入公开回答。既有其他端点仍按目录记录响应 Schema 缺口，不因此声称全站已是完整 OpenAPI。

| 操作与用例 | 权限与资源 | 成功、失败和副作用 |
|---|---|---|
| `GET /api/public/competitions` · `flow:competition.public.list` | 匿名，只返回未下线赛事 | 200 `{ competitions }`；五种时间状态与排序见 [API](../../architecture/API.md)「比赛信息发布合同」。不读取会话或成员、不写库、不发外部请求；空列表合法。 |
| `GET /api/console/competitions` · `flow:competition.console.list` | 有效 `sid` 与 `console.access`；页面导航仍需 `competitions.manage` | 200 `{ competitions }` 含 `offline`；401 未登录、403 缺能力。共同身份路径会读称号/部门与 GitHub 角色缓存；会话过期或令牌被拒才产生删除/审计等条件副作用。 |
| `POST /api/console/competitions` · `flow:competition.create` | `competitions.manage`，每分钟 30 次，固定本环境组织 | 201 `{ competition }`；400 `validation_error` / `bad_name` / `bad_url` / `bad_range` / `deadline_after_end`，401、403、429；比赛与 `competition.create` 审计在同一事务提交。 |
| `PATCH /api/console/competitions/:competition_id` · `flow:competition.update` | 同一管理能力，每分钟 60 次 | 200 `{ competition }`；在原记录与补丁合并后验证，缺记录 404，其他拒绝同新建。省略字段保留，null 清空可空字段；下线不删除，恢复沿用原 id。更新与审计同一事务。 |
| `DELETE /api/console/competitions/:competition_id` · `flow:competition.delete` | 同一管理能力，每分钟 30 次 | 200 `{ ok: true }`，真删；不存在或重复删除 404。删除与审计同一事务，审计失败返回 500 且保留赛事。 |

这些操作不实现参赛、队伍或通知邮件；报名与组队由下面 #239 的接口承担，比赛写入与报名设置共用同一张错误码表。写入与审计任何一步失败都回滚；GitHub 身份检查在事务前完成，不把网络等待放进 SQLite 事务。源码：[console/competitions.ts](../../../app/server/src/routes/console/competitions.ts)、[portal/competitions.ts](../../../app/server/src/routes/portal/competitions.ts)、[competition-store.ts](../../../app/server/src/lib/competition-store.ts)。验证入口：[真实路由与审计故障回归](../../../tests/server/competitions.test.ts)、[两尺寸浏览器业务回归](../../../tests/e2e/competitions.spec.mts)。

新增 `competitions.manage` 同时扩展 `POST /api/console/departments`、`PATCH /api/console/departments/:department_id`、`PATCH /api/console/titles/:title_id` 的权限包枚举。这三条在原有行为上补成功响应 Schema：部门保留 `created_at`、`updated_at`、`heads`、`crew_count` 与原有全部字段；称号保留显示字段及 `capabilities`。它们的授权、存储与审计执行逻辑不变，错误仍走原处理器。既有权限包不会因能力清单新增而自动获得管理比赛权限；有权限的管理者可通过原接口明确授予，回归见 `tests/server/competitions.test.ts`。

## 比赛报名、组队与积分（#239）

比赛、队伍、成员与积分的请求体、成功响应和共同 `4xx` / `5xx` 错误体由 [competition-contract.ts](../../../app/server/src/lib/competition-contract.ts) 与两个 `contracts.ts` 实际挂载；门户成员接口的响应是我的状态、队伍、找队友、我的参赛或天梯，控制台接口的响应是设置、名单、积分记录或 CSV。所有写操作「已开放报名且在报名中」才可执行，截止后整场只读；写操作在事务里重读状态再写，成功都回最新状态。规则只在 [competition-signup-store.ts](../../../app/server/src/lib/competition-signup-store.ts) 与 [competition-score-store.ts](../../../app/server/src/lib/competition-score-store.ts)，路由只做鉴权、限流与错误码映射。

| 方法与路径 | 谁 | 成功与副作用 |
|---|---|---|
| `GET /api/me/competitions` · `flow:competition.me.list` | 登录且是极客班成员 | 200 `{ items, pending_total }`：我报名的比赛与状态、队伍摘要、本人待处理数；只读，不写审计。 |
| `GET /api/competitions/:id/my-status` · `flow:competition.my_status` | 同上 | 200 我的状态：`settings`、`writable`、`signup`、`state`、`team`、`role`、`pending`、`stats`、`actions`；`actions` 只列此刻服务端会接受的操作。 |
| `POST /api/competitions/:id/signup` · `flow:competition.signup.upsert` | 同上，30 次/分钟 | 200 我的状态；重复报名幂等，保留 `created_at`，已取消的报名恢复为 `active`。 |
| `DELETE /api/competitions/:id/signup` · `flow:competition.signup.cancel` | 同上，30 次/分钟 | 200 我的状态；报名改 `cancelled`、队员退出、单人的队伍解散，本人待处理项关闭；已确认的队伍要先撤销确认。 |
| `GET /api/competitions/:id/teams` · `flow:competition.teams.list` | 同上 | 200 `{ teams }`：未解散队伍与在队成员；不含任何人的待处理项。 |
| `GET /api/competitions/:id/free-agents` · `flow:competition.free_agents.list` | 同上 | 200 `{ people }`：已报名、在找队伍且未入队的人与本人留言。 |
| `POST /api/competitions/:id/teams` · `flow:competition.team.create` | 同上，30 次/分钟 | 201 我的状态；建队人即领队，不隐式报名。 |
| `POST /api/teams/:id/apply` · `flow:competition.team.apply` | 同上，30 次/分钟 | 201 我的状态；写一条 `applied` 成员关系。 |
| `POST /api/teams/:id/invite` · `flow:competition.team.invite` | 领队，30 次/分钟 | 201 我的状态；被邀请人须已报名、未入队且账号 active。 |
| `POST /api/teams/:id/respond` · `flow:competition.team.respond` | 领队或当事人，30 次/分钟 | 200 我的状态；`accept`、`decline`、`withdraw`，成员关系必须属于路径上的队伍。 |
| `POST /api/teams/:id/leave` · `flow:competition.team.leave` | 队员，30 次/分钟 | 200 我的状态；领队不能直接退出。 |
| `POST /api/teams/:id/transfer` · `flow:competition.team.transfer` | 领队，30 次/分钟 | 200 我的状态；同一事务改队伍领队与两条成员关系的角色。 |
| `DELETE /api/teams/:id` · `flow:competition.team.disband` | 领队，30 次/分钟 | 200 我的状态；队伍与成员记录只改状态。 |
| `POST /api/teams/:id/lock`、`DELETE /api/teams/:id/lock` · `flow:competition.team.lock`、`flow:competition.team.unlock` | 领队，30 次/分钟 | 200 我的状态；确认参赛关闭本队其余待处理项，撤销确认回到招募中。 |
| `GET /api/competitions/:id/leaderboard` · `flow:competition.leaderboard.read` | 登录且是极客班成员 | 200 `{ updated_at, individuals, teams }`；没有开启积分 409 `scoring_not_enabled`。 |
| `GET /api/public/competitions/:id` · `flow:competition.public.detail` | 匿名 | 200 单场公开信息与报名摘要；只在成功响应上放开 `Access-Control-Allow-Origin: *`，下线与不存在都 404。 |
| `PUT /api/console/competitions/:competition_id/signup-settings` · `flow:competition.signup_settings.update` | `competitions.manage`，30 次/分钟 | 200 `{ settings }`；写 `competition.signup_settings.update` 审计，与写入同一事务。 |
| `GET /api/console/competitions/:competition_id/roster` · `flow:competition.roster.read` | 同上 | 200 `{ settings, stats, signups, teams }`；报名含已取消的，队伍含已解散的。 |
| `GET /api/console/competitions/:competition_id/roster.csv` · `flow:competition.roster.export` | 同上，5 次/分钟 | 200 `text/csv`（BOM、CRLF、北京时间列），写 `competition.roster.export` 审计（`details { rows }`）。 |
| `GET`、`POST /api/console/competitions/:competition_id/score-events` · `flow:competition.score_events.list`、`flow:competition.score_events.create` | 同上，写 30 次/分钟 | 200 `{ events }`；201 `{ event }`，写 `competition.score.add` 审计。 |
| `POST /api/console/competitions/:competition_id/score-events/:event_id/revoke` · `flow:competition.score_events.revoke` | 同上，30 次/分钟 | 200 `{ event }`；只改状态并记撤销人与原因，写 `competition.score.revoke` 审计。 |

错误的形状与其它接口一致（`{ error, message }`）。状态冲突一律 409，输入不合法才 400：

| 状态码 | `error` | 场景 |
|---|---|---|
| 400 | `bad_note`、`bad_team_name`、`bad_slogan`、`bad_message`、`bad_team_size`、`bad_repo`、`bad_number`、`bad_points` | 备注、队名、口号、留言、人数、仓库、编号或分值不合法 |
| 401 | `not_signed_in` | 没有会话 |
| 403 | `not_member`、`not_team_leader` | 不是极客班成员；不是本队领队 |
| 404 | `not_found`、`team_not_found` | 比赛不存在或下线、队伍不存在或已解散、成员关系不属于路径上的队伍 |
| 409 | `signup_not_enabled`、`signup_closed` | 未开放报名；不在报名中（截止后整场只读） |
| 409 | `not_signed_up`、`individual_competition`、`already_in_team` | 未报名；个人赛不能组队；已在队 |
| 409 | `already_applied`、`already_invited`、`invitee_not_signed_up`、`target_not_member` | 已有待处理关系；对方未报名；对方账号已停用或已不是成员 |
| 409 | `team_full`、`team_too_small`、`team_locked`、`duplicate_team_name`、`is_team_leader`、`invalid_state` | 满员；人数不够确认；队伍已确认；队名重复；领队要先转让或解散；申请或邀请已处理 |
| 409 | `deadline_required`、`has_signups`、`kind_locked`、`team_size_conflict` | 控制台：开报名缺截止时间；有报名后改形式或删比赛；有报名后改内外部；新人数与现有队伍冲突 |
| 409 | `scoring_not_enabled`、`duplicate_score_event`、`already_revoked` | 没有开启积分；同一条 Issue/PR 已记分；这条积分已撤销 |
| 429 | `rate_limited` | 成员写操作超 30 次/分钟，或名单导出超 5 次/分钟 |

验证入口：[报名、组队与名单](../../../tests/server/competition-signups.test.ts)、[积分与天梯](../../../tests/server/competition-scores.test.ts)、[旧库重启与种子](../../../tests/server/legacy-database.test.ts)。

