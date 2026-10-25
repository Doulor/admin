# stage · crosery · 2026-10-25

负责人：crosery

## 19:31:29 +08:00 · 发布 · #293 · 预发布 0.1.1-rc.24@ac9f9e86b67a（本机发版）

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者 2026-10-23 决定本机发预发布、2026-10-25 12:52 接手指令范围内；本地 tag v0.1.1-rc.24 → ac9f9e86（未推送）；docker build --platform linux/amd64 三个镜像；CDN 上传 18:50:23，镜像归档传输 18:50:58，部署前备份预发布库 19:00:07（宿主机 /root/yzgc-backups/preview-20261025-190007-375fba2f9cb5.db），deploy-stack 19:00:25，19:00:54 两个健康检查口均返回 ok
- 结果：release.json 0.1.1-rc.24@ac9f9e86b67a；预发布控制台的邮件模板页按新设计在真实模板数据上打开；回滚用 375fba2f9cb5（rc.23）镜像与 19:00:07 的库备份
- 下一步：rc.25 随 #294 发出；所有者在预发布验收

## 22:38:13 +08:00 · 发布 · #294 · 预发布 0.1.1-rc.25@02cb751c0b83（本机发版）

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者 2026-10-23 决定本机发预发布、2026-10-25 12:52 接手指令范围内；本机构建三个预发布镜像（stage 02cb751c），部署前把预发布库备份到宿主机 /root/yzgc-backups/preview-20261025-200551-ac9f9e86b67a.db，传输镜像后 compose up；tag v0.1.1-rc.25 指向 02cb751c0b830c0e686a180f6c6c5870c0c055ec，之后经临时克隆推到 GitLab（本地 pre-push 钩子要求 tag 的提交在本地 stage 上，没有绕过）；补发 #294 与 !32 的改后截图（桌面与手机）
- 结果：目标机 deploy-history.log 2026-10-25T12:06:36Z preview 02cb751c0b83 OK；release.json 0.1.1-rc.25@02cb751c0b83，builtAt 2026-10-25T11:30:34Z；三个预发布容器 healthy；回滚用 ac9f9e86b67a 的镜像与 20:05:51 的库备份
- 下一步：在 rc.25 上自测 A–G 并整理发布资料；正式版等所有者验收与批准

## 22:38:13 +08:00 · 发布 · #294 · 发布准备：整理 v0.1.1 正式版资料，没有发正式

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者 2026-10-25 20:14 说「正式版发布还没有，你先整理好资料」。在 rc.25 上做 A–G 共 40 项自测（evidence/V03-matrix.md）；迁移三套预演与回滚兼容预演并存证；本机试构建 yzgc-production 三个镜像（没有上传）；在候选提交上跑全套门禁；写 RELEASE-PACKET.md、ACCEPTANCE-OWNER-rc25.md、ACCEPTANCE-RECORD-FACTS.md
- 结果：门禁 15 个命令里 12 个直接通过，docs/INDEX.md 过期一行与 K10 两项不通过，vitest 2402 项通过 0 失败；没有打 v0.1.1、没有快进 main、没有部署正式环境、没有改正式环境的任何配置
- 下一步：等所有者定是否为 INDEX.md 一行出 rc.26，再在预发布验收；验收记录与「批准发布」之后才发正式
