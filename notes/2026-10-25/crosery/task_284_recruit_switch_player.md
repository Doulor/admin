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
