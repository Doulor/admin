---
name: geek
description: 极客班命令行（geek）：用设备码登录极客班账号后，读写论坛、比赛、队伍与公开代码仓库。Agent 要代表极客班账号做这些事时用它，不要直接拼 curl 调内部接口。
---

# geek 命令行

`geek` 是极客班（Yangtze University Geek Class）官网/论坛/比赛系统的命令行客户端。它用 RFC 8628
设备码登录拿到一个 Bearer 令牌，之后每个子命令都带着这个令牌调用服务端的 HTTP 接口；不碰 cookie，
不需要浏览器会话。

## 什么时候用

- 需要以极客班账号的身份读/写论坛、比赛报名、队伍、公开代码仓库时。
- 需要在没有浏览器的环境（CI、agent 沙箱）里用一个已经登录过的账号调用这些接口时——设 `GEEK_TOKEN`
  环境变量，不用再跑一遍 `geek login`。
- 不要用它绕过权限：命令失败时服务端的错误码就是真实权限结果，不要重试更换接口去绕过。

## 先登录

```bash
geek login --env preview        # 交互式：打印用户码，在浏览器确认
geek login --env preview --json # 非交互：没有动画，打印 JSON，仍然要在浏览器确认一次
echo $GEEK_TOKEN                # agent 场景：直接设环境变量，跳过 login
```

`--env` 只能是 `production`（默认，`https://yangtzeu.work`）或 `preview`
（`https://prev.yangtzeu.work`）；也可以设 `GEEK_ORIGIN` 指到自己起的测试服务器（只认
`https://` 或本机回环的 `http://`）。

## 命令表

| 命令 | 作用 | 需要登录 | 需要的权限/scope |
|---|---|---|---|
| `geek whoami` | 查看当前登录的账号、昵称、部门 | 是 | — |
| `geek logout` | 撤销本机令牌，服务端立刻失效 | 是（没登录也能跑，是空操作） | — |
| `geek forum list` | 列出最近话题 | 否 | `forum` |
| `geek forum post --title T --category C --content X` | 发一个新话题 | 是 | `forum`，且账号要有 `forum.topic.create` 权限节点（注册用户默认没有，只有极客班成员才有） |
| `geek comp list` | 列出公开比赛 | 否 | `competition` |
| `geek comp mine` | 我参加的比赛 | 是 | `competition`，且要持有报名或组队权限 |
| `geek team apply <team_id> --message M` | 申请加入一支队伍 | 是 | `apply`，且账号要有 `competition.team` 权限节点 |
| `geek repo list` | 列出公开代码仓库 | 否 | `repo` |
| `geek skill install [--target claude\|codex\|omp\|all]` | 把这份 SKILL.md 写到 Agent 的技能目录 | 否 | — |

每个命令都接受 `--json`，输出 `{ ok: true, data }` 或 `{ ok: false, error: { code, message, retry_after? } }`，
一行一个 JSON，没有控制字符，脚本可以直接解析。

## JSON 示例

```bash
$ geek whoami --json
{"ok":true,"data":{"account_id":"u_123","login":"yz_abc123","nickname":"路人","avatar_url":null,"department":"算法部门","scope":"openid profile forum apply competition repo"}}

$ geek forum post --title t --category general --content c --json
{"ok":false,"error":{"code":"forbidden","message":"需要「forum.topic.create」权限"}}
```

## 退出码

| 退出码 | 含义 |
|---|---|
| 0 | 成功 |
| 2 | 用法错误（参数不对） |
| 3 | 没有登录，或令牌已失效/被撤销——重新 `geek login` |
| 4 | 权限不够，或令牌缺少对应 scope，或账号还没绑邮箱（`email_required`/`profile_required`，去浏览器处理） |
| 5 | 被限流，`retry_after` 给了多少秒后再试 |
| 6 | 网络错误，连不上服务 |
| 1 | 其它错误 |

常见错误码：`not_signed_in`（没有令牌）、`insufficient_scope`（令牌没有这个命令要求的 scope，重新
`geek login` 申请）、`cli_not_allowed`（这个接口只能在网页上用，比如改密码、控制台管理）、`forbidden`（权限节点不够，message 里带节点名）、`email_required` /
`profile_required`（账号资料没填完，提示里会给要打开的页面地址）、`rate_limited`（太频繁）。

## 不要做的事

- 不要把 `GEEK_TOKEN` 打进日志、提交记录或任何会被别人看到的地方——它等同于这个账号的密码。
- 看到 `forbidden`/`insufficient_scope` 不要换着接口试探绕过；这是账号真实的权限边界。
- `geek forum post` 失败不代表命令行本身坏了，大多数时候是账号级别不够（注册用户默认不能发帖）。
