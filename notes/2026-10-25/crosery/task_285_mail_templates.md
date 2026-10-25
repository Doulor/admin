# task/285/mail_templates · crosery · 2026-10-25

负责人：crosery

## 12:58:02 +08:00 · 开工 · #285 · admin 招聘邮件多模板、预览、试发

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：从 GitLab stage 130a58b8（rc.22）建 task/285/mail_templates 与独立 worktree .claude/worktrees/task-285；GitHub origin/stage 落后 378 个提交，所以基线取 GitLab
- 结果：worktree 已建；依据：Crosery 2026-10-25 12:52 接手指令，issue #285 已在 GitLab 建立并写入所有者确认
- 下一步：装依赖后按 issue 验收条件实现

## 13:26:45 +08:00 · 提交 · #285 · 招聘四封信的内容抽成模板数据

- 执行者：agent-claude-geek-main-mail（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 lib/mail/template-content.ts（变量清单、{{变量}} 替换、模板校验、四类默认内容、『面试邀请 · 简短』）；recruitment.ts 改成读模板内容渲染，函数签名与输出不变；新增 tests/server/mail-template-content.test.ts。文档：本批提交末尾统一更新 docs/services/server/ 下的 mail.md 与 README。
- 结果：改造前后各渲染 770 种输入（四类信 × 称呼、回信地址、说明、特长等组合）逐一对比：654 种 HTML 与纯文本逐字相同，全部报错用例的错误相同；其余 116 种只有一处不同：姓名只有空白时不再画空的姓名行，投递接口不收空白或过短的姓名，真实数据不受影响。mail-envelope、mail-outbox、applications 三个既有测试文件 83 项通过；新增 mail-template-content 15 项通过；pnpm typecheck 通过。
- 下一步：模板表与迁移、权限节点、接口、试发
