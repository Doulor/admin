# NoData 无数据

> 数据源返回零条记录时的空状态

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/no-data) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/no-data.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/no-data.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`NoDataNoDataDemo`（完整源码见本页末尾）

```vue
<template>
  <TxNoData
    surface="card"
    title="暂无记录"
    description="创建第一条记录后，表格会在这里显示数据。"
    :primary-action="{ label: '创建记录', type: 'primary' }"
  />
</template>
```

### 最佳实践

- 数据源加载成功但没有记录时使用；断网、无权限、加载中与搜索无结果各有专用组件。
- 文案指向具体数据：「暂无发票」比「没有内容」清楚。
- 当前用户确实能创建或导入数据时，才提供操作。
- 仪表盘与表格面板内用 `surface="card"`，与加载后的容器一致。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `no-data`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | 预设标题 | 覆盖预设标题。 |
| `description` | `string` | 预设描述 | 说明为何为空或如何添加数据。 |
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

### 类型

#### EmptyStateAction

| 字段 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `label` | `string` | 必填 | 按钮文案。 |
| `type` | `TxButtonProps['type']` | - | 按钮语义类型，例如 `primary`。 |
| `variant` | `TxButtonProps['variant']` | - | 按钮视觉变体。 |
| `size` | `TxButtonProps['size']` | `actionSize` | 单个按钮的尺寸。 |
| `disabled` | `boolean` | `false` | 禁用按钮。 |
| `icon` | `string` | - | 按钮图标 class。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/no-data/`。

## 离线完整示例源码

- [NoDataNoDataDemo](../snapshot/apps/nexus/app/components/content/demos/NoDataNoDataDemo.vue.txt)

## 离线类型与实现参考

- [no-data/index.ts](../snapshot/packages/tuffex/packages/components/src/no-data/index.ts.txt)
- [src/TxNoData.vue](../snapshot/packages/tuffex/packages/components/src/no-data/src/TxNoData.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/no-data/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
