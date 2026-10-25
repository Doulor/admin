# task/289/cli_acceptance_fixes · crosery · 2026-10-25

负责人：crosery

## 13:21:46 +08:00 · 开工 · #289 · 命令行安装默认源站、技能示例、登录框对齐的验收缺陷

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：从 GitLab stage 130a58b8（rc.22）建 task/289/cli_acceptance_fixes 与独立 worktree .claude/worktrees/task-289；GitHub origin/stage 落后，基线取 GitLab
- 结果：worktree 已建；依据：Crosery 2026-10-25 12:52 接手指令，issue #289 已在 GitLab 建立并写入所有者确认；预发布实测验收单 G 节原命令输出「latest.json 里没有 version」
- 下一步：装依赖后先让本机 nginx 测试变红，再改 nginx、SKILL.md 与登录框

## 13:31:37 +08:00 · 提交 · #289 · 命令行三处验收缺陷的修复提交

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：a95a40d9 修 install.sh 默认源站（nginx sub_filter）、SKILL.md 示例、登录框宽度；8efacf2b 重新生成项目目录；9d11955a 补影响声明。红绿：nginx 实测用例先红（预发布 Host 下默认源站仍是生产域名）后绿；Rust 单测 4 个；cargo clippy -D warnings、fmt、test 32 通过；vitest tests/tooling 816 通过；check:architecture 与 check:doc-sync 对 gitlab/stage 通过
- 结果：文档核对：docs/services/web/README.md 与 docs/services/cli/README.md 已随改动更新；pnpm check 在 check:notes 停在 #276 历史记录冲突（K10，非本任务），其后的 secrets/catalog/architecture/cli/typecheck 已逐项单独跑过通过
- 下一步：合并前等 rc.23 构建后用隔离 HOME 复验 G 节，再开 MR 做审查
