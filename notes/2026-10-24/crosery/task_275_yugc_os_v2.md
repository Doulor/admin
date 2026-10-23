# task/275/yugc_os_v2 · crosery · 2026-10-24

负责人：crosery

## 00:43:10 +08:00 · 提交 · #275 · #275 ① 开机动画移植与进站流程，删掉旧书桌入口

- 执行者：agent-claude-geek-main-3c2a7a67-os275o（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：部分改动由被停掉的 Sonnet agent（os275）起草，我审过并改完：开机动画按原版 HTML 补齐公式小卡片、点缀物数量、跟手视差、云的淡入、窗口弹出、完整日志行，三角/箭头/心形/勾选全部改成矢量图形；起步门画回 canvas，上面盖透明按钮给键盘和读屏；静音、重播、跳过是 44px 的真实按钮；粒子按核心数和像素比自适应；首页改成按需加载开机动画和桌面，进站规则抽成 lib/bootGate.ts（北京日期、减少动态效果、?boot=1），就绪后停 0.8 秒（跳过 0.3 秒）再淡出露出桌面；埋点改成攒批发送；三维书桌、加载页、手机 3D 模型说明、旧挂画删除；three/stage.ts 仍被加入我们/论坛 3D/GitHub 场景引用，恢复保留；iPhone 模型文件仍是 tests/tooling/static-cdn.test.ts 的夹具，保留
- 结果：npx tsc -p app/web/tsconfig.json --noEmit 退出 0；pnpm typecheck 退出 0；npx vitest run tests/web：Test Files 25 passed，Tests 240 passed；pnpm build 退出 0；首屏 JS portal 8.70 kB + vendor 70.58 kB gzip（改前 portal 59.48 kB + vendor 70.58 kB），开机动画分包 BootSequence 16.93 kB gzip，桌面分包 YugcOs 32.35 kB gzip；check-boundaries 通过 270 个文件；check-site-config 通过；pnpm test 全量 4 个 tooling 测试文件失败，根因是 docs/architecture/catalog 需要 pnpm catalog:generate 重新生成（不在本任务可改范围）

## 00:44:49 +08:00 · 提交 · #275 · #275 ① 提交前重跑全量测试，更正上一条的失败数

- 执行者：agent-claude-geek-main-3c2a7a67-os275o（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：上一条写的「pnpm test 全量 4 个 tooling 测试文件失败」是恢复 iPhone 模型夹具、把 competitions.css 留在 Home.tsx（项目目录有一条证据锚点指向这行）之前的结果；两处改完后重跑
- 结果：pnpm test：Test Files 1 failed | 97 passed (98)，Tests 1 failed | 1630 passed (1631)；唯一失败是 tests/tooling/project-catalog.test.ts「keeps the checked-in directory synchronized」，pnpm check:catalog 报「项目目录缺失或过期：catalog.json、CATALOG.md、routes.md、data-model.md、permissions.md、map.html；运行 pnpm catalog:generate」，需要合并前重新生成项目目录

## 00:46:50 +08:00 · 提交 · #275 · #275 ② 删除旧吉祥物

- 执行者：agent-claude-geek-main-3c2a7a67-os275o（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按 SPEC §4.6 删除 app/web/public/mascot/ 八张姿势图、shared/ui/Mascot.tsx、shared/styles/mascot.css、app.config.json 的 mascot 段和 features.mascot/forumMascot/mascotPreview、shared/config/index.ts 里对应的类型；这几样在删之前已经没有任何引用；把验收 grep 写成 tests/web/old-character-removed.test.ts
- 结果：grep -rn 'mascot/pose-\|Mascot' app tests（排除 node_modules/dist/.nuxt/.output）输出 0 行；npx vitest run tests/web：Test Files 26 passed，Tests 242 passed；tsc 退出 0；check-site-config 通过；app/web 构建通过，首屏 portal 分包 7.72 kB gzip（上一步 8.70 kB，吉祥物配置原来打在首屏里）

## 01:09:46 +08:00 · 提交 · #275 · #275 ③ 桌面换肤：晴空壁纸、菜单栏、图标、Dock、窗口外框

- 执行者：agent-claude-geek-main-3c2a7a67-os275o（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：默认壁纸改成画出来的「晴空」（components/os/SkyWallpaper.tsx，复用 boot/background.ts 和 layout.ts 的构图），刚播完开机动画时用它的起点当时间零点接上最后一帧，手机竖屏在开机动画层卸掉后把极客娘滑到图标下面；yugc、geek 两张图片壁纸留作可选。壁纸铺到整个外壳。菜单栏换成 YUGC 四色标志、搜索胶囊、时间、28px 头像；图标 60px、底色按 OS_APPS 顺序在 Y/U/G/C 里轮换；Dock 改成半透明胶囊、悬停上浮 6px；窗口改成 18px 圆角、粉色描边和标题栏、三个 12px 圆点各 44×44 点击区、标题居中、220ms 缩放淡入（减少动态效果只淡入）；桌面里的按钮改成胶囊。TL 挪到 layout.ts，就绪气泡的时间写成 READY_BUBBLE 两边共用。新增 tests/web/portal-desktop-skin.test.tsx（12 条），改了壁纸、手机、开机三份测试
- 结果：tsc -p app/web/tsconfig.json --noEmit 退出 0；npx vitest run tests/web：Test Files 27 passed，Tests 254 passed；全量 npx vitest run：1 failed | 1644 passed，失败的仍是 tests/tooling/project-catalog.test.ts（目录生成物要 pnpm catalog:generate，不在本任务可改范围）；check-boundaries：Boundaries passed: 270 files；check-site-config 通过；vite build ✓ built in 3.03s，portal 7.89 kB gzip、共用的 layout 分包 4.61 kB、BootSequence 13.04 kB、YugcOs 34.10 kB；没有在浏览器里看过，画面留给主会话验收
