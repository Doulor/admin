# BorderBeam 流光边框

> 沿边框游走或呼吸的光束包装器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/border-beam) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/border-beam.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/border-beam.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 旋转形态
`size` 取 `sm`、`md` 或 `line`；`line` 只沿底边游走。
官方示例：`BorderBeamShowcaseDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed } from 'vue'

const colorMode = useColorMode()
const beamTheme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
</script>

<template>
  <TxBorderBeam :theme="beamTheme" :border-radius="16">
    <TxCard :radius="16" :padding="24">md</TxCard>
  </TxBorderBeam>
  <TxBorderBeam size="sm" :theme="beamTheme">
    <TxButton round variant="secondary">sm</TxButton>
  </TxBorderBeam>
  <TxBorderBeam size="line" :theme="beamTheme" :border-radius="12">
    <TxInput placeholder="line" />
  </TxBorderBeam>
</template>
```

### 脉冲形态
`pulse-inner` 在边框内呼吸；`pulse-outside` 从内容背后向外扩散，子元素须不透明并自带 1px 边框。
官方示例：`BorderBeamPulseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBorderBeam size="pulse-inner" :active="active" :border-radius="16">
    <TxCard :radius="16" :padding="28">pulse-inner</TxCard>
  </TxBorderBeam>
  <TxBorderBeam size="pulse-outside" :active="active" :border-radius="16">
    <TxCard :radius="16" :padding="28">pulse-outside</TxCard>
  </TxBorderBeam>
  <TxSwitch v-model="active" />
</template>
```

### 配色与主题
`colorVariant` 有四种配色；`theme` 按背景深浅调色，`auto` 跟随系统。

```vue
<template>
  <TxBorderBeam color-variant="ocean" theme="light">
    <div class="card">ocean · light</div>
  </TxBorderBeam>
  <TxBorderBeam color-variant="sunset" :strength="0.7">
    <div class="card">sunset · 70%</div>
  </TxBorderBeam>
</template>
```

### 节奏
`duration` 是一圈游走或一次呼吸的秒数；`hueRange` 限定色相摆幅，`staticColors` 冻结色相。

```vue
<template>
  <TxBorderBeam :duration="4" :hue-range="60">
    <div class="card">慢速 · 大色相摆幅</div>
  </TxBorderBeam>
  <TxBorderBeam static-colors>
    <div class="card">静止配色</div>
  </TxBorderBeam>
</template>
```

### 最佳实践

- 插槽内容自带背景，圆角与 `borderRadius` 一致。
- `pulse-outside` 的周围要留出溢出空间（`overflow: visible`）。
- 一个区块只放一个光束；同屏多个时调低 `strength` 或放慢 `duration`。
- 浅色页面用 `theme="light"` 或 `"auto"`；默认的深色参数在浅色背景上对比不足。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `size` | `'sm' \| 'md' \| 'line' \| 'pulse-outside' \| 'pulse-inner'` | `'md'` | 形态预设：旋转（`sm`、`md`、`line`）或脉冲。 |
| `colorVariant` | `'colorful' \| 'mono' \| 'ocean' \| 'sunset'` | `'colorful'` | 配色；`mono` 同时冻结色相。 |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | 按背景深浅调色；`auto` 跟随系统。 |
| `strength` | `number` | `1` | 光束层强度（0–1），不影响插槽内容。 |
| `duration` | `number` | `1.96` / `3.1` / `2.3` | 周期秒数；默认值依次对应旋转、`line`、脉冲。 |
| `active` | `boolean` | `true` | 是否播放；切换时淡入淡出。 |
| `borderRadius` | `number` | 自动检测 | 光束圆角（px）。 |
| `brightness` | `number` | 按形态预设（`1.3`） | 光晕亮度倍率。 |
| `saturation` | `number` | `1.2`（暗色） | 光晕饱和度倍率。 |
| `hueRange` | `number` | `30` | 色相摆幅（度）；`line` 上限 13。 |
| `staticColors` | `boolean` | `false` | 关闭色相动画。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `activate` | - | 淡入结束时触发。 |
| `deactivate` | - | 淡出结束时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 被包裹的内容。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--beam-strength` | `strength` | 光束层不透明度，钳制在 0–1。 |
| `--pulse-glow-sx` / `--pulse-glow-sy` | 内部测量 | `pulse-outside` 光晕按元素尺寸的轴向缩放。 |
| `--pulse-glow-boost` | 消费方可选 | 脉冲光晕增益，默认 `1`。 |

## 概述

- 特效层均为 `pointer-events: none`，不拦截插槽交互，焦点样式由插槽内容提供。
- 未设 `borderRadius` 时读取首个插槽元素的 `border-top-left-radius`，读不到则用形态预设值。
- 滚出视口（余量 256px）时暂停动画，不派发 `activate` / `deactivate`。
- 减少动态效果时，脉冲形态停止呼吸。

## 技术实现

- 每个实例注入一段以 `data-beam` 隔离的 `<style>`；脉冲形态由共享的约 30fps rAF 循环驱动。
- `styles.ts` 与 `pulse-driver.ts` 移植自 [Jakubantalik/Libraries · border-beam](https://github.com/Jakubantalik/Libraries/tree/main/packages/border-beam)（MIT © Jakub Antalik）。
- 源码：`packages/tuffex/packages/components/src/border-beam/`。

## 离线完整示例源码

- [BorderBeamShowcaseDemo](../snapshot/apps/nexus/app/components/content/demos/BorderBeamShowcaseDemo.vue.txt)
- [BorderBeamPulseDemo](../snapshot/apps/nexus/app/components/content/demos/BorderBeamPulseDemo.vue.txt)

## 离线类型与实现参考

- [border-beam/index.ts](../snapshot/packages/tuffex/packages/components/src/border-beam/index.ts.txt)
- [src/TxBorderBeam.vue](../snapshot/packages/tuffex/packages/components/src/border-beam/src/TxBorderBeam.vue.txt)
- [src/pulse-driver.ts](../snapshot/packages/tuffex/packages/components/src/border-beam/src/pulse-driver.ts.txt)
- [src/styles.ts](../snapshot/packages/tuffex/packages/components/src/border-beam/src/styles.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/border-beam/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
