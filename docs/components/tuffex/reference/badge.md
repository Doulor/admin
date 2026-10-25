# Badge 徽标

> 紧凑的计数、状态或圆点标记

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/badge) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/badge.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/badge.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 变体
官方示例：`BadgeBadgeVariantsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBadge :value="count" />
  <TxBadge value="New" variant="primary" />
  <TxBadge value="99+" variant="success" />
  <TxBadge dot variant="error" />
</template>
```

### 弹出动效
切换 `open` 时徽标滑入或弹出，关闭后保留占位；数字只滚动改变的位。
官方示例：`BadgeBadgeMotionDemo`（完整源码见本页末尾）

```vue
<template>
  <span style="position: relative; display: inline-flex">
    <TxButton variant="secondary">收件箱</TxButton>
    <TxBadge variant="error" :value="count" :open="hasUnread" class="corner" />
  </span>
</template>

<style scoped>
.corner {
  position: absolute;
  top: -8px;
  right: -10px;
  pointer-events: none;
}
</style>
```

### 自定义插槽内容

```vue
<template>
  <TxBadge variant="primary">
    <strong>Beta</strong>
  </TxBadge>
</template>
```

### 自定义颜色

```vue
<template>
  <TxBadge value="Internal" color="#111827" />
</template>
```

### 圆点提示

```vue
<template>
  <TxFlex align="center" gap="8px">
    <TxBadge dot variant="error" />
    <span>服务降级</span>
  </TxFlex>
</template>
```

### 最佳实践

- 计数与简短状态用 `TxBadge`；需要状态图标或权限映射时用 `TxStatusBadge`。
- 文本保持简短，徽标不换行。
- 角标由宿主定位；`open` 绑定未读状态，不要另加 transform。
- 关键状态不要只靠圆点颜色，旁边配文字。
- 语义状态用 `variant`，`color` 只用于品牌色或自定义分类。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `variant` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'error'` | `'default'` | 语义配色。 |
| `value` | `number \| string` | `0` | 无插槽且非 `dot` 时的文本；数字按位滚动。 |
| `color` | `string` | - | 自定义背景色，文字随之变白。 |
| `dot` | `boolean` | `false` | 渲染圆点，不显示文本。 |
| `open` | `boolean` | `true` | 显隐；切换时播放动效，关闭后保留占位。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 自定义内容，优先于 `value`；`dot` 时忽略。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-badge-bg` | `variant` / `color` | 背景色。 |
| `--tx-badge-text` | `variant` / `color` | 文字色。 |
| `--tx-badge-border` | `variant` | 边框色。 |
| `--tx-badge-dot` | `color` | `dot` 圆点的填充色，未设置时用文字色。 |
| `--tx-badge-offset-x` / `--tx-badge-offset-y` | 调用方 | 滑入起点偏移，默认 `-8.2px` / `12.4px`。 |
| `--tx-badge-slide-dur` | 调用方 | 滑入时长，默认 `260ms`。 |
| `--tx-badge-pop-dur` / `--tx-badge-pop-close-dur` | 调用方 | 弹出 / 收起时长，默认 `500ms` / `180ms`。 |
| `--tx-badge-fade-dur` / `--tx-badge-fade-close-dur` | 调用方 | 淡入 / 淡出时长，默认 `400ms` / `180ms`。 |
| `--tx-badge-blur` | 调用方 | 收起态的模糊量，默认 `2px`。 |
| `--tx-badge-slide-ease` / `--tx-badge-pop-ease` / `--tx-badge-close-ease` | 调用方 | 三段动效的缓动。 |

## 概述

- 根节点是内联的 pill `span`。
- `dot` 时只渲染 `.tx-badge__dot`；否则默认插槽优先于 `value`。
- `value` 默认为 `0`：不传插槽也不开 `dot` 时显示 `0`。
- 数字 `value` 按位值滚动（9 → 10 是长出一位，而非整体替换）；字符串与插槽原样渲染。
- `open` 的动效只在切换时播放，首次挂载不播放；减少动态效果时停用，数字直接写入新值。
- 没有点击事件、定位、溢出截断或锚定逻辑；交互绑定在外层控件上。

## 技术实现

- 数字经 `TxTextMorph` 渲染，徽标宽度跟随它的容器动画，不另行测量。
- 源码：`packages/tuffex/packages/components/src/badge/`。

## 离线完整示例源码

- [BadgeBadgeVariantsDemo](../snapshot/apps/nexus/app/components/content/demos/BadgeBadgeVariantsDemo.vue.txt)
- [BadgeBadgeMotionDemo](../snapshot/apps/nexus/app/components/content/demos/BadgeBadgeMotionDemo.vue.txt)

## 离线类型与实现参考

- [badge/index.ts](../snapshot/packages/tuffex/packages/components/src/badge/index.ts.txt)
- [src/TxBadge.vue](../snapshot/packages/tuffex/packages/components/src/badge/src/TxBadge.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/badge/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/badge/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
