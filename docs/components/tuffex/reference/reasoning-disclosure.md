# Reasoning Disclosure

> 可折叠的推理过程区域

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/reasoning-disclosure) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/reasoning-disclosure.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/reasoning-disclosure.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
耗时只在 `streaming` 为假且传了 `durationMs` 时显示。
官方示例：`ReasoningDisclosureReasoningDisclosureDemo`（完整源码见本页末尾）

```vue
<template>
  <TxReasoningDisclosure streaming text="正在拆解这个问题…" />

  <TxReasoningDisclosure
    :duration-ms="4200"
    default-open
    text="先确认输入边界，再挑选算法。"
  />
</template>
```

### 最佳实践

- 默认保持折叠：展开的推理会把回答挤出首屏。
- 流式结束时一并传入 `durationMs` 并把 `streaming` 置为 `false`。
- 需要跨会话记住展开状态时，在外层持有状态并用 `key` 重建组件。
- 本地化时同时覆盖 `label`、`thinkingLabel` 与 `durationFormatter`。
- 正文只渲染纯文本；需要 Markdown 时与 `TxStreamMarkdown` 自行组合。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `text` | `string` | `''` | 推理正文，按纯文本渲染并保留换行。 |
| `streaming` | `boolean` | `false` | 仍在输出；切换头部文案与图标，正文跟随末尾滚动。 |
| `durationMs` | `number` | — | 思考耗时（毫秒）。 |
| `defaultOpen` | `boolean` | `false` | 初始是否展开，只在挂载时读取。 |
| `label` | `string` | `'Reasoning'` | 结束后的头部文案。 |
| `thinkingLabel` | `string` | `'Thinking…'` | 流式时的头部文案。 |
| `durationFormatter` | `(ms: number) => string` | — | 自定义耗时文案；缺省为 `Thought for X.Xs`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `toggle` | `(open: boolean)` | 点击头部时触发，参数为切换后的状态。 |

## 概述

- 流式时 `text` 每次变化都把正文滚到底部；非流式时不干预滚动位置。
- 头部是原生 `<button>`，带 `aria-expanded` 与指向正文的 `aria-controls`；图标为 `aria-hidden`。
- 折叠只是收起正文，内容仍挂载在 DOM 中。

## 离线完整示例源码

- [ReasoningDisclosureReasoningDisclosureDemo](../snapshot/apps/nexus/app/components/content/demos/ReasoningDisclosureReasoningDisclosureDemo.vue.txt)

## 离线类型与实现参考

- [reasoning-disclosure/index.ts](../snapshot/packages/tuffex/packages/components/src/reasoning-disclosure/index.ts.txt)
- [src/TxReasoningDisclosure.vue](../snapshot/packages/tuffex/packages/components/src/reasoning-disclosure/src/TxReasoningDisclosure.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
