# 香港对象存储与静态 CDN 运维合同

> 一台守在香港的 1 vCPU / 1 GiB 小机器：Garage 提供 S3 兼容对象存储，Caddy 做网关与自动 TLS，S3 Manager 提供可视控制台，Policy Bridge 把控制台里的「设为公共桶」翻译成 Garage 的 website 开关。本文件是这套系统的**唯一现行合同**，配置模板在 [`deploy/storage-cdn/`](../../deploy/storage-cdn/)。

状态：`current` · 更新：2026-10-27 · 适用：香港 CDN 机（DogYun `hk.st.s`）。与业务代码无关，不被任何应用服务 import。

## 它是什么、不是什么

| 是 | 不是 |
|---|---|
| 一个 S3 兼容的**对象存储**（Garage），带公共桶直链与私有桶预签名外链 | 网站静态资源的公共 CDN — 官网/控制台/论坛的带哈希资源仍走七牛 `https://cdn.crosery.com`（见 [CICD](CICD.md#静态资源-cdn146)） |
| 平台与 GitLab 备份的归档目的地（私有桶 `geek-backup`） | 七牛桶 `crosery-backup` 的替代或迁移对象；两者的保留策略各自独立 |
| 图床/开放文档的公共桶（`geek-public`、`cdn`） | 一个多节点集群：`replication_factor = 1`，单机单副本 |

## 主机与端口

| 项 | 值 |
|---|---|
| 公网 IPv4 / IPv6 | `103.240.197.216` / `2401:2660:0601:5f58:2d4b:cd50:e101:e905` |
| 域名 | `cdn.yangtzeu.work`（Caddy 自动签发并续期 Let's Encrypt） |
| 规格 | 1 vCPU / 1 GiB / 250 GiB HDD，1000 Mbps，BBR |
| SSH | 22，仅公钥（`PasswordAuthentication no`），fail2ban 守护 |
| 防火墙 | UFW 默认拒绝入站，只开 22/80/443；3900–3903、8080、8081 一律不对外 |

| 服务 | 技术栈 | 监听 | systemd 单元 | 配置 |
|---|---|---|---|---|
| 网关 | Caddy v2.8.4 | `:80`、`:443` | `caddy.service` | `/etc/caddy/Caddyfile` ← [模板](../../deploy/storage-cdn/Caddyfile) |
| 对象存储 | Garage v2.4.1 | `127.0.0.1:3900`（S3）、`3901`（RPC）、`3902`（静态出口）、`3903`（admin） | `garage.service` | `/etc/garage.toml` ← [模板](../../deploy/storage-cdn/garage.toml) |
| 控制台 | S3 Manager v0.12 | `127.0.0.1:8080` | `s3manager.service` | `/etc/s3manager.env` ← [模板](../../deploy/storage-cdn/s3manager.env) |
| 策略桥接 | S3 Policy Bridge | `127.0.0.1:8081` | `s3-policy-bridge.service` | `/opt/s3-policy-bridge/bridge.py` |

数据目录：`/var/lib/garage/{meta,data}`（meta 是 SQLite + WAL）；控制台运行目录 `/var/lib/stowage`。

Caddy 的路由顺序是合同的一部分：S3 签名请求 → 桶策略桥接 → 控制台静态 → 公共对象直链（`/{bucket}/{key}` 改写成 `/{key}` 并补 `Host: {bucket}.cdn.yangtzeu.work` 交 3902）→ 兜底控制台。

## 存储桶

| 桶 | 权限 | 用途 |
|---|---|---|
| `cdn` | 公共 | 默认公共直链桶 |
| `geek-public` | 公共 | 图床与开放文档 |
| `geek-production-private` | 私有 | 正式站私密资源（匿名 404） |
| `geek-preview-private` | 私有 | 预发布私密资源 |
| `geek-backup` | 私有 | 平台与 GitLab 备份归档（唯一由代码写入的桶，供平台备份归档，见 [BACKUP](BACKUP.md)；GitLab 侧的备份链合同随 `deploy/gitlab/` 一起落地） |

公共直链：`https://cdn.yangtzeu.work/{bucket}/{key}`。私有桶只能用控制台生成的带签名外链，过期即失效。

切换权限走控制台 **Bucket Policy**：Bridge 收到后执行 `garage bucket website --allow|--deny {bucket}`。命令行等价操作见下节；不要绕过 Bridge 直接改 Garage 内部状态。

## 凭据（本仓库不含任何真实值）

| 凭据 | 存放位置 | 说明 |
|---|---|---|
| S3 Access Key ID / Secret | 目标机 `/etc/s3manager.env`（0600）+ 所有者凭据库 | 仓库里这两个字段**必须为空** |
| Garage `rpc_secret` / `admin_token` / `metrics_token` | 目标机 `/etc/garage.toml` | 仓库模板里留空 |
| 控制台 basic-auth 口令哈希 | 目标机 systemd 环境变量 `S3MANAGER_ADMIN_HASH`（bcrypt） | Caddyfile 里写 `{$S3MANAGER_ADMIN_HASH}`；变量缺失时 Caddy 拒绝启动（失败关闭） |

轮换顺序：先在 Garage 生成新 key（`garage key new --name …`），把新值写进 `/etc/s3manager.env` 并 `systemctl restart s3manager`，确认控制台能列出桶，再停用旧 key（`garage key deny/delete`）。导入/导出凭据走 `crosery-ct cred` 注入进程环境，不写文件、不进 shell 历史、不进日志；示例脚本 [`upload_demo.py`](../../deploy/storage-cdn/scripts/upload_demo.py) 只从 `S3_ACCESS_KEY_ID` / `S3_SECRET_KEY` 读。

## 日常运维

```bash
systemctl status caddy garage s3manager s3-policy-bridge --no-pager
garage status                      # 节点与磁盘
garage bucket list                 # 桶清单
garage bucket info geek-backup     # 单桶容量/对象数/是否开启静态访问
garage key list                    # 访问密钥
garage bucket website --allow|--deny <bucket>   # 手动开关公共直链
journalctl -u garage -n 50 -f      # 存储日志
ufw status verbose; fail2ban-client status sshd
```

改 Caddyfile 的顺序固定：先 `caddy validate --config /etc/caddy/Caddyfile`，通过再 `systemctl reload caddy`；**不要 restart**，避免中断进行中的上传。改 garage.toml 必须 restart `garage`，且先在本地 `garage server --config` 试跑一份副本。

容量与内存：`garage` 的 cgroup 上限 250M、`caddy` 120M、`s3manager` 80M、bridge 50M；常驻约 309 MB，另配 2.5 GB swap。不要把大文件反复拖进控制台预览（会走内存缓冲）。

## 冷热分层（规划，未实施）

计划以 NetBird/WireGuard 把家庭 NAS 接进同一虚拟内网，NAS 每日用 rclone 增量拉取公共桶做冷存档，香港机只保留最近 30 天热数据（`rclone delete --min-age 30d`）。这两个动作都**尚未实施**：一旦执行就是在删香港侧数据，需所有者单独批准并先有 NAS 侧校验记录。当前没有任何自动删除策略，桶只会增长。

## 明确不做

- 不在本仓库保存任何真实密钥、口令、basic-auth 哈希或私钥；发现泄漏先轮换再清理。
- 不把业务站点的静态资源切到这台机器（那是七牛 CDN 的职责，切换需另案）。
- 不在这台机器上跑应用容器、数据库或 CI Runner（1 vCPU / 1 GiB 的余量全部留给存储与 TLS）。
- 不修改 `replication_factor`、不接第二个节点、不改 UFW 放行端口，除非有明确的容量与安全评审。
- 不删除既有桶与对象：删除只能在所有者批准、且有异地校验记录之后进行。
