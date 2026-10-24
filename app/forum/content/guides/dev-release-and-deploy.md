---
id: t920
slug: dev-release-and-deploy
title: 发布与部署
audience: 开发与运维
visibility: member
order: 20
date: 2026-10-24
---

这篇写发布预发布版和正式版的真实流程，普通开发不需要自己打 tag，了解流程是为了看懂部署记录和配合验收。

1. 两个环境各是一套完全独立的 Docker 栈：各自的 compose 文件、compose 项目名、网络和数据卷，不共享任何数据；宿主端口也分开，而且只绑在宿主的回环地址上，公网入口只有宿主 nginx。
2. 环境变量只经两份入库文件：`deploy/env/.env.production`、`deploy/env/.env.preview`。地址、端口、域名这些非密值直接写在仓库里；密钥字段留空，真实值只在目标机的 `.env.<环境>` 里，由 CI/CD 用环境级密钥渲染进去，仓库里永远看不到真值。
3. 发版只靠打 tag，推分支不会触发任何部署：
   - 在 `stage` 的提交上打 `vX.Y.Z-rc.N`（N 从 1 开始）发到预发布环境；
   - 在预发布实际点过一遍、负责人明确批准之后，把 `main` 快进到被验收的那个提交，在同一个提交上打 `vX.Y.Z` 发到正式环境。

```
git tag -a v0.2.0-rc.1 -m "v0.2.0-rc.1" <stage上的提交SHA>
git push origin v0.2.0-rc.1
# 预发布验收通过后：
git switch main && git merge --ff-only v0.2.0-rc.1 && git push origin main
git tag -a v0.2.0 -m "v0.2.0" "v0.2.0-rc.1^{commit}"
git push origin v0.2.0
```

4. 打 tag 本身需要对这个版本号的明确授权，CI 全绿、代码审查通过都不是授权，也不是人工验收；正式发布前必须有负责人在预发布环境对同一个提交的真实验收记录，缺一样就不能继续。
5. 发布 tag 一旦推送就不能移动、不能删除：打错了就打下一个 rc 或者升版本号，已经推出去的错误 tag 留着当记录，不要删掉重打。
6. 回滚是把某个环境切回更早发布过的镜像，不移动分支、不改 tag、不重置数据库：

```
rollback-stack.sh --environment production --to <sha12|previous>
```

数据库结构不兼容时停下来由人处理，不能用重置数据库代替回滚。
