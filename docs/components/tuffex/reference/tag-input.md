# TagInput 标签输入

> 以回车或分隔符录入标签的输入框

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tag-input) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tag-input.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tag-input.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`TagInputTagInputDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const tags = ref(['Design', 'Docs'])
</script>

<template>
  <TxTagInput v-model="tags" placeholder="输入标签后回车" />
</template>
```

### 发布策略配置
`TxTagInput` 承载检索用的元数据，`max` 限制数量。
官方示例：`ComponentsReleasePolicyDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const riskSegments = [
  { value: 1, label: '低' },
  { value: 2, label: '中' },
  { value: 3, label: '高' },
  { value: 4, label: '冻结' },
]
</script>

<template>
  <TxCascader v-model="releasePath" :options="scopeOptions" placeholder="发布范围" />
  <TxFlatSelect v-model="rolloutMode" placeholder="发布模式">
    <TxFlatSelectItem value="phased" label="分阶段" />
    <TxFlatSelectItem value="guarded" label="护栏发布" />
  </TxFlatSelect>
  <TxSegmentedSlider v-model="riskLevel" :segments="riskSegments" />
  <TxSlider v-model="traffic" :min="5" :max="100" :step="5" show-value :format-value="value => value + '%'" />
  <TxTagInput v-model="labels" placeholder="输入标签后回车" :max="5" />
</template>
```

### 最佳实践

- 标签只放短元数据；发布备注、审批原因等长文本用文本域或详情表单。
- `max` 设为流程真正需要的最小值。
- 除非重复标签有业务含义，否则保持 `allowDuplicates` 关闭。
- 帮助文案里提到的分隔符都写进 `separators`。
- 说明、帮助与校验提示放在组件外层。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `modelValue` | `string[]` | `[]` | 标签列表，也是唯一数据源；每次增删都以新数组派发更新。 |
| `placeholder` | `string` | `'Add tag'` | 占位文本。 |
| `disabled` | `boolean` | `false` | 禁止增删，已有标签的关闭按钮也失效。 |
| `max` | `number` | `20` | 标签数量上限；达到后输入框禁用、占位文本隐藏。 |
| `allowDuplicates` | `boolean` | `false` | 允许重复；关闭时按 trim 后精确匹配去重，区分大小写。 |
| `separators` | `string[]` | `[',']` | 拆分粘贴或键入文本的分隔符。 |
| `confirmOnBlur` | `boolean` | `true` | 失焦时提交未确认的输入。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(tags: string[])` | 携带下一份完整列表触发。 |
| `change` | `(tags: string[])` | 与 `update:modelValue` 同时触发。 |
| `add` | `(tags: string[])` | 携带本次实际加入的标签触发。 |
| `remove` | `(tag: string)` | 携带被移除的标签触发。 |
| `focus` | `(event: FocusEvent)` | 透传输入框的 focus。 |
| `blur` | `(event: FocusEvent)` | 透传输入框的 blur。 |

## 概述

- 输入先 trim，空标签被忽略。
- `separators` 拆分粘贴或键入的文本；Enter 始终确认当前输入。
- `confirmOnBlur` 开启时，先派发 `blur`，再提交未确认的输入。
- 输入框为空时，Backspace 移除最后一个标签。

## 技术实现

- 已有标签由 `TxTag` 渲染。
- 源码：`packages/tuffex/packages/components/src/tag-input/`；导出类型 `TagInputProps`、`TagInputEmits`。

## 离线完整示例源码

- [TagInputTagInputDemo](../snapshot/apps/nexus/app/components/content/demos/TagInputTagInputDemo.vue.txt)
- [ComponentsReleasePolicyDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsReleasePolicyDemo.vue.txt)

## 离线类型与实现参考

- [tag-input/index.ts](../snapshot/packages/tuffex/packages/components/src/tag-input/index.ts.txt)
- [src/TxTagInput.vue](../snapshot/packages/tuffex/packages/components/src/tag-input/src/TxTagInput.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/tag-input/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
