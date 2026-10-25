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

## 13:49:38 +08:00 · 提交 · #285 · 招聘邮件模板表、权限节点、接口、预览与测试邮箱试发

- 执行者：agent-claude-geek-main-mail（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 mail_templates 表（建表语句在 db.ts，目录校验要从那里找锚点）和 lib/migrations/2026-10-mail-templates.ts（首次把四类信种成默认模板，另加一套面试邀请简短版，console_seeds 标记只插一次）；新增 lib/mail/template-store.ts（每类唯一默认、默认不能停用或删除、同类名字不重复）与 template-contract.ts；新增权限节点 mail.template.manage（默认只有站长的根通配拿到）；新增接口：模板的列表、新建、编辑、删除、预览、测试邮箱试发，以及投递详情里的 letter-preview；PATCH 投递加可选 template_id，详情响应加 letter_templates；outbox 加只试一次的 recruitment.test 和 lastError；ownership.json 加 mail_templates 的归属与用途、7 条新流程，重新生成目录；legacy-database 测试的表清单与种子标记补上新表和 mail_templates_v1。
- 结果：tests/server/mail-templates.test.ts 36 项通过（增删改查与权限、未知变量被拒、转义与恶意链接、预览不入队不写投递记录、试发只发一封且投递与审核记录行数不变、试发限流、不同模板主题正文不同、template_id 类别不符被拒）；tests/server + tests/tooling 全量重跑中的目录与 legacy-database 失败已修，tests/tooling 与 legacy-database 与两个 mail-template 测试共 40 个文件 882 项通过；pnpm check:catalog 通过（5 应用 293 方法路径 69 表）；服务端 tsc 通过。
- 下一步：控制台模板页、实时预览、测试邮箱试发区与投递详情里的模板选择，然后文档
