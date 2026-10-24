# BotAvatar

> 用 canvas 绘制的动画机器人头像

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/bot-avatar) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/bot-avatar.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/bot-avatar.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.2`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`state` 跟随智能体的真实状态：流式输出或执行中为 `working`，空闲为 `default`。
官方示例：`BotAvatarShowcaseDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const working = ref(true)
const TYPES = ['clover', 'flower', 'star', 'ghost', 'mech', 'circle', 'hexagon', 'square']
</script>

<template>
  <TxBotAvatar
    v-for="type in TYPES"
    :key="type"
    :type="type"
    :state="working ? 'working' : 'default'"
    :size="64"
  />

  <TxBotAvatar type="clover" :size="96" />
  <TxBotAvatar type="clover" :size="32" />
</template>
```

### 对话回复

```vue
<template>
  <div class="msg msg--bot">
    <TxBotAvatar type="clover" :state="streaming ? 'working' : 'default'" :size="32" />
    <div class="msg-body">
      {{ streaming ? '思考中…' : content }}
    </div>
  </div>
</template>
```

### 智能体名册
每个实例默认错开眨眼时机，同一行不会同时眨眼。

```vue
<template>
  <ul class="roster">
    <li v-for="agent in agents" :key="agent.id">
      <TxBotAvatar :type="agent.avatar" :state="agent.busy ? 'working' : 'default'" :size="32" aria-hidden />
      <span>{{ agent.name }}</span>
      <span class="muted">{{ agent.status }}</span>
    </li>
  </ul>
</template>
```

### 静态头像

```vue
<template>
  <TxBotAvatar type="hexagon" :size="96" paused />
</template>
```

### 最佳实践

- 用 `size` 控制尺寸，不要在 `style` 或类里写 `width`、`height`、`margin`，否则头像会位移或被裁。
- 头像上方留出空间：画布按 `size` 的 1.5 倍绘制，跳跃会超出布局盒，`overflow: hidden` 的父级会把它裁掉。
- 映射自有状态：`running` / `streaming` / `pending` / `busy` → `working`；`idle` / `ready` / `online` → `default`；`offline` / `away` / `disabled` → `default` 加 `paused`。
- 名称与状态已在旁边以文字呈现时，加 `aria-hidden` 作为装饰。
- 只用于机器人；真人头像用照片或首字母。

## API 参考

### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `BotAvatarType` | `'clover'` | 体型，各带调色板颜色。 |
| `face` | `BotAvatarFace` | 该体型默认 | 面部类型。 |
| `state` | `'default' \| 'working' \| 'sleeping'` | `'default'` | 空闲（张望、眨眼、偶尔跳跃）、工作（跳跃旋转并微笑）或睡眠。 |
| `size` | `number \| string` | `64` | 布局尺寸，也接受任意 CSS 长度。 |
| `color` | `string` | 体型调色板 | 身体颜色。 |
| `ink` | `string` | 自动 | 面部墨色；默认深色，深色身体上为浅色。 |
| `brightness` / `saturation` | `number` | `1` / `1.5` | 身体颜色的明度与饱和度。 |
| `speed` | `number` | `1` | 所有动画的速度倍数。 |
| `paused` | `boolean` | `false` | 把动画冻结在当前帧。 |
| `seed` | `number` | 由实例派生 | 错开眨眼与张望时机，避免整行同步。 |
| `shading` | `'plastic' \| 'crisp' \| 'smooth' \| 'flat' \| boolean` | `'plastic'` | 打光方式；`true` 即 `crisp`，`false` 即 `flat`。 |
| `shadow` / `highlight` | `number` | `0.35` / `1.3` | 暗面与亮面的强度。 |
| `depth` | `number` | `0.65` | 身体厚度，0.2–2。 |
| `light` | `number` | `265` | 光源方向，自顶部顺时针的角度。 |
| `rim` | `number` | `0.5` | `crisp` 下为亮边宽度，`plastic` 下为菲涅尔强度。 |
| `spread` | `number` | `1.55` | 柔光覆盖范围或高光宽度。 |
| `interactive` | `boolean` | `true` | 眼睛与头部跟随靠近的指针；点击会跳起转身。 |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` | 所在表面；`auto` 先读祖先的 `data-theme` 属性或类，再读系统。 |
| `turn` | `number` | `1` | 空闲时左右转头的幅度。 |
| `whirl` | `number` | `0` | 旋转时旋风环的强度。 |
| `whirlSize` / `whirlWidth` / `whirlLength` / `whirlTilt` | `number` | `1` | 旋风环的几何。 |
| `jumpHeight` | `number` | `26` | 跳跃高度，以身体高 100 为单位。 |
| `jumpTime` | `number` | `0.68` | 一次跳跃的滞空秒数。 |
| `jumpStretch` / `jumpSquash` | `number` | `1` / `1.15` | 空中拉伸与落地压扁。 |
| `jumpSquashTime` / `jumpSquashEase` | `number` / `BotAvatarSquashEase` | `0.37` / `'pulse'` | 落地压扁从触地到复原的秒数与缓动。 |
| `jumpGroundTime` / `jumpGroundEase` | `number` / `BotAvatarSquashEase` | `0.11` / `'pulse'` | 停在最深压扁处的秒数与缓动。 |
| `jumpRiseTime` / `jumpRiseEase` | `number` / `BotAvatarSquashEase` | `0.33` / `'pulse'` | 从最深压扁回到原形的秒数与缓动。 |
| `jumpClickSquashTime` | `number` | `0.24` | 点击跳跃的落地压扁时长。 |
| `jumpSpin` | `number` | `1` | 空中转的整圈数。 |
| `jumpLean` | `number` | `6` | 跳跃时的倾斜角度。 |
| `jumpEvery` | `number` | `8` | 空闲跳跃间隔秒数（±40%）；`0` 关闭。 |
| `jumpLand` | `number` | `0` | 落地压扁相对触地的开始时刻（秒）。 |

`BotAvatarType` 共 18 种：`clover`、`flower`、`triangle`、`square`、`blob`、`ghost`、`circle`、`drop`、`star`、`droid`、`mech`、`alien`、`hexagon`、`cat`、`cloud`、`pill`、`pebble`、`puddle`。`BotAvatarFace` 为 `'eyes' | 'mouth'`。`BotAvatarSquashEase` 为 `'sharp' | 'pulse' | 'soft' | 'bouncy'`。

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `canvas` | `HTMLCanvasElement \| null` | 根 `<canvas>` 元素。 |

## 概述

- 画布为 `role="img"`，`aria-label` 随状态变化（如 "Clover bot, idle"）；传入 `aria-label` 可覆盖。
- 其余属性与 DOM 事件直接透传到 `<canvas>`，`class`、`style`、`data-*` 照常可用。
- 未知 `state` 回退到 `default`，未知 `type` 回退到 `clover`。
- 全页共用一个 `requestAnimationFrame` 循环；实例离开视口或标签页隐藏时停止绘制。
- 减少动态效果时不启动循环，只画当前状态的静止姿势；该偏好在渲染时读取，不实时监听。
- 状态切换带过渡，每个 token 或工具调用都切换 `state` 也安全。

## 技术实现

- 设备像素比上限为 2；`plastic` 打光在某体型首次出现时于空闲时间烘焙，完成前以柔和外观顶替。
- 绘制引擎逐字移植自上游 [Jakubantalik/Libraries · bot-avatars](https://github.com/Jakubantalik/Libraries/tree/main/packages/bot-avatars)（MIT © Jakub Antalik），Vue 壳对应上游 React 组件。
- 源码：`packages/tuffex/packages/components/src/bot-avatar/`。

## 离线完整示例源码

- [BotAvatarShowcaseDemo](../snapshot/apps/nexus/app/components/content/demos/BotAvatarShowcaseDemo.vue.txt)

## 离线类型与实现参考

- [bot-avatar/index.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/index.ts.txt)
- [src/TxBotAvatar.vue](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/TxBotAvatar.vue.txt)
- [src/color.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/color.ts.txt)
- [src/draw.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/draw.ts.txt)
- [src/engine.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/engine.ts.txt)
- [src/plastic.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/plastic.ts.txt)
- [src/presets.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/presets.ts.txt)
- [src/shapes.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/shapes.ts.txt)
- [src/ticker.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/ticker.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/bot-avatar/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
