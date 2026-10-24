# 安装与引入

> 安装 Tuffex 并按组件、按套件或从根入口引入

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/installation) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/installation.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/installation.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.4.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

Vue 3 是 peer dependency。

```bash
pnpm add @talex-touch/tuffex
```

## 用法

三种方式拿到的是同一个组件，区别只在打包体积。

| 方式 | 引入路径 | 适用场景 |
|------|----------|----------|
| 按组件 | `@talex-touch/tuffex/button` | 新代码，只打包用到的组件 |
| 按套件 | `@talex-touch/tuffex/base` | 一个页面大量使用同一套件 |
| 根入口 | `@talex-touch/tuffex` | 仅用于迁移，会引入整个组件库 |

### 按组件引入（推荐）

```typescript
import TxButton from '@talex-touch/tuffex/button'
import TxSwitch from '@talex-touch/tuffex/switch'
import '@talex-touch/tuffex/base.css'
import '@talex-touch/tuffex/button/style.css'
import '@talex-touch/tuffex/switch/style.css'

app.use(TxButton)
app.use(TxSwitch)
```

### 按套件引入

`base`、`pro`、`ai` 三个入口互不重叠，每个组件只属于其中一个。套件入口只提供具名导出，样式按组件引入。

```typescript
import { TxButton, TuffSwitch } from '@talex-touch/tuffex/base'
import '@talex-touch/tuffex/base.css'
import '@talex-touch/tuffex/button/style.css'
import '@talex-touch/tuffex/switch/style.css'

app.use(TxButton)
app.use(TuffSwitch)
```

数据与动效套件的组件从 `pro` 引入；图表族另有 `@talex-touch/tuffex/charts` 入口。

```typescript
import { TxTimeseriesChart } from '@talex-touch/tuffex/charts'
import '@talex-touch/tuffex/charts/style.css'
```

### 根入口（迁移用）

```typescript
import TuffUI from '@talex-touch/tuffex'
import '@talex-touch/tuffex/style.css'

app.use(TuffUI)
```

### 样式

样式不会随 JavaScript 自动注入。

| 样式文件 | 内容 | 是否必需 |
|----------|------|----------|
| `@talex-touch/tuffex/base.css` | `--tx-*` 变量、重置样式、主题选择器 | 必需，全局引入一次 |
| `@talex-touch/tuffex/<name>/style.css` | 单个组件的样式 | 用到哪个组件引哪个 |
| `@talex-touch/tuffex/style.css` | 全部组件的样式 | 仅根入口 |

覆盖 token 见《[主题定制](./theming.md)》。

### 工具函数

```typescript
import { nextZIndex, toast } from '@talex-touch/tuffex/utils'
```

完整 API 见《[Utils 工具函数](./utils.md)》。

## 技术实现

- 入口映射：`packages/tuffex/package.json` 的 `exports`。
- 套件入口：`packages/tuffex/packages/components/src/{base,pro,ai}/index.ts`，由 `suite-barrels.test.ts` 校验三者恰好划分全部组件。

## 离线完整示例源码

此页没有引用独立 Demo；正文中的代码块保持原样。

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
