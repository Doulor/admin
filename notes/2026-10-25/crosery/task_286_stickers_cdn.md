# task/286/stickers_cdn · crosery · 2026-10-25

负责人：crosery

## 12:58:02 +08:00 · 开工 · #286 · forum 表情走受控 CDN 与原创扩包

- 执行者：agent-claude-geek-main-completion（Claude Code，claude-sonnet-5-5）
- 做了什么：从 GitLab stage 130a58b8（rc.22）建 task/286/stickers_cdn 与独立 worktree .claude/worktrees/task-286；GitHub origin/stage 落后 378 个提交，所以基线取 GitLab
- 结果：worktree 已建；依据：Crosery 2026-10-25 12:52 接手指令，issue #286 已在 GitLab 建立并写入所有者确认
- 下一步：装依赖后按 issue 验收条件实现

## 14:02:23 +08:00 · 提交 · #286 · 表情包按清单播种，加一个包只要加一个目录

- 执行者：agent-claude-geek-main-stickers（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 feat(server)：新增 scripts/sticker-manifest.mjs（write/check/report/urls）、app/server/assets/stickers/manifest.json 与 yugc/pack.json（24 个表情的 id、短码、名字、顺序与原来相同）、lib/sticker-manifest.ts（读并校验清单、createStickerUrl）、lib/migrations/2026-10-sticker-packs.ts（只增不改、可重复执行的补库）；forum-v2 迁移去掉写死的 24 个表情，db.ts 启动时读一次清单，config.ts 的 stickerAssetsDir 指向整个 stickers 目录，server Dockerfile 整目录复制；同提交带 forum 服务文档「表情包」一节（pack.json 格式与新增步骤）、server README 与数据模型的对应改动。文档核对：docs/services/console/README.md 不用改——控制台的表情包卡片、启停、改名、排序、上传、新建包的接口与界面都没动，新包补进库里之后照原来的接口管理。
- 结果：最终树上：tests/server/sticker-packs-migration.test.ts 11 通过、tests/server/forum-v2-migration.test.ts 6 通过、tests/tooling/sticker-manifest.test.ts 41 通过（共 58）；node scripts/sticker-manifest.mjs check 输出「manifest.json 与目录一致」；report：1 个包、24 张、506.4 KB，超过 60 KB 的 0 张。未单独构建本提交的中间状态。
- 下一步：提交 CDN 开关在服务端的读法与图片地址决策，再提交部署与上传、论坛前端白名单、宏观对齐声明

## 14:03:09 +08:00 · 提交 · #286 · 内置表情图片地址按 STATIC_CDN_BASE 给 CDN 或同源

- 执行者：agent-claude-geek-main-stickers（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 feat(server)：新增 lib/static-cdn.ts（STATIC_CDN_BASE 在服务端的读法，空或固定值，别的值启动失败），config.ts 读它，services.ts 把按开关建好的地址函数交给 forum-store；forum-store 的公开列表、控制台列表和表情回应共用这一个地址函数，没传时仍是同源；middleware/http-policy.ts 对 /api/forum/stickers/ 下 200 的响应不再覆盖成 no-store（原来把路由自己发的一年 immutable 盖掉了，404 与列表接口仍是 no-store）。同提交带接口合同、API 总表、server README 与 forum 服务文档里地址与缓存头的说明。文档核对：docs/services/console/README.md 不用改——控制台表情列表的 url 字段由服务端按同一规则给，页面只是把它放进 img。
- 结果：最终树上：tests/server/forum-sticker-cdn.test.ts 11 通过（开关关闭全同源；打开时内置走 CDN、站长上传的同源；一年 immutable；列表仍 no-store）、tests/tooling/static-cdn-parity.test.ts 23 通过（服务端与 scripts/static-cdn-base.mjs 的开关规则逐项一致）、tests/server/forum-v2-endpoints.test.ts 32 通过（共 66）。未单独构建本提交的中间状态。
- 下一步：提交 server 镜像接 STATIC_CDN_BASE 与 CDN 上传带上表情图片，再提交论坛前端白名单、宏观对齐声明
