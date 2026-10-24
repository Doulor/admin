# NumberInput

> 带步进按钮与范围限制的数字输入框

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/number-input) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/number-input.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/number-input.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.7`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 范围与精度
`min` / `max` 限定范围，`step` 设定步长，`precision` 设定小数位。
官方示例：`NumberInputNumberInputDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const percentage = ref(35)
</script>

<template>
  <TxNumberInput v-model="percentage" :min="0" :max="100" :step="5" :precision="0" />
</template>
```

### 最佳实践

- 百分比、配额、分页等场景显式传入 `min`、`max` 与 `step`。
- 小数用 `precision` 处理，不要在消费端每次事件后再四舍五入。
- 表格筛选等高密度区域设置 `controls=false`，键盘输入更快。
- 在校验与 API 映射中，把 `null` 当作未设置。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` / `v-model` | `number \| null` | `null` | 数字值；空输入为 `null`。 |
| `min` | `number` | - | 最小值。 |
| `max` | `number` | - | 最大值。 |
| `step` | `number` | `1` | 步进按钮与原生输入的步长。 |
| `precision` | `number` | - | 保留的小数位数。 |
| `placeholder` | `string` | `''` | 占位文本。 |
| `disabled` | `boolean` | `false` | 禁用输入与按钮。 |
| `readonly` | `boolean` | `false` | 只读，并阻止步进。 |
| `controls` | `boolean` | `true` | 显示减少与增加按钮。 |
| `decreaseLabel` | `string` | `'Decrease value'` | 减少按钮的 `aria-label`，本地化时传入。 |
| `increaseLabel` | `string` | `'Increase value'` | 增加按钮的 `aria-label`，本地化时传入。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value: number \| null)` | 值归一化后触发。 |
| `change` | `(value: number \| null)` | 与 `update:modelValue` 同时触发。 |
| `focus` | `(event: FocusEvent)` | 原生 focus 事件。 |
| `blur` | `(event: FocusEvent)` | 原生 blur 事件，失焦时再次归一化。 |

### 暴露方法

| 名称 | 说明 |
|------|------|
| `focus()` | 聚焦原生输入。 |
| `blur()` | 让原生输入失焦。 |
| `inputRef` | 原生输入的 ref。 |

## 概述

- 空输入归一化为 `null`。
- 手输值在失焦时、步进结果立即限制在 `min` / `max` 内，再按 `precision` 取舍小数。
- 失焦时无法解析的文本回退为当前值，没有当前值时为 `null`。
- `controls=false` 隐藏步进按钮，保留原生数字输入。
- `readonly` 与 `disabled` 都阻止步进；`disabled` 还禁用输入框。

## 技术实现

- 除 `class` / `style` 外的 attrs 透传给原生 input。
- 源码：`packages/tuffex/packages/components/src/number-input/`。

## 离线完整示例源码

- [NumberInputNumberInputDemo](../snapshot/apps/nexus/app/components/content/demos/NumberInputNumberInputDemo.vue.txt)

## 离线类型与实现参考

- [number-input/index.ts](../snapshot/packages/tuffex/packages/components/src/number-input/index.ts.txt)
- [src/TxNumberInput.vue](../snapshot/packages/tuffex/packages/components/src/number-input/src/TxNumberInput.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
