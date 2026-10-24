# Flex 弹性布局

> 控制方向、对齐、换行与间距的 Flexbox 容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/flex) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/flex.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/flex.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`FlexFlexDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlex justify="space-between" align="center">
    <TxTag label="Left" />
    <TxButton variant="primary">Action</TxButton>
  </TxFlex>
</template>
```

### 可换行工具栏
`wrap="wrap"` 让工具栏在窄容器中换行。

```vue
<template>
  <TxFlex align="center" justify="space-between" wrap="wrap" gap="0.75rem">
    <TxFlex align="center" gap="0.5rem" wrap="wrap">
      <TxTag label="Docs" />
      <TxTag label="Reviewed" color="var(--tx-color-success)" />
    </TxFlex>
    <TxButton size="sm">发布</TxButton>
  </TxFlex>
</template>
```

### 反向排列

```vue
<template>
  <TxFlex direction="row-reverse" align="center" gap="8px">
    <TxButton variant="primary">Primary</TxButton>
    <TxButton variant="ghost">Secondary</TxButton>
  </TxFlex>
</template>
```

### 最佳实践

- 需要精确的 Flexbox 语义时用 `TxFlex`，常规的横纵节奏用 `TxStack`。
- 间距交给 `gap`，不要在子元素上写 margin。
- 容器不添加角色与键盘行为，交互交给语义化的子控件。
- 重复卡片的网格用 `TxGridLayout`，不要嵌套多层 flex。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `direction` | `'row' \| 'row-reverse' \| 'column' \| 'column-reverse'` | `'row'` | 主轴方向。 |
| `gap` | `number \| string` | `12` | 子元素间距；数字按 px，字符串原样使用。 |
| `align` | `string` | `'stretch'` | `align-items`，接受任意 CSS 值；图文行用 `center`。 |
| `justify` | `string` | `'flex-start'` | `justify-content`，接受任意 CSS 值。 |
| `wrap` | `'nowrap' \| 'wrap' \| 'wrap-reverse'` | `'nowrap'` | `flex-wrap`。 |
| `inline` | `boolean` | `false` | 使用 `inline-flex`。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | Flex 子元素。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-flex-gap` | `gap` | CSS gap。 |
| `--tx-flex-align` | `align` | `align-items`。 |
| `--tx-flex-justify` | `justify` | `justify-content`。 |
| `--tx-flex-direction` | `direction` | `flex-direction`。 |
| `--tx-flex-wrap` | `wrap` | `flex-wrap`。 |
| `--tx-flex-display` | `inline` | `flex` 或 `inline-flex`。 |

## 概述

- 根节点是 `div`，设置 `min-width: 0`，子元素可在受限容器内收缩。
- props 写入根节点的 `--tx-flex-*` 变量，样式表读取这些变量。
- `align`、`justify`、`direction`、`wrap` 传空值时回退到默认值。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/flex/`。

## 离线完整示例源码

- [FlexFlexDemo](../snapshot/apps/nexus/app/components/content/demos/FlexFlexDemo.vue.txt)

## 离线类型与实现参考

- [flex/index.ts](../snapshot/packages/tuffex/packages/components/src/flex/index.ts.txt)
- [src/TxFlex.vue](../snapshot/packages/tuffex/packages/components/src/flex/src/TxFlex.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/flex/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
