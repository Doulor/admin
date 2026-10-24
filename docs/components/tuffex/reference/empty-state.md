# EmptyState 空态引导

> 表示空、加载、错误等页面状态的占位视图

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/empty-state) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/empty-state.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/empty-state.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 预设与操作
`variant` 选择预设的标题、说明与插画；`primaryAction`、`secondaryAction` 生成操作按钮。
官方示例：`EmptyStateEmptyStateVariantDemo`（完整源码见本页末尾）

```vue
<template>
  <TxEmptyState
    variant="no-data"
    :primary-action="{ label: 'Create', type: 'primary' }"
    :secondary-action="{ label: 'Refresh' }"
  />
</template>
```

### 横向布局
官方示例：`EmptyStateEmptyStateHorizontalDemo`（完整源码见本页末尾）

```vue
<template>
  <TxEmptyState
    variant="no-selection"
    layout="horizontal"
    surface="card"
    title="No selection"
    description="Pick an item from the left to continue."
  />
</template>
```

### 自定义插槽
`variant="custom"` 没有预设文案与插画，内容全部来自插槽。
官方示例：`EmptyStateEmptyStateSlotsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxEmptyState variant="custom">
    <template #icon>
      <TxIcon name="i-carbon-search" :size="28" />
    </template>
    <template #title>
      Setup required
    </template>
    <template #description>
      Connect a workspace to enable this feature.
    </template>
    <template #actions>
      <TxButton type="primary">Connect</TxButton>
      <TxButton>Learn more</TxButton>
    </template>
  </TxEmptyState>
</template>
```

### 后台恢复状态
官方示例：`ComponentsRecoveryStatesDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const mode = ref<'loading' | 'empty' | 'error'>('empty')
</script>

<template>
  <TxLoadingState v-if="mode === 'loading'" title="正在加载规则" surface="card" />
  <TxEmptyState
    v-else-if="mode === 'empty'"
    variant="no-data"
    title="还没有自动化规则"
    surface="card"
    :primary-action="{ label: '创建规则', type: 'primary' }"
  />
  <TxErrorState v-else title="规则加载失败" surface="card" />
</template>
```

### 最佳实践

- 先选最贴近的预设再改文案：筛选无结果用 `search-empty`，分栏未选中用 `no-selection`，无权限用 `permission`，断网用 `offline`。
- 标题说明处境并指向下一步：写「还没有自动化规则」，不写「暂无」。
- 加载、空态与错误态在同一数据容器内切换，避免布局跳动。
- 常规操作用 `primaryAction` / `secondaryAction`；需要自定义组合时才用 `actions` 插槽。
- Dashboard 与面板内用 `surface="card"`；表格、抽屉、卡片等已有容器的区域保持 `plain`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `variant` | `EmptyStateVariant` | `'empty'` | 预设的标题、说明与插画。 |
| `title` | `string` | - | 覆盖预设标题；传空字符串隐藏。 |
| `description` | `string` | - | 覆盖预设说明；传空字符串隐藏。 |
| `icon` | `TxIconSource \| string \| null` | - | 图标源或图标 class，替换预设插画；`null` 隐藏图标区。 |
| `iconSize` | `number` | size 预设 | 图标或 spinner 尺寸（px），默认按 `size` 取 `28`、`36`、`44`。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 图标与内容纵向堆叠或横向并排。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 图标、文案与操作的对齐方式。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 间距、字号与插画尺寸。 |
| `surface` | `'plain' \| 'card'` | `'plain'` | `card` 添加带边框的卡片表面。 |
| `primaryAction` | `EmptyStateAction` | - | 生成主操作按钮，点击触发 `primary`。 |
| `secondaryAction` | `EmptyStateAction` | - | 生成次操作按钮，排在主操作之前，点击触发 `secondary`。 |
| `actionSize` | `TxButtonProps['size']` | `'sm'` | 生成按钮的默认尺寸。 |
| `loading` | `boolean` | `false` | 无自定义图标时显示 `TxSpinner`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `primary` | - | 点击生成的主操作按钮时触发。 |
| `secondary` | - | 点击生成的次操作按钮时触发。 |

### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `icon` | - | 替换预设插画、spinner 或 `icon`。 |
| `title` | - | 替换标题。 |
| `description` | - | 替换说明。 |
| `actions` | - | 替换生成的主/次操作按钮。 |

### 类型

#### EmptyStateAction

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `label` | `string` | - | 按钮文本。 |
| `type` | `TxButtonProps['type']` | - | 透传给 `TxButton` 的色调。 |
| `variant` | `TxButtonProps['variant']` | - | 透传给 `TxButton` 的视觉变体。 |
| `size` | `TxButtonProps['size']` | - | 单个按钮的尺寸，未设置时取 `actionSize`。 |
| `disabled` | `boolean` | `false` | 禁用按钮；禁用时不触发对应事件。 |
| `icon` | `string` | - | 透传给 `TxButton` 的图标 class。 |

#### EmptyStateVariant 默认值

| Variant | 默认标题 | 默认说明 | 插画来源 |
|------|------|------|------|
| `empty` | `Nothing here` | `There is nothing to show yet.` | 内置 SVG 插画。 |
| `blank-slate` | `Start from scratch` | `Create your first item to get started.` | 内置 SVG 插画。 |
| `no-data` | `No data` | `No data available yet.` | 内置 SVG 插画。 |
| `no-selection` | `Nothing selected` | `Select an item to see details.` | 内置 SVG 插画。 |
| `search-empty` | `No results` | `Try a different keyword or filter.` | 内置 SVG 插画。 |
| `loading` | `Loading` | `Please wait a moment.` | 内置骨架插画；`loading=true` 时为 spinner。 |
| `offline` | `You are offline` | `Check your connection and retry.` | 内置 SVG 插画。 |
| `permission` | `Access denied` | `You do not have permission to view this content.` | 内置 SVG 插画。 |
| `error` | `Something went wrong` | `Please try again later.` | 内置 SVG 插画。 |
| `guide` | `Start here` | `Follow the steps to get started.` | 内置 SVG 插画。 |
| `custom` | 空 | 空 | 无，除非传入 `icon` 或 `icon` 插槽。 |

### 预设组件

预设组件固定 `variant`，其余属性、事件与插槽原样透传给 `TxEmptyState`。

| 组件 | 固定 variant | 说明 |
|------|------|------|
| [`TxBlankSlate`](./blank-slate.md) | `blank-slate` | 默认 `size="large"`、`layout="vertical"`、`surface="plain"`。 |
| [`TxLoadingState`](./loading-state.md) | `loading` | 加载占位。 |
| [`TxNoSelection`](./no-selection.md) | `no-selection` | 列表未选中时的详情区。 |
| [`TxNoData`](./no-data.md) | `no-data` | 加载成功但没有数据。 |
| [`TxSearchEmpty`](./search-empty.md) | `search-empty` | 搜索或筛选无结果。 |
| [`TxOfflineState`](./offline-state.md) | `offline` | 网络不可用。 |
| [`TxPermissionState`](./permission-state.md) | `permission` | 权限不足。 |
| [`TxErrorState`](./error-state.md) | `error` | 错误。 |
| [`TxGuideState`](./guide-state.md) | `guide` | 引导。 |

## 概述

- 先按 `variant` 解析预设，再应用显式属性；插槽优先于同区域的生成内容。
- `actions` 插槽整体替换生成按钮；生成按钮次操作在前、主操作在后。
- `icon=null` 隐藏插画；`loading` 只在没有 `icon` 插槽且 `icon` 为空时以 `TxSpinner` 代替图标。
- `surface="card"` 只增加视觉容器，不改变语义与按钮行为。
- 减少动态效果时，所有插画停在完整的静止帧。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/empty-state/`；预设组件在各自目录。

## 离线完整示例源码

- [EmptyStateEmptyStateVariantDemo](../snapshot/apps/nexus/app/components/content/demos/EmptyStateEmptyStateVariantDemo.vue.txt)
- [EmptyStateEmptyStateHorizontalDemo](../snapshot/apps/nexus/app/components/content/demos/EmptyStateEmptyStateHorizontalDemo.vue.txt)
- [EmptyStateEmptyStateSlotsDemo](../snapshot/apps/nexus/app/components/content/demos/EmptyStateEmptyStateSlotsDemo.vue.txt)
- [ComponentsRecoveryStatesDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsRecoveryStatesDemo.vue.txt)

## 离线类型与实现参考

- [empty-state/index.ts](../snapshot/packages/tuffex/packages/components/src/empty-state/index.ts.txt)
- [src/TxEmptyState.vue](../snapshot/packages/tuffex/packages/components/src/empty-state/src/TxEmptyState.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/empty-state/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
