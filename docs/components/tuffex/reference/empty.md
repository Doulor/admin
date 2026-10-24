# Empty 空状态

> 用于面板与筛选结果的紧凑空状态卡片

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/empty) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/empty.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/empty.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`compact` 切换为小尺寸，`iconClass` 替换图标。
官方示例：`EmptyEmptyDemo`（完整源码见本页末尾）

```vue
<template>
  <TxEmpty title="没有匹配结果" description="调整筛选条件或清空关键字后再试。" icon-class="i-carbon-search" compact />
</template>
```

### 操作
官方示例：`EmptyEmptyActionDemo`（完整源码见本页末尾）

```vue
<template>
  <TxEmpty title="还没有项目" description="创建第一个项目后，可以在这里统一管理。">
    <template #action>
      <TxButton type="primary">新建项目</TxButton>
    </template>
  </TxEmpty>
</template>
```

### 最佳实践

- 列表、搜索结果或面板中需要卡片表面的占位用 `TxEmpty`。
- 空的原因有产品含义时，改用 `TxNoData`、`TxNoSelection`、`TxOfflineState` 或 `TxPermissionState`。
- 侧栏、表格内部等密集区域设置 `compact`。
- 点击逻辑写在 `action` 插槽内的控件上；`TxEmpty` 不派发事件。

## API 参考

渲染 [TxEmptyState](./empty-state.md)，固定 `variant="empty"`、`surface="card"`、`layout="vertical"`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `title` | `string` | `'Nothing here'` | 主文案。 |
| `description` | `string` | `''` | 标题下的说明。 |
| `iconClass` | `string` | `'i-carbon-incomplete'` | 图标 class，作为 `icon` 传给 `TxEmptyState`。 |
| `compact` | `boolean` | `false` | 为 `true` 时 `size="small"`，否则为 `medium`。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `icon` | - | 替换 `iconClass` 图标。 |
| `title` | - | 替换标题。 |
| `description` | - | 替换说明。 |
| `action` | - | 操作区，替换 `TxEmptyState` 的 `actions` 插槽。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/empty/`。

## 离线完整示例源码

- [EmptyEmptyDemo](../snapshot/apps/nexus/app/components/content/demos/EmptyEmptyDemo.vue.txt)
- [EmptyEmptyActionDemo](../snapshot/apps/nexus/app/components/content/demos/EmptyEmptyActionDemo.vue.txt)

## 离线类型与实现参考

- [empty/index.ts](../snapshot/packages/tuffex/packages/components/src/empty/index.ts.txt)
- [src/TxEmpty.vue](../snapshot/packages/tuffex/packages/components/src/empty/src/TxEmpty.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/empty/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
