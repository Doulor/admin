# Breadcrumb 面包屑

> 显示当前页在层级中位置的导航路径

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/breadcrumb) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/breadcrumb.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/breadcrumb.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 链接与手动条目
带 `href` 的条目渲染为原生链接；其余可交互条目渲染为按钮并派发 `click`。
官方示例：`BreadcrumbBreadcrumbTrailDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const items = [
  { label: '首页', href: '/', icon: 'i-carbon-home' },
  { label: '资料库' },
  { label: '数据' },
]

function onBreadcrumbClick(item: { label: string }, index: number) {
  console.log(item.label, index)
}
</script>

<template>
  <TxBreadcrumb :items="items" @click="onBreadcrumbClick" />
</template>
```

### 分隔图标

```vue
<template>
  <TxBreadcrumb :items="items" separator-icon="i-carbon-caret-right" />
</template>
```

### 最佳实践

- `items` 从最上层父级排到当前页。
- 真实路由用 `href`，保留原生链接的右键菜单与复制链接。
- 无 `href` 的条目只用于需要自定义行为的虚拟层级；`href` 链接不派发 `click`。
- 标签保持简短，只描述层级，不重复完整页面标题。
- 不要禁用当前项；最后一项本身不可交互。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `items` | `BreadcrumbItem[]` | 必填 | 有序条目，最后一项为当前页。 |
| `separatorIcon` | `string` | `'i-carbon-chevron-right'` | 条目之间的分隔图标。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | `(item: BreadcrumbItem, index: number)` | 点击未禁用、无 `href` 的非当前条目时触发。 |

### 类型

`BreadcrumbItem`，`items` 中的一项：

| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 显示文本。 |
| `href` | `string` | 原生链接目标；当前项与禁用项忽略。 |
| `icon` | `string` | 文本前的 `TxIcon` 名称。 |
| `disabled` | `boolean` | 禁止交互，并标记 `aria-disabled`。 |

## 概述

- 根节点是 `<nav aria-label="Breadcrumb">`，内含有序列表。
- 最后一项渲染为 `<span aria-current="page">`，即使带 `href` 也不可交互。
- 其余未禁用的条目：带 `href` 渲染为 `<a>`，走原生导航；无 `href` 渲染为 `<button>`。
- 禁用项渲染为 `<span aria-disabled="true">`，不派发事件。
- 分隔符只出现在条目之间，带 `aria-hidden`。
- 图标名使用 `i-` 前缀的图标类，如 `i-carbon-home`。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/breadcrumb/`。

## 离线完整示例源码

- [BreadcrumbBreadcrumbTrailDemo](../snapshot/apps/nexus/app/components/content/demos/BreadcrumbBreadcrumbTrailDemo.vue.txt)

## 离线类型与实现参考

- [breadcrumb/index.ts](../snapshot/packages/tuffex/packages/components/src/breadcrumb/index.ts.txt)
- [src/TxBreadcrumb.vue](../snapshot/packages/tuffex/packages/components/src/breadcrumb/src/TxBreadcrumb.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/breadcrumb/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/breadcrumb/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
