# LoadingState 加载态

> 整块区域加载时显示的状态视图

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/loading-state) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/loading-state.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/loading-state.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`LoadingStateLoadingStateDemo`（完整源码见本页末尾）

```vue
<template>
  <TxLoadingState title="正在加载插件" description="正在同步官方插件和权限..." />
</template>
```

### 后台恢复状态
与空态、错误态占用同一容器，请求完成后布局不跳动。
官方示例：`ComponentsRecoveryStatesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxLoadingState
    title="正在加载规则"
    description="正在同步团队自动化规则，请稍等。"
    surface="card"
    size="large"
  />
</template>
```

### 最佳实践

- 用于首屏或整块面板加载；行内等待用 `TxSpinner` 或 `TxProgressBar` 的 `loading`。
- 文案写明正在加载的资源，例如「正在加载规则」，不只写「Loading」。
- 外层布局在加载时会塌陷，就用 `surface="card"` 预留高度。
- 只有请求真的能取消或重试时，才提供对应的操作。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `loading`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | `Loading` | 覆盖预设标题。 |
| `description` | `string` | `Please wait a moment.` | 覆盖预设说明。 |
| `icon` | `TxIconSource \| string \| null` | - | 替换加载插画；`null` 隐藏图标区，但 `loading` 为 `true` 时仍显示 spinner。 |
| `iconSize` | `number` | - | 图标或 spinner 尺寸。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 图标与内容的排列方向。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 图标、文案与操作的对齐。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 间距、字号与插画尺寸。 |
| `surface` | `'plain' \| 'card'` | `'plain'` | `card` 添加边框容器，预留空间。 |
| `primaryAction` | `EmptyStateAction` | - | 生成主操作，点击触发 `primary`。 |
| `secondaryAction` | `EmptyStateAction` | - | 生成次操作，排在主操作之前，点击触发 `secondary`。 |
| `actionSize` | `TxButtonProps['size']` | `'sm'` | 生成按钮的默认尺寸。 |
| `loading` | `boolean` | `false` | 无自定义图标时以 spinner 代替预设插画。 |

### 事件

| 事件名 | 说明 |
|------|------|
| `primary` | 点击生成的主操作按钮时触发。 |
| `secondary` | 点击生成的次操作按钮时触发。 |

### 插槽

| 名称 | 说明 |
|------|------|
| `icon` | 替换加载插画或 spinner。 |
| `title` | 替换标题。 |
| `description` | 替换说明。 |
| `actions` | 替换生成的主/次操作按钮。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/loading-state/`。

## 离线完整示例源码

- [LoadingStateLoadingStateDemo](../snapshot/apps/nexus/app/components/content/demos/LoadingStateLoadingStateDemo.vue.txt)
- [ComponentsRecoveryStatesDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsRecoveryStatesDemo.vue.txt)

## 离线类型与实现参考

- [loading-state/index.ts](../snapshot/packages/tuffex/packages/components/src/loading-state/index.ts.txt)
- [src/TxLoadingState.vue](../snapshot/packages/tuffex/packages/components/src/loading-state/src/TxLoadingState.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/loading-state/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
