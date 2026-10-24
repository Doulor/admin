# Scroll 滚动

> 基于 BetterScroll 或原生滚动的滚动容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/scroll) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/scroll.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/scroll.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`ScrollScrollDemo`（完整源码见本页末尾）

```vue
<template>
  <TxScroll style="height: 220px;">
    <div v-for="i in 60" :key="i">Row {{ i }}</div>
  </TxScroll>
</template>
```

### 横向滚动
`direction` 选择滚动轴：`vertical`、`horizontal` 或 `both`。
官方示例：`ScrollScrollHorizontalDemo`（完整源码见本页末尾）

```vue
<template>
  <TxScroll direction="horizontal" style="height: 140px;">
    <div style="display: flex; gap: 12px; width: 920px;">
      <div v-for="i in 24" :key="i" style="min-width: 120px;">Col {{ i }}</div>
    </div>
  </TxScroll>
</template>
```

### 回弹与常显滚动条
内容不足一屏时，`scrollbarAlwaysVisible` 仍显示滚动条。
官方示例：`ScrollScrollBounceAlwaysShowScrollbarDemo`（完整源码见本页末尾）

```vue
<template>
  <TxScroll :bounce="true" :scrollbar-always-visible="true" style="height: 220px;">
    <div>Short content</div>
  </TxScroll>
</template>
```

### 滚动链
默认不把滚动传给外层；`scrollChaining` 让内层到达边界后继续滚动外层。
官方示例：`ScrollScrollScrollChainingDemo`（完整源码见本页末尾）

```vue
<template>
  <div style="height: 320px; overflow: auto;">
    <TxScroll style="height: 160px;">…</TxScroll>
    <TxScroll style="height: 160px;" :scroll-chaining="true">…</TxScroll>
  </div>
</template>
```

### 原生滚动
`native` 跳过 BetterScroll，容器结构不变。
官方示例：`ScrollScrollNativeDemo`（完整源码见本页末尾）

```vue
<template>
  <TxScroll native style="height: 220px;">
    <div v-for="i in 60" :key="i">Native Row {{ i }}</div>
  </TxScroll>
</template>
```

### 下拉刷新与上拉加载
监听 `pulling-down` / `pulling-up`；异步任务无论成败，都调用 `finishPullDown()` / `finishPullUp()`。
官方示例：`ScrollScrollPullDownPullUpDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const items = ref(Array.from({ length: 30 }, (_, i) => i + 1))
const scrollRef = ref()

async function onPullingDown() {
  try {
    await reload()
  }
  finally {
    scrollRef.value?.finishPullDown()
  }
}

async function onPullingUp() {
  try {
    await loadMore()
  }
  finally {
    scrollRef.value?.finishPullUp()
  }
}
</script>

<template>
  <TxScroll
    ref="scrollRef"
    style="height: 260px;"
    :pull-down-refresh="true"
    :pull-up-load="true"
    @pulling-down="onPullingDown"
    @pulling-up="onPullingUp"
  >
    <div v-for="i in items" :key="i">Item {{ i }}</div>
    <template #footer>上拉加载更多</template>
  </TxScroll>
</template>
```

### 最佳实践

- 普通文章或文档滚动用原生模式；需要一致的滚动条、滚轮桥接、回弹或下拉插件时才用 BetterScroll。
- 嵌套面板保持 `scrollChaining=false`，只在父子交接是刻意设计且已验证时开启。
- 子组件自带间距时（虚拟列表、表格、全出血媒体）设 `noPadding`。
- 横向或双轴内容给出确定的内容宽度，否则 BetterScroll 无法可靠判断横向溢出。
- 不要把大型可变对象塞进 `options`；已有 props 的行为用 props 配置。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `native` | `boolean` | `false` | 强制原生滚动，跳过 BetterScroll 初始化。 |
| `unified` | `boolean` | `false` | 强制 BetterScroll，覆盖 Safari / Chromium 的自动原生；`native` 仍优先。 |
| `nativeAutoFallback` | `boolean` | `true` | 在 macOS + Chromium `145+` 上自动改用原生滚动；不影响 Safari。 |
| `noPadding` | `boolean` | `false` | 去掉内容内边距；横向与双轴时内容宽度为 `max-content`。 |
| `scrollChaining` | `boolean` | `false` | 到达边界后把滚动交给外层。 |
| `direction` | `'vertical' \| 'horizontal' \| 'both'` | `'vertical'` | 滚动轴向。 |
| `scrollbar` | `boolean` | `true` | 启用 BetterScroll 滚动条插件；原生模式用浏览器滚动条。 |
| `scrollbarFade` | `boolean` | `true` | 滚动条闲置时淡出。 |
| `scrollbarInteractive` | `boolean` | `true` | 允许拖拽滚动条。 |
| `scrollbarAlwaysVisible` | `boolean` | `false` | 滚动条常显，适合回弹或内容不足一屏的场景。 |
| `scrollbarMinSize` | `number` | `18` | 滑块最小尺寸，写入 `--tx-scrollbar-min-size`。 |
| `probeType` | `0 \| 1 \| 2 \| 3` | `3` | BetterScroll `probeType`，决定 `scroll` 事件频率。 |
| `bounce` | `boolean` | `true` | 边界回弹与滚轮 overshoot。 |
| `click` | `boolean` | `true` | 透传 BetterScroll 的 `click` 选项。 |
| `wheel` | `boolean` | `true` | BetterScroll 模式的滚轮桥接；忽略 `ctrl` 滚轮。 |
| `refreshOnContentChange` | `boolean` | `true` | 内容变更后自动 `refresh()`。 |
| `pullDownRefresh` | `boolean \| Record<string, unknown>` | `false` | 启用下拉刷新；对象作为 BetterScroll 插件选项。 |
| `pullDownThreshold` | `number` | `70` | 触发 `pulling-down` 的下拉距离。 |
| `pullDownStop` | `number` | `56` | 刷新时的停留位置，仅 BetterScroll 模式生效。 |
| `pullUpLoad` | `boolean \| Record<string, unknown>` | `false` | 启用上拉加载；对象作为 BetterScroll 插件选项。 |
| `pullUpThreshold` | `number` | `0` | 触发 `pulling-up` 的距底阈值。 |
| `options` | `Record<string, unknown>` | `{}` | 额外的 BetterScroll 选项；`wheelOvershoot` 由组件自行消费。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `scroll` | `{ scrollTop: number; scrollLeft: number }` | 滚动时触发，参数为绝对偏移。 |
| `pulling-down` | - | 下拉刷新时触发；`finishPullDown()` 之前不再触发。 |
| `pulling-up` | - | 上拉加载时触发；`finishPullUp()` 之前不再触发。 |

### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | 主内容，渲染在 `.tx-scroll__content` 内。 |
| `header` | 主内容之前；原生模式在 `.tx-scroll__content` 之前，BetterScroll 模式在其内。 |
| `footer` | 主内容之后，常放加载状态。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `nativeScrollRef` | `Ref<HTMLElement \| null>` | 原生模式下的滚动元素。 |
| `scrollTo(x, y, time?)` | `(x: number, y: number, time?: number) => void` | 滚动到绝对偏移；`time` 仅 BetterScroll 模式生效。 |
| `getScrollInfo()` | `() => TxScrollInfo` | 当前偏移、滚动尺寸与可视尺寸。 |
| `refresh()` | `() => void` | 重新计算 BetterScroll 的可滚动范围；原生模式无操作。 |
| `finishPullDown()` | `() => void` | 结束本轮下拉，允许再次触发。 |
| `finishPullUp()` | `() => void` | 结束本轮上拉，允许再次触发。 |

## 概述

- 模式按优先级决定：`native` → `unified`（BetterScroll）→ macOS Safari 用原生 → `nativeAutoFallback` 且 macOS + Chromium ≥ 145 用原生 → 其余用 BetterScroll。
- 原生模式把 `direction` 映射为 `overflow-x/y`，`scrollChaining=false` 映射为 `overscroll-behavior: contain`；BetterScroll 模式映射为 `scrollX`、`scrollY` 与 `freeScroll`。
- 尺寸与内容变化合并到同一帧再 `refresh()`；`refreshOnContentChange=false` 只关闭内容变更刷新，尺寸刷新保留。
- 原生模式的下拉刷新是 `scrollTop=0` 时基于触摸阈值的降级实现。
- macOS 上同时开启 `wheel` 与 `bounce` 时默认注入 `useTransition: false`，可在 `options` 中覆盖。

## 技术实现

- BetterScroll 模式按需加载 `@better-scroll/core` 与 `@better-scroll/scroll-bar`，滚轮由组件自己的桥接处理。
- 源码：`packages/tuffex/packages/components/src/scroll/`。

## 离线完整示例源码

- [ScrollScrollDemo](../snapshot/apps/nexus/app/components/content/demos/ScrollScrollDemo.vue.txt)
- [ScrollScrollHorizontalDemo](../snapshot/apps/nexus/app/components/content/demos/ScrollScrollHorizontalDemo.vue.txt)
- [ScrollScrollBounceAlwaysShowScrollbarDemo](../snapshot/apps/nexus/app/components/content/demos/ScrollScrollBounceAlwaysShowScrollbarDemo.vue.txt)
- [ScrollScrollScrollChainingDemo](../snapshot/apps/nexus/app/components/content/demos/ScrollScrollScrollChainingDemo.vue.txt)
- [ScrollScrollNativeDemo](../snapshot/apps/nexus/app/components/content/demos/ScrollScrollNativeDemo.vue.txt)
- [ScrollScrollPullDownPullUpDemo](../snapshot/apps/nexus/app/components/content/demos/ScrollScrollPullDownPullUpDemo.vue.txt)

## 离线类型与实现参考

- [scroll/index.ts](../snapshot/packages/tuffex/packages/components/src/scroll/index.ts.txt)
- [src/TxScroll.vue](../snapshot/packages/tuffex/packages/components/src/scroll/src/TxScroll.vue.txt)
- [src/better-scroll-pull-plugins.ts](../snapshot/packages/tuffex/packages/components/src/scroll/src/better-scroll-pull-plugins.ts.txt)
- [src/runtime-capabilities.ts](../snapshot/packages/tuffex/packages/components/src/scroll/src/runtime-capabilities.ts.txt)
- [src/scroll-wheel.ts](../snapshot/packages/tuffex/packages/components/src/scroll/src/scroll-wheel.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/scroll/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
