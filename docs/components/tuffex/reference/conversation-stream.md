# Conversation Stream

> 虚拟滚动、自动吸底、向上加载历史的会话流

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/conversation-stream) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/conversation-stream.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/conversation-stream.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`ConversationStreamConversationStreamDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const items = ref([{ id: '1', text: '你好' }])

async function loadOlder() {
  const older = await fetchOlder()
  items.value = [...older, ...items.value]
  return { hasMore: older.length > 0 }
}
</script>

<template>
  <TxConversationStream
    :items="items"
    :item-key="item => item.id"
    :load-older="loadOlder"
    streaming
  >
    <template #item="{ item }">
      <div>{{ item.text }}</div>
    </template>
  </TxConversationStream>
</template>
```

### 最佳实践

- `itemKey` 用消息自身的 id，不用下标；虚拟化依赖稳定的 key。
- 在 `loadOlder` 中自行前插数据，再 resolve `{ hasMore }`；组件不持有消息数组。
- 确认没有历史时显式传 `hasMoreInitial: false`；默认的 `undefined` 表示未知。
- `estimatedItemHeight` 贴近真实平均高度，避免首屏滚动条跳动。
- 程序化滚动用暴露的 `scrollToBottom`、`scrollToIndex`，不要直接操作滚动容器。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `items` | `T[]` | — | 消息数组，必填。 |
| `itemKey` | `ConversationStreamItemKey<T>` | — | 稳定 key：字段名，或返回 key 的函数。必填。 |
| `estimatedItemHeight` | `number` | `96` | 未测量项的假定高度，测量后自动校正。 |
| `overscan` | `number` | `4` | 可视区上下各多渲染的条数。 |
| `loadOlder` | `() => Promise<ConversationStreamLoadResult>` | — | 接近顶部时调用；前插数据后 resolve `{ hasMore }`。 |
| `hasMoreInitial` | `boolean` | `undefined` | 首次 `loadOlder` 返回前是否可能有历史。 |
| `streaming` | `boolean` | `false` | 驱动「回到底部」按钮的新内容状态。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `at-bottom-change` | `(atBottom: boolean)` | 吸底状态变化时触发。 |
| `load-error` | `(error: unknown)` | `loadOlder` 抛错时触发。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `item` | `{ item: T, index: number }` | 渲染单条消息。 |
| `empty` | — | `items` 为空时的占位。 |
| `top-loading` | — | 加载更早消息时显示。 |
| `top-error` | `{ retry: () => void }` | 加载失败时显示，带重试回调。 |
| `top-done` | — | 没有更早消息时显示。 |
| `scroll-to-bottom` | `{ streaming: boolean }` | 替换「回到底部」按钮的内容。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `scrollToBottom` | `(behavior?: ScrollBehavior) => void` | 滚动到底部。 |
| `scrollToIndex` | `(index: number) => void` | 滚动到指定索引。 |
| `tweenToBottom` | `(duration?: number) => Promise<boolean>` | 以固定时长滑到底部；被打断时 resolve `false`。 |
| `atBottom` | `boolean` | 当前是否在底部，只读。 |

## 概述

- 泛型组件：`items` 的元素类型直接传到 `item` 插槽的作用域，无需断言。
- 停在底部时新内容自动跟随；用户向上滚动后不再拉回，改为显示「回到底部」按钮。
- `streaming` 只影响按钮的新内容状态，不决定是否吸底。
- 组件自己滑向底部时（发送后、程序化滚动），不显示「回到底部」按钮。
- 前插历史后保持视口锚点。
- `hasMoreInitial` 的默认值是显式的 `undefined` 而非 `false`，以区分「未知」与「没有历史」。

## 技术实现

- 可视窗口从位置缓存（按 key 记录测得高度的前缀和）取 `{ start, end }`；未跨过行边界的滚动帧沿用上一窗口，不重新调用 `item` 插槽。
- 源码：`packages/tuffex/packages/components/src/conversation-stream/`。

## 离线完整示例源码

- [ConversationStreamConversationStreamDemo](../snapshot/apps/nexus/app/components/content/demos/ConversationStreamConversationStreamDemo.vue.txt)

## 离线类型与实现参考

- [conversation-stream/index.ts](../snapshot/packages/tuffex/packages/components/src/conversation-stream/index.ts.txt)
- [src/TxConversationStream.vue](../snapshot/packages/tuffex/packages/components/src/conversation-stream/src/TxConversationStream.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/conversation-stream/src/types.ts.txt)
- [src/use-position-cache.ts](../snapshot/packages/tuffex/packages/components/src/conversation-stream/src/use-position-cache.ts.txt)
- [src/use-stick-to-bottom.ts](../snapshot/packages/tuffex/packages/components/src/conversation-stream/src/use-stick-to-bottom.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
