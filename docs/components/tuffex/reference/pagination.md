# Pagination 分页

> 在多页数据间切换的导航控件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/pagination) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/pagination.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/pagination.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

<script setup lang="ts">
import { ref } from 'vue'
const page = ref(1)
</script>

## 用法

### 基础
`total` 按 `pageSize` 计算页数；`show-info` 显示页码信息，`show-first-last` 增加首末页按钮。
官方示例：`PaginationPaginationDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPagination
    v-model:current-page="page"
    :total="120"
    show-info
    show-first-last
  />
</template>
```

### 每页条数
`page-sizes` 在页码后加入条数选择器；换条数不改动当前页，是否回到第 1 页由宿主决定。
官方示例：`PaginationPageSizeDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPagination
    v-model:current-page="page"
    v-model:page-size="pageSize"
    :page-sizes="[10, 20, 50]"
    page-size-label="每页条数"
    :total="230"
    show-info
    @page-size-change="page = 1"
  >
    <template #info="{ currentPage, totalPages }">
      共 230 条 · 第 {{ currentPage }} / {{ totalPages }} 页
    </template>
  </TxPagination>
</template>
```

### 数据运维面板
分页紧贴表格底部，与筛选、选择状态共享同一组响应式数据。
官方示例：`ComponentsDataOperationsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPagination
    v-model:current-page="page"
    :total="rows.length"
    :page-size="4"
    show-info
    show-first-last
  />
</template>
```

### 最佳实践

- 优先传 `total` 与 `pageSize`；后端只返回页数时才用 `totalPages`。
- `currentPage` 从 1 开始计数，初始化为 `1`。
- 筛选、搜索词或每页条数变化后，把 `currentPage` 重置为 `1`。
- 用 `pageSizes` 代替自建的条数选择框：它由可见标签命名，并与分页同排。
- 用 `info` 插槽输出本地化的范围文案，如「正在查看第 21–40 条，共 120 条」。

## API 参考

### 属性
```yaml
rows:
  - name: currentPage
    type: number
    default: '1'
    description: 当前页，从 1 开始计数
  - name: pageSize
    type: number
    default: '10'
    description: 每页条数；读者可修改时配合 v-model:page-size
  - name: pageSizes
    type: 'number[]'
    default: '[]'
    description: '可选条数，提供后渲染条数选择器；无效值丢弃，缺失的 pageSize 自动补入'
  - name: pageSizeLabel
    type: string
    default: "'Items per page'"
    description: 条数选择器前的可见标签，也为选择器命名
  - name: total
    type: number
    default: '-'
    description: 总条数；省略或为 0 时改用 totalPages
  - name: totalPages
    type: number
    default: '-'
    description: 显式总页数，未提供 total 时使用
  - name: prevIcon
    type: string
    default: "''"
    description: 上一页图标类，由 TxIcon 渲染；留空使用内置箭头
  - name: nextIcon
    type: string
    default: "''"
    description: 下一页图标类，由 TxIcon 渲染；留空使用内置箭头
  - name: showInfo
    type: boolean
    default: 'false'
    description: 显示页码与总量信息
  - name: showFirstLast
    type: boolean
    default: 'false'
    description: 显示首末页按钮
  - name: ariaLabel
    type: string
    default: "'Pagination'"
    description: 根节点 nav 地标的 aria-label
  - name: firstLabel
    type: string
    default: "'First page'"
    description: 首页按钮的 aria-label
  - name: prevLabel
    type: string
    default: "'Previous page'"
    description: 上一页按钮的 aria-label
  - name: nextLabel
    type: string
    default: "'Next page'"
    description: 下一页按钮的 aria-label
  - name: lastLabel
    type: string
    default: "'Last page'"
    description: 末页按钮的 aria-label
```

### 事件

```yaml
rows:
  - name: update:currentPage
    type: '(page: number) => void'
    default: '-'
    description: 当前页更新（v-model）
  - name: pageChange
    type: '(page: number) => void'
    default: '-'
    description: 用户切换页码时触发
  - name: update:pageSize
    type: '(size: number) => void'
    default: '-'
    description: 选择其他条数时更新（v-model），不改动当前页
  - name: pageSizeChange
    type: '(size: number) => void'
    default: '-'
    description: 选择其他条数时触发
```

### 插槽

```yaml
rows:
  - name: info
    type: '{ currentPage: number, totalPages: number, total?: number }'
    default: '-'
    description: 自定义页码信息区域
```

## 概述

- 页数由 `total` 与 `pageSize` 计算；`total` 省略或为 0 时使用 `totalPages`。
- `currentPage` 越界时，组件以最近的合法页派发 `update:currentPage`。
- 当前页按钮带 `aria-current="page"`；上一页、下一页与首末页按钮带可读的 `aria-label`，在边界页禁用。
- 只有提供有效的 `pageSizes` 时才渲染条数选择器，其 combobox 经 `aria-labelledby` 指向可见标签；否则 DOM 不变。
- 选择不同的条数时依次派发 `update:pageSize`、`pageSizeChange`，不改动当前页。
- 按需样式插件会一并加载选择器样式；手动引入样式时还需 `select/style.css` 及其依赖。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/pagination/`。

## 离线完整示例源码

- [PaginationPaginationDemo](../snapshot/apps/nexus/app/components/content/demos/PaginationPaginationDemo.vue.txt)
- [PaginationPageSizeDemo](../snapshot/apps/nexus/app/components/content/demos/PaginationPageSizeDemo.vue.txt)
- [ComponentsDataOperationsDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsDataOperationsDemo.vue.txt)

## 离线类型与实现参考

- [pagination/index.ts](../snapshot/packages/tuffex/packages/components/src/pagination/index.ts.txt)
- [src/TxPagination.vue](../snapshot/packages/tuffex/packages/components/src/pagination/src/TxPagination.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/pagination/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/pagination/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
