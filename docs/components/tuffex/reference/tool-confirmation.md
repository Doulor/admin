# Tool Confirmation

> 工具调用前的授权卡片

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tool-confirmation) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tool-confirmation.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tool-confirmation.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`risk` 为 `write` 或 `execute` 时，卡片与允许按钮改用危险色。
官方示例：`ToolConfirmationToolConfirmationDemo`（完整源码见本页末尾）

```vue
<template>
  <TxToolConfirmation
    tool-name="write_file"
    risk="write"
    summary="将改写 src/main.ts"
    :input="JSON.stringify({ path: 'src/main.ts' }, null, 2)"
    @approve="onApprove"
    @deny="onDeny"
  />
</template>
```

### 最佳实践

- 收到决定后立即卸载卡片，不要复用。
- `risk` 如实标注；把写操作标成 `read` 会去掉视觉强调和用户的判断依据。
- `input` 只放决策所需的字段，并预先截断。
- 非英文界面同时覆盖 `allowLabel`、`denyLabel`、`rememberLabel` 与 `riskLabels`。
- `remember` 为真时只在当前会话内生效，不要静默升级为永久授权。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `toolName` | `string` | — | 工具名，也用于可访问名称；必填。 |
| `summary` | `string` | — | 一句话说明工具将做什么；不传则不渲染。 |
| `input` | `string` | — | 序列化的入参预览，在 `<pre>` 中原样显示；不传则不渲染。 |
| `risk` | `'read' \| 'write' \| 'execute'` | `'read'` | 风险等级，同步到 `data-risk`。 |
| `allowLabel` | `string` | `'Allow'` | 允许按钮的文案。 |
| `denyLabel` | `string` | `'Deny'` | 拒绝按钮的文案。 |
| `rememberLabel` | `string` | `'Remember for this session'` | 记住选项的文案。 |
| `riskLabels` | `Partial<Record<'read' \| 'write' \| 'execute', string>>` | — | 按档覆盖 `Read-only`、`Writes data`、`Executes`，可只覆盖部分。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `approve` | `({ remember: boolean })` | 点击允许时触发。 |
| `deny` | `({ remember: boolean })` | 点击拒绝时触发，同样携带 `remember`。 |

## 概述

- 组件不执行工具，也不保存授权，只派发决定；执行与持久化由宿主完成。
- 拒绝同样携带 `remember`，因此「本次会话都拒绝」也能实现。
- `remember` 是内部状态，初值 `false`，派发后不复位：卡片按一次性使用设计。
- 根节点为 `role="group"`，可访问名称为 `${toolName} confirmation`。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/tool-confirmation/`。

## 离线完整示例源码

- [ToolConfirmationToolConfirmationDemo](../snapshot/apps/nexus/app/components/content/demos/ToolConfirmationToolConfirmationDemo.vue.txt)

## 离线类型与实现参考

- [tool-confirmation/index.ts](../snapshot/packages/tuffex/packages/components/src/tool-confirmation/index.ts.txt)
- [src/TxToolConfirmation.vue](../snapshot/packages/tuffex/packages/components/src/tool-confirmation/src/TxToolConfirmation.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
