# stage · crosery · 2026-10-23

负责人：crosery

## 01:26:26 +08:00 · 发布 · #262 #239 · 本机构建并部署预发布 0.1.1-rc.7（4eabb10273af）

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 00:37 批准本机发预发布（账号被封期间的临时做法，跳过 CI 与 GitHub 部署记录）。本地 tag v0.1.1-rc.7 → 4eabb102（未推送）；docker build --platform linux/amd64 三个镜像，构建参数与 deploy-preview.yml 相同，STATIC_CDN_BASE 留空走同源；docker save | gzip -9，sha256 e3be4323…；部署前在目标机 sqlite3 .backup 预发布库到 /root/yzgc-backups/preview-20261023T0049-7a25ec804b1f.db（integrity_check ok）；scp 归档、deploy-stack.sh 与 compose；env 用目标机现有 .env.preview 只换 IMAGE_TAG（密钥不离开目标机）；按工作流同一组参数运行 deploy-stack.sh
- 结果：部署成功：健康检查 18201/18200 返回 ok，deploy-history 记 2026-10-22T16:55:38Z preview 4eabb10273af OK；https://prev.yangtzeu.work/release.json 为 0.1.1-rc.7@4eabb10273af；/auth/me、/auth/providers、/api/public/competitions、/signin、/device 返回 200，报名、天梯、名单接口匿名 401 not_signed_in；表 29→38、比赛 0→1（种子赛事 oss-challenge-2026-1），旧数据未丢

## 01:26:26 +08:00 · 发布 · #262 · 本机构建并部署预发布 0.1.1-rc.8（bba4b066cd04），修登录页宽屏拉满

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：本地 tag v0.1.1-rc.8 → bba4b066（未推送）；同 rc.7 的步骤构建、打包（sha256 db3bb82c…）、部署前备份到 /root/yzgc-backups/preview-20261023T0110-4eabb10273af.db（integrity_check ok）、只换 IMAGE_TAG、运行 deploy-stack.sh
- 结果：部署成功：健康检查通过；release.json 为 0.1.1-rc.8@bba4b066cd04；正式环境仍是 0.1.0（d4a24749），未触碰

## 01:26:26 +08:00 · 验收 · #262 #239 · agent 在预发布 rc.8 上用 ego-browser 核对登录页与比赛窗口（不是所有者验收）

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：ego-browser 匿名访问 https://prev.yangtzeu.work：/signin 在 1440×900、2000×1100、390×844 量卡片宽度并截图；/device 未登录跳 /signin?return_to=/device；桌面与手机打开「比赛」窗口
- 结果：登录卡片 440px 居中（1440 宽时 x=500，2000 宽时 x=780），手机 358px；无胶囊、无加粗；比赛窗口显示种子赛事、倒计时、赛程三格与页签，未登录按钮为「登录后报名」，手机为底部弹层。手机上副标题末尾「登录」单独折行，未修。登录后的报名、组队、控制台未验证：所有者 GitHub 账号被封，agent 不用别人的账号登录。所有者验收：未进行
- 下一步：所有者在预发布验收；正式 0.1.1 等所有者明确批准，部署前备份正式库

## 03:37:45 +08:00 · 发布 · #262 · 本机构建并部署预发布 0.1.1-rc.9（02003548efa6）：邮箱验证码与密码登录、邀请码注册、账号页

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：本地 tag v0.1.1-rc.9 → 02003548（未推送）；同 rc.7 的步骤构建三个 amd64 镜像（版本串 0.1.1-rc.9@02003548efa6），docker save | gzip -9，sha256 9ab3ff39…；部署前备份预发布库到 /root/yzgc-backups/preview-20261023T0326-bba4b066cd04.db（integrity_check ok）；scp 归档、.sha256、deploy-stack.sh 与两份 compose；env 用目标机现有 .env.preview 只换 IMAGE_TAG（diff 只有这一行）。第一次运行漏传 .sha256，deploy-stack.sh 在装载镜像前停下，deploy-history 记 FAILED，线上仍是 rc.8 未动；补传后重跑。部署后在 server 容器里用 account.js provision 建所有者账号（GitHub 130495739、组织角色 admin、绑定所有者给的邮箱），用 account.js invite 从本机钥匙串经标准输入写入默认邀请码（值不进命令行、日志和记录）
- 结果：部署成功：deploy-history 2026-10-22T19:32:28Z preview 02003548efa6 OK，健康检查 18201/18200 ok；release.json 为 0.1.1-rc.9@02003548efa6；/auth/providers 列出 github 与 email，没有 Google（预发布没配 Google 凭据）；表 38→40（invite_codes、email_challenges）；provision 输出 created true、emailLinked true，users 表 1 行（org_role admin、org_state active），identities 有 github 与 email 两条；invite_codes 1 行（id 1，不限次数、不过期、created_by system）。正式环境仍是 0.1.0（d4a24749），未触碰

## 03:37:45 +08:00 · 验收 · #262 · agent 在预发布 rc.9 上核对登录页与账号页（不是所有者验收）

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：ego-browser 匿名访问 https://prev.yangtzeu.work：/signin 在 1440×900 与 390×844 截图；密码方式填所有者邮箱和一个错误密码；验证码方式填错邮箱格式点「获取验证码」；/account 未登录点「去登录」。curl 只打不发信的接口
- 结果：登录页有「通过 GitHub 继续」、「或者用邮箱」和验证码、密码两种方式，没有 Google 按钮；错误密码提示「邮箱或密码不对」，错邮箱提示「邮箱格式不对」；390 宽无横向溢出；/account 未登录显示「还没有登录」，点「去登录」到 /signin?return_to=%2Faccount。/auth/email/verify 没有挑战回 400 code_expired，/auth/email/password 不存在的邮箱回 400 invalid_credentials，/api/console/invites 与 /api/identity/me 匿名 401，/auth/google 404 provider_not_enabled；server 日志 30 分钟内没有 warn 和 error。未验证：真实发验证码与收信（没有给任何邮箱发信）、登录后的账号页、设密码、邀请码注册、控制台邀请码页、Google 登录（没有凭据）。登录页说明文字提到 Google，预发布却没有 Google 按钮，未改。所有者验收：未进行
- 下一步：所有者在预发布用邮箱验证码登录，在「我的账号」设至少 15 位的密码，看控制台的邀请码；正式 0.1.1 等所有者明确批准，部署前备份正式库

## 10:13:42 +08:00 · 发布 · #262 · 本机构建并部署预发布 0.1.1-rc.10（b69740157437）：权限只认极客班账号，GitHub 改由服务器接入

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：本地 tag v0.1.1-rc.10 → b6974015（未推送）；同 rc.9 的步骤构建三个 amd64 镜像（版本串 0.1.1-rc.10@b69740157437，三个 docker build 均 exit 0），docker save | gzip -9，sha256 43bb94b0737469d99b5dd95fcb0f6b5148e9ea0c08ae1a82fe836560a65a5cb5；部署前备份预发布库到 /root/yzgc-backups/preview-20261023-095632-02003548efa6.db（integrity_check ok）；scp 归档、.sha256、deploy-stack.sh 与两份 compose（preview.yml 两边 sha256 都是 cc97039b…），目标机 sha256sum -c OK；env 用目标机现有 .env.preview 只换 IMAGE_TAG（diff 只有这一行），目标机 env 里没有 GH_APP_*，compose 默认留空
- 结果：部署成功：deploy-history 2026-10-23T02:08:15Z preview b69740157437 OK，健康检查 18201/18200 ok，清掉 471d3dbfda3e 的旧镜像（保留最近 5 个 tag）；release.json 为 0.1.1-rc.10@b69740157437；/auth/providers 只有 github 与 email；库里表 40 张、integrity_check ok，users 1 行（admin、active），提督、舰员的称号说明已换成新默认（「站内管理员，拥有全部权限，任命舰长」「在读成员；成为极客班成员后自动获得」）；server 日志 15 分钟内只有 Node 的 MODULE_TYPELESS_PACKAGE_JSON 警告（package.json 与 Dockerfile 这次没改）。正式环境仍是 0.1.0（d4a24749），未触碰

## 10:13:42 +08:00 · 验收 · #262 · agent 在预发布 rc.10 上核对控制台（不是所有者验收）

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：ego-browser 用浏览器里已有的所有者预发布会话只读访问（先确认会话是邮箱登录：/auth/me provider email，/api/console/me site_role admin、github none、22 项能力，所以 GitHub 页面不会拿被封账号的令牌去调 GitHub）：/console/people、/console/github、/console/github/invite-links，1440 宽截图；没有点任何保存、生成、停用或删除。curl 匿名打 /healthz、/release.json、/auth/providers、/auth/me、/api/console/me、/api/admin/<org>/overview、/api/public/org
- 结果：所有者邮箱会话是提督，导航里 GitHub 组织的 9 页都在；成员表 1 人（@Crosery，提督，站内角色「管理员」，登录方式 GitHub、邮箱），表上方提示「GitHub 还没接上，名单里只有登录过本站的人和有称号的人」；/console/github 显示「GitHub 还没接上」和要由组织所有者建 App 的说明，409 github_not_connected；邀请链接页能打开，「生成链接」置灰并有说明，但空状态仍写「用右上角的「生成链接」创建第一条。」，与置灰的按钮矛盾，回到 task 分支改；页面都没有横向溢出。匿名 /api/console/me 与 /api/admin/... 回 401 not_signed_in。未验证：真实 GitHub App（没有凭据）、GitHub 会话下的组织页面、改站内角色的保存（没在所有者数据上做写操作）、真实发信、Google。所有者验收：未进行

## 10:23:17 +08:00 · 发布 · #262 · 本机构建并部署预发布 0.1.1-rc.11（b542b3be2eb5）：邀请链接空状态修正

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：本地 tag v0.1.1-rc.11 → b542b3be（未推送）；同 rc.10 的步骤构建三个 amd64 镜像（版本串 0.1.1-rc.11@b542b3be2eb5，均 exit 0），归档 sha256 0112a6159bcc81687d335137323d4c762926b974beec99f296448f2a640faeeb；部署前备份预发布库到 /root/yzgc-backups/preview-20261023-101421-b69740157437.db（integrity_check ok）；env 仍用目标机 .env.preview 只换 IMAGE_TAG（diff 只有这一行）
- 结果：部署成功：deploy-history 2026-10-23T02:22:28Z preview b542b3be2eb5 OK，sha256 校验通过，健康检查 18201/18200 ok；release.json 为 0.1.1-rc.11@b542b3be2eb5；库 integrity_check ok，users 仍是 1 行 admin、active；server 日志 5 分钟内除 MODULE_TYPELESS_PACKAGE_JSON 警告外没有 warn、error。正式环境仍是 0.1.0（d4a24749），未触碰

## 10:23:17 +08:00 · 验收 · #262 · agent 在预发布 rc.11 上核对邀请链接页（不是所有者验收）

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：ego-browser 用浏览器里已有的所有者邮箱会话只读打开 /console/github/invite-links，1440 宽截图，没有点任何按钮；之后关掉这次的浏览器任务
- 结果：页面读到的 release.json 是 0.1.1-rc.11@b542b3be2eb5；「生成链接」置灰，说明「GitHub 还没接上，生成新链接要等服务器配好 GitHub App，或用 GitHub 登录后再来；已有的链接照常可以停用和删除。」，空状态改成「接上 GitHub 后，用右上角的「生成链接」创建第一条。」，没有横向溢出。所有者验收：未进行
- 下一步：所有者在预发布用邮箱会话看控制台；确认 ADR-0005 第二次修订第 2–5 条与审查里交给所有者定的几项；GitHub App 要由没被封的组织所有者建；正式 0.1.1 等所有者明确批准，部署前备份正式库
