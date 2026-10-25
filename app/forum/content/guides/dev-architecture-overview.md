---
id: t917
slug: dev-architecture-overview
title: 系统架构总览
audience: 开发与运维
visibility: member
order: 17
date: 2026-10-24
---

这篇给要改代码、维护服务器，或者只是想搞懂极客班系统怎么拼起来的人看，不涉及怎么操作某个具体功能。

1. 代码在一个仓库里，按用途拆成几个独立的源码目录：
   - `app/server`：核心后端，一个 Fastify 进程。官网、控制台、论坛的接口都在这里，还有登录认证、对外授权（OIDC）、比赛官网反代、GitLab 账号同步。
   - `app/web`：官网 portal，React + Vite；`shared/` 是给站点复用的适配层，不是独立产品。
   - `app/console`：极客班控制台，Vue 3 + Tuffex，管理用的界面；它的构建产物随 web 镜像一起发，不单独起服务。
   - `app/forum`：论坛前端，直接采用上游 Nuxt/TuffEx 项目；帖子、回复、用户资料实际存在核心后端的数据库里，论坛容器本身不保存业务数据。
   - `app/cli`：`geek` 命令行，Rust 写的，产物随 web 镜像的 `/cli/` 路径发布。
2. 部署出来只有三个跑起来的容器：web、server、forum（控制台不单独跑，产物在 web 容器里）。请求链路是：浏览器 → 宿主 nginx（只做 TLS 终止和安全头） → web 容器的 nginx（按路径转发） → server 或 forum。`/api/*`、`/auth`、`/auth/*`、`/healthz`、`/oidc/*`、`/c/*`（比赛官网）都转给 server；`/forum/*` 转给 forum；`/admin`、`/console`、`/signin` 等路径进控制台产物；其余都是官网。
3. 每个环境只有一个域名，官网、管理端、论坛全部同域，靠路径区分，不是子域名。
4. 数据只有一份：server 容器的 `/data/data.db`（SQLite）。论坛的帖子、回复、用户资料也存在这一个库里 `forum_` 开头的表，不是论坛自己另起一个数据库；比赛官网上传的站点包解开后放在同一个数据目录下的 `sites/<比赛>/<版本>/`。forum 容器本身不挂数据卷。
5. 论坛的分类、标签和这篇说明本身来自仓库里的 `app/forum/content/`（`curation.json`、`guides/*.md`、`published/topics.json`），server 启动时读一次写进数据库，不是运行时去论坛容器要。
6. 每个环境（正式、预发布）各是一套完全独立的 Docker 栈：各自的 compose 项目、网络、数据卷，互不共享数据，细节见《发布与部署》（./t920）。
7. 想知道某个接口、某张表或者某个权限节点具体怎么实现，查项目目录（`docs/architecture/catalog/README.md`），它是从真实代码和内存数据库生成的，不是手写的说明，比这篇文档更细。
