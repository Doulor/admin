# Kbd

> 显示键盘按键的标记

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/kbd) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/kbd.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/kbd.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.7`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 快捷键
官方示例：`KbdKbdDemo`（完整源码见本页末尾）

```vue
<template>
  <TxKbd tone="primary">⌘</TxKbd>
  <TxKbd tone="primary">K</TxKbd>
</template>
```

### 最佳实践

- 组合键拆成多个 `TxKbd`，不要用一个长字符串。
- 键名随平台变化：macOS 用 `⌘`，Windows / Linux 用 `Ctrl`。
- `tone="primary"` 只用于页面或命令的主快捷键，同屏不超过一组。
- 快捷键旁配可见的操作文案，单独出现不易被发现。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `size` | `'sm' \| 'md'` | `'sm'` | `sm` 用于行内帮助与菜单快捷键，`md` 用于单独展示的快捷键。 |
| `tone` | `'default' \| 'primary'` | `'default'` | `primary` 突出主快捷键。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 键位文本，如 `⌘`、`Ctrl` 或 `K`。 |

## 概述

- 根节点是原生 `<kbd>`。
- 只渲染默认插槽，没有内部状态。
- `tone="primary"` 只改变外观，不改动插槽文本。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/kbd/`。

## 离线完整示例源码

- [KbdKbdDemo](../snapshot/apps/nexus/app/components/content/demos/KbdKbdDemo.vue.txt)

## 离线类型与实现参考

- [kbd/index.ts](../snapshot/packages/tuffex/packages/components/src/kbd/index.ts.txt)
- [src/TxKbd.vue](../snapshot/packages/tuffex/packages/components/src/kbd/src/TxKbd.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/kbd/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
