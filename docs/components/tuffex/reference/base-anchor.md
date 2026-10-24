# BaseAnchor 锚点定位

> 锚定在触发元素旁的浮层基础组件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/base-anchor) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/base-anchor.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/base-anchor.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`BaseAnchorBasicDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <TxBaseAnchor v-model="open" placement="bottom-start">
    <template #reference>
      <TxButton>点击</TxButton>
    </template>

    锚点定位弹出内容
  </TxBaseAnchor>
</template>
```

### 展开动画
默认的 `expand` 从靠近 reference 的角弹簧展开，关闭时折回。
官方示例：`BaseAnchorSplitLineDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBaseAnchor v-model="open" :animation="{ type: 'expand' }" :show-arrow="true">
    <template #reference>
      <TxButton>定位动效</TxButton>
    </template>

    内容从锚点方向浮现
  </TxBaseAnchor>
</template>
```

### 方向
`placement` 是首选方向，空间不足时翻到对侧；展开起点跟随最终落位。
官方示例：`BaseAnchorPlacementDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBaseAnchor placement="bottom" :show-arrow="true">
    <template #reference>
      <TxButton>下方</TxButton>
    </template>
    bottom
  </TxBaseAnchor>
  <TxBaseAnchor placement="top" :show-arrow="true">…</TxBaseAnchor>
  <TxBaseAnchor placement="left" :show-arrow="true">…</TxBaseAnchor>
  <TxBaseAnchor placement="right" :show-arrow="true">…</TxBaseAnchor>
</template>
```

### 动画模式
`animation.type` 取 `expand`（默认）、`transfer`、`boom`、`opacity` 或 `none`。
官方示例：`BaseAnchorAnimationDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const modes = ['expand', 'transfer', 'boom', 'opacity', 'none'] as const
</script>

<template>
  <TxBaseAnchor
    v-for="mode in modes"
    :key="mode"
    placement="bottom"
    :animation="{ type: mode }"
    :show-arrow="true"
  >
    <template #reference>
      <TxButton>{{ mode }}</TxButton>
    </template>
    {{ mode }}
  </TxBaseAnchor>
</template>
```

### 液滴下坠
`drip` 让面板像液滴从触发器淌出；带 `data-liquid-item` 的菜单项随面板生长逐项显现。
官方示例：`BaseAnchorDripDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBaseAnchor v-model="open" :width="200" :animation="{ type: 'drip' }">
    <template #reference>
      <button class="workspace-trigger">选择工作区</button>
    </template>

    <button v-for="item in items" :key="item" data-liquid-item>
      {{ item }}
    </button>
  </TxBaseAnchor>
</template>
```

### 张力收腰
`bead` 与 `drip` 共用引擎，两侧随运动速度收腰；`beadPinch` 设每侧峰值收腰量（px）。
官方示例：`BaseAnchorBeadDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBaseAnchor v-model="open" :width="200" :animation="{ type: 'bead', beadPinch: 60 }">
    <template #reference>
      <button class="workspace-trigger">选择工作区</button>
    </template>

    <button v-for="item in items" :key="item" data-liquid-item>
      {{ item }}
    </button>
  </TxBaseAnchor>
</template>
```

### 自定义缓动
时长与缓动都写在 `animation` 里，组件没有顶层的 `duration` / `ease` prop。
官方示例：`BaseAnchorCustomEaseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBaseAnchor :animation="{ type: 'transfer', duration: 600, ease: 'elastic.out(1, 0.4)' }">
    <template #reference>
      <TxButton>弹性</TxButton>
    </template>
    弹性缓动，时长 600ms
  </TxBaseAnchor>
</template>
```

### 面板材质
`panelBackground` 切换材质，`surfaceMotionAdaptation` 决定动画期间材质是否降级。
官方示例：`BaseAnchorSurfacePlaygroundDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBaseAnchor
    v-model="open"
    panel-background="glass"
    panel-shadow="medium"
    :panel-card="{ maskOpacity: 0.75 }"
    surface-motion-adaptation="auto"
  >
    <template #reference>
      <TxButton>打开 Playground</TxButton>
    </template>
    …
  </TxBaseAnchor>
</template>
```

### 最佳实践

- 优先使用 `TxPopover`、`TxDropdownMenu` 或 `TxContextMenu`；只在构建新的锚点组件或需要虚拟定位时直接使用 `TxBaseAnchor`。
- 直接使用时，按内容类型自行提供 role、焦点管理与键盘导航。
- 浮层只放轻量内容；多步骤表单、危险确认与整屏流程改用 Drawer 或 Dialog。
- 坐标菜单传 `virtualReference`，坐标或画布变换后调用 `updatePosition()`。
- `eager` 与 `keepAliveContent` 保留的是可测量的内容，不是定位：关闭时只量尺寸，坐标取自 reference 或已打开的面板。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `boolean` | `undefined` | 是否打开（`v-model`）；省略时为非受控。 |
| `disabled` | `boolean` | `false` | 阻止打开，并关闭已打开的面板。 |
| `eager` | `boolean` | `false` | 首次打开前就挂载面板，便于预先测量。 |
| `placement` | `BaseAnchorPlacement` | `'bottom-start'` | 首选方向，空间不足时翻到对侧。 |
| `offset` | `number` | `8` | 与 reference 的间距（px）。 |
| `width` | `number` | `0` | 面板宽度；`0` 时由内容决定。 |
| `minWidth` | `number` | `0` | 最小宽度。 |
| `maxWidth` | `number` | `360` | 最大宽度。 |
| `maxHeight` | `number` | `420` | 最大高度，按视口剩余高度收缩。 |
| `unlimitedHeight` | `boolean` | `false` | 取消高度限制；`maxHeight <= 0` 同效。 |
| `matchReferenceWidth` | `boolean` | `false` | `width` 为 `0` 时与 reference 等宽。 |
| `referenceClass` | `BaseAnchorClassValue` | `undefined` | reference 包装层的 class；其余 attrs 都落在面板上。 |
| `virtualReference` | `BaseAnchorVirtualReference` | `undefined` | 按虚拟 reference（如光标坐标）定位，`reference` 插槽仍渲染。 |
| `disableFlip` | `boolean` | `false` | 不翻到对侧，但仍推回视口；用于宿主自行测量的 `virtualReference`。 |
| `animation` | `BaseAnchorAnimationOptions` | `{}` | 动画配置；未写的字段取该类型的默认值。 |
| `useCard` | `boolean` | `true` | 用内置 `TxCard` 包裹内容。 |
| `panelVariant` | `'solid' \| 'dashed' \| 'plain'` | `'plain'` | `TxCard` 的边框形态。 |
| `panelBackground` | `'pure' \| 'mask' \| 'blur' \| 'glass' \| 'refraction' \| 'acrylic' \| 'mica' \| 'flat' \| 'plain'` | `'refraction'` | 面板背景，`refraction` 即琉光。 |
| `panelShadow` | `'none' \| 'soft' \| 'medium'` | `'soft'` | 面板阴影。 |
| `panelRadius` | `number` | `18` | 面板圆角（px）。 |
| `panelPadding` | `number` | `10` | 面板内边距（px）。 |
| `panelCard` | `BaseAnchorPanelCardProps` | `undefined` | 透传给 `TxCard` 的高级参数，如 `maskOpacity`、`refraction*`。 |
| `surfaceMotionAdaptation` | `'auto' \| 'manual' \| 'off'` | `'auto'` | 运动期间的材质降级：`auto` 跟随动画，`manual` 读 `panelCard.surfaceMoving`，`off` 不降级。 |
| `showArrow` | `boolean` | `false` | 显示跟随定位的箭头。 |
| `arrowSize` | `number` | `10` | 箭头尺寸（px）。 |
| `keepAliveContent` | `boolean` | `false` | 关闭后保留内容挂载及其内部状态。 |
| `closeOnClickOutside` | `boolean` | `true` | 点击外部时关闭。 |
| `closeOnEsc` | `boolean` | `true` | 按 Esc 时关闭。 |
| `toggleOnReferenceClick` | `boolean` | `true` | 点击 reference 时切换；自行处理点击的 reference 设为 `false`。 |
| `hoverBridge` | `boolean` | `false` | 打开期间在 reference 与面板间铺透明命中区；`TxTooltip` 按需自动开启。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | - | 打开时触发。 |
| `close` | - | 关闭时触发。 |
| `update:modelValue` | `boolean` | 开合状态变化时触发。 |
| `floating-enter` | `MouseEvent` | 指针进入浮层（面板或悬停桥）。 |
| `floating-leave` | `MouseEvent` | 指针离开整个浮层。 |

### 插槽

| 插槽名 | 说明 |
|------|------|
| `reference` | 触发元素。 |
| `default` | 浮层内容；接收最终方向 `{ side }`。 |

### 暴露方法

| 方法名 | 参数 | 说明 |
|------|------|------|
| `close` | - | 关闭面板。 |
| `toggle` | - | 切换开合。 |
| `updatePosition` | - | 重新计算定位。 |
| `getPanelRect` | - | 面板当前绘制的 `DOMRect`，未挂载时为 `null`。 |
| `containsFloating` | `(target: Node)` | `target` 是否在浮层内（含悬停桥）。 |
| `getSide` | - | 最终落位方向：`top` / `right` / `bottom` / `left`。 |

### 类型

#### BaseAnchorAnimationOptions

| 字段 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `type` | `'expand' \| 'transfer' \| 'boom' \| 'opacity' \| 'none' \| 'drip' \| 'bead'` | `'expand'` | `expand` 弹簧展开，`transfer` 沿方向位移，`boom` 从模糊中缩放，`opacity` 淡入淡出，`none` 瞬时；`drip` / `bead` 为液态。 |
| `closeType` | 同 `type` 的取值 | 同 `type` | 关闭阶段的类型。液态两端必须同型，混搭时回落为对称并在开发环境告警。 |
| `duration` | `number` | 按类型（expand 400 / 经典 432 / 液态 260） | 打开时长（ms）。 |
| `closeDuration` | `number` | 按关闭类型（expand 240 / 经典为打开时长 × 0.45 / 液态 150） | 关闭时长（ms）。 |
| `ease` | `string` | 按类型（expand 按面板高度解出的弹簧，约 63px 以内为 `spring(10, 0.6)` / 经典 `back.out(2)` / 液态 `linear`） | 打开缓动：GSAP 缓动名、`cubic-bezier(...)` 或 `spring(omega, zeta)`，显式值原样运行；液态只认 `linear` 与 `cubic-bezier(...)`。 |
| `closeEase` | `string` | 按关闭类型（expand `power2.in` / 经典 `power3.in` / 液态 `cubic-bezier(0.25, 0.46, 0.45, 0.94)`） | 关闭缓动，写法同 `ease`。 |
| `distance` | `number` | 按类型（expand 12 / transfer 30） | `expand` 的漂移与 `transfer` 的位移距离（px）。 |
| `scale` | `number` | 按类型（expand 0.88 / boom 0.94 / transfer 0.92） | 打开时的初始缩放。 |
| `blur` | `number` | `12` | `boom` 的初始模糊半径（px）。 |
| `opacity` | `number` | `0` | `expand` / `boom` / `opacity` 的初始透明度。 |
| `exit` | `{ scale?, distance?, blur?, opacity? }` | 见说明 | 仅关闭阶段的几何；未写字段先取同名共享字段，再取 `closeType` 的默认值。 |
| `gooBlur` | `number` | `4.5` | 仅 `drip` / `bead`。goo 滤镜的模糊半径，决定颈部能撑多宽。 |
| `gooThreshold` | `number` | `20` | 仅 `drip` / `bead`。alpha 阈值的斜率。 |
| `gooThresholdOffset` | `number` | `-9` | 仅 `drip` / `bead`。alpha 阈值的偏移。 |
| `outlineColor` | `string` | `--tx-border-color` | 仅 `drip` / `bead`。轮廓环颜色，默认跟随主题。 |
| `triggerRadius` | `number` | 实测 | 仅 `drip` / `bead`。触发器圆角，缺省时从 reference 测量。 |
| `seedHeight` | `number` | `12` | 仅 `drip` / `bead`。起始时的面板高度（px）。 |
| `itemSelector` | `string` | `'[data-liquid-item]'` | 仅 `drip` / `bead`。逐项显现的元素；无匹配时内容整体显现。 |
| `beadPinch` | `number` | `60` | 仅 `bead`。每侧峰值收腰量（px），随运动停息归零。 |
| `beadVelocityRef` | `number` | `4` | 仅 `bead`。收腰达到峰值所需的速度。 |

## 概述

- 传 `modelValue` 时受控，否则内部维护开合；状态变化时派发 `open` 或 `close`。
- `maxHeight` 随视口剩余高度收缩；超出部分在卡片 body 内滚动，滚动位置从 body 读取。
- 锚点家族默认不画箭头：BaseAnchor、Tooltip、Popover 及基于它们的 DropdownMenu、ContextMenu、Select 都是如此。`showArrow` 的箭头随面板内容层一起运动。
- `drip` / `bead` 只用于纵向落位，横向时降级为 `opacity`；需要可测量的高度，`unlimitedHeight` 时瞬时显隐。
- `drip` / `bead` 自绘表面，不渲染 `TxCard` 与箭头，面板背景、阴影与边框均不生效；触发器需自带不透明背景。
- 减少动态效果时，所有动画直接跳到终态。

## 技术实现

- 面板 teleport 到 `<body>`，由 Floating UI 按文档坐标定位；经典类型由 GSAP 驱动，`drip` / `bead` 由 rAF 循环驱动。
- 源码：`packages/tuffex/packages/components/src/base-anchor/`。

## 离线完整示例源码

- [BaseAnchorBasicDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorBasicDemo.vue.txt)
- [BaseAnchorSplitLineDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorSplitLineDemo.vue.txt)
- [BaseAnchorPlacementDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorPlacementDemo.vue.txt)
- [BaseAnchorAnimationDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorAnimationDemo.vue.txt)
- [BaseAnchorDripDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorDripDemo.vue.txt)
- [BaseAnchorBeadDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorBeadDemo.vue.txt)
- [BaseAnchorCustomEaseDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorCustomEaseDemo.vue.txt)
- [BaseAnchorSurfacePlaygroundDemo](../snapshot/apps/nexus/app/components/content/demos/BaseAnchorSurfacePlaygroundDemo.vue.txt)

## 离线类型与实现参考

- [base-anchor/index.ts](../snapshot/packages/tuffex/packages/components/src/base-anchor/index.ts.txt)
- [src/TxBaseAnchor.vue](../snapshot/packages/tuffex/packages/components/src/base-anchor/src/TxBaseAnchor.vue.txt)
- [src/base-anchor-liquid.ts](../snapshot/packages/tuffex/packages/components/src/base-anchor/src/base-anchor-liquid.ts.txt)
- [src/base-anchor-motion.ts](../snapshot/packages/tuffex/packages/components/src/base-anchor/src/base-anchor-motion.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/base-anchor/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
