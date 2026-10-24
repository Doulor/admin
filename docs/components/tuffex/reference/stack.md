# Stack 堆叠

> 沿单一方向排列子元素并统一间距的容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/stack) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/stack.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/stack.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`StackStackDemo`（完整源码见本页末尾）

```vue
<template>
  <TxStack :gap="10">
    <TxButton>One</TxButton>
    <TxButton variant="secondary">Two</TxButton>
    <TxButton variant="ghost">Three</TxButton>
  </TxStack>
</template>
```

### 横向操作区
`direction="horizontal"` 横向排列，`wrap` 允许在窄容器中换行。

```vue
<template>
  <TxStack direction="horizontal" align="center" justify="flex-end" :gap="8" wrap>
    <TxButton variant="ghost">取消</TxButton>
    <TxButton variant="primary">保存</TxButton>
  </TxStack>
</template>
```

### 行内堆叠
`inline` 使用 `inline-flex`，可嵌入文本行。

```vue
<template>
  <span>
    状态：
    <TxStack inline direction="horizontal" align="center" gap="0.5rem">
      <TxBadge value="Live" variant="success" />
      <TxTag label="Beta" size="sm" />
    </TxStack>
  </span>
</template>
```

### 最佳实践

- 控制同级元素的节奏时用 `TxStack`，不要拿它做任意页面布局。
- 表单与设置面板用 `vertical`，操作行与紧凑元信息用 `horizontal`。
- 间距交给 `gap`，不要用空元素充当间隔。
- 需要 `row-reverse`、`column-reverse` 等原生方向时改用 `TxFlex`。
- 组件不添加语义 role；列表、表单、导航语义放在子元素或外层容器上。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `direction` | `'horizontal' \| 'vertical'` | `'vertical'` | 主轴方向。 |
| `gap` | `number \| string` | `12` | 子元素间距；数字按 px，字符串原样使用。 |
| `align` | `string` | `'stretch'` | `align-items`，接受任意合法值，如 `safe center`。 |
| `justify` | `string` | `'flex-start'` | `justify-content`，接受任意合法值。 |
| `wrap` | `boolean` | `false` | 允许换行。 |
| `inline` | `boolean` | `false` | 使用 `inline-flex`。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 堆叠的子元素。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-stack-gap` | `gap` | CSS gap。 |
| `--tx-stack-align` | `align` | `align-items`。 |
| `--tx-stack-justify` | `justify` | `justify-content`。 |
| `--tx-stack-direction` | `direction` | 解析后的 `flex-direction`。 |
| `--tx-stack-wrap` | `wrap` | 解析后的 `flex-wrap`。 |
| `--tx-stack-display` | `inline` | `flex` 或 `inline-flex`。 |

## 概述

- 根节点是 `div`，设置 `min-width: 0`，子元素可在受限容器内收缩。
- props 写入根节点的 `--tx-stack-*` 变量，样式表读取这些变量。
- `vertical` 映射为 `column`，`horizontal` 映射为 `row`；`align`、`justify` 传空值时回退到默认值。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/stack/`。

## 离线完整示例源码

- [StackStackDemo](../snapshot/apps/nexus/app/components/content/demos/StackStackDemo.vue.txt)

## 离线类型与实现参考

- [stack/index.ts](../snapshot/packages/tuffex/packages/components/src/stack/index.ts.txt)
- [src/TxStack.vue](../snapshot/packages/tuffex/packages/components/src/stack/src/TxStack.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/stack/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
