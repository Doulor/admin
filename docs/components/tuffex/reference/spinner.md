# Spinner 加载

> 表示不确定等待的旋转指示器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/spinner) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/spinner.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/spinner.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`SpinnerSpinnerDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSpinner />
</template>
```

### 尺寸
`size` 设置宽高（px）。
官方示例：`SpinnerSpinnerSizesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSpinner :size="12" />
  <TxSpinner :size="16" />
  <TxSpinner :size="24" />
  <TxSpinner :size="32" />
</template>
```

### 显隐切换
`visible` 带内置的进出场过渡；`v-if` 直接挂载或卸载。
官方示例：`SpinnerToggleDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSpinner v-if="showByIf" />
  <TxSpinner :visible="visible" />
</template>
```

### 行内等待
用于按钮、行内状态或遮罩内部的短等待。
官方示例：`ComponentsFeedbackTaskCenterDemo`（完整源码见本页末尾）

```vue
<template>
  <span class="inline-flex items-center gap-2">
    <TxSpinner :size="14" />
    行内等待
  </span>
</template>
```

### 最佳实践

- 只用于不确定的短等待；有数值或阶段进度时用 `TxProgressBar`，整块首屏加载用 `TxLoadingState`。
- 文案放在图标旁边；Spinner 只表达忙碌，不表达完成结果。
- 需要内置进出场过渡时用 `visible`；挂载时机由宿主管理时用 `v-if`。
- 只有 CSS 动效不适合受限表面时才设置 `fallback`。
- 着色时直接在 `TxSpinner` 上设置 `color`；父级的 `color` 不会穿透根节点。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `size` | `number` | `16` | 宽高（px），写入 `--tx-spinner-size`。 |
| `strokeWidth` | `number` | `2` | 环形与 SVG 的线宽，写入 `--tx-spinner-stroke`。 |
| `fallback` | `boolean` | `false` | 渲染 SVG 旋转圆环，替代默认的 ball/ring 动效。 |
| `visible` | `boolean` | `true` | 显示或隐藏，带 `tx-spinner-visibility` 过渡。 |
| `label` | `string` | `'Loading'` | 状态区域的可访问名，出现时被播报；本地化时覆盖。 |

## 概述

- 根节点是 inline-flex 的 `span`，带 `role="status"`、`aria-busy="true"`、`aria-live="polite"`，以 `label` 作为 `aria-label`；不播报完成。
- `visible=false` 时，离场过渡结束后不再渲染。
- `fallback` 渲染 SVG circle，沿用 `size` 与 `strokeWidth`。
- 根节点默认取 `--tx-text-color-secondary` 作为颜色。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/spinner/`。

## 离线完整示例源码

- [SpinnerSpinnerDemo](../snapshot/apps/nexus/app/components/content/demos/SpinnerSpinnerDemo.vue.txt)
- [SpinnerSpinnerSizesDemo](../snapshot/apps/nexus/app/components/content/demos/SpinnerSpinnerSizesDemo.vue.txt)
- [SpinnerToggleDemo](../snapshot/apps/nexus/app/components/content/demos/SpinnerToggleDemo.vue.txt)
- [ComponentsFeedbackTaskCenterDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsFeedbackTaskCenterDemo.vue.txt)

## 离线类型与实现参考

- [spinner/index.ts](../snapshot/packages/tuffex/packages/components/src/spinner/index.ts.txt)
- [src/TxSpinner.vue](../snapshot/packages/tuffex/packages/components/src/spinner/src/TxSpinner.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/spinner/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
