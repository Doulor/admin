# GridLayout 网格布局

> 列数自动适配、带指针光斑的网格容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/grid-layout) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/grid-layout.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/grid-layout.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
子节点加 `.tx-grid-layout__item` 后获得卡片样式与跟随指针的光斑。
官方示例：`GridLayoutGridLayoutDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGridLayout>
    <div v-for="i in 6" :key="i" class="tx-grid-layout__item">
      Item {{ i }}
    </div>
  </TxGridLayout>
</template>
```

### 卡片网格

```vue
<template>
  <TxGridLayout min-item-width="240px" gap="16px" :max-columns="3">
    <article v-for="card in cards" :key="card.id" class="tx-grid-layout__item">
      <h3>{{ card.title }}</h3>
      <p>{{ card.description }}</p>
    </article>
  </TxGridLayout>
</template>
```

### 静态网格

```vue
<template>
  <TxGridLayout :interactive="false" min-item-width="180px" gap="12px">
    <div v-for="metric in metrics" :key="metric.name">
      {{ metric.name }}
    </div>
  </TxGridLayout>
</template>
```

### 最佳实践

- 重复的同级卡片用 `TxGridLayout`，一维对齐用 `TxFlex` 或 `TxStack`。
- 需要内置背景、圆角与光斑时才给子节点加 `.tx-grid-layout__item`。
- 大型、密集或虚拟化的网格关闭 `interactive`，避免每次指针移动都批量改写样式。
- `minItemWidth` 取卡片真实的最小可读宽度，不要拿来调间距。
- 不要把交互网格嵌套进其他高频指针交互区域。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `minItemWidth` | `string` | `'300px'` | auto-fit 列的最小宽度。 |
| `gap` | `string` | `'1.5rem'` | 网格间距。 |
| `maxColumns` | `number` | `4` | 视口 ≥ 1400px 时的固定列数。 |
| `interactive` | `boolean` | `true` | 指针移动时更新光斑变量；关闭后不改写子节点。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 网格项；加 `.tx-grid-layout__item` 获得内置样式与光斑。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-grid-gap` | `gap` | 网格间距。 |
| `--tx-grid-min-width` | `minItemWidth` | 最小列宽。 |
| `--tx-grid-max-columns` | `maxColumns` | 宽屏列数。 |
| `--tx-grid-op` | 指针状态 | 各项的光斑透明度。 |
| `--tx-grid-x` / `--tx-grid-y` | 指针状态 | 指针相对各项的位置。 |

## 概述

- 列模板默认为 `repeat(auto-fit, minmax(minItemWidth, 1fr))`，视口 ≥ 1400px 时为 `repeat(maxColumns, 1fr)`。
- 光斑只写入带 `.tx-grid-layout__item` 的后代，其他子节点不受影响。
- 指针离开或关闭 `interactive` 时，`--tx-grid-op` 归零。

## 技术实现

- 指针移动时逐个为 `.tx-grid-layout__item` 写入光斑变量，由其 `::before` 的径向渐变读取。
- 源码：`packages/tuffex/packages/components/src/grid-layout/`。

## 离线完整示例源码

- [GridLayoutGridLayoutDemo](../snapshot/apps/nexus/app/components/content/demos/GridLayoutGridLayoutDemo.vue.txt)

## 离线类型与实现参考

- [grid-layout/index.ts](../snapshot/packages/tuffex/packages/components/src/grid-layout/index.ts.txt)
- [src/TxGridLayout.vue](../snapshot/packages/tuffex/packages/components/src/grid-layout/src/TxGridLayout.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
