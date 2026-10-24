# Textarea

> 带字数统计与状态样式的多行输入框

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/textarea) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/textarea.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/textarea.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.7`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`TextareaTextareaDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref('')
</script>

<template>
  <TxTextarea
    v-model="value"
    placeholder="记录这次发布审阅结论..."
    :max-length="160"
    show-count
    :status="value.trim() ? 'success' : 'error'"
  />
</template>
```

### 最佳实践

- 有长度上限的备注、摘要与 Prompt 搭配 `maxLength` 与 `showCount`。
- 普通表单保持 `resize="vertical"`；外层布局已控制高度时才用 `none`。
- `status` 只做视觉提示；标签、帮助与校验文案放在外层表单项。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` / `v-model` | `string` | `''` | 输入值。 |
| `placeholder` | `string` | `''` | 占位文本。 |
| `rows` | `number` | `4` | 原生行数。 |
| `disabled` | `boolean` | `false` | 原生禁用态。 |
| `readonly` | `boolean` | `false` | 原生只读态。 |
| `maxLength` | `number` | - | 原生最大长度，也是计数的分母。 |
| `showCount` | `boolean` | `false` | 显示字数；有 `maxLength` 时格式为 `current/max`。 |
| `resize` | `'none' \| 'vertical' \| 'horizontal' \| 'both'` | `'vertical'` | CSS `resize` 行为。 |
| `status` | `'default' \| 'success' \| 'error'` | `'default'` | 视觉校验状态。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value: string)` | 输入时触发。 |
| `input` | `(value: string)` | 与 `update:modelValue` 同时触发。 |
| `focus` | `(event: FocusEvent)` | 原生 focus 事件。 |
| `blur` | `(event: FocusEvent)` | 原生 blur 事件。 |

### 暴露方法

| 方法 | 说明 |
|------|------|
| `focus()` | 聚焦原生 textarea。 |
| `blur()` | 使原生 textarea 失焦。 |
| `textareaRef` | 原生 textarea 的 ref。 |

## 概述

- 外部 `class` 与 `style` 留在根节点，其余 attrs（如 `id`、`name`）透传给内部 `<textarea>`。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/textarea/`；导出 `TxTextareaInstance` 类型。

## 离线完整示例源码

- [TextareaTextareaDemo](../snapshot/apps/nexus/app/components/content/demos/TextareaTextareaDemo.vue.txt)

## 离线类型与实现参考

- [textarea/index.ts](../snapshot/packages/tuffex/packages/components/src/textarea/index.ts.txt)
- [src/TxTextarea.vue](../snapshot/packages/tuffex/packages/components/src/textarea/src/TxTextarea.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
