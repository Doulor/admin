# GitLab CE 运维与部署合同

> `deploy/gitlab/` 的来源、安装映射、OIDC 与头像边界、私有备份及恢复验收门禁；源码纳管不代表重新部署或统一登录恢复。

状态：`current` · 更新：2026-10-27 · 适用：既有 GitLab 旁路服务的源码维护与获批恢复。依据：[GitHub admin#270](https://github.com/Yangtze-University-Geek-Class/admin/issues/270)（Arch 预部署与运维源码纳管）；历史身份事项分别为 [GitLab geek/admin#270](https://git.yangtzeu.work/geek/admin/-/issues/270)（统一登录）、[GitLab geek/admin#271](https://git.yangtzeu.work/geek/admin/-/issues/271)（资料头像同步）、[GitLab geek/admin#272](https://git.yangtzeu.work/geek/admin/-/issues/272)（提交邮箱同步）。


## 架构拓扑与运行网络

源码声明的既有链路：公网 `git.yangtzeu.work` → 香港 Caddy（TLS 终止）→ `hk-tunnel.service` 的 `ssh -w` 三层点对点隧道（`10.66.0.1` ↔ `10.66.0.2`）→ Arch `10.66.0.2:8929` → GitLab 容器 HTTP 80。隧道实现依据原始迁移调查，不由 Compose 文件推断。

- [docker-compose.yml](../../deploy/gitlab/docker-compose.yml) 只发布 `10.66.0.2:8929:80` 和 `127.0.0.1:8929:80`，不发布容器 SSH；成员通过 HTTPS/PAT 推拉。
- [gitlab-compose.service](../../deploy/gitlab/gitlab-compose.service) 等待 `tun0` 的 `10.66.0.2` 后执行 Docker Compose；它不是应用平台两套栈的部署入口。
- 容器内 Nginx/Rails 的代理信任地址为 `10.66.0.1`、`10.66.0.2`、`127.0.0.1`、`172.31.29.1`；真实 IP、防伪造头及 DNS/TLS 仍需目标链路取证。
- GitLab 是既有旁路服务，不加入 `yzgc-production` / `yzgc-preview`，不因本任务重启、reconfigure、改签发者或启停同步。本轮没有读取运行配置或探测线上健康。

## 源码纳管与运行安装映射

唯一维护入口是仓库 `deploy/gitlab/`。本轮将其中 28 个普通文件逐一与只读来源 `/Users/crosery/work_file/geek_gitlab/<同相对路径>` 比对：28 个 SHA-256 与大小一致，缺失 0、不一致 0；未改动导入文件。外部 `README.md` 的安装表和恢复说明已读取；`PLAN.md`、`BRIEF-backup.md` 是历史方案，不覆盖本合同。三份来源说明未导入，28 项内没有 `.git`、运行数据库、备份包、环境文件或私钥。

| 仓库源码（`deploy/gitlab/` 下） | 获批安装时的目标 / 调用关系 |
|---|---|
| `docker-compose.yml` | Arch `/srv/gitlab/docker-compose.yml`；由 `gitlab-compose.service` 引用 |
| `gitlab-compose.service` | Arch `/etc/systemd/system/`；依赖既有 Docker、隧道服务 |
| `settings.sh` | Arch `/srv/gitlab/settings.sh`；用 `bash` 显式执行，写数据库应用设置，不随源码纳管自动执行 |
| `backup.sh`、`restore-drill.sh`、仓库 `deploy/remote/garage-archive.mjs` | Arch `/srv/gitlab/`；前者由备份 service 调用，后者由获批操作者调用，共享归档器由两者调用 |
| `gitlab-backup.service`、`gitlab-backup.timer` | Arch `/etc/systemd/system/`；timer → service → `/srv/gitlab/backup.sh` |
| `gitlab-oidc.rb`、`gitlab-ui.rb` | 审核后合入 Arch `/srv/gitlab/config/gitlab.rb`，不是独立 Ruby 程序；不得反复追加或覆盖整份已有配置 |
| `gitlab.caddy` | 香港 `/etc/caddy/sites/gitlab.caddy`；默认头像规则优先，其余反代到 `10.66.0.2:8929` |
| `ui/logo.png`、`group-avatar.png`、`favicon-32.png`、`project-*.png`（4 张） | 外观、组织和项目头像上传输入；没有自动上传脚本 |
| `ui/nano-avatars/20261025/avatar-*.png`（8 张）与 `manifest.json` | 香港 `/var/lib/caddy/gitlab-avatars/20261025/`；Arch `/srv/gitlab/config/nano-avatars/20261025/` 的恢复副本只有实际安装后才会进入配置备份 |
| `ui/nano-avatars/20261025/preview.png` | 离线预览，不是站点运行依赖 |
| `ui/cut-logo.py` | 离线图像处理，显式输入/输出路径，依赖 NumPy/Pillow；不需要为使用现有 PNG 重跑 |

本地已核对 service 的脚本/Compose 引用、timer 的 service 引用与 Caddy 的 8 张图均有对应源码。运行时 `/etc/gitlab-backup/env`、`/srv/gitlab/config/{gitlab-secrets.json,yzgc-oidc-secret}`、`hk-tunnel.service` 不在 28 项内；未读取或声称它们已就绪。没有总安装器，也没有由本任务到服务重启的自动调用链。

### 来源与许可门禁

来源目录未提供 `LICENSE` / `COPYING`，本仓也没有可替这些资产授予许可的根许可证。原说明将 4 张项目图标归为 Remix 线性图标，但未附版本和许可文本；头像 manifest 记录生成模型、人设参考及原图哈希，不等于完整的授权证明。保留原字节与来源台账，不补造许可证。公开分发前由所有者核实徽标、人设参考、生成图及 Remix 图标的使用/再分发权，并保留适用声明；当前仅证明来源一致，未证明许可齐全。

## 物料清单与 SHA-256 校验和

2026-10-26 本地逐文件核对结果。下列 SHA-256 同时适用于导入文件及上述来源目录的同相对路径；这是导入基线，不是线上安装清单或运行数据的校验和。

| 相对路径 (`deploy/gitlab/`) | 大小 | SHA-256 校验和 |
|---|---|---|
| `backup.sh` | 7,749 B | `74b4f357a8d09547de5caf332918792dd9fc4bbd0bc3911fff1f351bbb2b0e2d` |
| `docker-compose.yml` | 2,103 B | `849ad0a292ae17d00ffeb7619a7b599c915d9c5017734ef7cd2b7e4addbc2189` |
| `gitlab-backup.service` | 296 B | `b097e2467d8b5718d8e92a020df0d976018bbe69d6e15ee7e6bdcdfd0a731d6f` |
| `gitlab-backup.timer` | 193 B | `d524d35c27a384a06b30e0b8fd61696766e5cef1ae8f69009f44e2d976a2c39c` |
| `gitlab-compose.service` | 699 B | `568289608539ed2bb77b24935d0da8851c6c7384009c03aefdc69533d0247e64` |
| `gitlab-oidc.rb` | 1,485 B | `d3045aa6241c611ceb32590311133ad69279b2ca1d323646266f0ad0b3017176` |
| `gitlab-ui.rb` | 587 B | `e12e9d77ef6a2215babef2cc0086fb5a5a6a370346320b81e41ac5bd9450a277` |
| `gitlab.caddy` | 1,250 B | `aa577a62c2911a1178ec1712a058ea91b1f21cb00f9fc5e8f1fd5c43df8cb5a8` |
| `restore-drill.sh` | 10,443 B | `fba9106323f447d392cb3a699fff813e65a070f429ba85870408f40ce1378212` |
| `settings.sh` | 806 B | `5afec360e0fd78eab549421e982b594020450e54bfcea75ca45a699ca7c39baa` |
| `ui/cut-logo.py` | 832 B | `dc860c2e41bb9800c283ec902533d92142f69518d5e450d91504748a594519e6` |
| `ui/favicon-32.png` | 3,218 B | `67eb4261585ae33b8b2cb60233593b207c1e0794dcb816c077bd0a8c2a5adb0d` |
| `ui/group-avatar.png` | 79,328 B | `8d6096e2fa9664faca22b555f2a3cfb9b5b0c5e8c0ceb21d200de8757204213b` |
| `ui/logo.png` | 79,328 B | `8d6096e2fa9664faca22b555f2a3cfb9b5b0c5e8c0ceb21d200de8757204213b` |
| `ui/nano-avatars/20261025/avatar-01.png` | 56,551 B | `8aff73c1920d726d6ad0faaca55289ce23e020ce08766458b19351ce33f20332` |
| `ui/nano-avatars/20261025/avatar-02.png` | 55,624 B | `e225b98f39ea41e922c274e247e910fd5fb8d8179580cd75687383aa18fd38a6` |
| `ui/nano-avatars/20261025/avatar-03.png` | 56,391 B | `3d3a3372404e8684993d25ec275d674b7b203bd985a9d1147d2313e41616657c` |
| `ui/nano-avatars/20261025/avatar-04.png` | 55,942 B | `fdb175b768200559ba18e968a73b6e442ba3b453b0c2e8b71a20cd31e5d5036d` |
| `ui/nano-avatars/20261025/avatar-05.png` | 60,339 B | `31fc3afca8969d15622bed6236f09b8776da1fd2179635d86d30d01908decba1` |
| `ui/nano-avatars/20261025/avatar-06.png` | 67,217 B | `46a8ebb3218a7cb877d078bf108ae1cd83a4cb9af73a3063d0856464c33fcc63` |
| `ui/nano-avatars/20261025/avatar-07.png` | 64,467 B | `6dc329a2c57118cfb7d98918c872bbcbb2f1ef415e7f89d16b5f40350ea19006` |
| `ui/nano-avatars/20261025/avatar-08.png` | 62,834 B | `a57f4cfc5998139dbc14f38e3ca25ede42b071ad489cf5aba07ab1b10de02e2b` |
| `ui/nano-avatars/20261025/manifest.json` | 6,672 B | `14658688ba1abe03545a5867c6eb61974e9553e7bdd99a5a10bb4fbd4f3a1409` |
| `ui/nano-avatars/20261025/preview.png` | 499,659 B | `a98888a4f2033c587003e3b14bac7a4136f70da528e11dc34e5125619f33e684` |
| `ui/project-github-line.png` | 4,706 B | `1351398881600754cbf834c772af7d089d18d9982357ff38677c1ba06cf464b8` |
| `ui/project-global-line.png` | 5,543 B | `d6b53f1e0c0621a5561f6ac27017cce41df0ce65e1fd23af85362536e7356f0b` |
| `ui/project-robot-2-line.png` | 3,714 B | `2b85cf053e08ddb1eecf4d279e984303ad405f8bcdbdd074590bae26141cb743` |
| `ui/project-terminal-box-line.png` | 3,077 B | `8439c9b6d2fda4c6e7f04708124ec07c7f35baa566e80350577308994a1bdaac` |

---

## 容器配置与资源基线

Compose 固定 `gitlab/gitlab-ce@sha256:bb79dc86267c557fd11e7feb0cd9dd506dd02e991ecdd6cae11ca7d7e5d36fc3`；交接记录对应 CE 19.5.1，本轮没有运行镜像核实版本。限额为内存 `10g`、CPU `6`、共享内存 `256m`，Puma 2 worker、Sidekiq 并发 10、关闭 Prometheus/registry/usage ping。源码注释的常驻内存目标不是实测容量结论。

恢复必须使用备份产生时**同版本、同 CE 版本类型**的镜像；不能把当前 Compose 的摘要、`latest` 或可启动当作兼容证明。镜像升级与 GitLab 运行变更另行审批，不随应用平台迁移顺带执行。

## 极客班统一登录（OIDC）契约

身份实现及服务验收以 [Server OIDC 合同](../services/server/oidc.md)、[安全模型](../architecture/SECURITY.md#对外授权与-gitlab-账号同步270) 为准；导入的 [gitlab-oidc.rb](../../deploy/gitlab/gitlab-oidc.rb) 仅保存 GitLab 侧片段，目前写的是 `https://prev.yangtzeu.work/oidc`、client id `gitlab`、`uid_field: sub`、PKCE、回调 `https://git.yangtzeu.work/users/auth/openid_connect/callback`。`File.read('/etc/gitlab/yzgc-oidc-secret')` 指向宿主配置挂载内的文件，不在源码里放 secret。

- `users.id` 是内部账号 ID，不是给 GitLab 的主体标识；下游 `sub` 按 sector（回调主机）生成 32 字节随机值，持久化于 `oauth_subjects`，不能从账号 ID 重新计算。GitLab `openid_connect` 的 `extern_uid` 必须沿用该值。
- 迁移保全 `oauth_clients`、GitLab sector 的 `oauth_subjects`、`gitlab_accounts` 和原 `ENCRYPTION_KEY`；跨库内部 ID 可不同，须按不可变身份及认领证明对账，不按邮箱/昵称自动合号或直接照抄内部 ID。
- 改接正式签发者的门禁顺序：关闭旧预发布 sync → 对账并保全原 sector/sub、client 与账号关联 → 经批准改 GitLab issuer/client secret → 只开启正式 sync。Arch 副本先保持 sync off；不能让两个环境同时写同一 GitLab。
- root 的应急地址为 `/users/sign_in?auto_sign_in=false`；普通成员的密码限制、组权限和资料传播须另验，不能从配置片段推断已生效。默认头像优先级也不等于核心同步永不改用户头像。
- 交接中的真实 SSO 成员资格故障仍未在本任务修复或复测；“同步无错误”、资产纳管、语法通过均不证明有效成员/往届/站长可登录。历史资料头像同步不是 NANO 头像池任务，不混用两平台同号 issue 或在 GitLab MR 写关闭 GitHub issue 的裸编号。

## 界面定制、NANO 头像池与自定义头像保护

[gitlab-ui.rb](../../deploy/gitlab/gitlab-ui.rb) 关闭 packages/dependency proxy，并把自定义 Libravatar 地址设为同站 `/nano-avatar/20261025/%{hash}?s=%{size}`。[manifest](../../deploy/gitlab/ui/nano-avatars/20261025/manifest.json) 的 8 张 PNG 为 4 张 Q 版、4 张正常比例，均为 512×512；本地已核对各图的大小、尺寸及 SHA-256。它们与论坛 `app/server/assets/stickers/manifest.json` 的 56 张表情是两组独立资产。

- Caddy 仅对 64 位小写十六进制散列取首位映射：`0/8→01`、`1/9→02`、`2/a→03`、`3/b→04`、`4/c→05`、`5/d→06`、`6/e→07`、`7/f→08`；`s` 参数不参与选图。
- `/assets/no_avatar[-<hash>].png` 回退至 `avatar-01.png`；已有上传头像路径不在这些匹配器内。**自定义头像优先**，不得为重放默认头像迁移而清除用户头像或改同步来源标记。
- 既有 8 张图已在前序任务交付；本任务不重新生成、上传或部署，不重做历史默认图清理。`manifest` 中的 `visual_review` 与原安装说明的截图/线上结果属于前序记录，不是本轮验收。
- 完整恢复还需香港图片和 Caddy 规则；备份脚本不直接打包香港文件，只有事先存入 Arch `config/nano-avatars/` 的副本才随配置归档保存。外观/组织/项目已上传图片随 GitLab 数据备份；未上传的源码图片仍从本仓取得。

## 私有备份与恢复门禁

### 备份合同

[backup.sh](../../deploy/gitlab/backup.sh) 使用 `flock`、`umask 077`，由 [timer](../../deploy/gitlab/gitlab-backup.timer) 每日 `03:30 Asia/Shanghai` 调用。它先 `gitlab-backup create SKIP=registry STRATEGY=copy CRON=1`，再分别 GPG 公钥加密数据 tar 与配置 tar，写 `SHA256SUMS`，最后调用共享 [garage-archive.mjs](../../deploy/remote/garage-archive.mjs) 归档。适配器固定 `https://cdn.yangtzeu.work`、region `garage`、path-style 和私有桶 `geek-backup`；上传前完整 GET 已有对象，逐字相同才复用，不同则失败，新增后再次完整 GET 核对 SHA-256。它没有覆盖、删除、移动、sync 或 purge 接口。

- GitLab 路径为 `gitlab/YYYY-MM-DD/<run>/`。恢复必须点名 run：`restore-drill.sh --run YYYY-MM-DD/<run>` 只核对被点名的这一个 run，不带 `--run` 时只列候选并退出 1，**不再**自动挑“字典序最新”的那一个；`--day YYYY-MM-DD` 只是列候选时的过滤器。旧 `gitlab/YYYY-MM-DD/` 单层目录只能列出、不再由新备份写入，也不能直接作为 `--run`。
- 凭据只从 `/etc/gitlab-backup/env` 或进程环境的 `GITLAB_BACKUP_S3_ACCESS_KEY_ID`、`GITLAB_BACKUP_S3_SECRET_ACCESS_KEY` 注入；endpoint、region、桶和 path-style 不接受环境改写。凭据不得进入配置归档、日志、argv 或源码。
- 配置候选恰为 `/srv/gitlab/config`、Compose、backup/restore 两脚本及三个 systemd unit，只归档存在项；不是缺任一项都会失败。`config` 必须含原 `gitlab-secrets.json` 与 `yzgc-oidc-secret`，另含头像恢复副本才能宣称可恢复这些内容。
- `/etc/gitlab-backup/env`、七牛 AK/SK、GPG 私钥/口令不在配置归档内；GitLab 配置包本身**包含运行 secret**，仅允许加密保存，绝不能导入源码仓库。明文配置 tar 在加密后及退出 trap 中删除；这不是磁盘块级安全擦除。
- 换源不授权清理：新脚本不删除旧明文 tar、本地加密运行或任何远端对象。旧供应商材料与既有恢复证据保留；保留周期、清理和迁移另行批准。平台的一键系统备份见 [BACKUP](BACKUP.md)，不能用 GitLab 备份代替。
- Garage 不提供服务端 WORM、对象锁或 `If-None-Match` 原子创建。客户端完整 GET/比对/写后读回与单次脚本锁只能防止本程序主动覆盖，不能隔离跨进程竞态或恶意写入者；桶级最小权限、串行写入与外部独占网关须在真实环境另验。

### 平台快照异机归档

`platform-maintenance.sh backup` 仍只在 `platform-backup@.service` 的 `RestrictAddressFamilies=AF_UNIX` 沙箱里生成本地快照、SHA-256 和收据，不联网。收据新增固定目标 `geek-backup/platform/<production|preview>/<北京日期>/<run>/`。独立 [platform-archive.sh](../../deploy/remote/platform-archive.sh) 在获批的可联网、最小权限执行环境中重新核对本地三份 SHA，打成明文 tar 后用 `PLATFORM_BACKUP_GPG_RECIPIENT` 加密，仅把 `.gpg` 与其 `SHA256SUMS` 交给共享归档器；明文 tar 退出时删除，本地原快照不删除。正式与预发布分别只接受 `PLATFORM_PRODUCTION_BACKUP_S3_*`、`PLATFORM_PREVIEW_BACKUP_S3_*`，不能共用默认凭据或从业务 `.env` 读取。

发布生成的 0600 私有内容索引由同一归档器写入 `geek-production-private` 或 `geek-preview-private` 的 `indexes/content/<40位commit>/sha256.json`，凭据分别是 `PRODUCTION_PRIVATE_INDEX_S3_*` 与 `PREVIEW_PRIVATE_INDEX_S3_*`。索引 schema、权限、键和完整读回均在上传前后核对；同键不同字节失败，runner 临时文件未归档时不得称持久追溯完成。

### 恢复前必须满足

1. 先取得恢复目标、日期、资源预算与清理范围的明确批准；本任务不执行脚本、不读取真实备份。新目标与旧实例隔离，不覆盖活机目录，不重启旁路 GitLab。
2. `restore-drill.sh` 先用共享适配器逐对象完整 GET 到全新目录，再以 `sha256sum -c SHA256SUMS` 核对两份加密归档；之后才解密。核对原 GitLab 备份版本/CE 类型及配置归档里的 Compose 镜像与数据备份对应。脚本实际读取的是**当前** `/srv/gitlab/docker-compose.yml`，并且只接受逐字等于 `gitlab/gitlab-ce@sha256:bb79dc86…d36fc3`（脚本顶部常量）的镜像串：`:latest`、别的 tag 或未复核的 digest 在任何下载、解密、启动之前就失败；要换版本先改脚本常量走审查。失败或中断时，本轮创建的 `gitlab-drill` 容器与整个演练目录（含明文 `config/gitlab-secrets.json`）由同一个 EXIT 清理路径删除，原始加密归档保留，退出码不变。
3. 单独保全并验证可用的 GPG 私钥和口令；GitLab 的原 `gitlab-secrets.json`、OIDC client secret 和平台原 `ENCRYPTION_KEY` 分别用于各自系统，不能互相替代。秘密只走受控文件/凭据注入，不放 argv、日志、聊天或源码。
4. 普通带凭据命令使用 `crosery-ct cred exec --cred NAME=ENV -- 命令` 注入，不引导查看密钥。恢复脚本优先读取 fd 3，再用 `gpg --passphrase-fd 3`；保留的环境变量 fallback 不应成为推荐路径。若工具先注入 `GPG_PASSPHRASE`，应在获批目标上的短生命周期 shell 中转 fd 并取消导出，禁止 `set -x`：

   ```bash
   crosery-ct cred exec --cred GITLAB_BACKUP_GPG_PASSPHRASE=GPG_PASSPHRASE -- \
     bash -c 'exec 3<<<"$GPG_PASSPHRASE"; unset GPG_PASSPHRASE; exec /srv/gitlab/restore-drill.sh "$@"' bash --run YYYY-MM-DD/<run>
   ```

   此命令只适用于已安装凭据工具、已获恢复授权的目标。`--run` 必须是核实过的备份 run（`YYYY-MM-DD/<run>`）：不传时脚本只列出可用 run 并以退出码 1 结束，不再自动挑“最新”那一个；`--day` 只用来过滤列出的候选。`--cleanup` 是**本轮恢复完成后的清理开关**，不是事后再运行一次脚本的清理命令。
5. [restore-drill.sh](../../deploy/gitlab/restore-drill.sh) 的下载阶段会联网；`garage-archive.mjs` 须和两脚本一起安装到 `/srv/gitlab/`。仅 `gitlab-drill` 容器 `--network none`、不发布端口，限额 `6g/4CPU`。它只从配置包复制 `gitlab-secrets.json`，**不恢复或验证 OIDC、香港头像、Caddy**；末尾还读取既有 `gitlab` 对象计数，因此也不是可直接在空机运行的完整灾备安装器。
6. `gitlab:check SANITIZE=true`、`gitlab:doctor:secrets` 与备份时点的数据核对均须留真实结果；live/drill 计数不同只提示，并不失败，不能据退出码证明业务一致。默认保留的恢复数据库、配置和日志仍是敏感运行数据，不进入源码；旧数据、演练目录的删除另按批准范围执行。
7. 完整灾备验收另含原 OIDC 配置/secret、sector/sub/账号关联、真实登录、仓库读取及自定义头像保护，并独立验证香港图片、Caddy 语法/TLS/代理。未满足这些条件只记录隔离数据恢复结果，不能写“SSO 恢复”或“线上 healthy”。

## 本地验收与交付边界

以下从仓库根执行；表中 28 项仍是原始导入基线。#295 明确豁免 `backup.sh`、`restore-drill.sh` 的目标字节一致性：来源必须继续符合表中摘要，仓库目标必须已偏离旧摘要；其余 26 项仍逐字一致。共享 Garage 工具在 `deploy/remote/`，不混入这份来源清单。不读取来源目录中的环境文件、密钥或备份数据。

```bash
python3 - /Users/crosery/work_file/geek_gitlab <<'PY'
from pathlib import Path
import hashlib
import re
import sys

source = Path(sys.argv[1])
target = Path("deploy/gitlab")
contract = Path("docs/ops/GITLAB.md").read_text()
rows = re.findall(r"^\| `([^`]+)` \| [\d,]+ B \| `([0-9a-f]{64})` \|$", contract, re.M)
files = sorted(p.relative_to(target).as_posix() for p in target.rglob("*") if p.is_file())
assert len(rows) == 28 and files == sorted(path for path, _ in rows)
changed = {"backup.sh", "restore-drill.sh"}
for path, expected in rows:
    source_file = source / path
    target_file = target / path
    assert not source_file.is_symlink() and source_file.is_file(), source_file
    assert not target_file.is_symlink() and target_file.is_file(), target_file
    assert hashlib.sha256(source_file.read_bytes()).hexdigest() == expected, source_file
    actual = hashlib.sha256(target_file.read_bytes()).hexdigest()
    if path in changed:
        assert actual != expected, f"{path} unexpectedly reverted to the retired provider baseline"
        print(f"MIGRATED {path} {actual}")
    else:
        assert actual == expected, target_file
        print(f"MATCH {path} {expected}")
print("26/26 untouched imports matched; 2/2 backup adapters intentionally migrated")
PY

bash -n deploy/gitlab/backup.sh &&
bash -n deploy/gitlab/restore-drill.sh &&
bash -n deploy/gitlab/settings.sh &&
python3 -c 'from pathlib import Path; p=Path("deploy/gitlab/ui/cut-logo.py"); compile(p.read_bytes(), str(p), "exec"); print("Python syntax OK")' &&
ruby -c deploy/gitlab/gitlab-oidc.rb &&
ruby -c deploy/gitlab/gitlab-ui.rb
```

2026-10-26 的 28/28 来源哈希是导入基线；#295 后 `backup.sh`、`restore-drill.sh` 已因 Garage 迁移有意偏离该来源，新增共享归档器与平台归档步骤，不得再用导入基线证明这两个脚本当前字节。当前定向回归使用合成文件、假 rclone/GPG 覆盖完整上传下载、哈希冲突、日期选择和凭据隔离；语法与单测不执行真实安装、备份、恢复、联网或图像处理。

**未验证**：目标文件权限/存在性、当前 GitLab 版本与健康、Caddy/Compose 的目标环境解析、私有桶策略及实际对象、加解密/恢复、真实 SSO、图片的线上呈现和正式验收；许可材料缺口未解除。本轮没有提交、推送、发布、SSH、网络写入、外发或服务启停。文档索引及本次 PR 的全局门禁由协调者集成，不能把这些局部证据写为全套验证通过。
