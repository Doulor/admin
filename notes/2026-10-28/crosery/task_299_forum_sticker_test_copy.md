# task/299/forum_sticker_test_copy · crosery · 2026-10-28

负责人：crosery

## 01:29:41 +08:00 · 开工 · #299 · task/299 开工：论坛表情对照测试不依赖 .nuxt

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：GitLab #299（基于所有者 2026-10-28 01:18「这些不应该是卡点，快点弄好发版吧」）；从最新 stage 8d2ee76f 建 task/299/forum_sticker_test_copy 与 worktree。GitHub 上 stage 的 core 作业此前在 check:notes 就中断，这条测试没在 CI 跑到过；本地在无 .nuxt 的克隆里复现 TSConfckParseError（先红）。
- 结果：worktree 已建，红灯已复现。

## 01:29:41 +08:00 · 提交 · #299 · 表情对照测试从副本导入 sticker-url.ts

- 执行者：agent-claude-geek-main-fece2da2（Claude Code，claude-sonnet-5-5）
- 做了什么：tests/tooling/forum-sticker-url-parity.test.ts 在 beforeAll 把 app/forum/shared/sticker-url.ts 复制到 .tools/sticker-url-*/ 再动态导入，afterAll 删除，做法同 tests/server/forum.test.ts 的 forumWriteParser；断言一字未改；新增 docs/changes/299.json。文档核对：docs/conventions/TESTING.md 不用改——只改一条测试加载被测源文件的方式，规范里关于测试层次与证据的说法没有变化。
- 结果：同一克隆里 vitest 该文件 2 个用例通过（改前 TSConfckParseError）。
