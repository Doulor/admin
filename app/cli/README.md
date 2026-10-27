# geek

极客班命令行，面向人和 AI agent：设备码登录极客班账号、看论坛/比赛/代码仓库、给 Claude Code/Codex/omp 装一份极客班技能。详细契约见 [docs/services/cli/README.md](../../docs/services/cli/README.md)。

## 安装

唯一现行源码与分发入口是本 monorepo 的 `app/cli/` 与 `scripts/cli-dist.mjs`；
安装不依赖另外检出独立 CLI 仓库，也不依赖本机源码目录。

```bash
# macOS / Linux
curl -fsSL https://yangtzeu.work/cli/install.sh | sh

# 预发布（测试用）
curl -fsSL https://prev.yangtzeu.work/cli/install.sh | GEEK_ORIGIN=https://prev.yangtzeu.work sh

# Windows PowerShell
irm https://yangtzeu.work/cli/install.ps1 | iex
```

脚本自动识别平台（macOS/Linux × aarch64/x86_64，Windows 走 x86_64），下载二进制到 `~/.local/bin/geek`（Windows: `%USERPROFILE%\.local\bin\geek.exe`），校验 sha256 后再安装。`GEEK_INSTALL_DIR` 改安装目录，`GEEK_ORIGIN` 改源站（默认生产）。

macOS 二进制未签名：curl 下载的文件没有 Gatekeeper 隔离属性，能直接执行。

## 上手

```bash
geek login --env preview   # 设备码登录（动画 + 用户码），浏览器确认后显示头像、昵称、部门
geek status --json         # 本机登录状态：令牌来自哪一层、服务端连不连得上、令牌是否有效（不要求已登录）
geek whoami --json         # 看登录信息
geek forum list --json     # 板块与话题摘要
geek comp list --json      # 公开比赛列表
geek logout                # 撤销令牌、清掉本机凭据
```

默认源站生产 `https://yangtzeu.work`；`--env preview` 或 `GEEK_ORIGIN=https://prev.yangtzeu.work` 切到预发布。令牌存进系统钥匙串，没有钥匙串时退到 `~/.config/geek/credentials`（0600）。

## 命令一览

```
geek login [--env production|preview] [--no-browser]   设备码登录
geek logout                                             撤销令牌、清本机凭据
geek whoami [--json]                                    看登录信息
geek status [--json]                                    本机登录状态（不要求已登录）

geek forum list [--json]                                板块与话题摘要
geek forum show <话题 id> [--json]                       一个话题的全部帖子（不需要登录）
geek forum post --title <标题> --category <分类 id> --content <正文> [--json]
                                                         发帖（受权限节点限制，分类 id 取自 forum list 的 state.categories）
geek forum reply <话题 id> --content <正文> [--json]      回复（受权限节点限制）

geek comp list [--json]                                 公开比赛列表
geek comp show <比赛 id> [--json]                        看一场比赛（公开，不需要登录）
geek comp mine [--json]                                 我报名的比赛
geek comp signup <比赛 id> [--note <备注>] [--looking-for-team] [--json]
                                                         报名（受权限节点限制）
geek comp ladder <比赛 id> [--json]                      看一场比赛的榜

geek team create <比赛 id> --name <队名> [--slogan <口号>] [--json]
                                                         建一支新队伍（受权限节点限制）
geek team apply <团队 id> [--json]                       报名

geek repo list [--json]                                 公开代码仓库列表

geek apply status [--json]                              我的投递状态（按登录邮箱匹配）

geek skill install [--target claude|codex|omp|all]      给 agent 装极客班技能
```

## 输出格式

默认人读格式；`--json` 输出 `{ "ok": true, "data": ... }` 或 `{ "ok": false, "error": { "code", "message", "retry_after"? } }`。agent 用 `--json`。

退出码：`0` 成功、`2` 用法错误、`3` 未登录、`4` 被拒绝（权限/scope/邮箱或资料未补/接口不在命令行允许范围）、`5` 限流、`6` 网络错误、`1` 其它。

## 给 AI agent 使用

内嵌 `skills/geek/SKILL.md`：

```bash
geek skill install --target claude   # 写到 ~/.claude/skills/geek
geek skill install --target codex    # 写到 ~/.codex/skills/geek
geek skill install --target omp      # 写到 ~/.omp/agent/skills/geek
geek skill install --target all      # 三个都装
```

安装时沿用各 harness 的目录覆盖：`CLAUDE_CONFIG_DIR`、`CODEX_HOME`、
`PI_CODING_AGENT_DIR` 分别替代对应的配置根目录，技能放在该目录的
`skills/geek/SKILL.md`。空值使用默认目录，`CLAUDE_CONFIG_DIR` 先去除首尾空白。

OMP 的命名 profile（`OMP_PROFILE`，未设置时兼容 `PI_PROFILE`）优先于
`PI_CODING_AGENT_DIR`，写入 `~/.omp/profiles/<profile>/agent/skills/geek`；
`default` profile 仍使用默认 agent 目录或显式 `PI_CODING_AGENT_DIR`。
`PI_CONFIG_DIR` 可替换 HOME 下的 `.omp` 配置目录名。相对目录相对于运行命令的目录，
OMP 的目录覆盖不展开字面量 `~`。这些设置只影响这次安装，不修改用户的全局 profile 或配置。

已有 `SKILL.md`、文件符号链接及 `geek` 目录符号链接一律保留，不覆盖自定义技能，
也不迁移或删除旧的 `~/.omp/skills/geek`。重复安装不会重写文件。
`--json` 返回 `{ "ok": true, "data": { "installed": [...], "skipped": [...] } }`：
`installed` 仅列出本次新建的文件，`skipped` 列出保留的已有目标；文件系统错误仍非零退出。

## 鉴权与权限

- 登录用 RFC 8628 设备码授权，`scope: openid profile forum apply competition repo`。
- 令牌等价于浏览器会话：服务端按同一套权限节点判断能不能写（比如发帖要 `forum.topic.create`），scope 只是粗粒度的接口分类闸，两者都要过。
- 令牌默认什么都不能用，只认登录、论坛、报名、比赛、仓库这几类接口和 `geek whoami`/`geek status` 用到的只读接口；其余接口（改密码、绑邮箱、控制台管理操作）带令牌一律拒绝（`cli_not_allowed`，退出码 4）。
- 账号没在浏览器绑定邮箱，或者没填真实姓名和年级时，业务接口会被拒（分别是 `email_required`/`profile_required`，退出码 4），`geek login`/`geek whoami`/`geek status` 会提示打开 `<源站>/bind-email` 或 `<源站>/complete-profile`。命令行在任何接口下都拿不到任何账号的真实姓名，哪怕是本人。
- `geek logout` 撤销令牌后，这个令牌调任何接口都是 401；控制台「操作记录」能看到 CLI 的登录与接口调用。

## 环境变量

| 变量 | 作用 |
|---|---|
| `GEEK_ORIGIN` | 覆盖默认源站；显式 `--env` 优先 |
| `GEEK_TOKEN` | 跳过本地存储，临时用指定令牌（CI/agent 友好，不落盘） |
| `GEEK_NO_KEYRING` | 变量存在时跳过系统钥匙串，只用文件存储（无图形会话的环境） |
| `NO_COLOR` | 设置后登录动画不画，输出不带颜色 |

## 开发

```bash
pnpm cli:build                   # 仓库根目录；Cargo locked，jobs=2
pnpm cli:test                    # 串行测试，设备协议测试需要允许 loopback
CARGO_BUILD_JOBS=2 pnpm check:cli # 格式、Clippy、测试；不放宽 lint
pnpm cli:dist                    # 交叉编译全部发布目标，产出 dist/cli/
```

## 已知限制

见 [docs/services/cli/README.md](../../docs/services/cli/README.md)「已知限制」：没有 `geek self update`，Linux 只发 musl 静态二进制，`install.ps1` 未在真实 Windows 环境跑过。
