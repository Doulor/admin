# AgentScreen 智能体屏幕

> 呈现智能体当前画面的定比例画框

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/agent-screen) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/agent-screen.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/agent-screen.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`state` 在画面与占位间切换，`cursor` 叠加带动作文案的指针。
官方示例：`AgentScreenAgentScreenDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const state = ref<'working' | 'loading'>('working')
</script>

<template>
  <TxAgentScreen
    :state="state"
    label="智能体的屏幕"
    :cursor="{ x: 46, y: 62, label: '正在打开「照片」' }"
  >
    <!-- 截图、canvas 或 video -->
    <canvas ref="surface" />
  </TxAgentScreen>
</template>
```

### 最佳实践

- 实时 canvas 或 video 放进默认插槽，`src` 只用于静态截图。
- `label` 写这是谁的屏幕，指针的 `label` 写它正在做什么。
- 两帧之间把 `state` 切到 `loading`，不要留着旧画面，旧画面会被读成「卡住了」。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `string` | - | 画面图片地址；默认插槽有内容时忽略。 |
| `alt` | `string` | - | 画面的无障碍描述；设置 `src` 时必填。 |
| `label` | `string` | - | 画框下方的说明；不传则不渲染。 |
| `state` | `'working' \| 'loading'` | `'working'` | 显示画面或加载占位。 |
| `cursor` | `AgentScreenCursor` | - | 指针叠层；不传则不渲染。 |
| `ratio` | `string` | `'2964 / 1856'` | 画框的 CSS `aspect-ratio`，默认取上游采集图的比例。 |
| `ariaLabel` | `string` | `'Agent screen'` | 整个区域的无障碍名称。 |
| `loadingLabel` | `string` | `'Waiting for the agent’s screen'` | 加载时朗读的文本。 |

### 插槽

| 插槽名 | 说明 |
|---|---|
| `default` | 替换画面内容，优先于 `src`。 |
| `overlay` | 画面之上、裁剪之内的叠层；加载时一并撤掉。 |
| `label` | 替换画框下方的说明。 |

### 类型

#### AgentScreenCursor

| 字段 | 类型 | 说明 |
|---|---|---|
| `x` / `y` | `number` | 相对画框的百分比（0–100），缩放后位置不变；越界会被夹住。 |
| `label` | `string` | 指针旁的一行文案，通常是当前动作。 |

## 概述

- 组件只负责画框、指针与说明；画面来自默认插槽或 `src`，两者不叠加。
- `ratio` 固定比例而非高度：宽度跟随容器，高度按比例计算。
- `state` 为 `loading`，或既无默认插槽也无 `src` 时，显示骨架占位，并撤掉画面、指针与 `overlay`。
- 根节点为 `role="group"`，以 `ariaLabel` 命名；占位带 `role="status"` 与 `aria-live="polite"`，朗读 `loadingLabel`。
- 减少动态效果时，占位停止微光。

## 技术实现

- 占位复用库内骨架条 `skeleton-surface`，底色固定为 BUI 表面色。
- 移植自 [Beautiful UI](https://www.beautifului.dev) 第 21 例 Agent Screen（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/agent-screen/`。

## 离线完整示例源码

- [AgentScreenAgentScreenDemo](../snapshot/apps/nexus/app/components/content/demos/AgentScreenAgentScreenDemo.vue.txt)

## 离线类型与实现参考

- [agent-screen/index.ts](../snapshot/packages/tuffex/packages/components/src/agent-screen/index.ts.txt)
- [src/TxAgentScreen.vue](../snapshot/packages/tuffex/packages/components/src/agent-screen/src/TxAgentScreen.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/agent-screen/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
