# VersionCapsule 版本胶囊

> 左半下载构建、右半打开历史的分段版本胶囊

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/version-capsule) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/version-capsule.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/version-capsule.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 下载与历史
`download` 与 `history` 插槽分别放入两个面板；插槽参数 `close` 关闭面板并交还焦点。
官方示例：`VersionCapsuleVersionCapsuleDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const panel = ref<'download' | 'history' | null>('download')
const notice = { tone: 'warning', title: '预发布通道构建', points: ['功能可能随时调整'] }
const builds = [
  { id: 'mac-arm', name: 'macOS · Apple 芯片', meta: '.dmg · 126 MB', href: '#mac-arm', recommended: true },
  { id: 'win', name: 'Windows · x64', meta: '.exe · 118 MB', href: '#win' },
]
const latest = { id: '1', tag: 'v2.4.13-beta.19', channel: 'BETA', tone: 'preview', date: '7 月 21 日', note: '图标自愈' }
const entries = [{ id: '2', tag: 'v2.4.12', channel: 'RELEASE', tone: 'stable', date: '7 月 12 日', href: '#v2412' }]
</script>

<template>
  <TxVersionCapsule v-model:panel="panel" version="v2.4.13-beta.19" channel="BETA" tone="preview">
    <template #download="{ close }">
      <TxVersionDownloadPanel :notice="notice" :builds="builds" @select="close" />
    </template>
    <template #history="{ close }">
      <TxVersionHistoryPanel :latest="latest" :entries="entries" count-label="共 6 个版本" @select="close" />
    </template>
  </TxVersionCapsule>
</template>
```

### 通道色调
`tone` 决定状态点与通道颜色。
官方示例：`VersionCapsuleChannelTonesDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const capsules = [
  { tone: 'stable', version: 'v2.4.12', channel: '稳定版' },
  { tone: 'preview', version: 'v2.4.13-beta.19', channel: '测试版' },
  { tone: 'nightly', version: 'v2.4.14-nightly.5', channel: '每日构建' },
  { tone: 'neutral', version: 'v1.9.8', channel: '已归档' },
]
</script>

<template>
  <TxVersionCapsule
    v-for="item in capsules"
    :key="item.tone"
    :version="item.version"
    :channel="item.channel"
    :tone="item.tone"
    history-label="历史版本"
  >
    <template #history="{ close }">
      <TxVersionHistoryPanel :latest="{ id: item.tone, tag: item.version, channel: item.channel, tone: item.tone }" @select="close" />
    </template>
  </TxVersionCapsule>
</template>
```

### 最佳实践

- 始终标注通道（`BETA`、`STABLE`、`NIGHTLY`），不要写「LATEST」；胶囊配合页面的稳定版下载按钮，而不是取代它。
- 预发布注意事项放进下载面板的 `notice`（`warning`）；已认证构建用 `success`。
- 给构建设置 `href`，直接以 `<a download>` 下载；只有需要在 `select` 时解析地址才省略。
- 只把访客平台的构建标为 `recommended`。
- 让每个历史条目的 `tone` 与其通道一致；`note` 只用于 `latest`。

## API 参考

### TxVersionCapsule

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `version` | `string` | — （必填） | 标题位置的版本号，如 `v2.4.13-beta.19`。 |
| `channel` | `string` | - | 状态点旁的通道标签，如 `BETA`；不设置则不显示。 |
| `tone` | `TxVersionChannelTone` | `'preview'` | 状态点与通道标签的颜色。 |
| `historyLabel` | `string` | `'History'` | 右侧分段的文案。 |
| `downloadLabel` | `string` | `'Download this build'` | 左侧分段的无障碍名称。 |
| `panel` | `TxVersionCapsulePanel` | - | 受控的打开面板，配合 `v-model:panel`；省略即非受控。 |
| `disabled` | `boolean` | `false` | 禁用两个分段，并关闭已打开的面板。 |
| `closeOnClickOutside` | `boolean` | `true` | 外部 `pointerdown` 时关闭面板。 |
| `closeOnEsc` | `boolean` | `true` | 按 Escape 关闭面板。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:panel` | `(value: TxVersionCapsulePanel)` | 打开的面板变化时触发。 |
| `download` | - | 激活左侧分段时触发。 |
| `history` | - | 激活右侧分段时触发。 |

#### 插槽

| 插槽 | 参数 | 说明 |
|------|-------|-------------|
| `download` | `{ close: () => void }` | 下载面板内容，锚定在左侧分段下方。 |
| `history` | `{ close: () => void }` | 历史面板内容，锚定在右侧分段下方。 |

#### 暴露方法

| 成员 | 类型 | 说明 |
|------|------|------|
| `close` | `() => void` | 关闭面板并把焦点交还给对应分段；也传给两个插槽。 |
| `downloadRef` | `Ref<HTMLButtonElement \| null>` | 左侧分段的按钮元素。 |
| `historyRef` | `Ref<HTMLButtonElement \| null>` | 右侧分段的按钮元素。 |

### TxVersionDownloadPanel

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `notice` | `TxVersionNotice` | - | 构建列表上方的信任提示；省略则只显示列表。 |
| `builds` | `TxVersionBuild[]` | `[]` | 各平台的构建。 |
| `buildsLabel` | `string` | `'Choose a build'` | 构建列表上方的小标题。 |
| `downloadLabel` | `string` | `'Download'` | 推荐构建按钮上的文案。 |
| `emptyText` | `string` | `'No builds published yet.'` | `builds` 为空时显示。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `select` | `(id: string)` | 选择构建时触发，参数为其 `id`。 |

#### 插槽

| 插槽 | 参数 | 说明 |
|------|-------|-------------|
| `footer` | - | 构建列表下方的页脚。 |

### TxVersionHistoryPanel

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | `'Version history'` | 面板标题。 |
| `latest` | `TxVersionHistoryEntry` | - | 列表上方的精选卡片。 |
| `entries` | `TxVersionHistoryEntry[]` | `[]` | 精选卡片下方的历史行。 |
| `latestLabel` | `string` | `'LATEST'` | 精选卡片上的徽标。 |
| `countLabel` | `string` | - | 头部右侧文案，如 `6 releases`。 |
| `notesLabel` | `string` | `"What's new"` | 精选卡片上的行动文案。 |
| `emptyText` | `string` | `'No releases published yet.'` | 既无 `latest` 也无 `entries` 时显示。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `select` | `(entry: TxVersionHistoryEntry)` | 选择历史行或精选卡片时触发。 |

#### 插槽

| 插槽 | 参数 | 说明 |
|------|-------|-------------|
| `footer` | - | 历史列表下方的页脚。 |

### 类型

`TxVersionChannelTone` 为 `'stable' \| 'preview' \| 'nightly' \| 'neutral'`，分别对应 `success` / `primary`（默认） / `warning` / `secondary` 颜色。

#### TxVersionBuild

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 列表 key。 |
| `name` | `string` | 标题，如 `macOS · Apple 芯片`。 |
| `meta` | `string?` | 次要行，如 `.dmg · 126 MB`。 |
| `href` | `string?` | 直链；存在时渲染为 `<a download>`，否则为 `<button>`。 |
| `recommended` | `boolean?` | 访客平台的构建；只有第一个高亮并获得带文案的按钮。 |
| `icon` | `string?` | 名称前的图标 class，图标集由使用方提供。 |

#### TxVersionNotice

| 字段 | 类型 | 说明 |
|------|------|------|
| `tone` | `'warning' \| 'success'` | `warning`（默认）用于预发布，`success` 用于已认证构建。 |
| `title` | `string` | 提示标题。 |
| `description` | `string?` | 补充说明。 |
| `points` | `string[]?` | 要点列表。 |

#### TxVersionHistoryEntry

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 列表 key。 |
| `tag` | `string` | 版本号。 |
| `channel` | `string?` | 通道标签，如 `BETA`。 |
| `tone` | `TxVersionChannelTone?` | 该条目的色调，默认 `preview`。 |
| `date` | `string?` | 发布日期文案。 |
| `note` | `string?` | 单行更新摘要，只在 `latest` 上渲染。 |
| `href` | `string?` | 存在时行或卡片渲染为链接。 |

## 概述

- 两个分段是独立的点击目标：左半下载构建，右半打开历史。不要把整个胶囊包成一个动作。
- 同一时刻只打开一个面板；点另一分段切换面板，再点当前分段关闭。
- 面板锚定在各自分段下方（下载左对齐、历史右对齐），不是模态。
- `panel` 为 `undefined` 时非受控；`null` 是受控的「全部关闭」。
- 不提供某个插槽时，对应分段只派发事件、不弹出面板，适合宿主自带弹窗。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/version-capsule/`。

## 离线完整示例源码

- [VersionCapsuleVersionCapsuleDemo](../snapshot/apps/nexus/app/components/content/demos/VersionCapsuleVersionCapsuleDemo.vue.txt)
- [VersionCapsuleChannelTonesDemo](../snapshot/apps/nexus/app/components/content/demos/VersionCapsuleChannelTonesDemo.vue.txt)

## 离线类型与实现参考

- [version-capsule/index.ts](../snapshot/packages/tuffex/packages/components/src/version-capsule/index.ts.txt)
- [src/TxVersionCapsule.vue](../snapshot/packages/tuffex/packages/components/src/version-capsule/src/TxVersionCapsule.vue.txt)
- [src/TxVersionDownloadPanel.vue](../snapshot/packages/tuffex/packages/components/src/version-capsule/src/TxVersionDownloadPanel.vue.txt)
- [src/TxVersionHistoryPanel.vue](../snapshot/packages/tuffex/packages/components/src/version-capsule/src/TxVersionHistoryPanel.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/version-capsule/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
