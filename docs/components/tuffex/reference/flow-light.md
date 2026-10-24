# FlowLight 流光底

> 固定品牌色的面板光层

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/flow-light) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/flow-light.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/flow-light.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.8.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

```bash
pnpm add @talex-touch/tuffex
```

```typescript
import { TxFlowLight } from '@talex-touch/tuffex/flow-light'
import '@talex-touch/tuffex/flow-light/style.css'
import '@talex-touch/tuffex/base.css' // 设计令牌与重置样式，全应用引入一次
```

## 用法

### 三种画法
`variant` 选择双角柔光、顶缘流光带或极光漫射；深色背景下透明度自动提高。
官方示例：`FlowLightVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <div class="panel">
    <TxFlowLight variant="corners" />
    <!-- 面板内容 -->
  </div>
</template>

<style scoped>
.panel {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
}
</style>
```

### 用在菜单上
锚点家族的面板通过 `panelCard` 开启；子菜单没有指定时沿用根菜单的流光底。
官方示例：`FlowLightMenuDemo`（完整源码见本页末尾）

```vue
<template>
  <TxDropdownMenu :panel-card="{ flowLight: 'rim' }">
    <template #trigger>
      <TxButton>项目操作</TxButton>
    </template>
    <TxDropdownItem>新建对话</TxDropdownItem>
    <TxDropdownSubmenu>
      在本机代理中打开
      <template #menu>
        <TxDropdownItem>OMP</TxDropdownItem>
      </template>
    </TxDropdownSubmenu>
  </TxDropdownMenu>
</template>
```

### 强度
`intensity` 乘到主题透明度上，`0` 即关闭。
官方示例：`FlowLightIntensityDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlowLight variant="corners" :intensity="0.5" />
  <TxFlowLight variant="corners" :intensity="1.6" />
</template>
```

### 自定义颜色
`colors` 依次替换蓝、紫、红、橙四个色标，没给的保持默认。
官方示例：`FlowLightColorsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlowLight
    variant="rim"
    :colors="['#06b6d4', '#14b8a6', '#22c55e', '#84cc16']"
  />
</template>
```

### 最佳实践

- 放进带 `position` 和圆角、`overflow: hidden` 的容器；它铺满容器、继承圆角，不接收指针。
- 面板优先用宿主的 `flowLight`（TxBaseSurface、TxCard、`panelCard`），光层会落在遮罩之上、描边之下。
- 菜单、子菜单与同级弹层用同一种画法；子菜单不必重复设置。
- 文字密集的面板用 `rim`，或调低 `intensity`，让光留在边缘。

## API 参考

### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `'corners' \| 'rim' \| 'aurora'` | `'corners'` | 画法：双角柔光、顶缘流光带、极光漫射。 |
| `intensity` | `number` | `1` | 乘到主题透明度上；小于 0 按 0 计。 |
| `colors` | `readonly string[]` | - | 依次替换蓝、紫、红、橙四个色标，最多四个。 |

### 在其他组件上开启

| 组件 | 属性 | 说明 |
|------|------|------|
| TxBaseSurface | `flowLight` / `flowLightIntensity` | 任何 `mode` 都能开；不传或 `false` 即关闭。 |
| TxCard | `flowLight` / `flowLightIntensity` | 透传给卡片的表面，与 `background` 无关。 |
| Popover、DropdownMenu 等锚点面板 | `panelCard.flowLight` / `panelCard.flowLightIntensity` | 透传给面板卡片。 |
| TxDropdownSubmenu | `panelCard.flowLight` / `panelCard.flowLightIntensity` | 不传时各自沿用根菜单的值；`flowLight: false` 关闭。 |

### CSS 变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--tx-flow-light-color-1` … `-4` | `#0894ff`、`#c959dd`、`#ff2e54`、`#ff9004` | 四个色标；`colors` 写入的就是它们。 |
| `--tx-flow-light-opacity` | 按画法与主题 | 覆盖主题透明度：浅色 `corners` 0.2、`rim` 0.55、`aurora` 0.14，深色 0.34、0.75、0.26。 |
| `--tx-flow-light-intensity` | `1` | 透明度乘数；`intensity` 写入的就是它。 |

- 变量在使用处读取，写在组件或任一祖先上都生效。

## 概述

- 一层铺满容器的装饰层：`aria-hidden`、不接收指针、继承容器圆角。
- 颜色固定为 Tuff 品牌色（与输入框的流光同源），不随背后的内容变化；琉光（refraction）的色散只能染出背后已有的颜色，背后一片黑时就没有光。
- `[data-theme='dark']` 或 `.dark` 祖先下，每种画法的透明度更高。
- 高对比度（`html.contrast`、`html[data-tx-contrast='high']`，或 `prefers-contrast: more` 且无 `html[data-tx-contrast='normal']`）下隐藏，不降低正文对比度。
- 静态，不做动画，减少动态效果时无需降级。

## 技术实现

- 纯 CSS：`corners` 与 `aurora` 是几层 `radial-gradient`（`aurora` 另加 14px 模糊），`rim` 是一道横向渐变，用纵向 `mask-image` 收成顶边 1px 的亮线和其下三分之一的光晕。
- 在 TxBaseSurface 里渲染为 `.tx-base-surface__layer--flow-light`：与遮罩同为 `z-index: 3` 且排在其后，在描边（4）与内容（5）之下。
- 源码：`packages/tuffex/packages/components/src/flow-light/`。



## 相关组件

- [BaseSurface 基础表面层](./base-surface.md)：承载流光底的材质层。
- [Card 卡片](./card.md)：浮层面板的卡片，`flowLight` 透传到这里。
- [DropdownMenu 下拉菜单](./dropdown-menu.md)：子菜单沿用根菜单的流光底。
- [BorderBeam 流光边框](./border-beam.md)：沿边框流动的光；流光底是面板底面上的固定光。

## 离线完整示例源码

- [FlowLightVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/FlowLightVariantsDemo.vue.txt)
- [FlowLightMenuDemo](../snapshot/apps/nexus/app/components/content/demos/FlowLightMenuDemo.vue.txt)
- [FlowLightIntensityDemo](../snapshot/apps/nexus/app/components/content/demos/FlowLightIntensityDemo.vue.txt)
- [FlowLightColorsDemo](../snapshot/apps/nexus/app/components/content/demos/FlowLightColorsDemo.vue.txt)

## 离线类型与实现参考

- [flow-light/index.ts](../snapshot/packages/tuffex/packages/components/src/flow-light/index.ts.txt)
- [src/TxFlowLight.vue](../snapshot/packages/tuffex/packages/components/src/flow-light/src/TxFlowLight.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/flow-light/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
