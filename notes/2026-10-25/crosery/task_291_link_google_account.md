# task/291/link_google_account · crosery · 2026-10-25

负责人：crosery

## 16:11:12 +08:00 · 开工 · #291 · 开工：资料窗口绑定 Google 会新建账号（P0）

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者 15:28 追加 P0：资料窗口里绑定谷歌之后是新创建了账号；据此建 issue #291（正文引原话），从 gitlab/stage cabb3625 拉 task/291/link_google_account 与独立 worktree；读 ProfileCard.tsx、routes/identity/google.ts、lib/identity-store.ts 定位原因，读 docs/plan/UNIFIED-LOGIN.md「绑定与解绑」取既定接口
- 结果：原因：资料窗口的「绑定」链到 /auth/google（登录入口），回调一律 signInWithGoogle，sub 没绑过任何账号时 signInSecondChannel 建新账号并换会话；规划文档已定的 POST /api/identity/link 没有实现
- 下一步：先在隔离栈（假 Google）上用 stage 代码复现，再按规划文档的接口实现绑定，先写失败用例

## 16:11:12 +08:00 · 开发 · #291 · 开发：POST /api/identity/link 与回调的绑定分支，资料窗口按钮改走接口

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：服务端：POST /api/identity/link（要登录、10 分钟内登录过、每账号每分钟 10 次，签名 cookie kind=google-link 带账号与会话指纹，回 authorize_url）、回调的绑定分支（核对会话，identity.linkGoogle，不登录不建号不换会话，结果 ?link=<结果>&provider=google）；官网：ProfileCard 的「绑定」改按钮，linkNotice.ts 写结果说明，YugcOs 读参数打开资料窗口；补接口与页面用例；同步 5 份文档与流程登记
- 结果：改前在隔离栈（stage 代码）复现：点绑定后用户数 1→2、回调下发新 sid、浏览器里变成新账号 yz_batnmxxg；改后同样操作用户数不变、会话不变、identities 多一条 google；服务端 signin-methods 51 条、官网 portal-profile-card 20 条通过
- 下一步：补影响声明与目录、跑全套门禁、提交，再写 MR

## 16:11:12 +08:00 · 提交 · #291 · 提交：绑定修复、影响声明与目录

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 2f2a41ac（接口、回调、官网按钮、用例与 5 份文档）、49e222c4 与 12873771（影响声明、ownership.json 登记 identity.account.link 流程、重新生成项目目录）。文档核对：docs/services/server/endpoint-contracts.md、docs/architecture/API.md、docs/services/server/README.md、docs/services/web/portal.md、docs/plan/UNIFIED-LOGIN.md 都已改；docs/architecture/SECURITY.md 不用改——OAuth state 的写法与日志规则没变，只是多了一种 kind
- 结果：宏观对齐通过：#291，26 个变更文件，37 个关联节点；门禁：vitest tests/server tests/web tests/tooling 116 个文件 1868 条通过，typecheck、catalog、architecture、doc-sync、docs、secrets、boundaries 全部通过
- 下一步：推送分支，开 MR，写审查结论
