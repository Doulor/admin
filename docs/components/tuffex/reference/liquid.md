# Liquid 液态流体

> 相触即融合的双层液态特效群组

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/liquid) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/liquid.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/liquid.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 融合
默认 `effect="morph"`：给条目 `x` / `y`，元素与液面同步动画，相触的块像水滴一样融合。
官方示例：`LiquidMorphMenuDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const open = ref(false)
</script>

<template>
  <TxLiquid :blur="8" fill="var(--tx-bg-color)" shadow="0 2px 8px rgba(0,0,0,.14)">
    <TxLiquidItem :x="open ? -64 : 0" :y="open ? -44 : 0" transition="bouncy">
      <TxButton circle variant="ghost" :border="false">✦</TxButton>
    </TxLiquidItem>
    <TxLiquidItem :y="open ? -76 : 0" transition="bouncy" :delay="40">
      <TxButton circle variant="ghost" :border="false">☾</TxButton>
    </TxLiquidItem>
    <TxLiquidItem :x="open ? 64 : 0" :y="open ? -44 : 0" transition="bouncy" :delay="80">
      <TxButton circle variant="ghost" :border="false">♪</TxButton>
    </TxLiquidItem>
    <TxLiquidItem>
      <TxButton circle variant="ghost" :border="false" @click="open = !open">＋</TxButton>
    </TxLiquidItem>
  </TxLiquid>
</template>
```

### 形变物理
`morph.shape` 开启形变：质心先流向新位置，尺寸与圆角随后跟上，内容在运动中模糊、落定后清晰。

```vue
<template>
  <TxLiquid :blur="8" fill="var(--tx-bg-color)">
    <TxLiquidItem :morph="{ shape: true, speed: 1, bounce: 0.5 }">
      <div :class="open ? 'panel-open' : 'panel-closed'">…</div>
    </TxLiquidItem>
  </TxLiquid>
</template>
```

### 溶解
`dissolve` 与 `effect` 正交：接触处，条目的图像经湍流位移熔进邻居，而不是模糊；文字不会被熔化。

```vue
<template>
  <TxLiquid :blur="10" fill="var(--tx-bg-color)">
    <TxLiquidItem dissolve>
      <img class="avatar" src="/a.png" alt="">
    </TxLiquidItem>
    <TxLiquidItem :dissolve="{ mix: 0.7, active: dragging }">
      <img class="avatar" src="/b.png" alt="">
    </TxLiquidItem>
  </TxLiquid>
</template>
```

### 拖尾
`effect="move"`：自行移动元素（CSS、指针事件均可），液面在弹簧上追赶，并拖出水滴尾巴。
官方示例：`LiquidMoveTrailDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const stops = [8, 96, 184]
const pos = ref(0)
</script>

<template>
  <TxLiquid :blur="7" fill="var(--tx-bg-color)">
    <TxLiquidItem effect="move" :move="{ trail: 0.6 }">
      <div class="thumb" :style="{ transform: `translateX(${stops[pos]}px)` }" />
    </TxLiquidItem>
  </TxLiquid>
</template>
```

### 最佳实践

- 条目背景保持透明，液面即表面；不透明内容（如圆形照片）恰好盖住自己的液面。
- `fill` 传 CSS 变量（如 `var(--tx-bg-color)`），让液面随主题切换。
- 阴影写在 `shadow` 上而不是子元素上，才能贴着融合后的液面。
- 该融合却分离时，先调大 `blur`，再查其他参数。
- 高频拖拽先用 `effect="move"` 的默认参数，不够再用 `advanced`。

## API 参考

### TxLiquid

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `blur` | `number` | `6` | goo 模糊 σ（px），决定多远开始桥接。 |
| `contrast` | `number` | `18` | 透明度对比斜率，越大液面边缘越锐。 |
| `fill` | `string` | `'#fff'` | 液面颜色，可传 `var()`。 |
| `shadow` | `string` | - | `box-shadow` 语法，画在融合后的剪影上；`inset` 画在内侧。 |
| `filterPadding` | `number` | `24` | blob 溢出群组时的滤镜区域余量（px）。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 若干 `TxLiquidItem`。 |

### TxLiquidItem

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `effect` | `'morph' \| 'move'` | `'morph'` | 液态行为：`morph` 融合，`move` 追赶并拖尾。 |
| `morph` | `MorphTuning` | - | `shape` / `speed` / `bounce` / `contentBlur`，及 `advanced` 逃生口。 |
| `move` | `MoveTuning` | - | `springiness` / `wobble` / `stretch` / `trail`，及 `advanced`。 |
| `dissolve` | `boolean \| number \| DissolveOptions` | - | 接触熔化修饰；`0..1` 缩放强度。 |
| `x` / `y` / `scale` | `number` | `0` / `0` / `1` | 组件驱动的位移与缩放，与液面逐像素同步。 |
| `transition` | `'snappy' \| 'smooth' \| 'bouncy' \| SpringConfig \| { duration, ease }` | `'smooth'` | `x` / `y` 的弹簧或时长过渡。 |
| `delay` | `number` | `0` | 过渡延迟（ms），用于交错入场。 |
| `observe` | `boolean` | `false` | 让液面跟随自行动画的内容；`morph.shape`、`dissolve`、`move` 已隐含。 |
| `radius` | `number \| [tl, tr, br, bl]` | 测量值 | 覆盖从计算样式测得的圆角。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 可交互的真实内容，背景保持透明。 |

## 概述

- `TxLiquid` 是 `isolation: isolate` 的相对定位容器：剪影 SVG 垫在所有子元素之下，熔化叠层在内容之上，两者都不接收指针事件。
- `TxLiquidItem` 必须位于 `TxLiquid` 内，否则抛错。
- 群组尺寸需容纳条目的完整行程；桥接约在 `blur ≳ 间距` 时发生。
- 组件独占包装器的 `transform`（`x/y/scale`）、运动中内容的 `filter`（`morph.shape`）与 `<img>` 的 `mask-image`（`dissolve`），不要再写同名样式。
- `dissolve` 与 `effect="move"` 同用时被忽略并告警；减少动态效果时，组件驱动的过渡变为瞬移。
- 入口另导出 `resolveTransition(transition, reducedMotion?)` 与 `liquidTransitionPresets`，把预设或 `SpringConfig` 编译为 `{ duration, easing }`（CSS `linear()`，不支持时回退 cubic-bezier），供组件外的 WAAPI / CSS 动效复用。

## 技术实现

- 剪影层用 SVG goo 滤镜（高斯模糊 + 透明度对比）融合各条目的 blob；内容层不经滤镜，保持清晰可交互。
- 移植自 [Jakubantalik/Libraries · liquid-gooey](https://github.com/Jakubantalik/Libraries/tree/main/packages/liquid-gooey)（MIT © Jakub Antalik），React 的 `Liquid` / `Liquid.Item` 对应 `TxLiquid` / `TxLiquidItem`。
- 源码：`packages/tuffex/packages/components/src/liquid/`。

## 离线完整示例源码

- [LiquidMorphMenuDemo](../snapshot/apps/nexus/app/components/content/demos/LiquidMorphMenuDemo.vue.txt)
- [LiquidMoveTrailDemo](../snapshot/apps/nexus/app/components/content/demos/LiquidMoveTrailDemo.vue.txt)

## 离线类型与实现参考

- [liquid/index.ts](../snapshot/packages/tuffex/packages/components/src/liquid/index.ts.txt)
- [src/LiquidMirroredItem.vue](../snapshot/packages/tuffex/packages/components/src/liquid/src/LiquidMirroredItem.vue.txt)
- [src/LiquidObservedItem.vue](../snapshot/packages/tuffex/packages/components/src/liquid/src/LiquidObservedItem.vue.txt)
- [src/TxLiquid.vue](../snapshot/packages/tuffex/packages/components/src/liquid/src/TxLiquid.vue.txt)
- [src/TxLiquidItem.vue](../snapshot/packages/tuffex/packages/components/src/liquid/src/TxLiquidItem.vue.txt)
- [src/context.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/context.ts.txt)
- [src/filter-primitives.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/filter-primitives.ts.txt)
- [src/geometry.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/geometry.ts.txt)
- [src/observer.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/observer.ts.txt)
- [src/shadow.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/shadow.ts.txt)
- [src/spring.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/spring.ts.txt)
- [src/tuning.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/tuning.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/liquid/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
