# stage · crosery · 2026-10-24

负责人：crosery

## 13:31:29 +08:00 · 发布 · #274 #275 · 本机构建并部署预发布 v0.1.1-rc.18（e43df562e37a）：#274 账号权限统一、#275 YUGC OS v2 官网

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：release worktree 切到 stage e43df562，/tmp/geek-takeover/build-rc.sh 18 本机构建 amd64 镜像（server、web、forum，tag e43df562e37a，GEEK_RELEASE_VERSION=0.1.1-rc.18@e43df562e37a），存未压缩归档，sha256 edd61913…14c5；核对 web 镜像里没有样板身份代码、归档目录、手机模型和旧吉祥物图。目标机先用 rc.17 归档复制出同名文件作底，rsync --no-whole-file 增量传（传 154 MB），sha256sum -c 通过。部署前备份预发布库为 /root/yzgc-backups/preview-20261024-052839-9c5b74f754b3.db（integrity_check ok，600）；目标机 deploy/compose/preview.yml 先备份为 /root/yzgc-backups/compose-preview-9c5b74f754b3.yml，再换成 e43df562 的版本（只删掉没有读者的 GH_APP_*、ALLOWED_ORGS）；env-prep-tag.sh 只改 IMAGE_TAG；deploy-stack.sh --environment preview 部署。本机打轻量 tag v0.1.1-rc.18 指向 e43df562，没有推送。
- 结果：部署成功：preview e43df562e37a，两个 healthz ok；release.json 为 0.1.1-rc.18@e43df562e37a；server 日志没有 warn、error 级别（只有 Node 的 MODULE_TYPELESS_PACKAGE_JSON 提示，package.json 与 rc.17 相同）。yugc-v2 迁移报告：users 5、identities 10、forum_users 11、applications 9、audit_logs 144 不变，新建 perm_nodes 50、perm_groups 26、perm_group_parents 18、perm_entries 75、perm_members 6、account_profiles 5，activity_events 复制 144 行。/、/feedback、/feedback/geek、/github、/join/abc、/forum/、/console、/signin 都回 200 页面。
- 下一步：ego-browser 在预发布按 ACCEPTANCE A、B 和 !8 的人工验收步骤走一遍，结果写到 #274、#275

## 15:44:40 +08:00 · 发布 · #279 · 本机构建并部署预发布 v0.1.1-rc.19（39ab81ab9203）：#279 窗口按钮、模拟 Linux 终端、加入我们窗口

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：release worktree 切到 GitLab stage 39ab81ab，/tmp/geek-takeover/build-rc.sh 19 本机构建 amd64 镜像（server、web、forum，tag 39ab81ab9203，GEEK_RELEASE_VERSION=0.1.1-rc.19@39ab81ab9203），未压缩归档 sha256 28eff5a8…23fb；核对 web 镜像里有 Terminal、JoinBox 分包，没有归档目录和旧吉祥物（控制台的 shell__mock 只是 CSS 类名，rc.18 相同）。目标机用 rc.18 归档复制出同名文件作底，rsync --no-whole-file 增量传（传 316 MB），sha256sum -c 通过。部署前备份预发布库 /root/yzgc-backups/preview-20261024-073949-e43df562e37a.db（integrity_check ok，600）；env-prep-tag.sh 只改 IMAGE_TAG；deploy/ 与三个 Dockerfile 自 e43df562 没有变化，compose 不用换；deploy-stack.sh --environment preview 部署。本机打轻量 tag v0.1.1-rc.19 指向 39ab81ab，没有推送。
- 结果：部署成功：preview 39ab81ab9203，两个 healthz ok；release.json 为 0.1.1-rc.19@39ab81ab9203；server 近 5 分钟日志没有 error；/、/join-us、/apply、/?open=terminal、/forum/、/console、/signin 都回 200；部署脚本清掉了 2101fe40448a 的旧镜像（保留最近 5 个）。
- 下一步：ego-browser 按 !9 人工验收步骤验收
