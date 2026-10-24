# MetalFx

> 按钮、文字与徽标的 WebGL2 液态金属材质

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/metal-fx) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/metal-fx.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/metal-fx.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.2`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`TxMetalFx` 包裹恰好一个宿主元素，在 WebGL2 画布上为它绘制金属环。
官方示例：`MetalFxShowcaseDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed } from 'vue'

const colorMode = useColorMode()
const metalTheme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
</script>

<template>
  <TxMetalFx preset="chromatic" :theme="metalTheme">
    <a href="#" class="cta">升级到 Pro</a>
  </TxMetalFx>

  <TxMetalFx variant="circle" preset="chromatic" :theme="metalTheme" inner-shadow :strength="0.9">
    <button type="button" aria-label="发送" style="width: 40px; height: 40px; border-radius: 999px">↑</button>
  </TxMetalFx>

  <span>
    方案
    <TxMetalText font="500 28px/1.2 Inter, system-ui, sans-serif" color="#e2e2e2">Pro</TxMetalText>
  </span>

  <TxMetalBadge>New</TxMetalBadge>
</template>
```

### 变体
`button` 是 1 px 环的胶囊，`circle` 是 2 px 环的正圆；环半径取自子元素的 `border-radius`。

```vue
<template>
  <TxMetalFx variant="button" preset="silver" :strength="0.7">
    <a href="/pricing">升级到 Pro</a>
  </TxMetalFx>

  <TxMetalFx variant="circle" preset="gold" inner-shadow :scale="1.5">
    <button type="button" aria-label="发送">↑</button>
  </TxMetalFx>
</template>
```

### 文字与徽标
`TxMetalText` 与 `TxMetalBadge` 固定使用 `chromatic` 材质，并以自身文本作为 `aria-label`。

```vue
<template>
  <TxMetalText font="600 32px/1.1 Inter, sans-serif" color="#e8e8e8">Pro</TxMetalText>
  <TxMetalBadge>Beta</TxMetalBadge>
</template>
```

### 最佳实践

- 图标类子元素显式给出宽高；包裹层是 `inline-flex`，尺寸跟随子元素。
- 子元素背景保持透明，自定义填充写在 `TxMetalFx` 上。
- 每页只用一个预设与主题：所有实例共用一份材质，最后应用的生效。
- 金属元素彼此拉开，并排的两个金属按钮会争夺视觉焦点。
- `reflectionTargets` 只传能持有引用的稳定邻元素。

## API 参考

### TxMetalFx

#### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `'button' \| 'circle'` | `'button'` | 环基线：胶囊 1 px，圆形 2 px。 |
| `preset` | `'chromatic' \| 'silver' \| 'gold'` | `'chromatic'` | 金属颜色，每个预设都有明暗两套调校。 |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` | 预设的明暗侧；`auto` 实时跟随系统。 |
| `strength` | `number` | `1` | 同时缩放着色器不透明度与辉光 alpha（0-1）。 |
| `glowGain` | `number` | `1` | 仅作用于辉光的倍数，相乘后钳制到 0-1。 |
| `paused` | `boolean` | `false` | 冻结在当前帧。 |
| `borderRadius` | `number` | 自动探测 | 环半径（CSS px）。 |
| `normalizeHostStyles` | `boolean` | `true` | 剥离子元素的边框、outline 与 box-shadow。 |
| `reflectionTargets` | `Array<Element \| { ref, strength }>` | 无 | 接收镜像反射的邻元素。 |
| `disableGlow` | `boolean` | `false` | 移除游走辉光，保留金属环。 |
| `innerShadow` | `boolean \| { offsetY, blur, alpha, color }` | 关 | 环顶部内侧的高光边。 |
| `shaderScale` | `number` | 变体基线 × `scale` | 覆盖着色器采样尺度。 |
| `ringCssPx` | `number` | 变体基线 × `scale` | 覆盖环厚度（CSS px）。 |
| `scale` | `number` | `1` | 引擎内所有绝对像素常量的总倍数。 |
| `mask` | `(ctx, size) => void` | 无 | 自定义 alpha 遮罩，着色器只保留遮罩覆盖处。 |
| `glowMode` | `'mask' \| 'ring'` | `'mask'` | 设置 `mask` 后辉光的落位方式。 |

#### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `default` | - | 恰好一个宿主元素，保留其自身事件处理。 |

#### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--mfx-strength` | `strength` | 钳制到 0-1 的强度，供下游 CSS 读取。 |
| `--mfx-radius` | `borderRadius` 或自动探测 | 环半径（px）。 |

### TxMetalText

#### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `font` | `string` | 必填 | CSS `font` 简写。 |
| `color` | `string` | 必填 | 金属下方的底色。 |
| `strength` | `number` | `1` | 金属不透明度。 |
| `reflectionTargets` | `Array<Element \| { ref, strength }>` | 无 | 接收金属反射的邻元素。 |
| `children` | `string` | 无 | 默认插槽为空时的文本。 |
| `theme` | `'auto' \| 'dark' \| 'light'` | 无 | 预设的明暗侧；未传时跟随系统。 |
| `innerShadow` | `TextInnerShadow \| null` | `FIGMA_INNER_SHADOW` | 字形内侧顶部的高光边；`null` 关闭。 |
| `glow` | `boolean` | `false` | 在字形上显示辉光。 |
| `glowGain` | `number` | `2.5` | `glow` 开启时的辉光倍数。 |
| `metalOpacity` | `number` | `0.62` | 金属盖过底色的程度（0-1），与 `strength` 相乘。 |
| `shaderScale` | `number` | `2.8` | 字形内金属纹理的缩放。 |

#### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `default` | - | 标签文本。 |

### TxMetalBadge

#### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `children` | `string` | `'New'` | 默认插槽为空时的文本。 |
| `strength` | `number` | `1` | 金属不透明度。 |
| `theme` | `'auto' \| 'dark' \| 'light'` | 无 | 预设的明暗侧；未传时跟随系统。 |
| `scale` | `number` | `1` | 整体尺寸倍数（基准 45×25）。 |
| `reflectionTargets` | `Array<Element \| { ref, strength }>` | 无 | 接收金属反射的邻元素。 |
| `metalOpacity` | `number` | `0.8` | 金属盖过白底的程度（0-1），与 `strength` 相乘。 |
| `shaderScale` | `number` | `1.6` | 金属纹理的缩放。 |
| `core` | `MetalBadgeCore` | `{ r: 46, blur: 100, a: 0.94, size: 49 }` | 文字下白色核心的半径、过渡、不透明度与尺寸。 |
| `gradient` | `number` | `0` | 自上而下的白色渐变强度（0-1）。 |
| `glow` | `number` | `0.41` | 内侧白色辉光强度（0-1）。 |
| `textColor` | `string` | `'#323232'` | 文字颜色。 |

#### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `default` | - | 标签文本，为空时用 `children`。 |

## 概述

- 全页实例共用一个 WebGL2 上下文、一份材质和一个约 15 fps 的循环；离屏实例（`IntersectionObserver`，64 px 边距）不渲染，标签页隐藏时循环停止。
- 首帧金属绘制完成前，包裹层连同子元素不可见；在那之前不要测量或动画化子元素。
- 反射只在暗色主题渲染；亮色主题下不扫描 DOM，也没有逐帧开销。
- 着色器不响应减少动态效果，需要时自行传 `paused`（可选 `disableGlow`）。
- 光标反射需经 `setCursorSprite` 注册精灵图，否则保持关闭；减少动态效果、`forced-colors` 与粗指针下自动关闭。
- 不支持 WebGL2 时，子元素保留自身样式，渲染在 `div.metal-fx-fallback[data-metal-fx-unsupported]` 中，不画环。

## 技术实现

- `engine/**` 逐字移植自 [Jakubantalik/Libraries · metal-fx](https://github.com/Jakubantalik/Libraries/tree/main/packages/metal-fx) v2（MIT © Jakub Antalik），Vue 壳沿用 React 包裹层的生命周期、测量与清理。
- 页面级调校使用模块导出的引擎原语：`setGlowConfig`、`setCursorLightConfig`、`setBendConfig`、`isMetalFxSupported` 等。
- 源码：`packages/tuffex/packages/components/src/metal-fx/`。

## 离线完整示例源码

- [MetalFxShowcaseDemo](../snapshot/apps/nexus/app/components/content/demos/MetalFxShowcaseDemo.vue.txt)

## 离线类型与实现参考

- [metal-fx/index.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/index.ts.txt)
- [src/TxMetalBadge.vue](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/TxMetalBadge.vue.txt)
- [src/TxMetalFx.vue](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/TxMetalFx.vue.txt)
- [src/TxMetalText.vue](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/TxMetalText.vue.txt)
- [bend/config.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/bend/config.ts.txt)
- [engine/color.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/color.ts.txt)
- [cursor/light.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/cursor/light.ts.txt)
- [glow/bake.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/glow/bake.ts.txt)
- [glow/config.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/glow/config.ts.txt)
- [glow/geometry.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/glow/geometry.ts.txt)
- [glow/glow.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/glow/glow.ts.txt)
- [engine/perf-config.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/perf-config.ts.txt)
- [engine/presets.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/presets.ts.txt)
- [reflection/constants.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/reflection/constants.ts.txt)
- [reflection/geometry.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/reflection/geometry.ts.txt)
- [reflection/observers.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/reflection/observers.ts.txt)
- [reflection/paint.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/reflection/paint.ts.txt)
- [reflection/reflection-scheduler.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/reflection/reflection-scheduler.ts.txt)
- [renderer/core.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/renderer/core.ts.txt)
- [renderer/loop.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/renderer/loop.ts.txt)
- [renderer/outline.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/renderer/outline.ts.txt)
- [renderer/sampling.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/renderer/sampling.ts.txt)
- [engine/rim.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/rim.ts.txt)
- [engine/shaders.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/shaders.ts.txt)
- [engine/text-mask.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/text-mask.ts.txt)
- [engine/tween.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/engine/tween.ts.txt)
- [src/glow-bridge.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/glow-bridge.ts.txt)
- [src/styles.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/styles.ts.txt)
- [src/text-overlay.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/text-overlay.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/types.ts.txt)
- [src/use-metal-bend.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/use-metal-bend.ts.txt)
- [src/use-metal-text-reflection.ts](../snapshot/packages/tuffex/packages/components/src/metal-fx/src/use-metal-text-reflection.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
