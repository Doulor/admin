# 一键系统备份与恢复

> 控制台「备份」页一键导出整个系统的数据快照，方便服务挂了重建，或者搬到新机器。

状态：`current` · 更新：2026-10-24 · 依据：所有者 2026-10-24 22:22「论坛里面的admin一定要有对应我们所有系统一体化的备份，包含论坛和所有的信息数据可以备份下载一键导出，方便后续相关的服务掉了或者搬迁方便……预发布和正式应该是两个隔离一样方便迁移的环境」（#282）。

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

这个流程不解决镜像、compose 和宿主 nginx 配置的搬迁，那部分仍按 [DEPLOY](DEPLOY.md) 的部署规范走；本页只管数据这一半。

## 已知限制

- 没有自动化的定期备份任务：现在只能在控制台手动点一次，点一次打一份新归档。
- 恢复脚本只验证文件完整性（sha256），不验证数据库内部的业务一致性；跨大版本迁移（表结构有不兼容变更）仍需人工核对，见 [DEPLOY](DEPLOY.md)「数据与备份」的一般原则。
- `app/forum`（Nuxt 前端）本身没有需要备份的运行数据，论坛的全部线上数据都在 `data.db` 里，见 [server 合同](../services/server/README.md)「数据所有权」。
