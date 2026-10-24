# AiAnswer 问答助手

> 流式写出、带编号引用与追问的多轮问答

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-ai-answer) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-ai-answer.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-ai-answer.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.3`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 多轮问答
官方示例：`TemplateAiAnswerDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

// 一轮 = 提问一行 + 回答一行。新行插在固定的 tail 前面，
// 已有的行只挂载一次；会话前缀每次重置都换，同时做 stream 的 key
const state = reactive({ session, turns: [], items: [{ id: `${session}-tail`, kind: 'tail' }] })

// 停止生成：源头到此结束，组件把已经收到的部分显影完
function stop() {
  lastTurn.value.live = false
}
</script>

<template>
  <TemplateFrame title="问答助手" @enter="start">
    <TxConversationStream :key="state.session" :items="state.items" item-key="id" :streaming="answering">
      <template #item="{ item }">
        <TxChatMessage v-if="item.kind === 'ask'" :message="askMessage(item)" :markdown="false" />
        <TxStreamElement
          v-else-if="item.kind === 'reply'"
          :key="turnOf(item).gen"
          :content="turnOf(item).received"
          :streaming="turnOf(item).live"
          :sources="sources"
          @cite="onCite"
          @done="onDone"
        >
          <template #footer="{ done }">
            <div v-if="done">
              <TxMessageActions :copy-text="turnOf(item).received" regenerable @regenerate="regenerate" />
              <TxSources :sources="citedBy(item)" variant="stack" />
              <TxSuggestionChips :suggestions="followUpsOf(item)" layout="list" @select="onFollowUp" />
            </div>
          </template>
        </TxStreamElement>
      </template>
    </TxConversationStream>
    <TxButton v-if="sourcing" size="sm" @click="stop">停止生成</TxButton>
    <TxPromptBar v-model="draft" :submitting="sourcing" @send="onSend" />
  </TemplateFrame>
</template>
```

## 概述

结论可溯源的多轮问答：每轮回答由一个 TxStreamElement 流式写出。

- 进入视口后自动演示，第一问写完约 1.6 秒后自动追问一次；点击或按键即停止自动追问。
- 回答写完才出现操作行、来源与追问；点追问在下方追加一轮。
- 「停止生成」立即结束源头，已收到的内容照常显影，之后仍可重新生成。
- 点编号引用展开本轮来源，不离开页面。
- 对话列跟随最新内容，向上翻看时停止跟随，整页不动。
- 列内（640–959px）回答占满整列，≥ 960px 居中；窄屏（< 640px）收起状态与头像；减少动态效果时直接呈现两轮完整问答。

## 自定义

- 接真实服务时，把 token 依次拼进 `content`，源头结束前保持 `streaming` 为真；停止生成就是把它置为假。
- 引用按 `sources` 顺序编号，`[n]` 对应 `sources[n - 1]`；复制与分享用你持有的完整文本，不读屏幕显示（最多落后 `maxLagMs`）。
- 行 id 全局唯一：每次重置换会话前缀，并用它做 TxConversationStream 的 `key`。
- 新行插在固定的 tail 前面，每一轮只挂载一次，正在写的回答不会被打断。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 标题栏 | [TxIconButton](./button.md) | 回答状态与「重新开始」 |
| 对话 | [TxConversationStream](./conversation-stream.md)、[TxChatMessage](./chat.md) | 多轮对话与提问气泡 |
| 回答 | [TxStreamElement](./stream-element.md) | 逐词显影与引用 chip |
| 回答之后 | [TxMessageActions](./message-actions.md)、[TxSources](./sources.md)、[TxSuggestionChips](./suggestion-chips.md) | 写完后的操作、来源与追问 |
| 输入 | [TxPromptBar](./prompt-bar.md)、[TxButton](./button.md) | 提问与「停止生成」 |

## 离线完整示例源码

- [TemplateAiAnswerDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateAiAnswerDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
