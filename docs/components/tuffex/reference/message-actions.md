# Message Actions

> 消息下方的操作条，内置复制、重新生成与朗读

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/message-actions) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/message-actions.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/message-actions.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`MessageActionsMessageActionsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxMessageActions
    copy-text="要复制的回答正文"
    regenerable
    @copy="onCopy"
    @regenerate="onRegenerate"
  >
    <button type="button">分享</button>
  </TxMessageActions>
</template>
```

### 最佳实践

- 自定义操作用原生 `<button>` 或带 `tabindex` 的元素；不可聚焦的元素不会进入方向键顺序。
- 剪贴板写入失败时 `copy` 照常触发；需要兜底就在 `copy` 中处理，不要另写一份复制。
- 本地化时一并覆盖 `copyLabel`、`copiedLabel`、`regenerateLabel`、`speakLabel`、`stopSpeakLabel` 与 `label`。
- 消息流式输出结束后再挂载操作条，避免复制到半截内容。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `copyText` | `string` | — | 复制按钮写入的文本；未传时不渲染复制按钮。 |
| `regenerable` | `boolean` | `false` | 显示重新生成按钮。 |
| `speakable` | `boolean` | `false` | 显示朗读按钮；播放由宿主负责。 |
| `speakState` | `'idle' \| 'loading' \| 'speaking'` | `'idle'` | 宿主回写的播放状态：`loading` 显示旋转环，`speaking` 显示停止图标。 |
| `appear` | `boolean` | `true` | 挂载时播放模糊淡入。 |
| `copyLabel` | `string` | `'Copy'` | 复制按钮的可访问名称与悬停提示。 |
| `copiedLabel` | `string` | `'Copied'` | 已复制状态的可访问名称与悬停提示。 |
| `regenerateLabel` | `string` | `'Regenerate'` | 重新生成按钮的可访问名称与悬停提示。 |
| `label` | `string` | `'Message actions'` | 工具栏的可访问名称。 |
| `speakLabel` | `string` | `'Read aloud'` | 朗读按钮的可访问名称与悬停提示。 |
| `stopSpeakLabel` | `string` | `'Stop reading'` | `speaking` 时朗读按钮的可访问名称与悬停提示。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `copy` | `(text: string)` | 点击复制后触发，携带 `copyText`；剪贴板写入失败时同样触发。 |
| `regenerate` | — | 点击重新生成时触发。 |
| `speak` | — | 点击朗读按钮时触发。 |

### 插槽

| 插槽名 | 说明 |
|------|------|
| `default` | 追加在内置按钮之后；其中的可聚焦元素自动加入方向键顺序。 |

## 概述

- `copyText` 为空字符串时仍渲染复制按钮，但点击无效果；要隐藏就不传。
- 复制写入 `navigator.clipboard`，随后按钮进入「已复制」态 1200ms，期间忽略重复点击。
- 朗读按钮是开关：任何状态下点击都派发 `speak`（含 `loading`），由宿主开始或停止播放；`speaking` 时 `aria-pressed="true"`。
- `role="toolbar"`：只占一个 Tab 落点，方向键在控件间循环移动，Home / End 跳到首尾。
- 方向键顺序实时读取 DOM（`button:not([disabled])`、`[href]`、`tabindex` 非 -1），禁用按钮被排除。

## 离线完整示例源码

- [MessageActionsMessageActionsDemo](../snapshot/apps/nexus/app/components/content/demos/MessageActionsMessageActionsDemo.vue.txt)

## 离线类型与实现参考

- [message-actions/index.ts](../snapshot/packages/tuffex/packages/components/src/message-actions/index.ts.txt)
- [src/TxMessageActions.vue](../snapshot/packages/tuffex/packages/components/src/message-actions/src/TxMessageActions.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
