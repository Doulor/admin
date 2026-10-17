# task/254/role_not_person · crosery · 2026-10-18

负责人：crosery

## 01:50:51 +08:00 · 开工 · #254 · 从 origin/stage d5fbff41f82a 建 task/254/role_not_person

- 执行者：agent-claude-geek-main-254（Claude Code，claude-sonnet-5-5）
- 做了什么：node scripts/task.mjs start 254 role_not_person：建分支与 worktree .claude/worktrees/task-254，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 01:54:30 +08:00 · 开发 · #254 · 规范文档去掉个人名字，授权角色统一写维护者

- 执行者：agent-claude-geek-main-254（Claude Code，claude-sonnet-5-5）
- 做了什么：AGENTS.md、docs/conventions 全部、docs/ops 的 CICD、DEPLOY、ENVIRONMENTS 里表示授权人的「所有者」改为「维护者」，保留「分支所有者」；个人名字与示例用户名（dev/crosery、NOTES 示例）改为 alice 或 <用户名> 占位；PROJECT.md 新增「维护者」一节，定义为仓库管理员，因为 deploy-manual.mjs 校验批准评论作者 permission 为 admin，写成写权限会与脚本不一致；issue-gate.mjs 的提示改为先问维护者。未动：docs/history、tests、notes、.github/workflows、scripts 里的其它所有者文案、design 与 services 文档、域名里的 crosery
- 结果：check:docs、check:doc-sync、check:notes（77 条链路）、check:secrets、check:boundaries 通过，docs-index 已重新生成；AGENTS.md 与 docs/conventions 内除域名外无个人名字；vitest 本机未跑（原生依赖装不上），由 CI 覆盖。文档核对：docs/services/web/ 不用改——没有改 app/ 下任何模块
