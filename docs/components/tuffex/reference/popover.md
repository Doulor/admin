# Popover 弹出层

> 锚定在触发元素旁的轻量浮层

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/popover) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/popover.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/popover.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`PopoverPopoverDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPopover v-model="open">
    <template #reference>
      <TxButton>点击</TxButton>
    </template>

    弹出层内容
  </TxPopover>
</template>
```

### 触发与面板
`trigger` 决定点击或悬停打开，`panelBackground` 等 `panel*` 属性控制面板外观。
官方示例：`PopoverPopoverVisualEffectsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPopover
    v-model="open"
    :trigger="trigger"
    :placement="placement"
    :panel-background="background"
    :keep-alive-content="keepAliveContent"
    :width="284"
  >
    <template #reference>
      <TxButton>点我</TxButton>
    </template>

    <strong>Popover panel</strong>
    <TxButton size="sm">Action</TxButton>
  </TxPopover>
</template>
```

### 后台导航
Tabs 固定一级分区，轻操作放进 `TxDropdownMenu`，短说明放进 `TxPopover`，高密度配置放进 `TxDrawer`。
官方示例：`ComponentsNavigationShellDemo`（完整源码见本页末尾）

```vue
<template>
  <TxDropdownMenu>
    <template #trigger>
      <TxButton>发布操作</TxButton>
    </template>
    <TxDropdownItem>快速发布</TxDropdownItem>
  </TxDropdownMenu>

  <TxPopover>
    <template #reference>
      <TxButton variant="secondary">策略说明</TxButton>
    </template>
    浮层只放短说明和轻量动作。
  </TxPopover>

  <TxTabs v-model="active" placement="left" indicator-variant="pill">
    <TxTabItem name="总览" activation>总览配置</TxTabItem>
    <TxTabItem name="发布">发布配置</TxTabItem>
  </TxTabs>

  <TxDrawer v-model:visible="drawerVisible" title="发布策略" />
</template>
```

### 最佳实践

- 只放短说明、紧凑筛选和一两个轻量操作；超过一屏或需要多字段配置时改用 Drawer。
- reference 内含输入框或自管焦点时设 `toggleOnReferenceClick=false`，如 `TxSearchSelect`。
- 带本地状态的筛选器和小表单保留 `keepAliveContent`；纯静态说明可以关闭。
- 选项面板用 `maxHeight` 或内部滚动，不要让 Popover 盖住视口。
- 只在几个触发器挨得很近、需要指明归属时开启 `showArrow`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `boolean` | - | 是否打开（`v-model`）；省略时为非受控。 |
| `disabled` | `boolean` | `false` | 禁止打开，并关闭已打开的面板。 |
| `eager` | `boolean` | `false` | 首次打开前就挂载内容。 |
| `placement` | `PopoverPlacement` | `'bottom-start'` | 首选方向。 |
| `offset` | `number` | 自动计算 | 与 reference 的间距：无箭头为 `6`，有箭头为 `max(8, arrowSize / 2 + 2)`。 |
| `width` | `number` | `0` | 面板宽度；`0` 时与 reference 等宽。 |
| `minWidth` | `number` | `0` | 最小宽度。 |
| `maxWidth` | `number` | `360` | 最大宽度。 |
| `maxHeight` | `number` | `420` | 最大高度，超出后在面板内滚动。 |
| `unlimitedHeight` | `boolean` | `false` | 取消高度上限，供自管滚动的面板使用。 |
| `referenceFullWidth` | `boolean` | `false` | reference 容器占满宽度。 |
| `referenceClass` | `BaseAnchorClassValue` | - | reference 包装层的额外 class。 |
| `showArrow` | `boolean` | `false` | 显示箭头。 |
| `arrowSize` | `number` | `12` | 箭头尺寸（px）。 |
| `trigger` | `'click' \| 'hover' \| 'manual'` | `'click'` | 触发方式；`manual` 不绑定 reference 交互，开合由 `modelValue` 决定。 |
| `openDelay` | `number` | 见 `menu` 预设（`120`） | 悬停打开延迟（ms）；不传时由共享延迟服务提供。 |
| `closeDelay` | `number` | 见 `menu` 预设（`100`） | 悬停关闭延迟（ms）；不传时由共享延迟服务提供。 |
| `animation` | `BaseAnchorAnimationOptions` | `{ type: 'expand' }` | 透传给 BaseAnchor 的动画配置；各类型使用自己的默认时序。 |
| `virtualReference` | `BaseAnchorVirtualReference` | - | 按任意矩形（如指针位置、选区）定位，取代 reference。 |
| `matchReferenceWidth` | `boolean` | `width <= 0` | `width` 为 `0` 时与 reference 等宽；设为 `false` 则按内容定宽。 |
| `keepAliveContent` | `boolean` | `true` | 关闭后保留内容及其状态。 |
| `toggleOnReferenceClick` | `boolean` | `trigger === 'click'` | 点击 reference 时切换开合。 |
| `panelVariant` | `'solid' \| 'dashed' \| 'plain'` | `'solid'` | 面板边框形态。 |
| `panelBackground` | `'pure' \| 'mask' \| 'blur' \| 'glass' \| 'refraction' \| 'acrylic' \| 'mica' \| 'flat' \| 'plain'` | `'refraction'` | 面板背景。 |
| `panelShadow` | `'none' \| 'soft' \| 'medium'` | `'soft'` | 面板阴影。 |
| `panelRadius` | `number` | `18` | 面板圆角（px）。 |
| `panelPadding` | `number` | `10` | 面板内边距（px）。 |
| `panelCard` | `BaseAnchorPanelCardProps` | - | 透传给面板卡片的高级配置。 |
| `closeOnClickOutside` | `boolean` | `true` | 点击外部时关闭；`hover` 模式下不生效。 |
| `closeOnEsc` | `boolean` | `true` | 按 Esc 时关闭。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | - | 组件自身打开面板时触发。 |
| `close` | - | 组件自身关闭面板时触发。 |
| `update:modelValue` | `boolean` | 请求变更开合状态时触发，受控与非受控都会派发。 |

### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `reference` | - | 触发内容，渲染在 reference 包装层内。 |
| `default` | `{ side: string }` | 面板内容；`side` 为最终落位方向。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `updatePosition` | `() => void` | 重新计算定位；`virtualReference` 的矩形变化后调用。 |

## 概述

- 传 `modelValue` 时受控，否则内部维护开合。
- `trigger="click"` 时点击 reference 切换，点击外部或按 Esc 关闭；`hover` 时按延迟开合，不响应外部点击。
- 悬停去往面板的路上由悬停桥与安全三角兜住：穿过 `offset` 间隙、停在面板内边距上或斜向经过其他悬停触发器，面板都不会关闭或被抢走。

## 技术实现

- 基于 `TxTooltip`（`layer="menu"`）构建，延迟与同层互斥由共享的锚点延迟服务调度。
- 源码：`packages/tuffex/packages/components/src/popover/`。

## 离线完整示例源码

- [PopoverPopoverDemo](../snapshot/apps/nexus/app/components/content/demos/PopoverPopoverDemo.vue.txt)
- [PopoverPopoverVisualEffectsDemo](../snapshot/apps/nexus/app/components/content/demos/PopoverPopoverVisualEffectsDemo.vue.txt)
- [ComponentsNavigationShellDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsNavigationShellDemo.vue.txt)

## 离线类型与实现参考

- [popover/index.ts](../snapshot/packages/tuffex/packages/components/src/popover/index.ts.txt)
- [src/TxPopover.vue](../snapshot/packages/tuffex/packages/components/src/popover/src/TxPopover.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/popover/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
