# Floating 浮动层

> 随指针产生视差位移的容器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/floating) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/floating.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/floating.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`depth` 决定图层位移幅度，`sensitivity` 整体放大，`easingFactor` 决定跟随速度。
官方示例：`FloatingFloatingDemo`（完整源码见本页末尾）

```vue
<template>
  <TxFloating class-name="stage" :sensitivity="0.55" :easing-factor="0.08">
    <TxFloatingElement class-name="status-rail" :depth="-0.06" />
    <TxFloatingElement class-name="status-panel" :depth="0.04">
      鼠标移动时，状态层会按 depth 缓动
    </TxFloatingElement>
  </TxFloating>
</template>
```

### 禁用动效
`disabled` 停止监听与动画帧，并把图层位移归零。

```vue
<template>
  <TxFloating :disabled="paused">
    <TxFloatingElement class-name="hero-card" :depth="0.08">
      内容
    </TxFloatingElement>
  </TxFloating>
</template>
```

### 反向运动图层
负数 `depth` 朝正数 `depth` 的反方向移动。

```vue
<template>
  <TxFloating class-name="scene" :sensitivity="1.2">
    <TxFloatingElement class-name="background" :depth="-0.04" />
    <TxFloatingElement class-name="foreground" :depth="0.1" />
  </TxFloating>
</template>
```

### 最佳实践

- 只用于装饰性视差、引导卡片或背景点缀，关键布局不要依赖指针移动。
- 图层保持少量；运动中每个图层每帧都会更新。
- 用较小的 `depth` 保持克制，数值过大会让界面显得脱节。
- 静态位置通过 class 提供，组件只叠加 `transform`。
- 快速移动的图层里不放交互控件。

## API 参考

### TxFloating

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `className` | `string` | `''` | 追加到容器上的类名。 |
| `sensitivity` | `number` | `1` | 整体位移倍率。 |
| `easingFactor` | `number` | `0.05` | 每帧靠近目标位置的比例。 |
| `disabled` | `boolean` | `false` | 停止动效，并重置已注册图层的 transform。 |

#### 插槽

| 插槽名 | 说明 |
|------|------|
| `default` | 浮动图层与场景内容。 |

### TxFloatingElement

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `className` | `string` | `''` | 追加到绝对定位图层上的类名。 |
| `depth` | `number` | `1` | 位移深度；负数朝指针的反方向移动。 |

#### 插槽

| 插槽名 | 说明 |
|------|------|
| `default` | 图层内容。 |

## 概述

- `TxFloatingElement` 挂载时向 `TxFloating` 注册，`depth` 变化时重新注册，卸载时注销；在 `TxFloating` 外使用时只渲染、不移动。
- 指针坐标以容器中心为原点；每帧按 `easingFactor` 逼近 `pointerPosition * (depth * sensitivity / 20)`。
- `disabled` 或减少动态效果时，停止监听与动画帧，并把位移重置为 `translate3d(0px, 0px, 0)`。
- 容器移出视口时暂停动画；页面滚动或缩放后重新测量原点。

## 技术实现

- 动画循环只在图层未到位时运行，静止后自动停下；window 监听均为 passive，并经 `hasWindow()` 保护，SSR 安全。
- 源码：`packages/tuffex/packages/components/src/floating/`。

## 离线完整示例源码

- [FloatingFloatingDemo](../snapshot/apps/nexus/app/components/content/demos/FloatingFloatingDemo.vue.txt)

## 离线类型与实现参考

- [floating/index.ts](../snapshot/packages/tuffex/packages/components/src/floating/index.ts.txt)
- [src/TxFloating.vue](../snapshot/packages/tuffex/packages/components/src/floating/src/TxFloating.vue.txt)
- [src/TxFloatingElement.vue](../snapshot/packages/tuffex/packages/components/src/floating/src/TxFloatingElement.vue.txt)
- [src/context.ts](../snapshot/packages/tuffex/packages/components/src/floating/src/context.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/floating/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
