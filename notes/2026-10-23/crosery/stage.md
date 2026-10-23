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
