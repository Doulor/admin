# GradualBlur 渐变模糊

> 贴在容器或页面边缘的分层渐变模糊

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/gradual-blur) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/gradual-blur.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/gradual-blur.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
默认贴在父容器底边；`strength`、`divCount` 与 `curve` 决定模糊的强弱与过渡。
官方示例：`GradualBlurGradualBlurDemo`（完整源码见本页末尾）

```vue
<template>
  <section style="position: relative; height: 320px; overflow: hidden;">
    <div style="height: 100%; overflow-y: auto;">
      <!-- 长内容 -->
    </div>
    <TxGradualBlur
      target="parent"
      position="bottom"
      height="6rem"
      :strength="2"
      :div-count="5"
      curve="bezier"
      :exponential="true"
    />
  </section>
</template>
```

### 方向
`position` 选择边；左右两侧用 `width` 设置厚度。
官方示例：`GradualBlurPositionsDemo`（完整源码见本页末尾）

```vue
<template>
  <section class="pane">
    <!-- 可滚动内容 -->
    <TxGradualBlur position="top" height="4.5rem" :strength="2.2" :div-count="6" curve="ease-out" />
  </section>
  <section class="pane">
    <TxGradualBlur position="bottom" height="5rem" :strength="2.2" :div-count="6" curve="ease-out" />
  </section>
  <section class="pane">
    <TxGradualBlur position="left" width="5rem" :strength="2.5" :div-count="7" curve="bezier" />
  </section>
  <section class="pane">
    <TxGradualBlur position="right" width="5rem" :strength="2.5" :div-count="7" curve="bezier" />
  </section>
</template>
```

### 预设
官方示例：`GradualBlurPresetsDemo`（完整源码见本页末尾）

```vue
<template>
  <section class="pane"><TxGradualBlur preset="subtle" /></section>
  <section class="pane"><TxGradualBlur preset="intense" /></section>
  <section class="pane"><TxGradualBlur preset="smooth" /></section>
  <section class="pane"><TxGradualBlur preset="sharp" /></section>
  <section class="pane"><TxGradualBlur preset="header" /></section>
  <section class="pane"><TxGradualBlur preset="footer" /></section>
</template>
```

### 悬停增强
官方示例：`GradualBlurHoverIntensityDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGradualBlur
    position="bottom"
    height="6rem"
    :strength="2"
    :div-count="6"
    curve="bezier"
    :hover-intensity="1.8"
    :exponential="true"
  />
</template>
```

### 进入视口时淡入
官方示例：`GradualBlurAnimatedScrollDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGradualBlur
    position="bottom"
    height="6.5rem"
    :strength="2.4"
    animated="scroll"
    duration="0.35s"
    :on-animation-complete="onRevealed"
  />
</template>
```

### 页面目标
官方示例：`GradualBlurTargetPageDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGradualBlur
    target="page"
    preset="page-footer"
    :div-count="8"
    :exponential="true"
    :strength="2.5"
    :z-index="9999"
    :style="{ left: 0, right: 0 }"
  />
</template>
```

### 响应式尺寸
官方示例：`GradualBlurResponsiveSizesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGradualBlur
    position="bottom"
    :strength="2"
    responsive
    height="6rem"
    mobile-height="4rem"
    tablet-height="5rem"
    desktop-height="7rem"
  />
</template>
```

### 最佳实践

- 卡片内渐隐让父容器保持 `position: relative` 与 `overflow: hidden`；只有固定的页面框架才用 `target="page"`。
- 先加 `divCount` 让过渡更平滑，再调 `strength`；层数越多，backdrop-filter 开销越大。
- 常见页眉、页脚先用 `preset`，再覆盖一两个属性。
- 覆盖层下方有可交互控件时，不要设置 `hoverIntensity`。
- 两套主题都检查对比度，模糊效果取决于后方内容。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | 贴靠的边，也决定遮罩渐变方向。 |
| `strength` | `number` | `2` | 每层模糊半径的倍率。 |
| `height` | `string` | `'6rem'` | 上下边的厚度；左右边未设 `width` 时也用它。 |
| `width` | `string` | - | 覆盖宽度；上下边默认 `100%`，左右边默认取 `height`。 |
| `divCount` | `number` | `5` | 分层数量；向下取整，至少 1 层。 |
| `exponential` | `boolean` | `false` | 模糊按指数而非线性递增。 |
| `curve` | `'linear' \| 'bezier' \| 'ease-in' \| 'ease-out' \| 'ease-in-out'` | `'linear'` | 各层模糊进度的分布曲线。 |
| `opacity` | `number` | `1` | 每层的不透明度。 |
| `animated` | `boolean \| 'scroll'` | `false` | 启用透明度与模糊过渡；`'scroll'` 进入视口后才淡入。 |
| `duration` | `string` | `'0.3s'` | 过渡时长。 |
| `easing` | `string` | `'ease-out'` | 过渡缓动。 |
| `zIndex` | `number` | `1000` | 基础层级；`target="page"` 时加 `100`。 |
| `target` | `'parent' \| 'page'` | `'parent'` | `parent` 绝对定位在父容器内，`page` 固定在视口。 |
| `hoverIntensity` | `number` | - | 悬停时乘到 `strength` 上，并让覆盖层接收指针事件。 |
| `responsive` | `boolean` | `false` | 按视口宽度切换尺寸，并监听 resize（防抖）。 |
| `mobileHeight` | `string` | - | `responsive` 下视口 `<= 480px` 时的高度。 |
| `tabletHeight` | `string` | - | `responsive` 下视口 `<= 768px` 时的高度。 |
| `desktopHeight` | `string` | - | `responsive` 下视口 `<= 1024px` 时的高度。 |
| `mobileWidth` | `string` | - | `responsive` 下视口 `<= 480px` 时的宽度。 |
| `tabletWidth` | `string` | - | `responsive` 下视口 `<= 768px` 时的宽度。 |
| `desktopWidth` | `string` | - | `responsive` 下视口 `<= 1024px` 时的宽度。 |
| `preset` | `'top' \| 'bottom' \| 'left' \| 'right' \| 'subtle' \| 'intense' \| 'smooth' \| 'sharp' \| 'header' \| 'footer' \| 'sidebar' \| 'page-header' \| 'page-footer'` | - | 先应用预设；显式传入的属性仍会覆盖它。 |
| `gpuOptimized` | `boolean` | `false` | 添加 `will-change: backdrop-filter, opacity` 与 `translateZ(0)`。 |
| `onAnimationComplete` | `() => void` | - | `animated="scroll"` 显现并经过 `duration` 后调用。 |
| `className` | `string` | `''` | 追加到根节点的 class。 |
| `style` | `CSSProperties` | `{}` | 根节点内联样式，在生成的定位样式之后合并。 |

### 插槽

| 插槽名 | 说明 |
|------|------|
| `default` | 可选内容，渲染在模糊层之上。 |

## 概述

- 覆盖层默认是 `pointer-events: none` 的装饰层；设置 `hoverIntensity` 后才接收指针。
- `target="page"` 时，上下边默认占满视口宽度。
- `animated="scroll"` 初始隐藏，用 `IntersectionObserver` 观察根节点，可见后淡入。

## 技术实现

- 每层是一块带 `mask-image` 区间的 `backdrop-filter` 模糊，模糊值沿 `curve` 递增，叠成连续的渐变。
- 源码：`packages/tuffex/packages/components/src/gradual-blur/`。

## 离线完整示例源码

- [GradualBlurGradualBlurDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurGradualBlurDemo.vue.txt)
- [GradualBlurPositionsDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurPositionsDemo.vue.txt)
- [GradualBlurPresetsDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurPresetsDemo.vue.txt)
- [GradualBlurHoverIntensityDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurHoverIntensityDemo.vue.txt)
- [GradualBlurAnimatedScrollDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurAnimatedScrollDemo.vue.txt)
- [GradualBlurTargetPageDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurTargetPageDemo.vue.txt)
- [GradualBlurResponsiveSizesDemo](../snapshot/apps/nexus/app/components/content/demos/GradualBlurResponsiveSizesDemo.vue.txt)

## 离线类型与实现参考

- [gradual-blur/index.ts](../snapshot/packages/tuffex/packages/components/src/gradual-blur/index.ts.txt)
- [src/TxGradualBlur.vue](../snapshot/packages/tuffex/packages/components/src/gradual-blur/src/TxGradualBlur.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/gradual-blur/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
