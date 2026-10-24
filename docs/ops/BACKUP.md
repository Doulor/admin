# 一键系统备份与恢复

> 控制台「备份」页一键导出整个系统的数据快照，方便服务挂了重建，或者搬到新机器。

状态：`current` · 更新：2026-10-25 · 依据：所有者 2026-10-24 22:22「论坛里面的admin一定要有对应我们所有系统一体化的备份，包含论坛和所有的信息数据可以备份下载一键导出，方便后续相关的服务掉了或者搬迁方便……预发布和正式应该是两个隔离一样方便迁移的环境」（#282）。

## 这份备份里有什么

账号资料、头像、论坛的话题/回复/表情包/上传图片全部是 `data.db` 里的行或 BLOB 列（见 [server 合同](../services/server/README.md)的数据模型），没有独立的论坛库或上传目录；唯一落在数据库之外的是比赛官网的站点包文件（`<DB_PATH 同目录>/sites/`，#278）。所以一份备份只有两样东西，打进一个 `.tar.gz`：

- `data.db`：用 better-sqlite3 的在线备份 API（`db.backup()`）拍的一致快照，不用停服务；
- `sites/`：原样打包比赛官网的站点文件（没有发布过比赛官网时这部分是空的）。

包里还有一份 `manifest.json`：应用版本、镜像 tag（`IMAGE_TAG`）、环境名、备份时间、数据库每张表的行数、每个文件的 sha256 与大小，以及新环境需要准备的环境变量**名字**（从 `deploy/env/.env.preview` 的键名读出来，绝不含任何值）。

**排除的数据**（在快照里清空，不随备份搬走）：登录会话（`sessions`）、命令行设备授权（`device_grants`）、对外登录（OIDC）的临时授权与令牌（`oauth_grants`、`oidc_payloads`）、邮箱验证码（`email_challenges`）、各种限流与去重计数（`invite_attempts`、`application_limits`、`limit_events`、`forum_rate_events`）。这些都是几分钟到几天就失效的数据，搬到新环境本来就要重新登录或重新同意，留着没有迁移价值，反而带着加密会话令牌、验证码哈希这类不必要的敏感内容。完整名单与理由见 `app/server/src/lib/system-backup.ts` 的 `BACKUP_EXCLUDED_TABLES`。

**保留的数据**：账号、密码哈希、GitLab 账号映射（`gitlab_accounts`）、对外登录的客户端登记与 `sub` 映射（`oauth_clients`、`oauth_subjects`）——迁移之后要让已有账号认得出同一个人、让已经登录过的下游应用（例如 GitLab）不用重新建号。

**永远不包含任何真实密钥**：`manifest.json` 只列环境变量的名字；归档里没有 `.env` 文件，也没有 `SESSION_SECRET`、`ENCRYPTION_KEY` 这类密钥的值（`sessions.access_token_encrypted` 这类加密值已经被整行清空，不是明文、也用不上）。

## 下载

控制台「备份」页（节点 `system.backup`，种子里只有站长的根通配 `*` 默认拿到，见 [server 合同](../services/server/README.md)「极客班控制台」）点「下载完整备份」，浏览器按 `GET /api/console/backup` 走普通下载。单账号 5 分钟一次的限流；接口会在操作记录里留一条 `system.backup.export`（只记文件数、表数和排除了哪些表，不记内容）。

## 恢复到新环境

```bash
node scripts/backup-restore.mjs --archive <下载的备份.tar.gz> --target <新环境的数据目录> [--force]
```

- 只用 Node 内置模块，不依赖 `app/server` 的三方包（`better-sqlite3` 等）：目标机很可能还没 `pnpm install`，这是一份能独立运行的恢复工具。
- 先读 `manifest.json`，再逐个文件核对 sha256；任何一个文件对不上立刻报错并停止，不会假装恢复成功。
- `--target` 已经存在且不是空目录时拒绝执行，除非加 `--force` 确认覆盖；脚本不会清掉目标目录里不相关的旧文件。
- 跑完会打印这份备份的环境、备份时间、数据库表数，以及新环境要准备的环境变量**名字**清单（真实值要照 [ENVIRONMENTS](ENVIRONMENTS.md) 的字段契约单独配置，这份备份和这个脚本都不碰密钥）。

恢复完成后，把新环境的 `DB_PATH` 指到 `<target>/data.db`；如果 `sites/` 不是空的，把站点文件根目录指到 `<target>/sites`（即 `resolve(dirname(DB_PATH), "sites")`，和原环境的约定一致，不用改代码）。首次启动时 `app/server/src/lib/db.ts` 的建表与迁移逻辑会在这份数据上照常跑一遍（都是 `IF NOT EXISTS` 或按台账只应用一次，见 [server 合同](../services/server/README.md)），不需要额外的迁移步骤。

## 在预发布和正式之间搬迁

预发布与正式是同机两套完全隔离的 Docker 栈，各自独立数据卷、互不可见（见 [DEPLOY](DEPLOY.md)「数据与备份」）。要把一份数据从一个环境搬到另一个（或者搬到全新的机器），步骤相同：

1. 在源环境的控制台「备份」页下载一份完整备份。
2. 在目标环境运行 `scripts/backup-restore.mjs`，`--target` 指向目标环境的数据卷挂载路径（例如 `<STACK_ROOT>/data`，不要直接写进正在运行的栈的数据卷，先在一个空目录里验证，再按 [DEPLOY](DEPLOY.md) 的步骤换挂载）。
3. 核对打印出来的「新环境要准备的环境变量」清单，照 [ENVIRONMENTS](ENVIRONMENTS.md) 的字段契约在目标环境的 `.env.<environment>` 里补好真实值（密钥不在备份里，必须单独准备）。
4. 用恢复后的数据启动目标栈，按平常的发布/验收流程确认服务正常。

这个流程只管数据；镜像、compose 和宿主 nginx 配置按下一节的整机清单和 [DEPLOY](DEPLOY.md) 走。

## 整机搬到新服务器

所有者 2026-10-25 01:00：「后面我们可能说不定就要迁移我们的所有服务器和相关的数据到新的服务器里面了」。一台宿主机上同时跑正式和预发布两套栈，整机搬迁时要带走的东西和各自从哪里来：

| 要带走的 | 在旧机器的哪里 | 怎么到新机器 |
|---|---|---|
| 正式、预发布两套数据（账号、论坛、投递、比赛、表情、头像……） | 两个命名卷里的 `data.db` 和 `sites/` | 分别在两个环境的控制台「备份」页各下载一份，新机器上用 `scripts/backup-restore.mjs` 恢复到各自的空目录，再挂成新栈的数据卷。两个环境各恢复各的，不要混用 |
| 镜像 | 本机或 CI 按发布 tag 构建 | 不搬：在新机器上按同一个发布 tag 的镜像重新部署（[DEPLOY](DEPLOY.md)），镜像 tag 写在备份的 `manifest.json` 里 |
| compose 文件和部署脚本 | 栈根目录 | 不搬：仓库里 `deploy/` 下有，按 [DEPLOY](DEPLOY.md) 重新放 |
| 环境变量里的非密钥项（域名、端口、开关） | 栈根的 `.env.<environment>` | 仓库里 `deploy/env/.env.<environment>` 就是模板，照着放 |
| 密钥（会话密钥、加密密钥、OAuth 客户端密钥、邮件凭据等） | 只在旧机器的 `.env.<environment>` 里 | 不进备份、不进仓库：由所有者从密钥保管处单独填到新机器的 `.env.<environment>`；`backup-restore.mjs` 打印的名单就是要填的项。`ENCRYPTION_KEY` 要和旧机器一致，否则库里加密存的下游应用密钥（GitLab 登录用的 `oauth_clients`）和兑奖码解不开 |
| 宿主 nginx 站点配置和 TLS 证书 | 宿主机的 nginx 与 certbot 目录 | 在新机器上重新签证书（certbot），站点配置照旧机器抄；证书私钥不跨机器复制 |
| DNS | 域名服务商 | 新机器验收通过后再把 `yangtzeu.work`、`prev.yangtzeu.work` 指过去；切之前旧机器保持在线 |
| 静态资源 CDN | CDN 上按镜像构建结果上传 | 不搬：重新部署时按同一个发布 tag 上传，内容由镜像决定 |
| 宿主机看护和每日备份脚本 | 2026-10-25 装在旧机器上（磁盘、内存看护和每日两库备份），还没收进仓库 | 收进仓库之前要从旧机器复制过去；收不收进仓库、要不要异机备份，等所有者决定 |

GitLab（`git.yangtzeu.work`）在另一台机器上，有自己的备份（`gitlab-backup`），不在这份备份里。

搬迁顺序：先在新机器部署两套空栈并恢复数据 → 用新机器的地址（hosts 或临时域名）把两个环境各走一遍验收 → 切 DNS → 旧机器保留一段时间再下线。切之前旧机器上的数据如果又有变动，再各下载一次备份重新恢复。

## 已知限制

- 控制台这里没有定期备份任务，点一次打一份新归档。宿主机上 2026-10-25 装了每日备份（脚本还没收进仓库，见上表最后一行），也还没有异机备份：整台机器坏掉时只能靠最近一次下载到别处的归档。
- 下载要求 10 分钟内登录过（归档里有全部账号和密码哈希），不够新时页面先请人重新登录。
- 恢复脚本只验证文件完整性（sha256），不验证数据库内部的业务一致性；跨大版本迁移（表结构有不兼容变更）仍需人工核对，见 [DEPLOY](DEPLOY.md)「数据与备份」的一般原则。
- `app/forum`（Nuxt 前端）本身没有需要备份的运行数据，论坛的全部线上数据都在 `data.db` 里，见 [server 合同](../services/server/README.md)「数据所有权」。
