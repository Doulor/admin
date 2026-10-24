# OutlineBorder 描边容器

> 带描边与可选裁切的包裹容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/outline-border) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/outline-border.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/outline-border.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 描边模式
头像类描边用 `ring-offset`；描边需要参与布局尺寸时用 `border`。
官方示例：`OutlineBorderBasicDemo`（完整源码见本页末尾）

```vue
<template>
  <TxOutlineBorder :ring-width="2" ring-color="var(--tx-color-primary)" :offset="2">
    <div class="avatar">TX</div>
  </TxOutlineBorder>

  <TxOutlineBorder variant="border" :border-width="2" shape="rect" :border-radius="12">
    <div class="avatar avatar--rect">UI</div>
  </TxOutlineBorder>
</template>
```

### 遮罩裁切
圆角表达不了的形状（如六边形）用 `clip-mode="mask"`。
官方示例：`OutlineBorderMaskClipDemo`（完整源码见本页末尾）

```vue
<template>
  <TxOutlineBorder
    variant="ring"
    :ring-width="2"
    ring-color="var(--tx-color-primary)"
    clip-mode="mask"
    clip-shape="hexagon"
  >
    <div class="hex-avatar">AI</div>
  </TxOutlineBorder>
</template>
```

### 最佳实践

- 圆形或圆角头像优先用 `overflow`，比 `mask` 开销更低、更易排查。
- 内容与描边需要视觉间隔时用 `ring-offset`。
- 给插槽内容设置明确宽高，让遮罩与描边的几何保持稳定。
- 只在行内上下文用 `as="span"`；卡片、缩略图与列表媒体保持块级包裹。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `as` | `string` | `'div'` | 根节点标签。 |
| `variant` | `'border' \| 'ring' \| 'ring-offset' \| 'ring-inset'` | `'ring-offset'` | 描边模式。 |
| `shape` | `'circle' \| 'rect' \| 'squircle'` | `'circle'` | 形状，决定默认圆角与 `clipShape="auto"` 的结果。 |
| `borderRadius` | `string \| number` | - | 显式圆角。 |
| `borderWidth` | `string \| number` | `'1px'` | border 宽度，也是 ring 宽度的回退值。 |
| `borderColor` | `string` | `'var(--tx-border-color)'` | border 颜色，也是 ring 颜色的回退值。 |
| `borderStyle` | `'solid' \| 'dashed' \| 'dotted'` | `'solid'` | `variant="border"` 的边框样式。 |
| `ringWidth` | `string \| number` | `borderWidth` | ring 宽度。 |
| `ringColor` | `string` | `borderColor` | ring 颜色。 |
| `offset` | `string \| number` | `'2px'` | `variant="ring-offset"` 的间隔宽度。 |
| `offsetBg` | `string` | `'var(--tx-bg-color)'` | 间隔区域的颜色。 |
| `padding` | `string \| number` | `0` | 内层插槽包裹器的内边距。 |
| `clipMode` | `'none' \| 'overflow' \| 'clipPath' \| 'mask'` | `'overflow'` | 内容层的裁切策略。 |
| `clipShape` | `'auto' \| 'circle' \| 'rounded' \| 'squircle' \| 'hexagon'` | `'auto'` | 裁切形状；`auto` 把 `shape` 映射为 `circle`、`rounded` 或 `squircle`。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `default` | - | 被描边与裁切层包裹的内容。 |

## 概述

- 组件没有内置尺寸，盒子大小由插槽内容决定；尺寸类属性的数字按 px 处理。
- `variant="border"` 写入真实 CSS border；ring 系列用 `box-shadow`，不改变布局尺寸。
- `clipMode`：`overflow` 用 `border-radius` 裁切，`clipPath` 写 CSS `clip-path`，`mask` 写内联 SVG 遮罩（仅 `circle`、`hexagon`、`squircle`）。
- `clipPath` 下 `rounded` 与 `squircle` 都解析为 `inset(0 round var(--tx-outline-radius))`，真正的 squircle 只在 `mask` 下呈现。
- 描边只跟随 `border-radius`，`clipShape` 只作用于内容层，所以描边不贴合 `hexagon` / `squircle`；需要异形描边时改用异形 `drop-shadow` 滤镜。
- 只是视觉包裹器，不添加 role、标签或图片语义；alt 文本、焦点与点击目标放在插槽内容上。

## 技术实现

- 描边画在根节点，裁切作用于内容层 `.tx-outline-border__content`，两者经 `--tx-outline-radius` 共用圆角。
- 源码：`packages/tuffex/packages/components/src/outline-border/`。

## 离线完整示例源码

- [OutlineBorderBasicDemo](../snapshot/apps/nexus/app/components/content/demos/OutlineBorderBasicDemo.vue.txt)
- [OutlineBorderMaskClipDemo](../snapshot/apps/nexus/app/components/content/demos/OutlineBorderMaskClipDemo.vue.txt)

## 离线类型与实现参考

- [outline-border/index.ts](../snapshot/packages/tuffex/packages/components/src/outline-border/index.ts.txt)
- [src/TxOutlineBorder.vue](../snapshot/packages/tuffex/packages/components/src/outline-border/src/TxOutlineBorder.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/outline-border/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
