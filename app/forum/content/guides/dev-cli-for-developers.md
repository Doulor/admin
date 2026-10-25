---
id: t925
slug: dev-cli-for-developers
title: 命令行 geek：开发者与 agent 视角
audience: 开发与运维
visibility: member
order: 25
date: 2026-10-24
---

这篇给要在脚本、CI 或者 AI agent 环境里调用极客班接口的人看；日常在自己终端里用，看《命令行 geek》（./t904）就够。

1. 交互式登录用设备码：

```
geek login
```

浏览器确认后令牌存进系统钥匙串；没有图形界面或者钥匙串不可用的环境（CI、容器）加环境变量 `GEEK_NO_KEYRING=1`，令牌会落在 `~/.config/geek/credentials`（权限 0600）。

2. 已经有令牌时直接用 `GEEK_TOKEN` 环境变量，不必登录也不落盘：

```
GEEK_TOKEN=<令牌> geek whoami --json
```

3. 脚本里解析输出统一加 `--json`，格式固定是 `{ ok, data }` 或者 `{ ok:false, error:{code,message,retry_after?} }`，不要解析人读的文字输出。
4. 退出码固定含义：0 成功，2 用法错误，3 未登录，4 被拒绝（权限不够、scope 不够、账号没绑邮箱或者没填资料），5 限流，6 网络错误，1 其它；脚本按退出码判断，不用猜输出内容。
5. 登录时申请的 scope 只决定能访问哪一类接口（论坛、投递、比赛、代码仓库），具体某个操作还要对应的权限节点放行，有 scope 不代表有权限；命令行在任何情况下都拿不到任何账号的真实姓名，哪怕是本人用自己的令牌查也一样。
6. 给 Claude Code、Codex 或者 omp 装一份内置的极客班技能说明，agent 调接口时能照着技能文档来，不用现查接口：

```
geek skill install --target claude
```

把 `claude` 换成 `codex` 或 `omp`，或者用 `all` 一次装三个。
7. 常用的只读命令（都支持 `--json`，不需要登录）：`geek status`、`geek forum list`、`geek comp list`、`geek repo list`；需要登录身份的用 `geek whoami`、`geek comp mine`、`geek apply status`。
8. 用完记得撤销令牌，撤销后同一个令牌调任何接口都会被拒绝：

```
geek logout
```
