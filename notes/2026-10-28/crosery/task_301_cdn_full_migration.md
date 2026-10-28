# task/301/cdn_full_migration · crosery · 2026-10-28

负责人：crosery

## 08:04:16 +08:00 · 开工 · #301 · task/301 开工：站点资源与备份全量迁到新 CDN

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：GitLab #301（基于所有者 2026-10-28 07:40、07:50 的原话「请全量迁移到新cdn，然后弄好之后差不多可以发正式了」）；预发布 rc.26 因边缘 CSP 没放行新 CDN 而同源构建。08:00 已在香港 Caddy 的预发布站点 CSP 里增加新 CDN 前缀（备份 yzgc.caddy.bak-20261028-csp，caddy validate 通过后 reload，四个入口仍 200）。从 stage 2817af00 建 task/301/cdn_full_migration 与 worktree。
- 结果：worktree 已建；CSP 放行已生效，等下一个 rc 验证 cdn-plan 翻到 CDN 模式。

## 08:04:16 +08:00 · 提交 · #301 · 改正过期的 CDN 与备份文档并更新合同测试断言

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：docs/ops/STORAGE-CDN.md 的「是/不是」表、geek-backup 行、明确不做；docs/ops/DEPLOY.md 的香港对象存储一节；.env.example 的 MAIL_ASSET_BASE 示例；tests/tooling/storage-cdn-config.test.ts 断言改为写明归档器路径且旧说法已删；新增 docs/changes/301.json。文档核对：STORAGE-CDN.md、DEPLOY.md 已改。
- 结果：待跑 pnpm check 与相关测试。
