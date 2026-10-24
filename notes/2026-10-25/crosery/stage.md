# stage · crosery · 2026-10-25

负责人：crosery

## 00:04:12 +08:00 · 发布 · #276 · rc.20 发布记录移到 stage 链路（原 22:03:16 记在 #276 收尾之后）

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：2026-10-24 22:03:16 写的 rc.20 发布记录挂在了 task_276_forum_image_scan 链路的收尾之后，随 MR !16 进了 stage，note.mjs check 报「链路已经收尾，后面不能再记」。按 NOTES.md「不属于任何 task 的操作（发布……）记在当时所在分支的链路里」，从那条链路拿掉，原文记在这里：按 GitLab stage 19c5db46（含 !11 #277、!12 #278、!13 #276、!14 #276 修复）本机构建三个镜像，CDN 开关打开；static-cdn upload --owner-env-file 上传并核对 390 个文件（11.93 MiB）；rsync 增量传归档（新数据 172MB）并 sha256 核对；sqlite3 .backup 备份预发布库到 /root/yzgc-backups/preview-20261024-220157-39ab81ab9203.db（integrity_check ok）；备份并替换目标机 compose（去掉 CONSOLE_ORG）；env 只换 IMAGE_TAG；deploy-stack 部署；本地轻量 tag v0.1.1-rc.20，当时没有推送（22:2x 和其余 rc tag 一起推到了 GitLab 与 GitHub）。
- 结果：原结果：release.json version 0.1.1-rc.20@19c5db4675d7；两个 healthz 返回 ok；公开快照接口 200。拿掉旧记录是改了已入库的一条记录，原因和原文都在这条里，MR 里同样写明。
- 下一步：按 ACCEPTANCE A–G 验收 rc.21
