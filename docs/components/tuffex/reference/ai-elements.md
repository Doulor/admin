# AI Elements

> 用于 AI 对话界面的会话与消息基础组件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/ai-elements) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/ai-elements.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/ai-elements.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`showAvatar` 显示头像列；没有 `avatar` 时显示名称首字母。
官方示例：`AiElementsAiConversationDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import type { AiElementMessage } from '@talex-touch/tuffex/ai-elements'

const messages: AiElementMessage[] = [
  { id: 'u1', role: 'user', content: '帮我总结这次发布审阅结果。', name: '你' },
  { id: 'a1', role: 'assistant', content: '已完成 **组件文档** 审阅。', name: 'Tuff AI' },
  { id: 't1', role: 'tool', content: '', name: 'Verifier', status: 'streaming' },
]
</script>

<template>
  <TxAiConversation :messages="messages" show-avatar />
</template>
```

### 最佳实践

- 在宿主维护 provider 的流式状态，再映射到 `status`。
- `id` 用对话存储中的稳定 id，不用数组下标。
- 助手输出保持 `markdown` 开启；不可信的 Markdown 在数据边界清洗。
- 推理、工具调用、附件与来源用 `parts` 描述，不要往 `content` 里塞 HTML。

## API 参考

### TxAiConversation

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `messages` | `AiElementMessage[]` | 必填 | 对话数据，按顺序渲染。 |
| `markdown` | `boolean` | `true` | 用 `TxMarkdownView` 渲染正文。 |
| `compact` | `boolean` | `false` | 收紧消息间距。 |
| `emptyText` | `string` | `'No messages yet'` | 没有可渲染消息时的空状态文案。 |
| `showAvatar` | `boolean` | `false` | 为每条消息显示头像列。 |
| `typingLabel` | `string` | - | 转发给每条消息：输入中指示器的可访问名称。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open-source` | `(source: AiSourceItem)` | 转发自被点击来源所在的消息。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `empty` | - | 替换内置空状态。 |
| `default` / `avatar` / `markdown-renderer` / `tool-result` | 同 `TxAiMessage` | 转发给每条 `TxAiMessage`。 |

### TxAiMessage

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `message` | `AiElementMessage` | 必填 | 单条消息。 |
| `markdown` | `boolean` | `true` | 用 `TxMarkdownView` 渲染正文；`false` 时按纯文本保留换行。 |
| `compact` | `boolean` | `false` | 紧凑行距与更小的头像。 |
| `showAvatar` | `boolean` | `false` | 显示头像。 |
| `typingLabel` | `string` | `'AI is typing'` | 输入中指示器的可访问名称。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open-source` | `(source: AiSourceItem)` | 点击 `sources` 片段中的来源时触发，默认跳转已阻止。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | `{ message }` | 替换正文区域，用于工具卡片、附件或自定义渲染。 |
| `avatar` | `{ message }` | `showAvatar` 开启时替换头像。 |
| `markdown-renderer` | `{ part, message, streaming }` | 替换 `text` 片段的渲染；只有流式消息的最后一个文本片段 `streaming` 为真。 |
| `tool-result` | `{ part }` | 替换 `tool-call` 片段在 `done` 后的结果区。 |

### 类型

#### AiElementMessage

| 字段 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `id` | `string` | 必填 | 稳定 key。 |
| `role` | `'user' \| 'assistant' \| 'system' \| 'tool'` | 必填 | 视觉与语义角色。 |
| `content` | `string` | 必填 | 文本或 Markdown 源。 |
| `createdAt` | `number \| string \| Date` | - | 宿主的时间戳。 |
| `name` | `string` | - | 显示名称；缺省为 You / AI / Tool / System。 |
| `avatar` | `string` | - | 头像图片 URL。 |
| `status` | `'pending' \| 'streaming' \| 'complete' \| 'error'` | - | 消息生命周期状态。 |
| `parts` | `AiMessagePart[]` | - | 非空时按顺序渲染这些片段，取代 `content`。 |

#### AiMessagePart

```ts
type AiMessagePart =
  | { type: 'text', text: string } // markdown-renderer 插槽或 TxMarkdownView
  | { type: 'reasoning', text: string, done?: boolean, durationMs?: number } // TxReasoningDisclosure
  | AiToolCallPart // type: 'tool-call'，由 TxToolCallCard 渲染
  | { type: 'attachment', attachments: AiAttachment[] } // 只读的 TxAttachmentTray
  | { type: 'sources', sources: AiSourceItem[] } // TxSources
```

## 概述

- `content` 为空的消息不渲染，带 `parts` 或 `status` 为 `pending`、`streaming` 时除外。
- 这类空消息若没有 `parts`，显示输入中指示器。
- `TxAiConversation` 是 `aria-live="polite"` 区域：追加的消息会被播报，不抢焦点。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/ai-elements/`。

## 离线完整示例源码

- [AiElementsAiConversationDemo](../snapshot/apps/nexus/app/components/content/demos/AiElementsAiConversationDemo.vue.txt)

## 离线类型与实现参考

- [ai-elements/index.ts](../snapshot/packages/tuffex/packages/components/src/ai-elements/index.ts.txt)
- [src/TxAiConversation.vue](../snapshot/packages/tuffex/packages/components/src/ai-elements/src/TxAiConversation.vue.txt)
- [src/TxAiMessage.vue](../snapshot/packages/tuffex/packages/components/src/ai-elements/src/TxAiMessage.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/ai-elements/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
