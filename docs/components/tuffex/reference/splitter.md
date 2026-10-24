# Splitter 分割面板

> 可拖拽调整比例的双面板布局

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/splitter) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/splitter.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/splitter.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
两个面板按 `v-model` 比例分配扣除分隔轨道后的空间；`direction="vertical"` 改为上下分割。
官方示例：`SplitterSplitterDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const ratio = ref(0.42)
const verticalRatio = ref(0.58)
</script>

<template>
  <div style="height: 220px;">
    <TxSplitter v-model="ratio" :min="0.25" :max="0.75" :snap="0.05">
      <template #a>导航区 ({{ ratio.toFixed(2) }})</template>
      <template #b>内容区</template>
    </TxSplitter>
  </div>
  <div style="height: 220px;">
    <TxSplitter v-model="verticalRatio" direction="vertical" :bar-size="12">
      <template #a>预览</template>
      <template #b>日志</template>
    </TxSplitter>
  </div>
</template>
```

### 最佳实践

- 放进有明确宽高的容器；没有边界盒子时，面板无法稳定调整。
- `min` 与 `max` 留足间距，避免面板收缩到内容不可读。
- 检查器、侧栏等需要稳定比例的布局用 `snap`，自由编辑的画布保持 `0`。
- 滚动容器放在面板插槽内，不要包在根节点外，以免与页面滚动冲突。
- 弹层交互或拖拽排序进行时禁用 splitter，避免争夺指针捕获。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `number` | `0.5` | A 面板比例；非有限值按 `0.5` 处理，渲染时收敛到 `0..1`。 |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | `horizontal` 左右分割，`vertical` 上下分割；非法值按 `horizontal`。 |
| `min` | `number` | `0.1` | 拖拽或键盘调整时派发的最小比例。 |
| `max` | `number` | `0.9` | 拖拽或键盘调整时派发的最大比例。 |
| `disabled` | `boolean` | `false` | 禁止调整；拖拽中禁用会结束拖拽。 |
| `barSize` | `number` | `6` | 分隔轨道尺寸（px），最小 6；可见手柄厚 2px。 |
| `snap` | `number` | `0` | 比例步进；`0` 不吸附。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `number` | 派发经过 clamp 与 snap 的新比例。 |
| `change` | `number` | 与 `update:modelValue` 同时触发。 |
| `drag-start` | `()` | 指针拖拽开始时触发。 |
| `drag-end` | `()` | 拖拽结束，或因禁用、卸载而取消时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `a` | - | 第一个面板：水平时在左，垂直时在上。 |
| `b` | - | 第二个面板：水平时在右，垂直时在下。 |

## 概述

- 指针拖拽按根节点包围盒换算：水平用 `clientX / width`，垂直用 `clientY / height`。
- 方向键（水平 ← / →，垂直 ↑ / ↓）每次调整 `0.02`，再执行 clamp 与 snap。
- 分隔条是带 `aria-label="Resize"` 的 `role="separator"`，`aria-orientation` 与分割方向垂直；`aria-valuenow` / `aria-valuemin` / `aria-valuemax` 为 `0..100` 的整数百分比。
- 禁用时分隔条 `tabindex="-1"`，忽略指针与键盘。
- 调用方需保证 `min <= max`。组件不持久化比例，需要记住时自行保存 `v-model`。

## 技术实现

- 根节点写入 `--tx-splitter-ratio` 与 `--tx-splitter-bar-size`，网格列由这两个变量计算。
- 源码：`packages/tuffex/packages/components/src/splitter/`。

## 离线完整示例源码

- [SplitterSplitterDemo](../snapshot/apps/nexus/app/components/content/demos/SplitterSplitterDemo.vue.txt)

## 离线类型与实现参考

- [splitter/index.ts](../snapshot/packages/tuffex/packages/components/src/splitter/index.ts.txt)
- [src/TxSplitter.vue](../snapshot/packages/tuffex/packages/components/src/splitter/src/TxSplitter.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/splitter/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
