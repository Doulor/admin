# YUGC OS v1 官网退场内容（#275）

> #275 把官网换成 YUGC OS v2 桌面时退场的页面、组件、样式、图片和模型，以及 #279 把「加入我们」改成桌面窗口时退场的信封场景，原样放在这里备查；它们不参与构建，也不会上线。

状态：`historical` · 更新：2026-10-24

## 为什么放在这里

所有者 2026-10-24 定下的做法：页面改版或大改动时，退场的内容放进一个目录并写清说明，旧页面和旧地址不再上线，免得用户和 agent 走进已经过时的页面。

`files/` 下面按原来的仓库路径存放。#275 归档的文件除模型的署名说明外，都和 stage `b6420dee`（#275 合并前）里同一路径的文件逐字节相同，可以用 `git show b6420dee:<原路径>` 对照；#279 归档的三个文件（`pages/JoinUs.tsx`、`three/join.ts`、`styles/scenes.css`）和 stage `e43df562`（#279 开工时）里的逐字节相同。`files/app/web/sites/portal/assets/models/README.md` 是手机模型的署名与许可说明，只在标题下面加了一行状态，正文没改。

## 为什么不会上线

- 镜像的构建上下文不含 `docs/`（仓库根的 `.dockerignore`），这里的文件进不了任何镜像。
- `app/web` 的 tsconfig 和 Vite 构建只读 `app/web` 里的代码，vitest 只跑 `tests/`，Playwright 只跑 `tests/e2e`，都不读这里。
- 公开文档接口不读 `docs/history/`（见 [历史材料](../README.md)）。

## 旧地址现在去哪

| 旧地址 | 原来是什么 | 现在 |
|---|---|---|
| `/feedback`、`/feedback/:org` | 意见箱单独的页面（`pages/Feedback.tsx`） | 跳到 `/?open=feedback`：进桌面并打开「意见箱」窗口；控制台意见箱页给的分享链接也改成这个地址 |
| `/github` | GitHub 组织的 3D 天际线场景（`pages/GithubScene.tsx`） | 落到兜底路由回首页；桌面上没有「GitHub 组织」应用了，代码在「代码仓库」窗口里看（自建 GitLab） |
| `/join/:token` | GitHub 组织邀请链接的落地页（`pages/JoinByToken.tsx`） | 落到兜底路由回首页；它调的 `/api/join/:token` 已随 #274 删除，邀请码改在注册时填 |
| `/` 的首屏 | 三维书桌，点笔记本或手机屏幕进 YUGC OS（`three/desk.ts`） | 开机动画（每天第一次进来播）加 YUGC OS 桌面 |
| `/join-us`、`/apply` | 「加入我们」的三维信封场景页（`pages/JoinUs.tsx`），`/apply` 是更早的旧地址 | 跳到 `/?open=join`：进桌面并打开「加入我们」窗口（#279）；宣传片门禁、先注册再投递、当天剩余份数、防刷验证和回执都在窗口里 |

## 文件清单

路径里省略的前缀是 `app/web/sites/portal/`。

| 原路径 | 是什么 | 换成了什么 | 删掉它的提交 |
|---|---|---|---|
| `three/desk.ts` | 首页首屏：浅色书桌加笔记本或手机模型，点屏幕推近镜头进桌面 | `components/boot/`（开机动画）和 `pages/Home.tsx` | `f4c81347` |
| `three/laptop.ts` | 书桌上的笔记本电脑，程序化几何 | 同上 | `f4c81347` |
| `three/phone.ts` | 竖屏时书桌上的手机，用 `assets/models/iphone_15_pro_max.glb` 的节点 | 同上 | `f4c81347` |
| `three/props.ts` | 书桌上的小物件：马克杯、盆栽、笔记本、挂画 | 同上 | `f4c81347` |
| `lib/deskMachine.ts` | 「书桌、开机、桌面」三步的状态机 | `lib/bootGate.ts`（开机动画按天播放） | `f4c81347` |
| `lib/loaderProgress.ts` | 首次加载动画的进度模型 | 开机动画自己的进度 | `f4c81347` |
| `components/Loader.tsx` | 首次进入的加载动画（YUGC 描边字、校徽、手写签名） | `components/boot/BootSequence.tsx` | `f4c81347` |
| `styles/desk.css` | 加载动画、书桌 HUD 和开机画面的样式 | `styles/boot.css` | `f4c81347` |
| `app/web/public/portal/geek-girl-portrait.webp` | 旧的竖屏极客娘立绘 | `assets/mascot/geek-girl.webp` | `f4c81347` |
| `tests/web/portal-desk.test.ts` | 书桌状态机和加载进度的用例 | `tests/web/portal-boot.test.tsx`、`tests/web/portal-boot-gate.test.tsx` | `f4c81347` |
| `tests/e2e/portal-phone.spec.ts` | 手机上书桌和桌面的浏览器回归 | `tests/web/portal-phone.test.tsx`（手机壳层） | `f4c81347` |
| `assets/models/iphone_15_pro_max.glb`、`assets/models/README.md` | 书桌上的手机模型和它的署名、许可（CC BY 4.0，作者 polyman） | 不再使用；「关于」窗口里的模型署名在 `f4c81347` 已经去掉 | 归档时从 `app/` 移过来 |
| `app/web/shared/ui/Mascot.tsx`、`app/web/shared/styles/mascot.css` | 固定在右下角的吉祥物组件和样式 | 不再有右下角吉祥物；极客娘只出现在开机动画和「晴空」壁纸里 | `ebaa9962` |
| `app/web/public/mascot/pose-01-welcome.webp` 到 `pose-08-sleep.webp` | 吉祥物的 8 个姿势图 | 同上 | `ebaa9962` |
| `pages/GithubScene.tsx`、`three/github.ts`、`lib/skyline.ts` | GitHub 组织场景页、贡献天际线和它用的装饰数据 | 「代码仓库」窗口（`lib/codeRepos.ts`，读 `GET /api/public/gitlab/projects`） | `20bf6037` |
| `app/web/public/portal/repos.json` | 代码仓库的静态快照 | 同上 | `20bf6037` |
| `pages/JoinByToken.tsx` | 邀请链接的落地页 | 注册时填邀请码（#274） | `a927ef55` |
| `lib/org.ts`、`tests/web/portal-org.test.ts` | 读 `GET /api/public/org` 的组织数据、默认值和它的用例 | `lib/departments.ts` 读 `GET /api/public/departments`；称号名字的守卫在 `tests/web/portal-org-window.test.tsx` | `a927ef55` |
| `pages/Feedback.tsx` | 意见箱页面（PageShell 外壳、表单、最近的意见） | `components/os/FeedbackBox.tsx`（意见箱窗口，同一份表单） | 归档时改成窗口 |
| `pages/JoinUs.tsx` | 「加入我们」信封场景页：信封飞入、信纸抽出变成表单、寄出后折信封口投进信箱 | `components/os/JoinBox.tsx`（加入我们窗口，同样的校验、防刷和限额） | #279 |
| `three/join.ts` | 信封、信纸、信箱的 three.js 场景和动画 | 不再有三维信封；窗口里的信纸是 DOM | #279 |
| `styles/scenes.css` | 场景页样式的整份原文件，含信纸表单与回执（`.pt-letter`、`.pt-lf`、`.pt-receipt`） | 线上的 `scenes.css` 只留论坛场景页用的部分；窗口样式在 `styles/os.css` 的 `.pt-joinbox` | #279 删掉加入我们部分 |

## 怎么看原来的样子

这些文件只是存档，不能直接放回 `app/` 运行：它们引用的接口（`/api/public/org`、`/api/join/:token`）和配置（`app.config.json` 里的 `mascot` 段和吉祥物开关）已经删掉。要看当时的效果，检出 `b6420dee` 按那时的说明在本机启动。
