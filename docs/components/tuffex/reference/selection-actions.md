# SelectionActions 划词工具条

> 把选中文字交给智能体改写的浮动工具条

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/selection-actions) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/selection-actions.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/selection-actions.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 划词改写
状态依次为 `idle` → `thinking` → `streaming` → `result`，由宿主推进；`thinking` 的文案带微光。
官方示例：`SelectionActionsRewriteDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { useSelectionAnchor } from '@talex-touch/tuffex/selection-actions'
import { ref } from 'vue'

const articleRef = ref(null)
const barRef = ref(null)
const state = ref('idle')

const { selection, clear } = useSelectionAnchor({
  root: articleRef,
  ignore: () => [barRef.value?.el ?? null],
})

function run(id) {
  state.value = 'thinking'
  // 宿主自己发请求，流式期间每个 delta 调一次 barRef.value.updatePosition()
}
</script>

<template>
  <article ref="articleRef">
    <p>Pistachio holds the top slot all weekend.</p>
  </article>

  <TxSelectionActions
    ref="barRef"
    :selection="selection"
    :state="state"
    @action="run($event.id)"
    @keep="clear"
    @discard="clear"
  />
</template>
```

### 追踪选区
组件只负责呈现；`useSelectionAnchor()` 追踪普通正文的选区，其他场景自行构造 `SelectionPayload`。

```ts
import { resolveSelectionPayload, useSelectionAnchor } from '@talex-touch/tuffex/selection-actions'

const { selection, clear } = useSelectionAnchor({
  root: articleRef,        // 只追踪这棵子树里的选区
  debounce: 120,           // selectionchange 每帧都触发，必须收敛
  minLength: 1,            // 太短的选区不值得弹条
  ignore: () => [barEl],   // 焦点落在工具条上不算「取消选中」
})
```

### 最佳实践

- 流式改写时，在更新文本后的同一帧调用 `updatePosition()`，不要放进 `setTimeout`。
- `ignore` 传入实例的 `el`：`() => [barRef.value?.el ?? null]`；`document.querySelector` 在页面有两个工具条时会取错。
- `keep` / `discard` 后调用 `clear()`，否则快照不释放，工具条不会收起。
- `root` 限定到正文容器，否则页面上任何一次选中都会弹出工具条。
- 消息尾部的复制、重生成、朗读用 `TxMessageActions`；本组件只用于改写选区。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `selection` | `SelectionPayload \| null` | `null` | `{ text, rects, range? }` 快照；为空时收起工具条。 |
| `state` | `'idle' \| 'thinking' \| 'streaming' \| 'result'` | `'idle'` | 状态机由宿主持有，组件不发请求。 |
| `actions` | `SelectionActionItem[]` | Explain / Improve ＋ 折叠的 Shorten / Tone / Grammar | 动作列表 `{ id, label, more?, busyLabel? }`；自定义动作应设 `busyLabel`。 |
| `activeActionId` | `string` | — | 正在运行的动作 id，决定忙碌文案。 |
| `expanded` | `boolean` | — | `v-model:expanded`，折叠的动作组。 |
| `prompt` | `string` | — | `v-model:prompt`，自由指令输入。 |
| `hidePrompt` | `boolean` | `false` | 隐藏输入框与发送键，用于只读场景。 |
| `placeholder` | `string` | `'Describe edits'` | 输入框占位，同时作为它的无障碍名。 |
| `ariaLabel` | `string` | `'Selection actions'` | 工具条的无障碍名。 |
| `keepLabel` / `discardLabel` | `string` | `'Keep'` / `'Discard'` | 结果态的两个按钮。 |
| `retryLabel` | `string` | `'Try again'` | 重试按钮的无障碍名。 |
| `sendLabel` | `string` | `'Send edit instruction'` | 发送键的无障碍名。 |
| `expandLabel` / `collapseLabel` | `string` | `'Show more actions'` / `'Show fewer actions'` | 展开按钮的无障碍名。 |
| `busyLabel` | `string` | `'Editing'` | 动作未设 `busyLabel` 时的兜底忙碌文案。 |
| `offset` | `number` | `8` | 与选区最后一行的距离（px）。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `action` | `({ id, action, selection })` | 按下预设动作，携带选区快照。 |
| `submit` | `({ prompt, selection })` | 输入框回车或按发送键；`prompt` 已 trim，空白时不触发。 |
| `keep` / `discard` | `()` | 结果态的保留 / 放弃。 |
| `retry` | `()` | 结果态的重试。 |
| `update:expanded` | `(expanded: boolean)` | 折叠组开合。 |
| `update:prompt` | `(prompt: string)` | 输入内容变化。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `action-icon` | `{ action }` | 覆盖动作图标；自定义 `id` 必须使用。 |
| `busy` | `{ label }` | 覆盖忙碌区。 |
| `result` | — | 覆盖保留 / 放弃 / 重试按钮组。 |

### 暴露方法

| 方法 | 说明 |
|------|------|
| `updatePosition()` | 按当前 `selection.rects` 重新定位；流式宿主必须调用。 |
| `focusInput()` | 聚焦自由指令输入框。 |
| `el` | 工具条根元素，传给 `useSelectionAnchor` 的 `ignore`。 |

### useSelectionAnchor 选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `root` | `MaybeRefOrGetter<Element \| null \| undefined>` | — | 限定追踪范围；不传则监听整篇文档。 |
| `debounce` | `number` | `120` | `selectionchange` 的收敛时间（ms）。 |
| `minLength` | `number` | `1` | 去空白后的最小长度。 |
| `disabled` | `MaybeRefOrGetter<boolean>` | `false` | 暂停上报而不卸载。 |
| `ignore` | `MaybeRefOrGetter<Array<Element \| null \| undefined>>` | `[]` | 焦点落进这些元素时不视为取消选中。 |

返回 `{ selection, clear }`：`selection` 是 `Ref<SelectionPayload | null>`，`clear()` 在改写落地或放弃后调用。`resolveSelectionPayload()` 是其内部的纯函数规则，单独导出供测试或自定义追踪；两者都是运行时函数，需从 `@talex-touch/tuffex/selection-actions` 显式导入。

## 概述

- 锚点是选区最后一行的底边，水平居中于整段选区；工具条不翻面（`disableFlip`），只横向推回视口。
- 锚点是虚拟参考点，`floating-ui` 不会跟随文本重排；流式写入时由宿主调用 `updatePosition()`，窗口缩放与滚动由组件处理。
- `selection` 是快照：聚焦输入框会清掉浏览器选区，动作仍作用于传入的那一份。
- 根节点吞掉 `pointerdown`，按按钮不会转移焦点或毁掉选区；`input`、`textarea`、`contenteditable` 内除外。Safari 与 Firefox 此后的光标行为不同，接入时需真机验证。
- 根节点为 `role="group"`，方向键留给输入框光标；折叠的动作与 `prompt` 为空时的发送键不在 Tab 序列中。
- 入场是越过终值的弹簧动画；减少动态效果时去掉入场动画、跳过宽度补间，元素停在可见终态。

## 技术实现

- 宽度形变走 WAAPI，因此在脚本中读取 `prefers-reduced-motion`；追踪层基于 `@vueuse/core` 的 `useTextSelection`，并 clone 选区的 range。
- 移植自 Beautiful UI（https://www.beautifului.dev），© 2026 Shane Levine，MIT；追踪层是移植时新写的，上游没有真实选区。
- 源码：`packages/tuffex/packages/components/src/selection-actions/`。

## 离线完整示例源码

- [SelectionActionsRewriteDemo](../snapshot/apps/nexus/app/components/content/demos/SelectionActionsRewriteDemo.vue.txt)

## 离线类型与实现参考

- [selection-actions/index.ts](../snapshot/packages/tuffex/packages/components/src/selection-actions/index.ts.txt)
- [src/TxSelectionActions.vue](../snapshot/packages/tuffex/packages/components/src/selection-actions/src/TxSelectionActions.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/selection-actions/src/types.ts.txt)
- [src/use-selection-anchor.ts](../snapshot/packages/tuffex/packages/components/src/selection-actions/src/use-selection-anchor.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
