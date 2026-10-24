# IconPicker

> 选取图标并返回标识符字符串的选择器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/icon-picker) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/icon-picker.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/icon-picker.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 触发器与内联
`inline` 直接渲染面板，`sections` 限定开放的分区。
官方示例：`IconPickerIconPickerDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import type { IconPickerShape } from '@talex-touch/tuffex/icon-picker'
import { TxIconPicker } from '@talex-touch/tuffex/icon-picker'
import { ref } from 'vue'

const identifier = ref('emoji:🚀')
const shape = ref<IconPickerShape>('rounded')
</script>

<template>
  <TxIconPicker v-model="identifier" v-model:shape="shape" shape-selectable />
  <TxIconPicker v-model="identifier" inline :sections="['ai', 'icon', 'brand']" />
</template>
```

### 最佳实践

- 原样存储标识符，渲染时用 `parseIconIdentifier` 解析；不要拆成两列，否则两列可能互相矛盾。
- 只读取存量值的模块从 `@talex-touch/tuffex/icon-picker` 单独引入 `parseIconIdentifier`，不必加载面板。
- 收窄 `sections` 时，若用户要选模型厂商，记得保留 `ai`：厂商标志与 AI 图形都在这个分区，不在品牌或图标里。
- 宿主自己画底板时关闭 `shapeSelectable`，否则用户选中的形状看不到。
- 展示小图标底板用 `TxIconChip`；本组件只负责选择。

## API 参考

### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `string` | `''` | 图标标识符，配合 `v-model`。 |
| `shape` | `IconPickerShape` | `'rounded'` | 底板形状，配合 `v-model:shape`；全部十二种见 `ICON_PICKER_SHAPES`。 |
| `sections` | `IconPickerSection[]` | 五个分区 | 开放的分区，按标签顺序：`emoji`、`icon`、`brand`、`ai`，`file` 显示为选择文件的按钮。 |
| `catalog` | `Partial<Record<IconPickerCatalogSection, IconPickerEntry[]>>` | - | 替换分区的内置行；条目的 `category` 决定它归在哪个分组标题下。 |
| `shapeSelectable` | `boolean` | `true` | 显示形状选择行；宿主自己画底板时关闭。 |
| `fileChooser` | `() => Promise<string \| null>` | - | 宿主的文件对话框，返回绝对路径，取消时为 `null`。 |
| `accept` | `string` | `'image/*'` | 文件对话框与回退 input 的接受列表。 |
| `disabled` | `boolean` | `false` | 禁用触发器与面板。 |
| `size` | `number` | `44` | 触发器底板边长（px）。 |
| `placeholder` | `string` | `''` | 触发器的 `aria-label`；为空时使用搜索文案。 |
| `inline` | `boolean` | `false` | 直接渲染面板，不收在触发器后。 |
| `labels` | `Partial<IconPickerLabels>` | 英文默认值 | 分区、形状与分类名称，搜索占位，以及各操作文案。 |

### 事件

| 事件 | 载荷 | 说明 |
|------|------|------|
| `update:modelValue` | `string` | 选中图标时触发，清除时为 `''`。 |
| `update:shape` | `IconPickerShape` | 形状变化时触发。 |
| `change` | `string` | 与 `update:modelValue` 同时触发。 |
| `file-error` | `unknown` | 文件选择器抛错或回退 input 读取失败时触发。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `toggle(value?)` | `(value?: boolean) => void` | 按 `value` 打开或关闭面板，省略时切换；`inline` 面板始终显示。 |

## 标识符

选中结果是 `<type>:<value>` 字符串。以**第一个**冒号分隔，value 中可再含冒号（`url:`、Windows 的 `file:C:/…`）。

```
emoji:🚀
class:i-ri-rocket-line
file:/Users/me/a.png
url:https://example.com/y.svg
builtin:star
```

`parseIconIdentifier` 与 `formatIconIdentifier` 负责双向转换。不带前缀的字符串不做猜测，返回 `null`；唯一例外是纯表情。

```ts
import { parseIconIdentifier } from '@talex-touch/tuffex/icon-picker'

parseIconIdentifier('class:i-ri-rocket-line') // { type: 'class', value: 'i-ri-rocket-line' }
parseIconIdentifier('rocket.png')             // null
parseIconIdentifier('🚀')                      // { type: 'emoji', value: '🚀' }
```

## 在选择器外渲染

选择器用随包附带的路径数据绘制内置类名，网格不依赖宿主的图标 CSS。离开选择器后，选中的 `class:` 值只是一个类名：通过 `classGlyph` 把选择器的字形交给 `TxIcon`，或在宿主的原子化 CSS 引擎里把 `ICON_CATALOG_CLASSES` 加入 safelist。

```ts
import { TX_ICON_CONFIG_KEY } from '@talex-touch/tuffex'
import { resolveIconPickerGlyph } from '@talex-touch/tuffex/icon-picker'

app.provide(TX_ICON_CONFIG_KEY, { classGlyph: resolveIconPickerGlyph })
```

```ts
import { ICON_CATALOG_CLASSES } from '@talex-touch/tuffex/icon-picker'

export default defineConfig({
  safelist: [...ICON_CATALOG_CLASSES],
})
```

## 概述

- 搜索同时覆盖所有分区，当前标签页的结果在前；匹配关键词、类名与分类标题，容忍一处拼写错误，也接受中文、全拼与首字母（`火箭`、`huojian`、`hj`）。
- 焦点始终留在搜索框：方向键在网格中移动，Enter 选中高亮的格子（搜索时选第一条结果），Esc 先清空搜索词，再关闭面板。
- 浏览时按分类分组，顶部的快捷行可在分类间跳转。
- 触发器在形状之间做轮廓变形；开启减弱动态效果时直接切换。
- 文件分区由宿主提供能力：传入 `fileChooser`（如 Electron 的 `dialog.showOpenDialog` 桥接）；未传时回退到隐藏的 `<input type="file">`，结果为 data URL。
- `shape` 只是表现，单独存储，不属于标识符。

## 技术实现

- 字形路径数据由 `scripts/generate-icon-picker-data.mjs` 生成，按分区在首次展示时加载；底板变形复用 TxIconMorph 的引擎。
- Remix Icon 4.8.0 数据随 Apache-2.0 许可分发（`REMIXICON-LICENSE`），Simple Icons 数据为 CC0-1.0；品牌标志仍是各自所有者的商标。
- 源码：`packages/tuffex/packages/components/src/icon-picker/`。

## 离线完整示例源码

- [IconPickerIconPickerDemo](../snapshot/apps/nexus/app/components/content/demos/IconPickerIconPickerDemo.vue.txt)

## 离线类型与实现参考

- [icon-picker/index.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/index.ts.txt)
- [src/TxIconPicker.vue](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/TxIconPicker.vue.txt)
- [src/TxIconPickerPanel.vue](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/TxIconPickerPanel.vue.txt)
- [src/catalog-ai.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/catalog-ai.ts.txt)
- [src/catalog-brand.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/catalog-brand.ts.txt)
- [src/catalog-emoji.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/catalog-emoji.ts.txt)
- [src/catalog-entry.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/catalog-entry.ts.txt)
- [src/catalog-icon.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/catalog-icon.ts.txt)
- [src/catalog.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/catalog.ts.txt)
- [generated/chunks.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/chunks.ts.txt)
- [generated/glyphs-ai-1.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-ai-1.ts.txt)
- [generated/glyphs-ai-2.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-ai-2.ts.txt)
- [generated/glyphs-brand-1.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-brand-1.ts.txt)
- [generated/glyphs-brand-2.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-brand-2.ts.txt)
- [generated/glyphs-brand-3.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-brand-3.ts.txt)
- [generated/glyphs-icon-1.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-icon-1.ts.txt)
- [generated/glyphs-icon-2.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/glyphs-icon-2.ts.txt)
- [generated/pinyin.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/pinyin.ts.txt)
- [generated/shapes.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/generated/shapes.ts.txt)
- [src/glyphs.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/glyphs.ts.txt)
- [src/identifier.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/identifier.ts.txt)
- [src/search.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/search.ts.txt)
- [src/shapes.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/shapes.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/icon-picker/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
