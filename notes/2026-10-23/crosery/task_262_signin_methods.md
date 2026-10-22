# task/262/signin_methods · crosery · 2026-10-23

负责人：crosery

## 01:49:57 +08:00 · 开工 · #262 · 邮箱验证码与密码登录、Google 登录、邀请码注册、控制台按站内称号授权

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 2026-10-23 00:57 截图反馈「不支持邮箱登录和注册，还有就是不支持谷歌注册和登录」，01:30 定：「目前开放注册，现在的github注册的都算组织成员，后续需要邀请码去注册，在我们的admin控制台再额外加个邀请码的逻辑，默认的邀请码是…」（默认邀请码原文已本地核对，不公开，只存在钥匙串里）；邮箱「验证码和密码都支持」（密码沿用至少 15 位）；控制台「按站内称号认」，只有 GitHub 组织页面要 GitHub 会话。GitHub 账号被封、建不了 issue，按所有者 00:21「所有操作和发版以及发布都走本地」从本机 stage 候选 bba4b066 用 git worktree add 建 task/262/signin_methods（task.mjs start 要连 GitHub，不可用），挂在 #262 下
- 结果：worktree .claude/worktrees/task-262-signin，pnpm install --frozen-lockfile 通过（Node 22.23.2）
- 下一步：读身份、会话、称号、成员守卫代码，定服务端与控制台改动

## 03:20:37 +08:00 · 提交 · #262 · 提交统一登录第二、三期 33ef6ca5

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：git commit 33ef6ca5（feat(auth)，101 个文件，含生成的目录）：邮箱验证码与密码、Google、邀请码注册、账号页 /account、控制台注册邀请码页、github_session_required、运维建号命令、Google 可选凭据的部署接线，以及审查后的五处加固；文档与 docs/changes/262.json 同一提交。提交前把开工记录里所有者原话中的默认邀请码原文改成「…」（记录不写密钥，NOTES.md；原文只在钥匙串）
- 结果：提交前在工作区：pnpm check 的 check:runtime、site-config、environments、boundaries、docs、notes、secrets、catalog 均 exit 0；check-doc-sync 与 check-architecture 用 --base bba4b066 通过（本机 origin/stage 停在 4beda55e，默认基线会把 #239、#265 算进来）；pnpm typecheck exit 0；pnpm test 92 个文件 1503 例通过；pnpm build exit 0；未推送（GitHub 账号被封）

## 03:20:37 +08:00 · 审查 · #262 · 33ef6ca5 的审查：有条件通过

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：按 .agents/skills/code-review 核对 bba4b066...33ef6ca5：另起一个只读子 agent 独立审服务端登录、邀请码、密码、Google 与授权代码，我核对清单项（diff 里没有密钥、邀请码与所有者邮箱原文；两份 env 模板的 GOOGLE_* 留空；compose 只透传、镜像与卷不变；没有 || true、continue-on-error、skip ci；提交信息合规）。子 agent 报 5 条，逐条对照代码核实后全部修掉并补测试：[阻塞] GitHub 登录被组织拒绝时不更新账号记下的组织角色，被移出的提督用邮箱登录仍是提督 → recordGithubDenied 在同一事务清角色、非邀请码账号改 not_member/pending；[应修] /auth/google?invite= 的邀请码随请求日志的 url 落盘 → requestLogFields 去掉 /auth/* 的查询串；[应修] Google 两个接口没有限流、可反复试邀请码 → 20 次/分钟与 10 次/分钟；[应修] 密码节流表满 5000 条后拒绝所有人 → 挤掉最早一条；[建议] 别人替这个邮箱要码会作废本人的码 → 只作废同一浏览器上一次的挑战
- 结果：结论：有条件通过。修复后 tests/server/signin-methods.test.ts 20 例通过（新增 5 例覆盖上面五条），全量 1503 例通过。未验证：真实发信商投递验证码、真实 Google 往返（预发布没配 Google 凭据）、预发布旧库加列与新唯一索引、回滚到旧镜像后邮箱会话的表现（按代码推断）。条件：发 rc.9 后在预发布核对迁移与验证码投递，所有者验收
