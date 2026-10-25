# task/281/usage_guides · crosery · 2026-10-25

负责人：crosery

## 02:02:33 +08:00 · 提交 · #281 · 753cdbac、13bb9b2c、25f0524c、c6382b04：使用说明正文、合并 stage、补今天的功能

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：docs281 子 agent 写的 25 篇按身份的说明、播种成官方帖、截图上 CDN 的通路一起提交为 753cdbac；合并 GitLab stage d1f64ec5（13bb9b2c，只有 docs/services/server/README.md 一处冲突，取 stage 的版本再补回 forum-content 读使用说明这一句），项目目录单独重新生成（25f0524c）；按今天合进 stage 的 #276 表情包与回复框、#282 备份下载要刚登录过和整机搬家，改了三篇说明（c6382b04）
- 结果：tests/server/forum.test.ts 60/60 通过；tests/tooling/static-cdn.test.ts 里截图那条用例仍失败，因为 24 张截图还没拍，正文里还是 shot:名字 占位，按设计拦着不合并
- 下一步：等 #278 的界面做完再拍 24 张截图（控制台、桌面、论坛），放进 app/forum/content/guide-images/ 换成 CDN 地址，补比赛状态「规划中」的说明

## 04:07:57 +08:00 · 提交 · #281 · 合并 stage 7aa5e777，比赛指南按 #278 改

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：合并 GitLab stage 7aa5e777（d2cc40ff，冲突在 server README 与目录：README 两边都保留，目录取 stage 后另提交 cfe39854 重新生成）；并入 #278 合并与收尾的暂存记录（3177ecf9）；创建比赛、报名组队、SDK 接入、官网上传四篇说明按 #278 的界面改：内外部、规划中开关、新建时定参赛形式、组队广场与领队招人、dev --api 本地对接（3d5a480c）
- 结果：commit d2cc40ff、cfe39854、3177ecf9、3d5a480c；说明写法检查（不写站点域名）通过
- 下一步：补齐剩余截图

## 04:07:57 +08:00 · 提交 · #281 · 说明截图上 CDN 地址，member 样板补我的参赛

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：补拍控制台报名设置、积分、待确认贡献、定榜四个页签与门户我的参赛、组队广场（本地样板数据），在预发布 rc.21 上拍发新话题与回帖区；25 张截图转 webp（共约 1.26MB），按 static-cdn 的规则命名 <名字>.<sha256 base64url 前 8 位>.webp 放进 app/forum/content/guide-images/，说明里的 shot: 换成 CDN 地址；有一张哈希带 __ 会被不加粗检查误拦，换一档压缩质量重新生成，没有改检查；member 样板补两条报名和一张定榜结果，我的参赛截图从这份样板拍（0fca2826、11db5b80）
- 结果：commit 0fca2826、11db5b80；tests/server/forum.test.ts 与 tests/tooling/static-cdn.test.ts 156 项通过
- 下一步：补宏观对齐声明

## 04:07:57 +08:00 · 提交 · #281 · 补齐宏观对齐声明并重建目录

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：281.json 加 web 应用、forum.state、forum.topic_posts、competition.public.list 三个流程和相关业务域，每条覆盖写明对齐说明，依赖维度引用 Dockerfile 与 forum 源码；ownership.json 给两个论坛流程补 forum-content.ts 的源码证据；重建目录（fe7a0ca8）
- 结果：commit fe7a0ca8；check-architecture --base 7aa5e777 通过（89 个变更文件，7 个关联节点）；vitest 136 文件 2090 项全过；pnpm typecheck 与 runtime/site-config/environments/boundaries/docs/tuffex-docs/secrets/doc-sync/catalog 全过
- 下一步：推送并开 MR，作者自审

## 04:10:34 +08:00 · 提交 · #281 · 改正 281.json 的说明篇数

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：281.json 里写的 17 篇、t900–t916 是早期的数，改成 26 篇（含目录）、t900–t925
- 结果：commit e6067db5；check-architecture 仍通过
- 下一步：开 MR

## 04:10:34 +08:00 · PR · #281 · 开 MR !21 回 stage

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：推送 task/281/usage_guides 到 GitLab，开 MR !21 目标 stage；正文写目的（所有者 21:16、21:17、22:22 原话）、Closes #281、变更范围、宏观对齐、解决链路、数据、验证命令、截图、人工验收步骤、风险与回滚
- 结果：MR !21 https://git.yangtzeu.work/geek/admin/-/merge_requests/21
- 下一步：作者自审

## 04:10:34 +08:00 · 审查 · #281 · 作者自审 MR !21：通过

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：按 code-review 两条线在主会话核对 7aa5e777...e6067db5：文档同步、宏观对齐、没有放宽校验（哈希带 __ 的截图换压缩质量重生成）、写法检查、截图里没有真实姓名和邮箱；逐条对照所有者 21:16、21:17、22:22；核对播种只动官方账号的说明帖、编号段查重、CDN 只增不改
- 结果：通过；记一处规范偏差：25f0524c 用了词表外的 docs(architecture)，已推送不改写历史。未验证项（预发布显示、可见范围、CDN 图片）随 rc.22 补
- 下一步：贴审查评论并合并

## 04:11:34 +08:00 · 合并 · #281 · MR !21 合进 stage，手工关闭 #281

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：审查结论贴进 MR !21 后按 sha fbb4f0af 合并（merge commit，删源分支）；在 #281 留关闭记录后手工关闭
- 结果：stage 合并提交 130a58b8；#281 closed，关闭记录 note 1149
- 下一步：收尾 worktree；rc.22 核对说明帖显示

## 04:11:43 +08:00 · 收尾 · #281 · 删除 task-281 worktree 与本地分支

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：按 PID 停掉这个 worktree 起的两个 vite（75046、98524），git worktree remove 删 .claude/worktrees/task-281，git branch -D 删本地 task/281/usage_guides；远端分支已随合并删除
- 结果：git worktree list 不再有 task-281
- 下一步：无
