# EdgeFadeMask 边缘渐隐遮罩

> 仅在有隐藏溢出时渐隐边缘的滚动容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/edge-fade-mask) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/edge-fade-mask.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/edge-fade-mask.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 纵向
默认纵向滚动；`size` 设置每侧渐隐距离。
官方示例：`EdgeFadeMaskVerticalDemo`（完整源码见本页末尾）

```vue
<template>
  <div class="frame">
    <TxEdgeFadeMask :size="32" style="height: 220px;">
      <!-- 长内容 -->
    </TxEdgeFadeMask>
  </div>
</template>
```

### 横向
`axis="horizontal"` 改为横向滚动与渐隐。
官方示例：`EdgeFadeMaskHorizontalDemo`（完整源码见本页末尾）

```vue
<template>
  <TxEdgeFadeMask axis="horizontal" :size="40">
    <div style="display: flex; gap: 12px; width: max-content;">
      <!-- 横向卡片 -->
    </div>
  </TxEdgeFadeMask>
</template>
```

### 最佳实践

- 边框、圆角、背景放在父级包装上，让 mask 只作用于滚动内容。
- 横向条带用 `width: max-content` 或固定项宽；没有溢出就不会出现渐隐。
- `threshold` 只用来吸收边界取整误差，保持较小。
- 打印或导出界面设置 `disabled`，CSS mask 在这些环境中表现不一。
- 不要把渐隐当作「还有内容」的唯一提示，配合滚动条、被裁切的项或文案。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `as` | `string` | `'div'` | 根元素标签。 |
| `axis` | `'vertical' \| 'horizontal'` | `'vertical'` | 滚动与渐隐方向。 |
| `size` | `string \| number` | `24` | 每侧渐隐距离；数字按 px，字符串原样使用。 |
| `threshold` | `number` | `1` | 判定到达滚动边界的像素容差；负值按 `0` 处理。 |
| `disabled` | `boolean` | `false` | 关闭遮罩。 |
| `observeResize` | `boolean` | `true` | 用 `ResizeObserver` 观察视口和首个子元素。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `default` | - | 内部视口中的滚动内容。 |

## 概述

- 根节点按 `as` 渲染，内含一个视口；视口沿 `axis` 方向 `overflow: auto`，另一方向隐藏溢出。
- 禁用、内容不可滚动或可滚动范围不超过 `threshold` 时，不输出 mask。
- 滚动时按 `scrollTop` / `scrollLeft` 分别开关前后两端的渐隐。
- `observeResize` 变化或组件卸载时断开 observer。
- 组件只添加中性的滚动视口，语义地标与标题放在插槽内容里。

## 技术实现

- 视口的 `mask-image` 是一条 `linear-gradient`（纵向 `to bottom`，横向 `to right`），已到边界的一端不渐隐。
- 源码：`packages/tuffex/packages/components/src/edge-fade-mask/`。

## 离线完整示例源码

- [EdgeFadeMaskVerticalDemo](../snapshot/apps/nexus/app/components/content/demos/EdgeFadeMaskVerticalDemo.vue.txt)
- [EdgeFadeMaskHorizontalDemo](../snapshot/apps/nexus/app/components/content/demos/EdgeFadeMaskHorizontalDemo.vue.txt)

## 离线类型与实现参考

- [edge-fade-mask/index.ts](../snapshot/packages/tuffex/packages/components/src/edge-fade-mask/index.ts.txt)
- [src/TxEdgeFadeMask.vue](../snapshot/packages/tuffex/packages/components/src/edge-fade-mask/src/TxEdgeFadeMask.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/edge-fade-mask/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
