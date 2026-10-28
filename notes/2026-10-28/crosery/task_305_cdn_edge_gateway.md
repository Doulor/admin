# task/305/cdn_edge_gateway · crosery · 2026-10-28

负责人：crosery

## 12:59:45 +08:00 · 开工 · #305 · task/305 开工：Garage CDN 经主站香港 Caddy 反代

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：GitLab #305（所有者在上一个会话里选定「主站反代并切换」，授权主站 Caddy 配置与 cdn 的 A 记录唯一一处切换）。上一个会话（omp k3.1-pro）在编号撞车的 GitHub #278 上做了未提交的实现，并已在主站安装 /etc/caddy/sites/storage-cdn-edge.caddy、validate 后 reload；本单改挂到 GitLab #305，从 stage a5cb5a9c 新建 task/305/cdn_edge_gateway 与 worktree，搬入 deploy/storage-cdn/edge.caddy、文档与测试，编号改成 305，旧 278.json 保持原样。
- 结果：worktree 已建；主站 Caddy 已 active；cdn 的 A 记录仍是 103.240.197.216，等所有者登录 DNSPod 后切换

## 13:05:31 +08:00 · 提交 · #305 · 边缘反代配置、文档与合同测试

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 851e90d7：deploy/storage-cdn/edge.caddy（保留 Host、路径、查询串与 Authorization，固定 IP 回源并指定 SNI）、STORAGE-CDN 与 DEPLOY 的安装顺序/回滚值、storage-cdn-config 测试 12 个用例。随后合入 stage 5947bdeb 并重新生成项目目录，声明补目录覆盖项。文档核对：docs/ops/ENVIRONMENTS.md、CICD.md 不用改——环境变量与发布流程没有变化，只是 CDN 公网入口多了一层主站反代。
- 结果：storage-cdn-config 12 个用例通过；docs/doc-sync/secrets/catalog/architecture(#305)/boundaries/site-config/environments 逐项通过；主站 Caddy 已 active（上一个会话安装并 validate 后 reload）
