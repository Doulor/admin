# Agents 智能体列表

> 按可用状态分组的可选智能体列表

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/agents) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/agents.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/agents.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`selectedId` 由调用方持有，在 `select` 中回写。
官方示例：`AgentsAgentsListDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const selectedId = ref<string | null>('chat')
const agents = [
  { id: 'chat', name: 'Chat Agent', iconClass: 'i-carbon-chat', badgeText: 6 },
  { id: 'code', name: 'Code Agent', iconClass: 'i-carbon-code', badgeText: 12 },
  { id: 'legacy', name: 'Legacy Agent', disabled: true },
]
</script>

<template>
  <TxAgentsList :agents="agents" :selected-id="selectedId" @select="selectedId = $event" />
</template>
```

### 最佳实践

- 组件只负责选择；发起对话、拉取能力、运行智能体放在外层模块。
- 页面已本地化时，同时传入 `enabledTitle`、`disabledTitle` 与 `emptyText`。
- `id` 用后端或注册表里的稳定值，不要用可能被本地化或改名的展示名。
- `badgeText` 只放计数、状态首字母或短标签。
- `loading` 只用于首次加载；单个智能体的执行状态写进该项的描述或 badge，不要阻塞整个列表。

## API 参考

### TxAgentsList

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `agents` | `AgentItemProps[]` | 必填 | 智能体记录；可用项排在禁用项之前。 |
| `selectedId` | `string \| null` | `null` | id 与之相同的项显示为选中。 |
| `loading` | `boolean` | `false` | 显示四行骨架，代替分组。 |
| `enabledTitle` | `string` | `'Enabled'` | 可用分组的标题。 |
| `disabledTitle` | `string` | `'Disabled'` | `disabled=true` 分组的标题。 |
| `emptyText` | `string` | `'No agents'` | `agents` 为空且不在加载时的空态文案。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `select` | `string` | 转发可用 `TxAgentItem` 的选中 id。 |

### TxAgentItem

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `id` | `string` | 必填 | 随 `select` 派发的稳定 id。 |
| `name` | `string` | 必填 | 主标题。 |
| `description` | `string` | `''` | 辅助文本。 |
| `iconClass` | `string` | `'i-carbon-bot'` | 头像区的图标 class。 |
| `selected` | `boolean` | `false` | 显示激活样式，并设置 `aria-selected=true`。 |
| `disabled` | `boolean` | `false` | 阻止点击、Enter、Space 选择，并设置 `aria-disabled=true`。 |
| `badgeText` | `string \| number` | `''` | 右侧 badge；空字符串、`null`、`undefined` 时不渲染。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `select` | `string` | 可用项被点击、Enter 或 Space 激活时触发。 |

#### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `badge` | - | 有 `badgeText` 时替换 badge 内容。 |

## 概述

- `TxAgentsList` 按 `disabled` 把 `agents` 分成可用与禁用两组，组内保持原顺序，组头显示数量。
- `loading` 优先于列表与空态。
- 每组内容区为 `role="listbox"`，`aria-label` 取组标题；每项为 `role="option"`。
- 禁用项保留 `option` 角色，由 `aria-disabled` 与点击守卫阻止选择。

## 技术实现

- `TxAgentItem` 基于 `TxCardItem`，头像形状固定为 `rounded`。
- 源码：`packages/tuffex/packages/components/src/agents/`。

## 离线完整示例源码

- [AgentsAgentsListDemo](../snapshot/apps/nexus/app/components/content/demos/AgentsAgentsListDemo.vue.txt)

## 离线类型与实现参考

- [agents/index.ts](../snapshot/packages/tuffex/packages/components/src/agents/index.ts.txt)
- [src/TxAgentItem.vue](../snapshot/packages/tuffex/packages/components/src/agents/src/TxAgentItem.vue.txt)
- [src/TxAgentsList.vue](../snapshot/packages/tuffex/packages/components/src/agents/src/TxAgentsList.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/agents/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
