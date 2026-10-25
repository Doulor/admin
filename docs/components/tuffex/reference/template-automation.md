# Automation 自动化编排

> 带流程画布、节点配置与运行日志的自动化编辑器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-automation) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-automation.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-automation.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 剪贴板截图翻译
官方示例：`TemplateAutomationDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

const states = reactive({ trigger: 'idle', ocr: 'idle', fallback: 'idle', translate: 'idle', notify: 'idle' })
const flight = ref<string | null>(null) // 正在传递数据的那条连线
const config = reactive({ ocr: { engine: 'vision', minConfidence: 80 }, translate: { rateLimit: false } })

const edges = computed(() => [
  ['trigger', 'ocr'], ['ocr', 'translate'], ['ocr', 'fallback'], ['fallback', 'translate'], ['translate', 'notify'],
].map(([from, to]) => ({ from, to, dashed: flight.value === `${from}>${to}` })))

// 按下「运行」时按当前配置排好一条可取消的 setTimeout 链
function run() {
  const reread = OCR_CONFIDENCE < config.ocr.minConfidence
  schedule(0, () => (states.trigger = 'running'))
  schedule(400, () => {
    states.trigger = 'done'
    flight.value = 'trigger>ocr'
  })
  // … 识别，然后要么走 AI 重读，要么 states.fallback = 'skipped' …
}
</script>

<template>
  <TemplateFrame title="Automation" @enter="run">
    <template #default="{ width, height }">
      <TxFlowchart
        :nodes="layout(width, height)" :edges="edges" :height="height - 56"
        :node-width="212" draggable
        @node-move="keepOffset" @node-click="({ id }) => (selected = id)"
      >
        <template #node="{ node }">
          <div class="flow-node" :class="`is-${states[node.id]}`">
            <span class="flow-node__title">{{ titles[node.id] }}</span>
            <TxWorkingIndicator v-if="states[node.id] === 'running'" variant="dots" :show-elapsed="false" />
            <TxStatusBadge v-else-if="states[node.id] === 'done'" size="sm" status="success" text="完成" />
          </div>
        </template>
      </TxFlowchart>

      <aside class="flow__rail">
        <TxFlatSelect v-model="config.ocr.engine">
          <TxFlatSelectItem value="vision" label="Apple Vision" />
          <TxFlatSelectItem value="windows" label="Windows OCR" />
        </TxFlatSelect>
        <TxScrubField v-model="config.ocr.minConfidence" label="≥" :min="50" :max="99" suffix="%" />
        <TxTaskRows variant="list" :rows="taskRows" />
        <TxCodeStream :code="log" :revealed-lines="revealed" :min-height="0" />
      </aside>
    </template>
  </TemplateFrame>
</template>

<style scoped>
/* TxFlowchart 的连线只有 dashed 一种变体，模板用它表示「正在传递」 */
.flow :deep(.tx-bui-flowchart__edge.is-dashed) { stroke: var(--tx-bui-accent); }
@media (prefers-reduced-motion: no-preference) {
  .flow :deep(.tx-bui-flowchart__edge.is-dashed) { animation: march 0.6s linear infinite; }
}
@keyframes march { to { stroke-dashoffset: -8; } }
</style>
```

## 概述

可编辑、可运行的 Tuff 截图 OCR 流程：原生 OCR 置信度不足时交给 AI 重读，再翻译并写回剪贴板。

- 首次进入视口时自动运行一次（约 3.3 秒），数据经过的连线会流动；减少动态效果时直接显示结果，不启动计时器。
- 点节点编辑配置，对下一次运行生效；把「原生 OCR」的最低置信度调到 94% 以上（样例为 93%），运行就会绕到 AI 重读。
- 「翻译」节点打开「模拟限流（429）」后，翻译先失败，600ms 后重试成功。
- 运行中可以「停止」：正在执行的节点标为已取消，日志补一行 `cancelled by user`。
- 节点可拖动并吸附点阵；拖动距离作为偏移保留，全屏后不丢。
- 宽屏（≥ 960px）显示运行记录、四步进度与日志分栏；列内与窄屏把「节点配置 / 本次运行」收进页签。

## 自定义

- 换成自己的流程：节点与连线都是普通数组，`flowNodes()` 只按画布尺寸算坐标；连线总从上一节点底边连到下一节点顶边，分支节点要横向错开。
- 接真实执行器时，把 `buildPlan()` 里的定时步骤换成后端事件（SSE / WebSocket），每个事件调用一次 `setNode()` 并追加一行日志。
- TxFlowchart 没有逐条连线的样式 API：模板借用 `dashed` 表示「正在传递」，颜色与流动写在 `prefers-reduced-motion: no-preference` 之内。
- TxFlatSelect 与微调卡片的类型菜单都不 teleport，要避开 `overflow: hidden` 的裁切，并远离容器底边。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 顶栏 | [TxWorkingIndicator](./working-indicator.md)、[TxStatusBadge](./status-badge.md)、[TxSteps](./steps.md)、[TxSwitch](./switch.md)、[TxButton](./button.md) | 状态、进度与运行 / 停止 |
| 画布 | [TxFlowchart](./flowchart.md)、[TxStatusBadge](./status-badge.md)、[TxWorkingIndicator](./working-indicator.md)、[TxDotIndicator](./dot-indicator.md) | 五个节点与流动连线 |
| 节点配置 | [TxFlatSelect](./flat-select.md)、[TxScrubField](./scrub-field.md)、[TxSwitch](./switch.md)、[TxFineTuneCard](./fine-tune-card.md)、[TxToastPanel](./toast-panel.md) | 每个节点的表单 |
| 本次运行 | [TxTaskRows](./task-rows.md)、[TxCodeStream](./code-stream.md) | 步骤状态与运行日志 |
| 运行记录（宽屏） | [TxTimeline](./timeline.md) | 最近几次运行 |
| 日志分栏（宽屏） | [TxSplitter](./splitter.md) | 调整画布与日志高度 |
| 完成提示 | [TxToastPanel](./toast-panel.md) | 4 秒后收起的结果卡 |

## 离线完整示例源码

- [TemplateAutomationDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateAutomationDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
