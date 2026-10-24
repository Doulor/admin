# TextMorph 文本形变

> 只让变化的字符段动起来的文本形变

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/text-morph) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/text-morph.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/text-morph.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
只有真正变化的字符段会动，容器宽高与字符同曲线过渡。
官方示例：`TextMorphTextMorphDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const phrases = [
  'Hello world',
  'Hello there',
  'Goodbye there',
  'Goodbye and thanks for all the fish',
]

const index = ref(0)
const phrase = computed(() => phrases[index.value] ?? '')

function next() {
  index.value = (index.value + 1) % phrases.length
}
</script>

<template>
  <TxButton @click="next">Next phrase</TxButton>
  <TxTextMorph :text="phrase" :duration-ms="400" />
</template>
```

### 数字位值
数字按位值而非从左到右匹配：`1,204 → 1,318` 只滚百位和十位，千位不动。
官方示例：`TextMorphNumberPlaceValueDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const total = ref(1204)
</script>

<template>
  <!-- 1,204 -> 1,318 滚百位和十位，千位不动 -->
  <TxTextMorph :text="`$${total.toLocaleString('en')}`" />

  <!-- 直接传数字时，locale 与 decimals 负责格式化 -->
  <TxTextMorph :text="total" locale="en" :decimals="2" />
</template>
```

### 弹簧
`spring` 接预设名或物理系数，同时决定曲线与时长；设了之后忽略 `durationMs` 与 `easing`。
官方示例：`TextMorphSpringDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTextMorph text="Settling" spring="snappy" />
  <TxTextMorph text="Settling" spring="smooth" />
  <TxTextMorph text="Settling" spring="bouncy" />
  <TxTextMorph text="Settling" :spring="{ stiffness: 200, damping: 20 }" />
</template>
```

### 最佳实践

- 计数器、金额、百分比这类「同一个量在变」的值优先用它。
- 输入框里跟随键入的数字要传 `cursorIndex`，否则在 `20` 前插一位会被当成整列重新编号。
- 需要软换行或省略号截断时用 `TxTextTransformer` 的 `mode="fade"`；这里只有 `\n` 会换行。
- 同一屏不要放太多高频实例，每个字符都是带 `will-change` 的元素。
- 不要再套 `TxAutoSizer`，引擎自己动画容器宽高。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `text` | `string \| number` | - | 要渲染的值；数字先按 `locale` 与 `decimals` 格式化。 |
| `tag` | `string` | `span` | 根节点标签。 |
| `durationMs` | `number` | `400` | 形变时长（ms）；设了 `spring` 时忽略。 |
| `easing` | `string` | `cubic-bezier(0.19, 1, 0.22, 1)` | CSS 缓动函数；设了 `spring` 时忽略。 |
| `spring` | `'snappy' \| 'smooth' \| 'bouncy' \| { stiffness?, damping?, mass? }` | - | 弹簧物理，同时决定曲线与时长。 |
| `scale` | `boolean` | `true` | 离场段是否带缩放。 |
| `numbers` | `boolean` | `true` | 数字按位值滚动；关闭后退回字符级形变。 |
| `decimals` | `number` | - | 小数位数，仅当 `text` 是数字时生效。 |
| `locale` | `string` | `en` | 用于分段与数字格式化。 |
| `cursorIndex` | `number` | - | 光标位置；值里恰好一个数字时改用光标匹配。 |
| `disabled` | `boolean` | `false` | 跳过动画，直接写入值。 |
| `respectReducedMotion` | `boolean` | `true` | 把减少动态效果当作 `disabled`。 |
| `debug` | `boolean` | `false` | 给根节点和每个段描边，便于排查。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `animation-start` | - | 一次形变开始；首帧渲染不触发。 |
| `animation-complete` | - | 形变走完；每次形变与 `animation-cancel` 恰好触发其一。 |
| `animation-cancel` | - | 形变被下一次更新打断。 |

## 概述

- 动效单位是字符段而非整串：存活的段 FLIP 到新位置，新增的段从最近的锚点淡入，离场的段脱离文档流后淡出。
- 完整值在视觉隐藏的 `[tx-morph-sr]` 节点里，段元素都是 `aria-hidden`，屏幕阅读器只读一次完整值。
- 可选中的段保留原文空白（NBSP、连续空格、制表符、换行、组合字符）；离场段不参与选择，复制不会混入上一轮文本。
- 数字的千分位逗号跟着量级走；量级跳跃达到 3 位及以上时不再携带数字，整体替换。
- 形变中途再次更新会把当前速度带进新曲线，高频更新不会停在起步阶段。
- 减少动态效果或 `disabled` 时直接写入 `textContent`，并清空内部段记录。

## 技术实现

- 引擎命令式创建并接管段元素（首帧纯文本只为 SSR 水合），所以样式不是 scoped，靠 `tx-morph-*` 属性名隔离。
- 引擎（另导出为 `TextMorphEngine` / `MorphController`）移植自 [lochie/torph](https://github.com/lochie/torph)（MIT），弹簧层换成与 `TxLiquid` 共用的 `liquid/src/spring.ts`。
- 源码：`packages/tuffex/packages/components/src/text-morph/`。

## 离线完整示例源码

- [TextMorphTextMorphDemo](../snapshot/apps/nexus/app/components/content/demos/TextMorphTextMorphDemo.vue.txt)
- [TextMorphNumberPlaceValueDemo](../snapshot/apps/nexus/app/components/content/demos/TextMorphNumberPlaceValueDemo.vue.txt)
- [TextMorphSpringDemo](../snapshot/apps/nexus/app/components/content/demos/TextMorphSpringDemo.vue.txt)

## 离线类型与实现参考

- [text-morph/index.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/index.ts.txt)
- [src/TxTextMorph.vue](../snapshot/packages/tuffex/packages/components/src/text-morph/src/TxTextMorph.vue.txt)
- [engine/animate-group.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/animate-group.ts.txt)
- [engine/animate-number.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/animate-number.ts.txt)
- [engine/animate-text.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/animate-text.ts.txt)
- [engine/constants.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/constants.ts.txt)
- [engine/container.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/container.ts.txt)
- [engine/controller.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/controller.ts.txt)
- [engine/diff.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/diff.ts.txt)
- [engine/dom.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/dom.ts.txt)
- [engine/flip.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/flip.ts.txt)
- [engine/index.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/index.ts.txt)
- [engine/lcs.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/lcs.ts.txt)
- [engine/metrics.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/metrics.ts.txt)
- [engine/morph.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/morph.ts.txt)
- [engine/number.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/number.ts.txt)
- [engine/reduced-motion.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/reduced-motion.ts.txt)
- [engine/segment.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/segment.ts.txt)
- [engine/types.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/engine/types.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/text-morph/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
