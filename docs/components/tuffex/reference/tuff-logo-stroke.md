# TuffLogoStroke Logo 描边

> Tuff Logo 的 SVG 描边动画

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/tuff-logo-stroke) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/tuff-logo-stroke.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/tuff-logo-stroke.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 动画模式
`once` 挂载时描边入场一次；`breathe` 入场后持续轻微呼吸；`hover` 等到悬停才播放。
官方示例：`TuffLogoStrokeModesDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTuffLogoStroke :size="84" mode="once" />
  <TxTuffLogoStroke :size="84" mode="breathe" />
  <TxTuffLogoStroke :size="84" mode="hover" />
</template>
```

### 颜色与时长
官方示例：`TuffLogoStrokePaletteDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTuffLogoStroke
    :size="128"
    mode="breathe"
    :duration-ms="2800"
    stroke-color="#3b82f6"
    fill-start-color="#0ea5e9"
    fill-end-color="#8b5cf6"
    outer-start-color="#fb7185"
    outer-end-color="#7e22ce"
  />
</template>
```

### 最佳实践

- 闪屏、加载完成或首屏品牌露出用 `once`。
- Logo 靠近交互入口、不应持续吸引注意时用 `hover`。
- 谨慎使用 `breathe`，重复的品牌动效会和主要 UI 反馈抢注意力。
- 自定义颜色贴近当前表面配色；高饱和渐变更适合安静的背景。
- 不要再给 SVG 包一层动效，除非验证过组合后的减少动态效果表现。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `size` | `string \| number` | `120` | SVG 宽高；数字转为 px。 |
| `mode` | `'once' \| 'breathe' \| 'hover' \| 'loop'` | `'once'` | 动画触发模式；`loop` 等同 `breathe`。 |
| `durationMs` | `number` | `2200` | 基础动画时长（ms）。 |
| `strokeColor` | `string` | `'#4C4CFF'` | 外框描边颜色。 |
| `fillStartColor` | `string` | `'#199FFE'` | 核心填充渐变的起始色。 |
| `fillEndColor` | `string` | `'#810DC6'` | 核心填充渐变的结束色。 |
| `outerStartColor` | `string` | `'#D73E4D'` | 外圈径向渐变的起始色。 |
| `outerEndColor` | `string` | `'#7F007F'` | 外圈径向渐变的结束色。 |

## 概述

- 渲染一个 `role="img"` 的 SVG，可访问名称为 `Tuff logo stroke animation`。
- `mode="loop"` 是 `breathe` 的别名，仅为兼容旧调用；两者输出同一个状态 class，新代码写 `breathe`。
- 渐变与滤镜 id 经 `useId()` 按实例生成，同屏多个 Logo 不冲突；快照测试应断言 id 唯一，而不是具体字符串。
- `durationMs` 写入 `--tx-tuff-logo-duration`，`breathe` 的呼吸周期由它派生。
- 减少动态效果时停止动画，直接显示描边完成的状态。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/tuff-logo-stroke/`。

## 离线完整示例源码

- [TuffLogoStrokeModesDemo](../snapshot/apps/nexus/app/components/content/demos/TuffLogoStrokeModesDemo.vue.txt)
- [TuffLogoStrokePaletteDemo](../snapshot/apps/nexus/app/components/content/demos/TuffLogoStrokePaletteDemo.vue.txt)

## 离线类型与实现参考

- [tuff-logo-stroke/index.ts](../snapshot/packages/tuffex/packages/components/src/tuff-logo-stroke/index.ts.txt)
- [src/TxTuffLogoStroke.vue](../snapshot/packages/tuffex/packages/components/src/tuff-logo-stroke/src/TxTuffLogoStroke.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/tuff-logo-stroke/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
