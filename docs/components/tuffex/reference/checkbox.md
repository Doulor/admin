# Checkbox 复选框

> 在选中与未选中之间切换的复选控件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/checkbox) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/checkbox.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/checkbox.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
点击方框或文案切换。
官方示例：`CheckboxCheckboxDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const checked = ref(false)
</script>

<template>
  <TxCheckbox v-model="checked" label="选项" />
</template>
```

### 变体
默认 `checkmark` 显示勾选标记；`variant="fill"` 只填充方框。
官方示例：`CheckboxCheckboxVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCheckbox v-model="fillChecked" variant="fill" label="填充样式" />
  <TxCheckbox v-model="checkmarkChecked" variant="checkmark" label="带勾选标记" />
</template>
```

### 禁用
官方示例：`CheckboxCheckboxDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCheckbox v-model="unchecked" label="禁用" disabled />
  <TxCheckbox v-model="checked" label="禁用且已选中" disabled />
</template>
```

### 文案在前
`labelPlacement="start"` 把文案放在方框前。
官方示例：`CheckboxCheckboxLabelStartDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCheckbox v-model="checked" label="我在前面" label-placement="start" />
</template>
```

### 无文案
没有 `label` 或插槽时，必须传 `aria-label`。
官方示例：`CheckboxCheckboxNoLabelDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCheckbox v-model="checked" aria-label="勾选" />
</template>
```

### 加载中
等待服务端确认时设置 `loading`：方框变为旋转环，未选中为灰色，已选中与部分选中为主色，期间不可切换。
官方示例：`CheckboxCheckboxLoadingDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const checked = ref(false)
const committing = ref(false)
const mixed = ref(false)

async function commit(next: boolean) {
  committing.value = true
  try {
    await save(next)
    checked.value = next
  }
  finally {
    committing.value = false
  }
}
</script>

<template>
  <TxCheckbox :model-value="checked" :loading="committing" label="异步提交" @change="commit" />
  <TxCheckbox v-model="mixed" label="加载中 / 部分选中" indeterminate loading />
</template>
```

### 自定义文案
默认插槽替代 `label`。
官方示例：`CheckboxCheckboxSlotDemo`（完整源码见本页末尾）

```vue
<template>
  <TxCheckbox v-model="checked">
    <span>自定义标签</span>
  </TxCheckbox>
</template>
```

### 最佳实践

- 优先用可见的 `label` 或插槽；只有没有可见文案时才用 `ariaLabel`。
- 「正在提交」用 `loading`，「不可用」用 `disabled`；用 `disabled` 表示忙碌会让控件像是永久不可用。
- 需要服务端确认时设置 `loading`，成功后再写回 `modelValue`；失败时只撤下 `loading`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `modelValue` / `v-model` | `boolean` | `false` | 选中状态。 |
| `disabled` | `boolean` | `false` | 禁止切换，并移出 Tab 序列。 |
| `loading` | `boolean` | `false` | 显示旋转环并禁止切换，不套用禁用态配色。 |
| `label` | `string` | - | 方框旁的文案。 |
| `labelPlacement` | `'start' \| 'end'` | `'end'` | 文案在方框前或后。 |
| `variant` | `'checkmark' \| 'fill'` | `'checkmark'` | `checkmark` 显示勾选标记，`fill` 只填充方框。 |
| `ariaLabel` | `string` | - | 没有可见文案时的可访问名称。 |
| `indeterminate` | `boolean` | `false` | 部分选中：显示横杠，点击后变为选中。 |

### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `(value: boolean) => void` | 用户切换后触发，参数为新值。 |
| `change` | `(value: boolean) => void` | 与 `update:modelValue` 同时触发。 |

### 插槽

| 插槽名 | 说明 |
|--------|------|
| `default` | 自定义文案，优先于 `label`。 |

## 概述

- 根节点是原生 `<button role="checkbox">`；点击、Enter 或 Space 切换。
- 受控组件：切换只派发事件，父级回写 `modelValue` 后外观才更新。
- `indeterminate` 时 `aria-checked="mixed"`；加载中已选中与部分选中外观相同，靠它区分。
- `disabled` 与 `loading` 都设置原生 `disabled`；`loading` 另设 `aria-busy="true"`。
- 有可见文案时不渲染 `aria-label`。
- 减少动态效果时，加载环停止旋转。

## 技术实现

- `index.ts` 同时导出 `TuffCheckbox` 与 `TxCheckbox`。
- 源码：`packages/tuffex/packages/components/src/checkbox/`。

## 离线完整示例源码

- [CheckboxCheckboxDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxDemo.vue.txt)
- [CheckboxCheckboxVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxVariantsDemo.vue.txt)
- [CheckboxCheckboxDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxDisabledDemo.vue.txt)
- [CheckboxCheckboxLabelStartDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxLabelStartDemo.vue.txt)
- [CheckboxCheckboxNoLabelDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxNoLabelDemo.vue.txt)
- [CheckboxCheckboxLoadingDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxLoadingDemo.vue.txt)
- [CheckboxCheckboxSlotDemo](../snapshot/apps/nexus/app/components/content/demos/CheckboxCheckboxSlotDemo.vue.txt)

## 离线类型与实现参考

- [checkbox/index.ts](../snapshot/packages/tuffex/packages/components/src/checkbox/index.ts.txt)
- [src/TxCheckbox.vue](../snapshot/packages/tuffex/packages/components/src/checkbox/src/TxCheckbox.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
