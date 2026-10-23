# Server 对外授权与 GitLab 账号同步（OIDC）

> 不同源的应用用极客班账号登录：核心服务内嵌一个 OpenID Connect 签发者，第一个下游是自建的 GitLab（`https://git.yangtzeu.work`）。同一模块按极客班账号在 GitLab 上建好用户、放进 `geek` 组，离开的封禁。

状态：`current` · 更新：2026-10-23 · 源码：`app/server/src/lib/oidc-store.ts`、`lib/oidc-provider.ts`、`lib/account-directory.ts`、`lib/gitlab-sync.ts`、`routes/oidc/`、`routes/console/gitlab.ts`、`cli/oidc.ts`；同意页 `app/console/src/pages/Authorize.vue` · 上级合同：[server](README.md) · issue：#270 · 决策：[ADR-0005](../../decisions/0005-sso-extend-core-server.md) 决策 3、8

## 签发者与端点

签发者是 `<PUBLIC_ORIGIN>/oidc`（正式 `https://yangtzeu.work/oidc`，预发布 `https://prev.yangtzeu.work/oidc`），由 `oidc-provider` 9.12.2 实现，挂在 Fastify 的 `/oidc/*` 下，不另起进程。没配 `OIDC_JWKS` 时路由照样注册，请求一律 404（本机、测试与项目地图都是这样）。

| 端点 | 用途 |
|---|---|
| `GET /oidc/.well-known/openid-configuration` | 发现文档 |
| `GET /oidc/jwks` | 验 ID Token 用的公钥（只有公钥部分） |
| `GET /oidc/auth` | 授权端点，浏览器从下游跳来 |
| `POST /oidc/token` | 换令牌，下游服务器调用，`client_secret_basic` 或 `client_secret_post` |
| `GET\|POST /oidc/me` | userinfo |
| `POST /oidc/token/revocation` | 撤销令牌 |
| `GET /oidc/interaction/:uid` | 交互入口：要登录或要本人同意时，签发者把浏览器带到这里 |
| `GET /oidc/interaction/:uid/details`、`POST …/confirm`、`POST …/abort` | 同意页 `/authorize?uid=` 读取与提交，要 `sid` |

只做授权码流程，PKCE 必须用 `S256`；不发 refresh token，访问令牌与 ID Token 1 小时，授权码 10 分钟，交互 10 分钟，签发者自己的会话 7 天，授权记录 180 天。动态注册、单点登出、implicit 与 hybrid 都不开，`OPTIONS` 不接（下游在服务端换令牌，不需要浏览器跨域）。声明只有三组：`openid`（`sub`）、`profile`（`name`、`preferred_username`、`picture`）、`email`（`email`、`email_verified`，只给验证过的 `canonical_email`）。`name` 与 `picture` 取论坛资料（显示名、上传的头像），没有时用登录名和 GitHub 头像。

协议端点按 IP 每分钟计数，下游服务器调用和浏览器跳转分开算：发现文档、JWKS、换令牌、撤销与 userinfo 合计 600 次（GitLab 每次登录都要从它自己的服务器调好几次，一个班同时登录都算在它一个 IP 上），其余（授权端点）120 次；交互入口与详情每分钟 30 次，同意与拒绝每分钟 20 次，超额 429 `rate_limited`。`/oidc/` 下经 Fastify 回复的（交互入口、同意页的三个接口）都带 `Cache-Control: no-store`；协议端点的缓存头由 `oidc-provider` 自己定。`oidc-provider` 内部出错（`server_error`）时记一条错误日志，只有路径、错误类型和错误代码。

## 登录与同意

1. 下游把浏览器带到 `/oidc/auth`。签发者自己的会话只是缓存，是否登录、是谁以本站 `sid` 为准：`sid` 没了、换了账号、或会话里的账号已经不是成员时都回到交互入口。
2. 交互入口没有 `sid` 时 303 到 `/signin?return_to=/oidc/interaction/<uid>`，登录完回到这里；账号不是成员（停用，或在控制台改成了不是成员）时带 `error=access_denied` 回到下游；这个浏览器换过极客班账号时先删掉签发者里旧账号的会话，再按现在的账号登录，不走 `oidc-provider` 自带的「先登出」确认页。
3. 第一次登录某个应用要本人同意：303 到 `/authorize?uid=<uid>`，页面写明应用名、回到哪个主机、要哪些信息和当前账号。允许后授权记在 `oauth_grants`，之后同一账号从同一应用登录不再问，换浏览器也不问；拒绝时带 `error=access_denied` 回到下游。同意与拒绝写审计 `oidc.consent`、`oidc.deny`。
4. 授权码重放时按规范撤销这份授权和它发出的令牌，下次登录要重新同意。

`sub` 按下游的 sector（回调地址的主机）生成 32 字节随机值，存在 `oauth_subjects`，不随登录或换签名密钥变化；GitLab 拿到的 `sub` 和别的应用不同，内部的 `account_id` 不下发。账号停用或不再是成员后，已经发出的访问令牌在 userinfo 处立刻失效（401），新的登录被拒；GitLab 上已登录的会话由下面的同步封禁收口：`GITLAB_SYNC=on` 时最长差一个同步周期（10 分钟）。同步不是 `on` 时没有人封禁，所以 GitLab 一侧的统一登录要在 `on` 之后再打开（见「GitLab 一侧的配置」）。

## 客户端与密钥

客户端只能用命令行登记，没有接口和页面。命令在目标机的 server 容器里执行，和服务共用同一个库：

```bash
# 生成签名私钥（RSA 2048 的 JWK Set，输出一行 base64），原样写进目标机 .env.<环境> 的 OIDC_JWKS（环境文件的密钥不收引号，不用 JSON 原文）
docker compose … exec server node app/server/dist/cli/oidc.js keygen > 某个 0600 文件
# 登记 GitLab；client_secret 只输出这一次，库里只存 AES-256-GCM 密文
docker compose … exec server node app/server/dist/cli/oidc.js client add --name GitLab --client-id gitlab \
  --redirect-uri https://git.yangtzeu.work/users/auth/openid_connect/callback
# 列出、换 secret（旧的立即失效）、停用、恢复
… oidc.js client list | client rotate --client-id gitlab | client disable --client-id gitlab | client enable --client-id gitlab
```

回调地址只收 `https`（本机 `127.0.0.1`、`localhost` 可以用 `http`），不带锚点和账号口令，同一客户端的回调地址必须同一个主机（它就是 sector）。GitLab 的 client id 必须是 `gitlab`：账号同步按这个客户端的回调主机算 `sub`，和签发者给 GitLab 的是同一个。签发者的 cookie 用 `SESSION_SECRET` 派生的密钥签名（`oidc_session`、`oidc_interaction`、`oidc_resume`），换 `SESSION_SECRET` 会让进行中的登录失效，不影响 `sub`。

## 数据

| 表 | 内容 | 读写方 |
|---|---|---|
| `oauth_clients` | 登记的下游：名称、回调地址、加密的 secret、`active`/`disabled` | `lib/oidc-store.ts` |
| `oauth_subjects` | `(sector_id, user_id) → sub`，两个方向都唯一 | `lib/oidc-store.ts` |
| `oauth_grants` | 本人允许过的 `(user_id, client_id) → grant_id` | `lib/oidc-store.ts` |
| `oidc_payloads` | `oidc-provider` 的会话、交互、授权码、令牌、授权（按 `expires_at` 每小时顺手清一次过期行） | `lib/oidc-store.ts` |
| `gitlab_accounts` | 极客班账号对应的 GitLab 用户 id、用户名、状态、组权限、最后一次错误 | `lib/gitlab-sync.ts` |

列与约束见 [数据模型](data-model.md)。

## GitLab 账号同步

`GITLAB_SYNC` 是 `off`（默认）、`dry-run`（只算出要做什么，不写表、不改 GitLab）或 `on`。不是 `off` 时要有 `GITLAB_URL`（GitLab 的 origin），`on` 时还要 `GITLAB_API_TOKEN`（GitLab 管理员的 `api` 令牌，密钥，只在目标机的 `.env`；`dry-run` 按本地记录算，不调用 GitLab，不要令牌）；`GITLAB_GROUP` 是成员进的组，默认 `geek`。`on` 时服务启动先对一次账，之后每 10 分钟一次，同一时间只跑一轮；同一个账号同一时间只同步一次，控制台的立即同步碰上定时对账时等它做完再算，是不是成员、什么角色按轮到这个账号时重读，不用这一轮开头的名单；这时已经查不到的账号（被合并进别的账号）什么都不做。服务停下时做完手上这个账号就结束这一轮。

- 每个是成员的极客班账号在 GitLab 上有一个用户，按 OIDC 身份认人：`provider = openid_connect`，`extern_uid` 是这个账号在 GitLab sector 的 `sub`。sector 取 client id 为 `gitlab` 的客户端的回调主机，不取 `GITLAB_URL`（它可以是内网地址）；这个客户端还没登记时 `on` 模式整轮跳过，记一条错误日志 `gitlab sync skipped`，控制台的 `client_registered` 为 `false`，立即同步回 `gitlab_client_missing`。先按身份找，找到就沿用（上次建到一半，或 GitLab 已经因为登录自动建了），找不到才建。
- 用户名在第一次建号时定下，之后不改：有 GitHub 的用 GitHub 登录名，没有的用站内登录名；GitLab 的保留名、和组同名、或已被别人占用时依次加 `_yz`、`_yz2`。邮箱用验证过的 `canonical_email`，没有或在 GitLab 上被占用时用 `<用户名>@noreply.<sector>`（正式是 `@noreply.git.yangtzeu.work`）。建号带 `skip_confirmation` 与随机密码，成员不用密码登录。
- 资料在建号时补一次：论坛资料优先（显示名、简介、所在地、网站、上传的头像）；没有论坛资料的 GitHub 账号匿名读一次 GitHub 公开资料和头像（头像超过 1 MB 不传）。网站不是 http(s) 网址（没写协议的补 `https://`）就不传。读不到就只用登录名，不让同步失败。
- 组权限：舰员 Developer（30），提督 Owner（50）；角色变了就改。
- 停用、不再是成员的封禁（`block`），回来的解封；从不删除 GitLab 用户和他们的仓库。不是同步建的 GitLab 用户（例如 root）不碰。
- 还没同步过就离开的：只要他在 GitLab 的 sector 有过 `sub`（用极客班登录过 GitLab，GitLab 可能已经自动建了号），每一轮都按身份去 GitLab 找（还要做的事是 `find_and_block`），找到就记下这个用户并封禁；找不到、或者找的时候 GitLab 出错，这一轮什么也不改、不写审计（出错只算进这一轮的失败数），下一轮照样找，因为他可能回来、用极客班登录一次（GitLab 又自动建号）、在下一轮之前又离开。没有 `sub` 的不去找。
- 调 GitLab 管理接口不跟随跳转（跳到别的源时管理员令牌会跟过去），遇到跳转按 `gitlab_unreachable` 记。
- 失败写进 `last_error`（`gitlab_unreachable`、`gitlab_create_<状态码>`、`gitlab_member_<状态码>` 等），下一轮再试；写审计 `gitlab.sync`。控制台成员页的「GitLab」列显示这些状态和错误，能管理称号的人可以对有错或还有事要做的账号点「立即同步」。

控制台接口：`GET /api/console/gitlab/accounts`（`roles.manage` 或 `roles.department.manage`）列出每个账号的 GitLab 用户名、状态、组权限、最后一次错误和还要做的事，`client_registered` 说明 `gitlab` 客户端登记了没有；`POST /api/console/gitlab/accounts/:account_id/sync`（`roles.manage`，每分钟 30 次）立即同步一个账号，同步关着时 409 `gitlab_sync_off`，客户端没登记时 200 带 `error: gitlab_client_missing`。

## GitLab 一侧的配置

GitLab 只有一台，接正式环境的签发者；预发布用一个不同源的测试客户端验收，同步用 `dry-run`。顺序是先在正式环境登记 `gitlab` 客户端、把 `GITLAB_SYNC` 改成 `on` 并看到第一轮对账成功，再改 GitLab：同步没开时成员离开不会被封禁。`/etc/gitlab/gitlab.rb` 里加（secret 放在 root 0600 的文件里由 `File.read` 读入，不写进仓库）：

```ruby
gitlab_rails['omniauth_enabled'] = true
gitlab_rails['omniauth_allow_single_sign_on'] = ['openid_connect']
gitlab_rails['omniauth_block_auto_created_users'] = false
gitlab_rails['omniauth_auto_sign_in_with_provider'] = 'openid_connect'
gitlab_rails['omniauth_sync_profile_from_provider'] = ['openid_connect']
gitlab_rails['omniauth_sync_profile_attributes'] = ['name']
gitlab_rails['omniauth_providers'] = [{
  name: 'openid_connect', label: '极客班统一登录',
  args: {
    name: 'openid_connect', scope: ['openid', 'profile', 'email'], response_type: 'code',
    issuer: 'https://yangtzeu.work/oidc', discovery: true, client_auth_method: 'basic', uid_field: 'sub', pkce: true,
    client_options: { identifier: 'gitlab', secret: File.read('/etc/gitlab/yzgc-oidc-secret').strip,
                      redirect_uri: 'https://git.yangtzeu.work/users/auth/openid_connect/callback' },
  },
}]
```

自动跳转打开后 root 从 `/users/sign_in?auto_sign_in=false` 用密码登录。SSH 不对外开放，成员用 HTTPS 推拉代码时在 GitLab 的「访问令牌」里建个人令牌，当作密码用。

## 不做的事

- 不从 GitLab 往回同步任何东西；GitLab 上改的资料不回写极客班。
- 不删除 GitLab 用户；不管理 GitLab 组以外的项目权限。
- 不开放动态注册客户端，不做单点登出（退出极客班不会让 GitLab 退出，封禁由同步完成）。

## 测试

- `tests/server/oidc.test.ts`：发现文档与 JWKS、没登录去 `/signin`、首次同意与记住同意、pairwise `sub`、授权码重放撤销授权、错回调与未知客户端不跳转、PKCE 缺失与错误、拒绝、同意接口只认发起登录的账号、换账号、`sid` 结束后重新登录、不再是成员、停用客户端、过期交互、没配密钥时 404、限流（服务器调用与浏览器跳转分开算）、同意页详情不缓存、回调地址校验。
- `tests/server/gitlab-sync.test.ts`：用假的 GitLab 管理接口与 GitHub 公开资料核对建号、邮箱回退、用户名加后缀、封禁与解封、按身份沿用、没同步过就离开的按身份找到并封禁、立即同步与定时对账不同时做同一个账号、sector 取 `gitlab` 客户端、没登记客户端时不建号、不合法的网站不传、停下时结束这一轮、论坛资料优先、失败记录与重试、`dry-run` 与 `off`、控制台两个接口、`GITLAB_*` 与 `OIDC_JWKS` 的配置校验。
- `tests/console/authorize.test.ts`：同意页的纯逻辑（交互编号、接口地址、登录回跳、文案）。
