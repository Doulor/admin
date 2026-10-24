# Tree 树形

> 可筛选、可选择的层级树

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tree) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tree.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tree.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`filterText` 接收搜索文本，匹配分支临时展开。
官方示例：`TreeTreeDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const query = ref('')
const value = ref()

const nodes = [
  {
    key: 'design',
    label: 'Design',
    children: [
      { key: 'design-ui', label: 'UI' },
      { key: 'design-ux', label: 'UX' },
    ],
  },
  {
    key: 'dev',
    label: 'Development',
    children: [
      { key: 'dev-web', label: 'Web' },
      { key: 'dev-app', label: 'App' },
    ],
  },
]
</script>

<template>
  <TxSearchInput v-model="query" placeholder="过滤节点" />
  <TxTree
    v-model="value"
    :nodes="nodes"
    :default-expanded-keys="['design']"
    :filter-text="query"
  />
</template>
```

### 后台权限域
选中的 key 驱动右侧详情、穿梭框或审计流。
官方示例：`ComponentsPermissionOrchestrationDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const query = ref('')
const selectedScope = ref<string | number>('release')
const nodes = [
  {
    key: 'workspace',
    label: '工作区',
    children: [
      { key: 'release', label: '发布控制' },
      { key: 'audit', label: '审计日志' },
    ],
  },
]
</script>

<template>
  <TxSearchInput v-model="query" placeholder="过滤权限域" />
  <TxTree
    v-model="selectedScope"
    :nodes="nodes"
    :default-expanded-keys="['workspace']"
    :filter-text="query"
  />
</template>
```

### 最佳实践

- 把 `key` 当作持久标识，不要从会翻译或重命名的文案派生。
- 只有其它界面需要掌握展开状态时才用 `expandedKeys`，否则用 `defaultExpandedKeys`。
- 权限域树保持单选，资源授权交给 `TxTransfer`、`DataTable` 或详情面板。
- 用 `leaf=false` 表示懒加载占位时，外围 UI 要提供加载或空子级状态；`TxTree` 不会自行拉取子节点。
- 用 `item` 插槽替换行时，调用 `toggleExpand()` 与 `toggleSelect()`，不要复制内部状态逻辑。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|------|------|
| `nodes` | `TreeNode[]` | `[]` | 树形数据源。 |
| `modelValue` | `string \| number \| Array<string \| number>` | - | 选中 key（`multiple` 时为数组）；不绑定时由树自行维护。 |
| `multiple` | `boolean` | `false` | 以数组形式切换多个选中 key。 |
| `selectable` | `boolean` | `true` | 允许行与 checkbox 选择；关闭后仍可展开。 |
| `checkable` | `boolean` | `false` | 为每个可见节点显示 checkbox，不向子孙级联。 |
| `disabled` | `boolean` | `false` | 禁用整棵树的选择；展开仍可用。 |
| `defaultExpandedKeys` | `Array<string \| number>` | `[]` | 非受控的初始展开 key；未传 `expandedKeys` 时，其变化会重置展开状态。 |
| `defaultSelectedKeys` | `Array<string \| number>` | - | 非受控的初始选中态；绑定 `modelValue` 时忽略。 |
| `expandedKeys` | `Array<string \| number>` | - | 受控展开 key；父级需在 `update:expandedKeys` 后回传。 |
| `indent` | `number` | `16` | 每级缩进（px）。 |
| `filterText` | `string` | `''` | 过滤文本；非空时匹配分支临时展开。 |
| `filterMethod` | `(node: TreeNode, query: string) => boolean` | - | 自定义匹配，收到 trim 后的原始查询；默认按小写 label 包含匹配。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: TreeValue` | 点击可选节点或 checkbox 变化后触发。 |
| `select` | `{ key: TreeKey, node: TreeNode }` | 紧随 `update:modelValue` 触发，带选中节点。 |
| `toggle` | `{ key: TreeKey, expanded: boolean }` | 节点展开或折叠后触发。 |
| `update:expandedKeys` | `keys: TreeKey[]` | 受控与非受控时都返回下一组展开 key。 |

### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `item` | `{ node, level, expanded, hasChildren, selected, toggleExpand, toggleSelect, indent }` | 替换整行渲染；调用插槽 helper 保留选择与展开行为。 |
| `empty` | - | 过滤后无可见行时的空状态，默认为 `No results`。 |

### TreeNode

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | `string \| number` | 稳定唯一的 key，用于选择与展开。 |
| `label` | `string` | 行文本，也是默认过滤目标。 |
| `children` | `TreeNode[]` | 子节点。 |
| `leaf` | `boolean` | 设为 `false` 时，没有子节点也显示展开箭头。 |
| `disabled` | `boolean` | 禁用该节点的选择；有子节点时仍可展开。 |
| `icon` | `TxIconSource \| string` | 节点图标；字符串按 class 图标处理。 |

## 概述

- 展开与选中都分受控与非受控：传入 `expandedKeys` 或绑定 `modelValue` 后，组件只派发事件，父级回传后视图才更新。
- 过滤不改写展开状态，只临时展开匹配节点的祖先。
- 选择模型是扁平的：`checkable` 只改变控件形态，没有半选或级联。
- `disabled` 与 `node.disabled` 阻止选择，但仍可展开。
- 根节点为 `role="tree"`（`multiple` 时带 `aria-multiselectable`）；每行为 `role="treeitem"`，带 `aria-level`、`aria-setsize`、`aria-posinset` 及按需的 `aria-expanded` / `aria-selected` / `aria-disabled`。`item` 插槽只替换行内视觉，这些语义保留。

## 技术实现

- 节点按展开状态与过滤结果展平成可见行。
- 源码：`packages/tuffex/packages/components/src/tree/`。



## 自定义

| 主题变量 | 用途 |
|-------------|----------|
| `--tx-text-color-primary` | 行标签颜色。 |
| `--tx-text-color-secondary` | 展开箭头与空状态。 |
| `--tx-color-primary` | 选中行底色。 |
| `--tx-fill-color` | 悬停行底色。 |

## 离线完整示例源码

- [TreeTreeDemo](../snapshot/apps/nexus/app/components/content/demos/TreeTreeDemo.vue.txt)
- [ComponentsPermissionOrchestrationDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsPermissionOrchestrationDemo.vue.txt)

## 离线类型与实现参考

- [tree/index.ts](../snapshot/packages/tuffex/packages/components/src/tree/index.ts.txt)
- [src/TxTree.vue](../snapshot/packages/tuffex/packages/components/src/tree/src/TxTree.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/tree/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
