# Tooltip 提示

> 悬停或聚焦时显示的简短提示

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tooltip) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tooltip.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tooltip.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

```vue
<template>
  <TxTooltip content="复制成功">
    <TxButton variant="ghost">Copy</TxButton>
  </TxTooltip>
</template>
```

### 悬停提示
`trigger` 默认为 `hover`，键盘聚焦 reference 时同样打开。
官方示例：`TooltipHoverDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTooltip content="提示信息">
    <TxButton variant="ghost">悬停查看</TxButton>
  </TxTooltip>
  <TxTooltip content="信息">
    <TxButton variant="ghost">信息</TxButton>
  </TxTooltip>
</template>
```

### 图标按钮
官方示例：`TooltipButtonDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTooltip content="分享">
    <TxButton icon="i-carbon-share" circle />
  </TxTooltip>
</template>
```

### Anchor 配置
`anchor` 透传给 BaseAnchor，覆盖面板背景、定位、箭头等默认值。
官方示例：`TooltipIndicatorDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTooltip
    content="显示箭头"
    :anchor="{ showArrow: true }"
  >
    <TxButton variant="ghost">状态详情</TxButton>
  </TxTooltip>

  <TxTooltip
    content="右侧定位 + 中等阴影"
    :anchor="{ placement: 'right', showArrow: true, panelShadow: 'medium' }"
  >
    <TxButton variant="ghost">服务状态</TxButton>
  </TxTooltip>
</template>
```

### 点击切换
`trigger="click"` 时点击 reference 切换，点击外部关闭。
官方示例：`TooltipClickOutsideCloseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTooltip v-model="open" trigger="click" content="点击切换，点击外部关闭">
    <TxButton variant="ghost">点击我</TxButton>
  </TxTooltip>
</template>
```

### 点击外部不关闭
`closeOnClickOutside` 设为 `false` 后，只有再次点击 reference 或按 Esc 才关闭。
官方示例：`TooltipClickOutsideKeepDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTooltip
    v-model="open"
    trigger="click"
    :close-on-click-outside="false"
    content="点击切换，点击外部不关闭"
  >
    <TxButton variant="ghost">固定提示</TxButton>
  </TxTooltip>
</template>
```

### 后台反馈中心
Tooltip 只解释一个动作或指标；持续展示结果用 `TxToastHost`，阻断刷新中的面板用 `TxLoadingOverlay`。
官方示例：`ComponentsFeedbackTaskCenterDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTooltip
    content="Tooltip 只解释当前动作。"
    :anchor="{ placement: 'bottom', panelShadow: 'medium' }"
  >
    <TxButton variant="secondary">发送提示</TxButton>
  </TxTooltip>
</template>
```

### 最佳实践

- 文案保持一行以内。
- 外观、定位与动效通过 `anchor` 配置。
- 不放表单、长说明或批量操作；复杂内容改用 `TxPopover` 或 `TxDrawer`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `boolean` | `undefined` | 是否打开（`v-model`）；省略时为非受控。 |
| `content` | `string` | `''` | 提示文本；提供 `content` 插槽时不使用。 |
| `disabled` | `boolean` | `false` | 阻止打开，变为禁用时关闭。 |
| `trigger` | `'hover' \| 'click' \| 'focus' \| 'manual'` | `'hover'` | 触发方式；`manual` 不绑定 reference 交互，开合由 `modelValue` 决定。 |
| `openDelay` | `number` | 见 `layer` 预设（`hint` 为 `200`） | hover / focus 下的打开延迟（ms）；不传时由共享延迟服务提供。 |
| `closeDelay` | `number` | 见 `layer` 预设（`hint` 为 `120`） | hover / focus 下的关闭延迟（ms）；不传时由共享延迟服务提供。 |
| `maxHeight` | `number` | `320` | 面板最大高度（px），`<= 0` 不限；使用 `content` 插槽且未设置时也不限。 |
| `referenceFullWidth` | `boolean` | `false` | reference 包装层占满宽度。 |
| `interactive` | `boolean` | `false` | hover 模式下允许指针移进面板而不关闭。 |
| `keepAliveContent` | `boolean` | `false` | 关闭后保留面板内容挂载。 |
| `closeOnClickOutside` | `boolean` | `trigger === 'click'` | 点击外部时关闭；优先于 `anchor` 中的同名配置。 |
| `toggleOnReferenceClick` | `boolean` | `trigger === 'click'` | 点击 reference 时切换；优先于 `anchor` 中的同名配置。 |
| `layer` | `'hint' \| 'menu' \| 'dialog'` | `'hint'` | 浮层语义层级，决定延迟预设、互斥规则与默认动画。 |
| `role` | `string` | `'tooltip'` | 面板的 ARIA 角色；非 `tooltip` 时 reference 不再带 `aria-describedby`。 |
| `unstyled` | `boolean` | `false` | 去掉提示的文字样式与高度上限，原样渲染内容。 |
| `anchor` | `Partial<TooltipAnchorProps>` | `{}` | 透传给 `TxBaseAnchor`，覆盖 Tooltip 的定位、面板与动画默认值；不含 `modelValue`、`disabled`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value: boolean) => void` | 开合状态变化时触发。 |
| `open` | `() => void` | 由关闭变为打开后触发。 |
| `close` | `() => void` | 由打开变为关闭后触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `default` | - | reference 内容，包在触发用的 span 内。 |
| `content` | `{ side: string }` | 自定义提示内容；`side` 为最终落位方向。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `updatePosition` | `() => void` | 重新计算面板定位。 |

## 概述

- 传 `modelValue` 时受控，否则内部维护开合。
- hover / focus 按 `openDelay` / `closeDelay` 开合；click 的切换与外部点击由 BaseAnchor 处理。
- `interactive` 时，悬停区是整个浮层：面板外框（含内边距）加 reference 与面板之间的悬停桥；离开整个浮层才安排关闭。
- 同样只在 `interactive` 时：指针朝面板离开 reference 后，只要保持移动且不出安全三角，面板与父层都不关闭，途经的其他悬停触发器也不打开；停顿超过 100ms 或离开三角形即按 `closeDelay` 关闭，停在其他触发器上则由它接手。
- 面板内容带 `role="tooltip"` 与 `data-side`。
- 默认动画为 `{ type: 'boom' }`，`anchor.animation` 会整体覆盖；默认不画箭头，开启后间距仍为 `offset`（默认 8px）。

## 技术实现

- 安全三角的判定在 `packages/tuffex/packages/utils/hover-intent.ts`，只在途中监听 `pointermove`；父层的延后关闭由锚点延迟服务挂起。
- 源码：`packages/tuffex/packages/components/src/tooltip/`。

## 离线完整示例源码

- [TooltipHoverDemo](../snapshot/apps/nexus/app/components/content/demos/TooltipHoverDemo.vue.txt)
- [TooltipButtonDemo](../snapshot/apps/nexus/app/components/content/demos/TooltipButtonDemo.vue.txt)
- [TooltipIndicatorDemo](../snapshot/apps/nexus/app/components/content/demos/TooltipIndicatorDemo.vue.txt)
- [TooltipClickOutsideCloseDemo](../snapshot/apps/nexus/app/components/content/demos/TooltipClickOutsideCloseDemo.vue.txt)
- [TooltipClickOutsideKeepDemo](../snapshot/apps/nexus/app/components/content/demos/TooltipClickOutsideKeepDemo.vue.txt)
- [ComponentsFeedbackTaskCenterDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsFeedbackTaskCenterDemo.vue.txt)

## 离线类型与实现参考

- [tooltip/index.ts](../snapshot/packages/tuffex/packages/components/src/tooltip/index.ts.txt)
- [src/TxTooltip.vue](../snapshot/packages/tuffex/packages/components/src/tooltip/src/TxTooltip.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/tooltip/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
