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

## 14:03:41 +08:00 · 提交 · #286 · server 镜像接 STATIC_CDN_BASE，CDN 上传带上内置表情图片

- 执行者：agent-claude-geek-main-stickers（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 feat(deploy)：app/server/Dockerfile 构建阶段核对 STATIC_CDN_BASE（空或固定值，别的值构建失败）并在运行阶段写成环境变量，不新增 deploy/env 条目；deploy-preview 与 deploy-production 给三个镜像都传这个构建参数（只增参数，不放宽已有核对）；scripts/static-cdn.mjs 的 plan 与 upload 带上 forum/stickers/ 下的内置表情图片（键由图片 sha256 决定，insertOnly，同样的前缀守卫与 CDN 核对），要求清单与目录一致，plan 单独打印这个目录的对象数与字节；同提交更新 CICD、DEPLOY 与 forum 服务文档里新增表情包后的上传步骤。没有运行 upload，没有碰真实 CDN 与凭据。文档核对：docs/ops/ENVIRONMENTS.md 不用改——deploy/env 里没有新条目，开关是构建参数不是环境变量项。
- 结果：最终树上：tests/tooling/static-cdn.test.ts 109 通过、static-cdn-switch.test.ts 11 通过、static-cdn-workflows.test.ts 4 通过（共 124）；本机只读运行 node scripts/static-cdn.mjs plan（空目录充当 web 与 forum 产物）输出「共 49 个文件，1.69 MiB」「其中内置表情图片（forum/stickers/）24 个对象，518514 字节（506.4 KB）」；upload 未运行（需要所有者凭据，未验证）；CI 里 docker build 的 server 构建阶段核对未在本机跑 docker，只用 sh -c 在测试里实跑了同一段 case 判断（未验证 docker 路径）。
- 下一步：提交论坛前端白名单，再提交宏观对齐声明与重新生成的项目目录

## 14:04:21 +08:00 · 提交 · #286 · 表情图片白名单收到一处并放行受控 CDN

- 执行者：agent-claude-geek-main-stickers（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 feat(forum)：新增 app/forum/shared/sticker-url.ts，表情图片地址的白名单只此一处，只收同源 /api/forum/stickers/ 加 64 位小写十六进制哈希加 .webp，或固定 CDN 前缀 https://cdn.crosery.com/yzgc/static/site/forum/stickers/ 下同样的哈希；forum-api.ts（接口数据校验）、post-markdown.ts（帖子正文渲染与进出编辑器）、editor/inline-stickers.ts（编辑器图片块）原来各写一份，现在都从它取；进出编辑器按哈希认，开关在两次页面加载之间变了也能换回短码。tests/server/forum.test.ts 把论坛前端的 parseWriteResult 复制到临时目录来读，副本里补上新导入的 sticker-url.ts，断言不变。同提交带 forum 服务文档里白名单与进出编辑器的说明。文档核对：docs/services/web/README.md 不用改——官网没有表情图片，这次没碰 app/web。
- 结果：最终树上：app/forum 的 tests/sticker-url.test.ts 41、forum-api.test.ts 40、post-markdown.test.ts 102、inline-stickers.test.ts 4 通过（共 187）；tests/tooling/forum-sticker-url-parity.test.ts 2 通过（前端白名单与服务端、脚本给出的地址一致）；tests/server/forum.test.ts 60 通过。整份论坛套件 644 通过、1 失败：tests/site-state.test.ts 期望 6 个分类、实际 7 个（多了 c-guides「使用说明」），该文件与 app/forum/content 都不在本任务的改动里，分类来自基线 stage 的 753cdbac（#281），属基线问题，本任务没有处理。未单独构建本提交的中间状态。
- 下一步：提交宏观对齐声明、归属登记与重新生成的项目目录，再跑全部门禁
