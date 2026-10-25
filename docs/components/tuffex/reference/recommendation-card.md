# RecommendationCard 建议卡

> 带置信度的智能体建议卡

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/recommendation-card) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/recommendation-card.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/recommendation-card.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 建议与备选
在抽屉里选中一条备选，会把它提升为当前建议、关闭抽屉，并清空已确认态。
官方示例：`RecommendationCardConfidenceDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const active = ref('high')
const options = [
  {
    key: 'high',
    short: '从 cone_king 补货 · 7 天交期',
    confidence: 'high',
    label: '高置信',
    cta: '接受',
    ctaTone: 'accent',
  },
  {
    key: 'review',
    short: '换成 vanilla_madagascar',
    confidence: 'medium',
    label: '需要复核',
    cta: '去配置',
  },
]
</script>

<template>
  <TxRecommendationCard
    v-model="active"
    title="要我下这笔补货单吗？"
    :options="options"
    @accept="run"
  >
    <template #body="{ option }">
      从 <mark style="--tx-entity-color: #ef720c">Cone King</mark>
      补货华夫筒，交期 <code class="is-success">7 天</code>。
    </template>
  </TxRecommendationCard>
</template>
```

### 最佳实践

- `short` 写成能独立读懂的一句话：抽屉里只显示它。
- 高风险动作用 `ctaTone: 'danger'`，让主按钮的分量与后果相称。
- 把 `accepted` 提到宿主，请求成功后再置为 `true`，否则用户会以为已经下单。
- 备选控制在两三条；更多时改用列表页。
- 二元的允许 / 拒绝用 `TxToolConfirmation`；本组件用于带置信度的多选建议。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | — | 卡片标题，通常是一句待确认的问句，必填。 |
| `options` | `RecommendationOption[]` | — | 方案列表，必填：`{ key, text?, short, confidence?, signal?, tone?, label, cta?, ctaTone? }`。 |
| `modelValue` | `string` | 首项的 `key` | 当前建议的 key，配合 `v-model`。 |
| `open` | `boolean` | — | 备选抽屉，配合 `v-model:open`；不传则组件自持。 |
| `accepted` | `boolean` | — | 是否已确认，配合 `v-model:accepted`；只切换文案与配色，没有撤销。 |
| `alternativesLabel` | `string` | `'Alternatives'` | 抽屉触发按钮的文案。 |
| `otherOptionsLabel` | `string` | `'Other options'` | 抽屉内的小标题。 |
| `acceptedLabel` | `string` | `'Accepted'` | 确认后的主按钮文案。 |
| `acceptLabel` | `string` | `'Accept'` | 方案没有 `cta` 时的主按钮文案。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(key: string)` | 当前建议变化时触发。 |
| `update:open` | `(open: boolean)` | 抽屉开合时触发。 |
| `update:accepted` | `(accepted: boolean)` | 确认态变化时触发。 |
| `accept` | `(option: RecommendationOption)` | 按下主按钮时触发，携带完整方案。 |
| `select` | `(option: RecommendationOption)` | 在抽屉里选中备选时触发。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `body` | `{ option }` | 替换正文；`<code>` 放标识符，`<mark>` 放实体。 |
| `meter` | `{ option }` | 替换量表，页脚与抽屉每行都会用到。 |
| `footer-extra` | — | 插在页脚左侧、动作按钮之前。 |

## 置信度映射

| `confidence` | 量表格数 | 默认颜色 |
|------|------|------|
| `high` | 3 | `--tx-bui-green` |
| `medium` | 2 | `--tx-bui-orange` |
| `low` | 1 | `--tx-bui-red` |
| `none`（默认） | 0 | `--tx-bui-ink-3` |

`signal` 与 `tone` 分别覆盖格数与颜色；`tone` 是裸 CSS 颜色，不随主题切换，优先用 `confidence`。

## 概述

- 抽屉只列其他方案，当前建议不会重复出现。
- 收起的抽屉带 `inert`，其中的按钮移出焦点顺序与无障碍树。
- 正文有最小高度（默认 48px），切换不同长度的方案时卡片不跳动；用 `--tx-bui-recommendation-card-body-min-height` 调整。
- `body` 里的 `<code>` 渲染为强调色标识符，`is-success` / `is-warning` 切换为语义色；`<mark>` 渲染为带色点的实体胶囊，色点取 `--tx-entity-color`，缺省为中性灰。

## 技术实现

- 页脚与抽屉每行的量表是 `TxSignalMeter`，可单独使用。
- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/recommendation-card/`。

## 离线完整示例源码

- [RecommendationCardConfidenceDemo](../snapshot/apps/nexus/app/components/content/demos/RecommendationCardConfidenceDemo.vue.txt)

## 离线类型与实现参考

- [recommendation-card/index.ts](../snapshot/packages/tuffex/packages/components/src/recommendation-card/index.ts.txt)
- [src/TxRecommendationCard.vue](../snapshot/packages/tuffex/packages/components/src/recommendation-card/src/TxRecommendationCard.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/recommendation-card/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
