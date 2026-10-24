# Research 研究助手

> 带研究过程、编号引用与证据栏的研究助手

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-research) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-research.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-research.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 带引用的研究报告
官方示例：`TemplateResearchDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { useStickToBottom } from '@talex-touch/tuffex/conversation-stream'
import { nextTick, ref } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

const scroller = ref<HTMLElement | null>(null)
// 正文列跟随流式内容；读者一向上滚动就停止跟随
const stick = useStickToBottom(scroller)

// 点引用：切到证据栏对应页签，只滚动栏内的滚动容器
function onCite(source: AiSourceItem) {
  railTab.value = chunkOf(source) ? 'chunks' : 'sources'
  nextTick(() => railScroller().scrollTo({ top: offsetOf(source), behavior: 'smooth' }))
}
</script>

<template>
  <TemplateFrame title="Research 研究助手" @enter="run">
    <template #default="{ width }">
      <div class="research">
        <main ref="scroller" class="research__main" @scroll="stick.handleScroll" @wheel="stick.handleWheel">
          <TxChainOfThought :steps="steps" :streaming="researching" :default-open="false" label="研究过程" />

          <!-- 引用是组件，只能放在普通段落里逐词显影 -->
          <p class="research__answer">
            <template v-for="token in shownTokens" :key="token.id">
              <TxInlineCitation v-if="token.cite" :source="token.cite" :label="token.number" @open="onCite" />
              <span v-else>{{ token.text }}</span>
            </template>
          </p>

          <!-- 表格走 v-html，里面不写链接 -->
          <TxStreamMarkdown :content="table" :streaming="writingTable" />
          <TxInsightCards v-model:active-index="page" :pages="insights" @follow-up="ask" />
          <TxRecommendationCard v-model="choice" v-model:accepted="accepted" :options="options" @accept="saveNote" />
          <TxSuggestionChips :suggestions="followUps" layout="list" @select="ask" />

          <TxAiConversation :messages="thread">
            <template #default="{ message }">
              <TxReasoningDisclosure :text="reasoningOf(message)" label="思考过程" />
              <TxStreamMarkdown :content="answerOf(message)" :streaming="isStreaming(message)" />
            </template>
          </TxAiConversation>
        </main>

        <aside v-if="width >= 640" class="research__rail">
          <TxTabs v-model="railTab" placement="top" borderless>
            <TxTabItem name="sources">
              <template #name>来源</template>
              <template #default>
                <TxSources :sources="sources" default-open @open="hostOpens" />
              </template>
            </TxTabItem>
            <TxTabItem name="chunks">
              <template #name>片段</template>
              <template #default>
                <TxContextCards :chunks="chunks" title="命中片段" :total="32" @open="hostOpens" />
              </template>
            </TxTabItem>
            <TxTabItem name="notes">
              <template #name>笔记</template>
              <template #default>
                <TxMarkdownView :content="note" />
              </template>
            </TxTabItem>
          </TxTabs>
        </aside>
      </div>
    </template>
  </TemplateFrame>
</template>
```

## 概述

结论可溯源的研究助手：研究过程、带编号引用的结论、对比表、洞察与推荐依次出现。

- 进入视口后自动研究，约 10 秒走完，「重置」或「重新研究」可重播；减少动态效果时直接呈现完整答案。
- 点编号引用，证据栏切到对应页签，只在栏内滚动定位：有命中片段的跳到片段，其余跳到来源。
- 点来源或片段的出处只显示「宿主会打开：…」，不离开页面。
- 推荐卡可切换备选方案；「写入方案」后，方案稿出现在「笔记」页签。
- 追问在下方追加一问一答，带可展开的思考过程；正文列跟随流式内容，向上滚动即停止跟随。
- 列内（640–959px）证据栏用页签，≥ 1200px 洞察单独成列；窄屏（< 640px）收起证据栏，来源叠放在结论下方。

## 自定义

- 接真实服务时，研究步骤映射到 TxChainOfThought 的 `steps`（同一时刻只有一个 `active`），结论按 token 追加，表格交给 TxStreamMarkdown。
- 可点击的引用不能放进 markdown（TxStreamMarkdown 走 `v-html`）：引用段落单独渲染，markdown 里也不写链接。
- 证据栏用滚动容器的 `scrollTo` 定位，不用会带动整页的 `scrollIntoView`。
- 第三方产品的指标未经实测时，写定性结论或标注示例数据；推荐卡的置信度要有文字标签。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 顶栏 | [TxWorkingIndicator](./working-indicator.md)、[TxStatusBadge](./status-badge.md) | 阶段、耗时与完成状态 |
| 研究过程 | [TxChainOfThought](./chain-of-thought.md) | 四步研究过程，完成后折叠 |
| 结论 | [TxInlineCitation](./inline-citation.md) | 逐词显影的结论与编号引用 |
| 对比 | [TxStreamMarkdown](./stream-markdown.md) | 流式对比表，不含链接 |
| 洞察与建议 | [TxInsightCards](./insight-cards.md)、[TxRecommendationCard](./recommendation-card.md) | 可翻页洞察与推荐方案 |
| 追问 | [TxSuggestionChips](./suggestion-chips.md)、[TxAiConversation](./ai-elements.md)、[TxReasoningDisclosure](./reasoning-disclosure.md)、[TxTypingIndicator](./typing-indicator.md) | 追问候选与问答线程 |
| 证据栏 | [TxTabs](./tabs.md)、[TxSources](./sources.md)、[TxContextCards](./context-cards.md)、[TxSignalMeter](./signal-meter.md)、[TxSkeleton](./skeleton.md) | 来源、片段与笔记页签 |
| 笔记 | [TxMarkdownView](./markdown-view.md)、[TxMessageActions](./message-actions.md) | 采纳后的方案稿，可复制 |
| 输入 | [TxPromptBar](./prompt-bar.md) | 追问输入、命令与模式切换 |

## 离线完整示例源码

- [TemplateResearchDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateResearchDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
