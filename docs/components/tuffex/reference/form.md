# Form 表单

> 带字段布局与校验的表单容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/form) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/form.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/form.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 校验
`rules` 按 `prop` 匹配字段，`validate()` 返回是否全部通过。
官方示例：`FormFormDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'

const formRef = ref()
const form = reactive({ name: '', email: '' })
const rules = {
  name: { required: true, message: '请输入名称' },
  email: {
    validator: (value: string) => {
      if (!value) return '请输入邮箱'
      return value.includes('@') || '邮箱格式错误'
    },
  },
}

async function submit() {
  if (!await formRef.value?.validate()) return
  // 提交表单
}
</script>

<template>
  <TxForm ref="formRef" :model="form" :rules="rules" label-width="90px">
    <TxFormItem label="名称" prop="name">
      <TuffInput v-model="form.name" placeholder="请输入名称" />
    </TxFormItem>
    <TxFormItem label="邮箱" prop="email">
      <TuffInput v-model="form.email" placeholder="name@example.com" />
    </TxFormItem>
    <TxButton variant="primary" @click="submit">校验</TxButton>
  </TxForm>
</template>
```

### 关联 label 与错误
把默认插槽的参数展开到控件上，label 与错误消息才会关联到它。

```vue
<TxFormItem v-slot="{ id, ariaInvalid, ariaDescribedby }" label="邮箱" prop="email">
  <input v-model="form.email" :id="id" :aria-invalid="ariaInvalid" :aria-describedby="ariaDescribedby">
</TxFormItem>
```

### 最佳实践

- 保持 `model` 稳定且响应式；挂载后整体替换会让重置结果出人意料。
- 通用规则放在表单级 `rules`，item 级 `rules` 只用于个别覆盖。
- 异步可用性检查放进 `validator`，并返回具体的错误文案。
- 锁定整个表单时，`disabled` 既传给 `TxForm`，也传给每个控件。
- 切换记录但保留输入时，调用 `clearValidate()` 清掉旧消息。

## API 参考

### TxForm

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `model` | `Record<string, any>` | - | 响应式表单数据，`TxFormItem` 按 `prop` 读取。 |
| `rules` | `FormRules` | - | 以 `prop` 为 key 的表单级规则。 |
| `labelPosition` | `'left' \| 'right' \| 'top'` | `'left'` | 子项的 label 布局。 |
| `labelWidth` | `string \| number` | - | 非 `top` 布局的 label 宽度，数字按 px 计。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 只写入表单上下文；输入组件不读取，需逐个传 `size`。 |
| `disabled` | `boolean` | `false` | 只写入表单上下文；输入组件不读取，需逐个传 `disabled`。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `validate` | `(valid: boolean)` | `validate()` 校验完全部字段后触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | 表单项与操作。 |

#### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `validate` | `() => Promise<boolean>` | 校验所有已注册字段，返回是否全部通过。 |
| `resetFields` | `() => void` | 恢复各字段挂载时的值，并清空消息。 |
| `clearValidate` | `() => void` | 只清空消息，不修改 `model`。 |

### TxFormItem

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `label` | `string` | `''` | 标签文本，省略时显示 `prop`。 |
| `prop` | `string` | - | 字段在 `model` 与 `rules` 中的 key。 |
| `rules` | `FormRule \| FormRule[]` | - | 该字段的规则，覆盖表单级规则。 |
| `required` | `boolean` | `false` | 显示必填标记，并校验空值。 |
| `showMessage` | `boolean` | `true` | 在字段下方显示错误消息。 |
| `inline` | `boolean` | `false` | 紧凑行内的 label 与内容对齐。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `validate` | `(valid: boolean)` | 该字段校验完成后触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | `{ id, ariaInvalid, ariaDescribedby }` | 字段控件；展开参数以关联 label 与错误消息。 |

### 类型

`FormRule`，`rules` 中的一条：

| 字段 | 类型 | 说明 |
|------|------|------|
| `required` | `boolean` | 校验空值。 |
| `message` | `string` | required 失败或 validator 返回 `false` 时的消息。 |
| `validator` | `(value, rule, model) => boolean \| string \| Promise<boolean \| string>` | 自定义校验；返回字符串即作为错误消息。 |

## 概述

- `TxForm` 渲染原生 `<form>`，并阻止默认提交。
- `TxFormItem` 挂载时注册、卸载前注销，表单方法只作用于存活的字段。
- 空值指 `null`、`undefined`、`''` 与空数组。
- label 的 `for` 指向生成的字段 id，错误消息为 `role="alert"`；控件不接收插槽的 `id` 时，关联不生效。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/form/`。

## 离线完整示例源码

- [FormFormDemo](../snapshot/apps/nexus/app/components/content/demos/FormFormDemo.vue.txt)

## 离线类型与实现参考

- [form/index.ts](../snapshot/packages/tuffex/packages/components/src/form/index.ts.txt)
- [src/TxForm.vue](../snapshot/packages/tuffex/packages/components/src/form/src/TxForm.vue.txt)
- [src/TxFormItem.vue](../snapshot/packages/tuffex/packages/components/src/form/src/TxFormItem.vue.txt)
- [src/context.ts](../snapshot/packages/tuffex/packages/components/src/form/src/context.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/form/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
