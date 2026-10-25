# LoadingOverlay 加载遮罩

> 覆盖内容区域或全屏的加载遮罩

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/loading-overlay) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/loading-overlay.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/loading-overlay.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

<script setup lang="ts">
import { ref } from 'vue'
const loading = ref(false)
</script>

## 用法

### 容器内
遮罩盖在默认插槽上，底层内容保持可见。
官方示例：`LoadingOverlayLoadingOverlayContainerDemo`（完整源码见本页末尾）

```vue
<template>
  <TxButton @click="loading = !loading">Toggle</TxButton>
  <TxLoadingOverlay :loading="loading" text="Loading...">
    <div class="content">Content</div>
  </TxLoadingOverlay>
</template>
```

### 全屏
`fullscreen` 把遮罩 teleport 到 `body` 并覆盖视口，不渲染默认插槽。
官方示例：`LoadingOverlayLoadingOverlayFullscreenDemo`（完整源码见本页末尾）

```vue
<template>
  <TxButton @click="loading = !loading">Toggle</TxButton>
  <TxLoadingOverlay fullscreen :loading="loading" text="Loading..." />
</template>
```

### 后台任务
局部遮罩与 Toast、Tooltip、Spinner 组合；刷新期间任务队列保持可见，布局不跳动。
官方示例：`ComponentsFeedbackTaskCenterDemo`（完整源码见本页末尾）

```vue
<template>
  <TxLoadingOverlay :loading="syncing" text="正在刷新任务队列…" :spinner-size="22">
    <TxProgressBar :percentage="72" status="warning" />
    <TxProgressBar :percentage="96" status="success" />
  </TxLoadingOverlay>
</template>
```

### 最佳实践

- 刷新、保存、重算等已有内容的短等待用局部遮罩，让旧内容保持可见。
- `fullscreen` 只用于必须阻断全局操作的流程，如启动、切换工作区或不能并行的危险操作。
- 文案写具体动作：「正在刷新任务队列…」比「Loading…」更有用。
- 首屏内容尚不存在时用 `TxLoadingState` 或骨架屏，不要套遮罩。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `loading` | `boolean` | `false` | 显示遮罩。 |
| `fullscreen` | `boolean` | `false` | teleport 到 `body` 并覆盖整个视口。 |
| `text` | `string` | `''` | spinner 下方的文案；省略时只显示 spinner。 |
| `spinnerSize` | `number` | `18` | spinner 尺寸（px）。 |
| `background` | `string` | `'color-mix(in srgb, var(--tx-bg-color, #fff) 70%, transparent)'` | 遮罩背景，写入 `--tx-loading-overlay-bg`。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|-------|------|
| `default` | - | 局部模式下被遮罩覆盖的内容；全屏模式不渲染。 |

## 概述

- 局部模式把默认插槽包在 `position: relative` 容器中，只在 `loading` 时渲染绝对定位的遮罩。
- 全屏模式每次打开都获取新的共享 z-index。
- 遮罩带 `role="status"` 与 `aria-live="polite"`，读屏器会播报 `text`，无需另行播报。
- 全屏模式把焦点停在遮罩上并拦截 Tab，关闭后焦点回到原来的元素。
- 遮罩没有模态语义（无 `aria-modal`）；需要模态时用 `TxModal` 或 Dialog 组件。

## 技术实现

- 遮罩通过 `backdrop-filter` 叠加模糊与饱和度。
- 源码：`packages/tuffex/packages/components/src/loading-overlay/`。

## 离线完整示例源码

- [LoadingOverlayLoadingOverlayContainerDemo](../snapshot/apps/nexus/app/components/content/demos/LoadingOverlayLoadingOverlayContainerDemo.vue.txt)
- [LoadingOverlayLoadingOverlayFullscreenDemo](../snapshot/apps/nexus/app/components/content/demos/LoadingOverlayLoadingOverlayFullscreenDemo.vue.txt)
- [ComponentsFeedbackTaskCenterDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsFeedbackTaskCenterDemo.vue.txt)

## 离线类型与实现参考

- [loading-overlay/index.ts](../snapshot/packages/tuffex/packages/components/src/loading-overlay/index.ts.txt)
- [src/TxLoadingOverlay.vue](../snapshot/packages/tuffex/packages/components/src/loading-overlay/src/TxLoadingOverlay.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
