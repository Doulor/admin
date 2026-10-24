# Rating 评分

> 以星级选择分值的输入控件

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/rating) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/rating.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/rating.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 半星
`precision="0.5"` 时，再次点击已选中的整星会切换为半星。

官方示例：`RatingBasicDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'

const score = ref(3.5)
</script>

<template>
  <TxRating v-model="score" :precision="0.5" show-text />
</template>
```

### 自定义图标
`icon` 统一设置，`filledIcon` / `emptyIcon` / `halfIcon` 逐项覆盖；支持内置图标、Iconify class 与 emoji。

官方示例：`RatingIconDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRating v-model="diamond" icon="💎" show-text />
  <TxRating v-model="hearts" icon="i-carbon-favorite-filled" filled-color="#f43f5e" :precision="0.5" />
  <TxRating v-model="faces" filled-icon="😍" empty-icon="😶" :precision="0.5" />
</template>
```

### 点击动画
默认播放弹跳、光晕与波纹，`:animated="false"` 关闭。

官方示例：`RatingAnimationDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRating v-model="score" :precision="0.5" show-text />
  <TxRating v-model="still" :animated="false" show-text />
</template>
```

### 自定义样式
颜色、`size` 与 `gap` 都有对应属性；`#text` 插槽改写分数文本。

官方示例：`RatingStyleDemo`（完整源码见本页末尾）

```vue
<template>
  <TxRating
    v-model="score"
    :size="30"
    :gap="8"
    filled-color="#f97316"
    empty-color="rgba(249, 115, 22, 0.2)"
    hover-color="#fb923c"
    text-color="#f97316"
    show-text
  />

  <TxRating v-model="score" readonly show-text>
    <template #text="{ value, max }">
      {{ value }} / {{ max }} readonly
    </template>
  </TxRating>
</template>
```

### 最佳实践

- 只有半步差异有意义时才用 `precision="0.5"`；粗略的满意度用整星。
- 不可输入时用 `disabled`，展示历史评分时用 `readonly`。
- 精确数值重要时开启 `showText` 或提供 `#text` 插槽。
- 图标集的状态对比不清晰时，改用统一的 `icon`，靠颜色区分状态。
- 在密集表单与表格中关闭 `animated`。

## API 参考

### 属性
```yaml
rows:
  - name: modelValue
    type: number
    default: '0'
    description: 当前评分，配合 `v-model` 使用。
  - name: maxStars
    type: number
    default: '5'
    description: 星级数量。
  - name: precision
    type: "number | 0.5"
    default: '1'
    description: 步进精度；`0.5` 启用半星，其他值只决定分数文本的小数位数。
  - name: showText
    type: boolean
    default: 'false'
    description: 在星级后显示分数文本。
  - name: disabled
    type: boolean
    default: 'false'
    description: 禁止评分，根节点标记 `aria-disabled`。
  - name: readonly
    type: boolean
    default: 'false'
    description: 只展示评分，根节点标记 `aria-readonly`。
  - name: icon
    type: "string | TxIconSource"
    default: '-'
    description: 填充层与空态层共用的图标，状态图标优先。
  - name: filledIcon
    type: "string | TxIconSource"
    default: 'star'
    description: 已填充图标；未设置时依次回退到 `icon`、`star`。
  - name: emptyIcon
    type: "string | TxIconSource"
    default: 'star'
    description: 空态图标；未设置时依次回退到 `icon`、`star`。
  - name: halfIcon
    type: "string | TxIconSource"
    default: '-'
    description: 半星图标；未设置时从左侧裁切填充层。
  - name: filledColor
    type: string
    default: '#fbbf24'
    description: 已填充图标的颜色。
  - name: emptyColor
    type: string
    default: '#d1d5db'
    description: 空态图标的颜色。
  - name: hoverColor
    type: string
    default: 'filledColor'
    description: 悬停时填充层的颜色。
  - name: textColor
    type: string
    default: '#6b7280'
    description: 分数文本的颜色。
  - name: size
    type: "number | string"
    default: '20px'
    description: 星级图标大小；数字按 px 处理。
  - name: gap
    type: "number | string"
    default: '2px'
    description: 星级间距；数字按 px 处理。
  - name: animated
    type: boolean
    default: 'true'
    description: 选中后播放弹跳与波纹动效。
  - name: starLabel
    type: "(star: number) => string"
    default: '-'
    description: 每颗星的无障碍标签，默认为英文 `Rate N star(s)`。
```

### 事件

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `(value: number)` | 点击可交互的星级后携带新评分触发。 |
| `change` | `(value: number)` | 与 `update:modelValue` 同时触发。 |

### 插槽

| 插槽名 | 参数 | 说明 |
|--------|------|------|
| `text` | `{ value: number, max: number }` | `showText` 开启时替换默认的 `value / max` 文本。 |

## 概述

- 星级行渲染为 `role="radiogroup"`，每颗星是一个 `role="radio"` 按钮。
- 键盘：整行只占一个 Tab 停留点；ArrowRight / ArrowUp 选中后一颗星，ArrowLeft / ArrowDown 选中前一颗，到头不循环；Home / End 选中首尾。按键只选整星，落在当前星上时评分不变。
- `disabled` 与 `readonly` 都阻止更新，评分照常显示。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/rating/`；导出类型 `RatingProps`、`RatingEmits`、`RatingIcon`。

## 离线完整示例源码

- [RatingBasicDemo](../snapshot/apps/nexus/app/components/content/demos/RatingBasicDemo.vue.txt)
- [RatingIconDemo](../snapshot/apps/nexus/app/components/content/demos/RatingIconDemo.vue.txt)
- [RatingAnimationDemo](../snapshot/apps/nexus/app/components/content/demos/RatingAnimationDemo.vue.txt)
- [RatingStyleDemo](../snapshot/apps/nexus/app/components/content/demos/RatingStyleDemo.vue.txt)

## 离线类型与实现参考

- [rating/index.ts](../snapshot/packages/tuffex/packages/components/src/rating/index.ts.txt)
- [src/TxRating.vue](../snapshot/packages/tuffex/packages/components/src/rating/src/TxRating.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/rating/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/rating/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
