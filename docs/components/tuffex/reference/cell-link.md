# CellLink 单元格链接

> 表格单元格中由宿主决定如何打开的链接

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/cell-link) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/cell-link.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/cell-link.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`underline` 选择常驻或悬停下划线；点击只派发 `open`，不跳转。
官方示例：`CellLinkCellLinkDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
function onOpen({ href }) {
  // 组件不导航，宿主决定：网页开新标签，桌面端交给系统浏览器
  window.open(href, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <TxCellLink href="https://aurora-scoops.example" label="Aurora Scoops" muted @open="onOpen" />
  <TxCellLink href="https://kumo-creamery.example" label="kumo-creamery.example" underline="always" @open="onOpen" />
  <TxCellLink href="https://maple-orbit.example" label="maple-orbit.example" external @open="onOpen" />
</template>
```

### 最佳实践

- 文案是裸域名时补 `ariaLabel`，如「打开 Aurora Scoops 官网」。
- 记录名列用 `muted` 加 `underline="hover"`；专门的链接列用默认色加 `underline="always"`。
- 在 Electron 渲染进程中，把 `open` 交给宿主的外部浏览器通道，不在渲染进程内开窗。
- 没有链接的单元格渲染占位符（如 `—`），不渲染 `href` 为空的 `TxCellLink`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `href` | `string` | - | 目标地址，写入真实的 `href`。 |
| `label` | `string` | `href` | 显示文案；缺省时显示 `href`。 |
| `external` | `boolean` | `false` | 追加外链箭头。 |
| `muted` | `boolean` | `false` | 用次级墨色代替链接色，用于记录名列。 |
| `underline` | `'always' \| 'hover'` | `'hover'` | `hover` 仅悬停与聚焦时显示；`always` 常驻淡化下划线。 |
| `ariaLabel` | `string` | - | 可见文案说不清去向时的可访问名称。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | `({ href, event })` | 点击时触发；已调用 `preventDefault()`，由宿主导航。 |

### 插槽

| 名称 | 说明 |
|------|------|
| `default` | 替换链接文案。 |

## 概述

- 渲染原生 `<a href>`：复制链接、悬停预览、右键菜单照常可用；Enter 同样触发 `open`。
- 从不自行导航：在 Electron 渲染进程中，自行跳转会把应用窗口导航走。约定与 `TxSources` 一致。
- 外链箭头带 `aria-hidden`；去向信息写进 `ariaLabel`。
- 文案过长时以省略号截断，不撑破单元格。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/cell-link/`。
- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）；上游直接导航，此处改为派发 `open`。

## 离线完整示例源码

- [CellLinkCellLinkDemo](../snapshot/apps/nexus/app/components/content/demos/CellLinkCellLinkDemo.vue.txt)

## 离线类型与实现参考

- [cell-link/index.ts](../snapshot/packages/tuffex/packages/components/src/cell-link/index.ts.txt)
- [src/TxCellLink.vue](../snapshot/packages/tuffex/packages/components/src/cell-link/src/TxCellLink.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/cell-link/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
