# geek

极客班命令行，面向人和 AI agent：设备码登录极客班账号、看论坛/比赛/代码仓库、给 Claude Code/Codex/omp 装一份极客班技能。详细契约见 [docs/services/cli/README.md](../../docs/services/cli/README.md)。

## 安装

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
geek --env preview login              # 设备码登录（动画 + 用户码），浏览器确认后显示头像、昵称、部门
geek --env preview status --json      # 本机登录状态：令牌来自哪一层、服务端连不连得上、令牌是否有效（不要求已登录）
geek --env preview whoami --json      # 看登录信息
geek --env preview forum list --json  # 板块与话题摘要
geek --env preview comp list --json   # 公开比赛列表
geek --env preview logout             # 撤销令牌、清掉本机凭据
```

源站优先级：`--env production|preview` > `GEEK_ORIGIN` > 默认生产 `https://yangtzeu.work`。每次调用独立选择环境，不会记住上一次 `login` 的选择；上述预发布命令每次都要带 `--env preview`。

令牌存进系统钥匙串，不可用时退到系统配置目录下的 `geek/credentials`（Unix 权限 0600）。macOS 为 `~/Library/Application Support/geek/credentials`；Linux 为 `$XDG_CONFIG_HOME/geek/credentials`（未设置时为 `~/.config/geek/credentials`）。

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
geek skill install --target omp      # 写到 ~/.omp/skills/geek
geek skill install --target all      # 三个都装
```

## 鉴权与权限

- 登录用 RFC 8628 设备码授权，`scope: openid profile forum apply competition repo`。
- 令牌等价于浏览器会话：服务端按同一套权限节点判断能不能写（比如发帖要 `forum.topic.create`），scope 只是粗粒度的接口分类闸，两者都要过。
- 令牌默认什么都不能用，只认登录、论坛、报名、比赛、仓库这几类接口和 `geek whoami`/`geek status` 用到的只读接口；其余接口（改密码、绑邮箱、控制台管理操作）带令牌一律拒绝（`cli_not_allowed`，退出码 4）。
- 账号没在浏览器绑定邮箱，或者没填真实姓名和年级时，业务接口会被拒（分别是 `email_required`/`profile_required`，退出码 4），`geek login`/`geek whoami`/`geek status` 会提示打开 `<源站>/bind-email` 或 `<源站>/complete-profile`。命令行在任何接口下都拿不到任何账号的真实姓名，哪怕是本人。
- `geek logout` 撤销令牌后，这个令牌调任何接口都是 401；控制台「操作记录」能看到 CLI 的登录与接口调用。

## 环境变量

| 变量 | 作用 |
|---|---|
| `GEEK_ORIGIN` | 未指定 `--env` 时覆盖默认源站，优先级低于 `--env` |
| `GEEK_TOKEN` | 跳过本地存储，临时用指定令牌（CI/agent 友好，不落盘） |
| `GEEK_NO_KEYRING` | 设为任意非空值时跳过系统钥匙串，只用文件存储（无图形会话的环境） |
| `NO_COLOR` | 设置后登录动画不画，输出不带颜色 |

## 开发

```bash
cargo build
cargo test
cargo fmt --check && cargo clippy --all-targets -- -D warnings
node ../../scripts/cli-dist.mjs   # 交叉编译全部发布目标，产出 ../../dist/cli/
```

## 已知限制

见 [docs/services/cli/README.md](../../docs/services/cli/README.md)「已知限制」：没有 `geek self update`，Linux 只发 musl 静态二进制，`install.ps1` 未在真实 Windows 环境跑过。
