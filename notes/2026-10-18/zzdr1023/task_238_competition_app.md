# task/238/competition_app · zzdr1023 · 2026-10-18

负责人：zzdr1023

## 12:25:57 +08:00 · 审查 · #238 · 接手审查 2ba49b16：4 个分面审完，有条件通过，1 个真实缺陷

- 执行者：agent-claude-geek-main-243（Claude Code，接手审查与返工）
- 做了什么：按 CODE-REVIEW 对 PR #243 的 2ba49b16 逐项核对（后端、控制台、官网、文档与执行记录四个分面并行只读审查），读 origin/stage 的既有同类做法作对照；没有运行测试
- 结果：结论：有条件通过。真实缺陷 1 个（[应修]）：competition-store.ts update 用 patch.url ?? current.url，把合同允许的显式 url:null 吞掉，外部比赛的官方链接一旦填了就清不掉（同函数的 signup_deadline 用 === undefined 判，口径不一致）。其余应修：新能力 competitions.manage 没进 app/console/src/lib/permission-boundaries.ts（权限树会显示成「尚无执行说明」）；docs/architecture/SECURITY.md 的能力域清单漏 competitions.*；competition-store.ts 注释宣称状态判定是唯一实现，但控制台 mock 与官网上另有 2 份复刻、无一致性测试；官网 useCompetitions 用本地 statusAt 覆盖服务端 status，与注释和 portal.md 的「跟着服务端 status 走」不符；os.css 的 is-ended 用 opacity:0.66 把文字压到约 3:1（低于 DESIGN 4.5:1）；notes 缺「提交」阶段（branch-guard 必红）、PR 缺 4 个组:类标签、相对最新 stage 有 3 处文档冲突。另有 10 余条建议。PR 正文称 branch-guard「唯一原因＝缺审查记录」与 CI 日志（缺提交、审查两条）不符
- 下一步：按审查结果返工并解冲突

## 12:25:57 +08:00 · 返工 · #238 · 解 3 处冲突，按审查修 1 个缺陷与 8 处应修

- 执行者：agent-claude-geek-main-243（Claude Code，接手审查与返工）
- 做了什么：merge origin/stage（68afc4f0；docs/services/server/README.md、docs/services/web/README.md 的「更新：」取较晚者，notes/INDEX.md 用 note.mjs index 重新生成）；competition-store.ts 的 url 改按 undefined 判；permission-boundaries.ts 补 competitions.manage 条目；SECURITY.md 能力域补 competitions.*；portal.md 与 competitions.ts 注释改成「状态一律本地算、响应 status 只做形状校验」；Windows.tsx 外链 rel 统一 noopener noreferrer；os.css 去掉 is-ended 的 opacity、外部标签改用令牌、长名称与描述加 overflow-wrap；mock-api.ts 去掉写死的 status；Competitions.vue 删不可达的只读分支与死导入；data-model.md 拆开 CHECK 与 https 归属、登记预留索引；补 4 条回归（url:null 清空、状态以时间戳为准、60 秒重算、官网 statusAt 与服务端 competitionStatus 逐点一致）
- 结果：pnpm check 通过；pnpm test 76 文件 1112 条全过（比赛三组由 29 条增至 33 条）；docs-index --check、check-doc-sync 通过；未在本地跑 e2e 与浏览器验收（留给 CI 与人工验收）

## 12:25:57 +08:00 · 提交 · #238 · 提交审查与返工

- 执行者：agent-claude-geek-main-243（Claude Code，接手审查与返工）
- 做了什么：feat/refactor 提交：按审查修构造函数与文档（提交 SHA 见下一条推送记录）
- 结果：c183015（作者原提交）之前没有「提交」记录，本条补齐；分支当前 head 见推送记录

## 13:14:12 +08:00 · 返工 · #238 · url 改为全类型可选，比赛窗口加宽到 780

- 执行者：agent-claude-geek-main-243（Claude Code，接手返工）
- 做了什么：按所有者 2026-10-18 的澄清返工：① url 从「只准 external」改为「全类型可选」（内部比赛也能挂自己的比赛官网），改 6 处——db.ts 的 CHECK 改成 url IS NULL OR url LIKE 'https://%'、competition-store.update 不再按 kind 清 url、console 路由 normalize 改成只把空串当没填、官网 readCompetition 只按 https 收、控制台 formErrors/formPayload 不再看 kind、Competitions.vue 的 url 输入框去掉 v-if；配套契约与 store 注释跟着改；三条断言反转（服务端「切 internal 保留 url」、官网「internal 的 https 链接保留」、控制台「链接对所有类型可选、填了必须 https」）。② 窗口宽度 720→780（Windows.tsx 的 META，与最宽的论坛窗口对齐）。③ 三处文档改口径：API.md、data-model.md、web/portal.md
- 结果：pnpm check 通过；pnpm test 76 文件 1112 条全过；比赛三组 33 条。url 的 DDL 改动是合并前返工（origin/stage 上还没有 competitions 表），零数据迁移
- 下一步：等 CI 与 Netlify 预览重建；窗口分区（我的参赛/我的组队）与内部比赛站托管是 #243 范围外的新工作量，待所有者确认后另建 issue
