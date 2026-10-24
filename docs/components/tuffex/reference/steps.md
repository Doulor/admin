# Steps 步骤条

> 显示流程进度的步骤序列

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/steps) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/steps.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/steps.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 数字键与字符串键
数字键按 `active` 自动推断已完成的步骤；字符串键需显式设置 `status`。
官方示例：`StepsStepsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSteps :active="1">
    <TxStep title="开始" description="收集基础信息" :step="0" />
    <TxStep title="填写" description="补充详细内容" :step="1" />
    <TxStep title="完成" description="确认提交" :step="2" />
  </TxSteps>

  <TxSteps direction="vertical" size="small" active="review">
    <TxStep title="草稿" description="内容已保存" step="draft" status="completed" />
    <TxStep title="审核" description="等待负责人确认" step="review" icon="i-carbon-in-progress" />
    <TxStep title="发布" description="审核后解锁" step="publish" disabled />
  </TxSteps>
</template>
```

### 最佳实践

- 线性表单与新手引导用数字键，让完成状态自动推断。
- 命名工作流用字符串键，并显式设置 `completed` 或 `error` 状态。
- 后续步骤依赖前置条件时，把它们设为 `disabled`。
- 权威的流程状态保存在父级；`TxSteps` 只是进度提示，不是路由或表单状态的来源。
- 步骤描述保持简短；需要段落或控件时放在步骤条下方。

## API 参考

### TxSteps

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `active` | `number \| string` | `0` | 当前步骤键；变化时同步到内部状态。 |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | 布局方向。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 尺寸，传给子步骤。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | `TxStep` 子项。 |

### TxStep

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | - | 步骤标题。 |
| `description` | `string` | - | 辅助说明。 |
| `icon` | `string` | - | 未完成时显示的图标名或 class。 |
| `status` | `'wait' \| 'active' \| 'completed' \| 'error'` | `'wait'` | 手动状态；当前项与数字完成推断优先于它。 |
| `step` | `number \| string` | 子项顺序 | 步骤键；未提供时用从 0 开始的子项顺序。字符串键按子项顺序编号。 |
| `clickable` | `boolean` | `true` | 渲染按钮头部，点击更新内部当前步骤。 |
| `disabled` | `boolean` | `false` | 禁用步骤按钮并阻止激活。 |
| `showLine` | `boolean` | `true` | 渲染连接线；最后一步始终没有。 |
| `completedIcon` | `string` | `'check'` | 完成状态显示的图标。 |

## 概述

- `TxSteps` 是 `role="list"`，每个 `TxStep` 是 `role="listitem"`；当前步骤的头部带 `aria-current="step"`。
- 可点击步骤的头部是原生 `<button type="button">`，不可点击时是 `<div>`；禁用时按钮禁用并忽略激活。
- 点击只更新 `TxSteps` 内部的当前步骤，不派发事件，也不回写父级。
- 数字键在数字 `active` 之前时视为已完成；字符串键需显式设置 `status="completed"`。
- 未提供 `step` 时按子项顺序注册，以从 0 开始的索引作键。
- 减少动态效果时关闭全部动效，保留状态颜色。

## 技术实现

- 动效全部由 CSS 编排：完成的标记换成对勾，连接线扫向下一个标记，新的当前标记随后弹入。
- 源码：`packages/tuffex/packages/components/src/steps/`。

## 离线完整示例源码

- [StepsStepsDemo](../snapshot/apps/nexus/app/components/content/demos/StepsStepsDemo.vue.txt)

## 离线类型与实现参考

- [steps/index.ts](../snapshot/packages/tuffex/packages/components/src/steps/index.ts.txt)
- [src/TxStep.vue](../snapshot/packages/tuffex/packages/components/src/steps/src/TxStep.vue.txt)
- [src/TxSteps.vue](../snapshot/packages/tuffex/packages/components/src/steps/src/TxSteps.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/steps/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/steps/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
