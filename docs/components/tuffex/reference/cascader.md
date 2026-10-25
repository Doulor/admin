# Cascader 级联选择

> 从层级数据中选择一条或多条路径的选择器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/cascader) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/cascader.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/cascader.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 单选与多选
单选时值是一条路径数组；`multiple` 时是路径数组的列表。
官方示例：`CascaderCascaderDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const single = ref()
const paths = ref([])

const options = [
  {
    value: 'zhejiang',
    label: 'Zhejiang',
    children: [
      {
        value: 'hangzhou',
        label: 'Hangzhou',
        children: [
          { value: 'xihu', label: 'West Lake', leaf: true },
          { value: 'binjiang', label: 'Binjiang', leaf: true },
        ],
      },
    ],
  },
]
</script>

<template>
  <TxCascader v-model="single" :options="options" placeholder="Single" />
  <TxCascader v-model="paths" :options="options" multiple placeholder="Multiple" />
</template>
```

### 发布策略配置
后台配置流：Cascader 定范围，FlatSelect 定策略，滑块定阈值，TagInput 记标签。
官方示例：`ComponentsReleasePolicyDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCascader v-model="releasePath" :options="scopeOptions" placeholder="发布范围" />
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

- 层级控制在二到三级；更深的树改用搜索或 TreeSelect。
- `value` 跨版本保持稳定：值里存的是路径 key，改 key 会让已保存的选择失效。
- 异步加载的末端节点标记 `leaf: true`，否则它会调用 `load` 而不是变为可选。
- 持久化完整路径而不是叶子 id，标签才能还原。
- 保留可见的字段标签，不要只靠 placeholder。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` | `CascaderValue` | - | 单选为一条路径，多选为路径列表。 |
| `options` | `CascaderNode[]` | `[]` | 根级选项树。 |
| `multiple` | `boolean` | `false` | 多选叶子路径，已选路径显示为标签。 |
| `disabled` | `boolean` | `false` | 禁止打开、清空与选择。 |
| `placeholder` | `string` | `'Please select'` | 未选择时的占位文本。 |
| `searchable` | `boolean` | `true` | 显示搜索框，只匹配已加载的叶子路径。 |
| `clearable` | `boolean` | `true` | 有值且未禁用时显示清空按钮。 |
| `placement` | `PopoverPlacement` | `'bottom-start'` | 根面板位置，转发给 `TxPopover`。 |
| `dropdownOffset` | `number` | `6` | 根面板偏移，转发给 `TxPopover`。 |
| `dropdownWidth` | `number` | `260` | 根面板宽度；子面板按内容在 200px 与 `dropdownMaxWidth` 间自适应。 |
| `dropdownMaxWidth` | `number` | `520` | 面板最大宽度。 |
| `dropdownMaxHeight` | `number` | `340` | 面板最大高度（px）。 |
| `expandTrigger` | `'click' \| 'hover' \| 'both'` | `'both'` | `click` 时点击打开分支面板，其余悬停打开；点击分支行总会展开。 |
| `load` | `(node, level) => Promise<CascaderNode[]>` | - | 为无 `children` 且非 `leaf` 的节点异步加载子节点。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(v)` | 选择或清空后触发，参数为新值。 |
| `change` | `(v)` | 与 `update:modelValue` 同时触发。 |
| `open` | - | 浮层打开后触发。 |
| `close` | - | 浮层关闭后触发。 |
| `load-error` | `({ path: CascaderPath, error: unknown })` | `load` 拒绝时触发，`path` 为该节点路径；再次展开会重试。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `open()` | `() => void` | 打开浮层。 |
| `close()` | `() => void` | 关闭浮层。 |
| `toggle()` | `() => void` | 切换浮层。 |
| `focus()` | `() => void` | 聚焦触发器。 |
| `blur()` | `() => void` | 让触发器失焦。 |
| `clear()` | `() => void` | 单选清为 `undefined`，多选清为 `[]`。 |
| `setValue(v)` | `(v) => void` | 以给定值派发 `update:modelValue` 与 `change`。 |
| `getValue()` | `() => any` | 返回当前 `modelValue`。 |

### 类型

```ts
type CascaderPath = Array<string | number>
type CascaderValue = CascaderPath | CascaderPath[] | undefined // 单选 | 多选
```

`CascaderNode`，`options` 中的一项：

| 字段 | 类型 | 说明 |
|------|------|------|
| `value` | `string \| number` | 节点 key，组成路径。 |
| `label` | `string` | 行、标签与搜索结果中显示的文本。 |
| `disabled` | `boolean` | 禁止展开或选择该节点。 |
| `leaf` | `boolean` | 标记为可选的末端节点，不再懒加载。 |
| `children` | `CascaderNode[]` | 子节点，在锚定于该行的面板中渲染。 |

## 概述

- 每一级是独立浮层，以 `right-start` 锚定在打开它的行上，按自身文本排版；只挂载展开过的分支。
- 悬停移动、外部点击豁免与级联关闭由 anchor-delay 服务负责，与 `TxDropdownSubmenu` 相同，含安全三角。
- 触发器是 `role="combobox"`；层级是 `role="listbox"`，行是 `role="option"`，分支行另带 `aria-haspopup="listbox"` 与 `aria-expanded`。
- 键盘：上下移动并循环，Home / End 到首尾，ArrowRight 展开并聚焦子面板首行，ArrowLeft 关闭当前层级并交还焦点；根层级不拦截 ArrowLeft。
- 通往已展开面板的整条路径保持激活态。
- 有搜索词时，层级换成扁平的叶子路径列表；清空后恢复。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/cascader/`。

## 离线完整示例源码

- [CascaderCascaderDemo](../snapshot/apps/nexus/app/components/content/demos/CascaderCascaderDemo.vue.txt)
- [ComponentsReleasePolicyDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsReleasePolicyDemo.vue.txt)

## 离线类型与实现参考

- [cascader/index.ts](../snapshot/packages/tuffex/packages/components/src/cascader/index.ts.txt)
- [src/TxCascader.vue](../snapshot/packages/tuffex/packages/components/src/cascader/src/TxCascader.vue.txt)
- [src/TxCascaderLevel.vue](../snapshot/packages/tuffex/packages/components/src/cascader/src/TxCascaderLevel.vue.txt)
- [src/TxCascaderRow.vue](../snapshot/packages/tuffex/packages/components/src/cascader/src/TxCascaderRow.vue.txt)
- [src/context.ts](../snapshot/packages/tuffex/packages/components/src/cascader/src/context.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/cascader/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
