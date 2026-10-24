# Alert 警告

> 在页面内显示上下文状态的提示横幅

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/alert) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/alert.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/alert.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 类型
`type` 决定配色与默认图标。
官方示例：`AlertAlertVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAlert title="提示" message="检查一下配置项。" type="info" />
  <TxAlert title="成功" message="已保存。" type="success" />
  <TxAlert title="注意" message="有需要处理的内容。" type="warning" />
  <TxAlert title="失败" message="保存失败。" type="error" />
</template>
```

### 常驻提示
属于页面状态、不应被关闭的提示设置 `closable=false`。

```vue
<template>
  <TxAlert
    type="warning"
    title="需要人工复核"
    message="此发布包含未签名产物。"
    :closable="false"
  />
</template>
```

### 自定义标题与正文

```vue
<template>
  <TxAlert type="success" close-label="关闭" @close="dismissed = true">
    <template #title>
      运行时证据已收集
    </template>

    <p>
      Preview 检查通过。可在 evidence 面板查看截图和 trace。
    </p>
  </TxAlert>
</template>
```

### 纯文本

```vue
<template>
  <TxAlert :show-icon="false" message="此页面展示本地 demo 数据。" />
</template>
```

### 最佳实践

- 页面上下文反馈用 Alert，瞬时的操作结果用 Toast。
- 按用户影响选择 `type`：失败用 `error`，风险用 `warning`，中性引导用 `info`。
- 合规、阻塞或始终相关的提示设置 `closable=false`；需要记住关闭状态时在 `close` 中持久化。
- 非英文界面传入 `closeLabel`：关闭按钮只有图标，读屏读到的就是这个名称。
- 文案简短、可执行，不要同时挂载多个新 Alert。
- 操作按钮放在 Alert 之后，不放进正文。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `type` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | 语义类型，决定配色与默认图标。 |
| `title` | `string` | - | 标题；未设置且无 `title` 插槽时不渲染标题行。 |
| `message` | `string` | - | 正文；默认插槽优先。 |
| `closable` | `boolean` | `true` | 显示关闭按钮。 |
| `closeLabel` | `string` | `'Close'` | 关闭按钮的可访问名称。 |
| `showIcon` | `boolean` | `true` | 显示前置语义图标。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `close` | - | 点击关闭按钮时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `title` | - | 自定义标题。 |
| `default` | - | 自定义正文，替换 `message`。 |

### 暴露方法

| 名称 | 类型 | 说明 |
|------|------|------|
| `open` | `() => void` | 重新显示已关闭的 Alert。 |
| `close` | `() => void` | 隐藏 Alert 并派发 `close`。 |

## 概述

- 根节点为 `role="alert"`，挂载时读屏器立即播报。
- `type` 对应的图标为 `info`、`check-circle`、`alert-triangle`、`x-circle`，均为 `TxIcon` 内置图标，无需图标字体。
- 点击关闭按钮会隐藏自身并派发 `close`；宿主仍可用 `v-if` 控制显示。
- 只过渡 opacity 与 transform，不收拢高度；需要收拢空位时用 `<TransitionGroup>` 包裹。
- 减少动态效果时只淡入淡出，不位移。
- 关闭按钮只有图标，带 `aria-label="Close"`。

## 技术实现

- 根节点带 `tx-alert--<type>` 与 `tx-alert--closable` class，外层是 `<Transition name="tx-alert" appear>`；透传属性落在 `.tx-alert` 上。
- 源码：`packages/tuffex/packages/components/src/alert/`。

## 离线完整示例源码

- [AlertAlertVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/AlertAlertVariantsDemo.vue.txt)

## 离线类型与实现参考

- [alert/index.ts](../snapshot/packages/tuffex/packages/components/src/alert/index.ts.txt)
- [src/TxAlert.vue](../snapshot/packages/tuffex/packages/components/src/alert/src/TxAlert.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/alert/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/alert/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
