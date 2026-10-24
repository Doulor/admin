# PrismGlow 棱镜光

> 从元素一条边升起、横向流动的光谱光锥

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/prism-glow) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/prism-glow.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/prism-glow.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

```bash
pnpm add @talex-touch/tuffex
```

```typescript
import { TxPrismGlow } from '@talex-touch/tuffex/prism-glow'
import '@talex-touch/tuffex/prism-glow/style.css'
import '@talex-touch/tuffex/base.css' // 设计令牌与重置样式，全应用引入一次
```

## 用法

### 卡片
根元素就是卡片：背景与圆角写在根元素上，光画在背景之上、插槽之下。
官方示例：`PrismGlowShowcaseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxPrismGlow
    class="canvas-card"
    :active="active"
    palette="spectrum"
    placement="bottom"
    :intensity="1"
    :duration="6"
  >
    <strong>正在生成画布</strong>
    <span>根据提示词生成 3 个图层</span>
  </TxPrismGlow>
</template>

<style scoped>
/* 背景和圆角给根元素：光层画在它的背景之上、插槽之下 */
.canvas-card {
  border-radius: 16px;
  background: var(--tx-bg-color-overlay);
}
</style>
```

### 变高即收起
宿主变高时，光在约 140ms 内缩回边缘，不走淡出；之后保持关闭，直到 `active` 关掉再打开。
官方示例：`PrismGlowGrowDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { nextTick, ref } from 'vue'

const active = ref(true)
const loaded = ref(false)

// 收起会一直保持，直到 active 关掉再打开
async function reset() {
  loaded.value = false
  active.value = false
  await nextTick()
  active.value = true
}
</script>

<template>
  <TxPrismGlow :active="active">
    <strong>会议摘要</strong>
    <span role="status">{{ loaded ? '已生成 3 条要点' : '正在生成摘要…' }}</span>
    <ul v-if="loaded">…</ul>
  </TxPrismGlow>
  <TxButton :disabled="loaded" @click="loaded = true">加载内容</TxButton>
  <TxButton :disabled="!loaded" @click="reset">重置</TxButton>
</template>
```

### 覆盖层
不传插槽时铺在宿主内容背后（CoreBox 搜索栏的用法）：宿主须是层叠上下文，根元素绝对定位到 `z-index: -1`。
官方示例：`PrismGlowSearchDemo`（完整源码见本页末尾）

```vue
<template>
  <form class="search-bar" role="search" @submit.prevent="search">
    <TxPrismGlow class="search-bar__glow" :active="searching" />
    <input aria-label="搜索应用、文件与命令">
    <TxButton native-type="submit">搜索</TxButton>
    <!-- 组件不播报，状态文字由宿主提供 -->
    <span class="sr-only" role="status">{{ searching ? '正在搜索' : '' }}</span>
  </form>
</template>

<style scoped>
/* 宿主是层叠上下文：光层的 z-index: -1 落在它的背景之上 */
.search-bar {
  position: relative;
  z-index: 0;
}

/* 根元素的 position: relative 特异性为零，这里直接覆盖 */
.search-bar__glow {
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
}
</style>
```

### 最佳实践

- 只在进行中打开：开始时把 `active` 设为 `true`，结束时设回 `false`；不要当常驻装饰。
- 光在固定高度的区域里时，用 `growTarget` 指向会变高的外层容器；宿主加载中本就会变高时，才关掉 `collapseOnGrow`。
- 组件不渲染文字也不播报，旁边要有可见状态文字或 `role="status"` 区域（可 sr-only）。
- 背景写在根元素或宿主上，不写在插槽里，否则光会被盖住。
- 主要文字放在远离光源的一侧；一个视图只放一处。

## API 参考

### 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `active` | `boolean` | `true` | 开 / 关；打开 0.3s 淡入，关闭 0.45s 淡出后卸载。 |
| `palette` | `'spectrum' \| 'accent'` | `'spectrum'` | `spectrum` 横跨整个色环；`accent` 取 `--tx-color-primary` 的相邻色相。 |
| `placement` | `'bottom' \| 'top'` | `'bottom'` | 光升起的边；两种都从左往右流动。 |
| `intensity` | `number` | `1` | 光层不透明度，钳制到 0–1，非有限数按 `1`；不影响插槽。 |
| `duration` | `number` | `6` | 流速基准（秒），越小越快；不是正的有限数时回退到 `6`。 |
| `collapseOnGrow` | `boolean` | `true` | 被监听元素变高超过 8px 时，光约 140ms 内缩回边缘。 |
| `growTarget` | `HTMLElement \| null` | `null` | `collapseOnGrow` 监听的元素；`null` 为组件根元素。 |

### 插槽

| 插槽 | 说明 |
|------|------|
| `default` | 渲染在光层之上的内容；不传时组件可作覆盖层。 |

### CSS 变量

由属性写入根元素内联样式，改值请用属性：

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-prism-glow-intensity` | `intensity` | 光层不透明度，已钳制到 0–1。 |
| `--tx-prism-glow-duration` | `duration` | 流速基准，带 `s` 单位。 |

以下声明在根元素上，亮色、暗色各有一套默认值：

| 变量 | 亮色 | 暗色 | 说明 |
|------|------|------|------|
| `--tx-prism-glow-l` / `--tx-prism-glow-c` | `0.76` / `0.19` | `0.74` / `0.19` | 光锥颜色的 oklch 亮度与彩度。 |
| `--tx-prism-glow-l-core` / `-c-core` / `-a-core` | `0.78` / `0.18` / `0.5` | `0.95` / `0.05` / `0.78` | 贴边核心的亮度、彩度与不透明度。 |
| `--tx-prism-glow-a-halo` | `0.22` | `0.3` | 光晕不透明度。 |
| `--tx-prism-glow-a-fringe` | `0.3` | `0.44` | 两侧色散晕边的不透明度。 |
| `--tx-prism-glow-a-ray` | `0.05` | `0.07` | 竖向光柱的不透明度。 |
| `--tx-prism-glow-blend` | `normal` | `plus-lighter` | 光锥之间的混合模式。 |
| `--tx-prism-glow-reach` | `1` | `1` | 光锥高度系数；高对比模式为 `0.45`，收起时的离场光层为 `0`。 |

- 覆盖时选择器要比组件的主题块更具体（亮色 `.tx-prism-glow`，暗色 `:is([data-theme='dark'], .dark) .tx-prism-glow`），并给暗色单独写一份。
- `--tx-pg-*` 是内部变量，不属于 API。

## 概述

- 根元素 `div.tx-prism-glow` 带 `tx-prism-glow--{palette}`、`tx-prism-glow--{placement}` 修饰类（收起时另带 `is-collapsing`），`isolation: isolate` 自成层叠上下文；它的 `position: relative` 写在 `:where()` 里，特异性为零。
- 光层 `.tx-prism-glow__field` 是 `absolute; inset: 0; z-index: -1`：画在根元素背景之上、插槽之下，按根元素圆角裁切，带 `aria-hidden="true"` 且不接收指针事件。
- 光亮着或正在淡出时，被监听元素比亮起以来的最低高度高出 8px 以上即收起，离场光层固定在变高前的高度；变矮和 8px 以内的变化不触发，收起后直到 `active` 重新打开才恢复。
- 暗色看祖先：带 `[data-theme='dark']` 或 `.dark` 时用暗色参数（近白核心、`plus-lighter` 叠加），否则用亮色参数；没有主题属性。
- 减少动态效果时，动画与过渡全部停止，六束光锥停在从左到右铺满的静态画面，光层随 `active` 立即出现或消失。
- 高对比模式（`html.contrast`、`html[data-tx-contrast='high']`，或 `prefers-contrast: more` 且无 `html[data-tx-contrast='normal']`）下，光锥收成贴边的一条带，光柱隐藏。

## 技术实现

- 只动合成器属性（`translate`、`scale`、`opacity`），没有 JS 帧循环，主线程繁忙时照样流畅。
- 观感参考 George Hastings（@soulegit）2026-09-23 发布的 Unicorn Studio「New AI canvas loading state」视频，只借鉴观感，没有代码来源。
- 源码：`packages/tuffex/packages/components/src/prism-glow/`，光锥参数在 `cones.ts`。



## 使用场景

- 卡片、输入框、搜索栏或消息输入框的加载 / 工作中状态。
- 较长的 AI 生成（画布、图片、长回答）的等待期。
- CoreBox 搜索栏的「搜索中」状态。

## 相关组件

- [BorderBeam 流光边框](./border-beam.md)：沿边框游走或呼吸的光束；画的是边框，不是从边缘升起的光锥。
- [ThinkingOrb 思考指示球](./thinking-orb.md)：自带 `label` 的独立指示球；要让已有的卡片或输入框本身亮起来，用棱镜光。
- [GlowText 扫光](./glow-text.md)：在文字或卡片上扫过一道高光。

## 离线完整示例源码

- [PrismGlowShowcaseDemo](../snapshot/apps/nexus/app/components/content/demos/PrismGlowShowcaseDemo.vue.txt)
- [PrismGlowGrowDemo](../snapshot/apps/nexus/app/components/content/demos/PrismGlowGrowDemo.vue.txt)
- [PrismGlowSearchDemo](../snapshot/apps/nexus/app/components/content/demos/PrismGlowSearchDemo.vue.txt)

## 离线类型与实现参考

- [prism-glow/index.ts](../snapshot/packages/tuffex/packages/components/src/prism-glow/index.ts.txt)
- [src/TxPrismGlow.vue](../snapshot/packages/tuffex/packages/components/src/prism-glow/src/TxPrismGlow.vue.txt)
- [src/cones.ts](../snapshot/packages/tuffex/packages/components/src/prism-glow/src/cones.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/prism-glow/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
