# task_280_real_name_grade · crosery · 2026-10-24

负责人：crosery

## 13:54:04 +08:00 · 开工 · #280 · #280 实名信息：真实姓名、年级、强制邮箱，登录页改成极客班内部登录

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：从 stage e43df562 建 task/280/real_name_grade 和 worktree .claude/worktrees/task-280（GitHub 的 issue 不在用，task.mjs start 查不到 GitLab issue，worktree 手工建），pnpm install --offline。先提交年级函数和两个新列（6c 开头的提交），#278 从这个提交拉分支，两边算年级用同一份代码。
- 结果：worktree 已建好；grade.test.ts 4 条、profile.test.ts 14 条通过
- 下一步：接 /auth/me、补资料接口、注册、控制台用户页、各端拦截和登录页文案

## 17:06:23 +08:00 · 提交 · #280 · 实名资料、账号资料窗口和窗口按钮

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：提交 b5dbc800（服务端实名两列与关口、补资料接口、控制台注册与补资料页、用户页编辑、官网和论坛跳转、文档与目录）、f06b289c（补资料页说明去掉多出的空格，控制台文档补卡片顺序与 no_profile 样板）、c8408797（所有者 16:38/16:42 账号资料改成桌面窗口，论坛和代码仓库照旧跳转；16:54 窗口三个按钮去掉半透明胶囊、图标一直显示）。
- 结果：vitest tests/server tests/console tests/web tests/tooling：112 个文件 1822 个用例全过；web、server、console 类型检查通过；目录核对、宏观对齐（84 个变更文件）、文档同步、docs-index、check-docs、密钥门禁、边界、站点配置、环境契约全过。ego-browser 在 127.0.0.1:5291 开发预览（?__mock=member/visitor）1440×900 与 390×844 截图核对账号资料窗口、访客窗口、Esc 回焦点和前后窗口的按钮。文档核对：docs/services/server/README.md 不用改——这次窗口改动只在 web。
- 下一步：补拍补资料页截图，推到 GitLab 开 MR，写审查结论后合并、关 #280。

## 17:26:12 +08:00 · PR · #280 · 开 MR !10

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：推送 task/280/real_name_grade 到 GitLab（7782c77d），开 MR !10 回 stage：九节正文、20 张截图（改前截图里所有者账号的邮箱一行已涂掉）、本机 3280 上对预发布库复制品的 15 个真实请求、两次迁移演练的各表行数。
- 结果：https://git.yangtzeu.work/geek/admin/-/merge_requests/10 opened；标签沿用 #280 并加 ui:layout、ui:visual。
- 下一步：写审查结论，补记后再推一次，合并进 stage、关 #280。

## 17:26:12 +08:00 · 审查 · #280 · 作者自审：有条件通过

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：按 code-review 两条线核对 39ab81ab..7782c77d：规范（检查脚本、迁移可重复、真实姓名只从本人 me 与 users.manage 的用户列表和 PATCH 出去、操作记录不写姓名、改动文件无 emoji）与需求（#280 期望结果与验收条件，所有者 13:45、16:38、16:42、16:54 原话）。
- 结果：结论：有条件通过；条件是合并后发 rc.20 在预发布按人工验收步骤走一遍。未验证：预发布真实验收、真实发信的邮箱注册与 GitHub/Google 登录后跳补资料页、论坛跳转的浏览器验证、Safari 和真机。审查结论贴在 MR !10 正文。
- 下一步：合并 !10，关 #280 并留关闭记录，task.mjs finish 清理 worktree。
