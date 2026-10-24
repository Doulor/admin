# FlatRadio 平铺选择器

> 在 2–5 个选项间平铺选择的分段控件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/flat-radio) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/flat-radio.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/flat-radio.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`FlatRadioBasicDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref<'light' | 'dark' | 'auto'>('light')
</script>

<template>
  <TxFlatRadio v-model="value">
    <TxFlatRadioItem value="light" label="Light" />
    <TxFlatRadioItem value="dark" label="Dark" />
    <TxFlatRadioItem value="auto" label="Auto" />
  </TxFlatRadio>
</template>
```

### 禁用
`disabled` 可设在整组或单项上。
官方示例：`FlatRadioDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatRadio v-model="value">
    <TxFlatRadioItem value="a" label="Option A" />
    <TxFlatRadioItem value="b" label="Option B" disabled />
    <TxFlatRadioItem value="c" label="Option C" />
  </TxFlatRadio>

  <TxFlatRadio v-model="value" disabled>
    <TxFlatRadioItem value="a" label="Option A" />
    <TxFlatRadioItem value="b" label="Option B" />
  </TxFlatRadio>
</template>
```

### 尺寸
`size` 可选 `sm`、`md`（默认）、`lg`、`xl`。
官方示例：`FlatRadioSizesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatRadio v-for="size in ['sm', 'md', 'lg', 'xl']" :key="size" v-model="value" :size="size">
    <TxFlatRadioItem value="a" label="Option A" />
    <TxFlatRadioItem value="b" label="Option B" />
    <TxFlatRadioItem value="c" label="Option C" />
  </TxFlatRadio>
</template>
```

### 图标
`icon` 接收图标 class，例如 UnoCSS 图标。
官方示例：`FlatRadioIconDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatRadio v-model="view">
    <TxFlatRadioItem value="grid" icon="i-carbon-grid" label="Grid" />
    <TxFlatRadioItem value="list" icon="i-carbon-list" label="List" />
    <TxFlatRadioItem value="kanban" icon="i-carbon-column" label="Kanban" />
  </TxFlatRadio>
</template>
```

### 边框
官方示例：`FlatRadioBorderedDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatRadio v-model="value" bordered>
    <TxFlatRadioItem value="a" label="Option A" />
    <TxFlatRadioItem value="b" label="Option B" />
    <TxFlatRadioItem value="c" label="Option C" />
  </TxFlatRadio>
</template>
```

### 多选
`multiple` 时值为数组，各项像复选框一样切换，不显示滑块。
官方示例：`FlatRadioMultipleDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref(['mention', 'reply'])
</script>

<template>
  <TxFlatRadio v-model="value" multiple>
    <TxFlatRadioItem value="mention" label="Mention" icon="i-carbon-at" />
    <TxFlatRadioItem value="reply" label="Reply" icon="i-carbon-reply" />
    <TxFlatRadioItem value="archive" label="Archive" icon="i-carbon-archive" />
    <TxFlatRadioItem value="mute" label="Mute" icon="i-carbon-volume-mute" />
  </TxFlatRadio>
</template>
```

### 键盘导航
容器获得焦点后响应下表按键。
官方示例：`FlatRadioKeyboardDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatRadio v-model="single">
    <TxFlatRadioItem value="overview" label="Overview" />
    <TxFlatRadioItem value="activity" label="Activity" />
    <TxFlatRadioItem value="settings" label="Settings" />
  </TxFlatRadio>

  <TxFlatRadio v-model="channels" multiple>
    <TxFlatRadioItem value="email" label="Email" />
    <TxFlatRadioItem value="push" label="Push" />
    <TxFlatRadioItem value="sms" label="SMS" />
  </TxFlatRadio>
</template>
```

| 按键 | 行为 |
|------|------|
| `→` / `↓` | 下一个非禁用项（循环） |
| `←` / `↑` | 上一个非禁用项（循环） |
| `Home` | 第一个非禁用项 |
| `End` | 最后一个非禁用项 |
| `Enter` / `Space` | 多选时切换当前项 |

### 最佳实践

- 用于 2–5 个需要直接比较的短选项（标签不换行）；更多选项用 `TxSelect`。
- 页面上的主选择用 `xl`；行内与工具栏保持默认 `md`。
- 自定义插槽内容不要只在选中时加粗：每一项本就带选中字重，再加粗会引起重排。
- 只有各值相互独立时才用 `multiple`；否则用开关或复选框。
- `value` 在渲染间保持稳定：父级按 value 注册项，用于滑块定位与键盘顺序。

## API 参考

### TxFlatRadio

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `modelValue` / `v-model` | `string \| number \| (string \| number)[]` | *必填* | 单选为单值，多选为数组。 |
| `multiple` | `boolean` | `false` | 多选：各项像复选框一样切换，不显示滑块。 |
| `disabled` | `boolean` | `false` | 禁用整组，移出 Tab 序列并阻止变更。 |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 尺寸。 |
| `bordered` | `boolean` | `false` | 添加外边框。 |

#### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `(value: string \| number \| (string \| number)[]) => void` | 选择变化后触发，参数为新值。 |
| `change` | `(value: string \| number \| (string \| number)[]) => void` | 与 `update:modelValue` 同时触发。 |

#### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | `TxFlatRadioItem` 子项。 |

### TxFlatRadioItem

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `value` | `string \| number` | *必填* | 项的值，注册到父级。 |
| `label` | `string` | - | 无默认插槽时显示的文本。 |
| `icon` | `string` | - | 无 `icon` 插槽时使用的图标 class。 |
| `disabled` | `boolean` | `false` | 禁用该项，键盘导航时跳过。 |

#### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | 自定义内容，替代 `label`。 |
| `icon` | 自定义图标，替代 `icon`。 |

## 概述

- 单选时容器为 `role="radiogroup"`、项为 `role="radio"`；多选时为 `role="group"` 与 `role="checkbox"`。
- 只有容器进入 Tab 序列，项保持 `tabindex="-1"`；用相邻字段文案或外部 label 为整组命名。
- 单选时方向键直接选中；多选时方向键只移动焦点，Enter / Space 切换。
- 滑块从不缩放：挂载、尺寸变化与注册新项时直接落位，选中新项时滑过去，两端不越出轨道。
- 按压只缩放文字与图标，不缩放项本身。
- 减少动态效果时，滑块直接落位并去掉按压缩放，保留淡入。

## 技术实现

- 滑块由共享的 `useJellyIndicator` 滑行材质驱动（与 `TxTabs`、`TxTabBar`、`TxSidebarNav` 相同），每帧直接写 `transform`、`width`、`opacity`，不触发重渲染。
- 源码：`packages/tuffex/packages/components/src/flat-radio/`。



## 自定义

| CSS 变量 | 用途 |
|----------|------|
| `--tx-flat-radio-track-bg` | 轨道底色，默认 `--tx-fill-color`。 |
| `--tx-flat-radio-indicator-bg` | 滑块与多选项底色，默认 `--tx-surface-raised`。 |
| `--tx-flat-radio-indicator-shadow` | 滑块投影。 |

## 离线完整示例源码

- [FlatRadioBasicDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioBasicDemo.vue.txt)
- [FlatRadioDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioDisabledDemo.vue.txt)
- [FlatRadioSizesDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioSizesDemo.vue.txt)
- [FlatRadioIconDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioIconDemo.vue.txt)
- [FlatRadioBorderedDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioBorderedDemo.vue.txt)
- [FlatRadioMultipleDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioMultipleDemo.vue.txt)
- [FlatRadioKeyboardDemo](../snapshot/apps/nexus/app/components/content/demos/FlatRadioKeyboardDemo.vue.txt)

## 离线类型与实现参考

- [flat-radio/index.ts](../snapshot/packages/tuffex/packages/components/src/flat-radio/index.ts.txt)
- [src/TxFlatRadio.vue](../snapshot/packages/tuffex/packages/components/src/flat-radio/src/TxFlatRadio.vue.txt)
- [src/TxFlatRadioItem.vue](../snapshot/packages/tuffex/packages/components/src/flat-radio/src/TxFlatRadioItem.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/flat-radio/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
