# CardItem 卡片项

> 带头像、文本与右侧操作的紧凑列表行

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/card-item) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/card-item.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/card-item.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`right` 插槽放开关、箭头或元信息；未设置 `clickable` 时整行不派发点击。
官方示例：`CardItemCardItemDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const enabled = ref(true)
</script>

<template>
  <TxCardItem title="启用同步" description="右侧插槽可以组合控件。" icon-class="i-carbon-settings">
    <template #right>
      <TxSwitch v-model="enabled" />
      <i class="i-carbon-chevron-right" />
    </template>
  </TxCardItem>
</template>
```

### 最佳实践

- 只有整行执行操作时才设 `clickable`；只有右侧控件可交互时，整行保持不可点击。
- 可点击行不在语义化列表或菜单内时，传入 `role`（`button`、`menuitem` 或 `option`）。
- 简单媒体用 `avatarUrl`、`iconClass` 或 `avatarText`，复杂媒体用 `avatar` 插槽。
- `right` 插槽保持紧凑，过长的控件会挤压标题。
- 放在深色半透明面板上时，把 `--tx-card-item-hover-bg` 指向宿主的表面色，不要用 `:deep` 改组件规则。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `role` | `string` | `undefined` | 根节点的 ARIA role；组件不设默认值。 |
| `title` | `string` | `''` | 主标题，单行省略。 |
| `subtitle` | `string` | `''` | 标题下方的副标题，单行省略。 |
| `description` | `string` | `''` | 顶部行下方的描述，可换行。 |
| `iconClass` | `string` | `''` | 头像区的图标 class。 |
| `avatarText` | `string` | `''` | 头像区的文本。 |
| `avatarUrl` | `string` | `''` | 头像图片，优先于图标与文本。 |
| `avatarSize` | `number` | `36` | 头像尺寸（px）。 |
| `avatarShape` | `'circle' \| 'rounded'` | `'circle'` | 头像形状；`rounded` 为 12px 圆角。 |
| `clickable` | `boolean` | `false` | 启用指针样式、焦点，以及点击、Enter、Space 激活。 |
| `active` | `boolean` | `false` | 选中态。 |
| `disabled` | `boolean` | `false` | 禁止聚焦与激活，并设置 `aria-disabled`。 |
| `tabindex` | `number` | `undefined` | 覆盖自动 Tab 停靠（可点击时为 `0`）；列表框宿主传 `-1`。 |
| `align` | `'start' \| 'center'` | `'start'` | 各列的交叉轴对齐；单行列表行用 `center`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | `MouseEvent` | 可点击且未禁用时，点击、Enter 或 Space 触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `avatar` | - | 替换生成的头像。 |
| `title` | - | 替换主标题。 |
| `subtitle` | - | 替换副标题。 |
| `description` | - | 替换描述。 |
| `right` | - | 顶部行右侧的操作或元信息。 |

## 概述

- 没有 `avatar` 插槽、`avatarUrl`、`iconClass`、`avatarText` 时，省略左侧媒体列。
- 可点击且未禁用时根节点 `tabindex="0"`；组件不设隐式 `role`。
- 只响应行自身的 Enter / Space，右侧插槽内控件的按键不受影响。
- 悬停选中行时加深强调色，不换成中性悬停底色。
- 悬停与选中底色读 `--tx-card-item-hover-bg` / `--tx-card-item-active-bg`，默认为 `--tx-bg-color-overlay` 的 18% 与 `--tx-color-primary` 的 8%；边框色不可覆盖。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/card-item/`。

## 离线完整示例源码

- [CardItemCardItemDemo](../snapshot/apps/nexus/app/components/content/demos/CardItemCardItemDemo.vue.txt)

## 离线类型与实现参考

- [card-item/index.ts](../snapshot/packages/tuffex/packages/components/src/card-item/index.ts.txt)
- [src/TxCardItem.vue](../snapshot/packages/tuffex/packages/components/src/card-item/src/TxCardItem.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/card-item/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
