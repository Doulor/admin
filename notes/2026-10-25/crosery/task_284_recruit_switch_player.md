# task/284/recruit_switch_player · crosery · 2026-10-25

负责人：crosery

## 12:58:01 +08:00 · 开工 · #284 · portal 招新开关、关闭页与桌面窗口播放器

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：从 GitLab stage 130a58b8（rc.22）建 task/284/recruit_switch_player 与独立 worktree .claude/worktrees/task-284；GitHub origin/stage 落后 378 个提交，所以基线取 GitLab
- 结果：worktree 已建；依据：Crosery 2026-10-25 12:52 接手指令，issue #284 已在 GitLab 建立并写入所有者确认
- 下一步：装依赖后按 issue 验收条件实现

## 13:24:18 +08:00 · 提交 · #284 · 招新总开关的服务端

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 lib/apply-settings.ts（app_state 里 apply_open 一行，没有就是开放）；GET /api/public/config 多下发 apply_open；POST /api/portal/apply 在 apply.submit 之后判断开关，关闭回 403 apply_closed，不落库不占额度；控制台 GET/PATCH /api/console/applications/settings（apply.view 读，新节点 apply.settings 加 requireStepUp 写，状态真的变了才记 application.settings.update）；补 tests/server/apply-switch.test.ts 共 14 条；同步 server README、endpoint-contracts、API、SECURITY、data-model 与项目目录（ownership.json 两条新流程、app_state 说明、模块归属）。没有新增表，不需要迁移。
- 结果：npx vitest run tests/server：45 个文件 709 条通过（含新 14 条）；把 requireApplyOpen 暂时拿掉后关闭期间的 3 条用例变红，恢复后变绿；tsc -p app/server/tsconfig.json 无错误；pnpm catalog:generate 与 pnpm check:catalog 通过；pnpm check:docs、node scripts/check-doc-sync.mjs 通过。控制台页面与官网还没做，浏览器未验证。
- 下一步：控制台「投递」页顶部加开关，再做官网关闭页和宣传片窗口

## 13:30:19 +08:00 · 提交 · #284 · 控制台投递页的招新开关

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：投递管理页头下面加一栏「招新投递：开放中 / 已关闭」，持有 apply.settings 的人看到 TxSwitch，点之前弹确认框（关闭按危险样式），确认后 PATCH /api/console/applications/settings，服务端回来才换状态，失败（含 step_up_required）开关留在原状态并出横幅；文字、确认框、提示是 lib/applications.ts 的纯函数；本地节点名「招新开关」、操作记录里 application.settings.update 与 http.apply_closed 的中文名、开发预览的读与写核对；console README 补一节；ownership.json 两条流程补控制台证据。文档核对：docs/architecture/API.md 不用改——接口和字段在上一个提交已写全，这次只是页面。
- 结果：npx vitest run tests/console：20 个文件 248 条通过（applications.test.ts 新增 5 条）；把 NODE_LABELS 里的 apply.settings 暂时删掉后 2 条变红，恢复后变绿；pnpm --filter @yzgc/console typecheck 无错误；pnpm catalog:generate、pnpm check:catalog、pnpm check:docs、node scripts/check-doc-sync.mjs 通过。页面没有在浏览器里看过（任务书不让起浏览器），1440 与 390 宽度的版面未验证。
- 下一步：官网「加入我们」窗口的关闭页，和桌面上其他引导投递的位置

## 13:46:14 +08:00 · 提交 · #284 · 官网「加入我们」窗口的招新关闭页

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：「加入我们」窗口先读 /api/public/config 的 apply_open：读到之前只显示加载提示，开着是信纸，关着整个窗口换成新的 JoinClosed 关闭页（说明、看宣传片、关于极客班、去论坛，没有表单也没有注册登录，也不读 /auth/me）；寄信时服务端回 403 apply_closed 同样换成关闭页；读不到配置按开放处理并照旧提示连不上服务器。JoinBox 拆成外壳（读配置、宣传片遮罩、选页）和 JoinLetter（原来的信纸），宣传片遮罩的逻辑没动。桌面其它叫人去报名的位置跟着开关变：visibleApps(consoleLink, applyOpen) 把「加入我们」图标、启动器、终端里的说明换成「招新暂未开放」，便签去掉写信那一行，「关于极客班」的「怎么加入」改成「现在不招新」并去掉「加入我们」按钮；桌面挂载读一次开关，窗口读到的值同步回桌面。新增 lib/applyOpen.ts、components/os/JoinClosed.tsx、tests/web/portal-apply-switch.test.tsx（13 条），os.css 让关闭页共用回执的纸面样式，mock-api 的 public/config 补 apply_open。同步 docs/services/web/portal.md（文件表、便签、加入我们三条新说明、单测）与项目目录。没动的位置：页头页脚的「加入我们」链接只是打开窗口；index.html 的 meta 描述是静态文字；终端里 10-24 的「apply: 投递成功」是装样子的历史记录。
- 结果：npx vitest run tests/web：36 个文件 350 条通过（新 13 条，原有 337 条没改过一条断言）；把 applyOpenOf 恒为开放、去掉加载态、去掉 403 分支、关闭页放进注册入口、「关于」保留加入按钮、便签保留写信一步、说明不换、窗口读到的值不同步回桌面、桌面不读自己的开关，这九处逐个破坏后各有用例变红，恢复后全绿；tsc -p app/web/tsconfig.json 无错误；pnpm catalog:generate 与 pnpm check:catalog、pnpm check:docs、node scripts/check-doc-sync.mjs 通过。浏览器里没有看过（任务书不让起浏览器），1440 与 390 宽度的版面、关闭页按钮换行未验证。
- 下一步：宣传片改成桌面窗口：新窗口、关闭停播、最小化恢复、手机宽度，首次自动播的触发条件不变

## 14:26:02 +08:00 · 提交 · #284 · 宣传片改成桌面窗口播放器

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：宣传片从盖住整个页面的全屏层改成桌面里的「宣传片」窗口：osApps 里 promo 的打开方式从 panel 改成 window，窗口复用桌面已有的窗口管理（层叠、拖动、关闭、最小化、放大，手机上是底部面板），没有另写一套。lib/promoWindow.ts 放纯逻辑：promoEntry（什么时候自动弹）、visibilityStep（窗口收起时暂停、露出来接着播）、promoWidth 与 promoTop（按屏幕高度算窗口宽度和顶边，画面 16:9 不被截）。PromoPlayer 改成窗口正文，画面上没有按钮：窗口最小化（手机上被别的窗口盖住）时暂停，露出来从停下的位置接着播，关闭窗口播放器卸载，停止播放并释放片源和 hls.js，播完由桌面关窗口。首次自动弹出的条件原样保留：「加入我们」窗口挂上时这个浏览器没有 yugc_promo_seen 就弹一次，开了减少动态效果只写 cookie、不弹也不下载播放器；cookie 只在自动弹的那一次写，自己点开重看不写，加载失败不写。信纸上和关闭页都有「看宣传片」。放不了、加载失败、静音也不让播时窗口留着，画面上说明。手机上关掉宣传片时下面还有别的窗口就露出它，不一起回主屏幕。tests/web 新增 portal-promo-desktop.test.tsx（18 条）和 portal-promo-window.test.ts（7 条），portal-promo-player、lazy、gate 三份按窗口改写，tests/e2e/workflows.spec.ts 的宣传片部分改写。同步 docs/services/web/portal.md、docs/design/DESIGN.md，ownership.json 补证据后重新生成项目目录。
- 结果：npx vitest run tests/web tests/console tests/server：103 个文件 1334 条全部通过（web 38 个文件 377 条，console 20 个 248 条，server 45 个 709 条）；把宣传片的 23 处逻辑逐个破坏（关闭不记看过、active 恒为 true、active 不看最小化、promoEntry 不看 seen、promoEntry 不看减少动态效果、露出来总是恢复、露出来不恢复、收起不暂停、卸载不释放片源、手机关宣传片一律回主屏、顶边不夹、播完不关窗口、点画面暂停、Esc 被播放器拦下等），各有用例变红，恢复后全绿；pnpm typecheck 通过；pnpm check:docs、node scripts/check-doc-sync.mjs --base gitlab/stage、pnpm check:catalog、node scripts/check-architecture.mjs --base gitlab/stage、pnpm check:boundaries、pnpm check:secrets 通过；pnpm check:notes 仍报 notes/2026-10-24/crosery/task_276_forum_image_scan.md:47（该文件与 gitlab/stage 一致，不是这个分支改的）。没有在浏览器里看过（任务书不让起浏览器）：窗口在 1440×900 与 390×844 的版面、真视频的暂停与恢复、改写后的 e2e（本机不能跑）都未验证；手机竖屏不再把画面转 90 度铺满，是这次有意去掉的。
- 下一步：补 docs/changes/284.json 宏观对齐声明，然后回报主控

## 14:26:38 +08:00 · 提交 · #284 · 宏观对齐声明

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 docs/changes/284.json 宏观对齐声明：类型 business，涉及 server、console、web 三个应用；写明 14 个领域、21 条流程、8 条评估（权限、step-up、操作记录、公开配置、投递拒绝、官网关闭页、宣传片窗口、首次自动弹出条件）、6 组覆盖，文档 8 份、测试 9 份；兼容、迁移、回滚三段说清：接口只加不改，不加表不加列，开关是 app_state 里的一行、没有这一行就是开放，回滚换回上一版镜像即可，留下的 apply_open 一行没有程序读它。
- 结果：node scripts/check-architecture.mjs --base gitlab/stage：宏观对齐通过，#284，54 个变更文件，50 个关联节点；node scripts/check-doc-sync.mjs --base gitlab/stage 与 pnpm check:catalog 通过。这份声明只描述改动，没有增加新的验证；浏览器验收仍未做。
- 下一步：向主控回报：提交清单、各判据的测试证据、浏览器核对清单

## 14:27:09 +08:00 · 提交 · #284 · 更正宏观对齐声明记录里的评估项

- 执行者：agent-claude-geek-main-recruit（Claude Code，claude-sonnet-5-5）
- 做了什么：更正上一条「宏观对齐声明」记录：那条里「8 条评估」后面括号列出的事项写错了，不是 docs/changes/284.json 里评估的内容。声明里 8 条评估的键是 business、backend、permissions、data、dependencies、documentation、verification、delivery；其余数字（14 个领域、21 条流程、6 组覆盖、文档 8 份、测试 9 份）与文件一致。
- 结果：已对照 docs/changes/284.json 逐项核对：applications 3、domains 14、flows 21、assessments 8、coverage 6、documents 8、tests 9；上一条里这些数字属实，只有评估项的括号说法不对，以本条为准。

## 17:33:28 +08:00 · 提交 · #284 · 并入 stage a275e517：解决 15 个冲突文件，重新生成目录，补影响声明的邮件业务域

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：把 GitLab stage（含 #285 邮件模板、#291 Google 绑定、#292 启动动画）并入 task/284/recruit_switch_player：权限节点、操作记录中文名、控制台 mock 与两个文档的清单类冲突两边都保留；YugcOs.tsx 的深链接 effect 合成 先处理 #291 的 link 与 provider，再处理 #284 的 ?open=promo 与窗口应用；窗口属性里保留 applyOpen、onApplyOpen、onAutoPromo、promo，并带上 #291 的 linkNotice；server 文档四行用基线三方合并，#284 的招新开关与 #285 的邮件模板说明都在。合并提交只含冲突解决，目录在下一个提交里重新生成，影响声明补上 mail 业务域
- 结果：门禁：vitest tests/server tests/console tests/web tests/tooling 144 个文件 2289 条通过；typecheck、check:catalog、check-architecture（54 个变更文件）、check-doc-sync、check-docs、check-secrets、check-boundaries 全部通过
- 下一步：推送并开 MR，补 PR 与审查记录

## 17:35:57 +08:00 · PR · #284 · PR：GitLab !29

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：并入 stage a275e517 后推送 task/284/recruit_switch_player，开 !29（目标 stage，Closes #284，标签 func:api、func:data、portal、ui:interaction、ui:layout）；正文 10 段，验收证据是改前改后桌面与手机截图 14 张、隔离栈真实请求记录
- 结果：https://git.yangtzeu.work/geek/admin/-/merge_requests/29；门禁：vitest tests/server tests/console tests/web tests/tooling 144 个文件 2289 条通过，typecheck、catalog、architecture、doc-sync、docs、secrets、boundaries 全部通过
- 下一步：审查后合并

## 17:35:57 +08:00 · 审查 · #284 · 审查：!29 无阻塞、无应修条目

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：按 CODE-REVIEW 清单逐项核对 diff（54 个文件）：服务端逐行读了 apply-settings、投递接口的拒绝点、开关的读写接口与公开配置：关闭只认明确写下的 0，读不懂的值按开放算；403 apply_closed 排在登录与权限判定之后、人机验证与限额之前，被拒的投递不写库、不占额度；写开关要 apply.settings 加 step-up，状态没变不写库也不记操作；官网读不到配置按开放，提交时服务端说已关则切到关闭页。前端用单测与截图核对，没有逐行读 UI 代码；并入 stage 的冲突解决单独核对了 YugcOs.tsx 的深链接合并与 server 文档四行
- 结果：结论：通过；评论贴在 !29「代码审查」；未验证项已写进 MR：并入 stage 后没有重取真实请求与截图、e2e 用例未在本机运行、预发布页面
- 下一步：推送记录后按审查过的提交合并
