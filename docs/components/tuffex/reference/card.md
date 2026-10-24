# Card 卡片

> 带头部、正文与底部插槽的表面容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/card) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/card.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/card.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`CardBasicDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard>
    A generic container for content.
  </TxCard>
</template>
```

### 头部与底部
官方示例：`CardBasicSlotsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard shadow="soft">
    <template #header>
      Card title
      <TxButton size="sm" variant="ghost">Action</TxButton>
    </template>
    Slots: header / default / footer
    <template #footer>
      <TxButton size="sm" variant="secondary">Cancel</TxButton>
      <TxButton size="sm" variant="primary">Confirm</TxButton>
    </template>
  </TxCard>
</template>
```

### 惯性
`inertial` 让卡片跟随指针位移，离开后回弹；`inertialMaxOffset` 限制位移，`inertialRebound` 调节弹性。
官方示例：`CardInertialDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard inertial :inertial-max-offset="26" :inertial-rebound="0.12">
    Inertial drag
  </TxCard>
</template>
```

### 标题
官方示例：`CardHeaderDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard>
    <template #header>Card title</template>
    Using header slot
  </TxCard>
</template>
```

### 操作按钮
官方示例：`CardHeaderFooterActionsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard shadow="soft">
    <template #header>
      User info
      <TxButton size="sm" variant="ghost">More</TxButton>
    </template>
    Zhang San · Frontend Engineer
    <template #footer>
      <TxButton size="sm" variant="secondary">Cancel</TxButton>
      <TxButton size="sm" variant="primary">Confirm</TxButton>
    </template>
  </TxCard>
</template>
```

### 变体
`plain` 去掉边框与悬停反馈。
官方示例：`CardVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard variant="solid">solid</TxCard>
  <TxCard variant="dashed">dashed</TxCard>
  <TxCard variant="plain">plain</TxCard>
</template>
```

### 背景材质
`background` 选择表面材质，取值与 [BaseSurface](./base-surface.md) 的 `mode` 相同，默认且推荐 `refraction`。折射默认不跑 SVG 位移层；背景有内容、要看到折射时传 `refraction-renderer="svg"`，强弱用 `refraction-glass-opacity` 调。
官方示例：`CardCardBackgroundsScrollDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard background="refraction" refraction-profile="filmic" refraction-tone="vivid">
    refraction
  </TxCard>
  <TxCard background="glass">glass</TxCard>
  <TxCard background="blur">blur</TxCard>
  <TxCard background="mask">mask</TxCard>
</template>
```

### 动态反光
`specular` 在暗色主题下给卡片加一团跟随指针的微光：表面上是一层 600px 的白色径向光（6%，到 40% 处淡尽），经过边框时，边框那一圈再闪过一道 240px 的窄光。光斑按指数平滑追上指针，移入时直接在指针处亮起，移出后 240ms 淡出；开启减弱动态效果时光斑直接跳到指针处。浅色主题与高对比度下不绘制，`dashed` 边框不画边缘那一圈。不传时跟随 `clickable`，禁用时关闭。各参数的由来见《[Alpha 噪点掩膜与光斑追踪](https://tuff.tagzxia.com/docs/dev/concepts/noise-and-specular)》。
官方示例：`ConceptCardSpecularDemo`（完整源码见本页末尾）

```vue
<template>
  <div class="dark">
    <TxCard specular>
      指针经过时，表面跟着一团微光
    </TxCard>
  </div>
</template>
```

### 空状态
官方示例：`CardCardWithEmptyDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard variant="plain" :padding="16">
    <TxEmpty title="Nothing here" description="Create your first item to get started.">
      <template #action>
        <TxButton variant="primary" size="sm">Create</TxButton>
      </template>
    </TxEmpty>
  </TxCard>
  <TxEmpty title="Empty only" description="No Card wrapper, pure empty block." compact />
</template>
```

### 浮层面板
Popover、SearchSelect 等浮层的面板由 TxCard 渲染，用 `panel-*` 属性配置。
官方示例：`CardCardCompositionsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPopover
    panel-variant="solid"
    panel-shadow="soft"
    :panel-radius="18"
    :panel-padding="10"
  >
    <template #reference>
      <TxButton variant="primary">Popover panel</TxButton>
    </template>
    Popover panel uses TxCard
  </TxPopover>
  <TxSearchSelect
    v-model="value"
    :options="options"
    panel-shadow="soft"
    :panel-radius="18"
    :panel-padding="6"
  />
</template>
```

### 尺寸
`size` 只影响内边距。
官方示例：`CardSizeDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard size="small">size=small</TxCard>
  <TxCard size="medium">size=medium</TxCard>
  <TxCard size="large">size=large</TxCard>
</template>
```

### 内边距与圆角
官方示例：`CardLayoutPropsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard :padding="10" :radius="10">padding=10</TxCard>
  <TxCard :padding="18" :radius="10">padding=18</TxCard>
  <TxCard variant="plain" :padding="14" :radius="22">radius=22</TxCard>
</template>
```

### 状态
官方示例：`CardStatesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard clickable @click="open">clickable</TxCard>
  <TxCard loading :loading-spinner-size="20">loading</TxCard>
  <TxCard disabled>disabled</TxCard>
</template>
```

### 流光底
`flowLight` 透传给卡片的表面，与 `background` 无关；浮层面板通过 `panelCard` 开启。
官方示例：`CardFlowLightDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard shadow="soft" flow-light="rim">
    卡片内容
  </TxCard>
  <TxPopover :panel-card="{ flowLight: 'corners' }">
    <template #reference>
      <TxButton>浮层面板</TxButton>
    </template>
    面板内容
  </TxPopover>
</template>
```

### 最佳实践

- 整卡导航或选择时才用 `clickable`；独立动作放进插槽里的真实按钮或链接。
- 外观优先用 `variant`、`shadow`、`size`、`radius`、`padding` 调整，CSS 变量只用于对齐插槽内容或遮罩底色。
- 需要折射或滤镜的底层参数（`displace`、`distortionScale`、`redOffset` 等）时改用 `TxBaseSurface`。

## API 参考

### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `'solid' \| 'dashed' \| 'plain'` | `'solid'` | 边框形态；`plain` 无边框、无悬停反馈。 |
| `background` | `'pure' \| 'mask' \| 'blur' \| 'glass' \| 'refraction' \| 'acrylic' \| 'mica' \| 'flat' \| 'plain'` | `'refraction'` | 表面材质，取值同 `TxBaseSurface` 的 `mode`。 |
| `shadow` | `'none' \| 'soft' \| 'medium'` | `'none'` | 阴影强度。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 内边距预设：`10` / `12` / `16` px。 |
| `radius` | `number` | `18` | 圆角（px）。 |
| `padding` | `number` | - | 内边距（px），优先于 `size`。 |
| `glassBlur` | `boolean` | `true` | `glass` / `refraction` 下启用模糊。 |
| `glassBlurAmount` | `number` | `22` | `glass` / `refraction` 下的模糊半径（px）。 |
| `glassOverlay` | `boolean` | `true` | `glass` / `refraction` 下启用高光层。 |
| `glassOverlayOpacity` | `number` | `0.18` | 高光层透明度。 |
| `maskOpacity` | `number` | `0.75` | `mask` 下的表面透明度，收敛到 `0..1`；`acrylic` 的着色层取它的 0.8 倍。 |
| `fallbackMaskOpacity` | `number` | `0.26` | 运动中降级为遮罩时的透明度（0–1）。 |
| `surfaceMoving` | `boolean` | `false` | 外部运动标记，与惯性运动合并后转发给表面。 |
| `refractionStrength` | `number` | `62` | 折射强度（0–100），驱动色散与扭曲。 |
| `refractionProfile` | `'soft' \| 'filmic' \| 'cinematic'` | `'filmic'` | 折射风格预设。 |
| `refractionTone` | `'mist' \| 'balanced' \| 'vivid'` | `'vivid'` | 折射色调预设；`vivid` 避免发灰。 |
| `refractionAngle` | `number` | `-24` | 色散主方向（度）。 |
| `refractionRenderer` | `'css' \| 'svg'` | `'css'` | 折射渲染器，同 `TxBaseSurface`：`css` 不跑 SVG 位移层，`svg` 加上它。 |
| `refractionGlassOpacity` | `number` | `0.3` | `svg` 渲染器下位移层的不透明度（0–1）。 |
| `refractionLightFollowMouse` | `boolean` | `false` | 高光锚点跟随指针。 |
| `refractionLightFollowIntensity` | `number` | `0.45` | 跟随权重（0–1），影响色散角度与强度。 |
| `refractionLightSpring` | `boolean` | `true` | 光源跟随使用弹簧过渡。 |
| `refractionLightSpringStiffness` | `number` | `0.15` | 光源弹簧刚度，收敛到 `0.01–0.55`。 |
| `refractionLightSpringDamping` | `number` | `0.6` | 光源弹簧阻尼，收敛到 `0.55–0.99`。 |
| `flowLight` | `'corners' \| 'rim' \| 'aurora' \| false` | - | 表面上的流光底；不传或 `false` 即关闭。 |
| `flowLightIntensity` | `number` | `1` | 流光底强度，乘到主题透明度上。 |
| `clickable` | `boolean` | `false` | 启用悬停与按压反馈（缩至 `0.985`），并派发 `click`。 |
| `specular` | `boolean` | - | 暗色主题下跟随指针的微光与边框反光；不传时跟随 `clickable`，禁用时关闭。 |
| `loading` | `boolean` | `false` | 用 `TxSpinner` 遮罩覆盖卡片。 |
| `loadingSpinnerSize` | `number` | - | Spinner 尺寸（px），省略时为 `12`。 |
| `disabled` | `boolean` | `false` | 禁用样式，阻止 `click` 与指针动效。 |
| `inertial` | `boolean` | `false` | 跟随指针位移，离开后弹簧回弹。 |
| `inertialMaxOffset` | `number` | `22` | 最大跟随位移（px）。 |
| `inertialRebound` | `number` | `0.12` | 回弹系数，收敛到 `0..1`；越大越有弹性。 |

### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `click` | `(event: MouseEvent)` | 可点击且未禁用时，点击或按 Enter / Space 触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|--------|-------|------|
| `default` | - | 正文。 |
| `header` | - | 正文上方的头部。 |
| `footer` | - | 正文下方的底部。 |
| `cover` | - | 头部与正文之前的封面。 |

## 概述

- 可点击时根节点带 `role="button"` 与 `tabindex="0"`，Enter / Space 与点击一样触发 `click`；否则是无语义的 `div`。
- 可点击卡片禁用时设置 `aria-disabled` 并移出 Tab 序列。
- 只响应卡片自身的 Enter / Space，插槽内控件的按键不会触发卡片。
- `loading` 的遮罩带 `aria-hidden`，读屏或表单忙碌提示由调用方负责。
- `background` 作为表面模式转发给 `TxBaseSurface`：`mask` 与 `acrylic` 使用 `maskOpacity`，`mask`、`acrylic`、`mica` 的底色取 `--tx-card-fake-background`；`blur` 与 `acrylic` 都模糊 30px；`glass` 与 `refraction` 使用模糊与高光参数；折射参数只在 `refraction` 下生效。

## 技术实现

- 表面是 `aria-hidden` 的 `TxBaseSurface`；惯性由 `requestAnimationFrame` 弹簧写入 `--tx-card-dx` / `--tx-card-dy`，静止后停止。
- 源码：`packages/tuffex/packages/components/src/card/`。



## 自定义

```css
.custom-card {
  /* mask 与折射降级表面采样的底色 */
  --tx-card-fake-background: color-mix(in srgb, var(--tx-bg-color-overlay, #fff) 92%, transparent);
}
```

| 变量 | 写入方 | 用途 |
|------|--------|------|
| `--tx-card-radius` | `radius` | 根节点的圆角。表面、封面与加载层在边框以内，取它减去 `--tx-card-border-width`，与根节点同心。 |
| `--tx-card-border-width` | `variant` | 边框宽度：`solid`、`dashed` 为 1px，`plain` 为 0；不要手动设置。 |
| `--tx-card-padding` | `padding` 或 `size` | 内边距与封面的负外边距。 |
| `--tx-card-dx` / `--tx-card-dy` | 惯性动效 | 根节点位移；不要手动设置。 |
| `--tx-card-fake-background` | 调用方 / 主题 | `mask`、`acrylic`、`mica` 表面与折射降级表面的底色。 |
| `--tx-card-light-x` / `--tx-card-light-y` | `specular` | 反光的位置（卡片宽高的百分比），写在 `.tx-card__specular` 上；不要手动设置。 |
| `--tx-surface-refraction-mask-color` | 根节点内联样式 | 把 `--tx-card-fake-background` 转给 `TxBaseSurface`；改前者即可。 |

跟随应用主题时覆盖全局 token，如 `--tx-bg-color-overlay`、`--tx-border-color-light`、`--tx-color-primary`。

## 离线完整示例源码

- [CardBasicDemo](../snapshot/apps/nexus/app/components/content/demos/CardBasicDemo.vue.txt)
- [CardBasicSlotsDemo](../snapshot/apps/nexus/app/components/content/demos/CardBasicSlotsDemo.vue.txt)
- [CardInertialDemo](../snapshot/apps/nexus/app/components/content/demos/CardInertialDemo.vue.txt)
- [CardHeaderDemo](../snapshot/apps/nexus/app/components/content/demos/CardHeaderDemo.vue.txt)
- [CardHeaderFooterActionsDemo](../snapshot/apps/nexus/app/components/content/demos/CardHeaderFooterActionsDemo.vue.txt)
- [CardVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/CardVariantsDemo.vue.txt)
- [CardCardBackgroundsScrollDemo](../snapshot/apps/nexus/app/components/content/demos/CardCardBackgroundsScrollDemo.vue.txt)
- [ConceptCardSpecularDemo](../snapshot/apps/nexus/app/components/content/demos/ConceptCardSpecularDemo.vue.txt)
- [CardCardWithEmptyDemo](../snapshot/apps/nexus/app/components/content/demos/CardCardWithEmptyDemo.vue.txt)
- [CardCardCompositionsDemo](../snapshot/apps/nexus/app/components/content/demos/CardCardCompositionsDemo.vue.txt)
- [CardSizeDemo](../snapshot/apps/nexus/app/components/content/demos/CardSizeDemo.vue.txt)
- [CardLayoutPropsDemo](../snapshot/apps/nexus/app/components/content/demos/CardLayoutPropsDemo.vue.txt)
- [CardStatesDemo](../snapshot/apps/nexus/app/components/content/demos/CardStatesDemo.vue.txt)
- [CardFlowLightDemo](../snapshot/apps/nexus/app/components/content/demos/CardFlowLightDemo.vue.txt)

## 离线类型与实现参考

- [card/index.ts](../snapshot/packages/tuffex/packages/components/src/card/index.ts.txt)
- [src/TxCard.vue](../snapshot/packages/tuffex/packages/components/src/card/src/TxCard.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/card/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
