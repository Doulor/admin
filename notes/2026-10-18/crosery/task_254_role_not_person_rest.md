# task/254/role_not_person_rest · crosery · 2026-10-18

负责人：crosery

## 02:23:39 +08:00 · 开工 · #254 · 从 origin/stage 3f8c98604dc4 建 task/254/role_not_person_rest

- 执行者：agent-claude-geek-main-254b（Claude Code，claude-sonnet-5-5）
- 做了什么：node scripts/task.mjs start 254 role_not_person_rest：建分支与 worktree .claude/worktrees/task-254，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 02:29:57 +08:00 · 开发 · #254 · 剩余的所有者与个人名字一并改完，附文档核对

- 执行者：agent-claude-geek-main-254b（Claude Code，claude-sonnet-5-5）
- 做了什么：scripts、.github/workflows、deploy/env、docs/design|services|architecture|decisions|ops|reviews|plan、README、app 里的注释与测试：表示授权人或要求出处的「所有者」改为「维护者」；GitHub 组织所有者这个产品里的角色名（控制台、称号说明、人员页）、分支所有者、数据所有者、版权所有者保持原样；tests/tooling 里示例用户名 crosery、Crosery 改为 alice、Alice，STATIC_CDN_BUCKET 的真实桶名 crosery 保持。文档核对：docs/ops/DEPLOY.md 不用改——deploy/env/.env.preview 只改了一句注释里的称呼，部署事实没变。文档核对：docs/ops/ENVIRONMENTS.md 不用改——没有改任何变量与取值。文档核对：docs/ops/CICD.md 不用改——只改了五个工作流里注释与摘要里的称呼，没有改触发条件与步骤。文档核对：docs/services/server/ 不用改——只改了 mailer.ts、recruitment.ts、apply.ts 的注释。文档核对：docs/services/web/ 不用改——只改了 PromoPlayer.tsx、props.ts 的注释。文档核对：docs/services/forum/ 不用改——只改了 local-curation.ts 的注释
- 结果：check:docs、check:notes、check:secrets、check:boundaries、typecheck 通过；tests/tooling 28 个文件 525 个测试通过（本机 pnpm install --ignore-scripts 后运行）；check:doc-sync 见下一条

## 02:30:20 +08:00 · 开发 · #254 · 补写文档核对（分隔符用「；」）

- 执行者：agent-claude-geek-main-254b（Claude Code，claude-sonnet-5-5）
- 做了什么：上一条的文档核对用「。」分隔，检查脚本只认「；」，所以重写一遍。文档核对：docs/ops/CICD.md 不用改——五个工作流只改了注释与摘要里的称呼，没有改触发条件与步骤；文档核对：docs/ops/DEPLOY.md 不用改——deploy/env/.env.preview 只改了一句注释，部署事实没变；文档核对：docs/ops/ENVIRONMENTS.md 不用改——没有改任何变量与取值；文档核对：docs/services/server/ 不用改——只改了 mailer.ts、recruitment.ts、apply.ts 的注释；文档核对：docs/services/web/ 不用改——只改了 PromoPlayer.tsx、props.ts 的注释；文档核对：docs/services/forum/ 不用改——只改了 local-curation.ts 的注释
- 结果：check:doc-sync 见下一步输出

## 02:53:58 +08:00 · 开发 · #254 · 去掉「维护者」这个角色词，授权句直接写条件；补改评审指出的三处漏改

- 执行者：agent-claude-geek-main-254b（Claude Code，claude-sonnet-5-5）
- 做了什么：上一轮把「所有者」换成「维护者」，只是换了个称呼，规则没有因此更清楚；PROJECT.md 新增的「维护者」一节还给授权加了「必须在评论里留痕」这条原本没有的要求。这一轮删掉那一节，授权、验收、批准的句子直接写需要什么，例如「创建发布 tag 需要对该版本号的明确授权」「正式 tag 还需要在预发布环境对同一提交的验收记录」；带出处的「维护者 日期：「原话」」只留日期和原话；基线里原有的「维护者机器部署」小节名和运维用法的「维护者」不动，scripts/deploy-manual.mjs 校验批准评论作者是仓库管理员的条件照旧写在脚本和 CICD 里。补改评审指出的漏改：.agents/skills/code-review/SKILL.md 的「所有者 2026-09-26」、scripts/check-branch-invariants.mjs 的示例 dev/crosery、scripts/note.mjs 的示例 human-crosery。更正上一条「开发」记录里「一并改完」的说法：当时这三处没改，这一条补上。docs/handovers/2026-09-13-geek-main-handover.md 是带日期的交接记录，不改写。
- 结果：docs/INDEX.md 重新生成；check:docs、docs-index --check、check-boundaries、check-secrets、check-branch-invariants 通过；tests/tooling 28 个文件 525 个测试通过；check-doc-sync 在提交后再跑一次
