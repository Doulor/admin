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

## 14:28:33 +08:00 · 提交 · #289 · 安装脚本源站只认合规域名

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：审查前自查发现 sub_filter 直接用 $host，Host 头里带 $(...) 会写进用户要交给 sh 执行的脚本；改成 map 限定字母数字点连字符，其余退回生产域名；二进制夹具内嵌生产域名证明版本化产物不经过 sub_filter
- 结果：hashed-asset-cache.test.ts 9 条在真实 nginx 上通过；突变验证：退回 $host 时恶意 Host 用例变红，去掉二进制 location 时 3 条变红
- 下一步：更新 MR 正文，审查后合并

## 14:38:00 +08:00 · PR · #289 · GitLab !24

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：推送 task/289/cli_acceptance_fixes 并在 GitLab 开 MR !24（目标 stage），正文按 PR 契约写，pr-contract 核对通过
- 结果：https://git.yangtzeu.work/geek/admin/-/merge_requests/24，标签与 issue 一致
- 下一步：审查后合并

## 14:38:00 +08:00 · 审查 · #289 · !24 代码审查

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：按 CODE-REVIEW 十二项逐条核对被审查提交 6ed7f664，结论写在 MR 评论 1204
- 结果：结论：通过（详见评论）
- 下一步：合并进 stage，随 rc.23 部署后在预发布复核
