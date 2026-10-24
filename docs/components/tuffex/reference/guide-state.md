# GuideState 引导状态

> 引导用户完成初始设置的状态视图

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/guide-state) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/guide-state.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/guide-state.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
外围页面已说明上下文时，使用预设的标题与说明。
官方示例：`GuideStateBasicDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGuideState
    :primary-action="{ label: '开始配置', type: 'primary' }"
    :secondary-action="{ label: '查看指南' }"
  />
</template>
```

### 自定义文案
引导独立出现在页面或面板中时，覆盖文案并设置 `surface="card"`。
官方示例：`GuideStateCustomDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGuideState
    title="创建第一个工作区"
    description="工作区帮助你整理项目、成员和自动化流程。按照引导完成初始配置。"
    surface="card"
    size="large"
    :primary-action="{ label: '创建工作区', type: 'primary' }"
  />
</template>
```

### 最佳实践

- 用于首次使用、设置提示或「从这里开始」面板；数据缺失用 `TxNoData`。
- 标题写出下一步，而不是描述空屏。
- 位于后台内容之间时用 `surface="card"`；已有外框的面板内保持 `plain`。
- 操作文案要具体，例如「创建工作区」「连接账号」，不写「继续」。
- 预设插画或生成按钮表达不了目标操作时，才传插槽。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `guide`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | `'Start here'` | 覆盖预设标题。 |
| `description` | `string` | `'Follow the steps to get started.'` | 覆盖预设说明。 |
| `icon` | `TxIconSource \| string \| null` | guide 插画 | 替换插画；`null` 隐藏图标区。 |
| `iconSize` | `number` | 尺寸预设 | 图标或 spinner 尺寸（px）。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 布局方向。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 内容对齐。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 视觉尺寸。 |
| `surface` | `'plain' \| 'card'` | `'plain'` | `card` 添加卡片表面。 |
| `primaryAction` | `EmptyStateAction` | - | 生成主操作，点击触发 `primary`。 |
| `secondaryAction` | `EmptyStateAction` | - | 生成次操作，点击触发 `secondary`。 |
| `actionSize` | `TxButtonProps['size']` | `'sm'` | 生成按钮的默认尺寸。 |
| `loading` | `boolean` | `false` | 无 `icon` 插槽或属性时显示 spinner。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `primary` | `()` | 点击生成的主操作按钮时触发。 |
| `secondary` | `()` | 点击生成的次操作按钮时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `icon` | - | 替换 guide 插画。 |
| `title` | - | 替换标题。 |
| `description` | - | 替换说明。 |
| `actions` | - | 替换生成的主/次操作按钮。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/guide-state/`。

## 离线完整示例源码

- [GuideStateBasicDemo](../snapshot/apps/nexus/app/components/content/demos/GuideStateBasicDemo.vue.txt)
- [GuideStateCustomDemo](../snapshot/apps/nexus/app/components/content/demos/GuideStateCustomDemo.vue.txt)

## 离线类型与实现参考

- [guide-state/index.ts](../snapshot/packages/tuffex/packages/components/src/guide-state/index.ts.txt)
- [src/TxGuideState.vue](../snapshot/packages/tuffex/packages/components/src/guide-state/src/TxGuideState.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/guide-state/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
