# Stream Markdown

> 面向流式输出的 Markdown 渲染器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/stream-markdown) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/stream-markdown.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/stream-markdown.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
流式期间，未闭合的尾部围栏推迟渲染，不会以半截形态闪现。
官方示例：`StreamMarkdownStreamMarkdownDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import ChartBlock from './ChartBlock.vue'

const content = ref('# 标题\n\n正在生成…')
</script>

<template>
  <TxStreamMarkdown
    :content="content"
    streaming
    :renderers="{ chart: ChartBlock }"
  />
</template>
```

### 最佳实践

- 不要关闭 `sanitize`：模型输出是不可信内容，这里是它变成 DOM 的地方。
- 生成结束后把 `streaming` 置为 `false`，否则光标一直留在末尾。
- 自定义渲染器在 `closed` 为 `false` 时显示加载态，不解析半截内容。
- `renderers` 的 key 用围栏首个单词的小写形式（` ```chart ` → `chart`）。
- 非英文界面除了图片与表格文案，代码块和图表的文案也要一并传入：内置的块会显示它们，默认是英文。
- 静态 Markdown 用 `TxMarkdownView`，不需要这套分块与光标机制。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `content` | `string` | — | Markdown 原文，必填。 |
| `streaming` | `boolean` | `false` | 仍在输出；控制光标、显影与尾部围栏的延迟渲染。 |
| `reveal` | `'aurora' \| 'hue' \| 'blur' \| 'languid' \| 'none'` | `'aurora'` | 新文字的进场方式，预设同 `TxStreamText`；`languid` 只保留缓慢模糊，不上浮。 |
| `caret` | `boolean` | `true` | `streaming` 时在写入位置显示 Tuff 光标；关闭时立即移除。 |
| `sanitize` | `boolean` | `true` | 用 DOMPurify 净化 HTML。 |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | 配色主题；`auto` 跟随环境。 |
| `renderers` | `Record<string, StreamMarkdownBlockRenderer>` | — | 按围栏语言替换块渲染组件，组件以 props 接收 `StreamMarkdownBlockContext`。 |
| `blockRemoteImages` | `boolean` | `true` | 远程图片（`http(s)://`、`//`）先显示占位块，读者确认后才加载。 |
| `blockedImageText` | `string` | `'Remote image blocked'` | 图片占位块的标题。 |
| `loadImageOnceText` | `string` | `'Load this image'` | 只加载这一张图片的按钮文字。 |
| `allowSessionImagesText` | `string` | `'Allow for this conversation'` | 放行本次会话全部远程图片的按钮文字。 |
| `copyTableText` | `string` | `'Copy CSV'` | 表格「复制为 CSV」按钮的文字。 |
| `copiedTableText` | `string` | `'Copied'` | 复制成功后按钮短暂显示的文字。 |
| `codePreviewText` | `string` | `'Preview'` | 代码块中把 HTML、SVG、XML 渲染出来查看的按钮文字。 |
| `codeSourceText` | `string` | `'Code'` | 预览显示时同一按钮的文字，点击回到源码。 |
| `codeFrameLabelFormatter` | `(lang: string) => string` | `` (lang) => `${lang} preview` `` | 由围栏语言生成预览框的可访问名称。 |
| `copyCodeText` | `string` | `'Copy'` | 代码块复制按钮的文字。 |
| `copiedCodeText` | `string` | `'Copied'` | 复制成功后按钮短暂显示的文字。 |
| `diagramZoomLabel` | `string` | `'Zoom diagram'` | 渲染好的图表（点击打开预览）的可访问名称。 |
| `diagramPreviewLabel` | `string` | `'Diagram preview'` | 图表全屏预览的可访问名称。 |
| `diagramCloseLabel` | `string` | `'Close preview'` | 预览关闭按钮的可访问名称。 |
| `diagramErrorText` | `string` | `'Diagram failed to render — showing source.'` | 图表渲染失败、改为显示源码时，源码上方的提示。 |

### TxCodeBlock 属性

没有专属渲染器的语言都由它渲染；它也单独导出，可在文档之外展示代码。它以 props 接收 `StreamMarkdownBlockContext`；在 `TxStreamMarkdown` 里，文案来自 `code*` 系列属性与 `copyCodeText` / `copiedCodeText`。

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `previewable` | `boolean` | `true` | 已闭合的 HTML、SVG、XML 围栏提供渲染预览。 |
| `previewLabel` | `string` | `'Preview'` | 切换到渲染预览的按钮文字。 |
| `codeLabel` | `string` | `'Code'` | 预览显示时同一按钮的文字。 |
| `frameLabelFormatter` | `(lang: string) => string` | `` (lang) => `${lang} preview` `` | 由围栏语言生成预览框的可访问名称。 |
| `copyLabel` | `string` | `'Copy'` | 复制按钮的文字。 |
| `copiedLabel` | `string` | `'Copied'` | 复制成功后按钮短暂显示的文字。 |

### TxMermaidBlock 属性

内置的 `mermaid` 渲染器，同样以 props 接收 `StreamMarkdownBlockContext`；在 `TxStreamMarkdown` 里，文案来自 `diagram*` 系列属性与 `copyCodeText` / `copiedCodeText`。

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `zoomLabel` | `string` | `'Zoom diagram'` | 渲染好的图表（点击打开预览）的可访问名称。 |
| `previewLabel` | `string` | `'Diagram preview'` | 全屏预览的可访问名称。 |
| `closeLabel` | `string` | `'Close preview'` | 预览关闭按钮的可访问名称。 |
| `errorText` | `string` | `'Diagram failed to render — showing source.'` | 图表渲染失败、改为显示源码时，源码上方的提示。 |
| `copyLabel` | `string` | `'Copy'` | 渲染失败后所显示源码的复制按钮文字。 |
| `copiedLabel` | `string` | `'Copied'` | 复制成功后按钮短暂显示的文字。 |

## 概述

- 文档按块渲染：追加文本不会重排整篇。
- 流式中仍在增长的尾部围栏推迟到闭合后再渲染最终形态；渲染器收到的 `closed` 只对它为 `false`。
- 未注册的语言走内置渲染：`mermaid` 用 `TxMermaidBlock`，其余用 `TxCodeBlock`。
- 光标同 `TxStreamText`：尾部是段落、标题或引用时紧跟末字符，否则单独位于下方一行；减弱动效时不播放进场，光标静止。
- DOMPurify 动态加载；`sanitize` 开启时，加载完成前或加载失败时不渲染任何内容。净化不能替代服务端的信任边界。
- 图片放行记录是模块级的，所有实例共享；切换会话时调用导出的 `resetRemoteImagePolicy()` 清除。
- 每个实例持有自己的 `Marked`（`gfm`、`breaks`）；GitHub Markdown 样式表限定在 `:where(.tx-md)` 下，不会改写宿主的 `.markdown-body`。

## 离线完整示例源码

- [StreamMarkdownStreamMarkdownDemo](../snapshot/apps/nexus/app/components/content/demos/StreamMarkdownStreamMarkdownDemo.vue.txt)

## 离线类型与实现参考

- [stream-markdown/index.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/index.ts.txt)
- [src/TxCodeBlock.vue](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/TxCodeBlock.vue.txt)
- [src/TxMermaidBlock.vue](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/TxMermaidBlock.vue.txt)
- [src/TxStreamMarkdown.vue](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/TxStreamMarkdown.vue.txt)
- [src/complete-inline-markup.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/complete-inline-markup.ts.txt)
- [src/harden-html.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/harden-html.ts.txt)
- [src/math-extension.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/math-extension.ts.txt)
- [src/remote-image-policy.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/remote-image-policy.ts.txt)
- [src/shiki-runtime.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/shiki-runtime.ts.txt)
- [src/table-csv.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/table-csv.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/types.ts.txt)
- [src/use-auto-theme.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/use-auto-theme.ts.txt)
- [src/use-block-stream.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/use-block-stream.ts.txt)
- [src/use-fresh-chunks.ts](../snapshot/packages/tuffex/packages/components/src/stream-markdown/src/use-fresh-chunks.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
