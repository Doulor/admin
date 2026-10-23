# task/270/gitlab_sso · crosery · 2026-10-23

负责人：crosery

## 10:58:49 +08:00 · 开工 · #270 · 自建 GitLab 用极客班统一登录，每个极客班账号都有对应的 GitLab 账号

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 01:01「……对应的仓库也成为我们进入桌面的一个应用和论坛，控制台，那些一样统一一个sso登录身份，而且所有有极客班登录身份的都有对应的gitlab账号……相关的所有ui设计都全部由你负责」，10:32「二阶段可以继续进行，我这边同意的」，10:45「gitlab那边的登录可以走极客班的sso统一登录，因为毕竟数据都要一起统计」。GitHub 账号被封，issue 建在自建 GitLab geek/admin：先按 GitHub 编号建 #1–#269 占位（只开 #239、#262），再建 #270（https://git.yangtzeu.work/geek/admin/-/work_items/270）。task.mjs start 要连 GitHub，不可用，按 #262 的做法从本机 stage 候选 b542b3be 用 git worktree add 建 task/270/gitlab_sso；与 #262 的分工已和另一个会话（geek-main-56）对好：本分支不改 SignIn.vue、signin.ts
- 结果：worktree .claude/worktrees/task-270，基于 b542b3be
- 下一步：装依赖，写 OIDC 模块、授权页、gitlab-sync 与桌面应用

## 12:11:57 +08:00 · 提交 · #270 · 1b03781c 内嵌 OIDC 签发者、同意页、GitLab 账号同步与桌面「代码仓库」

- 执行者：agent-claude-geek-main-1c（Claude Code，claude-opus-5-5）
- 做了什么：提交 1b03781c（73 个文件）：server 内嵌 oidc-provider 9.12.2 的签发者 /oidc/*（授权码 + PKCE S256、pairwise sub、登录以 sid 为准，没配 OIDC_JWKS 时 404），交互入口与同意页三个接口，五张新表，cli/oidc.ts；GITLAB_SYNC=off/dry-run/on 的账号同步与控制台两个接口；控制台同意页 /authorize；nginx 的 /oidc/ 与 /authorize；官网桌面「代码仓库」；两个环境的 GITLAB_* 与两个密钥；文档与 docs/changes/270.json。截图时发现两处并当场改了：控制台开发代理的 "/auth" 前缀把 /authorize 也转给了核心，改成 ^/auth/；同意页应用图标的底色盖掉了图标的 mask，改成外层容器。宏观对齐的 migration 说明里有尖括号被判成占位，改写。文档核对：docs/services/web/README.md、portal.md、console/README.md、server/README.md、ops 三份都随改动改了。
- 结果：pnpm test 96 个文件 1573 条通过；pnpm typecheck 通过；check:catalog、check:environments、check:secrets、check:docs、check:notes 通过；check:architecture 与 check:doc-sync 按 --base b542b3be 通过（默认的 origin/stage 是 GitHub 上过时的那份，对它比较会把 #262 的改动也算进来）。ego-browser 截图：同意页 1440×900、390×844 无横向溢出、无 emoji；官网桌面 1440×900 图标、便签、Dock 第 3 位是代码仓库，图标列与便签不重叠。截图在 ~/work_file/geek-shots/270/。
- 下一步：合 GitLab stage 2101fe40（geek-main-56 已合 #262 第五轮），派独立审查，开 MR 交给 geek-main-56 合并
