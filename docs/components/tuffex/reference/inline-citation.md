# InlineCitation 行内引用

> 嵌在正文中的来源引用胶囊

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/inline-citation) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/inline-citation.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/inline-citation.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`InlineCitationInlineCitationDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const scoop = { id: 'scoop', url: 'https://scoopdata.io/flavors/pistachio', favicon: '/scoop.svg' }
const trends = { id: 'trends', url: 'https://www.trends.google.com/trends/' }

function open(source: { url: string }) {
  window.open(source.url, '_blank', 'noopener')
}
</script>

<template>
  <p>
    开心果是增长最快的口味<TxInlineCitation :source="scoop" @open="open" />，
    同区间内核果类口味同样在上升<TxInlineCitation :source="trends" @open="open" />。
  </p>
</template>
```

### 流式回答
引用随正文流入时播放弹入；整段编排由宿主完成，组件只渲染一枚胶囊。
官方示例：`AiSuiteStreamingAnswerDemo`（完整源码见本页末尾）

```vue
<template>
  <p>
    <span v-for="(token, i) in visible" :key="i">
      <TxInlineCitation v-if="token.cite" :source="sources[0]" @open="open" />
      <span v-else>{{ token.text }} </span>
    </span>
  </p>

  <TxSources :sources="sources" variant="stack" @open="open" />
  <TxSuggestionChips :suggestions="followUps" layout="list" @select="ask" />
</template>
```

### 最佳实践

- 监听 `open`，否则点击引用没有任何反应。
- 每段正文的引用控制在 2~3 枚；密集出现会把段落读成列表。
- `label` 通常留空：域名回落让读者一眼看出出处。
- 流式场景里 `source.id` 保持稳定，坏图标不会随节点复用反复重试。
- 答案末尾的来源清单用 `TxSources`；二者共用 `AiSourceItem`，常一起出现。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `source` | `AiSourceItem` | — | 引用目标 `{ id, url, title?, favicon? }`，必填。 |
| `label` | `string` | — | 胶囊文案；缺省时依次取 `source.title`、去掉 `www.` 的域名，`url` 无法解析时用原文。 |
| `appear` | `boolean` | `true` | 挂载时播放弹入；重渲染已定稿的答案时设为 `false`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | `(source: AiSourceItem)` | 点击时触发；默认跳转已阻止，导航由宿主完成。 |

### 插槽

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `default` | `{ source, label }` | 替换胶囊文案，可放富文本。 |
| `icon` | `{ source }` | 替换前置的站点图标。 |

## 概述

- 渲染真实的 `<a href>`，点击时 `preventDefault()` 再派发 `open`，不会把 Electron 渲染进程导航走；浏览器的「在新标签页打开」「复制链接地址」仍可用。
- 站点图标加载失败后不再渲染，胶囊退化为纯文案。
- 图标带 `alt=""` 与 `aria-hidden`，可访问名称来自胶囊文案。
- 胶囊嵌在文字流中，行高由所在段落决定。
- 弹入只在挂载时播放一次，之后修改 `appear` 不会重播。

## 技术实现

- 移植自 [Beautiful UI](https://www.beautifului.dev)（© 2026 Shane Levine，MIT）。
- 源码：`packages/tuffex/packages/components/src/inline-citation/`。

## 离线完整示例源码

- [InlineCitationInlineCitationDemo](../snapshot/apps/nexus/app/components/content/demos/InlineCitationInlineCitationDemo.vue.txt)
- [AiSuiteStreamingAnswerDemo](../snapshot/apps/nexus/app/components/content/demos/AiSuiteStreamingAnswerDemo.vue.txt)

## 离线类型与实现参考

- [inline-citation/index.ts](../snapshot/packages/tuffex/packages/components/src/inline-citation/index.ts.txt)
- [src/TxInlineCitation.vue](../snapshot/packages/tuffex/packages/components/src/inline-citation/src/TxInlineCitation.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/inline-citation/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
