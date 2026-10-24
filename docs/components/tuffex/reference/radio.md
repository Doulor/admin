# Radio 单选框

> 在一组互斥选项中选择一项的控件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/radio) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/radio.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/radio.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 按钮组
默认样式；也可直接拖动指示器选择。
官方示例：`RadioRadioSimpleDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import type { TxRadioValue } from '@talex-touch/tuffex'
import { ref } from 'vue'

const value = ref<TxRadioValue>('week')
</script>

<template>
  <TxRadioGroup v-model="value">
    <TxRadio value="day">日</TxRadio>
    <TxRadio value="week">周</TxRadio>
    <TxRadio value="month">月</TxRadio>
  </TxRadioGroup>
</template>
```

### 标准样式
设置 `type="standard"`，用 `direction` 切换横排与纵排。
官方示例：`RadioRadioStandardDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRadioGroup v-model="value" type="standard" direction="row">
    <TxRadio value="viewer" label="只读成员" />
    <TxRadio value="editor" label="编辑成员" />
    <TxRadio value="owner" label="管理员" />
  </TxRadioGroup>
</template>
```

### 卡片
设置 `type="card"`，标题与说明放进默认插槽。
官方示例：`RadioRadioCardDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRadioGroup v-model="value" type="card">
    <TxRadio value="local">
      <strong>仅本地</strong>
      <p>只保存在当前设备。</p>
    </TxRadio>
    <TxRadio value="sync">
      <strong>跨设备同步</strong>
      <p>通过账号同步偏好设置。</p>
    </TxRadio>
    <TxRadio value="managed" disabled>
      <strong>组织托管</strong>
      <p>当前租户未启用托管策略。</p>
    </TxRadio>
  </TxRadioGroup>
</template>
```

### 指示器
`indicatorVariant` 决定指示器画法，`elastic` 开关拉伸动效。
官方示例：`RadioRadioIndicatorDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRadioGroup v-model="value">…</TxRadioGroup>
  <TxRadioGroup v-model="value" :elastic="false">…</TxRadioGroup>
  <TxRadioGroup v-model="value" indicator-variant="blur">…</TxRadioGroup>
  <TxRadioGroup v-model="value" indicator-variant="glass">
    <TxRadio value="focus">专注</TxRadio>
    <TxRadio value="review">复盘</TxRadio>
    <TxRadio value="ship">发布</TxRadio>
  </TxRadioGroup>
</template>
```

### 禁用
官方示例：`RadioRadioDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRadioGroup v-model="groupValue" disabled>
    <TxRadio value="locked">锁定</TxRadio>
    <TxRadio value="archived">归档</TxRadio>
  </TxRadioGroup>

  <TxRadioGroup v-model="optionValue">
    <TxRadio value="automatic" disabled>自动</TxRadio>
    <TxRadio value="manual">手动</TxRadio>
  </TxRadioGroup>
</template>
```

### 演练场
官方示例：`RadioRadioGroupPlaygroundDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRadioGroup
    v-model="value"
    :type="type"
    :disabled="disabled"
    :indicator-variant="indicatorVariant"
    :elastic="elastic"
    :stiffness="stiffness"
    :damping="damping"
  >
    <TxRadio value="alpha">Alpha</TxRadio>
    <TxRadio value="beta">Beta</TxRadio>
    <TxRadio value="gamma">Gamma</TxRadio>
  </TxRadioGroup>
</template>
```

### 最佳实践

- 同组内每个 `value` 保持唯一。
- 短分段选择用 `button`，长列表用纵向 `standard`，需要说明文字时用 `card`。
- 单个选项不可用时只禁用该项，让它保持可见；整组禁用只用于只读或加载态。
- `glass` / `blur` 指示器保留 `updateOnSettled` 的默认值，除非校验必须立即触发。

## API 参考

### TxRadioGroup

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `modelValue` / `v-model` | `string \| number` | - | 选中项的值。 |
| `disabled` | `boolean` | `false` | 禁用整组，包括键盘选择。 |
| `type` | `'button' \| 'standard' \| 'card'` | `'button'` | 子项共享的样式。 |
| `direction` | `'row' \| 'column'` | - | 排列方向；`button` 恒为 `row`，`standard` 默认 `row`，`card` 默认 `column`。 |
| `indicatorVariant` | `'solid' \| 'outline' \| 'glass' \| 'blur'` | - | 按钮组指示器样式；未传时由 `glass` / `blur` 推导，否则为 `solid`。 |
| `glass` | `boolean` | `false` | `glass` 指示器的简写。 |
| `blur` | `boolean` | `false` | `blur` 指示器的简写。 |
| `updateOnSettled` | `boolean` | - | 按钮组等指示器停稳后再派发更新；`glass`、`blur` 下默认开启。 |
| `stiffness` | `number` | `110` | 指示器弹簧刚度，越大越快停稳。 |
| `damping` | `number` | `12` | 指示器弹簧阻尼，越小越弹。 |
| `blurAmount` | `number` | `1` | `blur` 指示器的背景模糊强度。 |
| `elastic` | `boolean` | `true` | 启用指示器的拉伸与撞击动效。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value: string \| number)` | 选中新值时触发。 |
| `change` | `(value: string \| number)` | 与 `update:modelValue` 同时触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | `TxRadio` 子项。 |

#### 键盘

| 按键 | 行为 |
|------|------|
| `ArrowRight` / `ArrowDown` | 选择下一个启用项，末项后回到首项。 |
| `ArrowLeft` / `ArrowUp` | 选择上一个启用项，首项前回到末项。 |
| `Home` / `End` | 选择第一个 / 最后一个启用项。 |

### TxRadio

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `value` | `string \| number` | - | 选中时写入 group 的值。 |
| `label` | `string` | `''` | 无默认插槽时显示的文本。 |
| `disabled` | `boolean` | `false` | 禁用该项，键盘导航跳过它。 |
| `type` | `'button' \| 'standard' \| 'card'` | `'button'` | 独立使用时的样式；group 内以 group 的 `type` 为准。 |
| `modelValue` / `v-model` | `boolean` | - | 独立使用时的选中状态；未传则自行记录，group 内忽略。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | `(value: string \| number)` | 在 group 内选中未选中项时触发；独立使用时每次点击启用项都触发。 |
| `update:modelValue` | `(value: boolean)` | 独立使用时，点击未选中的项后以 `true` 触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | 标签或卡片内容；为空时显示 `label`。 |

## 概述

- `TxRadioGroup` 持有选中值，向子项注入样式与禁用状态，并处理键盘导航。
- 组内点击已选中的项不派发任何事件。
- 按钮组的指示器可横向拖动，松手后吸附并选中最近的启用项；整组禁用时忽略拖动。

## 技术实现

- `updateOnSettled` 生效时，新值先在组内生效，指示器停稳后再派发 `update:modelValue` 与 `change`。
- 源码：`packages/tuffex/packages/components/src/radio/`。

## 离线完整示例源码

- [RadioRadioSimpleDemo](../snapshot/apps/nexus/app/components/content/demos/RadioRadioSimpleDemo.vue.txt)
- [RadioRadioStandardDemo](../snapshot/apps/nexus/app/components/content/demos/RadioRadioStandardDemo.vue.txt)
- [RadioRadioCardDemo](../snapshot/apps/nexus/app/components/content/demos/RadioRadioCardDemo.vue.txt)
- [RadioRadioIndicatorDemo](../snapshot/apps/nexus/app/components/content/demos/RadioRadioIndicatorDemo.vue.txt)
- [RadioRadioDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/RadioRadioDisabledDemo.vue.txt)
- [RadioRadioGroupPlaygroundDemo](../snapshot/apps/nexus/app/components/content/demos/RadioRadioGroupPlaygroundDemo.vue.txt)

## 离线类型与实现参考

- [radio/index.ts](../snapshot/packages/tuffex/packages/components/src/radio/index.ts.txt)
- [src/TxRadio.vue](../snapshot/packages/tuffex/packages/components/src/radio/src/TxRadio.vue.txt)
- [src/TxRadioGroup.vue](../snapshot/packages/tuffex/packages/components/src/radio/src/TxRadioGroup.vue.txt)
- [src/radio-group-indicator.ts](../snapshot/packages/tuffex/packages/components/src/radio/src/radio-group-indicator.ts.txt)
- [src/radio-group-model.ts](../snapshot/packages/tuffex/packages/components/src/radio/src/radio-group-model.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/radio/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
