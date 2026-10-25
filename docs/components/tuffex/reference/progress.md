# Progress 进度

> 基于 TxProgressBar 的线性进度行

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/progress) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/progress.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/progress.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 状态
`status` 设置状态色。
官方示例：`ProgressProgressStatesDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffProgress :percentage="40" />
  <TuffProgress :percentage="72" status="warning" />
  <TuffProgress :percentage="100" status="success" />
</template>
```

### 进度行
官方示例：`ProgressProgressRowDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffProgress :percentage="60" />
  <TxStatusBadge text="进行中" status="warning" />
</template>
```

### 自定义文本

```vue
<template>
  <TuffProgress :percentage="42" :format="value => `完成 ${value}%`" />
</template>
```

### 不确定进度

```vue
<template>
  <TuffProgress indeterminate :percentage="60" :show-text="false" />
</template>
```

### 最佳实践

- 简单的行级进度用 `TuffProgress`；需要分段、tooltip、message、loading/success/error 状态、动效或自定义文本位置时，直接用 `TxProgressBar`。
- `strokeWidth` 保持克制；本组件面向行级进度，不用于大号指标。
- 时长未知的任务用 `indeterminate`，没有可信数值时隐藏文本，不要展示过期的百分比。
- 周围界面需要操作上下文时，搭配简短的状态标签。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `percentage` | `number` | `0` | 确定进度值。 |
| `status` | `'success' \| 'error' \| 'warning' \| ''` | `''` | 状态色。 |
| `strokeWidth` | `number` | `6` | 进度条高度（px）。 |
| `showText` | `boolean` | `true` | 在进度条外侧显示文本。 |
| `indeterminate` | `boolean` | `false` | 不确定进度模式。 |
| `format` | `(percentage: number) => string` | - | 自定义确定进度的显示文本。 |

## 概述

- 直接渲染 `TxProgressBar`，不额外包裹 DOM；`percentage`、`status`、`indeterminate`、`showText`、`format` 原样转发。
- `strokeWidth` 转为 `height`（如 `"6px"`）；文本位置固定为 `outside`，遮罩样式固定为 `maskVariant="plain"`。
- 不派发事件、不提供插槽，进度由宿主更新 props 驱动。
- 确定进度由 `TxProgressBar` 提供 `role="progressbar"` 与 `aria-valuenow`；不确定进度省略 `aria-valuenow`。

## 技术实现

- 安装入口注册组件名 `TuffProgress`。
- 源码：`packages/tuffex/packages/components/src/progress/`。

## 离线完整示例源码

- [ProgressProgressStatesDemo](../snapshot/apps/nexus/app/components/content/demos/ProgressProgressStatesDemo.vue.txt)
- [ProgressProgressRowDemo](../snapshot/apps/nexus/app/components/content/demos/ProgressProgressRowDemo.vue.txt)

## 离线类型与实现参考

- [progress/index.ts](../snapshot/packages/tuffex/packages/components/src/progress/index.ts.txt)
- [src/TxProgress.vue](../snapshot/packages/tuffex/packages/components/src/progress/src/TxProgress.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/progress/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
