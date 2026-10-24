# FlatSelect 平铺下拉选择器

> 选项覆盖触发器展开的下拉选择器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/flat-select) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/flat-select.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/flat-select.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`FlatSelectBasicDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const value = ref('json')
</script>

<template>
  <TxFlatSelect v-model="value" placeholder="选择格式">
    <TxFlatSelectItem value="json" label="JSON" />
    <TxFlatSelectItem value="csv" label="CSV" />
    <TxFlatSelectItem value="xml" label="XML" />
  </TxFlatSelect>
</template>
```

### 禁用
`disabled` 可设在整组或单项上。
官方示例：`FlatSelectDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFlatSelect v-model="value" placeholder="请选择" disabled>
    <TxFlatSelectItem value="a" label="Option A" />
    <TxFlatSelectItem value="b" label="Option B" />
  </TxFlatSelect>

  <TxFlatSelect v-model="value" placeholder="请选择">
    <TxFlatSelectItem value="a" label="Option A" />
    <TxFlatSelectItem value="b" label="Option B" disabled />
    <TxFlatSelectItem value="c" label="Option C" />
  </TxFlatSelect>
</template>
```

### 发布策略配置
后台配置流：Cascader 定范围，FlatSelect 定策略，滑块定阈值，TagInput 记标签。
官方示例：`ComponentsReleasePolicyDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCascader v-model="releasePath" :options="scopeOptions" placeholder="发布范围" />
  <TxFlatSelect v-model="packageFormat" placeholder="包格式">
    <TxFlatSelectItem value="signed" label="签名构建" />
    <TxFlatSelectItem value="archive" label="归档包" />
  </TxFlatSelect>
  <TxFlatSelect v-model="rolloutMode" placeholder="发布模式">
    <TxFlatSelectItem value="phased" label="分阶段" />
    <TxFlatSelectItem value="guarded" label="护栏发布" />
  </TxFlatSelect>
  <TxSegmentedSlider v-model="riskLevel" :segments="riskSegments" />
  <TxSlider v-model="traffic" :min="5" :max="100" :step="5" show-value />
  <TxTagInput v-model="labels" placeholder="输入标签后回车" :max="5" />
</template>
```

### 最佳实践

- 用于 3–6 个短且稳定的选项；需要搜索、远程数据、分组或虚拟滚动时用 `TxSelect`。
- 文案保持简短：触发器与选项都单行截断。
- 每个 `value` 稳定且唯一：父级按 `value` 匹配选中项与键盘顺序。
- 不要在 `TxFlatSelectItem` 中放交互控件，选项本身就是 `role="option"` 的按钮。
- 选项暂不可用时设置 `disabled`，不要把它过滤掉。

## API 参考

### TxFlatSelect

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `modelValue` / `v-model` | `string \| number` | `''` | 当前值，匹配某项的 `value`；无匹配时显示占位。 |
| `placeholder` | `string` | `''` | 未选中时触发器的文本。 |
| `disabled` | `boolean` | `false` | 禁用整组：触发器不可点击，下拉不再展开。 |

#### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `(value: string \| number) => void` | 提交新值时触发，包括键盘上下切换。 |
| `change` | `(value: string \| number) => void` | 与 `update:modelValue` 同时触发。 |

#### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | `TxFlatSelectItem` 子项。 |

### TxFlatSelectItem

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `value` | `string \| number` | - | 选项值，须稳定且唯一。 |
| `label` | `string` | - | 触发器与选项中显示的文本。 |
| `disabled` | `boolean` | `false` | 不可选，键盘导航时跳过。 |

#### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | 自定义内容，替代 `label`。 |

## 与 TxSelect 的对比

| 特性 | TxSelect | TxFlatSelect |
|------|----------|-------------|
| 定位 | floating-ui，Teleport 到 body | CSS absolute + clip-path |
| 展开 | 面板出现在触发器下方 | 选项覆盖触发器，从选中项展开 |
| 动画 | 无（避免滚动延迟） | clip-path 展开 / 收起 |
| 搜索 | 支持 | 不支持 |
| 场景 | 通用表单、复杂场景 | 设置页、简单下拉 |
| 触发器 | 输入框风格 | 按钮风格 + 箭头 |

## 概述

- 触发器为 `role="combobox"`，面板为 `role="listbox"`，选项为带 `aria-selected` 的 `role="option"`。
- 选项覆盖触发器展开，选中项锚定在触发器的位置。
- 打开时 ArrowUp / ArrowDown 切换并立即提交，跳过禁用项。
- 关闭时面板收回触发器，并在同样的 200ms 内淡出底色、边框、阴影与选中强调色。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/flat-select/`。

## 离线完整示例源码

- [FlatSelectBasicDemo](../snapshot/apps/nexus/app/components/content/demos/FlatSelectBasicDemo.vue.txt)
- [FlatSelectDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/FlatSelectDisabledDemo.vue.txt)
- [ComponentsReleasePolicyDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsReleasePolicyDemo.vue.txt)

## 离线类型与实现参考

- [flat-select/index.ts](../snapshot/packages/tuffex/packages/components/src/flat-select/index.ts.txt)
- [src/TxFlatSelect.vue](../snapshot/packages/tuffex/packages/components/src/flat-select/src/TxFlatSelect.vue.txt)
- [src/TxFlatSelectItem.vue](../snapshot/packages/tuffex/packages/components/src/flat-select/src/TxFlatSelectItem.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/flat-select/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
