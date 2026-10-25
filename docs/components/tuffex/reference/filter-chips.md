# FilterChips 筛选胶囊

> 带圆点与计数的单选筛选条

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/filter-chips) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/filter-chips.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/filter-chips.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`items` 为每个 chip 提供 `label`、`dot` 与 `count`。
官方示例：`FilterChipsFilterChipsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const rows = [
  { task: '补货芒果雪葩', status: 'todo' },
  { task: '搅拌黑芝麻', status: 'progress' },
  { task: '订购华夫蛋筒', status: 'done' },
]

const filter = ref('all')

const items = computed(() => [
  { value: 'all', label: '全部', count: rows.length },
  { value: 'todo', label: '待办', dot: '#f09a2f', count: rows.filter(r => r.status === 'todo').length },
  { value: 'progress', label: '进行中', dot: '#16a6c7', count: rows.filter(r => r.status === 'progress').length },
  { value: 'done', label: '已完成', dot: '#25a878', count: rows.filter(r => r.status === 'done').length },
])
</script>

<template>
  <TxFilterChips v-model="filter" :items="items" aria-label="任务状态筛选" />
</template>
```

### 与表格组合
筛选条只表达选中项；宿主过滤行数据，计数与表格共用同一份数据。
官方示例：`FilterChipsFilterTableDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

const filter = ref('all')

const visibleRows = computed(() =>
  filter.value === 'all' ? rows : rows.filter(row => row.status === filter.value),
)

const columns = [
  { key: 'task', title: '任务名称', minWidth: 180 },
  // 排序读时间戳字段，展示才做格式化
  { key: 'dueAt', title: '日期', width: 110, sortable: true, sorter: (a, b) => a.dueAt - b.dueAt },
  { key: 'status', title: '状态', width: 140 },
]
</script>

<template>
  <TxFilterChips v-model="filter" :items="items" />
  <TxDataTable :columns="columns" :data="visibleRows" row-key="task" />
</template>
```

### 最佳实践

- 计数用 `computed` 从行数据推导，不写死字面量。
- 过滤放在宿主：被筛掉的行从数据中移除，不要用 CSS 隐藏——隐藏的行仍在无障碍树与 Tab 序列里。
- 列表筛选保持默认的 `role="toolbar"`；只有存在成组的互斥面板时才用 `tablist`。
- chip 多于两三个时给每个配 `iconClass`；只有图标本身可辨认时才开 `iconOnly`。
- 只有宿主动效会整体重排 chip 时才关 `indicator`；减少动态效果由系统设置处理。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `string \| number` | - | 当前选中的 chip。 |
| `items` | `FilterChipItem[]` | `[]` | chip 列表。 |
| `disabled` | `boolean` | `false` | 禁用整条筛选条。 |
| `role` | `'toolbar' \| 'tablist'` | `'toolbar'` | 决定 chip 按开关还是标签页呈现。 |
| `indicator` | `boolean` | `true` | 选中底色作为一个滑块在 chip 间平移；关闭后逐 chip 上色。 |
| `iconOnly` | `boolean` | `false` | 只画 `iconClass`，`label` 转为 `aria-label` 与 `title`；无图标的 chip 仍显示文字。 |
| `ariaLabel` | `string` | `'Filters'` | 筛选条的可访问名称。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value)` | 选中变化。 |
| `change` | `(value)` | 与 `update:modelValue` 同时触发。 |

### 插槽

| 名称 | 说明 |
|------|------|
| `chip` | 替换 chip 内部内容；接收 `{ item, active }`，按钮外壳与键盘行为保留。 |

### FilterChipItem

| 字段 | 类型 | 说明 |
|------|------|------|
| `value` | `string \| number` | chip 唯一标识。 |
| `label` | `string` | chip 文案。 |
| `iconClass` | `string` | 前置图标 class，画在圆点与文案之前。 |
| `dot` | `string` | 前置圆点颜色。 |
| `count` | `number` | 尾部计数徽标，应从数据推导。 |
| `disabled` | `boolean` | 单独禁用该 chip。 |

## 概述

- 整条只占一个 Tab 停靠点：焦点落在选中的 chip（无选中时为第一个可用 chip）；方向键绕回并跳过禁用项，`Home` / `End` 直达首尾。
- `toolbar` 下 chip 是 `aria-pressed` 开关，移动焦点不改变筛选。
- `tablist` 下 chip 为 `role="tab"` 加 `aria-selected`，选中跟随焦点；宿主需渲染对应的 `role="tabpanel"`。
- 点击已选中的 chip 不触发事件。
- 首帧、chip 列表重建、尺寸变化及减少动态效果时，滑块直接落位；无选中项时不绘制。

## 技术实现

- 滑块是滚动行的绝对定位子元素，按 chip 的 `offsetLeft` / `offsetTop` 定位，因此随 chip 一起滚动。
- 源码：`packages/tuffex/packages/components/src/filter-chips/`。
- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）；上游只有 `aria-pressed`，此处补上键盘导航与 `tablist` 语义。

## 离线完整示例源码

- [FilterChipsFilterChipsDemo](../snapshot/apps/nexus/app/components/content/demos/FilterChipsFilterChipsDemo.vue.txt)
- [FilterChipsFilterTableDemo](../snapshot/apps/nexus/app/components/content/demos/FilterChipsFilterTableDemo.vue.txt)

## 离线类型与实现参考

- [filter-chips/index.ts](../snapshot/packages/tuffex/packages/components/src/filter-chips/index.ts.txt)
- [src/TxFilterChips.vue](../snapshot/packages/tuffex/packages/components/src/filter-chips/src/TxFilterChips.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/filter-chips/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
