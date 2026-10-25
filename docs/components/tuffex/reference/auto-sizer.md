# AutoSizer 自适应尺寸

> 随内容变化平滑调整宽高的容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/auto-sizer) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/auto-sizer.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/auto-sizer.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 仅高度
只同步高度，外围布局保持原宽度；状态切换包在 `action()` 里。
官方示例：`AutoSizerAutoSizerHeightDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const active = ref<'a' | 'b'>('a')
const sizerRef = ref()

function setTab(next: 'a' | 'b') {
  sizerRef.value?.action(() => {
    active.value = next
  })
}
</script>

<template>
  <TxButton @click="setTab('a')">Tab A</TxButton>
  <TxButton @click="setTab('b')">Tab B</TxButton>

  <TxAutoSizer ref="sizerRef" :width="false" :duration-ms="250">
    <div v-if="active === 'a'">Short content.</div>
    <div v-else>Long content…</div>
  </TxAutoSizer>
</template>
```

### flex 容器内的宽度
作为 flex 子项时，不要用 `flex: 1` 或 `width: 100%` 撑满它，否则宽度不再跟随内容。
官方示例：`AutoSizerAutoSizerWidthInFlexDemo`（完整源码见本页末尾）

```vue
<template>
  <div style="display: flex; gap: 12px;">
    <TxButton @click="toggle">Toggle</TxButton>

    <TxAutoSizer ref="sizerRef" :height="false">
      <TxButton variant="secondary">
        {{ wide ? 'Very very long label' : 'Short' }}
      </TxButton>
    </TxAutoSizer>

    <div style="flex: 1;">Right Area</div>
  </div>
</template>
```

### 仅宽度
只同步宽度时自动收缩到内容宽度，适合按钮文案变化。
官方示例：`AutoSizerAutoSizerWidthDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAutoSizer ref="sizerRef" :height="false">
    <TxButton :loading="loading" variant="primary">Submit</TxButton>
  </TxAutoSizer>
</template>
```

### 数字过渡
搭配 `TxTextMorph`，位数变化时宽度同步过渡。
官方示例：`AutoSizerAutoSizerTextMorphDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAutoSizer ref="sizerRef" :height="false">
    <TxButton variant="secondary">
      $ <TxTextMorph :text="value" :decimals="2" />
    </TxButton>
  </TxAutoSizer>
</template>
```

### 文本变换
宽高同时跟随；默认的 `outerClass="overflow-hidden"` 裁掉 blur 的边缘溢出。
官方示例：`AutoSizerAutoSizerTextTransformerDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAutoSizer
    ref="sizerRef"
    inline
    :duration-ms="duration"
    easing="cubic-bezier(0.2, 0, 0, 1)"
  >
    <TxCard variant="plain" :padding="12">
      <TxTextTransformer :text="label" :duration-ms="duration" :blur-px="blurPx" />
    </TxCard>
  </TxAutoSizer>
</template>
```

### 最佳实践

- 内容区（Tabs、Accordion、下拉）只同步高度；按钮、标签、数字只同步宽度。
- 内容带 blur、scale 或 FLIP 动效时保留 `outerClass="overflow-hidden"`。
- 明确的状态切换包在 `action()` 或 `flip()` 里，不要改完状态再调 `refresh()`，否则拿不到过渡所需的前后快照。
- 只有外层与内层会各自变化尺寸时才设 `observeTarget="both"`。
- 文本保持 `rounding="ceil"`，避免亚像素裁切；父级需要更紧的边界时再用 `floor`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `as` | `string` | `div` | 外层标签。 |
| `innerAs` | `string` | `div` | 内层标签。 |
| `width` | `boolean` | `true` | 同步宽度。 |
| `height` | `boolean` | `true` | 同步高度。 |
| `inline` | `boolean` | - | 收缩到内容宽度；省略时仅在只同步宽度时启用。 |
| `durationMs` | `number` | `200` | 过渡时长（ms）。 |
| `easing` | `string` | `ease` | 过渡曲线。 |
| `outerClass` | `string` | `overflow-hidden` | 外层 class，排在透传的 class 之前。 |
| `innerClass` | `string` | - | 内层 class。 |
| `rounding` | `'none' \| 'round' \| 'floor' \| 'ceil'` | `ceil` | 测量值的取整方式。 |
| `immediate` | `boolean` | `true` | 挂载后立即测量。 |
| `rafBatch` | `boolean` | `true` | 用 rAF 合并测量。 |
| `observeTarget` | `'inner' \| 'outer' \| 'both'` | `inner` | 自动监听尺寸变化的元素。 |

### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | 被测量的内容，渲染在内层中。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `refresh()` | `() => Promise<void>` | 重新测量。 |
| `flip(action)` | `(action: () => void \| Promise<void>) => Promise<void>` | 执行 `action` 并做一次尺寸 FLIP 过渡。 |
| `action(fn, options?)` | `(fn: (el: HTMLElement) => void \| Promise<void>, options?: AutoSizerActionOptions \| detect) => Promise<any>` | 对内层或外层执行变更并过渡，返回前后快照与 `changedKeys`。 |
| `size` | `{ width: number; height: number } \| null` | 最近一次测量结果。 |
| `focus()` | `() => void` | 外层可聚焦时聚焦它。 |
| `outerEl` | `HTMLElement \| null` | 外层元素。 |

## 概述

- 透传的 attrs 落在外层，与 `outerClass` 和尺寸样式合并；内层包裹被测内容，使用 `display: flow-root`。
- 内容尺寸变化（含图片加载、异步渲染）时自动重新测量。
- `flip()` 与 `action()` 执行期间暂停自动测量，过渡结束后重新测量。

## 技术实现

- 自动测量基于 `ResizeObserver`，显式切换走尺寸 FLIP。
- 源码：`packages/tuffex/packages/components/src/auto-sizer/`。

## 离线完整示例源码

- [AutoSizerAutoSizerHeightDemo](../snapshot/apps/nexus/app/components/content/demos/AutoSizerAutoSizerHeightDemo.vue.txt)
- [AutoSizerAutoSizerWidthInFlexDemo](../snapshot/apps/nexus/app/components/content/demos/AutoSizerAutoSizerWidthInFlexDemo.vue.txt)
- [AutoSizerAutoSizerWidthDemo](../snapshot/apps/nexus/app/components/content/demos/AutoSizerAutoSizerWidthDemo.vue.txt)
- [AutoSizerAutoSizerTextMorphDemo](../snapshot/apps/nexus/app/components/content/demos/AutoSizerAutoSizerTextMorphDemo.vue.txt)
- [AutoSizerAutoSizerTextTransformerDemo](../snapshot/apps/nexus/app/components/content/demos/AutoSizerAutoSizerTextTransformerDemo.vue.txt)

## 离线类型与实现参考

- [auto-sizer/index.ts](../snapshot/packages/tuffex/packages/components/src/auto-sizer/index.ts.txt)
- [src/TxAutoSizer.vue](../snapshot/packages/tuffex/packages/components/src/auto-sizer/src/TxAutoSizer.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/auto-sizer/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
