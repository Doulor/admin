# LayoutSkeleton 布局骨架

> 模拟完整应用布局的骨架占位

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/layout-skeleton) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/layout-skeleton.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/layout-skeleton.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 布局占位
尺寸由外层容器决定。
官方示例：`LayoutSkeletonLayoutPlaceholderDemo`（完整源码见本页末尾）

```vue
<template>
  <div style="height: 240px;">
    <TxLayoutSkeleton />
  </div>
</template>
```

### 面板占位
官方示例：`LayoutSkeletonPanelPlaceholderDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCard>
    <TxLayoutSkeleton />
  </TxCard>
</template>
```

### 最佳实践

- 给外层容器明确的高度；组件只填满 `width: 100%` 与 `height: 100%`。
- 用于最终形状稳定的页面、面板、侧栏摘要与详情栏。
- 最终界面没有顶栏或侧栏时，改用 `TxSkeleton`、`TxCardSkeleton` 或 `TxListItemSkeleton` 拼出真实结构。
- 不要用它占位表格行；表格主体用 `TxDataTable` 的 `loadingVariant="skeleton"`。

## API 参考

### 属性
```yaml
rows:
  - name: '—'
    type: '-'
    default: '-'
    description: '无额外 props，尺寸由容器决定'
```

## 概述

- 固定渲染 36px 顶栏、6 个侧栏项（首项为当前项）与 8 条内容行（首行为标题）。
- 侧栏宽 `clamp(72px, 30%, 200px)`，窄容器中按比例收缩，不挤压内容区。
- 文字条宽度取自固定序列，SSR、hydration 与视觉测试结果稳定。
- 根节点为 `aria-hidden="true"`；加载状态由宿主播报，例如区域上的 `aria-busy`。
- 减少动态效果时只停止闪烁，占位块保留。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/layout-skeleton/`。

## 离线完整示例源码

- [LayoutSkeletonLayoutPlaceholderDemo](../snapshot/apps/nexus/app/components/content/demos/LayoutSkeletonLayoutPlaceholderDemo.vue.txt)
- [LayoutSkeletonPanelPlaceholderDemo](../snapshot/apps/nexus/app/components/content/demos/LayoutSkeletonPanelPlaceholderDemo.vue.txt)

## 离线类型与实现参考

- [layout-skeleton/index.ts](../snapshot/packages/tuffex/packages/components/src/layout-skeleton/index.ts.txt)
- [src/TxLayoutSkeleton.vue](../snapshot/packages/tuffex/packages/components/src/layout-skeleton/src/TxLayoutSkeleton.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
