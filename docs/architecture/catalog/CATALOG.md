# 项目目录

> 应用、运行单元、业务域与源码证据的统一入口；不表示线上部署状态。

状态：`current` · 更新：2026-10-23 · 自动生成，不手工编辑。

来源摘要：`cfc0b47b915904baa83d88a8cfa0e4e37b93c018b689d2e7308b2090c02f3fe4`。更新日期指目录声明版本，数据新鲜度由摘要和 `pnpm check:catalog` 核对。

[使用与维护](README.md) · [总览](CATALOG.md) · [接口](routes.md) · [数据](data-model.md) · [权限](permissions.md) · [机器目录](catalog.json)

## 基线

- 4 个源码应用，3 个运行单元。
- 200 个已注册方法与路径，其中业务操作 115 个，自动 HEAD 56 个。
- 54 张应用表，22 个能力，121 条显式业务流程。
- 响应 Schema：67/200。缺失不等于没有响应；不冒充完整 OpenAPI。

业务流程关联：115/115 个业务操作；5/5 个补充入口。遗漏关联时生成失败。逐接口响应和错误说明见[接口行为契约](../../services/server/endpoint-contracts.md)。

## 应用与运行单元

| 应用 | 代码 | 包 | 运行单元 | 合同 |
|---|---|---|---|---|
| 官网 | `app/web` | `@yzgc/web` | `web` | [docs/services/web/README.md](../../../docs/services/web/README.md) |
| 控制台 | `app/console` | `@yzgc/console` | `web` | [docs/services/console/README.md](../../../docs/services/console/README.md) |
| 核心后端 | `app/server` | `@yzgc/server` | `server` | [docs/services/server/README.md](../../../docs/services/server/README.md) |
| 论坛 | `app/forum` | `tuff-forum` | `forum` | [docs/services/forum/README.md](../../../docs/services/forum/README.md) |

运行单元从两套 compose 核对；控制台是独立源码应用，但产物随 web 镜像交付。

## 业务域

| 业务 | 接口注册 | 数据表 | 业务说明 |
|---|---:|---|---|
| 身份与会话 | 43 | `sessions`、`users`、`identities`、`identity_audit`、`device_grants`、`invite_codes`、`email_challenges`、`oauth_clients`、`oauth_subjects`、`oauth_grants`、`oidc_payloads`、`account_profiles`、`account_avatars` | [docs/architecture/SECURITY.md](../../../docs/architecture/SECURITY.md) · [docs/plan/UNIFIED-LOGIN.md](../../../docs/plan/UNIFIED-LOGIN.md) · [docs/services/server/oidc.md](../../../docs/services/server/oidc.md) |
| 组织与权限 | 21 | `departments`、`titles`、`role_assignments`、`console_seeds` | [docs/services/console/README.md](../../../docs/services/console/README.md) · [docs/architecture/SECURITY.md](../../../docs/architecture/SECURITY.md) |
| 权限 | 0 | `perm_nodes`、`perm_groups`、`perm_group_parents`、`perm_entries`、`perm_members`、`perm_state` | [docs/architecture/SECURITY.md](../../../docs/architecture/SECURITY.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) |
| 招新投递 | 8 | `applications`、`application_reviews`、`application_limits` | [docs/architecture/API.md](../../../docs/architecture/API.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) · [docs/ops/USAGE.md](../../../docs/ops/USAGE.md) |
| 意见反馈 | 9 | `feedback` | [docs/architecture/API.md](../../../docs/architecture/API.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) |
| 组织邀请 | 3 | `invite_links`、`invite_attempts`、`invitations` | [docs/architecture/API.md](../../../docs/architecture/API.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) |
| GitHub 组织代理 | 0 | 无本地表 | [docs/services/console/README.md](../../../docs/services/console/README.md) · [docs/architecture/API.md](../../../docs/architecture/API.md) |
| GitLab 账号同步 | 12 | `gitlab_accounts` | [docs/services/server/oidc.md](../../../docs/services/server/oidc.md) · [docs/decisions/0005-sso-extend-core-server.md](../../../docs/decisions/0005-sso-extend-core-server.md) |
| 论坛交流 | 21 | `forum_counters`、`forum_avatars`、`forum_users`、`forum_tags`、`forum_topics`、`forum_posts`、`forum_likes`、`forum_bookmarks`、`forum_follows`、`forum_notifications`、`forum_topic_views`、`forum_rate_events` | [docs/services/forum/README.md](../../../docs/services/forum/README.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) |
| 通知邮件 | 0 | `mail_outbox` | [docs/services/server/mail.md](../../../docs/services/server/mail.md) |
| 审计 | 2 | `audit_logs`、`activity_events` | [docs/architecture/SECURITY.md](../../../docs/architecture/SECURITY.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) |
| 公开文档 | 4 | 无本地表 | [docs/conventions/DOCUMENTATION.md](../../../docs/conventions/DOCUMENTATION.md) · [docs/architecture/API.md](../../../docs/architecture/API.md) |
| 基础设施与兼容入口 | 38 | `app_state`、`limit_events` | [docs/architecture/ARCHITECTURE.md](../../../docs/architecture/ARCHITECTURE.md) · [docs/services/server/README.md](../../../docs/services/server/README.md) · [docs/conventions/ARCHITECTURE-ALIGNMENT.md](../../../docs/conventions/ARCHITECTURE-ALIGNMENT.md) |
| 比赛信息、报名组队与积分 | 39 | `competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`competition_score_events` | [docs/architecture/API.md](../../../docs/architecture/API.md) · [docs/services/server/README.md](../../../docs/services/server/README.md) · [docs/services/server/data-model.md](../../../docs/services/server/data-model.md) · [docs/services/server/endpoint-contracts.md](../../../docs/services/server/endpoint-contracts.md) · [docs/services/console/README.md](../../../docs/services/console/README.md) · [docs/services/web/portal.md](../../../docs/services/web/portal.md) · [docs/plan/COMPETITION-APP.md](../../../docs/plan/COMPETITION-APP.md) |

## 业务流程

### 取消投递

标识：`flow:application.cancel`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/applications/:application_id`
- 能力：`applications.review`
- 读取：`applications`、`application_reviews`
- 写入：`applications`、`application_reviews`、`audit_logs`
- 不入队：`mail_outbox`
- 取消保留简历并追加审核历史；需要 applications.review。
- 修改状态必须带 expected_status 与 expected_review_id；版本冲突拒绝写入。
- 取消不生成通知邮件；已经排队或发出的其他邮件不撤回。

源码：[app/server/src/routes/console/applications.ts:121](../../../app/server/src/routes/console/applications.ts#L121) · [app/server/src/routes/console/applications.ts:138](../../../app/server/src/routes/console/applications.ts#L138) · [app/server/src/routes/console/applications.ts:152](../../../app/server/src/routes/console/applications.ts#L152) · [app/server/src/routes/console/applications.ts:170](../../../app/server/src/routes/console/applications.ts#L170)

测试入口：[tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts) · [tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/legacy-database.test.ts](../../../tests/server/legacy-database.test.ts)。生成器未执行这些测试。

### 发起 GitHub 登录

标识：`flow:identity.authorize`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/github`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名可发起；return_to仅接受PUBLIC_ORIGIN，否则回控制台。
- 响应与错误：302跳到GitHub授权地址。
- 数据与副作用：生成随机state并写签名oauth_state cookie，不创建会话；本次响应不向GitHub发送token交换请求。

源码：[app/server/src/routes/admin/auth.ts:36](../../../app/server/src/routes/admin/auth.ts#L36) · [app/server/src/middleware/oauth-state.ts:29](../../../app/server/src/middleware/oauth-state.ts#L29)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 列出本站启用的登录方式

标识：`flow:identity.providers`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/providers`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名可读，不读会话、不需要能力。
- 响应与错误：200 {providers:[...]}，每项含id、name、kind、start、can_register，邮箱另有password；按GitHub、Google、邮箱的顺序，Google只在配了GOOGLE_CLIENT_ID与GOOGLE_CLIENT_SECRET时出现，邮箱只在发信已配置时出现；响应Schema固定字段。
- 数据与副作用：按配置算出固定列表，不读写数据库、不请求GitHub。

源码：[app/server/src/routes/identity/providers.ts:30](../../../app/server/src/routes/identity/providers.ts#L30) · [app/server/src/routes/identity/contracts.ts:101](../../../app/server/src/routes/identity/contracts.ts#L101) · [app/server/src/routes/identity/index.ts:11](../../../app/server/src/routes/identity/index.ts#L11) · [app/console/src/pages/SignIn.vue:226](../../../app/console/src/pages/SignIn.vue#L226) · [app/console/src/lib/signin.ts:88](../../../app/console/src/lib/signin.ts#L88) · [app/console/src/mock/index.ts:12](../../../app/console/src/mock/index.ts#L12)

测试入口：[tests/server/identity.test.ts](../../../tests/server/identity.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 命令行申请设备授权码（RFC 8628）

标识：`flow:identity.device.code`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/device/code`
- 能力：
- 读取：
- 写入：`device_grants`
- 不入队：
- 权限与资源：匿名；只有登记过的公开客户端 geek-cli 能发码，scope 只认 openid、profile；每分钟 10 次。
- 响应与错误：200 {device_code,user_code(XXXX-XXXX),verification_uri=<PUBLIC_ORIGIN>/device,verification_uri_complete,expires_in=600,interval=5}，Cache-Control no-store；未登记客户端 400 invalid_client，未知 scope 400 invalid_scope。
- 数据与副作用：写一行 pending 的 device_grants，device_code 只存 sha256；顺手删掉过期超过一天且令牌已失效的旧行；不读会话、不请求 GitHub。

源码：[app/server/src/routes/identity/device.ts:34](../../../app/server/src/routes/identity/device.ts#L34) · [app/server/src/routes/identity/contracts.ts:106](../../../app/server/src/routes/identity/contracts.ts#L106) · [app/server/src/lib/device-store.ts:103](../../../app/server/src/lib/device-store.ts#L103)

测试入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。生成器未执行这些测试。

### 命令行轮询设备授权，批准后换一次性访问令牌

标识：`flow:identity.device.token`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/device/token`
- 能力：
- 读取：`device_grants`、`users`、`identities`
- 写入：`device_grants`
- 不入队：
- 权限与资源：匿名，凭 device_code 与发码时相同的 client_id；每分钟 60 次。
- 响应与错误：按 RFC 8628 §3.5 回 400 authorization_pending、slow_down（轮询间隔加 5 秒写回）、access_denied（用户拒绝或账号不是 active）、expired_token、invalid_grant（不存在或已换过令牌）、invalid_client、unsupported_grant_type；批准后 200 {access_token(gk_…),token_type:Bearer,expires_in=2592000,scope,account_id}，Cache-Control no-store。
- 数据与副作用：在 BEGIN IMMEDIATE 事务里判定并改状态；令牌只发一次，库里只存 sha256 与到期时间，明文只在这次响应里。

源码：[app/server/src/routes/identity/device.ts:58](../../../app/server/src/routes/identity/device.ts#L58) · [app/server/src/routes/identity/contracts.ts:111](../../../app/server/src/routes/identity/contracts.ts#L111) · [app/server/src/lib/device-store.ts:103](../../../app/server/src/lib/device-store.ts#L103)

测试入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。生成器未执行这些测试。

### 确认页按 user_code 读一次设备授权

标识：`flow:identity.device.view`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/identity/device`
- 能力：
- 读取：`device_grants`
- 写入：
- 不入队：
- 权限与资源：要极客班会话（requireAuth），不要控制台能力；每分钟 30 次，挂不上穷举 user_code。
- 响应与错误：200 {user_code,client_id,client_name,scope,status(pending|approved|denied|consumed|expired),expires_at}；user_code 不合法或不存在 404 device_code_not_found；没登录 401。
- 数据与副作用：只读，不改状态、不续期；不返回 device_code 与令牌。

源码：[app/server/src/routes/identity/device.ts:92](../../../app/server/src/routes/identity/device.ts#L92) · [app/server/src/routes/identity/contracts.ts:116](../../../app/server/src/routes/identity/contracts.ts#L116) · [app/server/src/lib/device-store.ts:103](../../../app/server/src/lib/device-store.ts#L103) · [app/console/src/pages/Device.vue:62](../../../app/console/src/pages/Device.vue#L62) · [app/console/src/lib/device.ts:19](../../../app/console/src/lib/device.ts#L19)

测试入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts) · [tests/console/device.test.ts](../../../tests/console/device.test.ts)。生成器未执行这些测试。

### 登录的人允许或拒绝一次设备授权

标识：`flow:identity.device.approve`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/identity/device/approve`
- 能力：
- 读取：`device_grants`
- 写入：`device_grants`、`audit_logs`
- 不入队：
- 权限与资源：要极客班会话；授权绑定到会话的 account_id（不是 GitHub id）；每分钟 20 次。
- 响应与错误：200 {ok:true,status:approved|denied}；不存在 404 device_code_not_found；不是 pending 或已过期 409 device_code_not_pending；decision 不合法 400；允许时账号还没有登录邮箱（这个环境能发信）403 email_required，拒绝不拦（#273）。
- 数据与副作用：条件 UPDATE 只改 pending 且未过期的行，并发的确认只有一次生效；写 audit_logs identity.device.approve 或 identity.device.deny，只含 client_id 与 scope，不含 device_code 与令牌。

源码：[app/server/src/routes/identity/device.ts:103](../../../app/server/src/routes/identity/device.ts#L103) · [app/server/src/routes/identity/contracts.ts:120](../../../app/server/src/routes/identity/contracts.ts#L120) · [app/server/src/lib/device-store.ts:103](../../../app/server/src/lib/device-store.ts#L103) · [app/console/src/pages/Device.vue:171](../../../app/console/src/pages/Device.vue#L171) · [app/server/src/routes/identity/device.ts:111](../../../app/server/src/routes/identity/device.ts#L111)

测试入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts) · [tests/console/device.test.ts](../../../tests/console/device.test.ts)。生成器未执行这些测试。

### 命令行凭设备令牌读极客班账号（OpenID）

标识：`flow:identity.device.userinfo`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/device/userinfo`
- 能力：
- 读取：`device_grants`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：Bearer 令牌（geek login 换到的 gk_…），不读 cookie。
- 响应与错误：200 {sub=account_id,account_id,login,avatar_url,scope}；令牌缺失、不存在、过期或账号不是 active 时 401 invalid_token，并带 WWW-Authenticate: Bearer error="invalid_token"。
- 数据与副作用：只读；按令牌的 sha256 查行，不记录令牌明文。

源码：[app/server/src/routes/identity/device.ts:130](../../../app/server/src/routes/identity/device.ts#L130) · [app/server/src/routes/identity/contracts.ts:125](../../../app/server/src/routes/identity/contracts.ts#L125) · [app/server/src/lib/device-store.ts:103](../../../app/server/src/lib/device-store.ts#L103)

测试入口：[tests/server/device-flow.test.ts](../../../tests/server/device-flow.test.ts)。生成器未执行这些测试。

### 校验登录回调，在一个事务里建号或找到账号并建立统一会话

标识：`flow:identity.callback`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/callback`
- 能力：
- 读取：`identities`、`users`
- 写入：`sessions`、`audit_logs`、`users`、`identities`、`identity_audit`、`role_assignments`、`forum_users`
- 不入队：
- 权限与资源：state与签名cookie必须相符且未过期；按GitHub数字id匹配身份，不用会变的登录名。这个GitHub id已有账号且站内记过角色的由站内决定（停用、不是成员拒绝），不查GitHub组织；新用户和还没记过站内角色的老账号要是CONSOLE_ORG active成员才成功：新用户记为成员（站内一位管理员都没有时owner记为管理员），老账号按查到的组织角色补记（users.org_role，owner记为管理员）（#262 第四期）。
- 响应与错误：成功302回return_to；账号还没有登录邮箱、这个环境又能发信时改为302到/bind-email?return_to=<原路径>（#273）；取消/上游失败/非成员/账号停用一律302到统一登录页/signin，带signin结果（cancelled、failed、not_member或invite_pending、account_disabled）与原来的return_to路径（#262）；合并链超过8跳、成环或事务失败按failed；缺参数或无效state为400，旧forum-state为410。
- 数据与副作用：外部请求在事务外做完；建号、刷新身份、沿merged_into走到终点、按GitHub id认领称号与论坛用户、写sessions（含openid、provider）、删请求带来的旧会话、写identity_audit与auth.signin在一个BEGIN IMMEDIATE事务里，失败整体回滚、旧会话照常有效。非成员与停用账号不建会话、审计拒绝并尽力撤销授权；被组织拒绝的GitHub id已经有还没记过站内角色的老账号时，把它的成员资格记成not_member或pending（#262审查）；站内记过角色的账号不受GitHub组织变动影响；失败日志不输出token。

源码：[app/server/src/routes/admin/auth.ts:43](../../../app/server/src/routes/admin/auth.ts#L43) · [app/server/src/lib/auth.ts:50](../../../app/server/src/lib/auth.ts#L50) · [app/server/src/lib/identity-store.ts:220](../../../app/server/src/lib/identity-store.ts#L220) · [app/server/src/lib/db.ts:860](../../../app/server/src/lib/db.ts#L860) · [app/server/src/lib/email-gate.ts:13](../../../app/server/src/lib/email-gate.ts#L13) · [app/server/src/routes/admin/auth.ts:85](../../../app/server/src/routes/admin/auth.ts#L85)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts) · [tests/server/identity.test.ts](../../../tests/server/identity.test.ts) · [tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。生成器未执行这些测试。

### 退出当前会话

标识：`flow:identity.signout`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/signout`
- 能力：
- 读取：`sessions`
- 写入：`sessions`、`audit_logs`、`identity_audit`
- 不入队：
- 权限与资源：仅销毁cookie sid对应本站会话；允许没有会话的幂等退出，仍受共同写请求Origin校验。
- 响应与错误：200 {ok:true}；不向调用者泄露sid是否存在。
- 数据与副作用：清sid和旧forum_sid cookie；实际读取到会话才写auth.signout（带actor_account_id）和本人的identity_audit退出记录，不撤销GitHub授权。

源码：[app/server/src/routes/admin/auth.ts:89](../../../app/server/src/routes/admin/auth.ts#L89) · [app/server/src/lib/identity-store.ts:281](../../../app/server/src/lib/identity-store.ts#L281)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts) · [tests/server/session-cleanup.test.ts](../../../tests/server/session-cleanup.test.ts) · [tests/server/identity.test.ts](../../../tests/server/identity.test.ts)。生成器未执行这些测试。

### 读取统一登录状态与控制台入口

标识：`flow:identity.current`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/me`
- 能力：
- 读取：`sessions`、`role_assignments`、`departments`、`titles`、`users`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：只返回当前sid的身份；console_link是显示提示，不赋予后端权限。
- 响应与错误：200 {signed_in:false}或身份字段（login、user_id、avatar_url、account_id、provider）及console_link、email_required（账号还没有登录邮箱、这个环境又能发信；官网、论坛、控制台读到true整页跳到/bind-email，#273）；GitHub拒绝token时200 {signed_in:false,session_expired:true}，其他角色查询失败仍保持登录但入口false。
- 数据与副作用：会话联查账号，过期、没有账号（启动回填映射不到的旧会话）或账号不是active的会话按未登录处理并删除；按账号记下的站内角色和称号算权限（还没记过站内角色的老账号用GitHub会话第一次请求时查一次GitHub组织角色并记下），被拒token才删会话并写审计；无其他业务写入。

源码：[app/server/src/routes/admin/auth.ts:110](../../../app/server/src/routes/admin/auth.ts#L110) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/lib/auth.ts:63](../../../app/server/src/lib/auth.ts#L63) · [app/server/src/lib/db.ts:699](../../../app/server/src/lib/db.ts#L699) · [app/console/src/lib/runtime.ts:50](../../../app/console/src/lib/runtime.ts#L50) · [app/console/src/lib/errors.ts:30](../../../app/console/src/lib/errors.ts#L30) · [app/console/src/router.ts:16](../../../app/console/src/router.ts#L16) · [app/web/sites/portal/lib/account.ts:19](../../../app/web/sites/portal/lib/account.ts#L19) · [app/web/sites/portal/components/os/YugcOs.tsx:39](../../../app/web/sites/portal/components/os/YugcOs.tsx#L39) · [app/forum/app/composables/useSiteLinks.ts:17](../../../app/forum/app/composables/useSiteLinks.ts#L17) · [app/forum/app/components/ForumHeader.vue:131](../../../app/forum/app/components/ForumHeader.vue#L131) · [app/forum/app/components/LoginModal.vue:8](../../../app/forum/app/components/LoginModal.vue#L8) · [app/forum/app/components/SignInState.vue:26](../../../app/forum/app/components/SignInState.vue#L26) · [app/forum/app/composables/useSiteAccount.ts:13](../../../app/forum/app/composables/useSiteAccount.ts#L13) · [app/forum/app/data/access.ts:86](../../../app/forum/app/data/access.ts#L86) · [app/forum/app/pages/about.vue:49](../../../app/forum/app/pages/about.vue#L49) · [app/forum/app/pages/new.vue:31](../../../app/forum/app/pages/new.vue#L31) · [app/forum/shared/signin-outcomes.ts:2](../../../app/forum/shared/signin-outcomes.ts#L2) · [app/forum/shared/site-notice.ts:9](../../../app/forum/shared/site-notice.ts#L9) · [app/forum/app/components/AdoptionNotice.vue:41](../../../app/forum/app/components/AdoptionNotice.vue#L41) · [app/server/src/lib/email-gate.ts:8](../../../app/server/src/lib/email-gate.ts#L8) · [app/web/sites/portal/lib/account.ts:56](../../../app/web/sites/portal/lib/account.ts#L56) · [app/forum/shared/site-account.ts:27](../../../app/forum/shared/site-account.ts#L27) · [app/forum/app/composables/useSiteAccount.ts:45](../../../app/forum/app/composables/useSiteAccount.ts#L45) · [app/console/src/pages/Device.vue:109](../../../app/console/src/pages/Device.vue#L109)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts) · [tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/identity.test.ts](../../../tests/server/identity.test.ts) · [tests/server/legacy-database.test.ts](../../../tests/server/legacy-database.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts) · [tests/web/portal-phone.test.tsx](../../../tests/web/portal-phone.test.tsx) · [tests/e2e/workflows.spec.ts](../../../tests/e2e/workflows.spec.ts) · [tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/web/portal-os.test.ts](../../../tests/web/portal-os.test.ts) · [tests/web/portal-account.test.tsx](../../../tests/web/portal-account.test.tsx) · [app/forum/tests/site-account.test.ts](../../../app/forum/tests/site-account.test.ts) · [tests/console/device.test.ts](../../../tests/console/device.test.ts)。生成器未执行这些测试。

### 发邮箱登录验证码

标识：`flow:identity.email.start`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/email/start`
- 能力：
- 读取：`email_challenges`
- 写入：`email_challenges`
- 不入队：`mail_outbox`
- 权限与资源：匿名；每分钟 10 次（按 IP），同一邮箱 60 秒一封、每小时 5 封，同一 IP 前缀（IPv6 按 /64）每小时 20 封。
- 响应与错误：202 {resend_after:60} 并写签名、HttpOnly 的 email_challenge cookie（path=/auth/email，10 分钟）；邮箱有没有账号响应都一样；body 可带 purpose=reset（忘了密码，#273），只换成重设密码的信，挑战还是登录用的那一种；格式不对 400 bad_email；太频繁 429 rate_limited，带 Retry-After 与 retry_after 秒数。
- 数据与副作用：写一行 email_challenges，只存验证码 HMAC，这个浏览器上一次的发码作废（别人替这个邮箱要码不影响本人手上的验证码）；验证码由 mail.sendNow 直接发（Aliyun 或 Resend，受 MAIL_RECIPIENTS 与白名单约束），不进 mail_outbox，日志不记地址和验证码。

源码：[app/server/src/routes/identity/email.ts:78](../../../app/server/src/routes/identity/email.ts#L78) · [app/server/src/routes/identity/contracts.ts:129](../../../app/server/src/routes/identity/contracts.ts#L129) · [app/server/src/lib/email-login.ts:70](../../../app/server/src/lib/email-login.ts#L70) · [app/server/src/lib/mail/mailer.ts:93](../../../app/server/src/lib/mail/mailer.ts#L93) · [app/server/src/lib/mail/login-code.ts:9](../../../app/server/src/lib/mail/login-code.ts#L9) · [app/server/src/lib/mail/login-code.ts:7](../../../app/server/src/lib/mail/login-code.ts#L7) · [app/console/src/lib/signin.ts:156](../../../app/console/src/lib/signin.ts#L156)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 核对邮箱验证码后登录，没有账号时凭邀请码注册

标识：`flow:identity.email.verify`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/email/verify`
- 能力：
- 读取：`email_challenges`、`identities`、`users`、`invite_codes`
- 写入：`email_challenges`、`users`、`identities`、`invite_codes`、`sessions`、`identity_audit`、`audit_logs`
- 不入队：
- 权限与资源：匿名，凭 email_challenge cookie 与 6 位验证码；每分钟 30 次；验证码 10 分钟有效、最多试 5 次。
- 响应与错误：200 {return_to,registered} 并写 sid；验证码不对 400 invalid_code（带 attempts_left），失效 400 code_expired；邮箱没有账号且没填邀请码 400 invite_required（验证码不作废），邀请码无效 400 invalid_invite 并记一次失败；账号停用 403 account_disabled，不再是成员 403 not_member。
- 数据与副作用：在一个 BEGIN IMMEDIATE 事务里找身份或建号（兑换邀请码、建 users 与 email 身份、记 invite_code_id、org_state=active）、作废验证码、建会话（provider=email，GitHub 令牌为空）、写 identity_audit 与 auth.register/auth.signin；任何一步失败整体回滚，邀请码次数不扣。

源码：[app/server/src/routes/identity/email.ts:93](../../../app/server/src/routes/identity/email.ts#L93) · [app/server/src/routes/identity/contracts.ts:134](../../../app/server/src/routes/identity/contracts.ts#L134) · [app/server/src/lib/identity-store.ts:382](../../../app/server/src/lib/identity-store.ts#L382) · [app/server/src/lib/invite-codes.ts:41](../../../app/server/src/lib/invite-codes.ts#L41)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 邮箱加密码登录

标识：`flow:identity.email.password`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/email/password`
- 能力：
- 读取：`identities`、`users`
- 写入：`sessions`、`identity_audit`、`audit_logs`
- 不入队：
- 权限与资源：匿名；每分钟 10 次（按 IP），另按邮箱 15 分钟 10 次；只认已绑定邮箱且设过密码的账号。
- 响应与错误：200 {return_to} 并写 sid；没账号、没设密码、密码不对一律 400 invalid_credentials，没账号时也算一次 bcrypt，响应时间不随邮箱是否注册变化；账号停用 403 account_disabled，不再是成员 403 not_member。
- 数据与副作用：不能注册新账号；成功时建会话（provider=email）、写 identity_audit 与 auth.signin（method=password）；密码只存 bcrypt 哈希（cost 12）。

源码：[app/server/src/routes/identity/email.ts:126](../../../app/server/src/routes/identity/email.ts#L126) · [app/server/src/routes/identity/contracts.ts:139](../../../app/server/src/routes/identity/contracts.ts#L139) · [app/server/src/lib/identity-store.ts:386](../../../app/server/src/lib/identity-store.ts#L386) · [app/server/src/lib/password-policy.ts:18](../../../app/server/src/lib/password-policy.ts#L18)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 忘了密码用邮箱验证码重设并登录

标识：`flow:identity.email.reset`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /auth/email/reset`
- 能力：
- 读取：`email_challenges`、`identities`、`users`
- 写入：`email_challenges`、`users`、`sessions`、`identity_audit`、`audit_logs`
- 不入队：
- 权限与资源：匿名，凭 /auth/email/start 发的挑战 cookie（path=/auth/email）；每分钟 10 次（按 IP），同一个码最多错 5 次；只给已有账号的邮箱，不注册（#273，所有者 2026-10-23 19:22）。
- 响应与错误：200 {return_to} 并写 sid（provider=email）；先查新密码，不到 8 位 400 password_too_short、超过 72 字节 400 password_exceeds_bcrypt_limit，这时不碰验证码；验证码不对 400 invalid_code（带 attempts_left），失效 400 code_expired；邮箱没有账号时和验证码登录一样 400 invite_required（不注册，验证码不作废，登录页转到「注册」）；停用 403 account_disabled，不是成员 403 not_member。
- 数据与副作用：占用验证码、建会话、删旧会话、写 users.password_hash（bcrypt cost 12）、identity_audit（login 与 password_reset）、auth.signin（method=reset）与 account.password（action=reset）在一个 BEGIN IMMEDIATE 事务里；成功后这个邮箱的密码错误计数清零。

源码：[app/server/src/routes/identity/email.ts:147](../../../app/server/src/routes/identity/email.ts#L147) · [app/server/src/routes/identity/contracts.ts:144](../../../app/server/src/routes/identity/contracts.ts#L144) · [app/server/src/lib/identity-store.ts:430](../../../app/server/src/lib/identity-store.ts#L430) · [app/console/src/lib/signin.ts:163](../../../app/console/src/lib/signin.ts#L163) · [app/console/src/pages/SignIn.vue:200](../../../app/console/src/pages/SignIn.vue#L200)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 跳转 Google 登录

标识：`flow:identity.google.start`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/google`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名；每分钟 20 次（按 IP）；没配 GOOGLE_CLIENT_ID 与 GOOGLE_CLIENT_SECRET 时 404 provider_not_enabled，登录页也不出现 Google。
- 响应与错误：302 到 Google 授权页（scope openid email profile，prompt=select_account，PKCE S256、state、nonce）；return_to 只接受本站。
- 数据与副作用：state、nonce、PKCE verifier 与可选的邀请码存进签名 cookie google_oauth_state（path=/auth/google），不读写数据库。

源码：[app/server/src/routes/identity/google.ts:21](../../../app/server/src/routes/identity/google.ts#L21) · [app/server/src/routes/identity/contracts.ts:150](../../../app/server/src/routes/identity/contracts.ts#L150) · [app/server/src/lib/google.ts:35](../../../app/server/src/lib/google.ts#L35)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 校验 Google 回调后登录，没有账号时凭邀请码注册

标识：`flow:identity.google.callback`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /auth/google/callback`
- 能力：
- 读取：`identities`、`users`、`invite_codes`
- 写入：`users`、`identities`、`invite_codes`、`sessions`、`identity_audit`、`audit_logs`
- 不入队：
- 权限与资源：每分钟 10 次（按 IP）；state 与签名 cookie 必须相符；ID Token 用 Google JWKS 验签（RS256），核对 iss、aud、exp、nonce，按 Google sub 认人，不按邮箱合并账号。
- 响应与错误：成功 302 回 return_to，账号还没有登录邮箱（Google 给的邮箱不算）、这个环境又能发信时改为 302 到 /bind-email?return_to=<原路径>（#273）；取消、上游失败、没有账号且没带邀请码、邀请码无效、Google 邮箱已属于别的账号、账号停用或不再是成员时 302 到 /signin?signin=<原因>&provider=google；缺参数 400，state 无效 400。
- 数据与副作用：外部请求在事务外；建号、兑换邀请码、建会话（provider=google）、写 identity_audit 与 auth.register/auth.signin 在一个 BEGIN IMMEDIATE 事务里，失败整体回滚；失败日志不输出令牌。

源码：[app/server/src/routes/identity/google.ts:32](../../../app/server/src/routes/identity/google.ts#L32) · [app/server/src/routes/identity/contracts.ts:152](../../../app/server/src/routes/identity/contracts.ts#L152) · [app/server/src/lib/identity-store.ts:390](../../../app/server/src/lib/identity-store.ts#L390) · [app/server/src/lib/safe-return.ts:25](../../../app/server/src/lib/safe-return.ts#L25) · [app/server/src/routes/identity/google.ts:61](../../../app/server/src/routes/identity/google.ts#L61)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。生成器未执行这些测试。

### 账号页：看自己的登录方式、密码、成员资格与账号记录

标识：`flow:identity.account.view`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/identity/me`
- 能力：
- 读取：`sessions`、`users`、`identities`、`identity_audit`
- 写入：`sessions`
- 不入队：
- 权限与资源：任何有效会话，不要控制台能力。
- 响应与错误：200 {account_id,login,identities(邮箱只给打码后的样子，另带身份 id 与 primary，主邮箱在前，#272),has_password,password_updated_at,membership{state,org_role,via_invite},created_at,recent(最近 20 条本人记录),available(还不到 5 个邮箱时是 ["email"]),email_required(#273，账号还没有登录邮箱、这个环境又能发信),session{provider,created_at,expires_at,step_up_until}}；没登录 401。
- 数据与副作用：只读；过期会话照共同规则删除。

源码：[app/server/src/routes/identity/account.ts:36](../../../app/server/src/routes/identity/account.ts#L36) · [app/server/src/routes/identity/contracts.ts:153](../../../app/server/src/routes/identity/contracts.ts#L153) · [app/server/src/lib/identity-store.ts:525](../../../app/server/src/lib/identity-store.ts#L525) · [app/console/src/pages/Account.vue:30](../../../app/console/src/pages/Account.vue#L30) · [app/console/src/components/ConsoleNav.vue:40](../../../app/console/src/components/ConsoleNav.vue#L40) · [app/console/src/pages/ConsoleRoot.vue:40](../../../app/console/src/pages/ConsoleRoot.vue#L40) · [app/console/src/lib/account.ts:27](../../../app/console/src/lib/account.ts#L27) · [app/console/src/pages/BindEmail.vue:70](../../../app/console/src/pages/BindEmail.vue#L70) · [app/console/src/pages/Account.vue:35](../../../app/console/src/pages/Account.vue#L35) · [app/console/src/mock/index.ts:50](../../../app/console/src/mock/index.ts#L50)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts) · [tests/console/signin.test.ts](../../../tests/console/signin.test.ts)。生成器未执行这些测试。

### 给账号绑定邮箱：发验证码

标识：`flow:identity.account.email.start`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/identity/email/start`
- 能力：
- 读取：`sessions`、`identities`、`email_challenges`
- 写入：`email_challenges`、`sessions`
- 不入队：`mail_outbox`
- 权限与资源：有效会话，且这次登录不超过 10 分钟（否则 403 step_up_required）；每分钟 10 次；发码限流与登录发码相同。
- 响应与错误：202 {resend_after:60} 并写 email_challenge cookie（path=/api/identity/email）；格式不对 400 bad_email；这个邮箱已经绑在本账号上 409 identity_exists，已经有 5 个邮箱 409 email_limit（#272），都不发信；太频繁 429。
- 数据与副作用：写一行 purpose=link 的 email_challenges，绑定发起的账号与会话指纹；验证码直接发信，不进 mail_outbox。

源码：[app/server/src/routes/identity/account.ts:51](../../../app/server/src/routes/identity/account.ts#L51) · [app/server/src/routes/identity/contracts.ts:154](../../../app/server/src/routes/identity/contracts.ts#L154) · [app/server/src/lib/identity-store.ts:31](../../../app/server/src/lib/identity-store.ts#L31)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。生成器未执行这些测试。

### 给账号绑定邮箱：核对验证码

标识：`flow:identity.account.email.verify`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/identity/email/verify`
- 能力：
- 读取：`sessions`、`email_challenges`、`identities`
- 写入：`email_challenges`、`identities`、`users`、`identity_audit`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效会话；验证码只认发起绑定的那个账号和会话，换了账号或重新登录过按 code_expired。
- 响应与错误：200 {ok:true}；验证码不对 400 invalid_code，失效 400 code_expired；邮箱已属于别的账号 409 identity_conflict，已经绑在本账号上 409 identity_exists，已经有 5 个邮箱 409 email_limit（#272）。
- 数据与副作用：在一个事务里作废验证码并写 email 身份、identity_audit 与 identity.link，账号还没有主邮箱时写 canonical_email；冲突时只记 identity.link_conflict，不合并账号。

源码：[app/server/src/routes/identity/account.ts:65](../../../app/server/src/routes/identity/account.ts#L65) · [app/server/src/routes/identity/contracts.ts:155](../../../app/server/src/routes/identity/contracts.ts#L155) · [app/server/src/lib/identity-store.ts:448](../../../app/server/src/lib/identity-store.ts#L448)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。生成器未执行这些测试。

### 账号页删掉一个不是主邮箱的邮箱

标识：`flow:identity.account.email.remove`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/identity/email/remove`
- 能力：
- 读取：`sessions`、`users`、`identities`
- 写入：`identities`、`identity_audit`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效会话，且这次登录不超过 10 分钟（否则 403 step_up_required）；每分钟 10 次；只能删本账号的邮箱。
- 响应与错误：200 {ok:true}；body {identity_id} 是 GET /api/identity/me 给的邮箱 id；主邮箱（canonical_email）409 primary_email；不是本账号的邮箱或已经删掉 404 not_found。
- 数据与副作用：在一个事务里删掉这一行 email 身份，写 identity_audit（unlink）与 identity.unlink；之后不能再用这个邮箱登录，用它登录的会话不动；下一轮 GitLab 同步从 GitLab 用户名下删掉这个邮箱（#272）。

源码：[app/server/src/routes/identity/account.ts:88](../../../app/server/src/routes/identity/account.ts#L88) · [app/server/src/routes/identity/contracts.ts:156](../../../app/server/src/routes/identity/contracts.ts#L156) · [app/server/src/lib/identity-store.ts:482](../../../app/server/src/lib/identity-store.ts#L482) · [app/console/src/pages/Account.vue:108](../../../app/console/src/pages/Account.vue#L108)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts)。生成器未执行这些测试。

### 设置或修改密码

标识：`flow:identity.account.password`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/identity/password`
- 能力：
- 读取：`sessions`、`users`、`identities`
- 写入：`users`、`identity_audit`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效会话，账号已绑定邮箱（否则 409 email_required）；已有密码时要填当前密码或 10 分钟内刚登录过，还没有密码时要 10 分钟内刚登录过（否则 403 step_up_required）。
- 响应与错误：200 {ok:true}；不到 8 位 400 password_too_short，超过 72 字节 400 password_exceeds_bcrypt_limit，当前密码不对 400 invalid_credentials。
- 数据与副作用：users.password_hash 存 bcrypt（cost 12）与 password_updated_at；写 identity_audit（password_set 或 password_change）与 account.password 审计，不记密码。

源码：[app/server/src/routes/identity/account.ts:100](../../../app/server/src/routes/identity/account.ts#L100) · [app/server/src/routes/identity/contracts.ts:157](../../../app/server/src/routes/identity/contracts.ts#L157) · [app/server/src/lib/identity-store.ts:422](../../../app/server/src/lib/identity-store.ts#L422) · [app/console/src/lib/account.ts:50](../../../app/console/src/lib/account.ts#L50)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts)。生成器未执行这些测试。

### 控制台列出注册邀请码

标识：`flow:identity.invites.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/invites`
- 能力：`accounts.invites.manage`
- 读取：`invite_codes`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`
- 不入队：
- 权限与资源：有效全站 sid，accounts.invites.manage；只看称号，不调用 GitHub，邮箱、Google 会话照常可用。
- 响应与错误：200 {invites:[{id,code,note,max_uses,used_count,expires_at,disabled,created_by,created_at,updated_at,usable}]}，按建立时间倒序；没权限 403 missing_capability。
- 数据与副作用：只读。

源码：[app/server/src/routes/console/invites.ts:19](../../../app/server/src/routes/console/invites.ts#L19) · [app/server/src/routes/console/contracts.ts:244](../../../app/server/src/routes/console/contracts.ts#L244) · [app/console/src/pages/Invites.vue:29](../../../app/console/src/pages/Invites.vue#L29)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts) · [tests/console/nav.test.ts](../../../tests/console/nav.test.ts)。生成器未执行这些测试。

### 控制台新建注册邀请码

标识：`flow:identity.invites.create`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/invites`
- 能力：`accounts.invites.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`invite_codes`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效全站 sid，accounts.invites.manage；每分钟 30 次。
- 响应与错误：201 {邀请码}；邀请码 4–40 位字母、数字、_、-，不分大小写，同名 409 invite_code_taken，格式不对 400；次数 1–100000 或 null（不限），过期时间可为 null（不过期）。
- 数据与副作用：写一行 invite_codes（code 存小写）与 invite.create 审计。

源码：[app/server/src/routes/console/invites.ts:21](../../../app/server/src/routes/console/invites.ts#L21) · [app/server/src/routes/console/contracts.ts:245](../../../app/server/src/routes/console/contracts.ts#L245) · [app/console/src/lib/invites.ts:57](../../../app/console/src/lib/invites.ts#L57)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts)。生成器未执行这些测试。

### 控制台修改或停用注册邀请码

标识：`flow:identity.invites.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/invites/:id`
- 能力：`accounts.invites.manage`
- 读取：`invite_codes`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`invite_codes`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效全站 sid，accounts.invites.manage；每分钟 30 次。
- 响应与错误：200 {邀请码}；不存在 404 not_found；只改 note、max_uses、expires_at、disabled，邀请码本身不能改。
- 数据与副作用：只写实际变化的字段，有变化才写 invite.update 审计（记字段名）；停用后注册时兑换失败，已注册的账号不受影响。邀请码不删。

源码：[app/server/src/routes/console/invites.ts:32](../../../app/server/src/routes/console/invites.ts#L32) · [app/server/src/routes/console/contracts.ts:253](../../../app/server/src/routes/console/contracts.ts#L253)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts)。生成器未执行这些测试。

### 解析本人控制台身份

标识：`flow:console.identity`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/me`
- 能力：
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：只需有效会话；回答当前登录者的站内角色、称号与能力，以及控制台这次经什么接GitHub（app、session或none），不接受自报role（#262 第四期）。
- 响应与错误：200 {login,avatar_url,org,provider,site_role,github,title,titles,capabilities,head_of,email_required}；email_required为true时控制台先带人去绑定邮箱页（#273）。
- 数据与副作用：只计算当前身份；不是成员的账号保留称号展示但没有任何能力；补记站内角色时查GitHub失败按错误处理，不降级为非成员；存在会话不等于拥有console.access。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/me.ts:21](../../../app/server/src/routes/console/me.ts#L21) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:12](../../../app/server/src/middleware/require-capability.ts#L12) · [app/console/src/pages/Overview.vue:28](../../../app/console/src/pages/Overview.vue#L28) · [app/console/src/lib/session.ts:72](../../../app/console/src/lib/session.ts#L72) · [app/console/src/lib/permission-tree.ts:57](../../../app/console/src/lib/permission-tree.ts#L57) · [app/console/src/pages/people/PermissionTree.vue:81](../../../app/console/src/pages/people/PermissionTree.vue#L81) · [app/console/src/components/ConsoleShell.vue:21](../../../app/console/src/components/ConsoleShell.vue#L21) · [app/console/src/pages/ConsoleRoot.vue:35](../../../app/console/src/pages/ConsoleRoot.vue#L35)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/console/account.test.ts](../../../tests/console/account.test.ts)。生成器未执行这些测试。

### 按能力读取工作概览

标识：`flow:console.summary`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/summary`
- 能力：`console.access`
- 读取：`applications`、`feedback`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：console.access；applications、feedback、people三块分别再按applications.read、feedback.read及roles.manage或roles.department.manage过滤。
- 响应与错误：200 只含获授权的统计键；投递计数含全部五状态和7日数。
- 数据与副作用：读全局投递统计、CONSOLE_ORG意见数及指派/未归档部门数；不返回无权查看的统计键。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/me.ts:36](../../../app/server/src/routes/console/me.ts#L36) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 读取称号与能力目录

标识：`flow:organization.catalogue`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/catalogue`
- 能力：`console.access`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：console.access；供渲染的能力清单不能替代服务端授权。
- 响应与错误：200 {titles,crew,tones,capabilities,domains,role_base,implies,captain_only,department_icons,application_statuses}。
- 数据与副作用：称号显示与权限包来自titles；能力、色调、蕴含等来自源码常量，不写权限配置。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/catalogue.ts:12](../../../app/server/src/routes/console/catalogue.ts#L12) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 读取部门及成员计数

标识：`flow:organization.departments.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/departments`
- 能力：`console.access`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：console.access，读取全部部门配置；不是仅本人部门。
- 响应与错误：200 {departments}，含heads和crew_count，也保留归档标记。
- 数据与副作用：读取departments和role_assignments，写权限包不在此入口。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/departments.ts:30](../../../app/server/src/routes/console/departments.ts#L30) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 新建组织部门

标识：`flow:organization.departments.create`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/departments`
- 能力：`roles.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`departments`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：roles.manage且站内角色是管理员（提督，requireAdmiral）；舰长仅有roles.manage仍403 admiral_required。
- 响应与错误：201 {department}；400 captain_only_capability，409 department_exists。
- 数据与副作用：写新部门，roles.manage不得装进部门权限包；成功写department.create审计。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/departments.ts:37](../../../app/server/src/routes/console/departments.ts#L37) · [app/server/src/lib/role-store.ts:50](../../../app/server/src/lib/role-store.ts#L50) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 修改或归档组织部门

标识：`flow:organization.departments.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/departments/:department_id`
- 能力：`roles.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`departments`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：roles.manage且站内角色是管理员（提督，requireAdmiral）；舰长仅有roles.manage仍403 admiral_required。
- 响应与错误：200 {department}；未知id 404，非法舰长专属能力400。
- 数据与副作用：更新传入字段/归档标记；仅实际变化时审计department.update，未直接撤销其他称号。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/departments.ts:47](../../../app/server/src/routes/console/departments.ts#L47) · [app/server/src/lib/role-store.ts:50](../../../app/server/src/lib/role-store.ts#L50) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 删除部门并撤销该部门指派

标识：`flow:organization.departments.delete`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/console/departments/:department_id`
- 能力：`roles.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`departments`、`role_assignments`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：roles.manage且站内角色是管理员（提督，requireAdmiral）；舰长仅有roles.manage仍403 admiral_required。
- 响应与错误：200 {ok:true,removed}；不存在404 not_found。
- 数据与副作用：同一数据库事务删除该部门和其head/member指派，其他指派不变；审计被撤销者，种子标记防止重启复活。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/departments.ts:63](../../../app/server/src/routes/console/departments.ts#L63) · [app/server/src/lib/role-store.ts:50](../../../app/server/src/lib/role-store.ts#L50) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 修改称号显示与权限包

标识：`flow:organization.titles.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/titles/:title_id`
- 能力：`roles.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`titles`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：roles.manage；admin/captain两级只有提督能改；提督固定全能力、乘客固定无能力，roles.manage只能进captain包。
- 响应与错误：200 {title}；400 title_capabilities_fixed/captain_only_capability，403 admiral_required，404 not_found。
- 数据与副作用：只更新允许的称号字段；实际变化才写title.update（不含旧新值），下一次请求读取新权限包。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/titles.ts:17](../../../app/server/src/routes/console/titles.ts#L17) · [app/server/src/lib/role-store.ts:50](../../../app/server/src/lib/role-store.ts#L50) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28) · [app/console/src/pages/people/TitleDialog.vue:200](../../../app/console/src/pages/people/TitleDialog.vue#L200) · [app/console/src/pages/people/BundleDialog.vue:72](../../../app/console/src/pages/people/BundleDialog.vue#L72) · [app/console/src/pages/people/TitleList.vue:27](../../../app/console/src/pages/people/TitleList.vue#L27) · [app/console/src/lib/titles.ts:22](../../../app/console/src/lib/titles.ts#L22)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 查看可管理的称号指派

标识：`flow:organization.assignments.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/assignments`
- 能力：
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：任一能力即可；roles.manage查全部，部门队长仅headOf范围，显式查询其他部门403 out_of_department_scope。
- 响应与错误：200 {assignments,captain}；captain只给登录名。
- 数据与副作用：读取筛选指派及现任舰长，不任命或移交。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/assignments.ts:35](../../../app/server/src/routes/console/assignments.ts#L35) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 指派称号或移交舰长

标识：`flow:organization.assignments.grant`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/assignments`
- 能力：
- 读取：`sessions`、`role_assignments`、`departments`、`titles`、`identities`、`users`
- 写入：`role_assignments`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：任一能力；队长只任免自己部门member，captain只由提督或现任舰长任命；指派对象给account_id（极客班账号，没绑GitHub的也行）或github_login，二选一（#262 第四期）。
- 响应与错误：201 {assignment}；400 部门错误或github_user_not_found，404 account_not_found，403 跨部门或captain_required，409 assignment_exists；30次/分钟限流。
- 数据与副作用：先校验部门存在且未归档；github_login在接上GitHub时经接入的GitHub（App或本人令牌）查数字id再找账号（登录名会改，旧名可能被别人注册），GitHub没接上时只认本站认识的人、按他上次登录时的用户名找；captain通过事务删旧插新保持唯一；审计指派/移交，不改变GitHub membership。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/assignments.ts:73](../../../app/server/src/routes/console/assignments.ts#L73) · [app/server/src/lib/role-store.ts:50](../../../app/server/src/lib/role-store.ts#L50) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28) · [app/console/src/pages/people/AssignDialog.vue:88](../../../app/console/src/pages/people/AssignDialog.vue#L88) · [app/server/src/lib/github.ts:52](../../../app/server/src/lib/github.ts#L52)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts) · [tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。生成器未执行这些测试。

### 撤销称号指派

标识：`flow:organization.assignments.revoke`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/console/assignments/:id`
- 能力：
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`role_assignments`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：任一能力；队长只能撤自己部门member；captain仅提督或该行对应舰长本人可撤。
- 响应与错误：200 {ok:true}；404 not_found，403 out_of_department_scope/missing_capability，409 captain_transfer_required。
- 数据与副作用：删除指定指派并记role.revoke，其他指派不变；不删除GitHub组织成员。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/assignments.ts:117](../../../app/server/src/routes/console/assignments.ts#L117) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 查看组织成员与称号持有者

标识：`flow:organization.people`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/people`
- 能力：
- 读取：`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：任一能力；队长也能看全名单，不按部门收窄；名单以极客班账号为准，接上GitHub（App或本人GitHub会话）时并上组织里还没登录过本站的人，接不上照常给名单（#262 第四期）。
- 响应与错误：200 {people,github,github_listed}；每人含account_id/login/user_id/avatar_url/site_role/role_unrecorded/member/status/providers/last_login_at/titles（不含邮箱），列出了GitHub组织成员时带github_role；按最高称号层级和登录名排序。
- 数据与副作用：读取账号、身份与指派；接上GitHub时取组织成员（失败只记日志、github_listed为false），再合并有指派但两边都没有的人；按数字id优先匹配改名用户，不同步写远端。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/people.ts:35](../../../app/server/src/routes/console/people.ts#L35) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28) · [app/server/src/lib/github-connection.ts:46](../../../app/server/src/lib/github-connection.ts#L46) · [app/console/src/pages/People.vue:52](../../../app/console/src/pages/People.vue#L52) · [app/console/src/lib/people.ts:83](../../../app/console/src/lib/people.ts#L83) · [app/server/src/lib/github.ts:63](../../../app/server/src/lib/github.ts#L63)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts)。生成器未执行这些测试。

### 改账号的站内角色

标识：`flow:organization.people.site_role`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/people/:account_id/site-role`
- 能力：`roles.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`、`users`
- 写入：`users`、`identity_audit`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：roles.manage且站内角色是管理员（提督）；舰长仅有roles.manage仍403 admiral_required；不看GitHub组织角色（#262 第四期）。
- 响应与错误：200 {account_id,site_role,changed}；site_role不是admin/member/none为400，账号不存在或已合并404 not_found，改掉最后一位管理员409 last_admin；30次/分钟限流。
- 数据与副作用：在一个BEGIN IMMEDIATE事务里改users的org_role/org_state，写identity_audit的role_change与account.role审计；改成none后对方下一次请求起没有任何能力、不能再登录，称号指派保留；不改GitHub组织成员关系。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/people.ts:91](../../../app/server/src/routes/console/people.ts#L91) · [app/server/src/lib/identity-store.ts:631](../../../app/server/src/lib/identity-store.ts#L631) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28) · [app/console/src/pages/people/SiteRoleDialog.vue:44](../../../app/console/src/pages/people/SiteRoleDialog.vue#L44) · [app/console/src/pages/People.vue:527](../../../app/console/src/pages/People.vue#L527)

测试入口：[tests/server/signin-methods.test.ts](../../../tests/server/signin-methods.test.ts) · [tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 按能力读取脱敏审计

标识：`flow:audit.console.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/audit`
- 能力：`audit.read`
- 读取：`audit_logs`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：audit.read；仅CONSOLE_ORG，action按转义后的字面前缀筛选；不是全库日志。
- 响应与错误：200 {logs}；details解析为对象；invite_link目标token及public:token操作者只保留前6位。
- 数据与副作用：读日志分页，不修改历史；org为空的登录/公开投递审计不在该结果中。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/audit.ts:29](../../../app/server/src/routes/console/audit.ts#L29) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 筛选招新投递列表

标识：`flow:application.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/applications`
- 能力：`applications.read`
- 读取：`applications`、`application_reviews`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：applications.read；无部门/个人记录限制，有此能力可读全部候选人列表。
- 响应与错误：200 {items,total,counts}；特长摘要120字、last_review可空，来源IP/UA不下发；counts为未筛选的全局五状态计数。
- 数据与副作用：转义q中的LIKE通配符，按姓名/班级/邮箱搜索；查询latest review，不为列表记application.view。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/applications.ts:48](../../../app/server/src/routes/console/applications.ts#L48) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts)。生成器未执行这些测试。

### 查看候选人详情与邮件状态

标识：`flow:application.detail`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/applications/:application_id`
- 能力：`applications.read`
- 读取：`applications`、`application_reviews`、`mail_outbox`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`audit_logs`、`sessions`
- 不入队：
- 权限与资源：applications.read；按UUID定位任意候选人，无部门范围限制。
- 响应与错误：200 {application,reviews,received_mail,mail}；404 not_found。邮件摘要不含地址/正文，application不含source_ip/UA。
- 数据与副作用：读简历、审核历史和mail_outbox摘要，写application.view审计，不触发发信。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/applications.ts:104](../../../app/server/src/routes/console/applications.ts#L104) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts)。生成器未执行这些测试。

### 导出候选人CSV

标识：`flow:application.export`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/applications/export.csv`
- 能力：`applications.export`
- 读取：`applications`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`audit_logs`、`sessions`
- 不入队：
- 权限与资源：applications.export；可选status过滤，其余不按部门收窄；5次/分钟。
- 响应与错误：200 text/csv附件，UTF-8 BOM、北京时间列、公式前缀转义；429 rate_limited。
- 数据与副作用：读取简历并记录application.export数量/状态；不写候选人或发信队列，文件导出后不由系统追踪。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/applications.ts:77](../../../app/server/src/routes/console/applications.ts#L77) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。生成器未执行这些测试。

### 审核投递、补备注与安排通知

标识：`flow:application.review`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/applications/:application_id`
- 能力：`applications.review`
- 读取：`applications`、`application_reviews`、`mail_outbox`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`applications`、`application_reviews`、`mail_outbox`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：applications.review；按id审核，状态变更必须携带expected_status和expected_review_id；取消分支规则仍唯一见application.cancel。
- 响应与错误：200 {application,review}；400 invalid_status/no_change/letter_required/letter_invalid，404 not_found，409 status_changed。
- 数据与副作用：变更到interview/accepted/rejected且notify不为false才渲染邮件；状态、审核行和邮件入队同事务，实际发送由后台worker。备注不写信或审计正文；本路由不新增任何取消规则。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/applications.ts:120](../../../app/server/src/routes/console/applications.ts#L120) · [app/server/src/lib/mail/mailer.ts:50](../../../app/server/src/lib/mail/mailer.ts#L50) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts)。生成器未执行这些测试。

### 提交加入我们申请

标识：`flow:application.submit`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/portal/apply`
- 能力：
- 读取：`application_limits`、`mail_outbox`
- 写入：`applications`、`application_limits`、`mail_outbox`、`audit_logs`
- 不入队：
- 权限与资源：匿名；蜜罐、PoW、可选Turnstile、每IP分钟5次和IP(/64)/设备24小时各5份。
- 响应与错误：201 {id,submitted_at,message}；字段错误400附fields，429 apply_limited/rate_limited。蜜罐回相同201形状但不落库。
- 数据与副作用：计数与投递同事务，发设备cookie；记脱敏application.received审计，尽力入队已收到邮件（每小时总量限制），入队失败仅日志不回滚投递；无需会话。

源码：[app/server/src/routes/portal/apply.ts:118](../../../app/server/src/routes/portal/apply.ts#L118) · [app/server/src/lib/mail/mailer.ts:50](../../../app/server/src/lib/mail/mailer.ts#L50)

测试入口：[tests/server/applications.test.ts](../../../tests/server/applications.test.ts) · [tests/server/mail-outbox.test.ts](../../../tests/server/mail-outbox.test.ts) · [tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。生成器未执行这些测试。

### 读取公开防滥用配置

标识：`flow:platform.public_config`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/public/config`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名可读；仅公开site key或null与PoW难度，不含Turnstile secret。
- 响应与错误：200 {turnstile_site_key,pow_difficulty}。
- 数据与副作用：只读配置，无业务数据库读取和写入，不调用验证码服务。

源码：[app/server/src/routes/portal/join.ts:50](../../../app/server/src/routes/portal/join.ts#L50)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts) · [tests/server/configuration.test.ts](../../../tests/server/configuration.test.ts)。生成器未执行这些测试。

### 阅读公开组织架构

标识：`flow:organization.public`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/public/org`
- 能力：
- 读取：`titles`、`departments`
- 写入：
- 不入队：
- 权限与资源：匿名可读；只下发称号/未归档部门显示信息及色调，不含人员或权限包。
- 响应与错误：200 {tones,titles,departments}。
- 数据与副作用：读取数据库显示配置与源码rank/tone，不修改组织结构。

源码：[app/server/src/routes/portal/org.ts:11](../../../app/server/src/routes/portal/org.ts#L11) · [app/web/sites/portal/lib/org.ts:19](../../../app/web/sites/portal/lib/org.ts#L19) · [app/forum/app/data/titles.ts:190](../../../app/forum/app/data/titles.ts#L190)

测试入口：[tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/web/portal-org.test.ts](../../../tests/web/portal-org.test.ts)。生成器未执行这些测试。

### 浏览公开文档清单

标识：`flow:documentation.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/docs`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名，只收DOC_FILES允许列表且文件存在。
- 响应与错误：200 {items:[{id,label,lang,file}]}。
- 数据与副作用：仅检查仓库公开文件是否存在；内部规范、运维和目录不会通过此API公开。

源码：[app/server/src/routes/portal/docs.ts:16](../../../app/server/src/routes/portal/docs.ts#L16)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 阅读允许公开的文档

标识：`flow:documentation.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/docs/:id`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名；id必须命中固定DOC_FILES，不能用任意路径读取文件。
- 响应与错误：200 {id,label,lang,file,content}；未列入或文件缺失404。
- 数据与副作用：读取允许的UTF-8 Markdown，不访问业务数据库、不执行内容。

源码：[app/server/src/routes/portal/docs.ts:23](../../../app/server/src/routes/portal/docs.ts#L23)

测试入口：[tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 检查公开邀请链接

标识：`flow:invitation.public.inspect`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/join/:token`
- 能力：
- 读取：`invite_links`
- 写入：
- 不入队：
- 权限与资源：持有token可访问；不需要登录，不返回发起人的token密文。
- 响应与错误：200 {org,note,team_slug,expires_at,remaining_uses,valid,reason}；未知token404。
- 数据与副作用：读取链接状态并计算剩余额度，不预留额度、不调用GitHub、不发邀请。

源码：[app/server/src/routes/portal/join.ts:55](../../../app/server/src/routes/portal/join.ts#L55)

测试入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts)。生成器未执行这些测试。

### 兑换组织邀请链接

标识：`flow:invitation.public.redeem`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/join/:token`
- 能力：
- 读取：`invite_links`、`invite_attempts`
- 写入：`invite_links`、`invite_attempts`、`invitations`、`audit_logs`
- 不入队：
- 权限与资源：持有token，PoW/蜜罐/可选Turnstile及分钟限流；额度、禁用和过期在事务预留时再次校验；发邀请用服务器的 GitHub App，没配 App 时用链接发起人密文中的token（经 App 建的链接不存令牌，#262 第四期）。
- 响应与错误：200 {ok:true,invitation_id,message}；404不存在，400输入/明确失败，409 invite_pending_review/invite_unavailable，503 GitHub App 用不了、发起人凭据失效或结果待核对。
- 数据与副作用：先事务预留再请求GitHub（可查团队和用户名），成功写邀请/尝试/审计；sent重放不重复发送，明确失败返还额度，不确定结果保留unknown待核对，不删除访问者会话。

源码：[app/server/src/routes/portal/join.ts:70](../../../app/server/src/routes/portal/join.ts#L70) · [app/server/src/lib/invite-reservation.ts:9](../../../app/server/src/lib/invite-reservation.ts#L9) · [app/server/src/lib/invite-reservation.ts:22](../../../app/server/src/lib/invite-reservation.ts#L22) · [app/server/src/lib/github-connection.ts:46](../../../app/server/src/lib/github-connection.ts#L46)

测试入口：[tests/server/invitations.test.ts](../../../tests/server/invitations.test.ts) · [tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。生成器未执行这些测试。

### 读取意见分类与提交参数

标识：`flow:feedback.categories`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/feedback/categories`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名，只返回本部署CONSOLE_ORG及固定分类。
- 响应与错误：200 {categories,pow_difficulty,org}。
- 数据与副作用：读源码配置，不写数据库、不发信。

源码：[app/server/src/routes/portal/feedback.ts:24](../../../app/server/src/routes/portal/feedback.ts#L24)

测试入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts) · [tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 浏览已公开的意见与回复

标识：`flow:feedback.public.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/feedback/public`
- 能力：
- 读取：`feedback`
- 写入：
- 不入队：
- 权限与资源：匿名；org按大小写不敏感匹配CONSOLE_ORG，否则回空列表；spam不公开。
- 响应与错误：200 {items}；正文截280字、含回复/状态/票数，不含contact/IP/UA；limit由合同限制且最终最多100。
- 数据与副作用：只读本组织反馈，不查询其他组织是否有记录。

源码：[app/server/src/routes/portal/feedback.ts:63](../../../app/server/src/routes/portal/feedback.ts#L63)

测试入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts) · [tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 提交组织意见

标识：`flow:feedback.submit`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/feedback`
- 能力：
- 读取：`sessions`
- 写入：`feedback`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：匿名可提交；仅CONSOLE_ORG，5至5000字，固定分类，PoW/蜜罐/Turnstile与每分钟10次限流；sid仅补充提交人身份。
- 响应与错误：200 {ok:true,id,message}；非法org/内容/分类或人机校验失败400，超额429。
- 数据与副作用：写feedback及feedback.submit审计（80字预览）；有效sid补账号，过期sid可删除；联系方式截200字，不发送邮件。

源码：[app/server/src/routes/portal/feedback.ts:26](../../../app/server/src/routes/portal/feedback.ts#L26)

测试入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts) · [tests/server/core.test.ts](../../../tests/server/core.test.ts) · [tests/server/rate-limits.test.ts](../../../tests/server/rate-limits.test.ts)。生成器未执行这些测试。

### 控制台读取待处理意见

标识：`flow:feedback.console.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/feedback`
- 能力：`feedback.read`
- 读取：`feedback`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 权限与资源：feedback.read；资源固定CONSOLE_ORG，不接受客户端自报org。
- 响应与错误：200 {items,counts}；最多500条，管理DTO不下发source_ip/UA/数字账号id。
- 数据与副作用：按org及可选status读列表与状态计数，不记查看审计。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/feedback.ts:12](../../../app/server/src/routes/console/feedback.ts#L12) · [app/server/src/lib/feedback-store.ts:22](../../../app/server/src/lib/feedback-store.ts#L22) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts) · [tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 控制台处理意见状态与回复

标识：`flow:feedback.console.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/feedback/:id`
- 能力：`feedback.manage`
- 读取：`feedback`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`feedback`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：feedback.manage；资源固定CONSOLE_ORG，不接受客户端自报org。
- 响应与错误：200 {ok:true}；记录不属于org返回404，非法状态被合同/handler拒绝。
- 数据与副作用：更新status、reply、replied_by/replied_at及updated_at，审计feedback.update；回复将由公开列表展示，不发邮件。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/feedback.ts:18](../../../app/server/src/routes/console/feedback.ts#L18) · [app/server/src/lib/feedback-store.ts:22](../../../app/server/src/lib/feedback-store.ts#L22) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts) · [tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 控制台删除组织意见

标识：`flow:feedback.console.delete`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/console/feedback/:id`
- 能力：`feedback.manage`
- 读取：`feedback`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`feedback`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：feedback.manage；资源固定CONSOLE_ORG，不接受客户端自报org。
- 响应与错误：200 {ok:true}；org/id不匹配404。
- 数据与副作用：删除反馈并审计feedback.delete，不能越过组织条件删除其他记录。
- 共同身份路径：读取当前sid、账号记下的站内角色与称号权限包，不调用 GitHub；只有还没记过站内角色的老账号，它的 GitHub 会话第一次用到时查一次 GitHub 组织角色并记下（缓存60秒）。仅过期/令牌失效才删除会话，令牌失效还写一次审计，不代表每次成功读都审计（#262 第四期）。

源码：[app/server/src/routes/console/feedback.ts:31](../../../app/server/src/routes/console/feedback.ts#L31) · [app/server/src/lib/feedback-store.ts:22](../../../app/server/src/lib/feedback-store.ts#L22) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30) · [app/server/src/middleware/require-capability.ts:28](../../../app/server/src/middleware/require-capability.ts#L28)

测试入口：[tests/server/feedback-org.test.ts](../../../tests/server/feedback-org.test.ts) · [tests/server/console.test.ts](../../../tests/server/console.test.ts) · [tests/server/core.test.ts](../../../tests/server/core.test.ts)。生成器未执行这些测试。

### 浏览论坛状态与本人私有列表

标识：`flow:forum.state`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/forum/state`
- 能力：
- 读取：`forum_counters`、`forum_users`、`forum_tags`、`forum_topics`、`forum_posts`、`forum_likes`、`forum_notifications`、`forum_bookmarks`、`forum_follows`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：游客与成员均可读；通知、书签和真实通知设置仅本人可见，其他用户设置给默认值；关注关系公开。
- 响应与错误：200 {state}，帖子只有字段和摘要、没有正文；每IP(/64)分钟120次，超额429；显式HEAD回405且不计算state。
- 数据与副作用：读论坛表与公开内容分类；GET也可能通过forumViewer刷新本人用户；不发送邮件、不写帖子。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/topics.ts:21](../../../app/server/src/routes/forum-api/topics.ts#L21) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 阅读单话题帖子正文

标识：`flow:forum.topic_posts`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/forum/topics/:topic_id/posts`
- 能力：
- 读取：`forum_topics`、`forum_posts`、`forum_likes`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`
- 写入：`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：游客与成员均可读，无额外帖子级权限；与state可见性一致。
- 响应与错误：200 {posts}含正文；话题不存在404；每IP分钟60次。
- 数据与副作用：按话题读取帖子及点赞投影；软删正文为空；不把全论坛正文再次塞进首屏。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/topics.ts:28](../../../app/server/src/routes/forum-api/topics.ts#L28) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 搜索话题帖子和用户

标识：`flow:forum.search`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/forum/search`
- 能力：
- 读取：`forum_topics`、`forum_posts`、`forum_users`、`forum_likes`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：游客与成员均可搜索；只本人用户记录显示真实通知设置，不搜索已删帖子正文。
- 响应与错误：200 {results:{topics,posts,users}}；空词空结果；词过长400 validation_error，每IP分钟60次。
- 数据与副作用：标题、正文、username/displayName按转义的LIKE搜索，各类限量；返回帖子命中摘要，不将%当通配符。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/topics.ts:38](../../../app/server/src/routes/forum-api/topics.ts#L38) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 发布成员话题与首帖

标识：`flow:forum.topics.create`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/topics`
- 能力：
- 读取：`forum_topics`、`forum_posts`、`forum_tags`、`forum_users`、`forum_notifications`、`forum_counters`、`forum_rate_events`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_likes`
- 写入：`forum_topics`、`forum_posts`、`forum_tags`、`forum_notifications`、`forum_counters`、`forum_rate_events`、`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。
- 响应与错误：201 {changes,viewer,guestPolicy,topicId,postId}，帖子带正文；非法标题/分类/tag/空正文400，成员限流429。
- 数据与副作用：单事务创建话题、首帖、编号和必要新tag，处理最多10个@提及通知；成功后记topic限流事件，不发邮件。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/topics.ts:47](../../../app/server/src/routes/forum-api/topics.ts#L47) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 置顶或取消置顶话题

标识：`flow:forum.topics.pin`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/topics/:topic_id/pin`
- 能力：`forum.topic.pin`
- 读取：`forum_topics`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_topics`、`audit_logs`、`forum_users`、`sessions`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 此外必须具备forum.topic.pin，作用于指定话题。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；缺能力403，话题不存在404。
- 数据与副作用：更新pinned；以CONSOLE_ORG记forum.topic.pin审计，只含话题id及开关，不含正文。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/topics.ts:67](../../../app/server/src/routes/forum-api/topics.ts#L67) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 关闭或重新打开话题

标识：`flow:forum.topics.close`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/topics/:topic_id/close`
- 能力：`forum.topic.close`
- 读取：`forum_topics`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_topics`、`audit_logs`、`forum_users`、`sessions`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 此外必须具备forum.topic.close，作用于指定话题。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；缺能力403，话题不存在404。
- 数据与副作用：更新closed；以CONSOLE_ORG记forum.topic.close审计，只含话题id及开关，不含正文。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/topics.ts:67](../../../app/server/src/routes/forum-api/topics.ts#L67) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 记录话题浏览数

标识：`flow:forum.topics.view`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/topics/:topic_id/view`
- 能力：
- 读取：`forum_topics`、`forum_topic_views`
- 写入：`forum_topics`、`forum_topic_views`
- 不入队：
- 权限与资源：游客或成员都可调用，不解析登录身份；按IP(/64)与话题去重。
- 响应与错误：204空体；不存在404，分钟60次超额429。
- 数据与副作用：事务清理超过1小时的去重记录，首次浏览才+1；IP只保留在短期去重表，不随帖子返回。

源码：[app/server/src/routes/forum-api/topics.ts:80](../../../app/server/src/routes/forum-api/topics.ts#L80) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 成员或游客回复话题

标识：`flow:forum.posts.reply`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/posts`
- 能力：
- 读取：`forum_topics`、`forum_posts`、`forum_users`、`forum_notifications`、`forum_counters`、`forum_rate_events`、`role_assignments`、`audit_logs`、`sessions`、`departments`、`titles`、`forum_likes`
- 写入：`forum_posts`、`forum_topics`、`forum_users`、`forum_notifications`、`forum_counters`、`forum_rate_events`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：成员直接回复；游客需合法昵称、空蜜罐、PoW、可选Turnstile与IP/全站限流；已关闭话题仅forum.post.moderate可回，replyTo须同一话题。
- 响应与错误：201 {changes,viewer,guestPolicy,postId}含正文；404话题不存在；403关闭；400正文/昵称/冒名/PoW/验证码失败；429 rate_limited或guest_replies_paused。
- 数据与副作用：事务创建回复并更新最后活动、处理回复与提及通知；游客用户与回复同事务；PoW通过就记该IP尝试额度，成功才记全站额度；冒名检查读指派、历史登录审计及会话；不发送邮件。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/posts.ts:36](../../../app/server/src/routes/forum-api/posts.ts#L36) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 编辑自己的帖子或执行版务

标识：`flow:forum.posts.edit`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/forum/posts/:post_id`
- 能力：
- 读取：`forum_posts`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_posts`、`audit_logs`、`forum_users`、`sessions`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 必须是作者本人，或者持有forum.post.moderate；能力不是作者分支的共同前提。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；帖子正文随changes返回；404不存在、403他人帖子、409 post_deleted、400 empty_content。
- 数据与副作用：只更新正文/edited_at；只有编辑他人帖子才写forum.post.edit审计，不记录正文；不会因编辑重新发送提及通知。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/posts.ts:78](../../../app/server/src/routes/forum-api/posts.ts#L78) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 软删除回复

标识：`flow:forum.posts.delete`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/forum/posts/:post_id`
- 能力：
- 读取：`forum_posts`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_posts`、`audit_logs`、`forum_users`、`sessions`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 作者本人或forum.post.moderate；第一帖禁止删除。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404不存在、403他人帖子、400 first_post；已软删重试返回现状。
- 数据与副作用：置deleted并清正文，保留点赞和书签；只在删除他人帖子时记forum.post.delete审计；幂等重试不重复执行删除。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/posts.ts:90](../../../app/server/src/routes/forum-api/posts.ts#L90) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 切换本人点赞

标识：`flow:forum.posts.like`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/posts/:post_id/like`
- 能力：
- 读取：`forum_posts`、`forum_likes`、`forum_users`、`forum_notifications`、`forum_counters`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`forum_likes`、`forum_notifications`、`forum_counters`、`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 点赞主体固定本人，不接受代他人点赞。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404不存在，409 post_deleted；帖子投影不带全文。
- 数据与副作用：事务切换点赞；新点赞按作者通知设置生成一次通知（同人同帖不重复），取消不撤回已有通知，不写操作审计。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/posts.ts:101](../../../app/server/src/routes/forum-api/posts.ts#L101) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 切换本人书签

标识：`flow:forum.posts.bookmark`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/posts/:post_id/bookmark`
- 能力：
- 读取：`forum_posts`、`forum_bookmarks`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_bookmarks`、`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 只能操作本人的书签；handler只检查帖子存在，未禁止为已软删帖子加书签。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404不存在；删除书签用changes.removed反馈。
- 数据与副作用：事务按userId/postId切换书签，不通知作者，不修改帖子正文。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/posts.ts:109](../../../app/server/src/routes/forum-api/posts.ts#L109) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 切换本人关注关系

标识：`flow:forum.users.follow`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/users/:forum_user_id/follow`
- 能力：
- 读取：`forum_users`、`forum_follows`、`forum_notifications`、`forum_counters`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_likes`
- 写入：`forum_follows`、`forum_notifications`、`forum_counters`、`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 关注发起人固定本人，目标须存在且不是本人。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；404未知用户，400 cannot_follow_self。
- 数据与副作用：事务切换关注；首次关注在对方允许通知且未曾通知时写通知与编号，取消关注不删除旧通知。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/people.ts:11](../../../app/server/src/routes/forum-api/people.ts#L11) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 标记本人通知已读

标识：`flow:forum.notifications.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/notifications/:notification_id/read`
- 能力：
- 读取：`forum_notifications`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_notifications`、`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 SQL同时匹配通知id与recipient_id，不能读取/标记他人通知。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；不存在或属于他人均404。
- 数据与副作用：仅更新本人该条read=1，不删通知；其他人的通知设置不下发。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/people.ts:20](../../../app/server/src/routes/forum-api/people.ts#L20) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 标记本人全部通知已读

标识：`flow:forum.notifications.read_all`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/forum/notifications/read-all`
- 能力：
- 读取：`forum_notifications`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_users`、`forum_likes`
- 写入：`forum_notifications`、`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 仅recipient_id等于本人。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；没有未读通知仍返回合法空变更。
- 数据与副作用：UPDATE本人未读行并RETURNING id，据此只回变动通知，不清除别人的未读数。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/people.ts:26](../../../app/server/src/routes/forum-api/people.ts#L26) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 修改本人论坛资料

标识：`flow:forum.profile.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/forum/me/profile`
- 能力：
- 读取：`forum_users`、`role_assignments`、`sessions`、`audit_logs`、`departments`、`titles`、`forum_likes`
- 写入：`forum_users`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 只修改本人记录；允许昵称、签名、所在地、https网站与通知设置，不接收用户角色授权。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；400昵称/控制字符/网址等错误；旧昵称未变时不因新昵称规则阻止修改其他字段。
- 数据与副作用：昵称NFKC与冒名检查后保存；冒名来源含已有成员/官方用户名、指派和登录过的组织账号；只更新提交字段，不更改GitHub资料。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/people.ts:32](../../../app/server/src/routes/forum-api/people.ts#L32) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 上传本人论坛头像

标识：`flow:forum.avatar.upload`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PUT /api/forum/me/avatar`
- 能力：
- 读取：`forum_avatars`、`forum_users`、`forum_rate_events`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_likes`
- 写入：`forum_avatars`、`forum_users`、`forum_rate_events`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 onRequest阶段即鉴权并消费每小时10次额度，失败解码也算；只改本人头像。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。；413 avatar_too_large，415 unsupported_media_type，400非法图像/尺寸，429限流。
- 数据与副作用：PNG/JPEG/WebP最多2MB、4096×4096；sharp取首帧转256×256 WebP去元数据；按哈希写库并更新本人引用，同事务清理无人引用的旧头像。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/people.ts:80](../../../app/server/src/routes/forum-api/people.ts#L80) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/lib/forum-avatar.ts:16](../../../app/server/src/lib/forum-avatar.ts#L16) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 恢复本人默认头像

标识：`flow:forum.avatar.clear`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/forum/me/avatar`
- 能力：
- 读取：`forum_users`、`forum_avatars`、`sessions`、`role_assignments`、`departments`、`titles`、`forum_likes`
- 写入：`forum_users`、`forum_avatars`、`sessions`、`audit_logs`
- 不入队：
- 权限与资源：requireMember：有效sid且当前仍是CONSOLE_ORG成员；主体由服务端forumViewer确定，客户端userId/role不能赋权。 只清本人自定义头像。
- 响应与错误：200 {changes,viewer,guestPolicy}；只返回本次变动记录，成员自己的用户记录总携带，私有记录按本人范围投影。
- 数据与副作用：事务移除avatar_hash引用并删除无用户引用的旧头像，保留GitHub头像字段用于回退，不删除用户。
- 身份条件副作用：forumViewer仅在当前仍为组织成员时创建/刷新forum_users的角色、称号和GitHub头像；sid过期删除会话，上游拒绝token经全局处理时删会话并审计；游客不刷新成员记录。

源码：[app/server/src/routes/forum-api/people.ts:91](../../../app/server/src/routes/forum-api/people.ts#L91) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189) · [app/server/src/routes/forum-api/viewer.ts:31](../../../app/server/src/routes/forum-api/viewer.ts#L31) · [app/server/src/lib/access.ts:30](../../../app/server/src/lib/access.ts#L30)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 读取公开头像文件

标识：`flow:forum.avatar.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/forum/avatars/:file`
- 能力：
- 读取：`forum_avatars`
- 写入：
- 不入队：
- 权限与资源：匿名；按合同限定的哈希.webp取文件，不接受磁盘路径。
- 响应与错误：200 image/webp二进制，immutable一年缓存、default-src none和nosniff；不存在404。
- 数据与副作用：按哈希读取SQLite内WebP数据，不读取私有快照文件或解析sid。

源码：[app/server/src/routes/forum-api/people.ts:99](../../../app/server/src/routes/forum-api/people.ts#L99) · [app/server/src/lib/forum-store.ts:189](../../../app/server/src/lib/forum-store.ts#L189)

测试入口：[tests/server/forum.test.ts](../../../tests/server/forum.test.ts)。生成器未执行这些测试。

### 辨认本机论坛运行模式

标识：`flow:forum.local.supervisor`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`interface:forum.local-supervisor`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：仅import.meta.dev，非开发404；不是登录身份或业务权限接口。
- 响应与错误：200 {module,instance,mode,contentSource,snapshotConfigured,realAuthentication:false,serverPersistence:false}，no-store。
- 数据与副作用：只读运行时配置与进程标识；snapshotConfigured只检查配置是否非空，不连接数据库或校验文件可用。
- 验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

源码：[app/forum/server/routes/__geek_forum.get.ts:4](../../../app/forum/server/routes/__geek_forum.get.ts#L4)

测试入口：[app/forum/tests/content-source.test.ts](../../../app/forum/tests/content-source.test.ts)。生成器未执行这些测试。

### 读取开发快照状态

标识：`flow:forum.local.state`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`interface:forum.local-state`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：仅开发且配置快照目录，GET/HEAD；不实现成员认证，不能把游客展示认成权限校验。
- 响应与错误：GET 200 {schemaVersion,mode,capturedAt,summary,state}；HEAD空体；未配置404，其他方法405，快照不可读/不合法503。
- 数据与副作用：读取content.json、asset-index.json和内容编辑层，解析后缓存当前进程；失败缓存清除以便重试；no-store/nosniff，无SQLite或写文件。
- 验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

源码：[app/forum/server/routes/api/local-forum/state.ts:13](../../../app/forum/server/routes/api/local-forum/state.ts#L13) · [app/forum/server/utils/local-snapshot.ts:45](../../../app/forum/server/utils/local-snapshot.ts#L45) · [app/forum/server/utils/local-snapshot.ts:58](../../../app/forum/server/utils/local-snapshot.ts#L58)

测试入口：[app/forum/tests/local-snapshot.test.ts](../../../app/forum/tests/local-snapshot.test.ts) · [app/forum/tests/local-curation.test.ts](../../../app/forum/tests/local-curation.test.ts) · [app/forum/tests/content-source.test.ts](../../../app/forum/tests/content-source.test.ts)。生成器未执行这些测试。

### 读取开发快照附件

标识：`flow:forum.local.asset`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`interface:forum.local-asset`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：仅开发配置快照且GET/HEAD；hash须在资产索引中、文件必须位于assets目录，不根据原始文件名开放路径。
- 响应与错误：200完整或206单段Range；HEAD同头无体；404缺条目/文件，416不可满足范围，500大小不符，503快照失败。
- 数据与副作用：读取索引及资产stat/文件流，类型和disposition来自索引；CSP禁止脚本，断连销毁流；多段/不识别Range回完整体；不修改快照。
- 验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

源码：[app/forum/server/routes/api/local-forum/assets/[hash].ts:15](../../../app/forum/server/routes/api/local-forum/assets/[hash].ts#L15) · [app/forum/server/utils/local-snapshot.ts:45](../../../app/forum/server/utils/local-snapshot.ts#L45) · [app/forum/server/utils/local-snapshot.ts:58](../../../app/forum/server/utils/local-snapshot.ts#L58)

测试入口：[app/forum/tests/local-snapshot.test.ts](../../../app/forum/tests/local-snapshot.test.ts)。生成器未执行这些测试。

### 提供论坛Markdown索引

标识：`flow:forum.markdown.index`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`interface:forum.llms`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名GET/HEAD；只拦截llms.txt；其它方法/路径交后续处理器。
- 响应与错误：200 text/plain UTF-8加nosniff；快照加载失败503。
- 数据与副作用：site构建使用siteForumState，开发快照模式读只读投影，否则进程示例种子；预渲染可落成静态文件，不动态读取核心forum_*数据库。
- 验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

源码：[app/forum/server/middleware/forum-markdown.ts:36](../../../app/forum/server/middleware/forum-markdown.ts#L36) · [app/forum/server/middleware/forum-markdown.ts:55](../../../app/forum/server/middleware/forum-markdown.ts#L55)

测试入口：[app/forum/tests/forum-markdown.test.ts](../../../app/forum/tests/forum-markdown.test.ts) · [app/forum/tests/site-state.test.ts](../../../app/forum/tests/site-state.test.ts) · [app/forum/tests/content-source.test.ts](../../../app/forum/tests/content-source.test.ts)。生成器未执行这些测试。

### 提供话题Markdown正文

标识：`flow:forum.markdown.topic`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`interface:forum.topic-markdown`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名GET/HEAD；路径按TOPIC_MARKDOWN匹配，不能二次解码冒充其他路由。
- 响应与错误：200 text/markdown UTF-8；未知话题404 text/plain；快照失败503。
- 数据与副作用：与索引同源：site内容/开发快照/示例种子；不包含浏览器新写内容或实时核心数据库帖子，构建静态输出与在线核心API分别取证。
- 验证边界：所列为纯解析、内容转换或配置测试，不是本次启动Nitro或读取真实快照的证明。

源码：[app/forum/server/middleware/forum-markdown.ts:26](../../../app/forum/server/middleware/forum-markdown.ts#L26) · [app/forum/server/middleware/forum-markdown.ts:55](../../../app/forum/server/middleware/forum-markdown.ts#L55)

测试入口：[app/forum/tests/forum-markdown.test.ts](../../../app/forum/tests/forum-markdown.test.ts) · [app/forum/tests/site-state.test.ts](../../../app/forum/tests/site-state.test.ts)。生成器未执行这些测试。

### 浏览公开比赛信息

标识：`flow:competition.public.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/public/competitions`
- 能力：
- 读取：`competitions`
- 写入：
- 不入队：
- 匿名只读未下线赛事，响应只含公开字段，不含offline、创建时间或成员信息。
- 响应200 {competitions}；五种状态按时间计算，未知报名截止的未来赛事为upcoming；未结束在前，已结束按开始时间倒序。
- 每场带报名摘要signup（enabled、participation、team_min、team_max、scoring），没有设置行时回默认值；摘要不含报名人数、队伍或任何成员信息。
- 官网按关键词、可报名（报名中）与内部/外部筛选，每60秒重算状态与排序，损坏响应显示失败并可重试；全部类型链接可选且必须可解析HTTPS。

源码：[app/server/src/routes/portal/competitions.ts:13](../../../app/server/src/routes/portal/competitions.ts#L13) · [app/server/src/routes/portal/contracts.ts:9](../../../app/server/src/routes/portal/contracts.ts#L9) · [app/server/src/routes/portal/index.ts:9](../../../app/server/src/routes/portal/index.ts#L9) · [app/server/src/lib/competition-store.ts:126](../../../app/server/src/lib/competition-store.ts#L126) · [app/server/src/lib/competition-contract.ts:34](../../../app/server/src/lib/competition-contract.ts#L34) · [app/web/sites/portal/lib/competitions.ts:115](../../../app/web/sites/portal/lib/competitions.ts#L115) · [app/web/sites/portal/lib/competitionLabels.ts:222](../../../app/web/sites/portal/lib/competitionLabels.ts#L222) · [app/web/sites/portal/components/os/competitions/CompetitionsApp.tsx:97](../../../app/web/sites/portal/components/os/competitions/CompetitionsApp.tsx#L97) · [app/web/sites/portal/components/os/competitions/CompetitionList.tsx:32](../../../app/web/sites/portal/components/os/competitions/CompetitionList.tsx#L32) · [app/web/sites/portal/components/os/competitions/CompetitionDetail.tsx:185](../../../app/web/sites/portal/components/os/competitions/CompetitionDetail.tsx#L185) · [app/web/sites/portal/components/os/Windows.tsx:214](../../../app/web/sites/portal/components/os/Windows.tsx#L214) · [app/web/sites/portal/components/os/YugcOs.tsx:118](../../../app/web/sites/portal/components/os/YugcOs.tsx#L118) · [app/web/sites/portal/lib/osApps.ts:47](../../../app/web/sites/portal/lib/osApps.ts#L47) · [app/web/shared/lib/mock-api.ts:41](../../../app/web/shared/lib/mock-api.ts#L41) · [app/web/sites/portal/pages/Home.tsx:23](../../../app/web/sites/portal/pages/Home.tsx#L23) · [app/web/sites/portal/lib/icons.ts:5](../../../app/web/sites/portal/lib/icons.ts#L5)

测试入口：[tests/server/competitions.test.ts](../../../tests/server/competitions.test.ts) · [tests/console/competitions.test.ts](../../../tests/console/competitions.test.ts) · [tests/web/portal-competitions.test.tsx](../../../tests/web/portal-competitions.test.tsx) · [tests/e2e/competitions.spec.mts](../../../tests/e2e/competitions.spec.mts) · [tests/e2e/portal-competitions.spec.ts](../../../tests/e2e/portal-competitions.spec.ts)。生成器未执行这些测试。

### 控制台查看全部比赛

标识：`flow:competition.console.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/competitions`
- 能力：`console.access`
- 读取：`competitions`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`、`audit_logs`
- 不入队：
- 有效sid及console.access可读，控制台页面和导航另需competitions.manage；公开与管理读取范围分别定义。
- 200 {competitions}含offline；401未登录，403缺能力。列表按当前时间重算，样板重读同样更新，不冒充真实数据。
- 共同身份路径：读取sessions与称号/部门权限，使用本人GitHub token查角色并缓存60秒；过期会话删除，上游拒绝token时删除并审计，不代表成功读取总是写库。

源码：[app/server/src/routes/console/competitions.ts:36](../../../app/server/src/routes/console/competitions.ts#L36) · [app/server/src/routes/console/index.ts:30](../../../app/server/src/routes/console/index.ts#L30) · [app/console/src/pages/Competitions.vue:27](../../../app/console/src/pages/Competitions.vue#L27) · [app/console/src/lib/types.ts:156](../../../app/console/src/lib/types.ts#L156) · [app/console/src/lib/nav.ts:32](../../../app/console/src/lib/nav.ts#L32) · [app/console/src/lib/permission-boundaries.ts:97](../../../app/console/src/lib/permission-boundaries.ts#L97) · [app/console/src/router.ts:35](../../../app/console/src/router.ts#L35) · [app/console/src/mock/console.ts:405](../../../app/console/src/mock/console.ts#L405)

测试入口：[tests/server/competitions.test.ts](../../../tests/server/competitions.test.ts) · [tests/console/competitions.test.ts](../../../tests/console/competitions.test.ts) · [tests/web/portal-competitions.test.tsx](../../../tests/web/portal-competitions.test.tsx) · [tests/e2e/competitions.spec.mts](../../../tests/e2e/competitions.spec.mts)。生成器未执行这些测试。

### 登记比赛信息

标识：`flow:competition.create`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/competitions`
- 能力：`competitions.manage`
- 读取：`competitions`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`competitions`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效全站sid，组织固定CONSOLE_ORG，写口独立检查competitions.manage；客户端不能自报角色或org。
- 共同身份路径：读取sessions与称号/部门权限，使用本人GitHub token查角色并缓存60秒；过期会话删除，上游拒绝token时删除并审计，不代表成功读取总是写库。
- 201 {competition}；校验名称、时间范围和解析后的HTTPS地址；未知字段或错误时间/地址400，限流429。
- 比赛行与competition.create审计同一事务提交；审计失败一起回滚，不发邮件，不创建报名或队伍。

源码：[app/server/src/routes/console/competitions.ts:41](../../../app/server/src/routes/console/competitions.ts#L41) · [app/server/src/routes/console/contracts.ts:208](../../../app/server/src/routes/console/contracts.ts#L208) · [app/server/src/lib/db.ts:193](../../../app/server/src/lib/db.ts#L193) · [app/server/src/lib/roles.ts:94](../../../app/server/src/lib/roles.ts#L94) · [app/server/src/services.ts:64](../../../app/server/src/services.ts#L64)

测试入口：[tests/server/competitions.test.ts](../../../tests/server/competitions.test.ts) · [tests/console/competitions.test.ts](../../../tests/console/competitions.test.ts) · [tests/web/portal-competitions.test.tsx](../../../tests/web/portal-competitions.test.tsx) · [tests/e2e/competitions.spec.mts](../../../tests/e2e/competitions.spec.mts)。生成器未执行这些测试。

### 编辑、下线和恢复比赛

标识：`flow:competition.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/competitions/:competition_id`
- 能力：`competitions.manage`
- 读取：`competitions`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`competitions`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效全站sid，组织固定CONSOLE_ORG，写口独立检查competitions.manage；客户端不能自报角色或org。
- 共同身份路径：读取sessions与称号/部门权限，使用本人GitHub token查角色并缓存60秒；过期会话删除，上游拒绝token时删除并审计，不代表成功读取总是写库。
- 200 {competition}；404不存在；合并原记录后验证时间，失败不写。省略字段保留，url和signup_deadline的null明确清空。
- 有未取消的报名后不能改内外部（409 kind_locked）；已开放报名时不能清空报名截止时间（409 deadline_required）。
- 控制台只PATCH实际修改字段，单改说明不改原始时分；offline=true从公开列表移除，false恢复原记录。
- 比赛更新与competition.update审计同一事务，审计失败回滚，不发邮件。

源码：[app/server/src/routes/console/competitions.ts:59](../../../app/server/src/routes/console/competitions.ts#L59) · [app/console/src/lib/competitions.ts:113](../../../app/console/src/lib/competitions.ts#L113) · [app/console/src/pages/Competitions.vue:79](../../../app/console/src/pages/Competitions.vue#L79)

测试入口：[tests/server/competitions.test.ts](../../../tests/server/competitions.test.ts) · [tests/console/competitions.test.ts](../../../tests/console/competitions.test.ts) · [tests/web/portal-competitions.test.tsx](../../../tests/web/portal-competitions.test.tsx) · [tests/e2e/competitions.spec.mts](../../../tests/e2e/competitions.spec.mts)。生成器未执行这些测试。

### 删除比赛信息

标识：`flow:competition.delete`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/console/competitions/:competition_id`
- 能力：`competitions.manage`
- 读取：`competitions`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`competitions`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效全站sid，组织固定CONSOLE_ORG，写口独立检查competitions.manage；客户端不能自报角色或org。
- 共同身份路径：读取sessions与称号/部门权限，使用本人GitHub token查角色并缓存60秒；过期会话删除，上游拒绝token时删除并审计，不代表成功读取总是写库。
- 200 {ok:true}；不存在或重复删除404。DELETE真删，暂时隐藏应使用下线。
- 有报名记录（含已取消）的比赛不能删除，回409 has_signups：历史名单要靠下线保留。
- 只删除本环境赛事记录，并与competition.delete审计在同一事务提交；审计失败保留赛事，业务删除不增加共同身份查询以外的外部请求。

源码：[app/server/src/routes/console/competitions.ts:84](../../../app/server/src/routes/console/competitions.ts#L84) · [app/console/src/pages/Competitions.vue:89](../../../app/console/src/pages/Competitions.vue#L89)

测试入口：[tests/server/competitions.test.ts](../../../tests/server/competitions.test.ts) · [tests/console/competitions.test.ts](../../../tests/console/competitions.test.ts) · [tests/web/portal-competitions.test.tsx](../../../tests/web/portal-competitions.test.tsx) · [tests/e2e/competitions.spec.mts](../../../tests/e2e/competitions.spec.mts)。生成器未执行这些测试。

### 读取我的参赛与待处理数

标识：`flow:competition.me.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/me/competitions`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：要有效会话（否则401 not_signed_in）且是极客班成员（否则403 not_member）；只按会话里的account_id取本人数据。
- 响应200 {items, pending_total}：每项含比赛、状态、我的state、队伍摘要（名称、状态、人数、team_max）与本人待处理数；未结束的比赛在前，已结束的在后。
- 角标口径是发给我的邀请加上我所在队伍收到的申请，我发出的申请不算；待处理明细只在本场相关人里下发（当事人自己的申请与邀请、本人所在队伍的待处理项），其他人看不到。
- 只读，不写业务表；门户自助操作不写审计。

源码：[app/server/src/routes/portal/competition-signups.ts:28](../../../app/server/src/routes/portal/competition-signups.ts#L28) · [app/server/src/lib/competition-signup-store.ts:735](../../../app/server/src/lib/competition-signup-store.ts#L735) · [app/server/src/lib/competition-contract.ts:95](../../../app/server/src/lib/competition-contract.ts#L95) · [app/server/src/routes/portal/contracts.ts:30](../../../app/server/src/routes/portal/contracts.ts#L30) · [app/web/sites/portal/components/os/competitions/CompetitionsApp.tsx:108](../../../app/web/sites/portal/components/os/competitions/CompetitionsApp.tsx#L108)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 读取我在一场比赛里的状态

标识：`flow:competition.my_status`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/competitions/:id/my-status`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：登录且是极客班成员；比赛不存在或已下线回404 not_found。
- 响应200 是我的状态：settings、writable、signup、state、team、role、pending、stats 与当前可执行的 actions；不做写操作。
- writable 只在已开放报名且状态为报名中时为真，此时 actions 才非空；state 由报名、队伍与比赛类型现算，不单独存储。
- stats 只含数字（报名、队伍、已确认队伍、已确认人数、未成队），不含其他成员的身份。

源码：[app/server/src/routes/portal/competition-signups.ts:30](../../../app/server/src/routes/portal/competition-signups.ts#L30) · [app/server/src/lib/competition-signup-store.ts:400](../../../app/server/src/lib/competition-signup-store.ts#L400) · [app/server/src/lib/competition-signup-store.ts:389](../../../app/server/src/lib/competition-signup-store.ts#L389) · [app/server/src/lib/competition-contract.ts:84](../../../app/server/src/lib/competition-contract.ts#L84) · [app/server/src/middleware/require-member.ts:14](../../../app/server/src/middleware/require-member.ts#L14) · [app/web/sites/portal/lib/account.ts:40](../../../app/web/sites/portal/lib/account.ts#L40) · [app/web/sites/portal/components/os/competitions/CompetitionHero.tsx:69](../../../app/web/sites/portal/components/os/competitions/CompetitionHero.tsx#L69) · [app/web/sites/portal/lib/competitionHub.ts:183](../../../app/web/sites/portal/lib/competitionHub.ts#L183)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 报名或修改报名

标识：`flow:competition.signup.upsert`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/competitions/:id/signup`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_signups`
- 不入队：
- 权限与资源：登录且是极客班成员，按account_id认人；不在报名中回409 signup_closed，未开放报名回409 signup_not_enabled，比赛不存在或下线404。
- 请求 {note?, looking_for_team?}：备注取首尾空白后最多200字（bad_note 400）；个人赛忽略找队伍勾选。
- 重复报名幂等：保留created_at，只更新备注与勾选；已取消的报名重新置为active并清cancelled_at。
- 写操作在一个事务里重读状态再写，成功回最新我的状态；限流每人每分钟30次（429 rate_limited）。

源码：[app/server/src/routes/portal/competition-signups.ts:35](../../../app/server/src/routes/portal/competition-signups.ts#L35) · [app/server/src/lib/competition-signup-store.ts:477](../../../app/server/src/lib/competition-signup-store.ts#L477) · [app/server/src/lib/competition-signup-store.ts:155](../../../app/server/src/lib/competition-signup-store.ts#L155) · [app/server/src/lib/competition-contract.ts:155](../../../app/server/src/lib/competition-contract.ts#L155) · [app/web/sites/portal/components/os/competitions/HubDialog.tsx:159](../../../app/web/sites/portal/components/os/competitions/HubDialog.tsx#L159)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 取消报名

标识：`flow:competition.signup.cancel`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/competitions/:id/signup`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_signups`、`competition_teams`、`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员；未报名回409 not_signed_up；已锁定队伍回409 team_locked，领队队里还有别人回409 is_team_leader。
- 取消只把报名改成cancelled并记cancelled_at，不删行；普通队员的成员关系改left，只有自己一人的队伍随之解散（成员记录改disbanded）。
- 本人在这场的待处理申请与邀请一并关闭（申请改withdrawn，邀请改declined）；成功回最新我的状态。
- 取消后报名截止前可以重新报名；限流每人每分钟30次。

源码：[app/server/src/routes/portal/competition-signups.ts:40](../../../app/server/src/routes/portal/competition-signups.ts#L40) · [app/server/src/lib/competition-signup-store.ts:497](../../../app/server/src/lib/competition-signup-store.ts#L497) · [app/server/src/lib/competition-signup-store.ts:485](../../../app/server/src/lib/competition-signup-store.ts#L485)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 读取未解散队伍

标识：`flow:competition.teams.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/competitions/:id/teams`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：登录且是极客班成员；比赛不存在或下线404。
- 响应200 {teams}：每支未解散队伍含队名、口号、状态（recruiting/locked）、领队账号、在队成员（账号、登录名、头像、角色、入队时间）、人数与建队时间。
- 只返回在队成员；待处理申请与邀请不在这里下发，避免把别人的申请暴露给全体成员。

源码：[app/server/src/routes/portal/competition-signups.ts:43](../../../app/server/src/routes/portal/competition-signups.ts#L43) · [app/server/src/lib/competition-signup-store.ts:342](../../../app/server/src/lib/competition-signup-store.ts#L342) · [app/server/src/lib/competition-contract.ts:99](../../../app/server/src/lib/competition-contract.ts#L99)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 读取找队友名单

标识：`flow:competition.free_agents.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/competitions/:id/free-agents`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：登录且是极客班成员；比赛不存在或下线404。
- 响应200 {people}：已报名、勾选找队友且当前不在任何队伍的人，含账号、登录名、头像、本人留言与开始找队伍的时间；按报名先后排。
- 只读；邀请入口只在门户的找队友页给领队，服务端在 invite 里另行校验。

源码：[app/server/src/routes/portal/competition-signups.ts:48](../../../app/server/src/routes/portal/competition-signups.ts#L48) · [app/server/src/lib/competition-signup-store.ts:306](../../../app/server/src/lib/competition-signup-store.ts#L306) · [app/server/src/lib/competition-contract.ts:100](../../../app/server/src/lib/competition-contract.ts#L100)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 创建队伍

标识：`flow:competition.team.create`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/competitions/:id/teams`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_teams`、`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员；未报名409 not_signed_up，个人赛409 individual_competition，已在队409 already_in_team。
- 队名取首尾空白后按Unicode字符计2–30（bad_team_name），口号最多60（bad_slogan）；同一比赛未解散队伍按trim+NFKC+小写查重，重复回409 duplicate_team_name。
- 201 建队人即领队：写一条队伍（recruiting）与一条active成员关系，回最新我的状态；不隐式报名。
- 写在一个事务里，唯一索引兜底并发；限流每人每分钟30次。

源码：[app/server/src/routes/portal/competition-signups.ts:53](../../../app/server/src/routes/portal/competition-signups.ts#L53) · [app/server/src/lib/competition-signup-store.ts:542](../../../app/server/src/lib/competition-signup-store.ts#L542) · [app/server/src/lib/competition-signup-store.ts:543](../../../app/server/src/lib/competition-signup-store.ts#L543) · [app/server/src/lib/competition-signup-store.ts:529](../../../app/server/src/lib/competition-signup-store.ts#L529) · [app/web/sites/portal/components/os/competitions/Avatar.tsx:23](../../../app/web/sites/portal/components/os/competitions/Avatar.tsx#L23) · [app/web/sites/portal/components/os/competitions/HubDialog.tsx:193](../../../app/web/sites/portal/components/os/competitions/HubDialog.tsx#L193)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 申请加入队伍

标识：`flow:competition.team.apply`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/teams/:id/apply`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员；队伍不存在或已解散404 team_not_found；未报名409 not_signed_up，已在队409 already_in_team。
- 队伍已锁定409 team_locked，满员409 team_full，已有待处理申请或邀请409 already_applied / already_invited；留言最多100字（bad_message）。
- 201 写一条applied成员关系；领队同意前不影响队伍名单，同一队伍对同一人只有一条待处理记录。

源码：[app/server/src/routes/portal/competition-signups.ts:59](../../../app/server/src/routes/portal/competition-signups.ts#L59) · [app/server/src/lib/competition-signup-store.ts:579](../../../app/server/src/lib/competition-signup-store.ts#L579) · [app/server/src/lib/competition-signup-store.ts:564](../../../app/server/src/lib/competition-signup-store.ts#L564)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 领队邀请成员

标识：`flow:competition.team.invite`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/teams/:id/invite`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员，并且是该队领队（否则403 not_team_leader）；队伍不存在或解散404 team_not_found。
- 请求 {account_id}：对方须已报名本场且未入队（409 invitee_not_signed_up / already_in_team），账号须为active（409 target_not_member）；不能邀请自己。
- 队伍已锁定409 team_locked，满员409 team_full，已有待处理关系409 already_applied / already_invited；201 写一条invited成员关系。

源码：[app/server/src/routes/portal/competition-signups.ts:64](../../../app/server/src/routes/portal/competition-signups.ts#L64) · [app/server/src/lib/competition-signup-store.ts:600](../../../app/server/src/lib/competition-signup-store.ts#L600) · [app/server/src/lib/competition-signup-store.ts:602](../../../app/server/src/lib/competition-signup-store.ts#L602) · [app/server/src/lib/competition-signup-store.ts:590](../../../app/server/src/lib/competition-signup-store.ts#L590)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 处理申请与邀请

标识：`flow:competition.team.respond`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/teams/:id/respond`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_team_members`
- 不入队：
- 权限与资源：成员关系必须属于路径上的队伍，否则404 not_found；申请只能由领队同意或拒绝、申请人撤回（否则403 not_team_leader），邀请只能由被邀请人接受或拒绝、领队撤回。
- 已处理的关系回409 invalid_state；接受时队伍已锁定409 team_locked、满员409 team_full，对方已不是成员409 target_not_member，对方已有队伍409 already_in_team。
- 接受后写active关系，并关闭这个人在本场的其他待处理关系；满员时本队其余待处理关系一并关闭。成功回最新我的状态。
- 限流每人每分钟30次；动作只有accept / decline / withdraw。

源码：[app/server/src/routes/portal/competition-signups.ts:69](../../../app/server/src/routes/portal/competition-signups.ts#L69) · [app/server/src/lib/competition-signup-store.ts:631](../../../app/server/src/lib/competition-signup-store.ts#L631) · [app/server/src/lib/competition-signup-store.ts:642](../../../app/server/src/lib/competition-signup-store.ts#L642) · [app/server/src/lib/competition-signup-store.ts:617](../../../app/server/src/lib/competition-signup-store.ts#L617) · [app/web/sites/portal/components/os/competitions/TeamHub.tsx:64](../../../app/web/sites/portal/components/os/competitions/TeamHub.tsx#L64)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 队员退出队伍

标识：`flow:competition.team.leave`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/teams/:id/leave`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员，且是本队在队队员（否则404 not_found）；领队不能直接退出（409 is_team_leader），要转让或解散。
- 队伍已锁定（含已确认参赛）回409 team_locked；成功把成员关系改成left并回最新我的状态，报名保留、回到未组队。
- 可写窗口与报名一致：未开放报名409 signup_not_enabled，不在报名中409 signup_closed。

源码：[app/server/src/routes/portal/competition-signups.ts:75](../../../app/server/src/routes/portal/competition-signups.ts#L75) · [app/server/src/lib/competition-signup-store.ts:655](../../../app/server/src/lib/competition-signup-store.ts#L655) · [app/server/src/lib/competition-signup-store.ts:664](../../../app/server/src/lib/competition-signup-store.ts#L664)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 转让领队

标识：`flow:competition.team.transfer`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/teams/:id/transfer`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_teams`、`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员，并且是该队领队（否则403 not_team_leader）；新领队须是本队在队队员（否则404 not_found）且账号active（409 target_not_member）。
- 队伍已锁定回409 team_locked；成功在同一事务里改队伍的leader_account_id与两条成员关系的role，回最新我的状态。
- 转让不改变报名、人数与状态，也不产生审计。

源码：[app/server/src/routes/portal/competition-signups.ts:79](../../../app/server/src/routes/portal/competition-signups.ts#L79) · [app/server/src/lib/competition-signup-store.ts:684](../../../app/server/src/lib/competition-signup-store.ts#L684) · [app/server/src/lib/competition-signup-store.ts:680](../../../app/server/src/lib/competition-signup-store.ts#L680)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 解散队伍

标识：`flow:competition.team.disband`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/teams/:id`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_teams`、`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员，并且是该队领队（否则403 not_team_leader）；队伍不存在或已解散404 team_not_found。
- 解散只改状态：队伍改disbanded并记disbanded_at，在队成员改disbanded、待处理关系改declined或withdrawn，不物理删除。
- 成员回到已报名、未组队；截止后不可解散（409 signup_closed）。成功回最新我的状态。

源码：[app/server/src/routes/portal/competition-signups.ts:83](../../../app/server/src/routes/portal/competition-signups.ts#L83) · [app/server/src/lib/competition-signup-store.ts:700](../../../app/server/src/lib/competition-signup-store.ts#L700) · [app/server/src/lib/competition-signup-store.ts:691](../../../app/server/src/lib/competition-signup-store.ts#L691)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 确认参赛并锁定名单

标识：`flow:competition.team.lock`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/teams/:id/lock`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_teams`、`competition_team_members`
- 不入队：
- 权限与资源：登录且是极客班成员，并且是该队领队（否则403 not_team_leader）；已锁定回409 invalid_state。
- 在队人数少于报名设置的最低人数回409 team_too_small；成功后队伍改locked并记locked_at，本队其余待处理关系关闭。
- 锁定后不再接受申请与邀请、成员不能退出，要调整先撤销确认；截止那一刻的名单就是最终名单，未确认的队伍不计入参赛。

源码：[app/server/src/routes/portal/competition-signups.ts:86](../../../app/server/src/routes/portal/competition-signups.ts#L86) · [app/server/src/lib/competition-signup-store.ts:713](../../../app/server/src/lib/competition-signup-store.ts#L713) · [app/server/src/lib/competition-signup-store.ts:715](../../../app/server/src/lib/competition-signup-store.ts#L715)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 撤销确认参赛

标识：`flow:competition.team.unlock`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`DELETE /api/teams/:id/lock`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`competition_teams`
- 不入队：
- 权限与资源：登录且是极客班成员，并且是该队领队（否则403 not_team_leader）；未锁定回409 invalid_state。
- 撤销只把队伍改回recruiting并清locked_at，成员与报名不变；截止后不可撤销（409 signup_closed）。
- 成功回最新我的状态；限流每人每分钟30次。

源码：[app/server/src/routes/portal/competition-signups.ts:89](../../../app/server/src/routes/portal/competition-signups.ts#L89) · [app/server/src/lib/competition-signup-store.ts:730](../../../app/server/src/lib/competition-signup-store.ts#L730) · [app/server/src/lib/competition-signup-store.ts:721](../../../app/server/src/lib/competition-signup-store.ts#L721)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 读取积分天梯

标识：`flow:competition.leaderboard.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/competitions/:id/leaderboard`
- 能力：
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`competition_score_events`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：登录且是极客班成员；比赛不存在或下线404 not_found；没有开启积分回409 scoring_not_enabled。
- 响应200 {updated_at, individuals, teams}：个人榜含本场全部未取消报名者（0分也列）与所在队伍，队伍分是当前在队成员个人分之和。
- 同分并列同名次并跳号（1,1,3）：个人按积分降序、报名先后；队伍按积分降序、建队先后。撤销的记录不计分。
- 只读；updated_at 取本场积分记录的最后写入或撤销时间，官网每30秒刷新。

源码：[app/server/src/routes/portal/competition-signups.ts:92](../../../app/server/src/routes/portal/competition-signups.ts#L92) · [app/server/src/lib/competition-score-store.ts:173](../../../app/server/src/lib/competition-score-store.ts#L173) · [app/server/src/lib/competition-score-store.ts:185](../../../app/server/src/lib/competition-score-store.ts#L185) · [app/server/src/lib/competition-contract.ts:148](../../../app/server/src/lib/competition-contract.ts#L148) · [app/web/sites/portal/components/os/competitions/Leaderboard.tsx:129](../../../app/web/sites/portal/components/os/competitions/Leaderboard.tsx#L129)

测试入口：[tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/web/portal-competition-hub.test.tsx](../../../tests/web/portal-competition-hub.test.tsx)。生成器未执行这些测试。

### 读取单场比赛公开信息

标识：`flow:competition.public.detail`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/public/competitions/:id`
- 能力：
- 读取：`competitions`、`competition_signup_settings`
- 写入：
- 不入队：
- 匿名只读；比赛不存在或已下线一律404 not_found，不区分两种原因。
- 响应200 与公开列表项字段一致，另带报名摘要 settings（是否开放、个人或团队、人数、积分），不含报名人数、队伍与任何成员信息。
- 只在这个成功响应上放开 Access-Control-Allow-Origin: *，只读、不带 cookie；为比赛官网的状态卡片预留。
- 不读会话、不写库、不发外部请求。

源码：[app/server/src/routes/portal/competitions.ts:24](../../../app/server/src/routes/portal/competitions.ts#L24) · [app/server/src/lib/competition-contract.ts:36](../../../app/server/src/lib/competition-contract.ts#L36) · [app/server/src/routes/portal/contracts.ts:10](../../../app/server/src/routes/portal/contracts.ts#L10)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts)。生成器未执行这些测试。

### 设置报名与积分开关

标识：`flow:competition.signup_settings.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PUT /api/console/competitions/:competition_id/signup-settings`
- 能力：`competitions.manage`
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`audit_logs`
- 写入：`competition_signup_settings`、`audit_logs`
- 不入队：
- 权限与资源：有效全站sid与competitions.manage；比赛不存在404。
- 请求 {enabled, participation, scoring, team_min, team_max} 整体写入：开开放报名但比赛没有报名截止时间回409 deadline_required；团队赛人数须1–20且min≤max（400 bad_team_size），不得小于现有最大队伍（409 team_size_conflict）。
- 有未取消的报名后不能改参赛形式（409 has_signups）；关闭报名保留已有数据。
- 写入与competition.signup_settings.update审计同一事务，details只记五个字段（是否开放、参赛形式、两个人数、计分），审计失败一起回滚；限流每分钟30次。

源码：[app/server/src/routes/console/competition-roster.ts:32](../../../app/server/src/routes/console/competition-roster.ts#L32) · [app/server/src/lib/competition-signup-store.ts:814](../../../app/server/src/lib/competition-signup-store.ts#L814) · [app/server/src/lib/competition-signup-store.ts:815](../../../app/server/src/lib/competition-signup-store.ts#L815) · [app/server/src/lib/competition-signup-store.ts:817](../../../app/server/src/lib/competition-signup-store.ts#L817) · [app/server/src/lib/competition-contract.ts:123](../../../app/server/src/lib/competition-contract.ts#L123) · [app/server/src/routes/console/contracts.ts:219](../../../app/server/src/routes/console/contracts.ts#L219) · [app/console/src/lib/competition-hub.ts:67](../../../app/console/src/lib/competition-hub.ts#L67)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/console/competition-hub.test.ts](../../../tests/console/competition-hub.test.ts)。生成器未执行这些测试。

### 读取报名名单与统计

标识：`flow:competition.roster.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/competitions/:competition_id/roster`
- 能力：`competitions.manage`
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：
- 不入队：
- 权限与资源：有效全站sid与competitions.manage；比赛不存在404，已下线的仍可读。
- 响应200 {settings, stats, signups, teams}：报名含已取消的，队伍含已解散的；每条报名带账号、登录名、头像、状态、留言、找队伍标记、队伍与角色、报名与取消时间。
- 统计五个数字：报名（外部比赛叫意向）、队伍、已确认队伍、已确认人数、未成队；个人赛的未成队为0。
- 只读，不写审计；名单含成员登录名与留言，只在控制台下发。

源码：[app/server/src/routes/console/competition-roster.ts:50](../../../app/server/src/routes/console/competition-roster.ts#L50) · [app/server/src/lib/competition-signup-store.ts:773](../../../app/server/src/lib/competition-signup-store.ts#L773) · [app/server/src/lib/competition-contract.ts:118](../../../app/server/src/lib/competition-contract.ts#L118) · [app/console/src/lib/competition-hub.ts:101](../../../app/console/src/lib/competition-hub.ts#L101) · [app/console/src/pages/CompetitionHub.vue:45](../../../app/console/src/pages/CompetitionHub.vue#L45)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/console/competition-hub.test.ts](../../../tests/console/competition-hub.test.ts)。生成器未执行这些测试。

### 导出报名名单CSV

标识：`flow:competition.roster.export`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/competitions/:competition_id/roster.csv`
- 能力：`competitions.manage`
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_teams`、`competition_team_members`、`sessions`、`role_assignments`、`departments`、`titles`、`users`、`identities`
- 写入：`audit_logs`
- 不入队：
- 权限与资源：有效全站sid与competitions.manage；比赛不存在404；限流每分钟5次，超出429。
- 响应 text/csv; charset=utf-8：UTF-8 BOM、CRLF，附件文件名带比赛id与北京时间日期；列是 account_id、login、status、note、looking_for_team、team_name、role 与三个北京时间时间列。
- 每个单元格走csvCell防公式注入；导出成功后写competition.roster.export审计（details {rows}），审计失败不回文件。

源码：[app/server/src/routes/console/competition-roster.ts:60](../../../app/server/src/routes/console/competition-roster.ts#L60) · [app/server/src/routes/console/competition-roster.ts:76](../../../app/server/src/routes/console/competition-roster.ts#L76) · [app/server/src/lib/beijing-time.ts:22](../../../app/server/src/lib/beijing-time.ts#L22)

测试入口：[tests/server/competition-signups.test.ts](../../../tests/server/competition-signups.test.ts) · [tests/console/competition-hub.test.ts](../../../tests/console/competition-hub.test.ts)。生成器未执行这些测试。

### 读取积分记录

标识：`flow:competition.score_events.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/competitions/:competition_id/score-events`
- 能力：`competitions.manage`
- 读取：`competitions`、`competition_score_events`、`users`、`identities`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：
- 不入队：
- 权限与资源：有效全站sid与competitions.manage；比赛不存在404。
- 响应200 {events}：按登记时间倒序，每条含选手、类型（issue/pr/penalty）、仓库与编号、分值、说明、登记人登录名、状态与撤销原因。
- 撤销的记录照常返回并标revoked，不删行；没有开启积分的比赛回空列表。

源码：[app/server/src/routes/console/competition-roster.ts:88](../../../app/server/src/routes/console/competition-roster.ts#L88) · [app/server/src/lib/competition-score-store.ts:116](../../../app/server/src/lib/competition-score-store.ts#L116) · [app/server/src/lib/competition-contract.ts:137](../../../app/server/src/lib/competition-contract.ts#L137)

测试入口：[tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/console/competition-hub.test.ts](../../../tests/console/competition-hub.test.ts)。生成器未执行这些测试。

### 登记积分

标识：`flow:competition.score_events.create`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/competitions/:competition_id/score-events`
- 能力：`competitions.manage`
- 读取：`competitions`、`competition_signup_settings`、`competition_signups`、`competition_score_events`、`users`、`identities`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`competition_score_events`、`audit_logs`
- 不入队：
- 权限与资源：有效全站sid与competitions.manage；比赛不存在404；没有开启积分409 scoring_not_enabled。
- 请求 {account_id, kind, points, reason?}：选手必须已报名本场（409 not_signed_up）；issue 5–30、pr 15–100、penalty 固定 −50（400 bad_points）；issue/pr 必填 owner/name 仓库与正整数编号（400 bad_repo / bad_number），扣分不带这两个字段。
- 同一条Issue或PR已有有效记录回409 duplicate_score_event；201返回这条记录。
- 写入与competition.score.add审计同一事务，details只记比赛、选手、类型与分值；限流每分钟30次。

源码：[app/server/src/routes/console/competition-roster.ts:93](../../../app/server/src/routes/console/competition-roster.ts#L93) · [app/server/src/lib/competition-score-store.ts:135](../../../app/server/src/lib/competition-score-store.ts#L135) · [app/server/src/lib/competition-score-store.ts:62](../../../app/server/src/lib/competition-score-store.ts#L62) · [app/console/src/lib/competition-hub.ts:176](../../../app/console/src/lib/competition-hub.ts#L176)

测试入口：[tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/console/competition-hub.test.ts](../../../tests/console/competition-hub.test.ts)。生成器未执行这些测试。

### 撤销积分

标识：`flow:competition.score_events.revoke`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/competitions/:competition_id/score-events/:event_id/revoke`
- 能力：`competitions.manage`
- 读取：`competitions`、`competition_score_events`、`users`、`identities`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`competition_score_events`、`audit_logs`
- 不入队：
- 权限与资源：有效全站sid与competitions.manage；记录不存在或不属于这场比赛404 not_found；已撤销409 already_revoked。
- 请求 {reason?}（最多200字）：只把状态改成revoked并记撤销人、时间与原因，原分值与说明保留，不删行；撤销后不再计分。
- 写入与competition.score.revoke审计同一事务；限流每分钟30次。

源码：[app/server/src/routes/console/competition-roster.ts:110](../../../app/server/src/routes/console/competition-roster.ts#L110) · [app/server/src/lib/competition-score-store.ts:147](../../../app/server/src/lib/competition-score-store.ts#L147) · [app/server/src/lib/competition-score-store.ts:148](../../../app/server/src/lib/competition-score-store.ts#L148)

测试入口：[tests/server/competition-scores.test.ts](../../../tests/server/competition-scores.test.ts) · [tests/console/competition-hub.test.ts](../../../tests/console/competition-hub.test.ts)。生成器未执行这些测试。

### 下游应用读发现文档与公钥、发起授权、读 userinfo（OIDC）

标识：`flow:identity.oidc.protocol`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /oidc/*`
- 能力：
- 读取：`oauth_clients`、`oidc_payloads`、`oauth_grants`、`oauth_subjects`、`sessions`、`users`、`identities`、`forum_users`
- 写入：`oidc_payloads`、`oauth_subjects`、`sessions`
- 不入队：
- 权限与资源：发现文档与 JWKS 匿名；授权端点按登记的 client_id 与完全一致的 redirect_uri，只收 response_type=code 与 PKCE S256；userinfo 凭 Bearer 访问令牌。按 IP 每分钟计数：发现文档、JWKS、userinfo 与换令牌、撤销合计 600 次，授权端点另计 120 次；没配 OIDC_JWKS 时 404。
- 响应与错误：签发者 <PUBLIC_ORIGIN>/oidc，协议与主机按 PUBLIC_ORIGIN，不信请求头；未知客户端、错回调 400 中文错误页且不跳转；缺 PKCE 等带 error 回到下游；userinfo 只给 sub（pairwise）、name、preferred_username、picture，有 email scope 时给验证过的 email；账号不再是成员时 401。
- 数据与副作用：是否登录以本站 sid 为准，不是成员、换了账号或账号还没有登录邮箱（#273，允许过这个应用、签发者会话还在也一样）时进交互；交互、会话与授权码写 oidc_payloads；第一次给某 sector 发 sub 时写 oauth_subjects；不发 refresh token。

源码：[app/server/src/routes/oidc/index.ts:165](../../../app/server/src/routes/oidc/index.ts#L165) · [app/server/src/lib/oidc-provider.ts:74](../../../app/server/src/lib/oidc-provider.ts#L74) · [app/server/src/lib/oidc-store.ts:52](../../../app/server/src/lib/oidc-store.ts#L52) · [app/server/src/lib/account-directory.ts:18](../../../app/server/src/lib/account-directory.ts#L18) · [app/server/src/lib/db.ts:462](../../../app/server/src/lib/db.ts#L462) · [app/server/src/lib/identity-store.ts:696](../../../app/server/src/lib/identity-store.ts#L696) · [app/server/src/lib/forum-store.ts:564](../../../app/server/src/lib/forum-store.ts#L564) · [app/web/sites/portal/lib/links.ts:14](../../../app/web/sites/portal/lib/links.ts#L14) · [app/web/shared/config/index.ts:33](../../../app/web/shared/config/index.ts#L33) · [app/web/sites/portal/components/os/Widgets.tsx:64](../../../app/web/sites/portal/components/os/Widgets.tsx#L64)

测试入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts)。生成器未执行这些测试。

### 下游应用换令牌、撤销令牌（OIDC）

标识：`flow:identity.oidc.token`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /oidc/*`
- 能力：
- 读取：`oauth_clients`、`oidc_payloads`、`oauth_subjects`、`sessions`、`users`、`identities`、`forum_users`
- 写入：`oidc_payloads`、`oauth_subjects`、`sessions`
- 不入队：
- 权限与资源：换令牌与撤销要客户端认证（client_secret_basic 或 client_secret_post），停用的客户端 invalid_client；每个 IP 每分钟 600 次（和发现文档、JWKS、userinfo 共用，不和授权端点共用）。
- 响应与错误：授权码只能用一次、10 分钟有效，code_verifier 不对 invalid_grant；重放时撤销这份授权与它发出的令牌；200 回 access_token（1 小时）与 RS256 签名的 id_token，不发 refresh_token。
- 数据与副作用：请求体由 oidc-provider 自己读（这一层不挂 Fastify 的解析器）；令牌与授权码只存 oidc_payloads，不进日志。

源码：[app/server/src/routes/oidc/index.ts:160](../../../app/server/src/routes/oidc/index.ts#L160) · [app/server/src/lib/oidc-provider.ts:74](../../../app/server/src/lib/oidc-provider.ts#L74) · [app/server/src/lib/oidc-store.ts:52](../../../app/server/src/lib/oidc-store.ts#L52)

测试入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts)。生成器未执行这些测试。

### 签发者把浏览器带到交互入口：去登录、按 sid 登录或去同意页

标识：`flow:identity.oidc.interaction`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /oidc/interaction/:uid`
- 能力：
- 读取：`oidc_payloads`、`sessions`、`users`、`identities`、`forum_users`
- 写入：`oidc_payloads`、`sessions`
- 不入队：
- 权限与资源：凭这次交互的 cookie（路径 /oidc/interaction/<uid>）；每个 IP 每分钟 30 次。
- 响应与错误：交互过期或 cookie 不对 400 中文错误页；没有 sid 303 /signin?return_to=/oidc/interaction/<uid>；不是成员带 access_denied 回到下游；账号还没有登录邮箱时 303 /bind-email?return_to=/oidc/interaction/<uid>，绑好回到同一个交互（#273）；要同意时 303 /authorize?uid=<uid>。
- 数据与副作用：换过账号时先删掉签发者里旧账号的会话再按 sid 的账号登录，不走 oidc-provider 的登出确认页。

源码：[app/server/src/routes/oidc/index.ts:67](../../../app/server/src/routes/oidc/index.ts#L67) · [app/server/src/routes/oidc/contracts.ts:18](../../../app/server/src/routes/oidc/contracts.ts#L18) · [app/server/src/lib/oidc-provider.ts:74](../../../app/server/src/lib/oidc-provider.ts#L74) · [app/server/src/lib/account-directory.ts:18](../../../app/server/src/lib/account-directory.ts#L18) · [app/server/src/routes/oidc/index.ts:78](../../../app/server/src/routes/oidc/index.ts#L78)

测试入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts)。生成器未执行这些测试。

### 同意页读这次登录要什么

标识：`flow:identity.oidc.details`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /oidc/interaction/:uid/details`
- 能力：
- 读取：`oidc_payloads`、`oauth_clients`、`sessions`、`users`、`identities`、`forum_users`
- 写入：`sessions`
- 不入队：
- 权限与资源：要 sid（requireAuth）与这次交互的 cookie；只认发起这次登录的账号；每个 IP 每分钟 30 次。
- 响应与错误：200 {client:{id,name,host},scopes,account:{login,name,picture},expires_at}；账号还没有登录邮箱 403 email_required（#273）；交互过期 404 interaction_expired；不是要同意的交互或换了账号 409 interaction_mismatch；没登录 401。
- 数据与副作用：只读，不改交互。

源码：[app/server/src/routes/oidc/index.ts:114](../../../app/server/src/routes/oidc/index.ts#L114) · [app/server/src/middleware/http-policy.ts:40](../../../app/server/src/middleware/http-policy.ts#L40) · [app/server/src/routes/oidc/contracts.ts:19](../../../app/server/src/routes/oidc/contracts.ts#L19) · [app/console/src/pages/Authorize.vue:57](../../../app/console/src/pages/Authorize.vue#L57) · [app/console/src/lib/authorize.ts:18](../../../app/console/src/lib/authorize.ts#L18) · [app/console/src/router.ts:18](../../../app/console/src/router.ts#L18) · [app/console/src/mock/index.ts:39](../../../app/console/src/mock/index.ts#L39) · [app/console/src/pages/Authorize.vue:46](../../../app/console/src/pages/Authorize.vue#L46)

测试入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts) · [tests/console/authorize.test.ts](../../../tests/console/authorize.test.ts)。生成器未执行这些测试。

### 本人允许一个应用用极客班账号登录

标识：`flow:identity.oidc.confirm`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /oidc/interaction/:uid/confirm`
- 能力：
- 读取：`oidc_payloads`、`sessions`
- 写入：`oidc_payloads`、`oauth_grants`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：要 sid、同源 Origin 与这次交互的 cookie；只认发起这次登录的账号；每个 IP 每分钟 20 次。
- 响应与错误：200 {redirect_to}，前端整页跳过去继续授权；账号还没有登录邮箱 403 email_required（#273）；过期 404 interaction_expired，换了账号 409 interaction_mismatch。
- 数据与副作用：把缺的 scope 与声明加进授权并保存，记进 oauth_grants（之后同一应用登录不再问）；写 audit_logs oidc.consent，只含 client_id 与 scope。

源码：[app/server/src/routes/oidc/index.ts:131](../../../app/server/src/routes/oidc/index.ts#L131) · [app/server/src/routes/oidc/contracts.ts:32](../../../app/server/src/routes/oidc/contracts.ts#L32) · [app/console/src/pages/Authorize.vue:71](../../../app/console/src/pages/Authorize.vue#L71) · [app/server/src/routes/oidc/index.ts:108](../../../app/server/src/routes/oidc/index.ts#L108)

测试入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts) · [tests/console/authorize.test.ts](../../../tests/console/authorize.test.ts)。生成器未执行这些测试。

### 本人拒绝一个应用的登录请求

标识：`flow:identity.oidc.abort`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /oidc/interaction/:uid/abort`
- 能力：
- 读取：`oidc_payloads`、`sessions`
- 写入：`oidc_payloads`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：同 confirm：要 sid、同源 Origin 与这次交互的 cookie；每个 IP 每分钟 20 次。
- 响应与错误：200 {redirect_to}，下游收到 error=access_denied；过期 404，换了账号 409；没有登录邮箱也能拒绝（#273）。
- 数据与副作用：写 audit_logs oidc.deny；不写 oauth_grants。

源码：[app/server/src/routes/oidc/index.ts:148](../../../app/server/src/routes/oidc/index.ts#L148) · [app/server/src/routes/oidc/contracts.ts:33](../../../app/server/src/routes/oidc/contracts.ts#L33)

测试入口：[tests/server/oidc.test.ts](../../../tests/server/oidc.test.ts)。生成器未执行这些测试。

### 控制台查看每个账号在 GitLab 上的同步状态

标识：`flow:gitlab.accounts.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/gitlab/accounts`
- 能力：`roles.manage`、`roles.department.manage`
- 读取：`gitlab_accounts`、`users`、`identities`、`forum_users`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`
- 不入队：
- 权限与资源：有效全站 sid，roles.manage 或 roles.department.manage；不调用 GitLab。
- 响应与错误：200 {mode,gitlab_url,group,client_registered,accounts:[{account_id,login,username,gitlab_user_id,state,access_level,last_error,last_error_at,synced_at,pending}]}；pending 是现在还要做的事（同步关着时为空），client_registered 说明 gitlab 客户端登记了没有；没权限 403 missing_capability。
- 数据与副作用：只读。控制台「成员与权限」在 mode 不是 off 时多一列「GitLab」，按 account_id 对上名单。

源码：[app/server/src/routes/console/gitlab.ts:20](../../../app/server/src/routes/console/gitlab.ts#L20) · [app/server/src/routes/console/contracts.ts:140](../../../app/server/src/routes/console/contracts.ts#L140) · [app/server/src/lib/gitlab-sync.ts:81](../../../app/server/src/lib/gitlab-sync.ts#L81) · [app/server/src/routes/console/index.ts:33](../../../app/server/src/routes/console/index.ts#L33) · [app/console/src/pages/People.vue:48](../../../app/console/src/pages/People.vue#L48) · [app/console/src/lib/gitlab.ts:80](../../../app/console/src/lib/gitlab.ts#L80) · [app/console/src/mock/console.ts:757](../../../app/console/src/mock/console.ts#L757) · [app/console/src/lib/types.ts:91](../../../app/console/src/lib/types.ts#L91)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts) · [tests/console/gitlab.test.ts](../../../tests/console/gitlab.test.ts)。生成器未执行这些测试。

### 控制台立即同步一个账号到 GitLab

标识：`flow:gitlab.accounts.sync`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`POST /api/console/gitlab/accounts/:account_id/resync`
- 能力：`roles.manage`
- 读取：`gitlab_accounts`、`users`、`identities`、`forum_users`、`forum_avatars`、`oauth_subjects`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`gitlab_accounts`、`oauth_subjects`、`audit_logs`、`sessions`
- 不入队：
- 权限与资源：有效全站 sid、同源 Origin、roles.manage；每个 IP 每分钟 30 次；用服务端的 GITLAB_API_TOKEN 调 GitLab 管理接口，不用操作人的凭据。
- 响应与错误：200 {mode,account_id,login,actions,applied,error}；GITLAB_SYNC=off 时 409 gitlab_sync_off；账号不存在 404 account_not_found；GitLab 出错不回 5xx，写进 error 与 last_error。
- 数据与副作用：按 OIDC 身份（provider=openid_connect，extern_uid=gitlab 客户端 sector 的 sub）找或建 GitLab 用户、调组权限、封禁或解封、传头像（论坛头像或 256 像素的 GitHub 头像，200 KiB 以内，来源记进 avatar_source，#271）、同步邮箱（主邮箱、账号页绑的其它邮箱和 GitHub noreply 邮箱以已确认的加到 GitLab 用户名下，在极客班删掉的从 GitLab 删掉，记进 emails_source，#272），从不删除 GitLab 用户；dry-run 只返回 actions 不写；写 audit_logs gitlab.sync，操作人是会话账号。

源码：[app/server/src/routes/console/gitlab.ts:24](../../../app/server/src/routes/console/gitlab.ts#L24) · [app/server/src/routes/console/contracts.ts:147](../../../app/server/src/routes/console/contracts.ts#L147) · [app/server/src/lib/gitlab-sync.ts:81](../../../app/server/src/lib/gitlab-sync.ts#L81) · [app/server/src/lib/db.ts:509](../../../app/server/src/lib/db.ts#L509) · [app/server/src/lib/identity-store.ts:702](../../../app/server/src/lib/identity-store.ts#L702) · [app/console/src/pages/People.vue:182](../../../app/console/src/pages/People.vue#L182) · [app/console/src/lib/gitlab.ts:76](../../../app/console/src/lib/gitlab.ts#L76) · [app/console/src/lib/types.ts:93](../../../app/console/src/lib/types.ts#L93)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts) · [tests/console/gitlab.test.ts](../../../tests/console/gitlab.test.ts)。生成器未执行这些测试。

### 控制台查看 GitLab 同步的健康状态与上一轮对账小结

标识：`flow:gitlab.status.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/gitlab/status`
- 能力：`roles.manage`、`roles.department.manage`
- 读取：`gitlab_accounts`、`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`
- 不入队：
- 权限与资源：有效全站 sid，roles.manage 或 roles.department.manage；版本号与健康检查用服务端的 GITLAB_API_TOKEN 连 GitLab，不经调用者凭据。
- 响应与错误：200 {mode,url,group,token_configured,version,healthy,last_run:{at,changed,failed}|null,errors_24h}；没权限 403 missing_capability；没配 URL 或连不上时 version 为 null、healthy 为 false，不回 5xx。
- 数据与副作用：只读；last_run 是进程内存里上一轮 reconcile() 的小结，重启后清空；errors_24h 数的是 gitlab_accounts.last_error_at 落在过去 24 小时内的账号数，不是错误事件总数。

源码：[app/server/src/routes/console/gitlab.ts:32](../../../app/server/src/routes/console/gitlab.ts#L32) · [app/server/src/routes/console/contracts.ts:156](../../../app/server/src/routes/console/contracts.ts#L156) · [app/server/src/lib/gitlab-sync.ts:593](../../../app/server/src/lib/gitlab-sync.ts#L593) · [app/server/src/lib/gitlab-sync.ts:587](../../../app/server/src/lib/gitlab-sync.ts#L587)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts)。生成器未执行这些测试。

### 控制台查看 GitLab 组与项目清单（含私有）

标识：`flow:gitlab.projects.console.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/gitlab/projects`
- 能力：`roles.manage`、`roles.department.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`
- 不入队：
- 权限与资源：有效全站 sid，roles.manage 或 roles.department.manage；用服务端的 GITLAB_API_TOKEN 读 group 本身、子组与组内全部项目（含子组）。
- 响应与错误：200 {groups:[{id,full_path,name,visibility}],projects:[{id,path_with_namespace,name,description,visibility,web_url,http_url_to_repo,ssh_url_to_repo,last_activity_at,star_count}]}；没权限 403 missing_capability；没配 URL、连不上或 GitLab 拒绝时给空列表，不回 5xx。
- 数据与副作用：只读，不落库；服务端内存缓存 5 分钟（lib/cache.ts 的 cached()），同一个键 5 分钟内不重新调 GitLab。

源码：[app/server/src/routes/console/gitlab.ts:41](../../../app/server/src/routes/console/gitlab.ts#L41) · [app/server/src/routes/console/contracts.ts:165](../../../app/server/src/routes/console/contracts.ts#L165) · [app/server/src/lib/gitlab-sync.ts:610](../../../app/server/src/lib/gitlab-sync.ts#L610)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts)。生成器未执行这些测试。

### 门户公开查看 GitLab 上公开的代码仓库

标识：`flow:gitlab.projects.public.list`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/public/gitlab/projects`
- 能力：
- 读取：
- 写入：
- 不入队：
- 权限与资源：匿名可调，不需要登录；复用控制台同一份项目清单（5 分钟缓存），只读管理令牌看到的数据，自己按 visibility 过滤后再下发。
- 响应与错误：200 {projects:[{name,path_with_namespace,description,web_url,http_url_to_repo,last_activity_at}]}；只给 visibility=public 的项目，不含私有项目、不含 star_count 等内部字段；GitLab 没配、连不上或拒绝时 {projects:[],unavailable:true}，不回 5xx。
- 数据与副作用：只读，不落库，不需要会话；门户「代码仓库」应用据此渲染。

源码：[app/server/src/routes/portal/gitlab.ts:12](../../../app/server/src/routes/portal/gitlab.ts#L12) · [app/server/src/routes/portal/contracts.ts:13](../../../app/server/src/routes/portal/contracts.ts#L13) · [app/server/src/lib/gitlab-sync.ts:69](../../../app/server/src/lib/gitlab-sync.ts#L69)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts)。生成器未执行这些测试。

### 控制台查看 GitLab 同步设置

标识：`flow:gitlab.settings.read`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`GET /api/console/gitlab/settings`
- 能力：`roles.manage`、`roles.department.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`sessions`
- 不入队：
- 权限与资源：有效全站 sid，roles.manage 或 roles.department.manage；不连 GitLab，只读进程内的当前设置。
- 响应与错误：200 {sync_mode,group_path,interval_minutes,token_configured}；令牌只显示「已配置/未配置」，不下发真实值；没权限 403 missing_capability。
- 数据与副作用：只读；当前设置来自 env 的初始值与 app_state 里持久化的覆盖值合并后的运行时状态。

源码：[app/server/src/routes/console/gitlab.ts:43](../../../app/server/src/routes/console/gitlab.ts#L43) · [app/server/src/routes/console/contracts.ts:175](../../../app/server/src/routes/console/contracts.ts#L175) · [app/server/src/lib/gitlab-sync.ts:96](../../../app/server/src/lib/gitlab-sync.ts#L96)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts)。生成器未执行这些测试。

### 控制台修改 GitLab 同步设置（开关、组路径、对账间隔）

标识：`flow:gitlab.settings.update`；性质：显式声明并关联源码，不是自动证明业务正确。

- 操作：`PATCH /api/console/gitlab/settings`
- 能力：`roles.manage`
- 读取：`sessions`、`role_assignments`、`departments`、`titles`
- 写入：`app_state`、`sessions`
- 不入队：
- 权限与资源：有效全站 sid、同源 Origin、roles.manage；令牌只读 env，这个接口改不了。
- 响应与错误：200 {sync_mode,group_path,interval_minutes,token_configured}；group_path 格式不对 400 invalid_group_path；interval_minutes 超出 5–1440 由请求体 Schema 拒绝为 400 validation_error；把 sync_mode 改成 on 但没配 GITLAB_API_TOKEN 时 409 gitlab_token_missing；改成 on 或 dry-run 但没配 GITLAB_URL 时 409 gitlab_url_missing；没权限 403 missing_capability。
- 数据与副作用：改动写进 app_state（键 gitlab_settings），覆盖 env 的初始值，进程重启后从这里读回来；同时让运行中的对账定时器按新设置重新排（mode 开关或间隔变化都会先停当前这一轮再决定要不要重开），不新增审计记录。

源码：[app/server/src/routes/console/gitlab.ts:47](../../../app/server/src/routes/console/gitlab.ts#L47) · [app/server/src/routes/console/contracts.ts:179](../../../app/server/src/routes/console/contracts.ts#L179) · [app/server/src/lib/gitlab-sync.ts:652](../../../app/server/src/lib/gitlab-sync.ts#L652) · [app/server/src/lib/gitlab-sync.ts:101](../../../app/server/src/lib/gitlab-sync.ts#L101)

测试入口：[tests/server/gitlab-sync.test.ts](../../../tests/server/gitlab-sync.test.ts)。生成器未执行这些测试。

## 核验边界

- 这是源码与隔离运行时基线，不证明预发布或正式环境部署状态。
- 业务操作、基础设施和退役路由分别分类；自动 HEAD 单列。关闭静态托管提取，不枚举静态文件资源。
- 授权证据只覆盖直接可定位的检查，不推断所有条件、对象范围或间接调用。
- 请求 Schema 存在不等于请求语义完整；没有响应 Schema 的端点保持缺失，不生成虚假契约。
- 表结构来自空的内存数据库；没有读取业务记录，不代表旧库迁移已验证。
- 仅显式声明的业务流程有读写及副作用关系；没有声明的流程不伪造关系。
- 测试链接只是验证入口；生成器不把文件存在视为测试通过。
- app/forum 的 Nitro 接口和 Markdown 中间件单独按源码声明收录，不冒充本次实际启动过 Nitro；方法与挂载方式见对应源码及论坛合同。
