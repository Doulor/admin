# task/282/system_backup · crosery · 2026-10-25

负责人：crosery

## 01:48:43 +08:00 · 返工 · #282 · 合入 stage f00e9966，备份下载加刚登录过，补整机搬迁清单，修 stage 上 3 个过期用例

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：44d89047 合入 GitLab stage f00e9966：冲突在服务端文档 lib 一行（#282 的说明插进 stage 新版本）和头部日期（取 10-25），目录重新生成。审 d63fec46（子 agent backup282 写的）：归档里有全部账号和密码哈希，下载只要节点不要刚登录过；环境变量名单写死读 .env.preview，服务端镜像里也没有 deploy/env，线上打的清单是空的。cd91b51e：路由加 requireStepUp，备份页读 /api/identity/me 的 step_up_until，不够新时按钮换成「重新登录后下载」；名单按环境读，恢复脚本在名单为空时按备份的环境名读仓库模板；BACKUP.md 按所有者 2026-10-25 01:00「后面我们可能说不定就要迁移我们的所有服务器和相关的数据到新的服务器里面了」补整机搬迁清单（数据、镜像、compose、环境变量、密钥、nginx 与证书、DNS、CDN、宿主机脚本、搬迁顺序），ENCRYPTION_KEY 一致的要求核对过（oauth_clients 密钥和兑奖码用它加密）。跑全量时 core.test 两个、identity.test 一个失败，在 f00e9966 干净检出上同样失败：fb386a9b（#280「补资料只拦极客班成员」）改了规则没改用例；97ceb935 把期望改成直接回到开始登录的页面。
- 结果：tests/server、tests/console、tests/tooling 101 个文件 1726 个用例通过；新增用例：20 分钟前的会话下载 403 step_up_required 且不留操作记录、环境变量名单回退；server tsc、console vue-tsc 通过；check-architecture（对 f00e9966）通过 39 个变更文件、22 个关联节点；check-doc-sync、check:secrets、check:docs、项目目录核对、论坛来源核对通过。未验证：预发布上下载并恢复一遍，随 rc.21 做。
- 下一步：推送分支，开 MR，作者自审。

## 01:52:49 +08:00 · PR · #282 · 开 MR !19：一键系统备份与整机搬迁清单

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：GitLab 开 MR !19（task/282/system_backup → stage），正文写所有者 22:22 与 01:00 的原话、Closes #282、变更范围、顺手修的 3 个过期用例、宏观对齐、解决链路、验证命令、截图 2 张、人工验收步骤、风险与回滚；#282 原来没有类型标签，issue 和 MR 都加上 admin、func:api、func:data、ui:content。
- 结果：MR !19 已开。
- 下一步：作者自审。

## 01:52:49 +08:00 · 审查 · #282 · 作者自审 MR !19：返工一处后通过

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：主会话核对 d63fec46（子 agent backup282）和 44d89047、cd91b51e、97ceb935：快照用在线备份、清空的表都是短时数据、密钥不进归档、流式打包；发现恢复脚本按 join(target, entry.path) 落盘，manifest 里写 ../ 就能写到目标目录外面。2c8d4637 落盘前核对解析后的路径，加两种跑出去的用例；9bb0269b 重新生成目录。
- 结果：结论：通过。tests/tooling 全部通过，恢复脚本 9 个用例通过。未验证：预发布上下载并恢复一遍，随 rc.21 做。
- 下一步：合并进 stage，关 #282，手工收尾。
