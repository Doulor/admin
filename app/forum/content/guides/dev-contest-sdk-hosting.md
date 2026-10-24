---
id: t924
slug: dev-contest-sdk-hosting
title: 比赛官网 SDK 与托管
audience: 开发与运维
visibility: member
order: 24
date: 2026-10-24
---

这篇给开发者一个简要说明，具体接入方式和完整示例代码见《用 SDK 接入比赛官网》（./t910），这篇只补几点开发者会关心的细节。

1. SDK 源码在 `app/web/shared/competition-sdk/`，构建时单独打包成 `dist/sdk/competition/v1.js`，由 web 镜像在 `/sdk/competition/v1.js` 提供，带 5 分钟缓存和 `Access-Control-Allow-Origin: *`；站点包自己不用打包这份 SDK，直接按绝对路径引用即可。
2. 比赛官网只能访问 `/api/public/competitions/:id/*` 这些匿名公开接口，不带任何 cookie；报名、组队这些需要登录的操作，SDK 给出的链接会把访客带回主站桌面上的比赛窗口，不在站点包自己的页面里完成。
3. 本地整站开发用 `pnpm --filter @yzgc/web dev:contest`（5195 端口，`/api` 代理到本机 3000）；只想单独预览 SDK 带着示例数据的效果、不用起整个站点工程的本机命令目前还没有，这项正在开发中。
4. 站点包的打包规则（zip 不超过 20MB、不超过 500 个文件、必须有 `index.html` 和 `yzgc-site.json`、不能有符号链接或者以 `.` 开头的文件）和上传步骤见《比赛官网：上传站点包》（./t909）。
