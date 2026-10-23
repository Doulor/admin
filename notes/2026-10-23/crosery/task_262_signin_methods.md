# task/262/signin_methods · crosery · 2026-10-23

负责人：crosery

## 01:49:57 +08:00 · 开工 · #262 · 邮箱验证码与密码登录、Google 登录、邀请码注册、控制台按站内称号授权

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 00:57 截图反馈「不支持邮箱登录和注册，还有就是不支持谷歌注册和登录」，01:30 定：「目前开放注册，现在的github注册的都算组织成员，后续需要邀请码去注册，在我们的admin控制台再额外加个邀请码的逻辑，默认的邀请码是…」（默认邀请码原文已本地核对，不公开，只存在钥匙串里）；邮箱「验证码和密码都支持」（密码沿用至少 15 位）；控制台「按站内称号认」，只有 GitHub 组织页面要 GitHub 会话。GitHub 账号被封、建不了 issue，按所有者 00:21「所有操作和发版以及发布都走本地」从本机 stage 候选 bba4b066 用 git worktree add 建 task/262/signin_methods（task.mjs start 要连 GitHub，不可用），挂在 #262 下
- 结果：worktree .claude/worktrees/task-262-signin，pnpm install --frozen-lockfile 通过（Node 22.23.2）
- 下一步：读身份、会话、称号、成员守卫代码，定服务端与控制台改动

## 03:20:37 +08:00 · 提交 · #262 · 提交统一登录第二、三期 33ef6ca5

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：git commit 33ef6ca5（feat(auth)，101 个文件，含生成的目录）：邮箱验证码与密码、Google、邀请码注册、账号页 /account、控制台注册邀请码页、github_session_required、运维建号命令、Google 可选凭据的部署接线，以及审查后的五处加固；文档与 docs/changes/262.json 同一提交。提交前把开工记录里所有者原话中的默认邀请码原文改成「…」（记录不写密钥，NOTES.md；原文只在钥匙串）
- 结果：提交前在工作区：pnpm check 的 check:runtime、site-config、environments、boundaries、docs、notes、secrets、catalog 均 exit 0；check-doc-sync 与 check-architecture 用 --base bba4b066 通过（本机 origin/stage 停在 4beda55e，默认基线会把 #239、#265 算进来）；pnpm typecheck exit 0；pnpm test 92 个文件 1503 例通过；pnpm build exit 0；未推送（GitHub 账号被封）

## 03:20:37 +08:00 · 审查 · #262 · 33ef6ca5 的审查：有条件通过

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：按 .agents/skills/code-review 核对 bba4b066...33ef6ca5：另起一个只读子 agent 独立审服务端登录、邀请码、密码、Google 与授权代码，我核对清单项（diff 里没有密钥、邀请码与所有者邮箱原文；两份 env 模板的 GOOGLE_* 留空；compose 只透传、镜像与卷不变；没有 || true、continue-on-error、skip ci；提交信息合规）。子 agent 报 5 条，逐条对照代码核实后全部修掉并补测试：[阻塞] GitHub 登录被组织拒绝时不更新账号记下的组织角色，被移出的提督用邮箱登录仍是提督 → recordGithubDenied 在同一事务清角色、非邀请码账号改 not_member/pending；[应修] /auth/google?invite= 的邀请码随请求日志的 url 落盘 → requestLogFields 去掉 /auth/* 的查询串；[应修] Google 两个接口没有限流、可反复试邀请码 → 20 次/分钟与 10 次/分钟；[应修] 密码节流表满 5000 条后拒绝所有人 → 挤掉最早一条；[建议] 别人替这个邮箱要码会作废本人的码 → 只作废同一浏览器上一次的挑战
- 结果：结论：有条件通过。修复后 tests/server/signin-methods.test.ts 20 例通过（新增 5 例覆盖上面五条），全量 1503 例通过。未验证：真实发信商投递验证码、真实 Google 往返（预发布没配 Google 凭据）、预发布旧库加列与新唯一索引、回滚到旧镜像后邮箱会话的表现（按代码推断）。条件：发 rc.9 后在预发布核对迁移与验证码投递，所有者验收

## 03:37:45 +08:00 · 合并 · #262 · 本机把 task/262/signin_methods（92baf969）合进 stage 候选 02003548

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：账号被封期间按所有者 2026-10-23 00:37「本机发预发布」在本地合并：在 stage 候选 bba4b066 上 git merge --no-ff task/262/signin_methods 得到 merge commit 02003548，没有 PR、没有推送。合并树与 task 分支的树相同，沿用 task 分支上的验证：pnpm check 各步（architecture 与 doc-sync 用 --base bba4b066，本机 origin/stage 停在 4beda55e）、typecheck、pnpm test 92 个文件 1503 个用例、pnpm build 均为 0
- 结果：stage 候选 02003548，本地 tag v0.1.1-rc.9（未推送）。缺 GitHub PR 和 PR 上的审查结论，note.mjs check --pr 只差「PR」一条，账号恢复后补
- 下一步：账号恢复后推 stage、开 PR 补 PR 记录与审查结论

## 09:55:33 +08:00 · 提交 · #262 · 提交第四期：权限只认极客班账号，GitHub 改由服务器接入 555477f3

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 07:52「有关 GitHub 的权限是要放权的 而且在后续 我们可能不仅仅只连 GitHub 了」之后在本分支接着做第四期，git commit 555477f3（feat(auth)，114 个文件，含生成的目录与 docs/changes/262.json）：站内角色由站内决定并可在控制台改（PATCH /api/console/people/:account_id/site-role，至少留一位管理员）；组织成员首次 GitHub 登录记为成员，所有者只在站内还没有管理员时记为管理员；权限只看称号，去掉 GitHub 角色上限；lib/github-connection.ts 先用 GitHub App 安装令牌、没有就用本人会话令牌、都没有回 409 github_not_connected；/api/admin/:org/* 改挂 require-github.ts 只管 CONSOLE_ORG；可选 secret 对改名 GH_APP_ID、GH_APP_PRIVATE_KEY（GitHub 不许 secret 名以 GITHUB_ 开头），两份 env 模板留空；控制台成员表加站内角色列与对话框、邀请链接页不接 GitHub 也能打开；以及下一条审查记录里的修复。提交前先 note.mjs flush 并进暂存的 rc.9 合并与发布记录
- 结果：提交前在工作区：check:runtime、site-config、environments、boundaries、docs、doc-sync、notes、secrets、catalog 均 exit 0；node scripts/check-architecture.mjs --base bba4b066 通过（151 个变更文件，291 个关联节点）；pnpm typecheck exit 0；vitest server 375、console 185、tooling 727、web 237 例通过；此前同一改动上 pnpm build exit 0，论坛 node scripts/forum.mjs test 548 例与 check 通过；控制台样板数据在 ego-browser 里看过成员表「还没记录」行与站内角色对话框、邀请链接页、GitHub 没接上的提示（截图 /tmp/geek262/shots/20–23）；未推送（GitHub 账号被封）

## 09:55:50 +08:00 · 审查 · #262 · 第四期的审查：有条件通过（修复后提交为 555477f3）

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：按 .agents/skills/code-review 审 92baf969 上第四期的未提交改动：另起两个只读子 agent 分别按仓库规范与所有者 07:52、01:30 的原话独立审（09:19 发出，09:24 回来），我逐条对照代码核实。规范一路：[阻塞] 持有 github.members.manage 的人经 App 把一个 GitHub 用户设成组织所有者，对方首次 GitHub 登录就成提督，绕过 admiral_required → 首次登录最多记成员，只有站内没有管理员时才记管理员；[应修] join.ts 把 App 令牌 401 记成待核对 → 按 upstreamStatus 记发送失败；[应修] installationId 永久缓存、迟到的 401 会清掉新令牌 → 取令牌失败重置安装号，401 只清同一个令牌；[应修] 部署工作流用 secrets.GITHUB_APP_*，GitHub 不许这种名字 → 全链路改名 GH_APP_ID、GH_APP_PRIVATE_KEY；[应修] 还没记过站内角色的老账号在成员表显示「不是成员」、对话框保存是灰的 → 下发 role_unrecorded，显示「还没记录」并说明；[应修] 接上 GitHub 时称号指派仍先按本地旧登录名找人 → 按 GitHub 用户 id 找；[应修] API.md 的错误码与 /auth/callback 说明没跟上 → 已改；[建议] Person.email 多下发给队长 → 去掉；sourcesVisible 参数名 → 改成 key。需求一路：GitHub 页面没说要由组织所有者建 App → 门禁说明补一句；邀请链接页被整页挡住 → 不接 GitHub 也能打开，已有链接可停用、删除；ADR 第二次修订把 agent 的设计写成所有者决定 → 只有第 1 条是所有者原话，第 2–5 条标为待确认；默认权限包没重审 → 写进 SECURITY 的残余风险
- 结果：结论：有条件通过。每条修复都有回归测试（signin-methods 新增 2 例、github-connection 新增 2 例、console.test 新增 1 例），修复后 vitest server 375、console 185、tooling 727、web 237 例通过，ego-browser 看过修后的控制台。留着没改、交所有者定：启动时改写库里提督、舰员的称号说明；邀请码账号回填成舰员（多了 console.access 与 github.org.read）；配了 App 时缩小 OAuth scope；安全页改要 github.org.manage；ADR 第 2–5 条。留作建议不改：OrgRole 命名、people.push 三处同组字段、appToken 只给测试用、注释引用所有者原话（与周围一致）、ConsoleRoot 对非 GitHub 会话的未记录老账号仍显示「不是成员」（几乎碰不到）。未验证：真实 GitHub App（没有凭据）、真实 Google 往返、真实发信、正式环境。条件：发 rc.10 到预发布核对，所有者验收并确认上面几项

## 09:57:36 +08:00 · 合并 · #262 · 本机把 task/262/signin_methods（c0db1999）合进 stage 候选 b6974015

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：账号被封期间按所有者 2026-10-23 00:37「本机发预发布」在本地合并：在 stage 候选 02003548 上 git merge --no-ff task/262/signin_methods 得到 merge commit b6974015，没有 PR、没有推送。git diff --quiet task/262/signin_methods b6974015 为 0（合并树与 task 分支的树相同），沿用 task 分支上 555477f3 提交前的验证
- 结果：stage 候选 b6974015，本地 tag v0.1.1-rc.10（未推送）。缺 GitHub PR 和 PR 上的审查结论，账号恢复后补
- 下一步：账号恢复后按 .tools/pending/RECOVERY-CHECKLIST.md 推 task 分支、开 PR、再快进 stage

## 10:13:57 +08:00 · 返工 · #262 · 按 rc.10 上的核对改邀请链接页的空状态

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：rc.10 预发布上看到：没接上 GitHub 时「生成链接」已置灰，空状态却写「用右上角的「生成链接」创建第一条。」。app/console/src/pages/github/InviteLinks.vue 的空状态说明按 connected 分两句，没接上时写「接上 GitHub 后，用右上角的「生成链接」创建第一条。」；pnpm catalog:generate 只改了六个生成文件里的来源摘要
- 结果：改动一行；文档核对：docs/services/console/README.md 不用改——它写的是没接 GitHub 时邀请链接页能打开、生成要等 App，这一行只是空状态说明

## 10:13:57 +08:00 · 提交 · #262 · 提交邀请链接空状态的修正 325e98c2

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：git commit 325e98c2（fix(console)，7 个文件：InviteLinks.vue 与重新生成的项目目录）
- 结果：check:docs、catalog、doc-sync、boundaries、secrets 与 check-architecture --base bba4b066（152 个变更文件）为 0；pnpm typecheck 为 0；vitest console 185、tooling 727 例通过（重新生成目录前 tooling 的目录同步用例失败 1 例，生成后通过）；pnpm --filter @yzgc/console build 为 0

## 10:13:57 +08:00 · 审查 · #262 · 325e98c2 的审查：通过

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：按 .agents/skills/code-review 的「无需逐项审查」处理：改动只有一句界面文案按已有的 connected 计算属性分支，加上生成目录的摘要，不碰接口、权限、密钥、部署与数据；我（作者）对照 diff 核对：三元表达式两支文案都是平实中文、没有 emoji，connected 为真时文案与原来一致，生成文件只差来源摘要
- 结果：结论：通过。未验证：空状态在浏览器里的显示要等 rc.11 部署到预发布后看（样板数据里有链接，看不到空状态）
