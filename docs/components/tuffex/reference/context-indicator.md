# Context Indicator

> 显示对话上下文用量的环形指示器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/context-indicator) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/context-indicator.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/context-indicator.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
占比超过 80% 进入 `warning`，超过 95% 进入 `danger`；档位写在 `data-level` 上，可据此覆盖样式。
官方示例：`ContextIndicatorContextIndicatorDemo`（完整源码见本页末尾）

```vue
<template>
  <TxContextIndicator :used-tokens="12300" :max-tokens="200000" />
  <TxContextIndicator :used-tokens="172000" :max-tokens="200000" />
  <TxContextIndicator :used-tokens="196000" :max-tokens="200000" />
</template>
```

### 最佳实践

- `maxTokens` 用模型的真实窗口值，不要写死常量。
- 本地化数字用 `formatter`，不要在外面另包文字，否则会与 `title` 中的值脱节。
- 从 `warning` 档起才提示用户；常态下它只是背景信息。
- 放进可点击区域时，在外层补充可访问名称：`role="meter"` 不表达可点击。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `usedTokens` | `number` | — | 已用的 token 数，必填。 |
| `maxTokens` | `number` | — | 上下文窗口上限，必填；≤ 0 时占比按 0 处理。 |
| `label` | `string` | `'Context usage'` | 可访问名称，写入 `aria-label`。 |
| `formatter` | `(used: number, max: number) => string` | — | 自定义环旁文字；缺省为紧凑记数（`12.3K`、`1.2M`）。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `detail` | `{ ratio: number, used: number, max: number }` | 追加在文字之后，放百分比、剩余量或「清空上下文」入口。 |

## 概述

- 占比为 `usedTokens / maxTokens`，夹在 0~1 之间：超发不会画出超过整圈的弧。
- `title` 恒为「文字 (百分比)」，自定义 `formatter` 后悬停仍能看到百分比。
- 根节点为 `role="meter"`，同步 `aria-valuemin` / `aria-valuemax` / `aria-valuenow`；SVG 为 `aria-hidden`。

## 离线完整示例源码

- [ContextIndicatorContextIndicatorDemo](../snapshot/apps/nexus/app/components/content/demos/ContextIndicatorContextIndicatorDemo.vue.txt)

## 离线类型与实现参考

- [context-indicator/index.ts](../snapshot/packages/tuffex/packages/components/src/context-indicator/index.ts.txt)
- [src/TxContextIndicator.vue](../snapshot/packages/tuffex/packages/components/src/context-indicator/src/TxContextIndicator.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
