# TaskRows 任务行

> 带状态与可展开明细的智能体任务行

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/task-rows) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/task-rows.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/task-rows.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 胶囊
`variant` 默认为 `capsules`，每行一张卡片；用 `v-model:open-ids` 持有展开集合。
官方示例：`TaskRowsCapsulesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTaskRows
    v-model:open-ids="openIds"
    :rows="rows"
    done-text="已完成"
    error-text="失败"
  />
</template>
```

### 列表
`variant="list"` 把各行装进同一张卡片。
官方示例：`TaskRowsListDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTaskRows
    variant="list"
    :rows="rows"
    :default-open-ids="['verify']"
    done-text="已完成"
    pending-text="排队中"
  />
</template>
```

### 最佳实践

- 独立浮在页面上的任务组用 `capsules`，已在卡片里的面板用 `list`，避免叠两层容器。
- 真正的重试按钮放进 `trailing` 插槽，不要放进行头。
- `amount` 放右对齐的数量（「12 家供应商」），明细的 `label` 写做了什么，`meta` 放计数或比率。
- 单次工具调用（入参、日志、结果、重试）用 [ToolCallCard](./tool-call-card.md)，本组件用于多行任务状态。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `rows` | `TaskRowItem[]` | — | 任务行，必填。 |
| `variant` | `'capsules' \| 'list'` | `'capsules'` | 容器形态。 |
| `defaultOpenIds` | `string[]` | — | 交互前展开的 id；绑定 `openIds` 时忽略。 |
| `openIds` | `string[]` | — | 展开的 id；绑定后由宿主持有，否则由组件持有。 |
| `doneText` | `string` | `'Completed'` | `done` 行的药丸文案。 |
| `errorText` | `string` | `'Failed'` | `error` 行的药丸文案。 |
| `runningText` | `string` | — | `running` 行的药丸文案；不传则不显示药丸。 |
| `pendingText` | `string` | — | `pending` 行的药丸文案；不传则不显示药丸。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `toggle` | `(id: string, open: boolean)` | 点击某行时触发，参数为行 id 与切换后的状态。 |
| `update:openIds` | `(ids: string[])` | 展开集合变化时触发，支持 `v-model:open-ids`。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `badge` | `{ row }` | 替换徽章（圆徽或环）。 |
| `detail` | `{ row, detail, index }` | 替换单条明细。 |
| `trailing` | `{ row }` | 渲染在折叠按钮之外的宿主控件。 |

### 类型

#### TaskRowItem

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 行的稳定 id。 |
| `label` | `string` | 任务名称。 |
| `status` | `'pending' \| 'running' \| 'done' \| 'error'` | 任务状态，与 `AiToolCallPart.status` 一致。 |
| `amount` | `string` | 右对齐的数量，等宽数字不随更新跳宽。 |
| `index` | `number` | `pending` 与 `running` 时显示在环内的序号。 |
| `statusText` | `string` | 本行的药丸文案，优先于各状态的文案 prop。 |
| `details` | `{ label, meta? }[]` | 展开后的明细；`meta` 以等宽数字显示。 |
| `retryable` | `boolean` | 失败行显示「正在重试」箭头，默认 `true`；箭头只是指示，不可点击。 |

## 概述

- 无论是否绑定 `openIds`，切换都会派发 `toggle` 与 `update:openIds`。
- 每行头部是按钮，`aria-controls` 指向自己的折叠区；收起时折叠区设 `inert`，明细移出 Tab 序列。
- 收起不卸载明细，只把高度收为 0。
- 减少动态效果时停止圆角形变、旋转与入场，状态照常推进。

## 技术实现

- 徽章与药丸以 `status` 为 key，状态切换时重建元素，入场动画才会重播。
- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/task-rows/`。

## 离线完整示例源码

- [TaskRowsCapsulesDemo](../snapshot/apps/nexus/app/components/content/demos/TaskRowsCapsulesDemo.vue.txt)
- [TaskRowsListDemo](../snapshot/apps/nexus/app/components/content/demos/TaskRowsListDemo.vue.txt)

## 离线类型与实现参考

- [task-rows/index.ts](../snapshot/packages/tuffex/packages/components/src/task-rows/index.ts.txt)
- [src/TxTaskRows.vue](../snapshot/packages/tuffex/packages/components/src/task-rows/src/TxTaskRows.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/task-rows/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
