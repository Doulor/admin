# 安全模型与防护边界

> 区分核心后端授权、论坛服务端模式与本机演示；代码防护、真实环境配置和人工验收分别取证。

状态：`current` · 更新：2026-10-23

## 核心服务

保留 portal/admin 的服务端 requireAuth 及按组织审计；权限只认极客班账号的站内角色与称号（#262 第四期，见下文「权限只认极客班账号」），GitHub 组织资格只在 GitHub 新用户第一次登录注册时看。GitHub token 用 AES-256-GCM 加密，密钥解码必须为 32 字节；sid 是服务器会话，不在浏览器状态中产生管理权限。OAuth state 签名并检查十分钟有效期，回跳来源使用允许列表。Cookie 的 HttpOnly/Secure/SameSite 和共享 Domain 均需按真实部署验证，不称为完整 CSRF 或子域隔离。

**会话行的保留时间**：`sid` 有效期 7 天（`app/server/src/lib/auth.ts` 的 `SESSION_TTL_MS`）。过期会话由服务主动删除，不依赖本人再来访问：进程启动时清一次，之后每小时按 `expires_at` 批量 `DELETE`（`SESSION_CLEANUP_INTERVAL_MS`，计时器 unref，`app.close()` 时停掉）；一趟清理出错只记日志（带 SQLite 错误码），不抛出、不影响请求（#128）。所以服务运行期间，`sessions` 里的一行最多在过期后再留一个清理间隔（1 小时）；停机期间到期的行在下次启动时删掉。清理和登出都只删本站的会话行，**不**撤销 GitHub 端已经给出的授权（用户不登录也不会自动失去授权过的那几项；在 GitHub 上撤销要另做。配了 GitHub App 时 GitHub 登录只申请 `read:user user:email read:org`，没配时还要 `admin:org`、`repo`）。

**删掉的会话在库文件里也不留字节**：SQLite 默认只把删掉的行标成空闲，字节还在页里，在线备份会原样带走。`app/server/src/lib/db.ts` 给每个连接打开 `secure_delete`，删行、改短字段时把腾出来的空间写成 0；每趟清理删完之后做一次 `wal_checkpoint(TRUNCATE)`（`truncateWal`），把 WAL 写回库文件再截断：`data.db` 里的旧页被检查点覆盖，`-wal` 截成 0 字节。登出、读到过期、GitHub 拒绝令牌（#164）删掉的会话也在下一趟清理后不留字节。有别的连接正在读时这一趟截不成，不等待（不让事件循环卡在默认 5 秒的锁等待上），日志记 `wal truncate deferred`，下一趟再截。SQLite 在线 backup API 做的备份读的是最新的页，不带删掉的会话。`tests/server/session-cleanup.test.ts` 按字节核对 `data.db`、`-wal` 和在线备份里找不到被删会话的密文。

**还剩的**：打开 `secure_delete` 之前删掉的行（本改动上线前预发布、正式库里删过的会话），字节留在空闲空间里，要等被新数据覆盖；本机实测正常运行几趟之后 30 条里还剩 3 条，做一次 `VACUUM` 后为 0。在预发布、正式库上做 `VACUUM` 是对业务数据库的维护操作，要先获得授权，另开 issue。上面这些保证只到文件为止：`data.db`、`-wal` 和在线备份这几个文件里找不到被删会话的字节；`-wal` 截断时交还给文件系统的块并没有写成 0，文件系统释放的块、卷或磁盘的块级快照和裸盘镜像不在范围内，卷本身泄漏时这些块里可能还有旧密文。

**登录门槛：账号要是极客班成员。GitHub 新用户第一次登录要是 `CONSOLE_ORG` 的 active 成员才注册；用邮箱或 Google 第一次登录要凭邀请码注册；注册之后谁是成员由站内决定**（#262，所有者 2026-10-23，见下文「邮箱、Google 登录与邀请码注册」「权限只认极客班账号」）。官网、论坛、控制台共用这一个登录和同一个 `sid`。以下是 GitHub 这条路：`/auth/callback` 通过签名 state 校验、换到 token、取到 `/user` 之后，先看这个 GitHub 数字 id 有没有站内记过角色的账号（`lib/identity-store.ts` 的 `githubSigninPlan`）。有就由站内决定，不再查 GitHub 组织：在 GitHub 组织里被移出也照常能登录，站内改成「不是成员」才登录不了。没有账号、或是回填建的还没记过站内角色的老账号，才用这个 token 调 `GET /user/memberships/orgs/{CONSOLE_ORG}`（`app/server/src/lib/github.ts` 的 `getOwnMembership`，OAuth scope 含 `read:org`），查的是登录者自己的成员状态，不按用户名查别人。结果处理（`app/server/src/routes/admin/auth.ts`）：

- `active`：建会话、写 `sid`、审计 `auth.signin`，回到 `return_to`；新用户记为成员，只有站内还没有任何管理员时组织 owner 记为管理员（提督），给空库起步；回填建的、还没记过站内角色的老账号按查到的组织角色补记（owner 记为管理员，member 记为成员）。站内记过角色的账号不查组织，已不是成员时不建会话，审计 `auth.signin_denied`（`reason` 为 `not_member`），回 `signin=not_member`。会话绑定一个极客班账号（#262，`sessions.openid` = `users.id`，接口里叫 `account_id`）：按 GitHub **数字 id** 找身份，没有就建号（只有 GitHub 能建号），沿 `merged_into` 走到终点账号，按 GitHub id 认领还没认领的称号和论坛用户，插入会话、删掉请求带来的旧 `sid`、写审计，这些在一个 `BEGIN IMMEDIATE` 事务里（`lib/identity-store.ts` 的 `signInWithGithub`），任何一步失败整体回滚、按 `failed` 回登录页，旧会话照常有效。只有登录名、没有 GitHub id 的旧称号**不认领**：旧登录名可能已被别人注册。终点账号已停用：不建会话，审计 `auth.signin_denied`（`reason` 为 `account_disabled`），撤销授权，回 `signin=account_disabled`；合并链超过 8 跳或成环按 `failed`。读会话时没有账号（#262 之前留下、没有 GitHub id 的旧会话）或账号不是 `active` 的，一律按未登录处理并删掉这一行。
- 不是成员（GitHub 返回 404）或邀请还没接受（`pending`）：不建会话、不写 `sid`、不保存 token；审计 `auth.signin_denied`（`actor` 与 `target` 是 GitHub 登录名，`details` 为 `{ org, reason, provider }`，`reason` 取 `not_member` 或 `pending`，`provider` 是 `github`；这个 GitHub id 已经有还没记过站内角色的老账号时另写 `actor_account_id`，并把它的成员资格记成这次查到的结果）；尽力撤销这个用户对本应用的授权（`DELETE /applications/{client_id}/grant`，用应用自己的 client_id 与 secret 做 Basic 认证），撤销失败只记警告日志；302 到 `/signin` 并带 `signin=not_member` 或 `signin=invite_pending` 与原来的 `return_to` 路径。这条审计的 `org` 列为空，和登录、登出一样不经任何审计接口返回，只能在数据库里查。
- 换 token、取 `/user` 或成员查询出错（包括组织限制 OAuth App 访问时 GitHub 返回的 403）：一律按 `signin=failed` 回统一登录页，**不**当成「不是成员」；服务端只记一条带 `code`、`status`、request id 的错误日志，不含 token 和上游响应。
- 用户在 GitHub 授权页取消（`error=access_denied`）按 `signin=cancelled` 回登录页，GitHub 回传其它 `error` 按 `signin=failed` 回登录页。
- 登录之后，会话里存的令牌被 GitHub 以 401 拒绝（用户撤销了授权，或同一用户的令牌超过 10 个、最久没用的被收回）：只在用到本人令牌时发生（没配 GitHub App 时控制台的 GitHub 页面、老账号补记站内角色、`/api/me/orgs`）。这个会话结束，服务端删掉它、清 `sid`，回 401 `session_expired`，审计 `auth.session_rejected`；`/auth/me` 回 `{ signed_in: false, session_expired: true }`。人重新登录后拿新令牌（#164，细节见下文「失败语义」与 [API](API.md) 的上游错误映射）。服务器 GitHub App 的令牌被拒不算会话失效，回 503 `github_connection_failed`，会话照常有效。

以上回跳都先要求 state 有效，目标是校验过的 `return_to`（只接受 `PUBLIC_ORIGIN`，否则回 `<PUBLIC_ORIGIN>/console`）。**失败一律去统一登录页**：302 到 `${PUBLIC_ORIGIN}/signin?signin=<原因>&return_to=<原来要回的本站路径>`（`routes/admin/auth.ts` 的 `signinFailureUrl`），原路径里残留的 `signin` 参数先去掉；登录页与官网、论坛、控制台的「登录」入口都从这里出发，原因在登录页说清后可以直接换一种方式重试（#262）。登录页对 `return_to` 再做一次同源校验：只接受以单个 `/` 开头的同源路径（拒绝 `//`、`/\`、控制字符、绝对 URL 和带着用户名密码的地址），不合格一律回 `/console`，并且不回到 `/signin` 自己（`app/console/src/lib/signin.ts` 的 `safeReturnPath`）；服务端另按 `PUBLIC_ORIGIN` 校验一次（`lib/safe-return.ts`）。缺 `state`、既无 `code` 也无 `error`、state 签名或 cookie 不符，仍就地返回 400 JSON，不跳转；以 `forum-` 开头的旧论坛 state 返回 410。换 token、取 `/user`、撤销授权的请求 15 秒超时；Octokit 当前版本不读 `request.timeout`，所以默认的 Octokit 给它用的 `fetch` 套了 15 秒的 `AbortSignal.timeout`（`lib/github.ts` 的 `withTimeout`），成员查询和控制台的所有 GitHub 调用同样 15 秒超时。GitHub 连不上时登录尽快以 `failed` 回到登录页。不是成员的人拿不到会话：官网公开页面和论坛帖子不登录照样能看，控制台对他们只有登录页。

公开邀请/反馈/加入我们投递有限流、蜜罐、PoW 和可选 Turnstile。意见箱只收 `CONSOLE_ORG` 的意见：`POST /api/feedback` 的组织名不分大小写认它、按配置写法落库，别的组织名回 400、不落库（#129）。论坛的游客回复（`POST /api/forum/posts` 不带 `sid`）是另一个匿名写入口，同样要蜜罐、PoW（摘要输入 `${topicId}:${content}`）与可选 Turnstile，正文 ≤2000 字、昵称 1–20 字，昵称先做 NFKC、去掉首尾空白，再按允许清单收字符（`isAllowedName`），存的就是校验过的这个写法（不换行空格、全角空格这类字符存成普通空格，不会原样存下来显示得像没有空格）：汉字、常用拉丁字母（含拼音声调、越南文）、平假名、片假名、韩文（只收合成好的音节，单独的字母不收）、ASCII 数字，以及空格和 `- _ . · ・ '`，空格不能在首尾或连着用；看不见的字符、表情、其它文字（西里尔、希腊、亚美尼亚等的形近字母）和 IPA、小型大写这类形近拉丁字母都进不来。原来的屏蔽清单拦一种漏一种（第三轮审查又找到未分配的可忽略字符 U+2065、U+FFF0、U+E0080 和亚美尼亚、傈僳、切罗基的形近字母），所以换成允许清单。按 NFKC、不分大小写、去掉附加符号、把形近字折成同一个（ı 和 i、片假名カ和汉字力这类）、去掉所有空白和 `- _ . · ・ '` 之后（「极 客班」「极客班.」都算「极客班」），昵称不能与成员或官方账号的昵称、用户名相同，也不能是本地知道的组织成员的登录名：控制台里有称号的人（`role_assignments`）和登录过的人（审计里的 `auth.signin` 与当前会话，包括登录过的组织 owner），没打开过论坛的也算；成员改昵称同样只收这些字符，也不能等于官方账号的名字、别人的用户名或这些人里别人的登录名。昵称被占的回答（`guest_name_taken`）会透露某个名字是不是登录过或有称号的组织成员，所以这项检查放在限流和 PoW 之后；PoW 通过后每次尝试都记一次这个 IP 的回复额度，不管后面是昵称被占、人机验证没过还是发出去了，匿名探测和回复共用下面的额度、要先解 PoW，开了 Turnstile 时也分不出被占和没被占在额度上的差别。游客回复每个 IP 5 次/分钟、30 次/天，IPv6 按 /64 前缀计，全站游客回复合计每小时 200 次，超了所有游客暂停回复（`guest_replies_paused`），成员不受影响（都记在 `forum_rate_events`，重启不清零）；`GET /api/forum/state` 每个 IP 120 次/分钟、浏览接口 60 次/分钟（进程内计数）；游客不能发帖、编辑、删除或做其它写操作，每条游客回复是一个单独的游客用户，不能冒用成员身份。游客的来源 IP 只存在限流记录（最多一天）和浏览去重（最多一小时）里，不随帖子下发。反馈摘要与管理员回复经 `GET /api/feedback/public` 匿名可读：只返回 `CONSOLE_ORG`（组织名不分大小写）下非 `spam` 反馈的前 280 字、状态、回复和票数，别的组织名一律返回空列表，库里别的组织的历史行不再公开（#129）；`org` 与 `limit` 经本端点的 querystring 合同校验（`org` 不超过 39 字、重复给出回 400，`limit` 为正整数），最多返回 100 条（见 [API](API.md) 端点清单）；反馈正文因此按公开内容对待，用户指南已提示勿提交敏感信息。「加入我们」投递没有匿名读取接口；控制台的读取、详情和导出分别按对应能力授权，见 [API](API.md)。邀请先预留额度、再请求上游，明确失败补偿、未知结果保留待核对，不把超时解释为未发送。写请求核对 Origin 与 Fetch Metadata，返回错误不打印 token 或完整上游响应。鉴权 API 禁止缓存。公开文档使用允许列表，不公开内部运维、安全、规范和审查内容。论坛昵称的冒名检查还剩一个缺口：从没登录过、也没有称号的组织成员（包括从没登录过的组织 owner），本地没有这些人的登录名，游客和成员仍能用这些名字。

**客户端 IP 从哪来**：上面所有按 IP 的限流（邀请、反馈、投递、论坛），以及审计和投递里记的来源 IP，都取 Fastify 的 `req.ip`。部署链路是客户端 → 宿主 nginx → web 容器 nginx → server，两层 nginx 各往 `X-Forwarded-For` 末尾追加一段，所以两个环境都是 `TRUST_PROXY=2`：只信任这两层，客户端自己带的最左边几段不算。2026-09-26 之前两个环境写的是 `true`，信任整条链，`req.ip` 取的是客户端能随便填的最左边一段，换着填就能绕过所有按 IP 的限流，写进审计和投递的 IP 也能伪造（#116 审查发现，轮换 `X-Forwarded-For` 8 次 8 次成功）。改了反代拓扑要同时改两份 env 模板和 `scripts/deployment-environment.mjs` 的 `PROXY_HOPS`，`pnpm check:environments` 与 `tests/tooling/deployment-environment.test.ts` 核对层数与两份 nginx 配置一致。本机开发不设 `TRUST_PROXY`，只信任回环上的代理。

## 设备授权（RFC 8628，给 `geek login` 预留）

命令行的登录不走浏览器会话，按 RFC 8628 的 device authorization grant 换一个只能读账号资料的令牌（#262，源码 `app/server/src/lib/device-store.ts`、`app/server/src/routes/identity/device.ts`，接口见 [API](API.md)）：

- **授权对象是极客班账号**：确认页要极客班 SSO 会话（`requireAuth`），写进 `device_grants.account_id` 的是会话的 `account_id`（`users.id`），不是 GitHub id；账号不是 `active` 时确认后的轮询回 `access_denied`，已有令牌在 `/auth/device/userinfo` 立即失效，不用等过期。
- **凭据不入库、只发一次**：`device_code`（32 字节随机数）与 `access_token`（`gk_` 前缀加 32 字节随机数）只把 sha256 存进 `device_grants`，明文只出现在发码与换令牌的响应里；换过令牌的行改成 `consumed` 且记下令牌哈希，同一个 `device_code` 再轮询只会得到 `invalid_grant`。令牌 30 天到期，到期或账号停用后 `device_grants` 里的哈希不再能换成身份。
- **时限与节奏**：`user_code` 8 位、字符集去掉元音与易混字符（`BCDFGHJKLMNPQRSTVWXZ`），10 分钟有效；默认轮询间隔 5 秒，提前轮询回 `slow_down` 并把这一行的间隔加 5 秒写回，凭据泄漏时留给暴力尝试的窗口更小。
- **限流按接口分开**：发码 10 次/分钟、轮询 60 次/分钟、确认页读取 30 次/分钟（`user_code` 空间有限，查询也要挡枚举）、确认 20 次/分钟，都按 IP 计，超额 429。`user_code` 输入的字符集与长度先做校验，不合法按不存在处理。
- **确认页防钓鱼**：`/device` 显示客户端名（目前只有「极客班命令行」）、请求的 `scope`（逐项说成人话）、终端里那串代码与剩余时间，并在允许/拒绝上方明说「只有你刚在自己的电脑上运行了 `geek login`、终端里就是这串代码时才允许，别人发给你的代码不要确认」。代码不是 `pending` 或已经过期时不给按钮，只说明原因（过期、已被拒绝、已用过）。
- **跨站写入**：`POST /api/identity/device/approve` 是普通写请求，先经 `middleware/http-policy.ts` 的 Origin / Fetch Metadata 校验（外域 403 `invalid_origin`），会话 Cookie 是 `SameSite=Lax`，第三方站点不能带着会话替你确认。
- **接口面最小**：设备令牌只被 `GET /auth/device/userinfo` 接受，`sub` 与 `account_id` 都是极客班账号，`login`、`avatar_url` 是绑定的 GitHub 资料；其它接口仍只认会话 Cookie，令牌换不到任何控制台、论坛或 GitHub 能力。`verification_uri` 由 `PUBLIC_ORIGIN` 拼出（`<PUBLIC_ORIGIN>/device`），不写死域名，预发布与正式各自指向自己。
- **审计不留凭据**：允许与拒绝各写一条 `identity.device.approve` / `identity.device.deny`（`actor` 是操作者登录名、另记 `actor_account_id`），`details` 只有 `client_id` 与 `scope`，不记 `device_code`、令牌与 `user_code`；审计 `org` 列为空，不经任何接口返回。

## 邮箱、Google 登录与邀请码注册（#262）

所有者 2026-10-23 定：「目前开放注册，现在的github注册的都算组织成员，后续需要邀请码去注册」「验证码和密码都支持」「按站内称号认」。源码在 `lib/email-login.ts`、`lib/google.ts`、`lib/invite-codes.ts`、`lib/identity-store.ts`、`routes/identity/email.ts`、`google.ts`、`account.ts` 与 `routes/console/invites.ts`，接口见 [API](API.md)。

- **建号要邀请码**：邮箱或 Google 第一次登录、还没有极客班账号时，要一个可用的邀请码（没停用、没过期、次数没用完）。建号、兑换邀请码、占用验证码、建会话在一个 `BEGIN IMMEDIATE` 事务里，任何一步不成整体回滚，邀请码不白用、验证码不白丢。邀请码无效对外只说「无效」，不区分不存在、停用、过期和用完；邮箱登录时每填错一次邀请码也算一次验证码错误。邀请码由持有 `accounts.invites.manage` 的人在控制台管理，原文存库（管理员要看得到、复制得了），比较不分大小写；默认邀请码只在运维的钥匙串里，用 `dist/cli/account.js invite` 从标准输入写进库，不进仓库、种子、环境模板和日志。
- **验证码**：6 位数字，10 分钟有效，同一个码最多错 5 次；库里只存 HMAC（密钥派生自 `SESSION_SECRET`），不存原文，日志不记地址和验证码。挑战 id 放在签名、HttpOnly 的 cookie 里，登录用 `Path=/auth/email`，绑定用 `Path=/api/identity/email`；绑定的挑战还记着发起的账号和会话指纹，换了会话就不算数。发码限额按收件箱（60 秒一封、每小时 5 封）和来源 IP（IPv6 按 /64，每小时 20 封）计，数在 `email_challenges` 表里，重启不清零；超额 429 带 `Retry-After`。`/auth/email/start` 对有没有账号的邮箱响应一样，不泄露邮箱是否注册。
- **密码**：只能在账号页设，至少 15 位、UTF-8 不超过 72 字节（bcrypt 上限），bcrypt cost 12。密码登录对没账号、没设密码、密码不对回同一个错误，没有账号时也跑一次 bcrypt，响应时间不随邮箱是否注册变化；按 IP 每分钟 10 次之外，按邮箱另计 15 分钟 10 次（进程内计数）。设密码、绑定邮箱要求这次登录不超过 10 分钟（`step_up_required`）；已有密码时也可以填当前密码代替。忘了密码就用验证码登录后直接设新的。
- **日志**：请求日志不记 `/auth/*` 的查询串（`app.ts` 的 `requestLogFields`），OAuth 的 code、state 与 `/auth/google?invite=` 带的邀请码不进日志。
- **Google**：两个接口按 IP 限流（发起每分钟 20 次，回调每分钟 10 次），挡住反复走授权试邀请码。OIDC 授权码加 PKCE S256、state 与 nonce，只申请 `openid email profile`；ID Token 用 Google 的 JWKS 验签（RS256），核对 `iss`、`aud`、`exp`、`nonce`。按 Google 的 `sub` 认人，**不按邮箱自动合并账号**：Google 邮箱已经属于别的极客班账号时拒绝（`email_taken`），要用邮箱验证码登录那个账号。没配 `GOOGLE_CLIENT_ID` 与 `GOOGLE_CLIENT_SECRET` 时两个接口都是 404，登录页也不出现 Google。
- **没有 GitHub 令牌的会话**：邮箱、Google 会话没有本人的 GitHub 令牌。权限照常按账号给（见下文「权限只认极客班账号」）；控制台的 GitHub 组织页面在服务器配了 GitHub App 时照常可用，没配时回 409 `github_not_connected`；`/api/me/orgs` 只列本人的 GitHub 组织，仍回 403 `github_session_required`。
- **运维建号**：`dist/cli/account.js provision` 只在服务器容器里由维护者执行，按 GitHub 数字 id 找到或建立账号、记下组织角色、绑定邮箱，不开 HTTP 接口；密码不由它设，本人用验证码登录后在账号页设。

**残余风险**：论坛按 GitHub 身份建论坛用户，没有 GitHub 身份的账号在论坛里是游客。邀请码一旦外泄，在停用前任何人都能凭它注册（次数和过期时间可以限住）。站内角色不随 GitHub 组织变化的风险见下节。

## 权限只认极客班账号（#262 第四期）

所有者 2026-10-23 定：「有关 GitHub 的权限是要放权的」「后续我们可能不仅仅只连 GitHub 了 因为我们现在还要做自己的仓库」。源码在 `lib/access.ts`、`lib/roles.ts`、`lib/github-connection.ts`、`middleware/require-github.ts` 与 `routes/console/people.ts`。

- **站内角色**：每个账号记着成员资格和站内角色（`users.org_state`、`users.org_role`）：管理员（提督）、成员（舰员），或不是成员。不论用 GitHub、邮箱还是 Google 登录，权限都按它和称号给，不调用 GitHub、不看本人在 GitHub 组织里的角色。用邀请码注册的人记为成员；GitHub 组织成员第一次用 GitHub 登录时记为成员，组织 owner 也一样（站内还没有任何管理员时除外，那时记为管理员）；回填建的老账号还没记过时，它的 GitHub 会话第一次用到时用本人令牌查一次组织角色并记下（`lib/access.ts`，查询缓存 60 秒，出错不缓存、不当成「不是成员」）。
- **谁能改**：只有提督能在控制台「成员与权限」里改别人的站内角色（`PATCH /api/console/people/:account_id/site-role`，还要 `roles.manage`；舰长 403 `admiral_required`）。不能改掉最后一位管理员（409 `last_admin`）。改动在一个事务里写 `identity_audit` 的 `role_change` 和 `account.role` 审计，对方下一次请求就按新角色算；改成「不是成员」后对方不能再登录，已经登录的会话立刻没有任何能力，称号指派留着，改回成员后照常生效。
- **不是成员没有能力**：`computeAccess` 对不是成员的账号照常列出称号（方便控制台收回），但能力为空；控制台、论坛、比赛的成员守卫都看这个。
- **GitHub 由服务器接入**：控制台的 GitHub 组织页面（`/api/admin/:org/*`）由服务器去读写 `CONSOLE_ORG`，谁能做什么只看称号给的 `github.*` 能力（`requireGithub`）。配了 GitHub App（`GH_APP_ID`、`GH_APP_PRIVATE_KEY`）时用 App 装在组织上的安装令牌，GitHub 那边看到的操作者是这个 App；没配时退回用本人的 GitHub 会话令牌，GitHub 再按他自己的权限限制一层；都没有回 409 `github_not_connected`。安装令牌缓存到过期前 5 分钟，同时来的请求共用一次换取；App 的令牌被拒（401）丢掉缓存、回 503 `github_connection_failed`，不结束会话。App 的私钥是环境级密钥，配置错时启动失败，错误信息不带私钥。以后接自建 GitLab 照这个形状另写一个接入，称号判定不变。

**残余风险**：配了 App 之后，持有 `github.org.read` 的人（默认舰员的权限包里就有）能读 App 能看到的全部组织资料、仓库、议题与 PR，持有 `github.*.manage` 的人能以 App 的身份改组织、仓库、成员、团队和邀请；GitHub 上留下的操作者是 App，谁做的只能看本站审计。所以给称号加 `github.*` 能力，就等于把 App 的那部分权限交给持有这个称号的人，权限包要按这个来审。站内角色不随 GitHub 组织变化：在 GitHub 组织里被移出、降级的人站内照旧，要收回得在控制台改站内角色或停用账号；这是有意的，所有者的 GitHub 账号被封期间要靠站内角色进控制台。反过来，给 GitHub 组织加 owner 不会让这个人在站内变成提督：GitHub 新用户第一次注册一律记为成员（站内一位管理员都没有时除外），所以持有 `github.members.manage` 的人经 App 把别人设成 owner，也造不出提督。剩下的口子是回填的老账号：它还没记过站内角色之前被设成 owner，第一次用 GitHub 时会补记成管理员；这只在配了 App、并且老账号在部署后还没用过 GitHub 会话时才可能。配 App 之前，还要重审默认权限包：舰长默认有全部能力（含删仓库、移出成员），技术部、项目部队长带 `github.repos.manage`，这些以前被本人在 GitHub 组织里的角色挡着，配了 App 就按称号放开。管理员之间可以互相改，只拦住最后一位。

## 对外授权与 GitLab 账号同步（#270）

GitHub 账号被封后改用自建 GitLab，所有者 2026-10-23 定：「gitlab那边的登录可以走极客班的sso统一登录，因为毕竟数据都要一起统计」「所有有极客班登录身份的都有对应的gitlab账号」。源码在 `lib/oidc-provider.ts`、`lib/oidc-store.ts`、`lib/account-directory.ts`、`lib/gitlab-sync.ts`、`routes/oidc/` 与 `routes/console/gitlab.ts`，协议细节见 [对外授权与 GitLab 账号同步](../services/server/oidc.md)。

- **签发者**：内嵌的 `oidc-provider` 9.12.2，签发者 `<PUBLIC_ORIGIN>/oidc`。只做授权码流程，所有客户端都要 PKCE `S256`；动态注册、implicit、hybrid、单点登出、refresh token 都不开。回调地址按登记的完全一致匹配，只收 `https`（本机 `127.0.0.1`、`localhost` 除外），同一客户端的回调必须同一个主机。授权码 10 分钟、一次性，重放时撤销这份授权和它发出的令牌。
- **登录状态以 `sid` 为准**：签发者自己的会话只是缓存；`sid` 没了、换了账号、或账号已经不是成员时都回到交互入口，不成员的带 `access_denied` 回下游。已经发出的访问令牌在 userinfo 处按账号当前状态判断，停用或不再是成员立刻 401。
- **同意**：第一次登录某个应用要本人在 `/authorize` 允许，页面写明应用名、回到哪个主机和要的信息；同意与拒绝接口要 `sid`，只认发起这次登录的账号（别人 409），经核心写请求的 Origin 门禁（外域 403），写审计 `oidc.consent` / `oidc.deny`。
- **主体标识**：`sub` 按下游 sector（回调主机）生成 32 字节随机值存 `oauth_subjects`，不同下游拿到的不同，内部 `account_id` 不下发；换签名密钥不变。声明只有 `openid`、`profile`、`email`，邮箱只给验证过的。
- **密钥**：签名私钥 `OIDC_JWKS` 与 GitLab 管理员令牌 `GITLAB_API_TOKEN` 是环境级密钥，只在目标机 `.env.<环境>` 与 CI 的环境 secrets；JWKS 端点只发公钥。客户端只能在服务器容器里用 `dist/cli/oidc.js` 登记，`client_secret` 只输出一次，库里存 AES-256-GCM 密文。签发者的 cookie 用 `SESSION_SECRET` 派生的密钥签名。
- **限流**：协议端点每个 IP 每分钟 120 次，交互入口与详情 30 次，同意与拒绝 20 次，控制台的立即同步 30 次。
- **GitLab 同步**：`GITLAB_SYNC=on` 时按极客班账号在 GitLab 上建号（随机密码、`skip_confirmation`）、放进组（舰员 Developer、提督 Owner）、停用与不再是成员的封禁；按 OIDC 身份（`extern_uid` = GitLab sector 的 `sub`）认人，不按邮箱或用户名合并；不删除用户和仓库，不碰不是同步建的用户（如 root）。管理员令牌只在服务端用，失败只记错误码（如 `gitlab_create_409`、`gitlab_unreachable`），不记 GitLab 的响应体。

**残余风险**：GitLab 侧已登录的会话不随极客班退出或停用立即结束，靠同步封禁收口，最长差一个同步周期（10 分钟）。`GITLAB_API_TOKEN` 是 GitLab 管理员级 `api` 令牌，外泄等于交出整台 GitLab，只放目标机与 CI secrets，按 GitLab 的令牌有效期轮换。`oidc-provider` 依赖的 `jose` 6.2.13 发布时间很近，升级要跟着看安全公告。GitLab 的 SSH 不对外开放，成员用个人访问令牌走 HTTPS 推拉，这个令牌由本人在 GitLab 上管理，不受极客班停用的即时影响（账号被封禁后令牌随之不能用）。

## 极客班控制台：称号与能力

控制台 `/api/console/*` 按**站内角色 + 称号 → 能力**授权。称号和部门都是数据，由提督（以及权限包里有 `roles.manage` 的舰长）在控制台维护，不改代码；代码里固定的只有称号 id 与层级、能力清单、色调调色板和图标清单。规则与默认值在 `app/server/src/lib/roles.ts`，持久化在 `lib/role-store.ts`，判定在 `middleware/require-capability.ts`，端点与错误码见 [API](API.md)。

- **称号是数据**：称号 id 固定为 `admin` / `captain` / `head` / `member` / `alumni` / `guest`，每个称号的名字、英文标签、图标、色调、说明和权限包存在 `titles` 表。服务启动时把 `roles.ts` 的默认值写进去（`INSERT OR IGNORE`），已有的行不覆盖：第一次启动之后以数据库为准，重启、升级都不会把控制台里改过的值改回去。默认值是 2026-09-25 定的星舰命名：提督（ADMIRAL，站内管理员）、舰长（CAPTAIN）、队长（LEADER）、舰员（CREW，极客班成员自动获得）、领航员（NAVIGATOR，已毕业的学长学姐）、乘客（PASSENGER，没登录的人，只能看帖子）。队长显示为「{部门名} · {队长称号的名字}」、用部门的图标和色调；属于部门的舰员显示为「{部门名} · {舰员称号的名字}」、标签取舰员称号的标签、用部门图标和固定的 slate 色调。
- **层级固定在代码里**：提督 0、舰长 1、队长 2、带部门的舰员 3、领航员 4、舰员 5、乘客 9（`TITLES[*].rank` 与 `CREW_TITLE.rank`），因为「提督 = 站内管理员」「舰长只有一个」「队长属于部门」这些规则靠它执行，控制台改不了。一个人可有多个称号，主称号取 rank 最小者。显式指派存在 `role_assignments` 表；有显式领航员时不再自动派生舰员称号。
- **谁能改称号**：`PATCH /api/console/titles/:title_id` 要 `roles.manage`。服务端强制两条固定规则（`titleBundleError`）：提督的权限包永远是全部能力、乘客永远没有，这两个称号的权限包不能改（400 `title_capabilities_fixed`，名字、标签等显示字段可以改），读取时也不看库里存的值；`roles.manage` 只能放进舰长的权限包（400 `captain_only_capability`）。最高的两级（提督、舰长）只有提督本人能改（403 `admiral_required`）：否则持有 `roles.manage` 的舰长能把自己的权限包改宽，提督就管不住舰长。名字不能只有空白。图标只能取 `DEPARTMENT_ICONS` 里的一个，色调只能取固定调色板里的一个。有实际改动时审计 `title.update`。错误提示里的称号名字取当前库里的名字。权限包改动在下一次请求就对所有持有该称号的人生效（每次请求都重新读称号设置）。
- **提督 = 站内管理员**：站内角色是管理员的账号自动获得提督称号（`source: "site"`），不经指派、不能用撤称号的方式撤下（要改站内角色），拥有全部能力，不管有没有舰长。旧的「没有舰长时组织 admin 临时代任舰长（bootstrap）」已删除：`/api/console/me` 不再有 `bootstrap` 字段，`/api/console/assignments` 不再有 `bootstrap_active`，`source` 也不再有 `bootstrap`。
- **舰长**：全站最多一位（部分唯一索引 `uq_role_assignments_captain`）。只有提督或现任舰长能任命或移交舰长，其他人 403 `captain_required`；移交在单个事务里删掉旧行、插入新行。captain 行只能由舰长本人卸任或由提督撤下，其他人 409 `captain_transfer_required`；撤下后暂时没有舰长，提督不受影响。舰长的权限包默认是全部能力（含 `roles.manage`），只有提督能在控制台改。
- **部门**是数据（`departments` 表，默认 招新部 / 技术部 / 社区部 / 项目部），每个部门有队长与舰员两份**权限包**，叠加在队长、舰员称号自己的权限包之上。新增部门、改称号都不改代码；新增「能力」才需要改代码，因为能力必须有执行点。部门的新建、编辑、归档、删除同时要求 `roles.manage` 和站内管理员（提督）身份；舰长即使持有 `roles.manage` 也只能查看配置，写接口返回 403 `admiral_required`。删除部门（`DELETE /api/console/departments/:id`）在同一事务里撤掉这个部门的全部队长与舰员指派并审计被撤掉的人（`department.delete`），他们的其它称号不受影响；默认部门只在第一次启动写入（`console_seeds` 标记），删掉后重启不会复活。
- **能力**是扁平清单（`console.* github.* forum.* applications.* competitions.* feedback.* audit.* roles.*`），取蕴含闭包（`*.manage` → `*.read`，任何 `github.*.manage` → `github.org.read`，`roles.manage` → `roles.department.manage`）。提督拥有全部能力（按清单动态计算）；`roles.manage` 只有提督和舰长的权限包里能有，不能放进部门权限包，也不能放进队长、舰员、领航员的称号权限包（服务端拒绝，`captain_only_capability`）。
- **没有 GitHub 上限**（#262 第四期）：`github.*` 和别的能力一样按称号给，不再与本人的 GitHub 组织角色取交集，`/api/console/me` 也不再有 `blocked`。在 GitHub 上真正去做由服务器接入的 GitHub 执行（见上节）。安全页（`/api/admin/:org/security`）要 `github.org.manage`；合并 PR、改议题状态、评论要 `github.repos.manage`。
- **队长范围**：`roles.department.manage` 只允许任免自己负责部门的舰员，跨部门返回 403 `out_of_department_scope`。成员全名单 `GET /api/console/people` 不按部门收窄：持有 `roles.department.manage` 的队长也能看到全部成员和每个人的称号。名单以极客班账号为准（站内角色、登录方式、邮箱、最近登录）；接上 GitHub 时再并上组织里还没登录过本站的人和他们的 GitHub 组织角色，接不上时名单照给。
- **失败语义**：老账号补记站内角色时 GitHub 查询出错，交给 `http-policy` 统一映射（上游 4xx → `upstream_rejected`，5xx → `internal_error`），**不**当成「不是组织成员」，避免 GitHub 一时出错就把提督当成非成员、收掉他的权限。上游 401 例外：GitHub 只在令牌本身无效时回 401，这时会话里存的令牌已经不能用，服务端删掉会话、清 `sid`，回 401 `session_expired`，审计 `auth.session_rejected`，人重新登录后拿新令牌（#164）。邀请链接兑换时用服务器的 GitHub App，没配 App 时用发起人存下的令牌（经 App 建的链接不存令牌），`join.ts` 自己处理上游错误，不会因此删掉访问者的会话。
- **公开的组织架构**：`GET /api/public/org` 匿名可读，只给称号与未归档部门的显示信息（名字、标签、图标、色调、说明、层级）和色调色值，不含权限包、不含任何人。官网「组织架构」窗口和论坛的称号徽章读它，读不到时用各自内置的默认值。
- **审计**：控制台写操作（含 `title.update`）、投递查看与导出一律以 `org = CONSOLE_ORG` 审计；审核备注只存在 `application_reviews`，不进审计。控制台审计接口不下发完整的邀请链接 token（只留前 6 位），否则持有 `audit.read`、却没有 `github.invites.manage` 的人就能拿链接去发 GitHub 邀请。旧接口 `GET /api/admin/:org/logs` 下发完整 token，所以要同时有 `audit.read` 和 `github.invites.manage`。
- **`/api/admin/:org/*`**：也按称号的能力授权（`middleware/require-github.ts` 的 `requireGithub` / `requireManagedOrg`），只管 `CONSOLE_ORG`，别的组织回 403 `org_not_managed`；不看本人的 GitHub 组织角色。
- **论坛能力在服务端执行**（#57）：带 `sid` 但账号已不是极客班成员的会话在论坛按游客处理，不建论坛用户，称号给的 `forum.*` 也不算。`/api/forum/*` 用同一个 `computeAccess` 算出的 `forum.*` 判定置顶（`forum.topic.pin`）、关闭（`forum.topic.close`）、编辑或删除他人帖子与在已关闭话题回复（`forum.post.moderate`），控制台里改过的称号与部门权限包下一次请求就生效；`forum.category.manage` 与 `forum.badge.assign` 仍没有接口。`state.viewer.capabilities` 下发给前端只用于显示按钮，授权只在服务端。动他人帖子、置顶、关闭以 `org = CONSOLE_ORG` 写审计，details 只有帖子与话题编号、作者编号或开关，不记正文。

**个人信息**：投递（姓名、班级、邮箱、特长）对所有持有 `applications.read` 的人完整可见；列表与详情不下发来源 IP 和 User-Agent。只有查看详情和导出会被审计，CSV 离开系统后无法追踪。

**发信里的个人信息**（#148，[mail](../services/server/mail.md)）：招新的信里写着投递人的姓名、班级、邮箱、投递时间、报名编号，「已收到」那封还有特长原文。这些信在 `mail_outbox` 里等着发的时候（`pending`、`sending`，最长到第 6 次失败，约 8 个半小时）带着收件地址、HTML 和纯文本；发出、放弃或不发之后这三列改成 NULL，只留收件地址的 sha256、主题和结果，不发的信（没有配置发信商、发信白名单模式下不在名单里）写入时就不存。控制台看到的每封信的结果（`MailSummary`）不含地址和正文。`last_error` 和日志只记发信商名、HTTP 状态、对方的错误码（只留字母、数字和 `. _ -`）和信的编号，不记密钥、收件地址、正文和对方回答的原文；投递的「已收到」写不进队列时只记投递编号和错误码。审核备注不进信里，审计 `application.review` 只记这次有没有写信。发信商的密钥（`MAIL_ALIYUN_ACCESS_KEY_*`、`MAIL_RESEND_API_KEY`）和预发布白名单 `MAIL_ALLOWLIST`（里面是真人的邮箱）是环境级 secrets，仓库里留空（[ENVIRONMENTS](../ops/ENVIRONMENTS.md)）；配置写错时启动失败，错误信息不带配置的值。信里的链接只能指向正式与预发布站点，回信地址与发件地址只收一个普通的邮箱地址，主题里没有换行，不会被拼出额外的邮件头。信交给阿里云或 Resend 之后，信的内容与收件地址按对方的保存规则留存，不在本服务的控制范围内。

**投递确认信被拿来发给别人**（#148、#169）：投递接口不用登录，谁都能填别人的邮箱，服务器就会以「长江大学极客班」的名义发一封带投递人自己写的文字（姓名、特长原文）的「已收到」。2026-09-27 要求信本身不限、改在投递时限次数（「限制一个设备或一个IP最多申请5次」）：同一个来源 IP（IPv6 按 /64）、同一个设备各自 24 小时内最多 5 份成功的投递，第 6 份回 429、不落库、不发信（`routes/portal/apply.ts` 的 `APPLY_LIMITS`）。设备是投递接口发的 httpOnly cookie，只发给投递接口；计数表 `application_limits` 只存 IP（/64）和设备 id 的 sha256，最多留 24 小时。确认信只剩全站每小时 200 封（`lib/mail/mailer.ts` 的 `RECEIVED_LETTER_LIMITS`），防止换很多 IP 刷光发信额度、改状态的正式通知发不出去。改状态的信要「审核投递」能力才能触发，不设上限。投递接口不收末尾带点的域名、带引号的本地部分和 IP 字面量。剩下的风险：换 IP 又清 cookie 的人每个 IP 每天仍能让 5 个任意邮箱各收到一封带自己文字的信，同一个收件箱可能从不同 IP 收到多封；Turnstile 没开时（两个环境现在都没开），批量投递还受每个 IP 每分钟 5 次、工作量证明和蜜罐限制；换很多 IP 的人仍能把全站每小时 200 封打满，那一小时里真正投递的人收不到确认信。校园网、宿舍、热点共用一个出口 IP（或 IPv6 同一个 /64）时，同一出口一天里第 6 个人投递不了（页面写明原因，第二天可以再投）。预发布环境从 #169 起默认向所有人发信（`MAIL_RECIPIENTS=all`），在预发布测试投递或改状态会向真实邮箱发送包含预发布域名 `prev.yangtzeu.work` 链接的邮件，不再受白名单过滤拦截。开发信前要开 Turnstile 的话，见 [ENVIRONMENTS](../ops/ENVIRONMENTS.md)。另外，控制台改状态带着页面上看到的状态和审核记录的版本号（`expected_status`、`expected_review_id`，最大的审核记录 id），别人刚处理过（包括改走又改回）时回 409、不发信，不会按旧画面给投递人发出互相矛盾的信；改状态不带这两项的请求（部署前打开的旧页面）同样回 409。

**残余风险**：站内角色改成「不是成员」后，对方的会话在 7 天有效期内还在，但下一次请求起就没有任何能力；论坛按游客处理，不能发帖、编辑、删除、点赞、收藏、关注，回复只能走游客那条路（昵称、PoW、按 IP 限流），称号给的 `forum.*` 也不算；这个人以前发的帖子和论坛用户留着。登录门槛不看称号，站内已不是成员的领航员也登录不了。组织若开启 OAuth App 访问限制而对应环境的 OAuth App 没被批准，要查组织的 GitHub 登录（新用户、还没记过站内角色的老账号）都会以 `failed` 结束。站内有几位管理员就有几位提督，每位都拥有控制台全部能力并能改所有称号的权限包和别人的站内角色，所以把账号改成管理员就等于给控制台最高权限。提督和舰长可以把队长、舰员、领航员的称号权限包改宽（`roles.manage` 除外），改动立即对所有持有该称号的人生效，`title.update` 审计只记改了哪些字段，不记改前改后的值。舰长的 GitHub 账号丢失时由提督在控制台撤下 captain 行、重新任命；没有提督能登录、也没有舰长时，控制台里没人能任命舰长或改称号。官网和论坛在 `/api/public/org` 读不到时显示内置的默认称号，可能与控制台里改过的不一致。论坛用户的称号与角色在本人下一次请求论坛时才刷新，别人看到的是他最近一次访问时的称号。`/auth/me` 的 `console_link` 只决定显不显示入口，GitHub 查询失败时为 false。按钮显隐只是提示，授权只在服务端。

## 比赛报名与组队的数据可见范围（#239）

报名、队伍与积分都按极客班账号 `account_id` 认人（会话里的 `users.id`），不按会变的 GitHub 登录名；比赛表不存名字、头像或联系方式，读取时从账号与绑定的 GitHub 身份取，名单 CSV 用导出那一刻的值。

- **匿名与本场无关的成员**：公开接口只有赛事事实与报名摘要（是否开放、个人或团队、人数、积分），不含报名人数、队伍、成员或任何待处理信息。匿名单场接口 `GET /api/public/competitions/:id` 只在成功响应上放开 `Access-Control-Allow-Origin: *`，只读、不带 cookie，用于比赛官网的状态卡片。
- **成员**：登录且是极客班成员才能读写；成员守卫只看会话账号与组织身份，比赛路由不自己调 GitHub。成员能看到统计数字、未解散队伍的在队成员（账号、登录名、头像、角色）与「找队友」里本人写的留言。
- **待处理的范围**：门户的待处理只含当事人自己的申请与邀请，以及本人所在队伍的待处理项（含申请留言）；其他队伍与匿名看不到任何待处理。本队普通队员能看见本队的申请，但只有领队能操作，服务端按记录判断「关系是否属于这支队伍」和角色，越权回 403 `not_team_leader` 或 404，不靠按钮是否显示；被拒绝、撤回、退出的历史不出现在门户。
- **组织者**：名单、设置与积分复用 `competitions.manage`，没有新增能力；名单含已取消与已解散的记录，只在控制台下发。导出 CSV 写 `competition.roster.export` 审计（只有比赛 id 与行数），单元格走 `csvCell` 防公式注入；报名设置写 `competition.signup_settings.update`，积分登记与撤销写 `competition.score.add` / `competition.score.revoke`，`details` 不记留言、队名原文与撤销原因的全文。写入与审计同一事务，审计失败一起回滚。
- **自助操作不写审计**：门户的报名、组队与取消靠行内时间与操作人追溯，不写 `audit_logs`，也不写 `identity_audit`（那是本人的账号操作）。
- **限流**：成员写操作每人每分钟 30 次、名单导出每分钟 5 次，超额 429；读接口不限流，靠登录与成员门槛限制访问面。

## 论坛代码替换的边界

旧 React/Fastify 论坛已退出活动构建，核心不打开 forum.db、不注册旧写接口、不创建 forum_sid。旧 API 返回 410，生产未接好服务时论坛入口返回 503。旧数据库和附件保持原样，不能以清理代码为名删数据。

采用的 Tuff Forum 保留本机 Pinia/localStorage 演示模式：任意示例账号选择不是认证，UI 权限 helper 不是服务器授权，CDP 观察浏览器存储不是数据库审计。演示只用于本机，不作为生产内部论坛；当前服务端模式另经核心 `/api/forum/*` 的身份、授权与持久化路径，见下段。核心真实 GitHub 会话绝不接受示例 user ID/role 赋权。本机快照模式通过 dev 专用、仅 GET/HEAD 的 `/api/local-forum/*` 只读提供投影：哈希白名单、目录逃逸检查、索引给定的类型与 disposition、大小核对、no-store、nosniff 和禁止脚本的 CSP，错误体只含机器码（dev 错误处理器仍会附带堆栈，因此这些路由不进生产）；前端的论坛会话固定为游客、不渲染示例登录、论坛状态不写 localStorage；顶栏的全站 GitHub 登录只经同域 `/auth/me` 显示是谁，论坛没有据此授权的服务端。它没有给论坛增加任何授权，投影含真实成员公开资料，只能在获得授权的范围内本机使用。

旧论坛的密码策略、上传重新编码、归档后端保护等实现已经随旧源码退役；这些不能继续被列为新论坛已具备的防护。新的论坛后端（#57，核心服务 `/api/forum/*`，[ADR-0004](../decisions/0004-forum-backend-in-core-server.md)）重新实现了身份（只认 `sid`）、授权（`forum.*` 能力）、游客滥用防护、计数与事务（编号来自数据库计数器，写操作在事务里）、审计和头像上传：头像只收 PNG / JPEG / WebP、≤2MB，登录与每小时 10 次的额度在读请求体之前核对，每次上传都计数（解码失败也算），以 sharp 解码出的真实格式为准，解码前按像素上限（4096×4096）拒绝解压炸弹，动图只取第一帧，重新编码成 256×256 WebP、不带原图元数据，按内容哈希以 `image/webp`、`nosniff`、`default-src 'none'` 提供。`state` 里别人的通知设置不下发真实值（给初始值），一条帖子的 @提及最多通知 10 人。帖子正文按 Markdown 原样存储，服务端不做 HTML 净化：输出到页面前转义原始 HTML、拦 `javascript:` 等链接由论坛前端的渲染器负责（#107 核对并补测试），这一层没通过验收之前，论坛写入口就是站点脚本注入的入口。

## 工具与供应链

上游 MIT 声明保留，固定源码提交及两个独立锁文件。论坛按其 pnpm 配置禁止自动安装 Electron peer，保留安装脚本允许列表。未自动注册 Cloudflare 或购买服务。

核心自动测试用内存库和模拟 GitHub；论坛测试使用确定性数据和新建浏览器 profile。浏览器工具仅关闭本次启动的进程组，禁止使用通用名称匹配结束用户浏览器。历史源码备份和运行缓存不进入版本控制。

## 发布和残余风险

**单一 origin 的代价**：每个环境只有一个域名（`PUBLIC_ORIGIN`），官网、管理端（`/admin`、`/console`）和论坛（`/forum`，上游 Nuxt 代码）同源。写请求的 Origin 校验与 `return_to` 只接受这一个 origin，旧管理端子域一律拒绝；但同源也意味着官网或论坛页面上的任何脚本注入都能带着 `sid`（host-only、`Path=/`）调用管理端接口，旧的「管理端独立域名」隔离不再存在。因此三端共用的 CSP（`script-src 'self'`，宿主 nginx 下发）与论坛/Markdown 的输出净化是管理端权限的直接防线，放宽其中任何一项都要按管理端风险评审。论坛页面是唯一带自己 CSP 的上游：同一份站点策略，只在 `script-src` 里多出论坛构建产物中全部内联脚本的 sha256（现在是 importmap、配色、`__NUXT__` 配置三段，都是构建生成的，不含用户内容），由 `app/forum/scripts/csp-header.mjs` 在镜像构建时算出，脚本标签认不全就让构建失败；宿主只在 `/forum/` 下、上游已带 CSP 时不再叠加，其它路径一律照发站点策略，上游再带一份也只会更严（#78）。不允许为此改用 `'unsafe-inline'`，脚本里有断言。

两个环境（正式 tag `vX.Y.Z` → 正式栈、预发布 tag `vX.Y.Z-rc.N` → 预发布栈）必须完全隔离：独立目录、独立 compose 项目、独立端口、独立命名卷、独立密钥、独立域名；Cookie 使用 host-only（不写 `Domain`），禁止 `.yangtzeu.work` 这种父域共享，预发布不得读取正式环境的会话或数据。密钥只经 CI/CD 从 GitHub 环境级 secrets 注入渲染后的运行时 `.env`，仓库模板里的密钥字段保持空值（见 [ENVIRONMENTS](../ops/ENVIRONMENTS.md)）。

全站 GitHub 登录与登录门槛、论坛服务端身份/授权/存储以及前端接入均已存在于源码，自动回归使用模拟外部响应。真实 OAuth 往返、环境安全配置和论坛业务的当前验收状态应按具体提交查发布记录，不在本规范复制一份随时间过期的“尚未上线”结论；源码、目录或部署模板本身不证明这些验收已经完成。旧论坛账号认领、内部 Hub 与上游 Cloudflare PRD 不能当作已实现能力。数据层仍是 SQLite + 命名卷，没有多实例隔离或多节点一致性验证；Postgres 迁移未做。没有完整依赖漏洞审计、WCAG/ASVS 认证或多实例验证。

旧部署文档曾暴露服务器登录凭据（原记录文件 `docs/ops/FORUM-SUBDOMAIN.md` 已随子域模型退役删除，事件记录保留在本节），已从当前工作区移除，但这份凭据仍需轮换，并评估 Git 历史和传播副本。本轮不使用凭据、不擅自重写历史。check:secrets 只检查部分当前文本模式，不证明历史泄漏消失。

依据是当前代码、[forum 服务合同](../services/forum/README.md)、[采用决策](../decisions/0003-adopt-tuff-forum.md) 和 [官方参考范围](../conventions/REFERENCES.md)。
