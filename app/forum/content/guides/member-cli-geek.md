---
id: t904
slug: member-cli-geek
title: 命令行 geek
audience: 成员
visibility: registered
order: 4
date: 2026-10-24
---

这篇给想在终端或者给 AI agent 里用极客班账号的人看。`geek` 是极客班自己的命令行工具，登录后能看论坛、报名比赛、查投递状态。

1. 安装（macOS、Linux）：

```
curl -fsSL <站点地址>/cli/install.sh | sh
```

把 `<站点地址>` 换成正在使用的那个环境的地址。预发布环境测试用的话再加一个环境变量，把地址指向预发布环境：`GEEK_ORIGIN=<预发布地址>`。macOS 下载下来的文件没有系统隔离标记，能直接运行。

2. 登录：

```
geek login
```

命令行会显示一个用户码，按提示打开浏览器确认；浏览器里显示的代码要和终端里的一致才能确认，别人发给你的代码不要确认。确认后终端会显示头像、昵称和部门。

3. 常用命令：

```
geek whoami --json     查看登录信息
geek status --json     本机登录状态，不要求已登录
geek forum list        看板块和话题摘要
geek comp list         看公开比赛列表
geek comp mine         看自己报名的比赛
geek apply status      按登录邮箱查自己的投递状态
geek logout            撤销令牌，清掉本机凭据
```

4. 发帖、回复、报名这些写操作要对应的权限节点才能用，权限不够会提示被拒绝，不会报错程序坏了；账号还没绑邮箱或者没填姓名年级时，命令行也会提示去哪个页面补。
5. 命令行在任何情况下都拿不到任何账号的真实姓名，哪怕是本人用自己的令牌查也一样。
6. 想在 Claude Code、Codex 或 omp 里直接用极客班的接口，装一份内置的技能说明：

```
geek skill install --target claude
```

把 `claude` 换成 `codex` 或 `omp`，或者用 `all` 三个一起装。
