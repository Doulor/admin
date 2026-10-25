# VirtualList 虚拟列表

> 只渲染可见行的固定行高长列表

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/virtual-list) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/virtual-list.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/virtual-list.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`itemHeight` 固定行高，`height` 设定视口高度。
官方示例：`VirtualListVirtualListDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const items = Array.from({ length: 100 }, (_, index) => `项目 ${index + 1}`)
</script>

<template>
  <TxVirtualList :items="items" :item-height="36" height="240px">
    <template #item="{ item, index }">
      {{ index + 1 }}. {{ item }}
    </template>
  </TxVirtualList>
</template>
```

### 稳定的 key

```vue
<template>
  <TxVirtualList :items="users" :item-height="44" height="360px" item-key="id">
    <template #item="{ item }">
      <UserRow :user="item" />
    </template>
  </TxVirtualList>
</template>
```

### 命令式滚动

```vue
<script setup lang="ts">
const listRef = ref()

function jumpToLatest() {
  listRef.value?.scrollToBottom()
}
</script>

<template>
  <TxButton @click="jumpToLatest">最新</TxButton>
  <TxVirtualList ref="listRef" :items="logs" :item-height="32" :height="400" />
</template>
```

### 最佳实践

- 只用于固定行高；变高内容会让滚动计算失真。
- 对象列表用 `itemKey` 指向稳定 id；只有不可变数组才适合用索引作 key。
- `overscan` 保持适中：越大快速滚动越平滑，DOM 开销也越大。
- 行间距放进固定高度的行内，不要给行加垂直 margin。
- `scroll` 只用于统计或懒加载触发，不要做逐帧重计算。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `items` | `T[]` | `[]` | 完整数据集。 |
| `itemHeight` | `number` | 必填 | 固定行高（px），所有行必须一致。 |
| `height` | `number \| string` | `320` | 滚动容器高度；数字转为 px。 |
| `overscan` | `number` | `4` | 视口前后额外渲染的行数。 |
| `itemKey` | `keyof T \| (item: T, index: number) => string \| number` | `index` | 行 key：字段名或函数；字段缺失时回退为该项在 `items` 中的索引。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `scroll` | `{ scrollTop: number, startIndex: number, endIndex: number }` | 滚动并更新可见区间后触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `item` | `{ item: T, index: number }` | 渲染每个可见项；默认把 `item` 渲染为文本。 |

### 暴露方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `scrollToIndex` | `(index: number) => void` | 滚动到 `Math.max(0, index) * itemHeight`；不限制超出末项的索引。 |
| `scrollToTop` | `() => void` | 滚动到顶部。 |
| `scrollToBottom` | `() => void` | 滚动到 `max(0, totalHeight - viewHeight)`。 |

## 概述

- 每行固定为 `itemHeight` 像素高；数字 `height` 转为 px，字符串原样应用。
- 数字、px 与纯数字字符串高度立即参与计算；`%`、`vh`、`vw`、`rem`、`em` 等到挂载后读取 `clientHeight`，SSR 或隐藏容器应给出具体高度。
- 存在 `ResizeObserver` 时，容器尺寸变化会更新视口高度。
- 可见区间从 `floor(scrollTop / itemHeight) - overscan` 到视口末端再加 `overscan`，限制在 `0` 与 `items.length` 之间。
- 占位高度为 `items.length * itemHeight`，可见项按 `startIndex * itemHeight` 位移。
- 容器与行不带 `role` 或 `aria-*`。需要列表语义时由外层补 `role="list"` / `role="listitem"`，`aria-setsize` / `aria-posinset` 使用真实总数与绝对索引。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/virtual-list/`。

## 离线完整示例源码

- [VirtualListVirtualListDemo](../snapshot/apps/nexus/app/components/content/demos/VirtualListVirtualListDemo.vue.txt)

## 离线类型与实现参考

- [virtual-list/index.ts](../snapshot/packages/tuffex/packages/components/src/virtual-list/index.ts.txt)
- [src/TxVirtualList.vue](../snapshot/packages/tuffex/packages/components/src/virtual-list/src/TxVirtualList.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/virtual-list/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
