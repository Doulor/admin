# Switch 开关

> 在开与关两种状态间切换的控件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/switch) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/switch.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/switch.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'

const enabled = ref(true)
</script>

<template>
  <TuffSwitch v-model="enabled" />
</template>
```

### 切换状态
点击、Enter 或 Space 切换。
官方示例：`SwitchToggleStateDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffSwitch v-model="first" />
  <TuffSwitch v-model="second" />
</template>
```

### 尺寸
`size` 同时决定文案字号与间距。
官方示例：`SwitchSizesDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffSwitch v-model="enabled" label="小尺寸" size="small" />
  <TuffSwitch v-model="enabled" label="默认尺寸" />
  <TuffSwitch v-model="enabled" label="大尺寸" size="large" />
</template>
```

### 禁用
官方示例：`SwitchDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffSwitch v-model="off" label="禁用 / 关闭" disabled />
  <TuffSwitch v-model="on" label="禁用 / 开启" disabled />
</template>
```

### 加载中
等待服务端确认时设置 `loading`：滑块停在原值并变为旋转环，期间不可切换。
官方示例：`SwitchLoadingDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const enabled = ref(false)
const committing = ref(false)

async function commit(next: boolean) {
  committing.value = true
  try {
    await save(next)
    enabled.value = next
  }
  finally {
    committing.value = false
  }
}
</script>

<template>
  <TuffSwitch :model-value="enabled" :loading="committing" label="异步提交" @change="commit" />
</template>
```

### 文案
`label` 变化时交叉淡入，`labelPlacement` 决定文案在前或在后。默认插槽原样渲染，不带过渡。
官方示例：`SwitchLabelDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffSwitch v-model="compact" label="紧凑模式" />
  <TuffSwitch v-model="telemetry" label="匿名统计" label-placement="start" />
  <TuffSwitch v-model="autoSync" :label="autoSync ? '开' : '关'" />
  <TuffSwitch v-model="autoSync">
    <strong>自动同步</strong>
  </TuffSwitch>
</template>
```

### 自定义颜色
覆盖 `--tuff-switch-active-color`、`--tuff-switch-track-color` 或 `--tuff-switch-thumb-color`。
官方示例：`SwitchCustomColorDemo`（完整源码见本页末尾）

```vue
<template>
  <TuffSwitch v-model="enabled" class="success-switch" />
</template>

<style scoped>
.success-switch {
  --tuff-switch-active-color: var(--tx-color-success);
}
</style>
```

### 设置项
状态文本放在开关外部时，用 `TxTextTransformer` 获得同样的文字过渡。
官方示例：`SwitchSettingsRowDemo`（完整源码见本页末尾）

```vue
<template>
  <div class="settings-row">
    <div>
      <TxTag label="通知" />
      <p>接收系统和插件的重要提醒。</p>
    </div>
    <TxTextTransformer :text="notifications ? '已开启' : '已关闭'" />
    <TuffSwitch v-model="notifications" />
  </div>
</template>
```

### 最佳实践

- 即时生效的布尔设置用 Switch；随表单提交的选项用 Checkbox。
- 需要服务端确认时设置 `loading`，成功后再写回 `modelValue`；失败时只撤下 `loading`。
- `label` 写控件名称（「紧凑模式」）。「已开启」这类状态文本放在外部，用 `TxTextTransformer` 渲染，避免被朗读两次。
- 换色只覆盖 CSS 变量，不改写 `.tuff-switch__track` 的样式规则。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `modelValue` | `boolean` | `false` | 开关状态，配合 `v-model` 使用。 |
| `label` | `string` | - | 轨道旁的文案，变化时交叉淡入。 |
| `labelPlacement` | `'start' \| 'end'` | `'end'` | 文案在轨道前或后。 |
| `size` | `'small' \| 'default' \| 'large'` | `'default'` | 尺寸，同时影响文案字号与间距。 |
| `disabled` | `boolean` | `false` | 禁止切换，并移出 Tab 序列。 |
| `loading` | `boolean` | `false` | 显示旋转环并禁止切换。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `(value: boolean) => void` | 用户切换后触发，参数为新值。 |
| `change` | `(value: boolean) => void` | 与 `update:modelValue` 同时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `default` | - | 自定义文案，优先于 `label`；原样渲染，不带过渡。 |

## 概述

- 根节点是原生 `<button role="switch">`，带 `aria-checked`；有可见文案（`label` 或插槽）时不渲染 `aria-label`。
- 受控组件：切换只派发事件，父级回写 `modelValue` 后外观才更新。
- `disabled` 与 `loading` 都设置原生 `disabled`；`loading` 不降低透明度，并设置 `aria-busy="true"`。
- 滑块走 glide 材质：两端各乘一个弹簧，途中拉长、到位收拢；行进中再次切换会就地转向，不会从头再来。
- 颜色与可见性立即切换，开关随收起的弹层一同隐藏；只有悬停光晕、加载形变与按压反馈带过渡。
- 减少动态效果时，这些过渡一并取消，滑块直接到位，加载环停止旋转。

## 技术实现

- 状态类 `is-active`、`is-disabled`、`is-loading`、`has-label` 挂在根节点；轨道与滑块是 `.tuff-switch__track`、`.tuff-switch__thumb`。滑块填充画在 `::before`，加载环画在 `::after`，加载时两者以透明度交替。
- 滑块静止位置由样式表的 `left` 决定；行进时组件逐帧写入 `translate` 与 `width`，到位后清除，`transform` 留给按压反馈。
- 源码：`packages/tuffex/packages/components/src/switch/`。

## 离线完整示例源码

- [SwitchToggleStateDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchToggleStateDemo.vue.txt)
- [SwitchSizesDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchSizesDemo.vue.txt)
- [SwitchDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchDisabledDemo.vue.txt)
- [SwitchLoadingDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchLoadingDemo.vue.txt)
- [SwitchLabelDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchLabelDemo.vue.txt)
- [SwitchCustomColorDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchCustomColorDemo.vue.txt)
- [SwitchSettingsRowDemo](../snapshot/apps/nexus/app/components/content/demos/SwitchSettingsRowDemo.vue.txt)

## 离线类型与实现参考

- [switch/index.ts](../snapshot/packages/tuffex/packages/components/src/switch/index.ts.txt)
- [src/TxSwitch.vue](../snapshot/packages/tuffex/packages/components/src/switch/src/TxSwitch.vue.txt)
- [style/index.scss](../snapshot/packages/tuffex/packages/components/src/switch/style/index.scss.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
