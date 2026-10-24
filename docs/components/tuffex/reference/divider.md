# Divider 分割线

> 分隔内容区块的水平或垂直线条

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/divider) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/divider.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/divider.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.7`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
默认插槽显示文字，`textPlacement` 决定文字位置。
官方示例：`DividerBasicDemo`（完整源码见本页末尾）

```vue
<template>
  <p>主要配置区域</p>
  <TxDivider />
  <p>高级配置区域</p>
  <TxDivider text-placement="left">高级选项</TxDivider>
  <TxDivider dashed text-placement="right">虚线分割</TxDivider>
</template>
```

### 渐变
`gradient` 取 `start`、`end` 或 `both`；`true` 等同 `both`。
官方示例：`DividerGradientDemo`（完整源码见本页末尾）

```vue
<template>
  <TxDivider gradient="start" />
  <TxDivider gradient="end" />
  <TxDivider gradient />
  <TxDivider gradient text-placement="center">渐变标签</TxDivider>
</template>
```

### 垂直
`direction="vertical"` 用于行内分隔，同样支持 `dashed` 与 `gradient`。
官方示例：`DividerVerticalDemo`（完整源码见本页末尾）

```vue
<template>
  <span>已发布</span>
  <TxDivider direction="vertical" />
  <span>平台团队</span>
  <TxDivider direction="vertical" dashed />
  <span>刚刚更新</span>
  <TxDivider direction="vertical" gradient />
  <span>渐变</span>
</template>
```

### 最佳实践

- 用分割线分隔语义区块，不要逐行添加；密集表格与列表用行距或表格边框。
- 文字标签保持简短；长文本改用真实标题。
- 垂直分割线只用于行内元信息或工具栏，且周围文本已提供上下文。
- Drawer、Card、Form 内的分隔用 `TxDivider`，不要硬编码边框。

## API 参考

### 属性

```yaml
rows:
  - name: direction
    description: '分割线方向。'
    type: "'horizontal' | 'vertical'"
    default: "'horizontal'"
  - name: dashed
    description: '显示为虚线。'
    type: 'boolean'
    default: 'false'
  - name: textPlacement
    description: '水平分割线的文字位置。'
    type: "'left' | 'center' | 'right'"
    default: "'center'"
  - name: gradient
    description: '渐变透明的方向；true 等同 both。'
    type: "boolean | 'start' | 'end' | 'both'"
    default: 'false'
```

### 插槽

```yaml
rows:
  - name: default
    description: '水平分割线中的文字；垂直时不渲染。'
    type: '-'
    default: '-'
```

## 概述

- 根节点为 `role="separator"`，`aria-orientation` 取自 `direction`。
- 水平分割线占满容器宽度；文字只在水平方向渲染。
- `start` 从透明过渡到实线，`end` 从实线过渡到透明，`both` 两端透明、中间实线；垂直方向沿纵轴渐变。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/divider/`。

## 离线完整示例源码

- [DividerBasicDemo](../snapshot/apps/nexus/app/components/content/demos/DividerBasicDemo.vue.txt)
- [DividerGradientDemo](../snapshot/apps/nexus/app/components/content/demos/DividerGradientDemo.vue.txt)
- [DividerVerticalDemo](../snapshot/apps/nexus/app/components/content/demos/DividerVerticalDemo.vue.txt)

## 离线类型与实现参考

- [divider/index.ts](../snapshot/packages/tuffex/packages/components/src/divider/index.ts.txt)
- [src/TxDivider.vue](../snapshot/packages/tuffex/packages/components/src/divider/src/TxDivider.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/divider/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
