# stage · crosery · 2026-10-25

负责人：crosery

## 00:04:12 +08:00 · 发布 · #276 · rc.20 发布记录移到 stage 链路（原 22:03:16 记在 #276 收尾之后）

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：2026-10-24 22:03:16 写的 rc.20 发布记录挂在了 task_276_forum_image_scan 链路的收尾之后，随 MR !16 进了 stage，note.mjs check 报「链路已经收尾，后面不能再记」。按 NOTES.md「不属于任何 task 的操作（发布……）记在当时所在分支的链路里」，从那条链路拿掉，原文记在这里：按 GitLab stage 19c5db46（含 !11 #277、!12 #278、!13 #276、!14 #276 修复）本机构建三个镜像，CDN 开关打开；static-cdn upload --owner-env-file 上传并核对 390 个文件（11.93 MiB）；rsync 增量传归档（新数据 172MB）并 sha256 核对；sqlite3 .backup 备份预发布库到 /root/yzgc-backups/preview-20261024-220157-39ab81ab9203.db（integrity_check ok）；备份并替换目标机 compose（去掉 CONSOLE_ORG）；env 只换 IMAGE_TAG；deploy-stack 部署；本地轻量 tag v0.1.1-rc.20，当时没有推送（22:2x 和其余 rc tag 一起推到了 GitLab 与 GitHub）。
- 结果：原结果：release.json version 0.1.1-rc.20@19c5db4675d7；两个 healthz 返回 ok；公开快照接口 200。拿掉旧记录是改了已入库的一条记录，原因和原文都在这条里，MR 里同样写明。
- 下一步：按 ACCEPTANCE A–G 验收 rc.21

## 00:11:49 +08:00 · 开发 · 无 issue · 宿主机 103.117.123.226 只留极客班栈，加磁盘/内存看护与每日备份

- 执行者：agent-claude-geek-main-2697b386（Claude Code，claude-sonnet-5-5）
- 做了什么：按所有者指令停用并禁用 kaiwu-keepalive 三个、claude-http-relay、yanling-api、mirror-hunt、mihomo，移除 nginx 里 game/mirror-hunt/openrouter/token 四个站点的软链；保留 yzgc-admin（极客班旧版，6M）。装 /usr/local/sbin/geek-host-guard 与两个 systemd 定时器、journald 上限、nginx OOM 分值，挂载闲置的 /dev/vdb1 到 /mnt/data 放备份
- 结果：停前后对比：yangtzeu.work 与 prev.yangtzeu.work 的 / /forum/ /release.json /auth/me 都是 200，六个容器 healthy；磁盘 27G(70%)→20G(50%)，可用内存 812M→1429M；备份 2 库完整性检查与恢复演练通过；certbot 对 yangtzeu.work、prev.yangtzeu.work 的续期演练通过；未做：异机备份、compose 层的内存限制；脚本在 .tools/host-guard（未入库）
- 下一步：等所有者决定是否配异机备份，以及是否另开 issue 把脚本和 compose 内存限制收进仓库

## 01:11:45 +08:00 · 返工 · #276 · 恢复 rc.20 发布记录的原位置，00:04:12 那条改成指向原记录

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：00:04:12 把 2026-10-24 22:03:16 的 rc.20 发布记录从 notes/2026-10-24/crosery/task_276_forum_image_scan.md 拿掉，note.mjs check --pr 报「发现删除或修改已有记录的行」：记录只能往末尾追加，已写的不改不删。改正：那个文件恢复成 stage（6b71db41）上的原样，原记录留在原处；00:04:12 那条里「从那条链路拿掉」不再成立，以这条为准，它只是把 rc.20 的发布记录在 stage 链路上再登记一次。原记录挂在收尾之后的问题是 !16 合并时带进 stage 的，留在原处，不再改动。
- 结果：notes/2026-10-24/crosery/task_276_forum_image_scan.md 与 6b71db41 没有差异。
- 下一步：重跑 note.mjs check --pr，合并 MR !17。
