# CLI 服务合同（`app/cli`）

> 极客班命令行 `geek`（Rust）：设备码登录、论坛/比赛/代码仓库只读与写操作、给 Claude Code/Codex/omp 装一份极客班技能（#277）。独立工具链，不进 Node 工作区；产物不单独成镜像，随 `app/web` 镜像的 `/cli/` 路径分发。

状态：`current` · 更新：2026-10-25 · 源码：`app/cli/` · 产物：`dist/cli/`（随 `yzgc/web` 镜像的 `/cli/` 路径分发）

## 源码地图

| 路径 | 职责 |
|---|---|
| `app/cli/Cargo.toml` | 依赖与 5 个发布目标；`release` profile 用 `opt-level="z"`、`lto`、`strip`、`panic="abort"` 压体积 |
| `app/cli/build.rs` | 编译期把极客娘抠图（`app/web/sites/portal/assets/mascot/geek-girl.webp`，缺失时退到 `app/cli/assets/boot-mascot.webp`）转成盲文点阵常量，写进 `$OUT_DIR/mascot_braille.rs`；源图缺失或读不出时输出空数组，不让构建失败 |
| `app/cli/src/config.rs` | 源站解析：`--env production\|preview` 或 `GEEK_ORIGIN`，默认生产 `https://yangtzeu.work`，预发布 `https://prev.yangtzeu.work` |
| `app/cli/src/token_store.rs` | 令牌存取：系统钥匙串（`keyring` crate，macOS/Windows 原生，Linux 用内核 `linux-native`，不用要 D-Bus 的 `secret-service`，交叉编译到 musl 没有对应 sysroot）优先，没有就退到 `~/.config/geek/credentials`（0600）；`GEEK_TOKEN` 环境变量最优先，不落盘；`GEEK_NO_KEYRING=1` 强制只用文件（CI、容器、无图形会话） |
| `app/cli/src/api.rs` | HTTP 封装：状态码 → 退出码映射，`email_required`/`profile_required` 的提示语 |
| `app/cli/src/output.rs` | `--json` 与人读两种输出的统一出口（`{ ok, data }` / `{ ok:false, error:{code,message,retry_after?} }`） |
| `app/cli/src/commands/` | `login`（RFC 8628 设备码）、`logout`（调 `/auth/device/revoke`）、`whoami`、`status`（本机登录状态）、`forum`（list/show/post/reply）、`comp`（list/show/mine/signup/ladder/plaza；给人看的输出里状态换成中文，含 #278 的「规划中」，`--json` 仍是接口原值）、`team`（create/apply）、`repo`（list）、`apply`（status）、`skill`（install） |
| `app/cli/src/ui/login_anim.rs` | 登录动画（见下文「登录动画」），behind `LoginAnimation` trait；非 TTY/`NO_COLOR`/`--json` 时用 `NullAnimation`，什么都不画 |
| `app/cli/src/ui/braille.rs` | 运行时把头像转成盲文点阵（kitty/iTerm2 图像协议不可用时的退路） |
| `app/cli/skills/geek/SKILL.md` | 内嵌进二进制（`include_str!`）；`geek skill install` 写到 `~/.claude/skills/geek`、`~/.codex/skills/geek`、`~/.omp/skills/geek` |

模块与服务端的桥接在 `app/server`：`app/server/src/middleware/bearer-auth.ts`（见 [server 合同](../server/README.md)）。

## 契约：身份与权限

- **登录**：RFC 8628 设备码授权，`client_id=geek-cli`，`scope=openid profile forum apply competition repo`；复用服务端既有的 `/auth/device/code`、`/auth/device/token`、`/auth/device/userinfo` 三个端点（见 [API](../../architecture/API.md)「geek 命令行令牌」）。
- **令牌 = 会话**：服务端 `bearer-auth.ts` 把 `Authorization: Bearer <token>` 换成和 cookie 会话同形的 `req.session`，下游所有既有的权限中间件（`requireAuth`、`requirePermission`、`requireCompetitionAccess`、论坛的 `forumViewer`/`requireWriter`）不用改。一个请求同时带 cookie 和 Bearer 是 400 `mixed_credentials`。
- **三道独立的闸**：
  1. **scope**（粗粒度，按 URL 前缀）：`forum`→`/api/forum/*`，`apply`→`/api/teams/*`、`/api/me/applications`，`competition`→`/api/competitions/*`、`/api/me/competitions`，`repo`→`/api/public/gitlab/*`；没申请对应 scope 是 403 `insufficient_scope`。
  2. **默认拒绝**：令牌只认上面四类 scope 接口、`/auth/device/userinfo`、`/auth/device/revoke`、`/api/public/*` 的 GET/HEAD 和 `GET /api/console/me`；控制台、账号页、`/auth/me`、OIDC 这些带令牌一律 403 `cli_not_allowed`（退出码 4）——令牌放在终端和 agent 的环境变量里，泄露的面比浏览器会话大，不能拿它改账号或做管理操作。令牌挂出的会话 `created_at` 固定为 0，永远不算「刚登录过」，过不了任何 step-up（改密码、绑邮箱这类需要「刚登录过」的操作本来就不在上面的允许列表里，这是双重保险）。
  3. **权限节点**（细粒度，和网页一样）：有 scope 不代表有权限，比如注册用户有 `forum` scope 也能发 `POST /api/forum/topics`，但权限节点 `forum.topic.create` 不够照样被 `requireWriter` 拒绝（403 `forbidden`，`activity_events` 记一条 `http.forbidden`，CLI 侧退出码 4）——这是 acceptance #3「注册用户发帖被权限拒绝、错误可读」的来源。
- **邮箱闸与资料闸**：业务接口统一经 `cliGate()`（`bearer-auth.ts` 一处调用 `lib/email-gate.ts` 的 `gateRefusal()`），先判没绑邮箱（403 `email_required`），再判缺姓名或年级（403 `profile_required`，#280）；`GET /auth/device/userinfo` 与 `POST /auth/device/revoke` 不算业务接口，不受这道闸限制（否则办不完这两项的账号退不出登录）。`/auth/device/userinfo` 额外带 `grade`/`grade_label`（年级展示用）——但不带 `real_name`，**命令行在任何接口下都拿不到任何账号的真实姓名，哪怕是本人**（硬约束）。CLI 侧见到 `email_required`/`profile_required` 退出码 4，`geek login`、`geek whoami`、`geek status` 会打印去哪个页面补的提示，不读取或打印姓名等个人信息之外的任何字段。
- **限额与操作记录**：命令行调用计入既有的按账号每日限额（`lib/limits.ts` 的 `cli.*` 桶）；成功的业务请求记一条 `surface:'cli'` 的 `activity_events`（动作名 `cli.<method>`，如 `cli.get`/`cli.post`），控制台「操作记录」能看到 CLI 的登录与接口调用（acceptance #6）。
- **撤销**：`geek logout` 调 `POST /auth/device/revoke`（30 次/分钟），只改 `token_expires_at`，RFC 7009 式幂等——令牌缺失、不存在、已撤销、已过期都回 200 `{ok:true}`，不回答「这个令牌是否存在过」；撤销后同一个令牌调任何接口都是 401（acceptance #6）。
- **退出码**：0 成功，2 用法错误，3 未登录，4 被拒绝（权限/scope/邮箱闸），5 限流，6 网络错误，1 其它。

## 契约：命令范围

论坛、比赛、代码仓库、投递四类只接入**既有**端点；`GET /api/me/applications`（给 `geek apply status`）是这次唯一新开的接口，加在 `app/server/src/routes/portal/my-applications.ts`，不动既有业务规则：

| 命令 | 端点 | 说明 |
|---|---|---|
| `geek whoami` | `GET /auth/device/userinfo` + `GET /api/console/me` | 账号、昵称、部门、年级；邮箱或资料没补齐时跳过第二个请求，打印提示 |
| `geek status` | `GET /healthz` + `GET /auth/device/userinfo` | 不要求已登录；本机令牌来源、源站、服务端连通性、令牌是否有效 |
| `geek forum list` | `GET /api/forum/state` | 板块与话题摘要 |
| `geek forum show <topic_id>` | `GET /api/forum/topics/:topic_id/posts` | 一个话题的全部帖子（含正文），不需要登录 |
| `geek forum post` | `POST /api/forum/topics` | 受权限节点 `forum.topic.create` 约束 |
| `geek forum reply <topic_id> --content <...>` | `POST /api/forum/posts` | 受权限节点 `forum.reply.create` 约束 |
| `geek comp list` | `GET /api/public/competitions` | 公开比赛列表，不需要登录 |
| `geek comp show <id>` | `GET /api/public/competitions/:id` | 单场比赛，不需要登录 |
| `geek comp mine` | `GET /api/me/competitions` | 当前账号报名的比赛 |
| `geek comp signup <id>` | `POST /api/competitions/:id/signup` | 受权限节点 `competition.signup` 约束 |
| `geek comp ladder <id>` | `GET /api/competitions/:id/leaderboard` | 需要登录，且持有报名或组队任一权限 |
| `geek comp plaza [--competition <id>] [--kind recruiting\|seeking] [--keyword <词>]` | `GET /api/team-plaza`（#278） | 需要登录，且持有报名或组队任一权限；令牌按 `competition` scope 放行（`bearer-auth.ts` 的前缀表） |
| `geek team create <competition_id> --name <...>` | `POST /api/competitions/:id/teams` | 受权限节点 `competition.team` 约束 |
| `geek team apply` | `POST /api/teams/{id}/apply` | 报名 |
| `geek repo list` | `GET /api/public/gitlab/projects` | 公开代码仓库列表 |
| `geek apply status` | `GET /api/me/applications`（新） | 按登录邮箱匹配招新投递；没绑邮箱是空列表，只回 id/status/created_at |

## 登录动画（SPEC §6）

`show_letters`（truecolor 渐变画 YUGC 四个字母）→ `show_mascot`（极客娘盲文点阵，`build.rs` 编译期生成）→ `begin_waiting`/`spin`（用户码的框 + spinner，轮询期间每 120ms 推进一帧）→ `show_welcome`（确认后头像，kitty/iTerm2 内联图像协议优先，不支持就落到运行时盲文头像，加「欢迎回来，&lt;昵称&gt;」）。非 TTY、`NO_COLOR`、`--json` 下一律不画（acceptance #4：`geek login | cat` 没有动画也没有控制字符）。

## 分发

- **交叉编译在宿主机做**：`node scripts/cli-dist.mjs` 用 `cargo zigbuild`（zig 当交叉链接器）把 5 个目标（`aarch64-apple-darwin`、`x86_64-apple-darwin`、`x86_64-unknown-linux-musl`、`aarch64-unknown-linux-musl`、`x86_64-pc-windows-gnu`）编译、算 sha256，产出 `dist/cli/<version>/geek-<target>[.exe]`、`dist/cli/{install.sh,install.ps1,latest.json}`。`dist/` 已被 `.gitignore` 覆盖，产物不进仓库。
- **zig 与 cargo-zigbuild 是开发机工具，不是生产依赖**：按约定路径 `.tools/zig/zig-macos-aarch64-0.13.0/zig`、`.tools/cargo/bin/cargo-zigbuild`（装法：下载 zig 0.13.0 macOS aarch64 解到前者；`CARGO_INSTALL_ROOT=$(pwd)/.tools/cargo cargo install cargo-zigbuild --locked`），两者都在 `.gitignore` 的 `.tools/` 里，不进仓库也不进镜像。
- 进镜像：`app/web/Dockerfile` 有一个空的 `cli` 阶段（`FROM scratch AS cli`），运行阶段 `COPY --from=cli / /usr/share/nginx/html/cli/`。发版构建先跑 `node scripts/cli-dist.mjs`，再用 `docker build --build-context cli=dist/cli …` 把产物换进这个阶段；不传时（CI 的镜像构建验证）镜像照样能建，`/cli/` 下没有文件，访问是 404。仓库根的 `.dockerignore` 排除 `**/dist`，所以不从普通构建上下文复制。GitHub 的两条部署工作流还没有产出 `dist/cli/` 的步骤（Linux runner 交叉编译 macOS 目标缺 SDK），用它们发版时 `/cli/` 是空的。镜像内 nginx 的 `/cli/` 路径与缓存策略见 [web 合同](../web/README.md)。
- **安装脚本**：`dist/cli/install.sh`、`install.ps1` 默认源站生产 `https://yangtzeu.work`，`GEEK_ORIGIN` 环境变量覆盖（和 `geek` 自己的源站解析一致），预发布装机：`curl -fsSL https://prev.yangtzeu.work/cli/install.sh | GEEK_ORIGIN=https://prev.yangtzeu.work sh`。生产安装命令（acceptance #1）：`curl -fsSL https://yangtzeu.work/cli/install.sh | sh`。两个脚本都先下 `.sha256` 校验、不匹配就失败，不执行除了这个仓库自己产出的任何远端内容。
- **macOS 二进制未签名**：curl 下载的文件没有 Gatekeeper 的隔离属性（quarantine，只有浏览器直接下载才会打），可以直接执行，不会跳 Gatekeeper 的「打不开」提示。

## CI 与本机检查

- `pnpm check:cli`（`scripts/check-cli.mjs`，已经在 `pnpm check` 链里）：只在这个 task 相对 base 真的改了 `app/cli` 时才跑 `cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`；没改动直接跳过，没装 cargo 的人跑一次 `pnpm check` 不会因为 Rust 工具链报错。task 分支按 `origin/stage` 判断改没改，判断不出 base（不是 task 分支、本机没有 `stage`）时保守地当作「改了」。
- GitHub Actions 的 `ci.yml` 不另开一个 job：`core` job 本来就跑 `pnpm check`，ubuntu-latest 自带 Rust 工具链，`check:cli` 顺带被执行（见 [CICD](../../ops/CICD.md)）。

## 运行

```bash
cd app/cli
cargo build                      # 本机目标，调试用
cargo test                       # 单元测试
cargo fmt --check && cargo clippy --all-targets -- -D warnings
node ../../scripts/cli-dist.mjs  # 全量交叉编译 + 产出 dist/cli/（先装好 zig / cargo-zigbuild，见上文「分发」）
```

## 验证命令

```bash
pnpm check:cli                   # 按改动路径决定要不要跑 cargo 检查
cd app/cli && cargo test
```

真机登录验收：`geek login --env preview`，浏览器确认后终端显示头像、昵称、部门；`geek whoami --json`/`geek comp list --json`/`geek forum list --json` 核对结构化输出；`geek logout` 后同一个令牌调 `GET /auth/device/userinfo` 应为 401，控制台「操作记录」能看到这次登录与调用。

## 已知限制

- 没有 `geek self update`：这是旧仓库（`~/work_file/geek_cli`）设计过但本次没有实现的功能，不依赖 GitHub Releases；升级就是重新跑一次安装脚本。
- Linux 的 `aarch64`/`x86_64` 都发 musl 静态二进制，没有单独的 glibc 构建；多数发行版能直接跑 musl 二进制，个别极旧的发行版未测试。
- `install.ps1` 只在本次开发中做了语法审阅，没有真实 Windows/PowerShell 环境跑过，标记未验证。
- 比赛、论坛、投递相关命令只接入现状端点（`GET /api/me/applications` 除外，是这次新开的）；以后这些业务扩展了新的接口，CLI 对应的子命令需要跟着扩展，不在这次范围内。
- `geek status` 的 `server_reachable`/`token_valid` 各自独立发一次 `GET /healthz`/`GET /auth/device/userinfo`，不共用缓存；高频轮询（例如 CI 里每次调用前都先跑一次 `geek status`）会在这两个接口上多打一次请求，目前没有限流以外的额外保护。
