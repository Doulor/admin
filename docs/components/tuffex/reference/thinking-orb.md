# Thinking Orb

> Canvas 绘制的思考指示球

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/thinking-orb) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/thinking-orb.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/thinking-orb.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`ThinkingOrbThinkingOrbDemo`（完整源码见本页末尾）

```vue
<template>
  <TxThinkingOrb />
  <TxThinkingOrb state="searching" :size="64" />
  <TxThinkingOrb state="solving" :size="20" :display-size="14" />
</template>
```

### 渐变

`variant="gradient"` 给点着色；不传 `palette` 时每种形态用自己的配色。

官方示例：`ThinkingOrbGradientDemo`（完整源码见本页末尾）

```vue
<template>
  <TxThinkingOrb state="working" variant="gradient" />
  <TxThinkingOrb state="searching" variant="gradient" palette="violet" />
  <TxThinkingOrb variant="gradient" :palette="['#f97316', '#ec4899', '#8b5cf6']" />
</template>
```

### 最佳实践

- 每次思考换一颗球：用这次思考的标识作 `key`；改 `state` 不会重新随机。
- 需要确定的画面（截图测试、录屏）时显式传 `state`。
- `size` 只传 `20` 或 `64`，其他显示尺寸用 `displaySize`。
- 一次思考只挂一颗球。
- 状态文字要和球同色时，从 `ORB_PALETTES` 取色标做文字渐变。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `state` | `OrbState \| 'random'` | `'random'` | 形态；`'random'` 在挂载时随机取一次，之后不变。 |
| `size` | `20 \| 64` | `20` | 预设几何尺寸，只有这两档经过调校。 |
| `displaySize` | `number` | 同 `size` | 渲染的 CSS 尺寸（px），不影响绘制参数。 |
| `speed` | `number` | `1` | 动画速度倍率。 |
| `paused` | `boolean` | `false` | 暂停动画。 |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` | 配色主题；`auto` 跟随环境。 |
| `variant` | `'mono' \| 'gradient'` | `'mono'` | `gradient` 给点着色，深浅层次不变。 |
| `palette` | `OrbPalette` | 形态自带的配色 | 渐变色标，从左到右；不支持 `var()`，只在 `gradient` 下生效。 |
| `label` | `string` | 按形态的英文文案 | 可访问名称；非英文界面需传入。 |

### 类型

```typescript
type OrbState =
  | 'working' | 'searching' | 'solving' | 'listening' | 'connecting'
  | 'weaving' | 'composing' | 'breathing' | 'shaping'

type OrbVariant = 'mono' | 'gradient'

type OrbPaletteName =
  | 'amber' | 'glacier' | 'violet' | 'rose' | 'magenta'
  | 'teal' | 'indigo' | 'lagoon' | 'forest'

// 配色名，或从左到右的 CSS 颜色
type OrbPalette = OrbPaletteName | readonly string[]

// 九组配色，各三个色标；以及每种形态默认的配色
declare const ORB_PALETTES: Record<OrbPaletteName, readonly [string, string, string]>
declare const ORB_STATE_PALETTES: Record<OrbState, OrbPaletteName>
```

## 概述

- 所有已挂载的球共用一个时钟（`performance.now`），同屏多颗保持同相位。
- 离屏（`IntersectionObserver`）或标签页隐藏时停止绘制。
- 减弱动效时只绘制一帧代表性的静止画面，仍跟随主题切换。
- 画布按 `devicePixelRatio` 提升分辨率，上限为 2。
- 渐变按点的横向位置取色，球转动时颜色随之流动；深色背景下保留原有明暗，近处的点接近白色。
- 没有 canvas（如 jsdom）时保留元素、跳过绘制，不会抛错。

## 技术实现

- 移植自 [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) v0.2.0（MIT © Jakub Antalik），源码文件头保留署名。
- 源码：`packages/tuffex/packages/components/src/thinking-orb/`。

## 离线完整示例源码

- [ThinkingOrbThinkingOrbDemo](../snapshot/apps/nexus/app/components/content/demos/ThinkingOrbThinkingOrbDemo.vue.txt)
- [ThinkingOrbGradientDemo](../snapshot/apps/nexus/app/components/content/demos/ThinkingOrbGradientDemo.vue.txt)

## 离线类型与实现参考

- [thinking-orb/index.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/index.ts.txt)
- [src/TxThinkingOrb.vue](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/TxThinkingOrb.vue.txt)
- [engine/braid.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/braid.ts.txt)
- [engine/core.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/core.ts.txt)
- [engine/ink.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/ink.ts.txt)
- [engine/lattice.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/lattice.ts.txt)
- [engine/morph.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/morph.ts.txt)
- [engine/orbits.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/orbits.ts.txt)
- [engine/profiles.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/profiles.ts.txt)
- [engine/registry.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/registry.ts.txt)
- [engine/ribbon.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/ribbon.ts.txt)
- [engine/types.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/types.ts.txt)
- [engine/web.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/engine/web.ts.txt)
- [src/palettes.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/palettes.ts.txt)
- [src/presets.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/presets.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/thinking-orb/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
