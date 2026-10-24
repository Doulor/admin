# KeyframeStrokeText 关键帧描边

> 先描边、后填充的 SVG 文字动效

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/keyframe-stroke-text) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/keyframe-stroke-text.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/keyframe-stroke-text.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`KeyframeStrokeTextKeyframeStrokeTextDemo`（完整源码见本页末尾）

```vue
<template>
  <TxKeyframeStrokeText text="TuffEx" :font-size="56" />
  <TxKeyframeStrokeText
    text="Stroke + Fill"
    stroke-color="#0ea5e9"
    fill-color="#0f172a"
    :duration-ms="2400"
    :stroke-width="1.8"
    :font-size="42"
    :font-weight="600"
  />
</template>
```

### 多语言文本
宽度按实际渲染的文字测量，中文与混排文本无需额外设置。
官方示例：`KeyframeStrokeTextChineseDemo`（完整源码见本页末尾）

```vue
<template>
  <TxKeyframeStrokeText
    text="关键帧描边动画"
    stroke-color="#16a34a"
    fill-color="#14532d"
    :duration-ms="2600"
    :stroke-width="1.6"
    :font-size="40"
  />
</template>
```

### 最佳实践

- 只用于短文案；长句难读，测量与动画也更重。
- 文字只是装饰时，把语义标题放在组件外。
- 大型列表中不要随输入逐字更新 `text`，每次变化都会重新测量。
- 在目标页面测试自定义 Web Font，字体加载后宽度会再变一次。
- 深色背景上给 `strokeColor` 选高对比色，否则描边阶段几乎不可见。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `text` | `string` | `''` | 要渲染的文字。 |
| `strokeColor` | `string` | `'#4C4CFF'` | 先出现的描边轮廓颜色。 |
| `fillColor` | `string` | `'#111827'` | 描边后显现的最终文字颜色。 |
| `durationMs` | `number` | `1800` | 动画时长（ms），描边与填充共用。 |
| `strokeWidth` | `number` | `2` | 描边宽度，同时决定 viewBox 内边距。 |
| `fontSize` | `string \| number` | `64` | 字号；数字转为 px，字符串原样透传。 |
| `fontWeight` | `string \| number` | `700` | 字重；越粗，描边轮廓越厚。 |
| `fontFamily` | `string` | `'inherit'` | 字体族。 |

## 概述

- 根节点是 `role="img"` 的 SVG；非空 `text` 同步为 `aria-label`，空文本不输出 `aria-label`，以不换行空格占位。
- 挂载后，以及 `text`、字体属性或 `strokeWidth` 变化后，用 `getBBox()` 与 `getComputedTextLength()` 重新测量；`document.fonts.ready` 后再测一次。
- SVG 尺寸取测得的文字框加描边内边距。
- 减少动态效果时不播放动画，直接显示最终状态。

## 技术实现

- 隐藏的测量层固定在原点，两个绘制层带上计算出的偏移；描边按测得长度做 dash 动画，参数经 `--tx-kf-*` CSS 变量传入。
- 源码：`packages/tuffex/packages/components/src/keyframe-stroke-text/`。

## 离线完整示例源码

- [KeyframeStrokeTextKeyframeStrokeTextDemo](../snapshot/apps/nexus/app/components/content/demos/KeyframeStrokeTextKeyframeStrokeTextDemo.vue.txt)
- [KeyframeStrokeTextChineseDemo](../snapshot/apps/nexus/app/components/content/demos/KeyframeStrokeTextChineseDemo.vue.txt)

## 离线类型与实现参考

- [keyframe-stroke-text/index.ts](../snapshot/packages/tuffex/packages/components/src/keyframe-stroke-text/index.ts.txt)
- [src/TxKeyframeStrokeText.vue](../snapshot/packages/tuffex/packages/components/src/keyframe-stroke-text/src/TxKeyframeStrokeText.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/keyframe-stroke-text/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
