# StatusBadge 状态徽标

> 以色调、图标与文字表示状态的徽标

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/status-badge) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/status-badge.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/status-badge.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 状态信号
`status` 设置色调；`muted` 渲染为虚线空心环，不带字形。
官方示例：`StatusBadgeSignalsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxStatusBadge text="已通过" status="success" />
  <TxStatusBadge text="待处理" status="warning" />
  <TxStatusBadge text="已取消" status="danger" />
  <TxStatusBadge text="审核中" status="info" />
  <TxStatusBadge text="未开始" status="muted" />
</template>
```

### 后台运营状态
与 `TxStatCard`、`TxProgressBar` 一起汇总发布、构建与同步状态。
官方示例：`ComponentsOperationsStatusDemo`（完整源码见本页末尾）

```vue
<template>
  <TxStatusBadge text="审阅完成" status="success" size="sm" />
  <TxStatusBadge text="构建稳定" status="success" os="linux" size="sm" />
  <TxStatusBadge text="同步健康" status-key="granted" size="sm" />

  <TxStatCard variant="progress" value="99.9%" label="API 可用率" meta="正常" :progress="99" icon-class="i-carbon-cloud-monitoring" />
  <TxStatCard variant="progress" :value="18" label="待处理队列" meta="关注" :progress="64" icon-class="i-carbon-queued" />
</template>
```

### 状态行
官方示例：`StatusBadgeRowDemo`（完整源码见本页末尾）

```vue
<template>
  <TxAvatar name="TA" />
  <TxStatusBadge text="在线" status="success" />
</template>
```

### 最佳实践

- 状态来自 API 或权限枚举时用 `statusKey`；页面本地判断用 `status`。
- 不要只靠颜色传达状态，文案写成「同步健康」「访问被拒绝」这样的完整说法。
- 只在平台差异影响状态含义时使用 `os`。
- 主操作放在旁边的 `TxButton` 上，不要让徽标成为唯一的操作控件。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `text` | `string` | 必填 | 可见文字。 |
| `icon` | `string` | `''` | 自定义图标类名，替代色调默认字形。 |
| `status` | `'success' \| 'warning' \| 'danger' \| 'info' \| 'muted'` | - | 显式色调，优先于 `statusKey`。 |
| `statusKey` | `'granted' \| 'denied' \| 'notDetermined' \| 'unsupported' \| string` | `''` | 映射为色调的权限或状态 key。 |
| `size` | `'sm' \| 'md'` | `'md'` | 徽标密度。 |
| `os` | `'macos' \| 'windows' \| 'linux'` | - | 在状态图标前显示平台图标。 |
| `osOnly` | `boolean` | `false` | 只显示平台图标，隐藏状态图标。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | `MouseEvent` | 点击或在按钮态下按 Enter / Space 时触发。 |

### CSS 变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `--tx-status-chip-size` | `18px`（`sm`：`15px`） | 状态圆盘直径，字形随之缩放；由 `size` 类设在根节点上。 |

## 概述

- 没有点击监听时根节点为 `role="status"`；绑定 `@click` 后变为可聚焦的 `role="button"`，Enter / Space 可触发。
- `status` 优先于 `statusKey`；`statusKey` 映射为：`granted` → success、`denied` → danger、`notDetermined` → warning、`unsupported` → muted，其余为 info。
- 默认字形均为实心，外圈由色盘提供：success `i-carbon-checkmark`、warning `i-carbon-time`、danger `i-carbon-close`、info `i-carbon-information`。
- `muted` 没有字形，渲染为虚线空心环；传入 `icon` 后恢复实心色盘。
- `osOnly` 隐藏状态图标，但保留文字。

## 技术实现

- 色盘取独立的 `--tx-status-chip-*` 色阶而非 `--tx-color-*`，使反白字形对比度不低于 3:1；高对比暗色主题反转为浅盘深字形。
- 标签使用等宽字体；背景是状态色 14% 的浅填充，外圈是 32% 的 1px 内描边，不占布局。
- 源码：`packages/tuffex/packages/components/src/status-badge/`。

## 离线完整示例源码

- [StatusBadgeSignalsDemo](../snapshot/apps/nexus/app/components/content/demos/StatusBadgeSignalsDemo.vue.txt)
- [ComponentsOperationsStatusDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsOperationsStatusDemo.vue.txt)
- [StatusBadgeRowDemo](../snapshot/apps/nexus/app/components/content/demos/StatusBadgeRowDemo.vue.txt)

## 离线类型与实现参考

- [status-badge/index.ts](../snapshot/packages/tuffex/packages/components/src/status-badge/index.ts.txt)
- [src/TxStatusBadge.vue](../snapshot/packages/tuffex/packages/components/src/status-badge/src/TxStatusBadge.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/status-badge/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
