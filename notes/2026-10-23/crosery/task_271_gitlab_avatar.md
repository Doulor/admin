# task/271/gitlab_avatar · crosery · 2026-10-23

负责人：crosery

## 17:08:31 +08:00 · 开工 · #271 · #271 同步到 GitLab 的账号补上头像

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：所有者 16:54 让把 #270 头像这一项修完；按 ISSUES §2 开续作 #271（Refs #270）；GitHub 账号停用，task.mjs start 用不了 gh，改用 git worktree：把同在 cfb9b0fb 的 merge-270 工作区移成 .claude/worktrees/task-271，从 stage cfb9b0fb 拉 task/271/gitlab_avatar
- 结果：工作区干净，HEAD cfb9b0fb；GitLab issue #271 已建（标签 bug、P2、server、admin、func:api、func:data、func:external）
- 下一步：改 gitlab-sync.ts：要 256 像素的 GitHub 头像，200 KiB 上限，按类型取文件名，检查 PUT 返回码，失败下一轮重试，已有账号补传

## 17:20:40 +08:00 · 提交 · #271 · 提交 5d927747：头像改成单独的 set_avatar，256 像素、200 KiB 上限、失败重试、补传

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：gitlab-sync.ts 加 avatarSource/setAvatar 与动作 set_avatar，建号不再顺带传头像；db.ts 给 gitlab_accounts 加 avatar_source；控制台合同、文字、样板数据跟着加；oidc.md、数据模型、接口合同、控制台契约、ownership.json、271.json，项目目录重新生成；测试新增 3 条、改 6 处期望
- 结果：check 九项、check-doc-sync 与 check-architecture（--base cfb9b0fb）通过；typecheck 通过；pnpm test 97 个文件 1599 条通过；server、console 构建通过；上限改回 1 MB、去掉 PUT 返回码检查、去掉建号时的 set_avatar 三处改坏都有用例失败
- 下一步：两轴代码审查，开 GitLab MR

## 17:31:13 +08:00 · 审查 · #271 · 5d927747 两轴审查：有条件通过，三条应修

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：按 code-review 技能对 git diff cfb9b0fb 5d927747 起规范、需求两个只读子 agent 并行审查；需求依据 #271 正文
- 结果：需求轴：四条期望都做了，但头像超过上限、GitHub 4xx、不是图片时静默跳过还算 applied，成员页看不到原因也不再试，不满足「成员页能看到原因……直到传上去为止」。规范轴：同一条；oidc.md 说只有来源变了才盖掉 GitLab 头像，但补传和接管自动建的号时也会盖一次；不是图片的路径没有用例、假 GitLab 不校验类型。判断项：GitLab 4xx 每轮重试会每 10 分钟写一条审计；FORUM_AVATAR/GITHUB_AVATAR 名字不清、GitHub 头像地址写了两次；先读完响应再比大小；头像来源规则和 account-directory 的 picture 重复
- 下一步：返工：拿不到能传的图都记错误并重试，文档照实写覆盖时机，补用例，改常量名

## 17:31:44 +08:00 · 返工 · #271 · 返工 5ae01174：拿不到能传的图也记错误重试，文档照实写覆盖时机

- 执行者：agent-claude-geek-main-8f7d12b7（Claude Code，claude-opus-5-5）
- 做了什么：avatarFor 改成拿不到能传的图都抛错（avatar_too_large、github_avatar_ 加状态码、github_avatar_not_image、forum_avatar_missing），GitLab 回 200 才写 avatar_source；控制台加三种说法；oidc.md 与模块注释写明补传、接管自动建的号时会盖掉一次；常量改名、GitHub 头像地址只写一处；假 GitLab 校验图片类型与扩展名，补不是图片、论坛图不在了的用例；271.json 跟着改，项目目录重新生成
- 结果：合并人自己逐行复核 git diff 5d927747 5ae01174，三条应修都落实；check 九项、check-doc-sync、check-architecture 通过；typecheck 通过；pnpm test 1599 条通过；两个构建通过；去掉图片类型检查、上限改回 1 MB、去掉 PUT 返回码检查都有用例失败。判断留着不改：GitLab 4xx 照样重试（issue 要求直到传上去为止，持续失败每轮一条审计和其它失败一致）；先读完响应再比大小（256 像素的图很小）；头像来源规则和 account-directory 的 picture 形式不同（一个是对外地址），不合并
- 下一步：推分支、开 GitLab MR !4
