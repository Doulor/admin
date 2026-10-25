# Fusion 交融

> 激活时让两个插槽交融的 gooey 效果

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/fusion) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/fusion.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/fusion.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
插槽 `a`、`b` 在激活时靠拢交融；`gap` 是分开时的距离，`trigger` 决定激活方式。
官方示例：`FusionFusionDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const active = ref(false)
</script>

<template>
  <TxButton @click="active = !active">Toggle</TxButton>
  <TxFusion v-model="active" trigger="hover" :gap="240">
    <template #a><div class="blob blob--large" /></template>
    <template #b><div class="blob blob--small" /></template>
  </TxFusion>
  <TxFusion trigger="click" direction="y" :gap="46">
    <template #a><div class="pill" /></template>
    <template #b><div class="pill" /></template>
  </TxFusion>
</template>
```

### 按钮与提示气泡
`direction="y"` 让两团上下交融。
官方示例：`FusionFusionButtonTooltipDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFusion v-model="active" trigger="hover" direction="y" :gap="44">
    <template #a><!-- 主按钮：Save ⌘S --></template>
    <template #b><!-- 提示气泡：Saved to drafts --></template>
  </TxFusion>
</template>
```

### 头像与角标
官方示例：`FusionFusionAvatarBadgeDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFusion trigger="hover" :gap="64">
    <template #a><!-- 头像 TA --></template>
    <template #b><!-- 角标 8 --></template>
  </TxFusion>
</template>
```

### 状态胶囊与图标
官方示例：`FusionFusionChipIconDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFusion trigger="hover" :gap="54">
    <template #a><!-- 状态胶囊：Synced --></template>
    <template #b><!-- 圆形徽标：✓ --></template>
  </TxFusion>
</template>
```

### 迷你卡片与浮动按钮
官方示例：`FusionFusionMiniCardFabDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFusion v-model="active" trigger="hover" :gap="92">
    <template #a><!-- Quick Note 卡片 --></template>
    <template #b><!-- 浮动 + 按钮 --></template>
  </TxFusion>
</template>
```

### 最佳实践

- 只做装饰性点缀，不要让它成为表达关键状态的唯一方式。
- 父级状态机、表单或路由需要确定性控制时，用 `trigger="manual"`。
- 两个形状的尺寸保持相近，并把 `gap`、`blur`、`alpha`、`alphaOffset` 一起调。
- 用户偏好减少动态效果时，由宿主设置 `disabled` 或保持未激活。
- 插槽里有按钮或链接时不要用 `trigger="click"`，避免交互冲突。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `boolean \| undefined` | `undefined` | 受控激活状态；省略时使用内部状态。 |
| `disabled` | `boolean` | `false` | 禁止触发状态变化，并显示禁用态。 |
| `trigger` | `'hover' \| 'click' \| 'manual'` | `'hover'` | 激活方式；`manual` 不响应指针，只认 `v-model`。 |
| `direction` | `'x' \| 'y'` | `'x'` | 分开时两团的排列轴。 |
| `gap` | `number` | `40` | 未激活时两团的距离（px）。 |
| `duration` | `number` | `260` | 过渡时长（ms）；负值按 `0`。 |
| `easing` | `string` | `'cubic-bezier(0.2, 0.8, 0.2, 1)'` | 位移过渡的 CSS 缓动。 |
| `blur` | `number` | `19` | gooey 滤镜的 `feGaussianBlur.stdDeviation`。 |
| `alpha` | `number` | `29` | color matrix 的 alpha 倍率；越大越「粘」。 |
| `alphaOffset` | `number` | `-10` | color matrix 的 alpha 偏移。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `change` | `(v: boolean)` | 触发器请求新的激活状态时派发；禁用时不派发。 |
| `update:modelValue` | `(v: boolean)` | 与 `change` 同时派发；受控时须写回。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `a` | - | 第一团；未激活时位于 `direction` 的负方向。 |
| `b` | - | 第二团；未激活时位于 `direction` 的正方向。 |

## 概述

- `modelValue` 为布尔值时受控，否则使用内部状态；两种模式都派发事件。
- `hover` 在指针进入时激活、离开时取消；`click` 点击根节点切换；`manual` 不响应指针。
- `trigger="click"` 时根节点带 `role="button"`：可 Tab 聚焦，Enter / Space 切换，`aria-pressed` 反映状态。
- `disabled` 时根节点 `pointer-events: none`，交互不产生更新。
- 非有限的 `alpha` / `alphaOffset` 回退到安全的 color matrix 值。
- 插槽内容渲染在滤镜图层中；插槽内的控件自行负责标签、焦点与键盘语义。

## 技术实现

- 两团各自做 `transform` 位移，外层 SVG 滤镜（`feGaussianBlur` + `feColorMatrix`）把重叠处融成一体。
- 源码：`packages/tuffex/packages/components/src/fusion/`。

## 离线完整示例源码

- [FusionFusionDemo](../snapshot/apps/nexus/app/components/content/demos/FusionFusionDemo.vue.txt)
- [FusionFusionButtonTooltipDemo](../snapshot/apps/nexus/app/components/content/demos/FusionFusionButtonTooltipDemo.vue.txt)
- [FusionFusionAvatarBadgeDemo](../snapshot/apps/nexus/app/components/content/demos/FusionFusionAvatarBadgeDemo.vue.txt)
- [FusionFusionChipIconDemo](../snapshot/apps/nexus/app/components/content/demos/FusionFusionChipIconDemo.vue.txt)
- [FusionFusionMiniCardFabDemo](../snapshot/apps/nexus/app/components/content/demos/FusionFusionMiniCardFabDemo.vue.txt)

## 离线类型与实现参考

- [fusion/index.ts](../snapshot/packages/tuffex/packages/components/src/fusion/index.ts.txt)
- [src/TxFusion.vue](../snapshot/packages/tuffex/packages/components/src/fusion/src/TxFusion.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/fusion/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
