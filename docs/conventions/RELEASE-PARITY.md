# 预发布到正式的同构与无损迁移规范

> 预发布上做过的每一件事，正式都有对应动作；地址、端口、签发者只来自各环境自己的 env 文件；发版前同构清单清零，发版后烟测通过。

状态：`current` · 更新：2026-10-28 · 依据：所有者 2026-10-28 19:11 的指令（原话在 GitLab #309 正文的确认依据）。分支与发布流程见 [BRANCHING](BRANCHING.md)、[RELEASES](RELEASES.md)，环境变量契约见 [ENVIRONMENTS](../ops/ENVIRONMENTS.md)。

## 为什么要有这份规范

2026-10-28 的三类事故有同一个原因：事情在预发布做了，但不在提交里，也没有地方记账。

| 事故 | 在预发布做了什么 | 正式缺什么 |
|---|---|---|
| 正式的 GitLab 登录跳到预发布 | `deploy/gitlab/gitlab-oidc.rb` 写死预发布签发者 | 片段里的域名没人翻成正式，仓库和 CI 没有检查 |
| 内部赛事官网在正式 404 | 站点数据只在预发布的数据库和数据卷里 | 数据没有迁移动作，发正式时没人想到 |
| 新 CDN 在正式从不生效 | 预发布前置 Caddy 的 CSP 改过 | 正式的 CSP 在宿主上，不在仓库里 |

预发布是 `stage`，建立在 `main` 基线之上；预发布验证通过的路径，正式要原样再走一遍。要做到这一点，需要三样东西：环境之间的值严格隔离、预发布做过的事有账、发版前后有核对。

## 一、三份 env：正式、预发布、本机

| 文件 | 用途 | 值 |
|---|---|---|
| `deploy/env/.env.production` | 正式栈 | 正式的域名、端口、栈目录、镜像仓库 |
| `deploy/env/.env.preview` | 预发布栈 | 预发布的域名、端口、栈目录、镜像仓库 |
| `deploy/env/.env.dev` | 本机调试 | 回环地址、`.tools/local-preview` 下的数据；`GITLAB_SYNC=off`、`MAIL_RECIPIENTS=allowlist` |

三份文件都入库，键集完全一致，密钥一律留空（正式与预发布由 CI/CD 从各自的 GitHub 环境 secrets 渲染，本机由操作者在 shell 或仓库根 `.env` 里补，不写进文件）。`.env.dev` 入库前要脱敏：只能是回环地址、公开的发件地址和已经在另外两份里公开的共用服务地址（CDN、GitLab），不放任何真实密钥、账号、个人信息。本机调试以本地为主：`pnpm dev:web`、`pnpm preview:local` 不需要连任何远端。

正式与预发布除下列差异键以外，值必须相同：`GEEK_DEPLOYMENT_ENVIRONMENT`、`GEEK_ENVIRONMENT_ORIGIN`、`COMPOSE_PROJECT_NAME`、`STACK_ROOT`、`WEB_BIND`、`SERVER_BIND`、`PUBLIC_ORIGIN`、`GITLAB_SYNC`（GitLab 同步只允许一个环境写，两边同时开会反复封禁解封同一批人）。要新增差异键，先在 `scripts/check-env-isolation.mjs` 的 `PER_ENVIRONMENT_KEYS` 登记，并在 [ENVIRONMENTS](../ops/ENVIRONMENTS.md) 字段表里说明为什么必须不同。

每份文件里不得出现另外两个环境才有的值：正式文件没有预发布域名、预发布端口 18200/18201、`yzgc-preview`；预发布文件没有正式域名、端口 18100/18101、`yzgc-production`；本机文件没有任何部署栈的域名、端口和目录。

## 二、不在代码里写另一个环境的地址

地址、端口、签发者、镜像仓库这类值只有两个来源：该环境自己的 env 文件，或者 `deploy/environments.json`。代码、工作流、部署脚本需要它们时去读，不抄一份。宿主上的配置片段（例如 `deploy/gitlab/gitlab-oidc.rb`）不写域名，读宿主上的文件：GitLab 信任哪个环境，由 `/etc/gitlab/yzgc-oidc-issuer` 的内容决定，仓库里的片段对两个环境是同一份。

确需写死的位置（命令行的编译期默认源站、邮件链接白名单、各环境自己的 nginx 模板、说明性注释）登记在 `deploy/env/origin-exceptions.json`：写文件、次数上限和理由，限定单一环境的文件加 `only`。检查对没有登记的文件、超过上限的文件、登记了却已没有域名的文件都失败。新增写死位置要在同一个 PR 里登记，审查人看理由。

两项检查合在 `pnpm check:env-isolation`（`pnpm check` 包含它，CI 的 `core` 与 `branch-guard` 都会跑）。

## 三、五个同构面

提交和 tag 只能带走代码与镜像。下面五个面不在提交里，预发布动了其中任何一个，就要在同构清单里登记，正式做完才算完成。

| 面 | 例子 | 预发布做的时候 | 正式做的时候 |
|---|---|---|---|
| `schema` | 新增表、列、索引 | 随 rc 部署由服务启动时迁移；迁移幂等、只增不删 | 随正式部署同一个迁移；先按第四节在备份副本上演练。只有迁移之外还要手工步骤时才登记 |
| `data` | 比赛官网、OIDC 客户端、称号与名册 | 用脚本或服务自带的函数写入，记下命令 | 对正式库执行同一条命令，先 dry-run，执行后核对记录数 |
| `env` | 新增 env 键、新增密钥 | 先改三份模板与 ENVIRONMENTS 字段表，再配预发布的环境 secrets | 配上正式环境的同名 secrets，部署时渲染；缺必填密钥时渲染失败 |
| `host` | 前置 Caddy、nginx、CSP、`gitlab.rb` | 能进仓库的进仓库做模板；不能的把改动和备份位置写进清单 | 对正式宿主做同一改动，先备份，改完留校验输出 |
| `external` | OAuth 回调、Turnstile 域名、Google 客户端、DNS、CDN | 记下登记的位置与值的形状（不记密钥） | 对正式域名做同样的登记，所有者本人的操作写清谁在何时做 |

## 四、无损迁移流程（表结构和数据）

1. 设计：迁移可以重复执行，结果相同；只增不删。要删列、改语义时拆成两次发布，第一次兼容新旧，第二次清理。
2. 预发布：rc 部署后，核对迁移前后的记录数（`func:data` 的 PR 要把前后数字写进验收证据）。
3. 正式前：取一份一致备份（[BACKUP](../ops/BACKUP.md)），在备份副本上用目标镜像演练升级：断网容器、`integrity_check` ok、外键违规 0、第二次启动幂等、旧镜像能在升级后的库上启动。演练产物按 `.tools/handoff/` 的做法留证据，副本用完删除。
4. 部署：沿用既有部署链（备份、隔离恢复、镜像校验和、健康门、回滚，见 [CICD](../ops/CICD.md)），不手工改运行中的栈。
5. 部署后：核对记录数，跑第六节的烟测。
6. 修数据缺口：用服务自带的函数或脚本（例如 `bootstrap-owner.mjs`），先 dry-run 看结果，再带 `--apply`；不手写对正式库的 UPDATE。
7. 回滚：切回旧发布 tag 的镜像（[RELEASES](RELEASES.md)「回滚」）；库结构不兼容时停下来由人处理，不用重置数据库代替回滚。

## 五、同构清单

清单是 `deploy/parity/ledger.json`，只用 `scripts/parity.mjs` 写，时间取系统时钟（北京时间），不手填。

```bash
node scripts/parity.mjs list
node scripts/parity.mjs add --surface data --title "…" --issue <编号> \
  --preview-evidence "预发布做了什么、怎么验证的" --production-action "正式要做的动作和命令"
node scripts/parity.mjs done P-0010 --evidence "正式做了什么、怎么验证的"
node scripts/parity.mjs not-applicable P-0010 --reason "为什么正式不需要"
node scripts/parity.mjs waive P-0010 --by Crosery --quote "所有者的原话"
node scripts/parity.mjs check --release
```

- 谁登记：在预发布做这件事的人或 agent，做的当时就登记，写进同一个 PR；清单条目里的 `production.action` 要具体到别人照着就能执行。
- 谁关闭：在正式做完的人，`done` 要写证据；确实不需要写 `not-applicable` 和理由；只有所有者能豁免，`waive` 必须带所有者的署名和原话，agent 不替所有者写豁免。
- 门禁：`deploy-production.yml` 与 `deploy-hotfix.yml` 的 `parity` job 运行 `check --release`，还有 `pending` 就不构建、不部署。预发布部署不受它拦截。已写的结论不改，写错了追加一条新记录说明。
- 记账靠执行者：脚本只保证登记过的条目会被核对，发现不了漏登记；漏登记由第六节的烟测兜底可见的差异，只在内部可见的差异（例如没人访问的数据）仍然是盲区，所以登记要在做事的当时完成，不留到发版前回忆。

## 六、发版烟测

`deploy/parity/smoke.json` 有两段，地址里不写域名：

- `require`：某个环境发完后必须满足的期望，包含内部赛事官网 `/c/oss-challenge-2026-1/` 返回 200 且正文含站点标题、`/release.json` 的环境名与被测环境一致。
- `mirror`：同一份提交在预发布与正式上，这些地址的状态、内容类型必须一致；内部赛事官网要求正文也一致；`/oidc/.well-known/openid-configuration` 要求两边的 `issuer` 各是自己的 `PUBLIC_ORIGIN/oidc`。

```bash
node scripts/parity.mjs smoke --origin <站点> --env <production|preview>
node scripts/parity.mjs compare --preview <预发布站点> --production <正式站点>
```

正式部署工作流在部署成功后自动跑 `smoke`；`deploy-production.yml` 里预发布与正式是同一个提交（证据 job 已核对），所以还会跑 `compare`。`deploy-hotfix.yml` 只跑 `smoke`：hotfix 的正式提交在 `main` 上，预发布可能在更新的提交上，不能要求两边正文相同。烟测失败时这次运行变红，已切换的栈不会被它回滚，按 [DEPLOY](../ops/DEPLOY.md) 的回滚步骤处理。

## 七、hotfix 同样走这里

hotfix 从 `main` 修（[RELEASES](RELEASES.md)「线上紧急缺陷（Hotfix）规约」），不因为紧急跳过同构：修复里动了五个面中的任何一个，同样登记；`deploy-hotfix.yml` 同样被 `parity` job 把关；合回 `stage` 时把清单一起带回，`stage ≥ main` 照常成立。清单里有历史欠账时，hotfix 要么先把它们做完，要么由所有者逐条豁免并留原话，不由 agent 取舍。

## 八、对 agent 的要求

动手前：读本文、`deploy/parity/ledger.json`（看哪些还是 `pending`）、对应环境的 env 模板。

必须做：

- 任何地址、端口、签发者、镜像仓库从 env 文件或 `deploy/environments.json` 读；改了环境相关的文件先跑 `pnpm check:env-isolation`。
- 在预发布做了不在提交里的事，当场 `parity.mjs add`；在正式做完，当场 `parity.mjs done`，两边的证据都是命令和真实输出。
- 发版或 hotfix 前跑 `parity.mjs check --release`；发版后跑 `smoke`，晋升同一提交时再跑 `compare`；输出贴进 PR 或 issue。
- 报告里把 `pending` 条目、没跑的检查、依赖所有者的动作单独列出，不写成已完成。

禁止：

- 在代码、工作流、宿主片段里写另一个环境的域名，或为了让检查通过去扩大 `origin-exceptions.json` 而不写理由。
- 预发布做了而正式没做就打正式 tag 或派发 hotfix；把「预发布没问题」当成「正式也做了」。
- 用 `waive`、`not-applicable` 绕过清单，改 `parity.mjs`、`smoke.json` 或检查脚本来换绿色。
- 手写对正式库的 UPDATE，手工改运行中的栈，或把 `.env.dev` 之外的真实密钥写进任何入库文件。
- 替所有者决定豁免、替所有者填写验收。

## 与其它规范的关系

分支模型与 hotfix 流程见 [BRANCHING](BRANCHING.md)；发版与回滚见 [RELEASES](RELEASES.md)；env 字段契约、密钥清单见 [ENVIRONMENTS](../ops/ENVIRONMENTS.md)；部署工作流与 job 职责见 [CICD](../ops/CICD.md)；备份与演练见 [BACKUP](../ops/BACKUP.md)；审查清单见 [CODE-REVIEW](CODE-REVIEW.md) 第 15 项。实现：`scripts/check-env-isolation.mjs`、`scripts/parity.mjs`，测试在 `tests/tooling/env-isolation.test.ts`、`tests/tooling/parity.test.ts`。机器检查不证明语义正确：检查通过只说明登记过的、写出来的东西满足规则。
