# ToastPanel 浮出面板

> 从来源下方浮出新条目的面板

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/toast-panel) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/toast-panel.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/toast-panel.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 新条目浮出
虚线牵引把新条目连到它来自的列表；卡片内容完全由宿主提供。
官方示例：`ToastPanelToastPanelDemo`（完整源码见本页末尾）

```vue
<template>
  <TxToastPanel :open="open" :stack="1" aria-label="最新信号">
    <div class="row">Theo Morgan · Pioneer Cloud</div>
  </TxToastPanel>
</template>
```

### 最佳实践

- `tetherLength` 不要太长，否则看不出牵引线连着谁。
- 同一次到达只播报一次：宿主已在别处播报时设 `live="off"`。
- 卡片内容用现成的行组件（如 `TxCardItem`）拼，本组件只负责外层的浮出姿态。
- 隐藏用 `open` 而不是 `v-if`：卸载会切断离场过渡，并让牵引线的盒子塌掉、布局上跳。
- 锚在列表或面板下的最新结果用本组件；与位置无关的一次性提示用 `TxToastHost`。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `open` | `boolean` | `true` | 是否显示；`false` 时仍留在 DOM 中。 |
| `tether` | `boolean` | `true` | 显示虚线牵引。 |
| `tetherLength` | `number` | `28` | 牵引线长度（px），负值按 0 处理。 |
| `side` | `'below' \| 'above'` | `'below'` | 面板在来源下方还是上方；只影响牵引线方向。 |
| `stack` | `number` | `1` | 身后露出的薄片数，夹在 0–2。 |
| `ariaLabel` | `string` | `'Latest item'` | 区域的无障碍名。 |
| `live` | `'polite' \| 'off'` | `'polite'` | 宿主已在别处播报时设 `'off'`，不再设置 `aria-live`。 |

### 插槽

| 插槽名 | 说明 |
|---|---|
| `default` | 卡片内容。 |
| `tether` | 替换默认的虚线牵引。 |

## 概述

- 位置由宿主决定：组件只画牵引线的方向，不定位自己；放在来源元素之后即可。
- 根节点为 `role="status"`，默认带 `aria-live="polite"`，因为面板会在没有用户操作时出现。
- `open` 为 `false` 时只切换类名：opacity 归零并回到位移起点。
- 入场沿 `--tx-ease-spring` 回弹；减少动态效果时去掉位移，只保留淡入。
- `stack` 薄片是 `aria-hidden` 的装饰，不承载内容；上限为 2，第三片露出的边不到一像素。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/toast-panel/`。

## 离线完整示例源码

- [ToastPanelToastPanelDemo](../snapshot/apps/nexus/app/components/content/demos/ToastPanelToastPanelDemo.vue.txt)

## 离线类型与实现参考

- [toast-panel/index.ts](../snapshot/packages/tuffex/packages/components/src/toast-panel/index.ts.txt)
- [src/TxToastPanel.vue](../snapshot/packages/tuffex/packages/components/src/toast-panel/src/TxToastPanel.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/toast-panel/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
