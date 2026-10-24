# StreamText 流式文字

> 逐词匀速显影的流式文字

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/stream-text) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/stream-text.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/stream-text.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.3`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

```bash
pnpm add @talex-touch/tuffex
```

```typescript
import { TxStreamText } from '@talex-touch/tuffex/stream-text'
import '@talex-touch/tuffex/stream-text/style.css'
import '@talex-touch/tuffex/inline-citation/style.css' // 引用 chip
import '@talex-touch/tuffex/base.css' // 全局引入一次
```

## 用法

### 流式输出
把目前收到的全部文字传给 `content`，源头输出期间保持 `streaming` 为真。
官方示例：`StreamTextStreamTextDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const reply = ref('')
const busy = ref(true)

for await (const delta of stream)
  reply.value += delta
busy.value = false
</script>

<template>
  <p>
    <TxStreamText :content="reply" :streaming="busy" />
  </p>
</template>
```

### 显影预设
`reveal` 决定词的进场方式。内容完整时用 `replay()` 重播，`reserve` 让版面保持不动。
官方示例：`StreamTextPresetsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import type { TxStreamTextInstance } from '@talex-touch/tuffex/stream-text'

const text = ref<TxStreamTextInstance | null>(null)
</script>

<template>
  <TxStreamText ref="text" :content="answer" reveal="blur" reserve />
  <TxButton @click="text?.replay()">重播</TxButton>
</template>
```

### 插槽与状态
`content` 也接受片段数组：带样式与链接的文字、引用和自定义片段。
官方示例：`StreamTextSlotsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxStreamText :content="runs" @state-change="state = $event" @cite="open">
    <template #caret="{ state }">
      <span class="my-caret" :data-state="state" />
    </template>
    <template #citation="{ source, index }">
      <sup>{{ index }}</sup>
    </template>
    <template #inline="{ name, props }">
      <MyDelta v-if="name === 'delta'" :value="props.value" />
    </template>
  </TxStreamText>
</template>
```

### 最佳实践

- 传目前为止的完整文字，不要只传增量。
- 源头真正结束前一直保持 `streaming` 为真；已完整的回答（历史、回放）不开，重播用 `replay()`。
- 完整文字在不能挪动的布局（卡片、气泡）里回放时，打开 `reserve`。
- 复制、分享用你持有的完整文字：屏幕显示最多落后源头 `maxLagMs`。
- 组件不是 live region；需要播报回复时，把对话包在 `role="log"` 里。

## API 参考

### 属性

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | `string \| StreamInline[]` | — | 目前收到的全部内容，必填。 |
| `streaming` | `boolean` | `false` | 源头仍在输出；可能未写完的末词等后文或静默 200ms 后放出。 |
| `wordMs` | `number` | `24` | 每 `wordMs` 放出一个词。 |
| `maxLagMs` | `number` | `600` | 任何词都在到达后这段时间内显示。 |
| `drainMs` | `number` | `320` | `streaming` 变为 false 后，在这段时间内放完剩余部分。 |
| `pauseMs` | `number` | `400` | 输出中超过这段时间没有新词即报告 `paused`。 |
| `reveal` | `'aurora' \| 'hue' \| 'blur' \| 'languid' \| 'none'` | `'aurora'` | 词的进场方式，见 `StreamRevealPreset`。 |
| `caret` | `boolean` | `true` | 流式进行时显示光标；关闭时立即移除。 |
| `reserve` | `boolean` | `false` | 完整内容回放时用隐形副本占住最终版面；`streaming` 时忽略。 |
| `paced` | `boolean` | `true` | 为 `false` 时词一到就显示（仍有进场）；`TxStreamElement` 统一控制节奏时传 `false`。 |
| `appear` | `boolean` | `false` | 挂载时已有的内容也播放进场；只在挂载时读取。 |
| `tag` | `string` | `'span'` | 根元素。 |
| `locale` | `string` | `'zh'` | `Intl.Segmenter` 分词所用的语言。 |

### 事件

| 名称 | 参数 | 说明 |
|------|------|------|
| `state-change` | `(state: StreamState)` | 流式状态变化时触发。 |
| `done` | — | 每次播放触发一次：末词已显示且源头已结束。 |
| `cite` | `(source: AiSourceItem)` | 引用 chip 被打开时触发；chip 自身不跳转。 |

### 插槽

| 名称 | 作用域 | 说明 |
|------|--------|------|
| `caret` | `{ state }` | 替换 Tuff 光标，只在流式进行时渲染。 |
| `citation` | `{ source, label, index }` | 替换引用 chip；`index` 为标记中的数字。 |
| `inline` | `{ name, props }` | 渲染 `{ type: 'custom' }` 片段。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `state` | `StreamState` | 当前流式状态。 |
| `replay` | `() => void` | 从第一个词起按 `wordMs` 重播全部内容。 |
| `skip` | `() => void` | 立即显示全部内容，不播放进场。 |

### 类型

```typescript
type StreamState = 'idle' | 'streaming' | 'paused' | 'draining' | 'done'

type StreamRevealPreset =
  | 'aurora' // 从 4px 模糊析出，同时扫过蓝紫粉色带（默认）
  | 'hue' // 只扫色带
  | 'blur' // 只有模糊
  | 'languid' // 从 8px 模糊缓慢上浮
  | 'none' // 放出即显示

type StreamInline =
  | { type: 'text', text: string, marks?: ('strong' | 'em' | 'del' | 'code')[], href?: string }
  | { type: 'citation', source: AiSourceItem, label?: string, index?: number }
  | { type: 'custom', name: string, props?: Record<string, unknown> }
```

### CSS 变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--tx-stream-reveal-1` / `-2` / `-3` | 蓝 / 紫 / 粉，随主题变化 | 色带的三个颜色节点；高对比度主题下均为正文色。 |
| `--tx-stream-caret-start` / `--tx-stream-caret-end` | `#199ffe` / `#810dc6` | 光标渐变，取自 Tuff logo。 |
| `--tx-stream-reveal-duration` | 取决于预设 | 由组件按 `reveal` 写入根节点，无需设置。 |

## 概述

- 词按 `wordMs` 匀速放出；突发时提速，保证每个词在到达后 `maxLagMs` 内显示；源头结束后，剩余部分在 `drainMs` 内放完。
- 状态依次为 `idle` → `streaming` → `paused`（`pauseMs` 内无新词）→ `draining`（源头已结束，积压仍在放出）→ `done`；光标在 `done` 时收起。
- 只有新内容进场：挂载时已有的内容直接显示；前文被改写时，从第一个改动的词起重新放出。
- 用 `Intl.Segmenter` 按词切分，标点随所属的词；不支持时拉丁文按空格、中日韩文字按字切分。
- `href` 只对 `http(s)`、`mailto`、`tel`、相对路径、查询串与 hash 链接生效，`//` 开头的地址保持为文字；链接带 `rel="noopener noreferrer"`。
- 减弱动效时不进场、不控节奏，光标静止；服务端渲染为纯文本；流式进行时根节点带 `aria-busy="true"`。
- 断行：文字自己是块级容器时（`tag` 是块级元素，或 `reserve` 回放时铺开的两份副本），写完后按 `text-wrap-style: pretty` 断行，末行不会只剩一两个字；流式进行中按普通 `wrap` 断行，免得每放出一个词都重排整段。作为行内元素放在宿主段落里时，由宿主段落决定。
- 光标与 `reserve` 副本对辅助技术隐藏（副本同时 `inert`）；文字本身不是 live region，需要播报时把对话包在 `role="log"` 里。

## 技术实现

- 时钟 `use-stream-pacer.ts` 与 `style/mixins.scss` 中的 `stream-reveal-*` mixin 由流式家族共用。
- 动效参考 kobra.systems（`hue`）与 Beautiful UI（`blur`）的 streaming text，默认的 `aurora` 合并两者；光标取自 Tuff logo。
- 源码：`packages/tuffex/packages/components/src/stream-text/`。



## 使用场景

- 逐 token 到达的 AI 回答：对话、侧边面板、通知。
- 以可读的节奏回放存档的回答或脚本演示，版面不动。
- 带出处的简短生成句子，引用落在对应论断处。

## 相关组件

- [StreamMarkdown](./stream-markdown.md)：流式渲染完整的 Markdown 文档，使用同一套显影预设与光标。
- [CodeStream](./code-stream.md)：流式输出代码。
- [InlineCitation](./inline-citation.md)：默认的引用 chip。
- [Sources](./sources.md)：在回答末尾列出来源。

## 离线完整示例源码

- [StreamTextStreamTextDemo](../snapshot/apps/nexus/app/components/content/demos/StreamTextStreamTextDemo.vue.txt)
- [StreamTextPresetsDemo](../snapshot/apps/nexus/app/components/content/demos/StreamTextPresetsDemo.vue.txt)
- [StreamTextSlotsDemo](../snapshot/apps/nexus/app/components/content/demos/StreamTextSlotsDemo.vue.txt)

## 离线类型与实现参考

- [stream-text/index.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/index.ts.txt)
- [src/TxStreamCaret.vue](../snapshot/packages/tuffex/packages/components/src/stream-text/src/TxStreamCaret.vue.txt)
- [src/TxStreamText.vue](../snapshot/packages/tuffex/packages/components/src/stream-text/src/TxStreamText.vue.txt)
- [src/model.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/src/model.ts.txt)
- [src/presets.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/src/presets.ts.txt)
- [src/segment.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/src/segment.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/src/types.ts.txt)
- [src/use-slot-version.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/src/use-slot-version.ts.txt)
- [src/use-stream-pacer.ts](../snapshot/packages/tuffex/packages/components/src/stream-text/src/use-stream-pacer.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
