# OfflineState 离线

> 网络不可用时显示的状态视图

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/offline-state) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/offline-state.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/offline-state.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`OfflineStateOfflineStateDemo`（完整源码见本页末尾）

```vue
<template>
  <TxOfflineState
    surface="card"
    title="网络不可用"
    description="检查连接后重试，离线期间不会覆盖当前草稿。"
    :primary-action="{ label: '重试连接', type: 'primary' }"
  />
</template>
```

### 最佳实践

- 用于可恢复的网络或离线状态；与网络无关的服务端失败用 `TxErrorState` 或业务专用的错误组件。
- 告诉用户本地草稿、排队操作或缓存数据是否仍然安全。
- 主操作聚焦重试，不放破坏性操作。
- 面板内用 `surface="card"`，与加载后的内容共用同一个容器。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `offline`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | 预设标题 | 覆盖预设标题。 |
| `description` | `string` | 预设描述 | 说明网络问题，以及当前工作是否安全。 |
| `icon` | `TxIconSource \| string \| null` | 预设插画 | 替换插画；`null` 隐藏图标区。 |
| `iconSize` | `number` | 尺寸预设 | 图标尺寸（px）。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 布局方向。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 内容对齐。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 间距与插画尺寸。 |
| `surface` | `'plain' \| 'card'` | `'plain'` | `card` 添加卡片边框。 |
| `primaryAction` | `EmptyStateAction` | - | 生成主操作。 |
| `secondaryAction` | `EmptyStateAction` | - | 生成次操作。 |
| `actionSize` | `TxButtonProps['size']` | `'sm'` | 生成按钮的默认尺寸。 |
| `loading` | `boolean` | `false` | 无自定义图标时显示 spinner。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `primary` | - | 点击生成的主操作时触发。 |
| `secondary` | - | 点击生成的次操作时触发。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `icon` | - | 替换插画或图标。 |
| `title` | - | 替换标题。 |
| `description` | - | 替换描述。 |
| `actions` | - | 替换生成的主/次操作按钮。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/offline-state/`。

## 离线完整示例源码

- [OfflineStateOfflineStateDemo](../snapshot/apps/nexus/app/components/content/demos/OfflineStateOfflineStateDemo.vue.txt)

## 离线类型与实现参考

- [offline-state/index.ts](../snapshot/packages/tuffex/packages/components/src/offline-state/index.ts.txt)
- [src/TxOfflineState.vue](../snapshot/packages/tuffex/packages/components/src/offline-state/src/TxOfflineState.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/offline-state/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
