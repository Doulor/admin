# task/309/env_isolation_parity · crosery · 2026-10-28

负责人：crosery

## 19:17:48 +08:00 · 开工 · #309 · hotfix：预发布与正式环境硬隔离、去硬编码、同构迁移门禁

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：从 origin/main 228be7bf 拉 task/309/env_isolation_parity 与 .claude/worktrees/task-309（手工建，task.mjs start 只从 stage 拉）；所有者 2026-10-28 19:11 原话已写进 GitLab #309 正文的确认依据；交接文档 .tools/handoff/2026-10-28-hotfix-env-parity/
- 结果：worktree 已建，HEAD=228be7bf；pnpm install 后台进行中
- 下一步：盘点硬编码，写 check-env-isolation、.env.dev、同构清单与烟测，再改规范与提示词

## 19:38:57 +08:00 · 方案 · #309 · 盘点硬编码与同构缺口，定三层防线

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：git grep origin/main 盘点环境域名 31 个文件；实测正式与预发布 /release.json、CSP、/oidc、内部赛事官网；定方案：① scripts/check-env-isolation.mjs（三份 env 键集一致、值隔离、写死域名登记）② scripts/parity.mjs 同构清单与发版烟测 ③ 两条正式部署工作流加 parity 与 smoke job ④ 规范 RELEASE-PARITY 与提示词同步
- 结果：实测：正式 /oidc 404、预发布 200；两环境 /c/oss-challenge-2026-1/ 均 200 且 md5 相同；正式与预发布 env 模板仅 8 个键不同

## 19:38:57 +08:00 · 开发 · #309 · 检查脚本、清单、烟测、工作流门禁、规范与技能完成

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 scripts/check-env-isolation.mjs、scripts/parity.mjs、deploy/env/.env.dev、origin-exceptions.json、deploy/parity/{ledger,smoke}.json、tests/tooling/{env-isolation,parity}.test.ts；gitlab-oidc.rb 改读宿主文件；deploy-manual.mjs 读 environments.json；deploy-production/hotfix 加 parity、smoke job；写 RELEASE-PARITY 并同步 AGENTS.md、RELEASES、BRANCHING、CODE-REVIEW、ENVIRONMENTS、CICD、DEPLOY、GITLAB 等；新增 release-parity 技能
- 结果：tests/tooling 新增 31 条通过；actionlint 两条工作流无输出；check-env-isolation 对注入的 prev 域名失败、还原后通过；对线上跑 parity.mjs smoke 正式与预发布均通过，compare 报出正式缺 /oidc；文档核对：docs/services/server/ 不用改——oidc.md 只补了一句签发者读宿主文件，接口和表没变

## 19:42:43 +08:00 · 提交 · #309 · 本地提交 1769ee84

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：fix(deploy): 三份 env 严格隔离、去掉写死的环境域名并加同构门禁，42 个文件，从 origin/main 228be7bf 起；未推送
- 结果：git log -1 为 1769ee84；工作区只剩 notes 两个文件

## 19:56:11 +08:00 · 方案 · #309 · 所有者补充：接口与表对齐、数据只对齐格式、清死接口

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：19:43 所有者原话：对齐的本质是接口对齐，数据库表对齐，但是数据不是对齐的，谨记是格式的对齐，而且要清理对应的死接口，就是我们所有级页面都不存在的接口。据此：RELEASE-PARITY 增口径与第九节；烟测去掉内部赛事官网的正文比对，改比公开 JSON 的键和值类型；用 catalog 的 213 条显式路由逐条查页面、CLI、脚本、外部协议的调用方
- 结果：静态搜索 44 条无直接匹配，逐条人工确认：forum-api.ts、competition-sdk、hubPaths 的 what 参数、console 的 base.value 拼接、CLI 的 {origin} 拼接、OIDC 同意页、nginx 反代的 llms.txt 都有调用方；只有 GET /api/console/departments 没有任何调用方，roles.ts 头注释早已写明只剩它和一条单测在读；已退役的旧论坛 410 兜底 28 条不算死接口，未动

## 19:56:11 +08:00 · 提交 · #309 · 本地提交 0c39d3c6

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：第二次提交：数据只对齐格式（parity.mjs sameShape、smoke.json、规范与技能）并删除 GET /api/console/departments（路由、contracts、ownership 流程、文档，测试改断言 404）；第一次提交 1769ee84 与对齐补证据提交 e8b87dad 不变；均未推送
- 结果：check-architecture --base origin/main 通过（51 个变更文件，36 个关联节点）；compare 对线上只剩 /oidc；tests/server/console.test.ts 15 条通过

## 20:00:41 +08:00 · 审查 · #309 · 作者自审，被审查提交 0c39d3c6

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：按 CODE-REVIEW 逐项对照 origin/main...HEAD（51 个文件）：新增行里没有任何环境域名（git diff 过滤为空）；env 三份键集一致由 check:env-isolation 核对；sameShape 记录内部只比同名字段类型；删除的 GET /api/console/departments 在 catalog 213 条显式路由中是唯一没有调用方的，44 条静态搜不到的逐条人工确认；同构清单 7 条 pending 会拦住 deploy-hotfix 与 deploy-production，包括本次 hotfix 自己
- 结果：结论：有条件通过。条件：1 这是作者本人自审，进 main 前需要另一位审查人或所有者复核；2 parity 与 smoke 两个 job 没有在真实 GitHub Actions 上跑过，只有 actionlint 和结构测试；3 P-0003..P-0009 需所有者授权在正式环境做完或逐条豁免，否则 hotfix 部署被自己的门禁拦住；4 没有正式访问日志，无法证明 departments 接口在页面之外没有外部调用。验证：tests/server 与 tests/tooling 118 个文件 2187 passed、27 skipped；typecheck 通过；check-architecture、check:catalog、docs-index、doc-sync（对 origin/main）、check:notes、check:secrets 通过

## 20:12:11 +08:00 · 开发 · #309 · 同构清单 P-0004 按实测标 done，并核对线上 GitLab、CDN、内部赛事

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：P-0004：gh secret list --env production 有 GOOGLE_CLIENT_ID/SECRET（07:23Z 创建），线上 /auth/providers 列出 google，/auth/google 302 到 Google。线上只读实测：git.yangtzeu.work 30 次请求 30 次 200；GitLab 单点登录 POST 后 302 到 prev.yangtzeu.work/oidc/auth（正式跳预发布的根因）；cdn.yangtzeu.work 直连 103.240.197.216 30 次里 18 次超时；内部赛事 /api/public/competitions/oss-challenge-2026-1 的 7 个接口两边都是 200 且格式一致
- 结果：pending 由 7 条降为 6 条（P-0003、P-0005..P-0009）；正式 /api/public/gitlab/projects 返回 unavailable:true，两边 stats.updated_at 都是 0；deploy/remote/garage-archive.mjs 的备份端点写死 cdn.yangtzeu.work，而该域名当前解析到不稳定的直连 IP

## 20:12:25 +08:00 · PR · #309 · GitLab MR !51 到 main

- 执行者：agent-claude-geek-main-09（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者 20:02 同意推送；分支推到 gitlab 并用 push option 开了 MR !51（目标 main，描述含 Closes #309）；没有合并，没有触发任何流水线
- 结果：MR 地址 https://git.yangtzeu.work/geek/admin/-/merge_requests/51；完整 PR 正文草稿在 .tools/handoff/2026-10-28-hotfix-env-parity/PR-BODY.md，GitLab 没有 API 凭据，描述只写了一行，待所有者在网页补全
