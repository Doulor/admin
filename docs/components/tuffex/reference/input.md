# Input 输入

> 接收单行或多行文本的输入框

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/input) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/input.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/input.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`InputBasicInputDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffInput v-model="value" placeholder="请输入内容" />
</template>
```

### 搜索行
官方示例：`InputSearchRowDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffInput placeholder="搜索..." />
  <TxButton size="sm">搜索</TxButton>
</template>
```

### 输入类型
`type` 可选 `text`、`password`、`textarea`、`date`、`email`、`number`；`rows` 设定文本域行数。
官方示例：`InputInputTypesDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffInput v-model="text" placeholder="文本输入" />
  <TuffInput v-model="password" type="password" placeholder="密码输入" />
  <TuffInput v-model="content" type="textarea" placeholder="多行文本" :rows="4" />
</template>
```

### 只读与禁用
官方示例：`InputReadonlyDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffInput v-model="readonlyValue" readonly placeholder="只读" />
  <TuffInput v-model="disabledValue" disabled placeholder="禁用" />
</template>
```

### 可清空
`clearable` 在有值时显示可聚焦的清空按钮，禁用或只读时隐藏。
官方示例：`InputClearableDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffInput v-model="clearableValue" clearable placeholder="可清空" />
</template>
```

### 前后缀
`prefix` / `suffix` 插槽优先于 `prefixIcon` / `suffixIcon`。
官方示例：`InputPrefixSuffixDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffInput v-model="keyword" placeholder="Search">
    <template #prefix>
      <TxIcon icon="i-carbon-search" />
    </template>
  </TuffInput>
  <TuffInput v-model="user" placeholder="User">
    <template #suffix>
      <TxIcon icon="i-carbon-user" />
    </template>
  </TuffInput>
</template>
```

### 最佳实践

- 焦点只用边框与阴影的细微变化表达；除非外层表单有统一规范，不要在外层再加一圈 focus ring。
- 工具栏与列表筛选用轻量的搜索态；Enter 搜索与防抖远程搜索属于契约时，改用 `TxSearchInput`。
- `type="number"` 的值可能是 number 或 `''`，持久化前先在 schema 中归一化。
- 同一字段的图标只用插槽或图标 prop 其中一种。

## API 参考

### 属性

```yaml
rows:
  - name: modelValue / v-model
    description: '输入值。'
    type: 'string | number'
    default: "''"
  - name: placeholder
    description: '占位文本。'
    type: 'string'
    default: "''"
  - name: type
    description: '输入类型；`textarea` 渲染多行文本域。'
    type: "'text' | 'password' | 'textarea' | 'date' | 'email' | 'number'"
    default: "'text'"
  - name: disabled
    description: '禁用输入。'
    type: 'boolean'
    default: 'false'
  - name: readonly
    description: '只读。'
    type: 'boolean'
    default: 'false'
  - name: clearable
    description: '有值时显示清空按钮。'
    type: 'boolean'
    default: 'false'
  - name: rows
    description: '文本域行数，仅 `textarea` 有效。'
    type: 'number'
    default: '3'
  - name: prefixIcon
    description: '前缀图标 class；`prefix` 插槽优先。'
    type: 'string'
    default: "''"
  - name: suffixIcon
    description: '后缀图标 class；`suffix` 插槽优先。'
    type: 'string'
    default: "''"
  - name: capsLockText
    description: '密码框大写锁定提示的文案，经 `role="status"` 播报。'
    type: 'string'
    default: "'CapsLock is on'"
```

### 事件

```yaml
rows:
  - name: update:modelValue
    description: '值变化时触发。'
    type: '(value: string | number) => void'
    default: '-'
  - name: input
    description: '输入时触发，参数同 `update:modelValue`。'
    type: '(value: string | number) => void'
    default: '-'
  - name: focus
    description: '原生输入控件聚焦时触发。'
    type: '(event: FocusEvent) => void'
    default: '-'
  - name: blur
    description: '原生输入控件失焦时触发。'
    type: '(event: FocusEvent) => void'
    default: '-'
  - name: clear
    description: '清空后触发。'
    type: '() => void'
    default: '-'
```

### 插槽

```yaml
rows:
  - name: prefix
    description: '前缀内容，替代 `prefixIcon`。'
    type: '-'
    default: '-'
  - name: suffix
    description: '后缀内容，替代 `suffixIcon`。'
    type: '-'
    default: '-'
```

### 暴露方法

```yaml
rows:
  - name: focus
    description: '聚焦原生输入控件。'
    type: '() => void'
    default: '-'
  - name: blur
    description: '让原生输入控件失焦。'
    type: '() => void'
    default: '-'
  - name: clear
    description: '清空；禁用或只读时无效。'
    type: '() => void'
    default: '-'
  - name: setValue
    description: '设置值并派发 `update:modelValue` 与 `input`。'
    type: '(value: string) => void'
    default: '-'
  - name: getValue
    description: '返回当前值。'
    type: '() => string | number'
    default: '-'
  - name: inputEl
    description: '原生 input 或 textarea 的引用。'
    type: 'HTMLInputElement | HTMLTextAreaElement | null'
    default: '-'
```

## 从 FlatInput 迁移

`FlatInput` / `TxFlatInput` 已下线，由 `TxInput` 承接：

| FlatInput | TxInput |
|-----------|---------|
| `area` | `type="textarea"` |
| `password` | `type="password"` |
| `icon="i-…"` | `prefix-icon="i-…"` |
| 默认插槽（前缀内容） | `#prefix` 插槽 |
| `disabled` / `readonly` | `disabled` / `readonly` |
| `nonWin` | 移除，不再保留 Windows 下划线视觉 |

`update:modelValue` 契约不变；`focus` / `blur` 改由原生输入元素派发。

## 概述

- `type="number"` 非空时派发 `Number(value)`，清空时为 `''`。
- 清空依次派发 `update:modelValue`、`input`、`clear`；禁用或只读时清空无效。
- 外层保留 `class` / `style`，其余 attrs 透传给原生 `input` / `textarea`。

## 技术实现

- `index.ts` 同时导出 `TuffInput` 与 `TxInput`。
- 源码：`packages/tuffex/packages/components/src/input/`。

## 离线完整示例源码

- [InputBasicInputDemo](../snapshot/apps/nexus/app/components/content/demos/InputBasicInputDemo.vue.txt)
- [InputSearchRowDemo](../snapshot/apps/nexus/app/components/content/demos/InputSearchRowDemo.vue.txt)
- [InputInputTypesDemo](../snapshot/apps/nexus/app/components/content/demos/InputInputTypesDemo.vue.txt)
- [InputReadonlyDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/InputReadonlyDisabledDemo.vue.txt)
- [InputClearableDemo](../snapshot/apps/nexus/app/components/content/demos/InputClearableDemo.vue.txt)
- [InputPrefixSuffixDemo](../snapshot/apps/nexus/app/components/content/demos/InputPrefixSuffixDemo.vue.txt)

## 离线类型与实现参考

- [input/index.ts](../snapshot/packages/tuffex/packages/components/src/input/index.ts.txt)
- [src/TxInput.vue](../snapshot/packages/tuffex/packages/components/src/input/src/TxInput.vue.txt)
- [style/index.scss](../snapshot/packages/tuffex/packages/components/src/input/style/index.scss.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
