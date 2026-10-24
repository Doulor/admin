# 无障碍

> Tuffex 组件的无障碍约定与覆盖范围

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/accessibility) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/accessibility.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/accessibility.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.4.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 范围

以 WCAG 2.1 AA 为开发目标，不是认证结论。

## 焦点

焦点环只画在 `:focus-visible` 上：鼠标点击不留环，键盘走查始终可见。

| Token | 作用 |
|-------|------|
| `--tx-focus-ring-color` | 焦点环颜色 |
| `--tx-focus-ring-shadow` | 环外光晕 |

- 深色与高对比度调色板都会重新定义这两个 token。
- 没有 `:focus-visible` 规则的组件，要么不可聚焦，要么把焦点交给可聚焦的子元素。
- 被圆角容器裁切的组件把焦点环画在内侧，避免被父级 `overflow: hidden` 切成直角；样板是折叠面板表头。

## 动效

| 约定 | 做法 |
|------|------|
| 响应 `prefers-reduced-motion: reduce` | 保留状态、去掉位移：不确定进度条停止扫动但保留半透明轨道，折叠面板直接展开 |
| 只动合成属性 | `transform` 与 `opacity` |
| 必须动布局时（如高度 `0` ↔ `auto`） | 先测量，再用 JavaScript 驱动数值；不对猜测的固定 `height` 做补间 |

## 对比度

高对比度调色板在浅色与深色下都提高文本与边框对比度，材质面板改画不透明底色、不再模糊背后的页面；它经 `@media (prefers-contrast: more)` 自动跟随系统。强制开启或退出的选择器、各组件的具体变化见《[主题定制](./theming.md)》。

容易出错的 token 组合（同色 tint 上的浅色徽标、深色页面上的版本胶囊）在声明旁注释实测对比度。

## 语义

| 模式 | 做法 |
|------|------|
| 用可见文本命名 | 可访问名取自可见标签；只能靠印字命名的控件（如进度条）提供 `ariaLabel` prop |
| 隐藏装饰 | 与相邻文本重复的字形带 `aria-hidden`，标签只朗读一次 |
| 关联展开状态 | 触发器写 `aria-expanded`，`aria-controls` 指向面板生成的 id |

```vue
<template>
  <TxProgressBar :percentage="40" aria-label="上传进度" />
</template>
```

## 覆盖到哪里为止

- 没有自动化无障碍测试套件；无障碍行为由各组件自己的测试与人工评审保证，可能有遗漏。
- 侧边栏仍标 `开发中` 的组件尚未评审。
- 屏幕阅读器测试为人工进行，没有固定测试矩阵。
- 组件页都附源码位置；修复落在组件源码，所有使用方一并生效。

## 技术实现

- 焦点与对比度 token：`packages/tuffex/packages/components/style/variables.scss`。
- 主题与对比度选择器：《[主题定制](./theming.md)》。

## 离线完整示例源码

此页没有引用独立 Demo；正文中的代码块保持原样。

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
