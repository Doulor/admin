# Stagger 依次进入

> 按子节点顺序依次进入与离开的过渡组

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/stagger) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/stagger.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/stagger.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`StaggerStaggerDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const items = ref([
  { id: 'a', text: 'Alpha' },
  { id: 'b', text: 'Beta' },
  { id: 'c', text: 'Gamma' },
])
</script>

<template>
  <TxStagger tag="div" :delay-step="30" :duration="180">
    <div v-for="item in items" :key="item.id">{{ item.text }}</div>
  </TxStagger>
</template>
```

### 列表过渡

```vue
<template>
  <TxStagger tag="ul" name="tx-stagger" :delay-base="40" :delay-step="24">
    <li v-for="notification in notifications" :key="notification.id">
      {{ notification.title }}
    </li>
  </TxStagger>
</template>
```

### 自定义 transition name
自备的过渡 CSS 用 `--tx-stagger-index` 计算逐项延迟。

```vue
<template>
  <TxStagger name="fade-list" :duration="240" easing="linear">
    <article v-for="card in cards" :key="card.id">
      {{ card.title }}
    </article>
  </TxStagger>
</template>
```

```css
.fade-list-enter-active,
.fade-list-leave-active {
  transition: opacity 240ms linear;
  transition-delay: calc(var(--tx-stagger-index) * 24ms);
}
```

### 最佳实践

- 子节点始终提供稳定 key，否则依次过渡不可预测。
- 长列表保持较小的 `delayStep`，延迟过大时后面的项像卡住了。
- 语义列表用 `tag="ul"` 与 `li`，不要把 `div` 伪装成列表。
- 不要包裹虚拟列表的行，DOM 复用与依次过渡会互相干扰。
- 只有同时提供匹配的过渡 CSS 时才自定义 `name`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `tag` | `string` | `'div'` | 根标签。 |
| `appear` | `boolean` | `true` | 首次挂载时是否运行 appear 过渡。 |
| `name` | `string` | `'tx-stagger'` | 过渡 class 名前缀。 |
| `duration` | `number` | `180` | enter 与 leave 的过渡时长（ms）。 |
| `delayStep` | `number` | `24` | 每个子节点按 index 递增的延迟（ms）。 |
| `delayBase` | `number` | `0` | index 延迟之前的基础延迟（ms）。 |
| `easing` | `'ease' \| 'ease-in' \| 'ease-out' \| 'ease-in-out' \| 'linear'` | `'ease-out'` | 内置过渡的缓动函数。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 带 key 的子节点。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-stagger-index` | 子节点 index | 写在每个子节点上，用于计算延迟。 |
| `--tx-stagger-duration` | `duration` | 过渡时长。 |
| `--tx-stagger-delay-step` | `delayStep` | 每个子节点的延迟倍数。 |
| `--tx-stagger-delay-base` | `delayBase` | 基础延迟。 |
| `--tx-stagger-easing` | `easing` | 缓动函数。 |

## 概述

- 渲染带 `tx-stagger` class 的 Vue `TransitionGroup`，根标签取自 `tag`，不添加语义 role。
- 插槽子节点展开 Fragment（如 `v-for`）、去掉注释节点后按顺序编号；子节点原有的 inline style 保留。
- 内置过渡用 opacity 与 `translateY(6px)`，每项延迟为 `delayBase + index × delayStep`。
- `name` 与 `appear` 从首帧起传给 `TransitionGroup`，首次挂载的 appear 过渡照常运行。

## 技术实现

- 每个子节点经 `cloneVNode` 追加 `--tx-stagger-index`，时序属性以 CSS 变量写在根节点上。
- 源码：`packages/tuffex/packages/components/src/stagger/`。

## 离线完整示例源码

- [StaggerStaggerDemo](../snapshot/apps/nexus/app/components/content/demos/StaggerStaggerDemo.vue.txt)

## 离线类型与实现参考

- [stagger/index.ts](../snapshot/packages/tuffex/packages/components/src/stagger/index.ts.txt)
- [src/TxStagger.vue](../snapshot/packages/tuffex/packages/components/src/stagger/src/TxStagger.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/stagger/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
