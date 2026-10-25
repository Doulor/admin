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

## 14:12:48 +08:00 · 提交 · #285 · 控制台邮件模板页、实时预览、测试邮箱试发与投递详情里的模板选择

- 执行者：agent-claude-geek-main-mail（Claude Code，claude-sonnet-5-5）
- 做了什么：新增控制台页 /console/mail-templates（节点 mail.template.manage）：左边按类别列出模板，可启停、设默认、复制、删除；右边是编辑区（名称、主题、预览摘要、抬头、正文块的增删移与调序、按钮、页脚、变量速查表点一下插入到光标处）、实时预览（停手 400 毫秒后请求，过期响应丢弃，渲染不出来时保留上一版并把服务端指出的问题标在对应输入框下）、测试邮箱试发区；预览放在不带任何权限的 iframe（sandbox、srcdoc）里。投递详情里这一类有两套以上启用的模板时出现『用哪一套信』下拉框和『预览这封信』，请求只在选了非默认模板时带 template_id。导航、路由、权限节点说法、操作记录说法、开发预览数据同步更新；ownership.json 给新增的控制台文件和相关流程补了归属与证据。
- 结果：tests/console 21 个文件 295 项通过，其中新增 tests/console/mail-templates.test.ts 43 项（草稿与请求体互转、变量插入、问题标到输入框、预览防抖与过期响应、试发结果、开发预览数据的权限与只读）和 applications.test.ts 新增 8 项（模板下拉框、template_id 规则、预览请求体、template_invalid 的位置）；pnpm --filter @yzgc/console typecheck 通过；pnpm check:catalog 通过（5 应用 293 方法路径 69 表）；tests/tooling 37 个文件 822 项通过。没有在真实浏览器里看过页面，布局和 iframe 在生产 CSP 下的显示都还没有验证。
- 下一步：更新 server 与 console 的服务文档、API 与接口契约，补 docs/changes/285.json

## 14:51:23 +08:00 · 提交 · #285 · 补全邮件模板接口合同：改状态接口挂响应 Schema、试发响应补 pending、内容体积用例

- 执行者：agent-claude-geek-main-mail（Claude Code，claude-sonnet-5-5）
- 做了什么：contracts.ts 给 PATCH /api/console/applications/:application_id 补响应 Schema（application、review 用开放对象原样保留，失败体用控制台共同的开放形状）：新增可选的 template_id 让这条接口的合同变了，目录要求变了的接口要有响应 Schema；template-contract.ts 的试发响应状态补上 pending（入队后还没发出时回这个值）；template-content.ts 总字数上限的注释改成实测数字（用满上限约 33KB，全是要转义的 & 时约 45KB）；tests/server 新增 2 个用例：模板文字用满上限、投递内容取最长时渲染结果仍小于 102KB；改状态接口的成功体、409、400 失败体的字段与详情接口一致（临时把 application 的 Schema 改成只含 id，这个用例会失败，说明它能发现字段丢失，已改回）。
- 结果：tests/server/mail-templates.test.ts 37 项、mail-template-content.test.ts 16 项、applications.test.ts 24 项通过；tests/server、tests/console、tests/tooling 全量 104 个文件 1865 项通过；pnpm typecheck 退出码 0。
- 下一步：文档与目录重新生成、docs/changes/285.json 和宏观对齐检查，随后收尾提交。

## 14:52:42 +08:00 · 提交 · #285 · 邮件模板的文档、项目目录与宏观对齐声明

- 执行者：agent-claude-geek-main-mail（Claude Code，claude-sonnet-5-5）
- 做了什么：文档：mail.md 新增『邮件模板』一节并更新现状、接口、隐私、安全、验证、已知限制；data-model.md 登记 mail_templates 与迁移；endpoint-contracts.md、API.md 登记 7 个接口（改状态接口补写响应 Schema 已挂载）；SECURITY.md 补招聘邮件模板与试发的防滥用段；server、console 服务文档补页面、组件、权限节点和开发预览数据；docs/INDEX.md 由 docs:index 重新生成。目录：ownership.json 补迁移文件的模块归属，给 mail.template.* 与 application.letter_preview 流程补 db.ts、权限节点、接口合同、路由注册、控制台共享文件的证据和 3 个测试文件，pnpm catalog:generate 重新生成。docs/changes/285.json 写宏观对齐声明。
- 结果：pnpm check:docs、check:doc-sync（对 130a58b8）、check:catalog、check:architecture（对 130a58b8，55 个变更文件）、check:boundaries、check:secrets 退出码都是 0，pnpm typecheck 退出码 0。pnpm check:notes 失败在 notes/2026-10-24/crosery/task_276_forum_image_scan.md:47（链路已收尾后还有记录）：用 git archive 导出 130a58b8 的 notes 和 scripts 单独跑，同样失败，这份文件本分支没改过，不属于 #285，没有动它。
- 下一步：无；剩下的是浏览器里的人工验收（1440×900 与 390×844）和所有者在预发布环境的验收。
