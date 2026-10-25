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

## 14:05:50 +08:00 · 提交 · #286 · 宏观对齐声明、新文件归属与重新生成的项目目录

- 执行者：agent-claude-geek-main-stickers（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 docs(docs)：新增 docs/changes/286.json（8 个评估维度、全部变更路径的 coverage；db.ts 与 http-policy.ts 是各业务域共用的文件，按目录的文件级归属声明了全部相关业务域和对应流程，实际只改了清单读取与缓存头）；ownership.json 登记 sticker-manifest.ts、2026-10-sticker-packs.ts、static-cdn.ts 三个新增服务端文件的归属，给 forum.stickers.list 与 forum.stickers.read_file 补证据锚点、响应说明和测试链接；其余目录文件由 pnpm catalog:generate 重新生成。本机 origin/stage 落后 GitLab stage，检查时用 --base gitlab/stage。
- 结果：node scripts/check-architecture.mjs --base gitlab/stage：宏观对齐通过，50 个变更文件、95 个关联节点；pnpm check:catalog：项目目录核对通过，来源摘要 870db0b5；node scripts/check-doc-sync.mjs：通过；pnpm typecheck 通过；tests/server 与 tests/tooling 全量此前跑出 1 个失败（tests/server/forum.test.ts 的临时副本缺 sticker-url.ts），已在论坛前端提交里修复并单跑 60 通过。pnpm check:notes 报 notes/2026-10-24/crosery/task_276_forum_image_scan.md:47 链路已收尾后又有记录，这条是基线上的旧记录，不在本任务改动里，未处理。
- 下一步：最终树上再跑一遍门禁，然后向主控回报

## 14:43:57 +08:00 · 提交 · #286 · 内置表情包增加「极客日常」「聊天回应」两个包

- 执行者：agent-claude-geek-main-stickers（Claude Code，claude-sonnet-5-5）
- 做了什么：提交 feat(server)：把美术交付的两个表情包（.tools/yugc-v2/stickers2/packs/ 下的 geekdaily、chatreply，各 16 张 256×256 透明底 WebP）按 #286 的机制加进 app/server/assets/stickers/：目录名就是包 id，图片改名为 <表情 id>.webp（文件名去掉序号、下划线换成连字符，如 05_ci_pass 是 ci-pass），pack.json 写 id、name（极客日常、聊天回应）、description（美术原文）、order（极客娘 0，极客日常 1，聊天回应 2）和 stickers 的 id 与 label（label 取美术的 name）；美术另给的 alt、text 库里没有对应的列，没有收进来，也没有加列。manifest.json 用 node scripts/sticker-manifest.mjs write 重新生成。tests/tooling/sticker-manifest.test.ts 增加三个包的顺序与张数、两个新包各 16 张的 id 与名字、目录文件名、图片真实哈希和字节数与清单一致、短码与 [包名_名字] 写法全站不重复；tests/server/sticker-packs-migration.test.ts 增加用仓库真实目录跑的两项：新库建出三个包 56 张且库里图片字节等于文件，只有极客娘的旧库（站长改过包名、停用、改过一张的名字和排序）升级后多出两个包 32 张、极客娘的包和 24 行表情一行不动、再启动一次行数不变。同提交更新 forum 服务文档（三个包的表格、迁移测试说明、表情与回应一条）、server 数据模型里的表情行、docs/changes/286.json（新目录的 coverage 与评估说明）和重新生成的项目目录。文档核对：docs/services/console/README.md 不用改——控制台表情页读库里的包，新包进库后自动出现，页面与接口没有改动。
- 结果：node scripts/sticker-manifest.mjs check：manifest.json 与目录一致；report：共 3 个包、56 张，1401.2 KB；超过 60 KB 的 0 张（最大 36720 字节）；manifest.json 对基线 +268 行 -0 行，极客娘 24 条逐字未变，新增 32 条；与美术交付逐张核对：描述相同、表情 id 符合改名规则、label 等于美术的 name、图片字节相同。tests/tooling/sticker-manifest.test.ts 45 通过、tests/server/sticker-packs-migration.test.ts 13 通过；pnpm exec vitest run tests/server tests/tooling：86 个文件、1620 个用例全部通过；pnpm typecheck 退出码 0；node scripts/check-architecture.mjs --base gitlab/stage：宏观对齐通过，84 个变更文件、95 个关联节点；pnpm check:catalog 通过，来源摘要 d26362e0；node scripts/check-doc-sync.mjs --base gitlab/stage 通过；node scripts/check-secrets.mjs 通过；pnpm check:docs 通过（352 篇文档）；只读 node scripts/static-cdn.mjs plan（空目录充当 web 与 forum 产物）：共 81 个文件、2.57 MiB，其中 forum/stickers/ 56 个对象、1434858 字节（1401.2 KB），加包前是 49 个文件、1.69 MiB 和 24 个对象、518514 字节。upload 没有运行（需要所有者凭据，未验证）；没有跑浏览器和 docker，控制台与论坛面板里新表情的实际显示未验证。
- 下一步：向主控回报提交号、测试数字、plan 数字，以及白名单正则、CSP、控制台表情页管理现状三点自查结果
