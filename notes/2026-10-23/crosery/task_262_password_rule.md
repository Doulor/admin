# task/262/password_rule · crosery · 2026-10-23

负责人：crosery

## 13:53:21 +08:00 · 开工 · #262 · 密码最短从 15 位降到 8 位，不要求大小写和符号

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 13:52：「为什么设计的那么复杂，支持（两个密码例子，是所有者的真实密码，已本地核对，不公开）这样就行了啊」（之前 13:36 选了自己设 15 位以上的新密码，看到 15 位的要求后改口）。按所有者 00:21「所有操作和发版以及发布都走本地」，从 GitLab stage 2101fe40 用 git worktree add 建 task/262/password_rule（task.mjs start 要连 GitHub，不可用），挂在 #262 下
- 结果：worktree .claude/worktrees/task-262-password，pnpm install --frozen-lockfile 通过（Node 22.23.2）
- 下一步：改服务端 password-policy、控制台 passwordRuleProblem 与提示文字、相关文档和测试

## 14:00:16 +08:00 · 提交 · #262 · 提交密码最短改成 8 位，推送前去掉了所有者原话里的真实密码

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：提交 feat(auth): 密码最短改成 8 位，不要求大小写和符号（服务端 PASSWORD_MIN_LENGTH = 8、控制台检查与提示、测试、文档、ADR-0005 第三次修订、docs/changes/262.json 按本 PR 重写、项目目录重新生成）。第一次提交时把所有者原话里举的两个密码例子原样写进了提交说明、ADR、262.json 和本链路的开工记录，那是所有者的真实密码；仓库在 GitLab 上公开，推送前把这几处换成「是所有者的真实密码，不公开」，并修订了这个还没推送的提交，开工记录里的这一处同样改了，其余内容不变
- 结果：pnpm check:runtime/site-config/environments/boundaries/docs/notes/catalog/secrets、check-doc-sync --base 2101fe40、check-architecture --base 2101fe40 通过；pnpm typecheck 通过；pnpm test 93 个文件 1532 条通过；server 与 console 构建通过；git grep -i 查不到密码例子
- 下一步：按 code-review 技能两轴审查，推到 GitLab 开 MR，合进 stage 发 rc.13
