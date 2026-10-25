# Tool Call Card

> 单次工具调用的状态卡片

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tool-call-card) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tool-call-card.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tool-call-card.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
宿主推进 `toolCall.status`，展开区随状态切换内容。
官方示例：`ToolCallCardToolCallCardDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const toolCall = {
  type: 'tool-call',
  id: 'call-1',
  name: 'read_file',
  status: 'done',
  summary: '读取 src/main.ts',
  input: '{ "path": "src/main.ts" }',
  output: 'export function main() {}',
}
</script>

<template>
  <TxToolCallCard :tool-call="toolCall" @retry="onRetry" />
</template>
```

### 最佳实践

- 结构化结果（表格、图表、widget）放进 `result` 插槽，`output` 留作纯文本回退。
- 收到 `retry` 后立即把 `status` 改回 `running`，避免重复点击。
- 日志逐行追加，不要整段替换，尾部跟随才连贯。
- 非英文界面一并覆盖六个文案 prop，避免中英混排。
- `summary` 写这次调用做了什么，不要重复工具名：折叠态是用户唯一会扫读的内容。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `toolCall` | `AiToolCallPart` | — | 工具调用数据，必填。 |
| `defaultExpanded` | `boolean` | `false` | 初始是否展开；只在挂载时读取。 |
| `retryLabel` | `string` | `'Retry'` | 重试按钮文案。 |
| `pendingLabel` | `string` | `'Queued'` | `pending` 的状态文案。 |
| `runningLabel` | `string` | `'Running'` | `running` 的状态文案。 |
| `doneLabel` | `string` | `'Done'` | `done` 及其他未匹配状态的文案。 |
| `errorLabel` | `string` | `'Failed'` | `error` 的状态文案。 |
| `inputLabel` | `string` | `'Input'` | 入参区标题。 |

`AiToolCallPart` 为 `{ type, id, name, status, summary?, input?, output?, error?, logs? }`，`status` 取 `'pending' | 'running' | 'done' | 'error'`。

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `retry` | `(id: string)` | 点击重试时触发，参数为 `toolCall.id`。 |
| `toggle` | `(expanded: boolean)` | 点击头部时触发，参数为切换后的展开状态。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `summary` | `{ toolCall }` | 替换折叠头部的摘要。 |
| `result` | `{ toolCall }` | 结果区挂载点，供宿主渲染自己的组件；设置后不再渲染 `output`。 |
| `icon` | `{ status }` | 替换状态图标。 |

### CSS 变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--tx-tool-call-card-log-color` | `#d6e2f0` | 日志区的文字颜色。 |

## 概述

- 展开区随 `status` 切换：`running` 显示 `logs`，`done` 显示 `result` 插槽（缺省为 `output`），`error` 显示 `error` 与重试按钮；`input` 存在时始终显示。
- `logs` 每次变化，日志区都滚到底部。
- `status` 同步到根节点的 `data-status`，供外部定制样式。

## 技术实现

- `AiToolCallPart` 定义并导出于 `ai-elements`。
- 源码：`packages/tuffex/packages/components/src/tool-call-card/`。

## 离线完整示例源码

- [ToolCallCardToolCallCardDemo](../snapshot/apps/nexus/app/components/content/demos/ToolCallCardToolCallCardDemo.vue.txt)

## 离线类型与实现参考

- [tool-call-card/index.ts](../snapshot/packages/tuffex/packages/components/src/tool-call-card/index.ts.txt)
- [src/TxToolCallCard.vue](../snapshot/packages/tuffex/packages/components/src/tool-call-card/src/TxToolCallCard.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
