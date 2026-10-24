# BlankSlate 空白页

> 引导首次使用者开始操作的大号空状态

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/blank-slate) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/blank-slate.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/blank-slate.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`BlankSlateBlankSlateDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlankSlate
    title="创建第一个项目"
    description="先创建项目，用于组织文档、审阅和自动化流程。"
    :primary-action="{ label: '创建项目', type: 'primary' }"
    :secondary-action="{ label: '查看指南' }"
  />
</template>
```

### 最佳实践

- 用于首次使用与 onboarding；反复出现的空查询结果用 `TxNoData`。
- 文案说明第一步的价值，而不只是「这里没有内容」。
- 只放一个直接的主操作；次操作用于查看指南、导入或跳过。
- 全页空白页保持 `surface="plain"`，除非外层布局统一使用卡片。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `blank-slate`，`size` 默认为 `'large'`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | 预设标题 | 引导标题。 |
| `description` | `string` | 预设描述 | 说明第一步的价值。 |
| `icon` | `TxIconSource \| string \| null` | 预设插画 | 替换插画；`null` 隐藏图标区。 |
| `iconSize` | `number` | 尺寸预设 | 图标尺寸（px）。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 布局方向。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 内容对齐。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'large'` | 间距与插画尺寸。 |
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

- 源码：`packages/tuffex/packages/components/src/blank-slate/`。

## 离线完整示例源码

- [BlankSlateBlankSlateDemo](../snapshot/apps/nexus/app/components/content/demos/BlankSlateBlankSlateDemo.vue.txt)

## 离线类型与实现参考

- [blank-slate/index.ts](../snapshot/packages/tuffex/packages/components/src/blank-slate/index.ts.txt)
- [src/TxBlankSlate.vue](../snapshot/packages/tuffex/packages/components/src/blank-slate/src/TxBlankSlate.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/blank-slate/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
