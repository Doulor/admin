# SankeyChart 桑基图

> d3-sankey 布局的流向图：渐变连线、节点值标签、下钻标记与插槽提示框。

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/sankey-chart) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/sankey-chart.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/sankey-chart.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.1.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

`nodes` 是节点数组，`links` 用**节点下标**连接（`source`/`target` 是 `nodes` 的索引）。节点色优先级：`node.color` > `defaultNodeColor` > 分类色板按下标轮转。连线默认按来源色→目标色渐变，`link-color="gray"` 换成整齐的灰。任一节点带 `value` 时值标签自动开启（`showNodeValues` 可强制开关）。

### 流量分发

官方示例：`SankeyChartBasicDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const nodes = [
  { name: 'Organic', value: 5200 },
  { name: 'Referral', value: 2100 },
  { name: 'Ads', value: 1400 },
  { name: 'Landing', value: 8700, tooltipData: { Sessions: 8700, 'Bounce rate': '34%' } },
  { name: 'Signup', value: 2600, isDrillable: true, childCount: 4 },
  { name: 'Docs', value: 3100 },
  { name: 'Bounce', value: 3000 },
]
const links = [
  { source: 0, target: 3, value: 5200 },
  { source: 1, target: 3, value: 2100 },
  { source: 2, target: 3, value: 1400 },
  { source: 3, target: 4, value: 2600, isDrillable: true },
  { source: 3, target: 5, value: 3100 },
  { source: 3, target: 6, value: 3000 },
]
</script>

<template>
  <TxSankeyChart :nodes="nodes" :links="links" @node-click="onNode" @link-click="onLink" />
</template>
```

### 行内标签与灰连线

官方示例：`SankeyChartLabelsDemo`（完整源码见本页末尾）

```vue
<template>
  <TxSankeyChart
    :nodes="nodes"
    :links="links"
    node-label-layout="inline"
    link-color="gray"
    :format-value="(v) => `${(v / 1000).toFixed(1)}k`"
  />
</template>
```

## API 参考

### SankeyChart Props

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `nodes` | `SankeyNodeData[]` | — | `{ name, color?, value?, tooltipData?, isDrillable?, childCount? }`。 |
| `links` | `SankeyLinkData[]` | — | `{ source, target, value, isDrillable? }`，下标引用节点。 |
| `height` | `number` | `400` | 像素高度。 |
| `width` | `number` | 容器实测 | 显式宽度（SSR/测试用）。 |
| `nodeWidth` | `number` | `8` | 节点条宽。 |
| `nodePadding` | `number` | `10` | 同列节点垂直间距。 |
| `showNodeValues` | `boolean \| 'auto'` | `'auto'` | `'auto'` 在任一节点有 `value` 时开启。 |
| `nodeLabelLayout` | `'stacked' \| 'inline'` | `'stacked'` | 值在名称上方 / 同行。 |
| `formatValue` | `(v: number) => string` | `toLocaleString` | 值格式化。 |
| `showTooltip` | `boolean` | `true` | 悬停提示框。 |
| `defaultNodeColor` | `string` | — | 分类色板前的兜底色。 |
| `left` / `right` | `number \| string` | `'5%'` | 布局左右留白（px 或百分比）。 |
| `linkColor` | `'gradient' \| 'gray'` | `'gradient'` | 连线填充模式。 |
| `linkOpacity` | `number` | `0.5` | 渐变连线不透明度。 |
| `labels` | `Partial<SankeyLabels>` | 英文 | `{ instructions }`：在每个节点名称之后朗读。 |

### SankeyChart Events

| 事件名 | 回调参数 | 说明 |
|------|------|------|
| `node-click` | `(node: SankeyNodeData)` | 点击节点，回传原始数据。 |
| `link-click` | `(link: SankeyLinkData)` | 点击连线，回传原始数据。 |

### SankeyChart Slots

| 插槽名 | 作用域参数 | 说明 |
|------|------|------|
| `tooltip` | `{ params: SankeyTooltipParams }` | 整体替换提示框内容；`params.type` 为 `'node' \| 'link'`。 |

## 拖动节点

节点只做垂直移动，仍留在自己的列里，连线实时重排。

| 输入 | 效果 |
|------|------|
| 拖动节点 | 从抓取点起 1:1 跟随指针，限制在图表高度之内。超过 4 px 后不会触发 `node-click`。 |
| 松手 | 节点留在放下的位置。 |
| 拖动中按 `Escape` | 取消；节点弹回拾起时的位置。 |
| 双击空白背景 | 所有节点弹回计算出的布局。 |
| 聚焦节点时 `Alt` + `↑` / `↓` | 移动 8 px。 |
| 聚焦节点时 `Enter` / `Space` | 选中（`node-click`）。 |

节点可聚焦（`role="button"`，以节点名命名），名称之后朗读 `labels.instructions`，它合并到 `SANKEY_DEFAULT_LABELS` 之上。从节点开始的触摸拖动移动节点而不是滚动页面；从连线或背景开始的触摸仍然滚动。`nodes`（名称、数值）、`links`（端点、数值）或 `height` 的内容变化会回到计算出的布局并丢弃所有移动；内容相同的新数组会保留它们。`prefers-reduced-motion: reduce` 下弹簧直接落到终点；被拖动的节点仍跟随指针。

## 容错

环形连接会让 d3-sankey 抛错——组件捕获后渲染空态并在控制台给出 dev 警告，不会拖垮宿主页面。

## 悬停高亮

悬停节点或连线时，只有邻接元素保持原样：节点、连线与标签里不相邻的部分一起降到 10% 不透明度，对应 ECharts 的 `emphasis.focus: 'adjacency'`（blur 取 `fromState.opacity * 0.1`），在指针到达的那一帧切换，不走 ECharts 的 300ms `cubicOut`（TuffEx 的悬停规则）。节点的邻域是它自己、所有与它相连的连线和这些连线另一端的节点；连线的邻域是它自己、两端节点以及触及任一端点的所有连线。

桑基图在数据变化时**没有几何动画**，这一点与 kumo 一致而非缺失：ECharts 的 `SankeyView` 既没有 `initProps` 也没有 `updateProps`，所以 d3-sankey 布局变化时节点与连线直接落到新位置，不做补间。只有拖动自带的弹簧（Escape、复位）会运动。`prefers-reduced-motion: reduce` 下 300ms 过渡被去掉，高亮瞬时切换。

## 与 kumo 的差异

- `tooltipFormatter`（HTML 字符串 + 手工 XSS 转义）→ `tooltip` 插槽（VNode）。
- kumo 的节点是固定的；这里的节点可以拖动、用 `Alt` + 方向键微调并复位。
- kumo 遇环形输入直接抛错；这里降级为空渲染 + dev 警告。

## 离线完整示例源码

- [SankeyChartBasicDemo](../snapshot/apps/nexus/app/components/content/demos/SankeyChartBasicDemo.vue.txt)
- [SankeyChartLabelsDemo](../snapshot/apps/nexus/app/components/content/demos/SankeyChartLabelsDemo.vue.txt)

## 离线类型与实现参考

- [charts/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/index.ts.txt)
- [axis/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/axis/index.ts.txt)
- [src/TxAxis.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/axis/src/TxAxis.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/axis/src/types.ts.txt)
- [chart-legend/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/chart-legend/index.ts.txt)
- [src/TxChartLegendItem.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/chart-legend/src/TxChartLegendItem.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/chart-legend/src/types.ts.txt)
- [chart/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/chart/index.ts.txt)
- [src/TxChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/chart/src/TxChart.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/chart/src/types.ts.txt)
- [core/accessor.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/core/accessor.ts.txt)
- [core/animate.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/core/animate.ts.txt)
- [core/context.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/core/context.ts.txt)
- [core/scales.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/core/scales.ts.txt)
- [core/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/core/types.ts.txt)
- [core/uid.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/core/uid.ts.txt)
- [dither-chart/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/index.ts.txt)
- [src/DitherPatternDefs.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/DitherPatternDefs.vue.txt)
- [src/TxDitherChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/TxDitherChart.vue.txt)
- [src/geometry.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/geometry.ts.txt)
- [src/paint.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/paint.ts.txt)
- [src/source-catalog.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/source-catalog.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/types.ts.txt)
- [src/use-dither-canvas.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/dither-chart/src/use-dither-canvas.ts.txt)
- [echart/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/index.ts.txt)
- [src/TxBarChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxBarChart.vue.txt)
- [src/TxEChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxEChart.vue.txt)
- [src/TxFunnelChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxFunnelChart.vue.txt)
- [src/TxGaugeChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxGaugeChart.vue.txt)
- [src/TxHeatmapChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxHeatmapChart.vue.txt)
- [src/TxLineChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxLineChart.vue.txt)
- [src/TxPieChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxPieChart.vue.txt)
- [src/TxRadarChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxRadarChart.vue.txt)
- [src/TxScatterChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxScatterChart.vue.txt)
- [src/TxTreemapChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/TxTreemapChart.vue.txt)
- [core/interaction.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/core/interaction.ts.txt)
- [core/loader.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/core/loader.ts.txt)
- [core/shared.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/core/shared.ts.txt)
- [core/theme.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/core/theme.ts.txt)
- [core/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/core/types.ts.txt)
- [options/bar.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/bar.ts.txt)
- [options/funnel.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/funnel.ts.txt)
- [options/gauge.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/gauge.ts.txt)
- [options/heatmap.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/heatmap.ts.txt)
- [options/line.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/line.ts.txt)
- [options/pie.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/pie.ts.txt)
- [options/radar.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/radar.ts.txt)
- [options/scatter.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/scatter.ts.txt)
- [options/treemap.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/echart/src/options/treemap.ts.txt)
- [grid/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/grid/index.ts.txt)
- [src/TxGrid.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/grid/src/TxGrid.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/grid/src/types.ts.txt)
- [learning-curve/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/learning-curve/index.ts.txt)
- [src/TxLearningCurve.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/learning-curve/src/TxLearningCurve.vue.txt)
- [src/TxLearningCurveLayer.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/learning-curve/src/TxLearningCurveLayer.vue.txt)
- [src/smoothing.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/learning-curve/src/smoothing.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/learning-curve/src/types.ts.txt)
- [maps/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/index.ts.txt)
- [src/TxBubbleMap.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/TxBubbleMap.vue.txt)
- [src/TxChoroplethMap.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/TxChoroplethMap.vue.txt)
- [src/accessor.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/accessor.ts.txt)
- [src/color.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/color.ts.txt)
- [src/map-shared.scss](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/map-shared.scss.txt)
- [src/projection.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/projection.ts.txt)
- [src/roam.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/roam.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/types.ts.txt)
- [src/use-map-base.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/maps/src/use-map-base.ts.txt)
- [mono-chart/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/mono-chart/index.ts.txt)
- [src/TxMonoChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/mono-chart/src/TxMonoChart.vue.txt)
- [src/activity-source.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/mono-chart/src/activity-source.ts.txt)
- [src/geometry.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/mono-chart/src/geometry.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/mono-chart/src/types.ts.txt)
- [palette/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/palette/index.ts.txt)
- [src/palette.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/palette/src/palette.ts.txt)
- [sankey/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/sankey/index.ts.txt)
- [src/TxSankeyChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/sankey/src/TxSankeyChart.vue.txt)
- [src/layout.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/sankey/src/layout.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/sankey/src/types.ts.txt)
- [series/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/series/index.ts.txt)
- [src/TxArcSeries.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/TxArcSeries.vue.txt)
- [src/TxAreaSeries.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/TxAreaSeries.vue.txt)
- [src/TxBarSeries.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/TxBarSeries.vue.txt)
- [src/TxLineSeries.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/TxLineSeries.vue.txt)
- [src/TxScatterSeries.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/TxScatterSeries.vue.txt)
- [src/curves.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/curves.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/types.ts.txt)
- [src/use-series.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/series/src/use-series.ts.txt)
- [style/index.scss](../snapshot/packages/tuffex/packages/components/src/charts/src/style/index.scss.txt)
- [style/tokens.scss](../snapshot/packages/tuffex/packages/components/src/charts/src/style/tokens.scss.txt)
- [timeseries/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/index.ts.txt)
- [src/TxTimeseriesAnnotations.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/TxTimeseriesAnnotations.vue.txt)
- [src/TxTimeseriesChart.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/TxTimeseriesChart.vue.txt)
- [src/TxTimeseriesSkeleton.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/TxTimeseriesSkeleton.vue.txt)
- [src/brush.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/brush.ts.txt)
- [src/format.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/format.ts.txt)
- [src/incomplete.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/incomplete.ts.txt)
- [src/markers.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/markers.ts.txt)
- [src/tooltip-data.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/tooltip-data.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/timeseries/src/types.ts.txt)
- [tooltip/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/tooltip/index.ts.txt)
- [src/TxChartTooltip.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/tooltip/src/TxChartTooltip.vue.txt)
- [src/position.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/tooltip/src/position.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/tooltip/src/types.ts.txt)
- [utils/with-install.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/utils/with-install.ts.txt)
- [viewport/index.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/viewport/index.ts.txt)
- [src/TxChartViewport.vue](../snapshot/packages/tuffex/packages/components/src/charts/src/viewport/src/TxChartViewport.vue.txt)
- [src/viewport.ts](../snapshot/packages/tuffex/packages/components/src/charts/src/viewport/src/viewport.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
