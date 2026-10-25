# DotIndicator 圆点指示器

> 圆点加文案的状态指示原语

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/dot-indicator) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/dot-indicator.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/dot-indicator.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`color` 给圆点上色，`label` 或默认插槽提供文案。
官方示例：`DotIndicatorDotIndicatorDemo`（完整源码见本页末尾）

```vue
<template>
  <TxDotIndicator color="var(--tx-bui-green)" label="非常紧密" />
  <TxDotIndicator color="var(--tx-bui-orange)" label="一般" />
  <TxDotIndicator color="var(--tx-bui-red)" label="较弱" />
  <TxDotIndicator color="var(--tx-bui-ink-3)" label="无往来" />

  <TxDotIndicator color="var(--tx-bui-orange)">
    <strong>44% 平均强度</strong>
  </TxDotIndicator>
</template>
```

### 最佳实践

- 优先给 `label`：颜色不能是状态的唯一载体。
- 只有同一行已有文字说明含义时，才只给 `ariaLabel`。
- 颜色用 `--tx-bui-*` 或 `--tx-color-*` 变量；硬编码 hex 不随主题切换。
- 汇总行用默认插槽包一层 `<strong>` 强调数值，圆点保持对齐。
- 表格单元格、汇总行等高密度场景用圆点；独立的状态标记用 `TxStatusBadge`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `color` | `string` | `'currentColor'` | 圆点颜色，接受任意 CSS 颜色或变量。 |
| `label` | `string` | - | 圆点旁的文案。 |
| `size` | `number` | `8` | 圆点直径（px）。 |
| `ariaLabel` | `string` | - | 没有可见文案时的可访问名称。 |

### 插槽

| 名称 | 说明 |
|------|------|
| `default` | 替换圆点旁的文案。 |

## 概述

- 有 `label` 或默认插槽时由文案说明含义，不加 role 或 `aria-label`。
- 只有 `ariaLabel` 时渲染为 `role="img"` 并带该名称。
- 两者都没有时视为装饰，设置 `aria-hidden="true"`。
- 文案使用等宽数字（`tabular-nums`），数值变化时不左右跳动。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/dot-indicator/`。
- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）；上游是纯视觉圆点，此处补上三种无障碍身份。

## 离线完整示例源码

- [DotIndicatorDotIndicatorDemo](../snapshot/apps/nexus/app/components/content/demos/DotIndicatorDotIndicatorDemo.vue.txt)

## 离线类型与实现参考

- [dot-indicator/index.ts](../snapshot/packages/tuffex/packages/components/src/dot-indicator/index.ts.txt)
- [src/TxDotIndicator.vue](../snapshot/packages/tuffex/packages/components/src/dot-indicator/src/TxDotIndicator.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/dot-indicator/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
