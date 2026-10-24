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
