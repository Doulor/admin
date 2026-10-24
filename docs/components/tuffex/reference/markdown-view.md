# MarkdownView Markdown 渲染

> GitHub 风格 Markdown 的渲染视图

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/markdown-view) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/markdown-view.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/markdown-view.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`content` 是唯一输入，按 GFM 解析。
官方示例：`MarkdownViewMarkdownViewDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const content = '# 发布说明\n\n- 新增 API 表格\n- 保持默认 sanitize'
</script>

<template>
  <TxMarkdownView :content="content" />
</template>
```

### 丰富 Markdown
官方示例：`MarkdownViewMarkdownDemo`（完整源码见本页末尾）

````vue
<script setup lang="ts">
const richContent = [
  '# 文档片段',
  '',
  '- [x] 已完成任务',
  '- [ ] 待处理任务',
  '',
  '| 功能 | 状态 |',
  '| --- | --- |',
  '| 表格 | 支持 |',
  '',
  '```ts',
  'export const ok = true',
  '```',
].join('\n')
</script>

<template>
  <TxMarkdownView :content="richContent" />
</template>
````

### 主题
`theme` 固定亮色或暗色；`auto` 跟随文档主题。
官方示例：`MarkdownViewLightDarkDemo`（完整源码见本页末尾）

```vue
<template>
  <TxMarkdownView :content="richContent" theme="light" />
  <TxMarkdownView :content="richContent" theme="dark" />
</template>
```

### 最佳实践

- 用户生成、远程加载或插件提供的内容保持 `sanitize` 开启。
- 传入已标准化的 Markdown；除非明确依赖 Markdown HTML，不要混入半转义的 HTML。
- 预览、卡片等不跟随文档主题的表面显式设置 `theme`。
- 只用于展示；需要编辑时在外部组合编辑器或 textarea。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `content` | `string` | 必填 | Markdown 源字符串。 |
| `sanitize` | `boolean` | `true` | 用 DOMPurify 清洗输出；加载完成前不渲染。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `auto` 从文档的 `data-theme` 或主题 class 推导，无法识别时为 `light`。 |

## 概述

- 用 `marked` 解析，开启 `gfm` 与 `breaks`（单个换行即换行）。
- `sanitize=true` 时 DOMPurify 就绪前不渲染；其动态导入失败则渲染空内容。
- `sanitize=false` 时输出直接经 `v-html` 写入，只用于可信内容。
- `theme="auto"` 读取并监听 `html` 与 `body` 的 `data-theme` 及 `light` / `dark` class。
- 外层容器带解析后的 `light` / `dark` class 与同值的 `data-theme`。

## 技术实现

- 内置的 `github-markdown.css` 全局引入并与 `TxStreamMarkdown` 共用，每条规则限定在 `:where(.tx-markdown-view, .tx-stream-md)` 下，不影响宿主自己的 `.markdown-body`；重新引入上游版本时保留该限定。
- 源码：`packages/tuffex/packages/components/src/markdown-view/`。

## 离线完整示例源码

- [MarkdownViewMarkdownViewDemo](../snapshot/apps/nexus/app/components/content/demos/MarkdownViewMarkdownViewDemo.vue.txt)
- [MarkdownViewMarkdownDemo](../snapshot/apps/nexus/app/components/content/demos/MarkdownViewMarkdownDemo.vue.txt)
- [MarkdownViewLightDarkDemo](../snapshot/apps/nexus/app/components/content/demos/MarkdownViewLightDarkDemo.vue.txt)

## 离线类型与实现参考

- [markdown-view/index.ts](../snapshot/packages/tuffex/packages/components/src/markdown-view/index.ts.txt)
- [src/TxMarkdownView.vue](../snapshot/packages/tuffex/packages/components/src/markdown-view/src/TxMarkdownView.vue.txt)
- [src/github-markdown.css](../snapshot/packages/tuffex/packages/components/src/markdown-view/src/github-markdown.css.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/markdown-view/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
