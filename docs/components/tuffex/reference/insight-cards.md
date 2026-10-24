# InsightCards 洞察卡

> 逐页展示结论、证据与追问的洞察卡

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/insight-cards) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/insight-cards.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/insight-cards.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 完整案例
组件只负责标题、翻页、结论与追问；卡片内容由默认插槽提供，如 `TxSparkChart`、`TxChartScrubber`、`TxAllocationBar`。
官方示例：`InsightCardsInsightCardsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const page = ref(0)
const pages = [
  { key: 'compare', prose: '表现最差的是 Rocky Road —— 下跌 6%。', suggestion: '要不要重新配比口味？' },
  { key: 'allocation', prose: '你在香草上压得很重 —— 它占了整箱的 72.5%。', suggestion: '只看季节限定会怎样？' },
]
</script>

<template>
  <TxInsightCards v-model:active-index="page" :pages="pages" @follow-up="ask($event)">
    <template #default="{ page: current }">
      <FlavourCard :key="current.key" />
    </template>
  </TxInsightCards>
</template>
```

### 指标块
`value` 走默认格式化时，负号是 U+2212（`−`），在 `tabular-nums` 下与数字对齐。
官方示例：`InsightCardsInsightMetricDemo`（完整源码见本页末尾）

```vue
<template>
  <TxInsightMetric
    label="薄荷脆片"
    color="var(--tx-bui-orange)"
    :value="-4.41"
    detail="−$2,377.66"
  />
  <TxInsightMetric
    label="开心果"
    color="var(--tx-bui-accent)"
    :value="1.15"
    detail="+$617.22"
  />
</template>
```

### 最佳实践

- 一页只讲一件事：一句结论、一张证据卡、一个可执行的追问。
- 结论里的实体提及与行内数字走 `prose` 插槽；`page.prose` 只收纯文本。
- 卡片内容自己控高，否则翻页时页面会随内容跳动。
- 在插槽里给卡片加 `:key="page.key"`，翻页时才会重建，图表才会重绘。
- 追问写成用户会问的原话，而不是「了解更多」。

## API 参考

### TxInsightCards

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `pages` | `InsightPage[]` | — | 页数据 `{ key, prose?, suggestion? }`。 |
| `activeIndex` | `number` | — | 当前页，越界时夹回有效范围；省略则组件自持。 |
| `title` | `string` | `'Insights'` | 头部标题。 |
| `showCount` | `boolean` | `true` | 在标题旁显示总页数。 |
| `loop` | `boolean` | `true` | 首尾环绕；关闭后两端按钮禁用。 |
| `previousLabel` / `nextLabel` | `string` | `'Previous insight'` / `'Next insight'` | 翻页按钮的可访问名称。 |

#### 事件

| 事件名 | 回调参数 | 说明 |
|------|------|------|
| `update:activeIndex` | `(index: number)` | 翻页时触发。 |
| `change` | `(page, index)` | 与 `update:activeIndex` 同时触发，带页对象。 |
| `followUp` | `(page)` | 点击追问 pill 时触发。 |

#### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `default` | `{ page, index }` | 卡片主体。 |
| `prose` | `{ page, index }` | 富文本结论，替换 `page.prose`。 |
| `follow-up` | `{ page, index }` | 替换追问 pill。 |

#### 暴露方法

| 方法名 | 说明 |
|------|------|
| `previous()` / `next()` / `goTo(index)` | 命令式翻页，与按钮走同一路径。 |

### TxInsightMetric

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `label` | `string` | — | 标签文案。 |
| `color` | `string` | — | 标签前的色点；不传则不渲染。 |
| `value` | `number` | — | 带符号的大数，走默认格式化。 |
| `delta` | `string` | — | 预格式化的大数，原样输出，优先于 `value`。 |
| `unit` | `string` | `'%'` | 默认格式化追加的单位。 |
| `precision` | `number` | `2` | 默认格式化的小数位。 |
| `detail` | `string` | — | 等宽副行，原样输出；负号由宿主写成 `−`。 |
| `tone` | `'positive' \| 'negative' \| 'neutral'` | — | 覆盖由符号推导的色调。 |
| `formatter` | `(value: number) => string` | — | 完全接管数字格式化。 |

## 概述

- 不传 `activeIndex` 时组件自己翻页；传入后完全由宿主控制。
- 翻页是硬切，没有过渡，也没有自动播放；需要过渡时把默认插槽的内容包进自己的 `<Transition>`。
- `loop` 关闭时端点按钮带原生 `disabled`；`pages` 为空时只渲染头部，两个按钮都禁用。
- 没有 `suggestion` 的页不渲染追问 pill。
- `TxInsightMetric` 的色调缺省由符号推导：正为绿，负为红，零为中性。
- 大数与页数使用 `tabular-nums`，翻页时数字宽度不跳。

## 技术实现

- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/insight-cards/`。

## 离线完整示例源码

- [InsightCardsInsightCardsDemo](../snapshot/apps/nexus/app/components/content/demos/InsightCardsInsightCardsDemo.vue.txt)
- [InsightCardsInsightMetricDemo](../snapshot/apps/nexus/app/components/content/demos/InsightCardsInsightMetricDemo.vue.txt)

## 离线类型与实现参考

- [insight-cards/index.ts](../snapshot/packages/tuffex/packages/components/src/insight-cards/index.ts.txt)
- [src/TxInsightCards.vue](../snapshot/packages/tuffex/packages/components/src/insight-cards/src/TxInsightCards.vue.txt)
- [src/TxInsightMetric.vue](../snapshot/packages/tuffex/packages/components/src/insight-cards/src/TxInsightMetric.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/insight-cards/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
