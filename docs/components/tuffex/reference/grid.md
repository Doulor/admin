# Grid 栅格

> 按行与列排布内容的网格容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/grid) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/grid.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/grid.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`GridGridDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGrid :cols="3" :gap="12">
    <TxGridItem v-for="i in 6" :key="i">{{ i }}</TxGridItem>
  </TxGrid>
</template>
```

### 响应式列数
`cols` 可按断点设置。
```vue
<template>
  <TxGrid :cols="{ xs: 1, sm: 2, md: 3, lg: 4, xl: 5 }" :gap="20">
    <TxGridItem v-for="i in 10" :key="i">
      <TxCard>项目 {{ i }}</TxCard>
    </TxGridItem>
  </TxGrid>
</template>
```

### 自适应列数
`minItemWidth` 按可用宽度自动排布列，优先于 `cols`。
```vue
<template>
  <TxGrid min-item-width="250px" :gap="24">
    <TxGridItem v-for="item in items" :key="item.id">
      <TxCard>{{ item.title }}</TxCard>
    </TxGridItem>
  </TxGrid>
</template>
```

### 间距
`gap` 接受数字（px）、`{ row, col }` 或按断点的对象。
```vue
<template>
  <TxGrid :cols="3" :gap="32">…</TxGrid>
  <TxGrid :cols="3" :gap="{ row: 24, col: 16 }">…</TxGrid>
  <TxGrid :cols="{ xs: 1, md: 2, lg: 3 }" :gap="{ xs: 16, md: 24, lg: 32 }">…</TxGrid>
</template>
```

### 跨列与跨行
```vue
<template>
  <TxGrid :cols="4" :gap="16">
    <TxGridItem>普通项目</TxGridItem>
    <TxGridItem :col-span="2">跨 2 列</TxGridItem>
    <TxGridItem>普通项目</TxGridItem>
    <TxGridItem :col-span="3">跨 3 列</TxGridItem>
  </TxGrid>

  <TxGrid :cols="3" :gap="16">
    <TxGridItem>项目 1</TxGridItem>
    <TxGridItem :row-span="2">跨 2 行</TxGridItem>
    <TxGridItem>项目 3</TxGridItem>
    <TxGridItem>项目 4</TxGridItem>
  </TxGrid>
</template>
```

### 对齐
`justify` / `align` 对齐全部项目，`justifySelf` / `alignSelf` 对齐单个项目。
```vue
<template>
  <TxGrid :cols="3" :gap="16" justify="center" align="center" style="height: 400px;">
    <TxGridItem v-for="i in 3" :key="i">项目 {{ i }}</TxGridItem>
  </TxGrid>

  <TxGrid :cols="3" :gap="16">
    <TxGridItem justify-self="start">左对齐</TxGridItem>
    <TxGridItem justify-self="center">居中对齐</TxGridItem>
    <TxGridItem justify-self="end">右对齐</TxGridItem>
  </TxGrid>
</template>
```

### 最佳实践

- 已知列数的后台网格用 `cols`，随容器排布的卡片集合用 `minItemWidth`；同一网格只选一种。
- 使用大跨度项目时，确认每个断点都有足够的列数。
- 间距优先用数字；需要 `rem`、`clamp()` 等单位时才传字符串。
- 不要用 Grid 代替语义表格或列表。

## API 参考

### TxGrid

#### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| cols | `number \| Responsive<number>` | `0` | 列数，可按断点设置；为 `0` 时不输出列模板。 |
| rows | `number` | `0` | 行数；为 `0` 时不输出行模板。 |
| gap | `GridGap` | `16` | 间距：数字（px）、`{ row, col }` 或按断点的对象。 |
| minItemWidth | `string` | - | 项目最小宽度，启用 `auto-fit` 自适应列。 |
| justify | `'start' \| 'end' \| 'center' \| 'stretch'` | `'stretch'` | 项目的水平对齐。 |
| align | `'start' \| 'end' \| 'center' \| 'stretch'` | `'stretch'` | 项目的垂直对齐。 |

#### 插槽

| 插槽名 | Props | 说明 |
|--------|-------|------|
| `default` | - | `TxGridItem` 子项。 |

### TxGridItem

#### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| colSpan | `number` | `1` | 跨列数，最小为 1。 |
| rowSpan | `number` | `1` | 跨行数，最小为 1。 |
| justifySelf | `'start' \| 'end' \| 'center' \| 'stretch'` | - | 自身的水平对齐。 |
| alignSelf | `'start' \| 'end' \| 'center' \| 'stretch'` | - | 自身的垂直对齐。 |

#### 插槽

| 插槽名 | Props | 说明 |
|--------|-------|------|
| `default` | - | 单元格内容。 |

### 类型

```ts
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type Responsive<T> = Partial<Record<Breakpoint, T>>

type GridAlign = 'start' | 'end' | 'center' | 'stretch'

type GridGap =
  | number
  | string
  | { row?: number | string, col?: number | string }
  | Responsive<number | string>
```

## 概述

- `minItemWidth` 优先于 `cols`，输出 `repeat(auto-fit, minmax(<minItemWidth>, 1fr))`。
- 响应式值按窗口宽度解析：`xs < 640 ≤ sm < 768 ≤ md < 1024 ≤ lg < 1280 ≤ xl`。当前断点未设置时先取更小断点，再取更大断点。
- 服务端渲染时按 1024px 解析，即 `lg`。

## 技术实现

- 网格样式由 props 计算后内联到根节点，断点随 `window` 的 `resize` 更新。
- 源码：`packages/tuffex/packages/components/src/grid/`。

## 离线完整示例源码

- [GridGridDemo](../snapshot/apps/nexus/app/components/content/demos/GridGridDemo.vue.txt)

## 离线类型与实现参考

- [grid/index.ts](../snapshot/packages/tuffex/packages/components/src/grid/index.ts.txt)
- [src/TxGrid.vue](../snapshot/packages/tuffex/packages/components/src/grid/src/TxGrid.vue.txt)
- [src/TxGridItem.vue](../snapshot/packages/tuffex/packages/components/src/grid/src/TxGridItem.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/grid/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
