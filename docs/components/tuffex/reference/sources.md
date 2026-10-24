# Sources

> 可折叠的引用来源列表

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/sources) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/sources.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/sources.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`SourcesSourcesDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const sources = [
  { id: 's1', url: 'https://vuejs.org/guide/introduction.html', title: 'Introduction', favicon: 'https://vuejs.org/logo.svg' },
  { id: 's2', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Clipboard' },
]

function openSource(source: { url: string }) {
  window.open(source.url, '_blank', 'noopener')
}
</script>

<template>
  <TxSources :sources="sources" @open="openSource" />
</template>
```

### 来源堆叠
`variant="stack"` 用前几条来源的站点图标替换头部的地球图标，折叠时也能看出引用了哪些站点。
官方示例：`AiSuiteStreamingAnswerDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSources
    :sources="sources"
    variant="stack"
    :label-formatter="(n) => `${n} 个来源`"
    @open="open"
  />
</template>
```

### 最佳实践

- 监听 `open`，否则点击引用没有任何反应。
- 桌面端在外部浏览器打开并带上 `noopener`，不要把应用窗口导航走。
- `id` 用稳定标识：图标失败记录按 `id` 保存，`id` 变化会让坏图重新加载。
- 中文界面覆盖 `labelFormatter`：默认文案是英文，并按英文单复数变形。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `sources` | `AiSourceItem[]` | — | 引用列表 `{ id, url, title?, favicon? }`，必填。 |
| `labelFormatter` | `(count: number) => string` | — | 折叠标题；缺省为 `Used N source(s)`。 |
| `defaultOpen` | `boolean` | `false` | 初始是否展开，只在挂载时读取。 |
| `variant` | `'default' \| 'stack'` | `'default'` | `stack` 用重叠的站点图标替换头部的地球图标。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `open` | `(source: AiSourceItem)` | 点击某条引用时触发；默认跳转已阻止，导航由宿主完成。 |

## 概述

- 点击时 `preventDefault()` 再派发 `open`；`href` 仍在 `<a>` 上，浏览器的「在新标签页打开」「复制链接地址」照常可用。
- `stack` 最多取前 3 条能显示图标的来源，一条都没有时回落到地球图标；图标加载失败的来源退出堆叠，由后面的补上。
- 堆叠图标的描边取 `--tx-sources-stack-ring`（默认为页面底色）；头部不在页面底色上时，改指向所在容器的底色。
- `title` 为空时显示去掉 `www.` 的域名；`url` 无法解析时显示原文。
- 图标加载失败会被记下，不再重复请求。
- 列表是 `<ol>`，序号来自渲染顺序；图标带 `alt=""` 与 `aria-hidden`，可访问名称由标题与域名承载。

## 离线完整示例源码

- [SourcesSourcesDemo](../snapshot/apps/nexus/app/components/content/demos/SourcesSourcesDemo.vue.txt)
- [AiSuiteStreamingAnswerDemo](../snapshot/apps/nexus/app/components/content/demos/AiSuiteStreamingAnswerDemo.vue.txt)

## 离线类型与实现参考

- [sources/index.ts](../snapshot/packages/tuffex/packages/components/src/sources/index.ts.txt)
- [src/TxSources.vue](../snapshot/packages/tuffex/packages/components/src/sources/src/TxSources.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
