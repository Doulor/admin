# ContextCards 检索片段卡

> RAG 检索片段及其来源的卡片列表

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/context-cards) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/context-cards.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/context-cards.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
卡片依次浮现，来源胶囊稍后出现；节奏由 `staggerStep`、`chipDelay` 与 `chipStaggerStep` 控制。
官方示例：`ContextCardsContextCardsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxContextCards :chunks="chunks" :total="32" @open="openSource" />
</template>

<script setup lang="ts">
const chunks = [
  {
    id: 'c1',
    title: 'Vendor onboarding rule',
    chars: '290 characters',
    body: 'Cold-chain certification must be verified before a new dairy can be added.',
    source: { name: 'Dairy Onboarding SOP.pdf', badge: 'PDF', tone: 'red', href: 'https://example.com/sop.pdf' },
  },
]

function openSource({ chunk, source }) {
  // 组件不自行跳转，由宿主决定怎么打开
}
</script>
```

### 单块
`TxContextChunk` 单独渲染一张卡片，供宿主自行排版列表；单独使用时通常关闭 `appear`。

```vue
<TxContextChunk :chunk="chunk" :appear="false" @open="openSource" />
```

### 最佳实践

- `total` 传语料库规模，`chunks` 传本次命中的片段，让「32 条里选了 2 条」一眼可见。
- `chars` 在宿主侧格式化好再传，包括千分位；组件不做数字本地化。
- 长列表把 `appear` 设为 `false`：十几条以上的逐条浮现会显得拖沓。
- `tone` 按文件格式固定映射（PDF 红、CSV 绿），不要按卡片顺序轮换。

## API 参考

### TxContextCards

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `chunks` | `ContextChunk[]` | - | 片段列表。 |
| `title` | `string` | `'All chunks'` | 表头标题。 |
| `total` | `number \| string` | - | 表头计数，表示语料库总量而非 `chunks.length`；不传则不渲染。 |
| `appear` | `boolean` | `true` | 播放入场动画；频繁重渲染的列表应关闭。 |
| `staggerStep` | `number` | `100` | 卡片之间的入场间隔（ms）。 |
| `chipDelay` | `number` | `700` | 第一枚来源胶囊的起播延迟（ms）。 |
| `chipStaggerStep` | `number` | `80` | 来源胶囊之间的错峰（ms）。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | `ContextChunkOpenPayload` | 来源行被激活时触发；打开目标由宿主决定。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `header` | - | 替换整个表头。 |
| `chunk` | `{ chunk, index }` | 替换整张卡片。 |
| `chunk-title` / `chunk-body` / `chunk-source` | 同 `TxContextChunk` | 透传给 `TxContextChunk` 的 `title` / `body` / `source` 插槽。 |

### TxContextChunk

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `chunk` | `ContextChunk` | - | 单个片段。 |
| `appear` | `boolean` | `true` | 播放入场动画。 |
| `enterDelay` | `number` | `0` | 卡片浮现延迟（ms，绝对值）。 |
| `chipDelay` | `number` | `700` | 来源胶囊出现延迟（ms，绝对值）。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | `ContextChunkOpenPayload` | 来源行被激活时触发。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `title` | `{ chunk }` | 替换标题文本。 |
| `body` | `{ chunk }` | 替换正文。 |
| `source` | `{ chunk, source }` | 替换整行来源。 |

### 类型

| 名称 | 说明 |
|------|------|
| `ContextChunk` | `{ id, title, body?, chars?, source? }`；`chars` 是已格式化的字符串，如 `290 characters`。 |
| `ContextChunkSource` | `{ name, badge?, tone?, href? }`；`tone` 复用 `IconChipTone`。 |
| `ContextChunkOpenPayload` | `{ chunk, source }`。 |

## 概述

- 来源带 `href` 时渲染为 `<a>` 并保留 `href`，点击时 `preventDefault()` 再派发 `open`，与 `TxSources` 一致；没有 `href` 时是静态 `<span>`，没有悬停反馈。
- 挂载后才追加的片段不参与错峰，不会按索引空等。
- 减弱动效时延迟清零，来源胶囊立即可见。
- 入场只在元素创建时播放；重放需要重新挂载（换 `key`）。

## 技术实现

- 子件只以 `TxContextChunk` 导出，没有无前缀别名：`ContextChunk` 是数据类型的名字。
- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/context-cards/`。

## 离线完整示例源码

- [ContextCardsContextCardsDemo](../snapshot/apps/nexus/app/components/content/demos/ContextCardsContextCardsDemo.vue.txt)

## 离线类型与实现参考

- [context-cards/index.ts](../snapshot/packages/tuffex/packages/components/src/context-cards/index.ts.txt)
- [src/TxContextCards.vue](../snapshot/packages/tuffex/packages/components/src/context-cards/src/TxContextCards.vue.txt)
- [src/TxContextChunk.vue](../snapshot/packages/tuffex/packages/components/src/context-cards/src/TxContextChunk.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/context-cards/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
