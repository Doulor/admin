# task/278/contest_site · crosery · 2026-10-24

负责人：crosery

## 14:04:50 +08:00 · 开工 · #278 · 接手 #278 第一期比赛官网、托管、SDK、GitLab 贡献计分、奖励与兑奖码

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：主会话已从 stage e43df562 建好 task/278/contest_site 与 .claude/worktrees/task-278（含 #280 的 1bd64d6d：grade.ts 与 account_profiles 两列）；读完 AGENTS.md 第 0 节规范、COMMITS、TESTING、交接目录的 SPEC §7、CONTRACT-278、DESIGN-278、CONTRACT-274 通用约定、ACCEPTANCE F 节，以及现有比赛、GitLab 同步、权限、限额、操作记录代码
- 结果：git branch --show-current = task/278/contest_site，工作区干净，HEAD 1bd64d6d
- 下一步：先写服务端：托管与站点包校验、公开接口与缓存限流、贡献收集与有用标签核实、年级系数、奖项、定榜与兑奖码

## 14:30:32 +08:00 · 方案 · #278 · 服务端方案定稿：托管、公开接口、贡献收集、年级系数、定榜与兑奖码

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按 CONTRACT-278 与所有者 10-24 13:45 的规则定下替所有者做的决定：积分记录加 grade/grade_factor/weighted_points 三列（百分数，不重建 CHECK），扣分不乘系数；标签被拿掉时只撤销经标签自动加的分、候选回待确认，控制台确认的不动，定榜后都不改；作者自己打的「有用」不算；定榜名次严格不并列（同分先到者在前，再按报名先后），只发给分数大于 0 的个人；兑奖码 YUGC-XXXX-XXXX-XXXX-XXXX（80 位随机），库里存 SHA-256、AES-GCM 密文和末四位；新节点 competition.prize.redeem（已被 competition.* 与 * 覆盖，不改种子台账）；公开接口缓存 10 秒、按 IP 每分钟 120 次，另加整份快照接口给 SDK 轮询；预览用一小时有效的签名路径段，因为 sandbox 页面的子资源请求不带 cookie；站点文件放在数据库旁的 sites/，不加新环境变量
- 结果：lib/ 新增 site-package、competition-site-store、competition-rules-store、competition-public、competition-candidates、competition-prizes；server tsc 通过，现有服务端测试除两处表与种子清单外全过，两处按新增的表与种子补上
- 下一步：写服务端测试：托管与预览、公开接口不漏字段与限流、标签核实、年级系数、定榜、兑奖

## 14:44:10 +08:00 · 开发 · #278 · 服务端：官网托管、公开接口、贡献收集、年级系数、定榜与兑奖

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：新增 7 张表与 3 个积分列；site-package 校验站点包；/c/:slug 同域托管加 sandbox CSP 与签名预览；公开天梯、动态、统计、快照接口按 IP 限流并缓存 10 秒；GitLab 收集合并的 MR 与 Issue 并核实「有用」标签；年级系数按记分时刻落库；定榜生成兑奖码，控制台查找与核销；新节点 competition.prize.redeem；同步 server README、endpoint-contracts、data-model、API、SECURITY
- 结果：npx tsc -p app/server/tsconfig.json --noEmit 无错误；npx vitest run tests/server 35 个文件 602 个测试全部通过（新增 competition-site/public/candidates/prizes 四组 25 个）
- 下一步：提交服务端；再做 SDK、打包脚本、nginx、官网、门户与控制台

## 14:44:30 +08:00 · 提交 · #278 · 提交服务端阶段 326e9c10

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按文件逐个 git add 39 个文件，提交 326e9c10 feat(server): 比赛官网托管、公开接口、贡献收集、年级系数、定榜与兑奖码（Refs #278）
- 结果：本地提交，没有推送
- 下一步：SDK、scripts/contest-site.mjs、nginx 与运维文档

## 15:12:04 +08:00 · 开发 · #278 · 比赛 SDK、第一期官网站点、站点包打包脚本与 nginx

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：新增 shared/competition-sdk（匿名 GET、四种错误、subscribe 最短 5 秒、限流等 retry_after）与 sdk.vite.config.ts 构建 /sdk/competition/v1.js；新增 sites/contests/oss-2026-1 官网（Canvas 天空与参赛者星星、泡泡字标题、翻牌倒计时、终端打字、领奖台天梯、动态流星、规则计分奖项时间线组队 FAQ，减少动态效果时静态）；scripts/contest-site.mjs pack/check 复用服务端校验；web 容器与宿主 nginx 加 /c/、/sdk/，只给站点包上传放宽 21m；同步 docs/services/web/README.md、docs/ops/DEPLOY.md，根目录加 contest:site
- 结果：vitest 4 个文件 46 个测试通过（competition-sdk 5、contest-site 6、tooling/contest-site 3、web-nginx 32）；check-boundaries 通过；tsc -p app/web/tsconfig.json 无错误；node scripts/contest-site.mjs pack 第一期产物：5 个文件、zip 227873 字节，校验通过
- 下一步：提交这一阶段；再做门户比赛窗口（奖项、年级系数、10 秒刷新、我的兑奖码、深链）

## 15:12:37 +08:00 · 提交 · #278 · 提交 SDK 与官网阶段 2510bf2f

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按文件逐个 git add 32 个文件，提交 2510bf2f feat(portal): 第一期比赛官网、比赛 SDK 与站点包打包脚本（Refs #278）；第一次提交的说明少了标题后的空行，本地 amend 改正，没有推送过
- 结果：本地提交，没有推送
- 下一步：门户比赛窗口：奖项、年级系数与「有用」规则、天梯 10 秒刷新、我的兑奖码、?competition= 深链

## 15:21:20 +08:00 · 开发 · #278 · 门户比赛窗口：奖项、年级系数、10 秒天梯、兑奖码与官网深链

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：competitions.ts 读 prizes、grade_factors、finalized_at；competitionHub 加 readMyResults、factorText、rankRange、shortTime 与 results 路径，计分规则与操作条文案改成「有用」才计分、MR；详情概览加年级系数与奖项、Hero 加「比赛官网」、initialTab；天梯轮询 30 秒改 10 秒；「我的参赛」顶上列定榜结果、兑奖码与复制；?competition=<id>&view=team 深链选中比赛并打开队伍页签，读完从地址去掉；icons 加 file-copy-line、gift-line、thumb-up-line；同步 docs/services/web/portal.md 与 docs/plan/COMPETITION-APP.md
- 结果：npx vitest run tests/web 33 个文件 303 个测试通过（新增 portal-competition-results 8 个，hub 测试改 10 秒与新文案）；tsc -p app/web/tsconfig.json 无错误
- 下一步：提交门户阶段；再做控制台（待确认贡献、计分与奖项、官网、定榜、兑奖页）

## 15:21:35 +08:00 · 提交 · #278 · 提交门户阶段 157ce848

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按文件逐个 git add 12 个文件，提交 157ce848 feat(portal): 比赛窗口加奖项、年级系数、10 秒天梯、兑奖码与官网深链（Refs #278）
- 结果：本地提交，没有推送
- 下一步：控制台：待确认贡献、计分与奖项、官网上传发布、定榜、兑奖页

## 16:47:04 +08:00 · 开发 · #278 · 控制台比赛页签、兑奖码核销、宿主上传上限回退与浏览器验收

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：控制台比赛页按权限分六个页签：待确认贡献（确认/驳回/立即收集）、计分与奖项（年级系数与可选奖项）、官网（上传校验、预览、发布、下线，413 时说明网关拒收）、定榜（预览名次、定榜、撤销）；新增 /console/competitions/redeem 核销页（查找、二次确认、刚登录过才能核销）与比赛列表的「核销兑奖码」按钮；lib/competition-contest 放表单与提示逻辑，mock 补四个读接口。宿主 nginx 模板回退到 6m 单一反代（第二阶段加的上传 location 让 #168 的 XFF 与 upstream 测试失败），只在 web 容器里给上传放宽 21m，DEPLOY、web README、Dockerfile 注释与 web-nginx 测试同步。sites 路由补响应 Schema；ownership.json 补 22 条比赛流程与证据，重新生成目录，写 docs/changes/278.json。ego-browser 在 1440×900 与 390×844 看官网、门户比赛窗口与控制台：修了奖项卡第三张（无说明）内容下沉、页脚气泡折行与极客娘挡住窗口标题、天梯说明孤字折行、门户手机计分卡 +15～+100 折行、控制台上传人压到上传时间、上传区英文提示、核销结果定义列表错位、「@系统」字样、手机上六个页签折成三行并被裁掉（改成横向滚动并把当前页签滚进可视区）
- 结果：pnpm test 119 个文件 1864 个测试全部通过；pnpm typecheck 通过；pnpm check 在 check:architecture 失败，原因是 origin/stage 停在 4beda55e（GitHub 封禁后没更新），把其他任务的 567 个文件算进来；node scripts/check-architecture.mjs --base 1bd64d6d --branch task/278/contest_site 通过（104 个变更文件、229 个关联节点）；check:catalog 通过；官网包 5 个文件、zip 227916 字节、首屏 JS 16.20 KB gzip；浏览器里官网 origin 为 null、没有 CSP 违规、两种尺寸无横向溢出、减少动态效果时 0 个运行中的动画、Tab 顺序 13 个焦点都有 3px 焦点环；本地核销一次成功，再查同一码显示已核销与核销人，查不存在的码提示「没有这个兑奖码」；截图在 /tmp/geek-takeover/c278/shots/
- 下一步：按阶段提交控制台、宿主上传回退与页面修正、目录与变更清单；真实 GitLab 收集、预览环境与 >6MB 上传未验证

## 16:52:40 +08:00 · 提交 · #278 · 提交控制台、宿主上传回退、页面修正、路由 Schema 与架构清单

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按文件逐个 git add，分五个提交：a2d85e29 feat(console) 比赛页四个新页签与兑奖码核销；11136e18 fix(deploy) 宿主模板退回 6m、上传只在容器放宽；9fb497ef fix(portal) 官网页脚、奖项卡与门户手机计分卡排版；1b774ac5 fix(server) 官网托管路由登记响应 Schema；c8a3837a docs(architecture) ownership、目录与 docs/changes/278.json。第二个提交起初把部署回退和排版修正合在一个 fix(web) 里，scope 不在词表、也不是一个目的，没推送前 reset --soft 拆成两个
- 结果：本地提交，没有推送；工作区干净；pnpm test 119 个文件 1864 个测试通过
- 下一步：交主会话：审查、预览环境验收；真实 GitLab 收集与「有用」标签、经宿主上传 >6MB、真实账号核销未验证

## 17:34:33 +08:00 · 返工 · #278 · 比赛官网改成浅色、不沿用主站风格

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按所有者 2026-10-24 16:38 的要求（「比赛官网能不能不要有暗色了，就比赛官网炫酷好看一点，去炫技」）重做第一期官网：去掉夜空 Canvas（sky.ts）和极客娘图（public/geek-girl.webp），首屏改成暖白底加四团慢慢漂移的彩色光晕，标题是贡献热力图拼出的「OSS CHALLENGE」（5×7 点阵、指针放大、点一下扩波纹、有新贡献时自动扩一圈），倒计时每位数字滚动，首屏下面加一条斜着滚动的贡献条（ticker.ts）；各段落改成白卡片、2px 墨线和彩色硬阴影，年级系数改成柱状图，第一名奖项卡是转动的彩色边框，天梯换名次时行位移动画；手机 720px 以下单列。另修 server：已发布版本的 HTML 原来也是 public, max-age=300，换版本后浏览器拿缓存里的旧 index.html 去找已经删掉的资源文件，整页不加载（本机换包时复现：页面引用旧的 index-BW3XsS8W.js，fetch 失败）；改成 HTML no-cache、其它文件仍 5 分钟，测试、接口文档、API.md、目录与 changes/278.json 同步。测试里的必备文件和打包样例换成 ticker.ts 与 styles.css，vite 的 publicDir 关掉。
- 结果：构建 JS 33.21 kB（gzip 13.90 kB）、CSS 6.79 kB gzip，包 4 个文件 25080 字节；pnpm typecheck 通过，pnpm test 119 个文件 1864 条全过。ego 浏览器在本机 nginx 叠加宿主 CSP 的环境里：1440×900 与 390×844 横向溢出 0、来源 null、只请求同源资源，可见文字 191 处对比度全部 ≥4.5，渐变字三色在底色上 4.83–5.93；减少动态效果时运行中的动画 0 个、标题照常画出；Tab 焦点有 3px 紫色描边；换包后普通刷新直接拿到新的 index-CgGejInr.js。截图在 /tmp/geek-takeover/c278/shots/v3-site-*。
- 下一步：跑 check:catalog、check-architecture 与 pnpm check，提交，收 ego TaskSpace，回报 team-lead。

## 17:37:33 +08:00 · 提交 · #278 · 浅色官网与 HTML 缓存修复分两个提交

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：5bd3e9a0 feat(portal) 官网改浅色独立风格（站点源码、测试、目录、web README、portal.md、changes/278.json）；d029c543 fix(server) 已发布官网 HTML 改 no-cache（路由、测试、endpoint-contracts、API.md、目录不变量、changes/278.json）。两个提交各自重新生成目录，check:catalog 在两个状态下都通过。只加指定文件，没有推送。
- 结果：两个提交落在 task/278/contest_site，工作区只剩这条记录。
- 下一步：跑 pnpm check 与 check-architecture，提交记录，收 ego TaskSpace 和本机服务，回报 team-lead。
