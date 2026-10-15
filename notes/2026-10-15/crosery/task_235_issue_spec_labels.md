# task/235/issue_spec_labels · crosery · 2026-10-15

负责人：crosery

## 14:54:36 +08:00 · 开工 · #235 · 从 origin/stage 471d3dbfda3e 建 task/235/issue_spec_labels

- 执行者：agent-claude-geek-main-01（Claude Code，claude-sonnet-5-5）
- 做了什么：node scripts/task.mjs start 235 issue_spec_labels：建分支与 worktree .claude/worktrees/task-235，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 15:02:43 +08:00 · 开发 · #235 · 标签脚本、提单检查、pr-contract 按组核对、task.mjs 开工拦截与规范文档

- 执行者：agent-claude-geek-main-01（Claude Code，claude-sonnet-5-5）
- 做了什么：新增 scripts/issue-labels.mjs、scripts/issue-gate.mjs、.github/workflows/issue-gate.yml；改 pr-contract.mjs、issue-lifecycle.yml、task.mjs、三份模板、ISSUES/PULL-REQUESTS/CONTRIBUTING/TRACKING/CODE-REVIEW/TESTING/CICD/AGENTS；文档核对：docs/ops/CICD.md 已改
- 结果：tests/tooling 27 个文件 510 项通过；check:docs、check:doc-sync、check:notes、check:secrets 通过；issue-gate 试运行（无 --apply）输出正确；未验证：pnpm typecheck（本机 Node 26 装不上 better-sqlite3）、issue-gate 的 --apply 与工作流真实触发、actionlint（未安装）
- 下一步：等授权后提交、推送、开 PR

## 15:11:49 +08:00 · 方案 · #235 · 明确组织成员权限边界与 Crosery 唯一合并权，收敛 CLI/API 建单指引

- 执行者：agent-claude-geek-main-01（Claude Code，gemini-3.8-flash-high）
- 做了什么：两名 subagent 完成盲测；确认组织内成员有日常建单/打标签权限，明确所有合并进 stage/main 操作一律且只能由 Crosery 亲自执行；规范写入 AGENTS.md/BRANCHING/CODE-REVIEW/CONTRIBUTING；ISSUES.md 补全 CLI/API 规范；文档核对：docs/ops/CICD.md 已改
- 结果：subagent 盲测验证规则可读性；全套 510 项 tooling 测试与 check:docs/doc-sync/notes/secrets 全绿
- 下一步：提交并在得到授权后推送开 PR

## 15:13:31 +08:00 · 提交 · #235 · 实现提单查重、改动类型标签门禁、截图标注与 Crosery 唯一合并权

- 执行者：agent-claude-geek-main-01（Claude Code，gemini-3.8-flash-high）
- 做了什么：docs(tooling): issue 规范补上查重关联、改动类型标签与证明要求，明确 Crosery 唯一合并权；tests/tooling 全套 510 项通过，check:docs/doc-sync/notes/secrets 全绿
- 结果：本地测试与静态门禁全部通过

## 15:14:52 +08:00 · PR · #235 · 开 PR #236 指向 stage，填写九段正文契约

- 执行者：agent-claude-geek-main-01（Claude Code，gemini-3.8-flash-high）
- 做了什么：gh pr create: https://github.com/Yangtze-University-Geek-Class/admin/pull/236
- 结果：PR #236 开立成功，带 docs, P2, infra:tooling 标签

## 15:14:52 +08:00 · 审查 · #235 · 完成 commit 087e17e 代码与规范审查，结论通过

- 执行者：agent-claude-geek-main-01（Claude Code，gemini-3.8-flash-high）
- 做了什么：按 CODE-REVIEW.md 审查 commit 087e17e；结论已写入 PR #236 描述
- 结果：审查结论：通过
- 下一步：等待所有者 Crosery 亲自合并进 stage

## 16:34:41 +08:00 · 返工 · #235 · 修复 Codex 代码审查阻塞项，对齐 Agent 找人要图与图片上传规范

- 执行者：agent-claude-geek-main-01（Claude Code，gemini-3.8-flash-high）
- 做了什么：1. .github/workflows/issue-lifecycle.yml 的 sweep 补齐 scripts/issue-labels.mjs 稀疏检出（修复 S1 模块加载隐患）；2. scripts/issue-labels.mjs 收紧 IMAGE_RE 拒绝裸文件名与本地路径（修复 P1），PR ui:* 校验改前改后两组证据；3. checkPrTypes 对 PR 自身类型标签与覆盖进行严格校验（修复 P2）；4. scripts/task.mjs startGate 检查 needs-evidence 并对未确认详情失败关闭（修复 P3）；5. findSimilar 增加短标题完全相同直接命中支持（修复 P7）；6. 移除合并权限过度限制，恢复常规合并闭环；7. AGENTS.md 与 ISSUES.md 明确 Agent 防编造硬门禁（用户提供图片，Agent 必须负责转存上传为 GitHub 附件链接，禁止写入裸文件名或本地路径充数；缺图必须主动找用户要）；文档核对：docs/ops/CICD.md 不用改——只在 issue-lifecycle.yml 的 sweep 中补充已描述的脚本检出项，无新流程变更
- 结果：tests/tooling 27 个测试文件 512 项测试 100% 通过；check:docs/doc-sync/notes/secrets 全部通过
- 下一步：提交并推送到远端 PR #236
