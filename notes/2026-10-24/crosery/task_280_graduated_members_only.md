# task/280/graduated_members_only · crosery · 2026-10-24

负责人：crosery

## 22:37:59 +08:00 · 开工 · #280 · #280 验收后修正：已毕业可选、只拦成员

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：所有者 22:05 在补资料页截图上说「少了一个已毕业，年级里面必须包含已毕业，而且必须是极客班成员才要填这些」；重开 #280，从 stage 19c5db46 拉 task/280/graduated_members_only。
- 结果：范围：年级下拉框加已毕业；补资料关口只拦权限等级是成员或往届成员的账号；邮箱注册只有填了邀请码才要实名。
- 下一步：改服务端和控制台、更新用例和文档、提交、开 MR。

## 22:38:13 +08:00 · 提交 · #280 · 提交 fb386a9b

- 执行者：agent-claude-geek-main-3c2a7a67（Claude Code 主会话，claude-opus-5-5）
- 做了什么：提交年级加已毕业、补资料只拦成员和往届成员、邮箱注册按邀请码决定要不要实名，用例和文档同步。
- 结果：vitest 357 个全过（real-info、grade、signin-methods、device-flow、oidc、bearer-auth、console-users、tests/console、portal-account、portal-profile-card）；server tsc、console vue-tsc 通过；check-architecture、check-doc-sync、check:secrets、check:docs 通过。
- 下一步：推到 GitLab，开 MR，作者自审。
