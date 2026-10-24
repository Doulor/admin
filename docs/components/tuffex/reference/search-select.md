# SearchSelect 搜索选择器

> 输入即搜索、点选即回填的选择器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/search-select) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/search-select.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/search-select.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
本地模式按 `label` 过滤 `options`，输入为空时显示全部。
官方示例：`SearchSelectSearchSelectDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref<string | number>('')

const options = [
  { value: 'foo', label: 'Foo' },
  { value: 'bar', label: 'Bar' },
  { value: 'baz', label: 'Baz' },
  { value: 'disabled', label: 'Disabled', disabled: true },
]
</script>

<template>
  <TxSearchSelect v-model="value" :options="options" placeholder="Search and pick" />
</template>
```

### 远程搜索
`remote` 关闭本地过滤，输入防抖结束或按 Enter 时派发 `search`；在回调中写回 `options`。
官方示例：`SearchSelectSearchSelectRemoteDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref<string | number>('')
const options = ref<Array<{ value: string, label: string }>>([])
const loading = ref(false)

async function onSearch(query: string) {
  loading.value = true
  options.value = await searchApi(query)
  loading.value = false
}
</script>

<template>
  <TxSearchSelect
    v-model="value"
    remote
    :loading="loading"
    :options="options"
    @search="onSearch"
  />
</template>
```

### 筛选工具栏
`TxSearchSelect` 承载范围、类型、状态等结构化筛选；关键词交给 `TxSearchInput`，无结果时显示 `TxSearchEmpty`。
官方示例：`ComponentsSearchFiltersDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSearchInput v-model="query" placeholder="搜索插件 / 文档 / 任务" remote />
  <TxSearchSelect
    v-model="scope"
    :options="scopeOptions"
    placeholder="筛选范围"
  />
  <TxSearchEmpty v-if="!filteredRecords.length" surface="card" />
</template>
```

### 最佳实践

- 本地模式只放小型 `options`；大型数据源用 `remote`，由外部写回结果。
- `label` 保持稳定、可读，本地过滤只匹配它。
- 只从受控选项中取值；自由关键词搜索用 `TxSearchInput`。
- 禁用项只作说明性条目，不要让它成为唯一结果。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `string \| number` | `''` | 选中值，配合 `v-model` 使用。 |
| `placeholder` | `string` | `'Search'` | 输入框的占位文本。 |
| `disabled` | `boolean` | `false` | 禁用输入、面板与聚焦展开，不派发远程 `search`。 |
| `clearable` | `boolean` | `true` | 显示清空按钮，可清空选中值。 |
| `options` | `TxSearchSelectOption[]` | `[]` | 候选项；禁用项不可选。 |
| `loading` | `boolean` | `false` | 在输入框后缀显示加载指示器。 |
| `remote` | `boolean` | `false` | 关闭本地过滤，改为派发 `search`。 |
| `searchDebounce` | `number` | `200` | 远程 `search` 的防抖时长（ms）。 |
| `dropdownMaxHeight` | `number` | `280` | 面板最大高度（px），超出后内部滚动。 |
| `dropdownOffset` | `number` | `6` | 面板与输入框的间距。 |
| `panelVariant` | `'solid' \| 'dashed' \| 'plain'` | `'solid'` | 面板边框形态，同 TxCard `variant`。 |
| `panelBackground` | `'pure' \| 'mask' \| 'blur' \| 'glass' \| 'refraction' \| 'acrylic' \| 'mica' \| 'flat' \| 'plain'` | `'refraction'` | 面板背景，同 TxCard `background`。 |
| `panelShadow` | `'none' \| 'soft' \| 'medium'` | `'soft'` | 面板阴影，同 TxCard `shadow`。 |
| `panelRadius` | `number` | `18` | 面板圆角，同 TxCard `radius`。 |
| `panelPadding` | `number` | `6` | 面板内边距，同 TxCard `padding`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(v: string \| number)` | 选中启用项或清空后触发。 |
| `change` | `(v: string \| number)` | 与 `update:modelValue` 同时触发。 |
| `search` | `(q: string)` | 远程模式下输入防抖结束或按 Enter 时触发。 |
| `select` | `(opt: TxSearchSelectOption)` | 选中启用项后、面板关闭前触发。 |
| `open` | - | 面板打开时触发。 |
| `close` | - | 面板关闭时触发，并取消待发的远程 `search`。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `open()` | `() => void` | 未禁用时打开面板。 |
| `close()` | `() => void` | 关闭面板。 |
| `focus()` | `() => void` | 聚焦内部 `TxInput`。 |
| `blur()` | `() => void` | 使内部 `TxInput` 失焦。 |
| `clear()` | `() => void` | 清空输入与选中值。 |

### 类型

```ts
export interface TxSearchSelectOption {
  value: string | number
  label: string
  disabled?: boolean
}
```

## 概述

- 远程模式原样显示 `options`，不缓存结果。
- 清空时以 `''` 派发 `update:modelValue` 与 `change`。
- 面板关闭后保留输入内容，重新打开不会重置。
- 键盘：ArrowDown / ArrowUp 打开面板并在启用项间循环高亮；Enter 选中高亮项，无高亮时派发远程 `search`；Escape 关闭面板。

## 技术实现

- 面板由 `TxPopover` 承载；不开放插槽，前缀、加载后缀、空态与选项行均由内部渲染，以保持键盘与弹层行为一致。
- 源码：`packages/tuffex/packages/components/src/search-select/`。

## 离线完整示例源码

- [SearchSelectSearchSelectDemo](../snapshot/apps/nexus/app/components/content/demos/SearchSelectSearchSelectDemo.vue.txt)
- [SearchSelectSearchSelectRemoteDemo](../snapshot/apps/nexus/app/components/content/demos/SearchSelectSearchSelectRemoteDemo.vue.txt)
- [ComponentsSearchFiltersDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsSearchFiltersDemo.vue.txt)

## 离线类型与实现参考

- [search-select/index.ts](../snapshot/packages/tuffex/packages/components/src/search-select/index.ts.txt)
- [src/TxSearchSelect.vue](../snapshot/packages/tuffex/packages/components/src/search-select/src/TxSearchSelect.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/search-select/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
