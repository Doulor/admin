# 动效套件

> 按钮、卡片展开、3D 轮播、加载动效、抖动图表与输入驱动动效

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/motion-suite) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/motion-suite.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/motion-suite.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.3`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

下方每个格子都渲染真实组件，内容或数据由标本传入。使用悬停、焦点、点击、拖动或可见控件体验行为。重置按钮只重新挂载当前标本，模型与播放状态一起恢复；点击组件名称进入完整变体演示和 API 页。

此处为官网动态目录/交互图库；离线组件与审阅状态见 [组件索引](../COMPONENTS.md)。

### 最佳实践

- 数值、条目、状态和导航由应用驱动。按钮反馈、加载循环或提交请求不能证明业务操作成功。
- 重复和装饰动效不要进入 live region。保留一份可读文字和原生键盘控件。
- 尊重减少动态效果与可见性。共享活动门禁在隐藏、失活或卸载时停止持续工作。
- 文字值变化复用 `TxTextMorph`，运动复用共享 spring；这些家族不新增文字 diff 或物理引擎。

## 概述

Motion 是八个文档套件之一，包含十二个组件家族。安装仍使用现有 Base、Pro 和 AI 三套 barrel。这里的组件从 `@talex-touch/tuffex/pro` 引入；DitherChart 还提供现有 `@talex-touch/tuffex/charts` 图表入口。这些组件随 npm 0.7.0 发布。

### 按钮

[MotionButton 动效按钮](./motion-button.md) 保留命名按钮效果与来源预设。标签、图标、菜单项、链接和活动状态由调用方传入。使用原生按钮或链接行为，不把视觉结束当作业务成功。

### 卡片展开

[CardSpread 卡片展开](./card-spread.md) 将调用方的卡片排成弧形、扇形、线性、印章、层叠和散布结构。选中索引与展开状态受控，键盘和指针操作使用同一组条目。

### 3D 轮播

[Carousel3D 三维轮播](./carousel-3d.md) 沿弧形、CoverFlow 和时间机器路径展示调用方卡片，包含对应单色变体。[FlipBook 翻页书](./flip-book.md) 翻动传入的页面，可配置纸张、折痕和图片处理。两者都有真实导航，不是静态示意图。

### 加载动效

[MotionLoader 加载动效](./motion-loader.md) 保留来源加载器各自的几何结构与节奏。调用方控制加载状态和无障碍文字，选择加载器不会制造业务完成状态。

### 抖动图表

[DitherChart 抖动图表](./dither-chart.md) 用像素、有序抖动和 SVG 图案展示传入的序列、节点与单元格。时间范围、选中序列和筛选会改变实际图表输入。组件位于现有 charts 边界，使用 `--tx-chart-*` 主题变量。不需要抖动材质时，在数据套件查看 [MonoChart 单色图表](./mono-chart.md)。

### 文字

[MotionText 文字动效](./motion-text.md) 区分文字展示与文字值变化。字符、词、段落、打字、模糊、揭示和 3D 效果保留原始可读文字；文字间媒体和焦点效果接受调用方内容。

### 物理动效

[PhysicsMotion 物理动效](./physics-motion.md) 保留来源几何，以及悬停、点击、循环或手动触发关系。重放启动新一次展示，可见性和减少动态效果处理限制隐藏持续工作。

### 悬停、指针与滚动

[Motion](./motion.md) 覆盖入场、卡片悬停、倾斜、磁吸、指针、聚光灯和滚动联动展示。[MotionDock 动效 Dock](./motion-dock.md) 放大和重排调用方条目，返回实际新顺序。滚动变体可指定调用方的滚动容器。

### 切换控件

[MotionToggle 动效切换](./motion-toggle.md) 将每种切换效果绑定到调用方的模型、选项和计数。指针和键盘激活更新同一个受控值，外观不会另存一套业务状态。

### 转场

[MotionTransition 动效转场](./motion-transition.md) 用门、遮罩、波形、透视舞台和幕帘切换带 key 的内容。内联、卡片、模态和覆盖模式共享受控内容标识、可见性与重放行为。

## API 参考

### 引入

```ts
import {
  TxCardSpread,
  TxCarousel3D,
  TxFlipBook,
  TxMotion,
  TxMotionButton,
  TxMotionDock,
  TxMotionLoader,
  TxMotionText,
  TxMotionToggle,
  TxMotionTransition,
  TxPhysicsMotion,
} from '@talex-touch/tuffex/pro'
import { TxDitherChart } from '@talex-touch/tuffex/charts'
import '@talex-touch/tuffex/base.css'
```

上方 `suite="motion"` 是文档预览分类，没有第四套安装 barrel。`@talex-touch/tuffex/motion` 是 `TxMotion` 的合法单组件子路径。手动引入组件时，按《[安装与引入](./installation.md)》和对应组件 API 页加载按需样式。

### 属性

| 总览组件 | 属性 | 值 | 行为 |
| --- | --- | --- | --- |
| `DocsComponentsGallery` | `suite` | `motion` | 只展示 Motion 部分，包含十二个实时标本和各自的重置控件。 |

### 相关套件

- [数据套件](./data-suite.md)：MonoChart、现有图表族和轻量可视化。
- [进阶套件](./pro-suite.md)：MotionForm、MotionControl、MotionMetric，以及现有视觉效果和原语。
- [理念](./index.md)：安装、主题、无障碍和完整组件索引。

## 技术实现

侧栏、总览和中心页使用共享 `docs-suites.ts` 分类。重新分类脚本将分类写入组件 frontmatter，`SECTION_ORDER` 提供稳定页序。预览重置使用 `DocsGallerySpecimen`；新标本各自持有模型，重置会重新开始真实交互。来源改编保留 Amicro 的 MIT 署名和源文件级 Apache-2.0 声明；Lucide 图标数据另保留 ISC 及适用的 Feather-MIT 声明，不引入 React 或 Lucide 运行时依赖。可见性、减少动态效果和 spring 由 TuffEx 统一维护。

## 离线完整示例源码

此页没有引用独立 Demo；正文中的代码块保持原样。

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
