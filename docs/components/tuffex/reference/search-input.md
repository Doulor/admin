# SearchInput 搜索输入框

> 内置搜索图标、按 Enter 搜索的输入框

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/search-input) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/search-input.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/search-input.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
按 Enter 立即派发 `search`。
官方示例：`SearchInputSearchInputDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSearchInput v-model="value" placeholder="搜索" @search="onSearch" />
</template>
```

### 远程搜索
`remote` 在输入停止 `searchDebounce` 毫秒后派发 `search`；结果面板由宿主渲染。
官方示例：`SearchInputSearchInputRemoteDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref('')
const hits = ref<string[]>([])
const open = ref(false)

async function onSearch(query: string) {
  hits.value = await searchApi(query)
  open.value = true
}
</script>

<template>
  <TxPopover v-model="open" reference-full-width>
    <template #reference>
      <TxSearchInput
        v-model="value"
        remote
        :search-debounce="250"
        @focus="open = true"
        @search="onSearch"
      />
    </template>

    <button v-for="hit in hits" :key="hit" @click="value = hit">
      {{ hit }}
    </button>
  </TxPopover>
</template>
```

### 筛选工具栏
关键词交给 `TxSearchInput`，范围交给 `TxSearchSelect`，无结果时显示 `TxSearchEmpty`。
官方示例：`ComponentsSearchFiltersDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSearchInput
    v-model="query"
    remote
    :search-debounce="180"
    placeholder="搜索插件 / 文档 / 任务"
    @search="onSearch"
  />
  <TxSearchSelect v-model="scope" :options="scopeOptions" placeholder="筛选范围" />
  <TxSearchEmpty v-if="!filteredRecords.length" description="换一个关键词或筛选范围。" />
</template>
```

### 最佳实践

- 只需关键词与 Enter 时用 `TxSearchInput`；需要结果面板或回填选中值时用 `TxSearchSelect`。
- `remote` 下 Enter 与防抖可能派发同一查询，请求处理保持幂等。
- 不要只靠 placeholder 表达含义；密集工具栏中提供外部标签或上下文。
- 只有本地或已完整缓存的搜索才把 `searchDebounce` 设为 `0`。
- 需要自定义前缀或后缀时直接使用 `TuffInput`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `string` | `''` | 输入值，配合 `v-model` 使用。 |
| `placeholder` | `string` | `'Search'` | 占位文本。 |
| `disabled` | `boolean` | `false` | 禁止输入、清空与远程搜索。 |
| `clearable` | `boolean` | `true` | 有值时显示清空按钮。 |
| `remote` | `boolean` | `false` | 输入时按防抖派发 `search`。 |
| `searchDebounce` | `number` | `200` | 远程搜索的防抖时长（ms）。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(v: string)` | 输入值变化时触发。 |
| `input` | `(v: string)` | 与 `update:modelValue` 同时触发。 |
| `focus` | `(e: FocusEvent)` | 输入框获得焦点时触发。 |
| `blur` | `(e: FocusEvent)` | 输入框失去焦点时触发。 |
| `clear` | - | 清空按钮重置值后触发。 |
| `search` | `(v: string)` | 按 Enter 时立即触发；`remote` 下输入防抖结束后也触发。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `focus()` | `() => void` | 聚焦输入框。 |
| `blur()` | `() => void` | 使输入框失焦。 |
| `clear()` | `() => void` | 清空值并触发 `clear`。 |
| `setValue(v)` | `(v: string) => void` | 设置输入值。 |
| `getValue()` | `() => string` | 返回当前输入值。 |

## 概述

- 根节点是 `TuffInput` 的圆角外框，带 `tx-search-input` 类；`class`、`style` 落在外框，`aria-label`、`id` 等其余属性落在内部 `<input>`。
- 焦点只画在外框上：常规主题沿用 `TuffInput` 的边框与光环；高对比主题改为 `--tx-focus-ring-color` 描边加 `--tx-focus-ring-shadow`，内部 `<input>` 不再画矩形焦点框。
- 高对比描边只在内部输入框聚焦时出现；清空按钮聚焦时保留它自己的焦点环。

## 技术实现

- 包装 `TuffInput` 并内置前缀搜索图标；清空行为与暴露方法均转发自 `TuffInput`。
- 源码：`packages/tuffex/packages/components/src/search-input/`。

## 离线完整示例源码

- [SearchInputSearchInputDemo](../snapshot/apps/nexus/app/components/content/demos/SearchInputSearchInputDemo.vue.txt)
- [SearchInputSearchInputRemoteDemo](../snapshot/apps/nexus/app/components/content/demos/SearchInputSearchInputRemoteDemo.vue.txt)
- [ComponentsSearchFiltersDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsSearchFiltersDemo.vue.txt)

## 离线类型与实现参考

- [search-input/index.ts](../snapshot/packages/tuffex/packages/components/src/search-input/index.ts.txt)
- [src/TxSearchInput.vue](../snapshot/packages/tuffex/packages/components/src/search-input/src/TxSearchInput.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/search-input/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
