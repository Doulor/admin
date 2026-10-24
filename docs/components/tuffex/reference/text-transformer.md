# TextTransformer 文本变换

> 逐字形变或整串交叉淡化的短文本过渡

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/text-transformer) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/text-transformer.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/text-transformer.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
文字颜色随值变化时写在根节点上，`fade` 的旧层会带着旧颜色淡出。
官方示例：`TextTransformerTextTransformerDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTextTransformer
    mode="fade"
    :text="text"
    :duration-ms="320"
    :blur-px="10"
    :style="{ color: accent ? 'var(--tx-color-primary)' : 'var(--tx-text-color-primary)' }"
  />
</template>
```

### morph 与 fade
默认 `morph` 逐字形变、数字按位值滚动；`fade` 是整串 blur 交叉淡化，`blurPx` 只在 `fade` 下生效。
官方示例：`TextTransformerMorphVsFadeDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const stages = ['Connecting', 'Connected', 'Syncing 12 files', 'Syncing 148 files', 'Up to date']
const index = ref(0)
const stage = computed(() => stages[index.value] ?? '')
</script>

<template>
  <!-- 默认：逐字形变，数字按位值滚动 -->
  <TxTextTransformer :text="stage" :duration-ms="320" />

  <!-- 原来的整串 blur 交叉淡化 -->
  <TxTextTransformer :text="stage" mode="fade" :duration-ms="320" :blur-px="10" />
</template>
```

### 与 AutoSizer 搭配
放进 `TxAutoSizer` 并用 `action(() => …)` 包住切换，宽高随文本平滑过渡；`wrap=false` 时溢出部分被裁剪。
官方示例：`TextTransformerAutoSizerTextTransformerDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const sizerRef = ref<any>(null)
const label = ref('Short')

function toggle() {
  void sizerRef.value?.action?.(() => {
    label.value = label.value === 'Short'
      ? 'Very very long label (blur + fade) that will be clipped while resizing'
      : 'Short'
  })
}
</script>

<template>
  <TxButton @click="toggle">Toggle</TxButton>
  <TxAutoSizer
    ref="sizerRef"
    :width="true"
    :height="true"
    :inline="true"
    :duration-ms="360"
    outer-class="overflow-hidden"
  >
    <TxTextTransformer mode="fade" :text="label" :duration-ms="360" />
  </TxAutoSizer>
</template>
```

### 长文本 / 章节切换
`wrap` 让多行文本按 `pre-line` 换行，并强制走 `fade`。
官方示例：`TextTransformerLongTextChapterDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAutoSizer ref="sizerRef" :width="true" :height="true" :duration-ms="380" outer-class="overflow-hidden">
    <TxTextTransformer :text="chapter" :duration-ms="380" :blur-px="12" wrap />
  </TxAutoSizer>
</template>
```

### 标题与副标题
官方示例：`TextTransformerTitleSubtitleDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAutoSizer ref="sizerRef" :width="true" :height="true" :inline="true" :duration-ms="320" outer-class="overflow-hidden">
    <TxTextTransformer mode="fade" :text="title" :duration-ms="320" />
    <TxTextTransformer mode="fade" :text="subtitle" :duration-ms="320" />
  </TxAutoSizer>
</template>
```

### 状态文本
官方示例：`TextTransformerStatusTextDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAutoSizer ref="sizerRef" :width="true" :height="true" :inline="true" :duration-ms="280" outer-class="overflow-hidden">
    <span class="dot" :style="{ background: color }" />
    <TxTextTransformer mode="fade" :text="label" :duration-ms="280" :style="{ color }" />
  </TxAutoSizer>
</template>
```

### 最佳实践

- 用于标签、标题、徽标与偶发状态变化，不要用于逐字流式输出或每帧变化的计数器。
- 只要形变时直接用 `TxTextMorph`，它另有弹簧、`numbers`、`locale` 与 `cursorIndex`。
- 与 `TxAutoSizer` 组合时让两者时长一致；`morph` 自己动画宽高，多数场景不需要外层 sizer。
- 按钮、徽标等紧凑场景保持 `wrap=false`，段落或章节切换才开 `wrap`。
- 插槽内容保持轻量，并只依赖传入的 `text`：`fade` 过渡期间新旧两层各渲染一份。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `text` | `string \| number` | - | 当前值，经 `String(...)` 归一化。 |
| `mode` | `'morph' \| 'fade'` | `morph` | `morph` 逐字形变；`fade` 整串 blur 交叉淡化。 |
| `durationMs` | `number` | `240` | 过渡时长（ms）；`fade` 下也决定旧层何时移除。 |
| `blurPx` | `number` | `8` | 交叉淡化的模糊距离，仅 `fade` 生效。 |
| `tag` | `string` | `span` | 根节点标签。 |
| `wrap` | `boolean` | `false` | 多行文本按 `pre-line` 换行，并强制 `fade`。 |

### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | `{ text: string }` | 当前层与旧层共用的文本渲染器；使用时强制 `fade`。 |

## 概述

- 用了默认插槽或开了 `wrap` 时忽略 `mode`，强制走 `fade`：引擎只能形变纯文本，且只在单行上度量。
- 根节点带 `aria-live="polite"`；`morph` 下完整值在视觉隐藏的 `[tx-morph-sr]` 节点里，`fade` 下旧层 `aria-hidden`，只宣告当前文本。
- `fade` 且 `wrap=false` 时单行省略；`morph` 下根节点 `overflow: visible`，离场段不被截断，因此不做省略。
- `fade` 下新层先落在透明加模糊的准备态，强制提交一次样式后下一帧开始过渡；旧层在 `durationMs + 34ms` 后移除。
- 新一轮变化会取消上一轮的 timer 与动画帧，旧过渡不会误删当前层。
- 减少动态效果时两层都不过渡，新文字直接替换。

## 技术实现

- `morph` 渲染 [TextMorph 文本形变](./text-morph.md) 的 `TxTextMorph`；`fade` 渲染新旧两层，由 `--tx-tt-duration` 与 `--tx-tt-blur` 驱动 CSS 过渡。
- 源码：`packages/tuffex/packages/components/src/text-transformer/`。

## 离线完整示例源码

- [TextTransformerTextTransformerDemo](../snapshot/apps/nexus/app/components/content/demos/TextTransformerTextTransformerDemo.vue.txt)
- [TextTransformerMorphVsFadeDemo](../snapshot/apps/nexus/app/components/content/demos/TextTransformerMorphVsFadeDemo.vue.txt)
- [TextTransformerAutoSizerTextTransformerDemo](../snapshot/apps/nexus/app/components/content/demos/TextTransformerAutoSizerTextTransformerDemo.vue.txt)
- [TextTransformerLongTextChapterDemo](../snapshot/apps/nexus/app/components/content/demos/TextTransformerLongTextChapterDemo.vue.txt)
- [TextTransformerTitleSubtitleDemo](../snapshot/apps/nexus/app/components/content/demos/TextTransformerTitleSubtitleDemo.vue.txt)
- [TextTransformerStatusTextDemo](../snapshot/apps/nexus/app/components/content/demos/TextTransformerStatusTextDemo.vue.txt)

## 离线类型与实现参考

- [text-transformer/index.ts](../snapshot/packages/tuffex/packages/components/src/text-transformer/index.ts.txt)
- [src/TxTextTransformer.vue](../snapshot/packages/tuffex/packages/components/src/text-transformer/src/TxTextTransformer.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/text-transformer/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
