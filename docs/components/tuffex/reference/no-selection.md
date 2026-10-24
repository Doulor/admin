# NoSelection 未选择

> 详情面板等待用户选择时的空状态

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/no-selection) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/no-selection.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/no-selection.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`NoSelectionNoSelectionDemo`（完整源码见本页末尾）

```vue
<template>
  <TxNoSelection
    surface="card"
    title="未选择条目"
    description="从左侧列表选择一个项目后，这里会显示详情。"
    :primary-action="{ label: '新建项目', type: 'primary' }"
  />
</template>
```

### 最佳实践

- 面板有效但依赖用户选择时使用；数据集为空用 `TxNoData`，筛选无结果用 `TxSearchEmpty`。
- 配合列表或表格中可见的选中提示，让用户知道去哪里选。
- 分栏详情区用 `surface="card"`，让空区域有清晰边界。
- 操作文案要具体，例如「新建项目」「打开列表」，不写「确定」。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `no-selection`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | 预设标题 | 覆盖预设标题。 |
| `description` | `string` | 预设描述 | 说明下一步该选什么。 |
| `icon` | `TxIconSource \| string \| null` | 预设插画 | 替换插画；`null` 隐藏图标区。 |
| `iconSize` | `number` | 尺寸预设 | 图标尺寸（px）。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 布局方向。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 内容对齐。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 间距与插画尺寸。 |
| `surface` | `'plain' \| 'card'` | `'plain'` | `card` 添加卡片边框。 |
| `primaryAction` | `EmptyStateAction` | - | 生成主操作。 |
| `secondaryAction` | `EmptyStateAction` | - | 生成次操作。 |
| `actionSize` | `TxButtonProps['size']` | `'sm'` | 生成按钮的默认尺寸。 |
| `loading` | `boolean` | `false` | 无自定义图标时显示 spinner。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `primary` | - | 点击生成的主操作时触发。 |
| `secondary` | - | 点击生成的次操作时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `icon` | - | 替换插画或图标。 |
| `title` | - | 替换标题。 |
| `description` | - | 替换描述。 |
| `actions` | - | 替换生成的主/次操作按钮。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/no-selection/`。

## 离线完整示例源码

- [NoSelectionNoSelectionDemo](../snapshot/apps/nexus/app/components/content/demos/NoSelectionNoSelectionDemo.vue.txt)

## 离线类型与实现参考

- [no-selection/index.ts](../snapshot/packages/tuffex/packages/components/src/no-selection/index.ts.txt)
- [src/TxNoSelection.vue](../snapshot/packages/tuffex/packages/components/src/no-selection/src/TxNoSelection.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/no-selection/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
