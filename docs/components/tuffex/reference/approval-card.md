# ApprovalCard 澄清问卷卡

> 智能体动手前逐题澄清的问卷卡

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/approval-card) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/approval-card.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/approval-card.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 多题走查
一次显示一题。单选作答后经 `autoAdvanceDelay` 自动翻页，多选等用户按发送键。
官方示例：`ApprovalCardWalkthroughDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const answers = ref({})
const questions = [
  {
    id: 'count',
    question: '我们先上几个口味？',
    type: 'radio',
    options: [
      { value: 'three', label: '三个（核心线）' },
      { value: 'five', label: '五个（整箱）' },
    ],
  },
  {
    id: 'mixins',
    question: '要备哪些配料？',
    type: 'check',
    options: [
      { value: 'chips', label: '巧克力碎' },
      { value: 'waffle', label: '华夫碎' },
    ],
  },
]
</script>

<template>
  <TxApprovalCard
    v-model="answers"
    :questions="questions"
    @submit="run"
  />
</template>
```

### 最佳实践

- 这是问卷，不是授权闸门；单次工具调用的允许或拒绝用 [ToolConfirmation](./tool-confirmation.md)。
- 监听 `answer` 增量保存，不要只等 `submit`：用户中途关闭时，已答内容不应丢失。
- 题目控制在 3～5 个，更多时改用表单页。
- 非英文界面一并覆盖全部文案 props，避免中英混排。
- 卡片可能被重建时（如流式消息），由宿主持有答案、`index` 与 `sent`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `questions` | `ApprovalQuestion[]` | — | 题目列表，必填。 |
| `modelValue` | `Record<string, ApprovalAnswer>` | — | 按 `question.id` 索引的答案表；不传则组件自持。 |
| `index` | `number` | — | 当前题号，配合 `v-model:index`；不传则组件自持。 |
| `sent` | `boolean` | — | 是否已提交，配合 `v-model:sent`。 |
| `open` | `boolean` | — | 配合 `v-model:open`；为 `false` 时整卡收成一颗重开按钮。 |
| `autoAdvance` | `boolean` | `true` | 单选作答后自动翻页；减少动态效果时不生效。 |
| `autoAdvanceDelay` | `number` | `480` | 自动翻页的延时（ms）。 |
| `dismissible` | `boolean` | `true` | 渲染关闭按钮。 |
| `ariaLabel` | `string` | `'Approval questions'` | 整卡的无障碍名称。 |
| `sendLabel` | `string` | `'Send answers'` | 末题发送键的无障碍名称。 |
| `nextQuestionLabel` | `string` | `'Next question'` | 其他题发送键的无障碍名称。 |
| `prevLabel` / `nextLabel` | `string` | `'Previous'` / `'Next'` | 分页箭头的无障碍名称。 |
| `dismissLabel` | `string` | `'Dismiss'` | 关闭按钮的无障碍名称。 |
| `reopenLabel` | `string` | `'Open approval'` | 收起后按钮的文案。 |
| `sentLabel` | `string` | `'Answers sent'` | 提交成功的文案。 |
| `startOverLabel` | `string` | `'Start over'` | 重新开始按钮的文案。 |
| `customPlaceholder` | `string` | `'Type something…'` | 自由作答框的占位，可被单题覆盖。 |
| `customLabel` | `string` | `'Custom answer'` | 自由作答框的无障碍名称。 |
| `pagerLabelFormatter` | `(position: number) => string` | `` n => `Go to question ${n}` `` | 分页圆点的无障碍名称。 |
| `skippable` | `boolean` | `false` | 渲染跳过控件；默认关闭，必答的问卷不该提供出口。 |
| `skipLabel` | `string` | `'Skip'` | 跳过控件的文案。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(answers: Record<string, ApprovalAnswer>)` | 答案表变化时触发。 |
| `update:index` | `(index: number)` | 翻页时触发。 |
| `update:sent` | `(sent: boolean)` | 提交态变化时触发。 |
| `update:open` | `(open: boolean)` | 收起或展开时触发。 |
| `answer` | `(answer: ApprovalAnswer)` | 每题作答后立即触发，便于增量保存。 |
| `submit` | `(answers: ApprovalAnswer[])` | 提交时触发，按 `questions` 顺序给出已答项。 |
| `skip` | `({ questionId, index })` | 跳过当前题时触发；不写入答案，宿主可区分拒答与作答。 |
| `dismiss` | `()` | 卡片关闭时触发。 |
| `reopen` | `()` | 卡片重新展开时触发。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `question` | `{ question, index }` | 替换题干。 |
| `sent` | `{ answers }` | 替换提交成功面板。 |
| `footer-extra` | — | 插在页脚发送键之前。 |

### 暴露方法

| 方法 | 说明 |
|------|------|
| `next()` / `prev()` / `goTo(index)` | 翻页。 |
| `submit()` | 等同按下发送键；没有答案时不执行。 |
| `reset()` | 清空答案、回到首题、退出提交态并重新展开。 |

### 类型

#### ApprovalQuestion

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 题目 id，也是答案表的键。 |
| `question` | `string` | 题干。 |
| `type` | `'radio' \| 'check'` | 单选或多选，默认 `'radio'`。 |
| `options` | `ApprovalOption[]` | 选项 `{ value, label }`；答案按 `value` 存储，选项重排不会错位。 |
| `allowCustom` | `boolean` | 设为 `false` 去掉自由作答行，默认 `true`。 |
| `customPlaceholder` | `string` | 覆盖本题的 `customPlaceholder`。 |

#### ApprovalAnswer

| 字段 | 类型 | 说明 |
|------|------|------|
| `questionId` | `string` | 所属题目的 `id`。 |
| `values` | `string[]` | 选中的 `option.value`；单选题最多一个。 |
| `custom` | `string` | 自由作答文本。 |

## 概述

- `modelValue`、`index`、`sent`、`open` 传入时以 prop 为准，未传时由组件自持。
- 单选题上，选项与自由作答互斥，后填的清掉先填的；多选题两者并存。
- 有选中项或非空自由文本时发送键才可用：末题提交，其余题前进。末题上的自动翻页与跳过同样直接提交。
- 圆点填满表示该题已作答，与是否经过无关。
- 关闭后整卡换成重开按钮，状态保留；只有 `reset()` 或「重新开始」会清空。
- 选项是带 `aria-pressed` 的 `button`，整组为 `role="group"`，以 `aria-labelledby` 指向题干。

## 技术实现

- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/approval-card/`。

## 离线完整示例源码

- [ApprovalCardWalkthroughDemo](../snapshot/apps/nexus/app/components/content/demos/ApprovalCardWalkthroughDemo.vue.txt)

## 离线类型与实现参考

- [approval-card/index.ts](../snapshot/packages/tuffex/packages/components/src/approval-card/index.ts.txt)
- [src/TxApprovalCard.vue](../snapshot/packages/tuffex/packages/components/src/approval-card/src/TxApprovalCard.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/approval-card/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
