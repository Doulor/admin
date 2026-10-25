# ErrorState 错误状态

> 加载或操作失败时显示的状态视图

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/error-state) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/error-state.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/error-state.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`ErrorStateBasicDemo`（完整源码见本页末尾）

```vue
<template>
  <TxErrorState
    :primary-action="{ label: 'Retry', type: 'primary' }"
    :secondary-action="{ label: 'Go Back' }"
  />
</template>
```

### 自定义文案
`title`、`description` 覆盖预设文案，`surface="card"` 添加卡片表面。
官方示例：`ErrorStateCustomDemo`（完整源码见本页末尾）

```vue
<template>
  <TxErrorState
    title="Failed to load data"
    description="The server returned error 500. Please check your network and try again."
    surface="card"
    :primary-action="{ label: 'Retry', type: 'primary' }"
  />
</template>
```

### 后台恢复状态
与加载态、空态共用同一个数据容器。
官方示例：`ComponentsRecoveryStatesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxErrorState
    title="规则加载失败"
    description="服务暂时不可用，请重试或检查后台日志。"
    surface="card"
    :primary-action="{ label: '重试', type: 'primary', icon: 'i-carbon-renew' }"
    :secondary-action="{ label: '查看教程', icon: 'i-carbon-help' }"
  />
</template>
```

### 最佳实践

- `title` 写明失败的对象，例如「规则加载失败」，不写「出错了」。
- 始终提供恢复路径：重试、返回上级、打开日志或联系支持。
- 替换数据面板时用 `surface="card"`；已在卡片容器内时保持 `plain`。
- 技术细节放进日志或可展开的诊断区；说明文案只告诉用户下一步。
- 生成按钮表达不了恢复流程时，才用 `actions` 插槽。

## API 参考

继承 [TxEmptyState](./empty-state.md) 除 `variant` 外的全部属性、事件与插槽；`variant` 固定为 `error`。

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `title` | `string` | `'Something went wrong'` | 错误标题，写明失败的对象或操作。 |
| `description` | `string` | `'Please try again later.'` | 说明与恢复建议。 |
| `icon` | `TxIconSource \| string \| null` | variant 默认值 | 替换内置错误插画；`null` 隐藏图标区。 |
| `iconSize` | `number` | 按 `size` 派生 | 图标尺寸，默认按 `size` 取 28 / 36 / 44。 |
| `layout` | `'vertical' \| 'horizontal'` | `'vertical'` | 布局方向。 |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | 内容对齐。 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 尺寸等级。 |
| `surface` | `'plain' \| 'card'` | `'plain'` | 表面样式。 |
| `primaryAction` | `EmptyStateAction` | - | 主恢复操作。 |
| `secondaryAction` | `EmptyStateAction` | - | 次操作。 |
| `actionSize` | `TxButtonProps['size']` | `'sm'` | 生成按钮的尺寸。 |
| `loading` | `boolean` | `false` | 无 `icon` 属性或插槽时以 `TxSpinner` 替换插画，不影响按钮。 |

### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `primary` | - | 点击生成的主按钮时触发；重试逻辑由宿主实现。 |
| `secondary` | - | 点击生成的次按钮时触发。 |

### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `icon` | - | 替换内置错误插画。 |
| `title` | - | 替换标题。 |
| `description` | - | 替换说明。 |
| `actions` | - | 替换生成的主/次操作按钮。 |

## 技术实现

- 源码：`packages/tuffex/packages/components/src/error-state/`；插画由 `TxEmptyState` 绘制。

## 离线完整示例源码

- [ErrorStateBasicDemo](../snapshot/apps/nexus/app/components/content/demos/ErrorStateBasicDemo.vue.txt)
- [ErrorStateCustomDemo](../snapshot/apps/nexus/app/components/content/demos/ErrorStateCustomDemo.vue.txt)
- [ComponentsRecoveryStatesDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsRecoveryStatesDemo.vue.txt)

## 离线类型与实现参考

- [error-state/index.ts](../snapshot/packages/tuffex/packages/components/src/error-state/index.ts.txt)
- [src/TxErrorState.vue](../snapshot/packages/tuffex/packages/components/src/error-state/src/TxErrorState.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/error-state/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
