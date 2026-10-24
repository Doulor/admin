# AI 套件

> 对话、智能体、推理与上下文组件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/ai-suite) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/ai-suite.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/ai-suite.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

```typescript
import { TxChatComposer, TxAgentTrace } from '@talex-touch/tuffex/ai'
import '@talex-touch/tuffex/base.css'
import '@talex-touch/tuffex/chat/style.css'
import '@talex-touch/tuffex/agent-trace/style.css'
```

## 用法

此处为官网动态目录/交互图库；离线组件与审阅状态见 [组件索引](../COMPONENTS.md)。

### 聊天面板
官方示例：`AiSuiteChatShowcaseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatRadio v-model="tab" size="sm">
    <TxFlatRadioItem value="flavors" label="口味" />
    <TxFlatRadioItem value="suppliers" label="供应商" />
  </TxFlatRadio>

  <TxAiMessage :message="userMessage" :show-avatar="false" compact />
  <TxChainOfThought :steps="steps" default-open />

  <TxChatComposer v-model="draft" @send="onSend" />
</template>
```

## 技术实现

- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT），组件源码文件头保留署名。
- 高对比主题下，`--tx-bui-*` token 保持原值。

## 离线完整示例源码

- [AiSuiteChatShowcaseDemo](../snapshot/apps/nexus/app/components/content/demos/AiSuiteChatShowcaseDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
