# task/303/garage_archive_missing_object · crosery · 2026-10-28

负责人：crosery

## 08:44:55 +08:00 · 开工 · #303 · task/303 开工：garage-archive 存在性判断

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：GitLab #303（基于所有者 2026-10-28 08:10「弄好了预发布流程没啥问题了直接处理完正式相关的工作…然后发正式版0.1.1」）；GitHub 运行 40608443241（v0.1.1-rc.27，提交 0f26b44c）cdn-upload 作业写内容索引失败：同键内容冲突。用本机 rclone v1.75.0 对 Garage 复现：不存在的键 lsjson --stat 退出码 0 并返回 IsDir=true 的空条目。从 stage 0f26b44c 建 task/303/garage_archive_missing_object 与 worktree。
- 结果：worktree 已建，根因已复现。

## 08:44:56 +08:00 · 提交 · #303 · 存在性判断只认普通对象并让假 rclone 对齐真实行为

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：deploy/remote/garage-archive.mjs 的 putFile 改为 current && current.IsDir === false 才算已存在；tests/tooling/garage-archive.test.ts 的假 rclone 对不存在的键改成退出 0 + 空目录条目，并新增首次写入/重复/冲突用例；新增 docs/changes/303.json。文档核对：docs/ops/CDN.md、GITLAB.md、BACKUP.md 不用改——描述的只增不覆盖约定没有变。
- 结果：先红后绿：假 rclone 对齐后 18 个用例失败，修复后 garage-archive 与 platform-archive 共 24 个用例通过；去掉修复后新增用例失败。

## 08:45:12 +08:00 · 提交 · #303 · 文档核对：deploy 对应的三份运维文档

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：文档核对：docs/ops/DEPLOY.md 不用改——只改了归档适配器判断「对象是否已存在」的实现，部署流程、目标机布局与回滚步骤不变。文档核对：docs/ops/ENVIRONMENTS.md 不用改——不涉及任何环境变量或环境差异。文档核对：docs/ops/CICD.md 不用改——cdn-upload 的步骤、触发和失败关闭的约定不变，只是第一次写入现在能成功。
- 结果：文档核对三行已记；对象键、角色与不覆盖约定的权威描述在 docs/ops/CDN.md，行为未变。
