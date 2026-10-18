# task/237/sso_plan · crosery · 2026-10-19

负责人：crosery

## 00:47:42 +08:00 · 开工 · #237 · 接手统一登录的业务契约与后续授权方案

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：读取 #237 和 #242 当前正文、追踪记录、ADR 与认证实现；核对干净 worktree 的 head b358adcc；按所有者本轮宏观业务颗粒度要求审查数据库、接口与三端表现的对应关系
- 结果：PR 当前只交付方案，内部身份与对外 OAuth/OIDC 尚未实现；需要补全业务级交付、主体稳定性与迁移规则；本轮推送现有 PR，不合并、不建新 issue
- 下一步：按统一账号登录、渠道管理、应用授权三项业务能力补全跨层契约与验收矩阵

## 01:27:12 +08:00 · 返工 · #237 · 统一登录方案按三项完整业务交付对齐

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：将数据库地基与切读步骤归入统一账号登录业务；补渠道管理、对外 OIDC 的数据/API/UI 验收表；禁止邮箱自动合并，保留最后一个 GitHub 资格核验身份；持久化 sector-sub 映射并阻止已对外授权账号自动合并；区分既有 sid 与尚未实施的 SSO 方案
- 结果：OpenID Connect Core 与 RFC 9700 官方正文已核对；pnpm verify 在 Node 22.23.2/pnpm 9.15.9 与独立 Node 26/pnpm 11.24.0 下退出 0：核心 73 文件 1079 条、论坛 30 文件 548 条，三端构建与 61 路由静态生成通过；本次不改 app，不建新 issue，不合并

## 01:27:13 +08:00 · 提交 · #237 · 提交统一登录与应用授权的业务合同

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：提交 ADR-0005 与本轮执行记录，Refs #237
- 结果：完整 pnpm verify 通过；方案仍为 proposed，真实 OAuth 与内部身份迁移未实施，不能当作运行验收

## 01:45:05 +08:00 · 推送 · #237 · 已将 SSO 业务合同提交推送到原 PR 分支

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：git push 原 fork 的 task/237/sso_plan，未 force push
- 结果：98fed0d8946e527aa51192a4c6f84501f41691d3 已到 PR #242；随后发现上游 stage 已推进至 1293f892，PR mergeStateStatus=DIRTY，需要同步新项目目录门禁

## 01:45:05 +08:00 · 方案 · #237 · 同步 stage 的架构目录与宏观对齐门禁

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：完整补读当前 stage 的九份规范及 ARCHITECTURE-ALIGNMENT、项目地图检索入口和身份流程；计划只同步基线到 PR 分支并补 docs/changes/237.json
- 结果：确认新门禁要求每个 PR 的八维影响声明与十段正文；不将 proposed 的身份表和 OAuth 接口登记为当前运行实体，不将 PR 合入 stage

## 02:24:18 +08:00 · 开发 · #237 · 统一登录方案完成新目录门禁适配

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：以 c5ed145 同步 stage 1293f892，文档和执行记录索引冲突均通过生成器解决；新增 docs/changes/237.json，关联现有 identity/organization/audit/platform 及四条身份流程；未来身份表和授权端点不登记为当前实体
- 结果：最新基线 pnpm verify 退出0：79文件1229条核心测试、30文件548条论坛测试、构建与61路由生成通过；check:architecture通过12个变更文件、7个关联节点，check:catalog通过

## 02:24:18 +08:00 · 提交 · #237 · 提交 SSO 宏观影响声明

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：提交方案八维影响声明与基线同步后的真实验证记录
- 结果：声明只描述方案与导航变化；运行时接口、权限、数据和交付保持，不合并PR；当前提交CI与所有者方案验收仍待完成

## 02:53:37 +08:00 · 审查 · #237 · 两轴复查与 step-up 状态合同修正

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：Standards 复核 c5ed145 与 237.json 通过；Spec 复核 b358adcc..98fed0d 确认原两项缺口修复，并指出 step-up 过期回401会触发控制台全站退出。已改为403 step_up_required，仅主会话失效用401，并补该场景验收条件
- 结果：主代理对照 app/console/src/lib/http.ts 的401处理核对；文档未改运行实现；修订后 pnpm verify 再次退出0，核心1229、论坛548、构建与61路由生成通过

## 02:53:37 +08:00 · 提交 · #237 · 明确重认证过期不等于主会话退出

- 执行者：agent-codex-geek-followup（Codex，PR 持续跟进）
- 做了什么：提交 ADR 的403/401语义与独立审查复核记录
- 结果：没有未决设计审查条目；最新提交的GitHub检查与所有者方案确认仍待完成，PR保持不合并
