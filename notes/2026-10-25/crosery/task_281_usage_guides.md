# task/281/usage_guides · crosery · 2026-10-25

负责人：crosery

## 02:02:33 +08:00 · 提交 · #281 · 753cdbac、13bb9b2c、25f0524c、c6382b04：使用说明正文、合并 stage、补今天的功能

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：docs281 子 agent 写的 25 篇按身份的说明、播种成官方帖、截图上 CDN 的通路一起提交为 753cdbac；合并 GitLab stage d1f64ec5（13bb9b2c，只有 docs/services/server/README.md 一处冲突，取 stage 的版本再补回 forum-content 读使用说明这一句），项目目录单独重新生成（25f0524c）；按今天合进 stage 的 #276 表情包与回复框、#282 备份下载要刚登录过和整机搬家，改了三篇说明（c6382b04）
- 结果：tests/server/forum.test.ts 60/60 通过；tests/tooling/static-cdn.test.ts 里截图那条用例仍失败，因为 24 张截图还没拍，正文里还是 shot:名字 占位，按设计拦着不合并
- 下一步：等 #278 的界面做完再拍 24 张截图（控制台、桌面、论坛），放进 app/forum/content/guide-images/ 换成 CDN 地址，补比赛状态「规划中」的说明
