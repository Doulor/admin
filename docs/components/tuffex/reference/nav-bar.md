# NavBar 导航栏

> 页面顶部的标题与操作栏

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/nav-bar) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/nav-bar.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/nav-bar.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

官方示例：`NavBarNavBarDemo`（完整源码见本页末尾）

```vue
<template>
  <TxNavBar title="设置" show-back @back="goBack" @click-right="save">
    <template #right>
      <span>保存</span>
    </template>
  </TxNavBar>
</template>
```

### 自定义左侧与标题
`left` 插槽替换内置返回图标；点击它只派发 `click-left`，不派发 `back`。

```vue
<template>
  <TxNavBar @click-left="openMenu" @click-right="save">
    <template #left>
      <TxIcon name="i-carbon-menu" />
    </template>
    <template #title>
      <strong>工作区</strong>
    </template>
    <template #right>
      保存
    </template>
  </TxNavBar>
</template>
```

### 吸顶

```vue
<template>
  <TxNavBar title="收件箱" fixed :z-index="3200" />
</template>
```

### 最佳实践

- 返回导航监听 `@back`，`@click-left` 留给自定义左侧插槽；内置返回按钮两者都派发，不要同时监听。
- 右侧内容保持简短；标题会省略，但两侧列仍需留出空间。
- 不要在 `left` 或 `right` 内嵌套按钮；两个操作区本身就是按钮。
- 移动端壳层保留 `safeAreaTop=true`，除非外层布局已处理安全区。
- 路由跳转或保存期间设 `disabled`，避免重复触发。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | `''` | 没有 `title` 插槽时居中显示的文本。 |
| `fixed` | `boolean` | `false` | 以 sticky 定位吸附在顶部。 |
| `safeAreaTop` | `boolean` | `true` | 用 `env(safe-area-inset-top)` 渲染顶部安全区占位。 |
| `showBack` | `boolean` | `false` | 没有 `left` 插槽时显示内置返回图标。 |
| `disabled` | `boolean` | `false` | 禁用两侧按钮，不派发事件。 |
| `zIndex` | `number` | `2000` | 层级，写入 `--tx-nav-bar-z-index`。 |
| `backLabel` | `string` | `'Back'` | 内置返回按钮的 `aria-label`，本地化时传入。 |
| `leftLabel` | `string` | `'Navigation left action'` | 无 `left` 插槽且未开 `showBack` 时左侧按钮的 `aria-label`。 |
| `rightLabel` | `string` | `'Navigation right action'` | 无 `right` 插槽时右侧按钮的 `aria-label`。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `back` | `void` | 仅由内置返回按钮派发。 |
| `click-left` | `void` | 点击内置返回按钮或自定义左侧内容时派发。 |
| `click-right` | `void` | 存在 `right` 插槽时，点击右侧派发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `left` | 无 | 替换内置返回图标。 |
| `title` | 无 | 替换居中标题。 |
| `right` | 无 | 右侧操作内容。 |

## 概述

- 根节点是 `<header>`；左右操作区都是原生 `<button type="button">`。
- 内置返回按钮（`showBack` 且没有 `left` 插槽）同时派发 `back` 与 `click-left`；自定义 `left` 只派发 `click-left`。
- 没有内容的操作区处于禁用状态，不派发事件。
- `disabled` 添加 `is-disabled`，禁用两侧按钮并阻断所有事件。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/nav-bar/`。

## 离线完整示例源码

- [NavBarNavBarDemo](../snapshot/apps/nexus/app/components/content/demos/NavBarNavBarDemo.vue.txt)

## 离线类型与实现参考

- [nav-bar/index.ts](../snapshot/packages/tuffex/packages/components/src/nav-bar/index.ts.txt)
- [src/TxNavBar.vue](../snapshot/packages/tuffex/packages/components/src/nav-bar/src/TxNavBar.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/nav-bar/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
