# TabBar 底部导航

> 移动端底部的主导航栏

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tab-bar) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tab-bar.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tab-bar.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`TabBarTabBarDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref('home')
const items = [
  { value: 'home', label: '首页', iconClass: 'i-carbon-home' },
  { value: 'search', label: '搜索', iconClass: 'i-carbon-search', badge: 3 },
  { value: 'profile', label: '我的', iconClass: 'i-carbon-user' },
]
</script>

<template>
  <TxTabBar v-model="value" :items="items" :fixed="false" />
</template>
```

### 指示器与尺寸
`indicator` 决定当前项背后滑块的画法，`size` 在 `sm`、`md`、`lg` 三档间切换。
官方示例：`TabBarIndicatorDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTabBar v-model="active" :items="items" :fixed="false" indicator="line" size="sm" />
</template>
```

### 最佳实践

- 主入口保持 3–5 个，适合拇指操作。
- `value` 用稳定的原始值，便于映射到路由或视图 key。
- 嵌入预览框、弹层或自定义外壳时关闭 `fixed` 与 `safeAreaBottom`，否则会固定到真实视口底部。
- `badge` 保持简短，用数字或紧凑的状态文本。
- 不要在文案里嵌套交互控件；每一项本身就是按钮。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `string \| number` | `''` | 当前选中值（`v-model`）。 |
| `items` | `TabBarItem[]` | `[]` | 从左到右渲染的各项。 |
| `indicator` | `'none' \| 'pill' \| 'line' \| 'block' \| 'dot'` | `'pill'` | 滑动指示器：仅颜色、凸起面、顶边细线、色块或圆点。 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 尺寸档位；高度、图标、文字与内缩以行内 CSS 变量下发。 |
| `fixed` | `boolean` | `true` | 以 `position: fixed` 固定到视口底部。 |
| `safeAreaBottom` | `boolean` | `true` | 在各项下方渲染 `env(safe-area-inset-bottom)` 安全区占位。 |
| `disabled` | `boolean` | `false` | 禁用所有项，不更新值。 |
| `zIndex` | `number` | `2000` | 层级，写入 `--tx-tab-bar-z-index`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `TabBarValue` | 选中项的值（`v-model`）。 |
| `change` | `TabBarValue` | 选中未禁用的项后派发同一个值。 |

### 类型

`TabBarItem`，`items` 中的一项：

| 字段 | 类型 | 说明 |
|------|------|------|
| `value` | `string \| number` | 选中时派发的值。 |
| `label` | `string` | 文案。 |
| `iconClass` | `string` | 文案上方的图标 class。 |
| `badge` | `string \| number` | 图标区徽标；`null`、`undefined` 与空字符串不显示。 |
| `disabled` | `boolean` | 只禁用该项。 |

## 概述

- 根节点是 `<nav>` 地标而非 tab 组件，因此没有 `role="tablist"`；每项是 `<button>`，当前项带 `aria-current="page"`。
- 指示器经 `useIndicatorBox` 测量（与 `TxSidebarNav` 相同），尺寸变化或字体替换后由 `ResizeObserver` 重新测量。
- 只有新的选中项会滑行；首次测量、尺寸变化、字体替换以及切换 `size` 或 `indicator` 都直接落位，减少动态效果时也直接落位。
- 指示器从不缩放，途中只沿 bar 方向拉长；到两端时停在边缘，外框带 `overflow: hidden` 也不会被裁切。
- 点击禁用项、或在 `disabled` 时点击任意项，不派发事件；点击当前项仍会派发 `update:modelValue` 与 `change`。
- `size` 的每个值都是可单独覆写的 CSS 变量（如 `--tx-tab-bar-height`）；无法识别的值回退到 `md`。

## 技术实现

- 指示器由 `useJellyIndicator` 的滑行材质驱动（与 `TxTabs`、`TxFlatRadio`、`TxSidebarNav` 相同），每帧直接写样式，不触发重渲染。
- 源码：`packages/tuffex/packages/components/src/tab-bar/`。

## 离线完整示例源码

- [TabBarTabBarDemo](../snapshot/apps/nexus/app/components/content/demos/TabBarTabBarDemo.vue.txt)
- [TabBarIndicatorDemo](../snapshot/apps/nexus/app/components/content/demos/TabBarIndicatorDemo.vue.txt)

## 离线类型与实现参考

- [tab-bar/index.ts](../snapshot/packages/tuffex/packages/components/src/tab-bar/index.ts.txt)
- [src/TxTabBar.vue](../snapshot/packages/tuffex/packages/components/src/tab-bar/src/TxTabBar.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/tab-bar/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
