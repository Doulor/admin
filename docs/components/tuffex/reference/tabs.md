# Tabs 标签页

> 用可交互的标签在多个面板间切换

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tabs) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tabs.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tabs.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`TabsTabsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const active = ref('General')
</script>

<template>
  <TxTabs v-model="active">
    <TxTabItem name="General" icon-class="i-carbon-settings" activation>
      常规设置
    </TxTabItem>
    <TxTabItem name="Account" icon-class="i-carbon-user">
      账户设置
    </TxTabItem>
    <TxTabItem name="About" icon-class="i-carbon-information">
      关于
    </TxTabItem>
  </TxTabs>
</template>
```

### 指示器
`indicatorVariant` 决定画法，`indicatorMotion` 决定滑行方式。关闭 `showIndicator` 后，激活项自己绘制底色。
官方示例：`TabsIndicatorVariantsMotionsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabs
    v-model="active"
    placement="top"
    indicator-variant="pill"
    indicator-motion="stretch"
    :animation="{ content: { type: 'zoom', durationRatio: 0.5 } }"
  >
    <TxTabItem name="A" activation>Overview</TxTabItem>
    <TxTabItem name="B">Features</TxTabItem>
    <TxTabItem name="C">Pricing</TxTabItem>
  </TxTabs>
</template>
```

### 动态内容尺寸
面板内容增减时，`animation.size` 让 Tabs 的尺寸平滑跟随。
官方示例：`TabsDynamicContentManualDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabs
    v-model="active"
    placement="left"
    :content-scrollable="false"
    auto-width
    :animation="{ size: { enabled: true, durationMs: 260 } }"
  >
    <TxTabItem name="Overview" activation>…</TxTabItem>
    <TxTabItem name="Details">
      <div v-for="item in items" :key="item">{{ item }}</div>
    </TxTabItem>
  </TxTabs>
</template>
```

### 位置与头部
`placement` 支持四个方向。`TxTabHeader` 在面板上方渲染吸顶头部，`nav-right` 插槽放置导航栏末尾的操作。
官方示例：`TabsPlacementHeaderSlotDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabs v-model="active" placement="top">
    <TxTabHeader v-slot="{ props }">
      {{ props.node?.props?.name }}
    </TxTabHeader>

    <template #nav-right>
      <TxButton size="sm">操作</TxButton>
    </template>

    <TxTabItem name="A" activation>A</TxTabItem>
    <TxTabItem name="B">B</TxTabItem>
  </TxTabs>
</template>
```

### 高度跟随内容
官方示例：`TabsAutoSizeContentScrollableFalseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabs
    v-model="active"
    :content-scrollable="false"
    :animation="{ size: { enabled: true, durationMs: 260 } }"
  >
    <TxTabItem name="Long" activation>…</TxTabItem>
    <TxTabItem name="Short">…</TxTabItem>
  </TxTabs>
</template>
```

### 关闭动画
官方示例：`TabsDisableAnimationsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabs v-model="active" placement="bottom" :animation="{ indicator: false, content: false }">
    <TxTabItem name="One" activation>…</TxTabItem>
    <TxTabItem name="Two">…</TxTabItem>
  </TxTabs>
</template>
```

### 后台导航
Tabs 固定一级分区，轻操作放进 `TxDropdownMenu`，短说明放进 `TxPopover`，高密度配置放进 `TxDrawer`。
官方示例：`ComponentsNavigationShellDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabs
    v-model="active"
    placement="left"
    :nav-min-width="176"
    indicator-variant="pill"
    indicator-motion="glide"
    auto-height
  >
    <TxTabItem name="总览" icon-class="i-carbon-dashboard" activation>…</TxTabItem>
    <TxTabItem name="发布" icon-class="i-carbon-rocket">…</TxTabItem>
  </TxTabs>

  <TxDrawer v-model:visible="drawerVisible" title="发布策略">…</TxDrawer>
</template>
```

### 最佳实践

- `TxTabItem` 的 `name` 保持稳定且唯一，与 `modelValue` / `defaultValue` 一致。
- 设置页、后台页优先用 `placement="left"`；顶部、底部适合短的二级切换。
- 未激活的面板会卸载，需要保留的状态放在面板之外。
- 面板高度在加载后变化时，开启直接测量（`contentScrollable=false` 或 `autoHeight`），内容稳定后调用 `refresh()`。
- `nav-right` 保持紧凑，复杂操作放进下拉菜单或抽屉。

## API 参考

### TxTabs

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `string` | - | 激活的 tab 名称（受控）。 |
| `defaultValue` | `string` | - | 非受控的初始 tab；不匹配任何 tab 时不选中。 |
| `placement` | `'left' \| 'right' \| 'top' \| 'bottom'` | `'left'` | 导航位置。 |
| `offset` | `number` | `0` | `line` 指示器沿导航轴的偏移（px）。 |
| `navMinWidth` | `number` | `220` | 垂直布局时导航的最小宽度。 |
| `navMaxWidth` | `number` | `320` | 垂直布局时导航的最大宽度。 |
| `contentPadding` | `number` | `12` | 内容区内边距。 |
| `contentScrollable` | `boolean` | `true` | 内容区是否包一层滚动容器；尺寸动画开启时自动移除。 |
| `borderless` | `boolean` | `false` | 去掉外边框与背景。 |
| `autoHeight` | `boolean` | `false` | 开启高度动画。 |
| `autoWidth` | `boolean` | `false` | 开启宽度动画。 |
| `showIndicator` | `boolean` | `true` | 显示指示器；关闭后激活项自己绘制底色。 |
| `indicatorVariant` | `'line' \| 'pill' \| 'block' \| 'dot' \| 'outline'` | `'line'` | 指示器画法：细线、凸起面、浅染、圆点或内描边。 |
| `indicatorMotion` | `'stretch' \| 'warp' \| 'glide' \| 'snap' \| 'spring'` | `'stretch'` | 滑行方式：`stretch` 途中略拉长，`warp` 拉得更长，`glide` 整体平移，`snap` 最快停稳，`spring` 越过落点一次再回来。 |
| `indicatorMotionStrength` | `number` | `1` | 途中拉长的幅度；`0` 为整体平移。 |
| `animation` | `TabsAnimation` | - | 分别配置 `size`、`nav`、`indicator`、`content` 动画。 |
| `animation.size` | `boolean \| { enabled?; durationMs?; easing? }` | 由 `autoHeight` / `autoWidth` 推导 | 尺寸动画。 |
| `animation.nav` | `boolean \| { enabled?; durationMs?; easing? }` | 开启，`220ms ease` | 导航宽度过渡。 |
| `animation.indicator` | `boolean \| { enabled?; durationMs?; easing? }` | 开启，`350ms` | 指示器滑行；`durationMs` 整体缩放弹簧时长，`false` 时直接落位。 |
| `animation.content` | `boolean \| { enabled?; type?; durationMs?; durationRatio?; easing? }` | 开启 `zoom`，`180ms ease` | 面板入场；`type` 可选 `fade`、`slide`、`zoom`、`blur`、`scale`、`none`。 |
| `autoHeightDurationMs` | `number` | `250` | 尺寸动画的默认时长。 |
| `autoHeightEasing` | `string` | `ease` | 尺寸动画的默认缓动。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: string` | 激活的 tab 改变时触发。 |
| `change` | `value: string` | 用户激活 tab 后触发；父级修改 `modelValue` 不触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | `TxTabItem`、`TxTabItemGroup` 与 `TxTabHeader`；其他节点被忽略。 |
| `nav-right` | - | 导航栏末尾的操作区。 |

#### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `refresh` | `() => void` | 重新测量尺寸。 |
| `flip` | `(action: () => void \| Promise<void>) => Promise<void>` | 在 FLIP 过渡中执行一次变更。 |
| `action` | `(fn: (el: HTMLElement \| undefined) => void \| Promise<void>, optionsOrDetect?: any) => Promise<{ changedKeys: string[] } \| any>` | 透传内部 AutoSizer 的 `action`。 |
| `size` | `() => { width: number; height: number } \| undefined` | 最近一次测得的尺寸。 |

### TxTabItem

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `name` | `string` | *必填* | 唯一名称，同时是激活值。 |
| `iconClass` | `string` | `''` | 标签前的图标 class。 |
| `disabled` | `boolean` | `false` | 禁止激活。 |
| `activation` | `boolean` | `false` | 未指定 `modelValue` 与 `defaultValue` 时作为默认项。 |
| `active` | `boolean` | `false` | 是否激活；由 TxTabs 注入，独立使用时才手动传。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | - | 独立使用且未禁用时触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | 面板内容；未激活时不挂载。 |
| `icon` | - | 自定义图标，替代 `iconClass`。 |
| `name` | - | 自定义标签，默认显示 `name`。 |

### TxTabHeader

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `node` | `unknown` | - | 当前激活的 `TxTabItem` VNode，由 TxTabs 传入。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | `{ props: { node?: unknown } }` | 面板上方的吸顶头部。 |

### TxTabItemGroup

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `name` | `string` | - | 导航中的分组标题。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | 子级 `TxTabItem`。 |

## 概述

- 受控时以 `modelValue` 为准；未传时依次取 `defaultValue`、`activation`。
- 只识别直接子级 `TxTabItem`、`TxTabItemGroup`、`TxTabHeader`（支持 Fragment），自定义包装组件会被忽略。
- 未激活的面板不挂载。
- 指示器是唯一的选中高亮，切换时两端各沿一根弹簧滑到目标，从不缩放。
- 首次测量时指示器直接落位；尺寸变化、`animation.indicator: false` 与减少动态效果时也直接落位。
- 尺寸动画开启时移除内部滚动容器，以便直接测量面板。

## 技术实现

- 指示器由 `useJellyIndicator` 的滑行材质驱动，`requestAnimationFrame` 只在移动时运行，每帧直接写入样式，不触发重渲染。
- `TxTabItemGroup` 不渲染 DOM，分组由 TxTabs 读取其子级后生成。
- 源码：`packages/tuffex/packages/components/src/tabs/`。



## 自定义

| CSS 变量 | 用途 |
|----------------------------|----------|
| `--tx-border-color` | 外边框与导航分隔线。 |
| `--tx-bg-color` | 容器背景。 |
| `--tx-fill-color` / `--tx-fill-color-light` | 激活项底色（无指示器时）/ 悬停底色。 |
| `--tx-color-primary` | `line`、`dot`、`block`、`outline` 指示器与激活图标。 |
| `--tx-surface-raised` / `--tx-elevation-1` / `--tx-border-color-lighter` | `pill` 凸起面、投影与内描边。 |
| `--tx-text-color-primary` / `--tx-text-color-regular` / `--tx-text-color-secondary` | 激活文字、常态文字、图标与分组标题。 |
| `--tx-tab-item-ink` / `--tx-tab-item-icon-ink` | `.tx-tab-item` 的文字与图标颜色。 |
| `--tx-tabs-indicator-duration` / `--tx-tabs-indicator-easing` / `--tx-tabs-indicator-strength` | 由指示器 props 生成，仅供宿主读取。 |
| `--tx-tabs-content-duration` / `--tx-tabs-content-easing` | 由内容动画 props 生成。 |
| `--tx-tabs-nav-duration` / `--tx-tabs-nav-easing` | 由导航动画 props 生成。 |

## 离线完整示例源码

- [TabsTabsDemo](../snapshot/apps/nexus/app/components/content/demos/TabsTabsDemo.vue.txt)
- [TabsIndicatorVariantsMotionsDemo](../snapshot/apps/nexus/app/components/content/demos/TabsIndicatorVariantsMotionsDemo.vue.txt)
- [TabsDynamicContentManualDemo](../snapshot/apps/nexus/app/components/content/demos/TabsDynamicContentManualDemo.vue.txt)
- [TabsPlacementHeaderSlotDemo](../snapshot/apps/nexus/app/components/content/demos/TabsPlacementHeaderSlotDemo.vue.txt)
- [TabsAutoSizeContentScrollableFalseDemo](../snapshot/apps/nexus/app/components/content/demos/TabsAutoSizeContentScrollableFalseDemo.vue.txt)
- [TabsDisableAnimationsDemo](../snapshot/apps/nexus/app/components/content/demos/TabsDisableAnimationsDemo.vue.txt)
- [ComponentsNavigationShellDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsNavigationShellDemo.vue.txt)

## 离线类型与实现参考

- [tabs/index.ts](../snapshot/packages/tuffex/packages/components/src/tabs/index.ts.txt)
- [src/TxTabHeader.vue](../snapshot/packages/tuffex/packages/components/src/tabs/src/TxTabHeader.vue.txt)
- [src/TxTabItem.vue](../snapshot/packages/tuffex/packages/components/src/tabs/src/TxTabItem.vue.txt)
- [src/TxTabItemGroup.vue](../snapshot/packages/tuffex/packages/components/src/tabs/src/TxTabItemGroup.vue.txt)
- [src/TxTabs.vue](../snapshot/packages/tuffex/packages/components/src/tabs/src/TxTabs.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/tabs/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
