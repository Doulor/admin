# ResizeBox 显式尺寸动画

> 在显式宽高目标之间过渡的容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/resize-box) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/resize-box.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/resize-box.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 显式尺寸目标
父组件给出 `width` / `height` 目标；`resize-start` / `resize-end` 标记一次过渡的开始与结束。
官方示例：`ResizeBoxResizeBoxDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const expanded = ref(false)
const width = computed(() => expanded.value ? 'min(420px, 100%)' : 'min(220px, 100%)')
const height = computed(() => expanded.value ? 244 : 132)
</script>

<template>
  <TxButton @click="expanded = !expanded">切换</TxButton>

  <TxResizeBox
    as="section"
    :width="width"
    :height="height"
    :duration="360"
    :disabled="disabled"
    :clip="clip"
    @resize-start="status = '调整中'"
    @resize-end="status = '已完成'"
  >
    使用显式尺寸的内容
  </TxResizeBox>
</template>
```

### 最佳实践

- 父组件已知紧凑与展开目标时用 `TxResizeBox`；图片、异步渲染、换行等内容驱动的变化改用 [`TxAutoSizer`](./auto-sizer.md)。
- 只设置自己控制的轴，未设置的轴保持固有尺寸。
- 响应式目标用 `min(420px, 100%)` 这类 CSS 长度，避免窄屏横向溢出。
- 内容大于紧凑目标时保留 `clip`；只有溢出是有意设计时才关闭。
- `resize-start` / `resize-end` 只作生命周期通知，尺寸以 props 为准。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `as` | `string` | `div` | 根元素标签；透传的 attrs、`class`、`style` 落在根元素上。 |
| `width` | `number \| string` | `undefined` | 宽度目标：有限数字按 px，非空字符串作为 CSS 长度；未设置时保持固有宽度。 |
| `height` | `number \| string` | `undefined` | 高度目标，规则同 `width`。 |
| `duration` | `number` | `300` | 宽高过渡时长（ms）。 |
| `easing` | `string` | `cubic-bezier(0.22, 1, 0.36, 1)` | 宽高过渡共用的缓动。 |
| `disabled` | `boolean` | `false` | 去掉过渡，新目标立即生效；调整中禁用会结束当前生命周期。 |
| `clip` | `boolean` | `true` | 在根元素上应用 `overflow: hidden`。 |

### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `resize-start` | `()` | 启用动画时尺寸目标变化即触发；动画中的连续变化属于同一生命周期。 |
| `resize-end` | `()` | 最后一个宽高过渡完成、安全定时器到期或调整中被禁用时触发。 |

### 插槽

| 插槽名 | 参数 | 说明 |
|--------|------|------|
| `default` | - | 直接渲染在根元素内的内容，不额外包裹或测量。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `rootEl` | `HTMLElement \| null` | 当前根元素。 |
| `animating` | `boolean` | 是否处于尺寸过渡生命周期中。 |

## 概述

- 有限数字转为 px；非空字符串原样保留，可直接用 `%`、`rem`、`calc()`、`min()`。`undefined`、`null`、非有限数字与空白字符串表示该轴不设置。
- 组件不校验 CSS 长度：负数与无效字符串照样交给浏览器；没有过渡实际运行时，安全定时器仍会结束生命周期。
- 只响应根元素自身的 `width` / `height` 过渡，子元素与其他属性的 transition 事件被忽略。
- `disabled` 时目标变化立即跳变，不触发事件；减少动态效果时过渡缩短到 `0.01ms`，生命周期照常结束。
- 只改插槽内容不会触发尺寸调整；组件没有内容测量、`ResizeObserver` 或 `v-model`。

## 技术实现

- 尺寸变化交给根元素的 CSS `transition`，生命周期由 `transitionend` 与按时长计算的安全定时器结束。
- 源码：`packages/tuffex/packages/components/src/resize-box/`。

## 离线完整示例源码

- [ResizeBoxResizeBoxDemo](../snapshot/apps/nexus/app/components/content/demos/ResizeBoxResizeBoxDemo.vue.txt)

## 离线类型与实现参考

- [resize-box/index.ts](../snapshot/packages/tuffex/packages/components/src/resize-box/index.ts.txt)
- [src/TxResizeBox.vue](../snapshot/packages/tuffex/packages/components/src/resize-box/src/TxResizeBox.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/resize-box/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
