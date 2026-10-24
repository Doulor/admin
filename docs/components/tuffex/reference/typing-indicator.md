# TypingIndicator 打字中

> 聊天界面内联的输入中与加载状态指示器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/typing-indicator) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/typing-indicator.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/typing-indicator.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`1.0.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`TypingIndicatorTypingIndicatorDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTypingIndicator />
</template>
```

### 变体
`variant` 选择样式，每种变体有各自的尺寸 prop。
官方示例：`TypingIndicatorTypingIndicatorVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTypingIndicator text="Typing…" />
  <TxTypingIndicator variant="ai" :loader-size="32" text="Generating…" />
  <TxTypingIndicator variant="pure" :pure-size="12" text="Loading" />
  <TxTypingIndicator variant="ring" :ring-size="22" :ring-thickness="3" :show-text="false" />
  <TxTypingIndicator variant="circle-dash" :circle-dash-dash-deg="10" :circle-dash-gap-deg="10" :show-text="false" />
  <TxTypingIndicator variant="bars" :bars-size="16" :show-text="false" />
</template>
```

### 最佳实践

- 内联聊天行与紧凑的助手占位用默认的 `dots`。
- 空间充足、需要品牌化的生成状态时用 `ai`。
- 工具栏、消息元信息行或骨架屏旁用 `pure`、`ring`、`circle-dash` 或 `bars`。
- 保持 `showText=true`，除非相邻的可见标签已说明在等待什么。
- 同一段对话中不要混用多种变体。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `variant` | `'dots' \| 'ai' \| 'pure' \| 'ring' \| 'circle-dash' \| 'bars'` | `'dots'` | 指示器样式。 |
| `text` | `string` | `'Typing…'` | `showText` 开启时显示的文案。 |
| `showText` | `boolean` | `true` | 显示文案。 |
| `ariaLabel` | `string` | - | `showText` 关闭时供读屏朗读的文案；缺省时用 `text`。 |
| `size` | `number` | `6` | `dots` 的圆点直径（px）。 |
| `gap` | `number` | `5` | `dots` 的圆点间距（px）。 |
| `loaderSize` | `number` | `44` | `ai` 的尺寸（px）。 |
| `pureSize` | `number` | `14` | `pure` 的直径（px）。 |
| `ringSize` | `number` | `18` | `ring` 的直径（px）。 |
| `ringThickness` | `number` | `2` | `ring` 的线宽（px）。 |
| `circleDashSize` | `number` | `18` | `circle-dash` 的直径（px）。 |
| `circleDashThickness` | `number` | `2` | `circle-dash` 的线宽（px）。 |
| `circleDashDashDeg` | `number` | `12` | `circle-dash` 的虚线段角度（deg）。 |
| `circleDashGapDeg` | `number` | `12` | `circle-dash` 的间隔角度（deg）。 |
| `barsSize` | `number` | `12` | `bars` 的高度（px）。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-typing-indicator-color` | `--tx-text-color-secondary` | 所有变体的颜色，一处即可改色。 |

## 概述

- 根节点为 `role="status"`、`aria-live="polite"`；指示器图形均为 `aria-hidden`。
- `showText` 关闭时仍渲染视觉隐藏的文案（`ariaLabel`，缺省时为 `text`），读屏照常朗读。

## 技术实现

- `ai` 变体用 SVG mask 绘制，mask id 按实例生成，同页多个实例互不干扰。
- 源码：`packages/tuffex/packages/components/src/chat/src/TxTypingIndicator.vue`。

<TuffDocSourceLink path="packages/tuffex/packages/components/src/chat/index.ts" />

## 离线完整示例源码

- [TypingIndicatorTypingIndicatorDemo](../snapshot/apps/nexus/app/components/content/demos/TypingIndicatorTypingIndicatorDemo.vue.txt)
- [TypingIndicatorTypingIndicatorVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/TypingIndicatorTypingIndicatorVariantsDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
