# AgentTrace 智能体轨迹

> 可展开的智能体执行轨迹

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/agent-trace) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/agent-trace.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/agent-trace.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 步骤轨迹
时间轴由宿主推进：追加 `rows`，跑完后把 `working` 设为 `false`。
官方示例：`AgentTraceStepsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAgentTrace
    :rows="rows"
    :working="working"
    :default-open="open"
    done-label="思考了 4 秒"
  />
</template>
```

### 四种形态
`variant` 只改变行的形态，头部与折叠方式不变。
官方示例：`AgentTraceVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAgentTrace
    :key="variant"
    :variant="variant"
    :rows="datasets[variant]"
    :query="variant === 'search' ? '最好的华夫蛋筒供应商' : undefined"
    :more-label="variant === 'search' ? '还有 7 条' : undefined"
    default-open
    @open="openInBrowser"
  />
</template>
```

### 最佳实践

- 时间轴留在宿主：追加 `rows`、翻转 `working`，不要把播放脚本放进组件。
- `search` 形态必须处理 `open`，否则点击没有任何效果。
- 长轨迹用 `moreLabel` 收尾，不要铺开几十行。
- 成段散文用 `reasoning`（换行、不截断），单行标签用 `steps`。
- 流式界面把 `toggle` 存到宿主再传回 `userOpen`，实例重建后仍保留读者的选择。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `rows` | `AgentTraceRow[]` | — | 轨迹行，必填。 |
| `variant` | `'steps' \| 'reasoning' \| 'search' \| 'coding'` | `'steps'` | 行的形态与排版。 |
| `query` | `string` | — | `search` 形态在结果上方回显的查询。 |
| `working` | `boolean` | `false` | 是否仍在运行，驱动微光与转圈。 |
| `activeLabel` | `string` | 按形态 | 运行中的头部文案。 |
| `doneLabel` | `string` | 按形态 | 结束后的头部文案。 |
| `moreLabel` | `string` | — | 末尾的溢出说明，例如 `还有 7 条`。 |
| `defaultOpen` | `boolean` | — | 交互前的展开状态；缺省时取 `working`。 |
| `userOpen` | `boolean` | — | 宿主持有的展开状态，优先级最高，实例重建后仍有效。 |
| `selectedId` | `string` | — | `coding` 形态选中的行 id；绑定后选中态由宿主接管。 |

各形态的默认头部文案如下；「思考了 4 秒」这类带计数的文案只有宿主知道，需自行传 `doneLabel`。

| 形态 | `activeLabel` | `doneLabel` |
|------|------|------|
| `steps` / `reasoning` | `Thinking` | `Thought` |
| `search` | `Searching the web` | `Searched the web` |
| `coding` | `Running tools` | `Ran tools` |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `toggle` | `(open: boolean)` | 点击头部时触发，参数为切换后的状态。 |
| `open` | `(row: AgentTraceRow)` | `search` 形态点击带链接的行时触发；组件不会自行跳转。 |
| `select` | `(id: string \| null)` | `coding` 形态选中或取消选中时触发，取消时为 `null`。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `icon` | `{ working }` | 替换头部的星芒图标。 |
| `label` | `{ working }` | 替换头部文案。 |
| `row` | `{ row, index }` | 替换行内容，保留行容器与入场动画。 |

### 类型

#### AgentTraceRow

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 行的稳定 key。 |
| `primary` | `string` | 步骤名、推理句、网站标题或工具名。 |
| `secondary` | `string` | 右侧详情：计数、域名、文件路径或命令。 |
| `mono` | `boolean` | `secondary` 改用等宽字体。 |
| `added` / `removed` | `number` | 差分计数，显示为 `+N −M`，减号是 U+2212。 |
| `href` | `string` | `search` 形态下行渲染为链接，点击派发 `open`。 |
| `status` | `'pending' \| 'active' \| 'done' \| 'error'` | `steps` 形态的图标：`active` 转圈，`error` 画叉，其余打勾。 |

## 概述

- 展开状态依次取 `userOpen`、用户点击、`defaultOpen`、`working`；用户点击只保存在实例内。
- 头部是 `button`，带 `aria-expanded` 与 `aria-controls`；收起时折叠区设 `inert`，行移出 Tab 序列。
- `search` 行保留真实 `href`（可复制、可中键打开），点击时 `preventDefault` 并派发 `open`，由宿主决定打开方式。
- 不传 `status` 时，`working` 期间只有最后一行转圈。
- `coding` 行是带 `aria-pressed` 的 `button`。
- 减少动态效果时只停动画，开合与状态照常。

## 技术实现

- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/agent-trace/`。



## 相关组件

- [Chain of Thought](./chain-of-thought.md)：带 Markdown 正文的思考链。
- [Reasoning Disclosure](./reasoning-disclosure.md)：单段推理。
- [Sources](./sources.md)：来源列表。

## 离线完整示例源码

- [AgentTraceStepsDemo](../snapshot/apps/nexus/app/components/content/demos/AgentTraceStepsDemo.vue.txt)
- [AgentTraceVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/AgentTraceVariantsDemo.vue.txt)

## 离线类型与实现参考

- [agent-trace/index.ts](../snapshot/packages/tuffex/packages/components/src/agent-trace/index.ts.txt)
- [src/TxAgentTrace.vue](../snapshot/packages/tuffex/packages/components/src/agent-trace/src/TxAgentTrace.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/agent-trace/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
