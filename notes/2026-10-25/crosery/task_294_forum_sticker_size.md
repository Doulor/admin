# task/294/forum_sticker_size · crosery · 2026-10-25

负责人：crosery

## 19:19:24 +08:00 · 开工 · #294 · 开工：论坛表情改成与文字同行、底部对齐

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者 2026-10-25 18:57 带截图报「表情包太大了」，要快速修复去发版；查明回复框里表情的样式只认同源地址，#286 起内置表情走 CDN 地址后失效，表情按原图 256px 撑满回复框，帖子里写死 4rem；建 issue #294（所有者原话为确认依据）；从 gitlab/stage ac9f9e86 建 worktree task-294、分支 task/294/forum_sticker_size；本条在改完代码后补记，建 issue 和 worktree 在 19:04 前后
- 结果：https://git.yangtzeu.work/geek/admin/-/work_items/294；改前的预发布 rc.24 截图与尺寸实测已留（回复框表情 256x256、帖子表情 64x64，字号 15 与 16）
- 下一步：按所有者对大小的回答改共享样式模块、单测、文档与影响声明，推送开 MR

## 19:19:24 +08:00 · 开发 · #294 · 开发：表情两个字高，底部对齐文字底部

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：所有者在大小的选项里没有选档，回答「你去学习b站的……不一定需要文字和表情包一样大，但是底部需要对齐」；用 ego-browser 只读量了 B 站视频评论区：表情 40px 图显示成 21px，正文 15px，vertical-align: text-bottom；据此新增 shared/sticker-css.ts，一条规则同时管帖子的 .forum-sticker 和回复框里同源或 CDN 地址的表情图片，两个字高、text-bottom，地址前缀取自 sticker-url.ts 的白名单常量；uno.config.ts 带上它，去掉写死的 4rem 与 3rem；论坛文档与 ADOPTION.json 里的尺寸说明同步
- 结果：app/forum 新增 tests/sticker-size-css.test.ts 4 条，与表情相关的论坛单测 151 条通过；00:51 所有者看 23px 说过「还是很模糊」，所以取两个字高而不是一个字高，已写进文档
- 下一步：跑门禁，推送并开 MR，预发布取改后截图

## 19:19:24 +08:00 · 提交 · #294 · 提交：表情尺寸修复、影响声明与目录

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 fix(forum) 表情样式、docs(changes) 影响声明、docs(catalog) 把规则登记进「读表情包列表」流程的证据并重新生成目录
- 结果：check-architecture 通过：#294，13 个变更文件，3 个关联节点
- 下一步：门禁全绿后推送开 MR，写审查记录
