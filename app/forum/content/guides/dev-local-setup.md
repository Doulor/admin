---
id: t918
slug: dev-local-setup
title: 本地开发环境搭建
audience: 开发与运维
visibility: member
order: 18
date: 2026-10-24
---

这篇给要在自己机器上跑起来改代码的人看。仓库里有两套独立的工具链，根目录（官网、控制台、核心后端）用 Node 22，论坛单独用 Node ≥26，两者不能混用。

1. 克隆仓库（把 `<仓库地址>` 换成自建代码托管平台上这个仓库的真实地址）：

```
git clone <仓库地址>
cd admin
```

2. 装根目录的依赖（Node 22，corepack 会按仓库里的 `packageManager` 字段自动选对应的 pnpm 版本）：

```
corepack enable
pnpm install --frozen-lockfile
```

3. 论坛用独立工具链，不要手动 `cd` 进 `app/forum` 装依赖：

```
pnpm forum:install
```

它会自己找机器上 Node ≥26 的可执行文件；找不到就设 `FORUM_NODE` 环境变量指向那个版本的 node，核心项目本身留在 Node 22，不受影响。

4. 分别起各个服务看效果：

```
pnpm dev:web        # 官网，只读样板数据，不用连后端
pnpm dev:console    # 控制台，默认连本机 3000 的后端，地址上加查询参数能切成样板数据
pnpm preview:local  # 核心 API（3000）+ 独立论坛（3456）
```

`preview:local` 起的核心服务默认是隔离模式（内存数据库，不连 GitHub）；要测真实 GitHub 登录需要另外给一对本机专用的 OAuth 应用凭据。各服务的本机地址、两种模式的区别和凭据怎么传，看运维那边的本机预览规范，不在这篇文档库范围内。

5. 跑检查和测试：

```
pnpm check        # 类型检查、文档同步、环境文件契约等一串静态检查
pnpm test         # 核心（server/web/console）单测
pnpm test:e2e     # 浏览器端到端测试
pnpm forum:check  # 论坛的类型检查、测试类型、ESLint、样式规则、单测
pnpm forum:verify # 论坛的浏览器行为测试
pnpm verify       # 按顺序跑完上面这些，提交前至少跑一次
```

6. 停掉本机起的服务：

```
node scripts/local-preview.mjs stop
node scripts/forum.mjs stop
```

7. 想单独预览比赛官网站点，用 `pnpm --filter @yzgc/web dev:contest`，细节见《比赛官网 SDK 与托管》（./t924）。
