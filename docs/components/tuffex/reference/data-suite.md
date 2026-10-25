# 数据套件

> 可视化与图表：主包内的数据展示组件，以及图表家族子路径

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/data-suite) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/data-suite.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/data-suite.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.4.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

每个格子都是可交互的真实组件，点击左上角名称进入对应组件文档。

此处为官网动态目录/交互图库；离线组件与审阅状态见 [组件索引](../COMPONENTS.md)。

## 选型

| 要表达的 | 组件 |
|------|------|
| 指标随时间变化，带标记、阈值与刷选 | [TimeseriesChart 时序图](./timeseries-chart.md) |
| 训练过程：按步数比较多次运行与多个种子 | [LearningCurve 学习曲线](./learning-curve.md) |
| 地理分布 | [Maps 地图](./maps.md) |
| 流量、预算或转化的去向 | [SankeyChart 桑基图](./sankey-chart.md) |
| 折线、面积、柱、散点、环形的自由组合 | [Custom Chart 自定义图表](./custom-chart.md) |
| 单色风格的仪表盘小图与活动日历 | [MonoChart 单色图表](./mono-chart.md) |
| 漏斗、仪表、热力、雷达、矩形树图等其余类型 | [ECharts 图表](./echart-charts.md) |
| 带抖动质感的展示型图表 | [DitherChart 抖动图表](./dither-chart.md)，归在[动效套件](./motion-suite.md) |
| 一行之内的趋势、占比、差异或强度 | [SparkChart](./spark-chart.md)、[AllocationBar](./allocation-bar.md)、[DiffTable](./diff-table.md)、[SignalMeter](./signal-meter.md) |

## 概述

- 图表从 `@talex-touch/tuffex/charts` 引入，可视化组件在主包内；两者都随 `@talex-touch/tuffex/pro` 入口提供。
- 除 ECharts 图表外都由 Vue 直接渲染（SVG，SparkChart 与抖动层用 Canvas），不加载 echarts；ECharts 图表挂载时才加载可选依赖 `echarts`。
- 原生图表共用 `--tx-chart-*` 主题变量与 `ChartPalette`，随宿主明暗切换。
- 原生图表按 ECharts 的默认时序播放动画：入场 1000ms、数据更新 500ms、状态切换 300ms；`prefers-reduced-motion: reduce` 下直接落到终帧。

## 离线完整示例源码

此页没有引用独立 Demo；正文中的代码块保持原样。

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
