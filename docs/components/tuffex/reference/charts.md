# Charts 图表

> 图表家族总览：原生 SVG 图表与按需加载的 ECharts 图表

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/charts) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/charts.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/charts.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

图表家族与主包同源，走独立子路径 `@talex-touch/tuffex/charts`，API 面对标 Cloudflare kumo 的 Charts 族，但渲染层是 Vue 直出的 SVG——不依赖 echarts，也不依赖任何整图表框架，数学只用可摇树的 d3 微模块（`d3-scale` / `d3-shape` / `d3-sankey` / `d3-geo`）。本族没覆盖的图表类型、以及想直接用 ECharts 配置面时，用 [ECharts 图表家族](./echart-charts.md)：它读同一套颜色 token，以可选 `echarts` peer 的形式提供。

```bash
pnpm add @talex-touch/tuffex
```

```ts
import { TxTimeseriesChart } from '@talex-touch/tuffex/charts'
import '@talex-touch/tuffex/charts/style.css'
```

## 用法

图表沿用 ECharts 的默认时序：首绘入场 1000ms `cubicInOut`，数据更新几何形变 500ms `cubicInOut`；单个序列超过 2000 个点时跳过动画、直接渲染终态。折线/面积的首绘是例外——按 ECharts 折线序列的默认值走 `linear`，从左到右裁剪揭示。悬停高亮不照搬 ECharts 的 300ms `cubicOut`：其余序列变淡、换色这类变化在指针到达的那一帧完成，这是 TuffEx 的悬停规则；只有几何上的强调（扇区外移、地图气泡放大）仍按 300ms `cubicOut` 过渡。

这些默认值抄自 kumo 锁定的 `echarts ^6.0.0`（`src/model/globalDefault.ts`，折线序列与 tooltip 另有各自的默认值）。本包没有 ECharts 运行时，于是把它们固化成导出常量：`ENTER_DURATION`（1000）、`UPDATE_DURATION`（500）、`STATE_DURATION`（300）、`ANIMATION_THRESHOLD`（2000）。宿主声明 `prefers-reduced-motion: reduce` 时所有动画直接落到终帧，CSS 过渡也整体包在 `@media (prefers-reduced-motion: no-preference)` 内。

各图表自己的入场与交互形态（柱从基轴长出、散点缩放、环形按角展开、tooltip 位移与碰撞边界、桑基与地图没有几何动画）写在对应的图表页（Timeseries、Maps、Sankey、Custom Chart），这里不重复。

### 最佳实践

- 常见指标场景优先使用专用图表封装（`TxTimeseriesChart`、`TxBubbleMap`、`TxChoroplethMap`、`TxSankeyChart`、`TxSparkChart` 或 `TxEChart`），避免过早从零手拼基础序列原语。
- 样式取色统一通过 `--tx-chart-*` CSS 变量跟随宿主自适应主题，切忌硬编码固定十六进制颜色或手动维护暗色判断分支。
- 单张图表序列数量建议控制在 3–7 条以内以保持良好可读性，并始终为每条序列提供明确图例或完整 Tooltip 说明。

## API 参考

### ChartLegendItem Props

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `variant` | `'small' \| 'large'` | `'small'` | 单行，或可并排进仪表指标带的堆叠大数值。 |
| `name` | `string` | — | 序列名。`loading` 时可省略。 |
| `color` | `string` | — | 色点颜色，接受任意 CSS 颜色（含 `var()`）。 |
| `value` | `string` | — | 已格式化的数值文本。 |
| `unit` | `string` | — | 数值后的单位（仅 `large`）。 |
| `inactive` | `boolean` | `false` | 半透明表示被反选。 |
| `loading` | `boolean` | `false` | 渲染骨架占位（`aria-hidden`，不可聚焦）。 |

## 可用图表

| 组件 | 板块 | 说明 |
|------|------|------|
| `TxTimeseriesChart` | [Timeseries](./timeseries-chart.md) | 时序折线/堆叠柱，标记、阈值、缩放与刷选、tooltip 全家桶。 |
| `TxLearningCurve` | [LearningCurve](./learning-curve.md) | 训练曲线：多种子均值与区间、EMA 平滑、缩放与实时增长。 |
| `TxBubbleMap` / `TxChoroplethMap` | [Maps](./maps.md) | GeoJSON 地图：气泡与分级填色。 |
| `TxSankeyChart` | [Sankey](./sankey-chart.md) | 桑基流向图。 |
| `TxChart` + 系列原语 | [Custom Chart](./custom-chart.md) | 组合式逃生舱：折线/面积/柱/散点/环形自由拼装。 |
| `TxMonoChart` | [MonoChart](./mono-chart.md) | 30 种单色图表变体与活动日历。 |
| `TxDitherChart` | [DitherChart](./dither-chart.md) | 抖动质感的展示型图表，文档归在动效套件。 |
| `TxEChart` + 九个预设 | [ECharts](./echart-charts.md) | 其余图表类型；挂载时按需加载可选 peer `echarts`。 |
| `ChartPalette` / CSS 变量 | [Colors](./chart-colors.md) | 分类、语义、顺序、地图色板，明暗自动。 |

## 图例

`TxChartLegendItem` 提供两种图例项版式：`small` 单行（多序列图例），`large` 堆叠大数值——多个 `large` 并排即组成仪表卡的指标带。`loading` 渲染骨架占位；挂了 `click` 监听时它会渲染成原生 `button`，回车/空格开箱可用。

### 图例项

官方示例：`ChartsLegendItemsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ChartPalette, TxChartLegendItem } from '@talex-touch/tuffex/charts'
import { ref } from 'vue'

const inactive = ref(false)
</script>

<template>
  <TxChartLegendItem name="Requests" :color="ChartPalette.categoricalVar(0)" value="1,234" @click="inactive = !inactive" />
  <TxChartLegendItem name="Errors" :color="ChartPalette.categoricalVar(2)" value="87" :inactive="inactive" />
  <TxChartLegendItem loading />
</template>
```

### 仪表指标带

四个 `large` 图例项并排就是仪表卡的指标带：上方是色点加名称，下方是数值与单位，列与列之间用发丝线分隔，整条指标带铺满卡片宽度。它下面可以接任意图表——这里是四序列 `TxTimeseriesChart`，悬停即可读出同一时间戳上的四个百分位。

官方示例：`ChartsLegendDashboardDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ChartPalette, TxChartLegendItem, TxTimeseriesChart } from '@talex-touch/tuffex/charts'

const percentiles = [
  { name: 'P99', reading: '124', slot: 0 },
  { name: 'P95', reading: '76', slot: 1 },
  { name: 'P75', reading: '32', slot: 2 },
  { name: 'P50', reading: '10', slot: 3 },
]
</script>

<template>
  <div class="metrics">
    <div v-for="item in percentiles" :key="item.name" class="metrics__column">
      <TxChartLegendItem
        variant="large"
        :name="item.name"
        :color="ChartPalette.categoricalVar(item.slot)"
        :value="item.reading"
        unit="ms"
      />
    </div>
  </div>
  <TxTimeseriesChart
    :data="data"
    :height="300"
    x-axis-name="Time (UTC)"
    :x-axis-tick-format="formatTime"
    :timestamp-format="formatStamp"
    :tooltip-value-format="formatValue"
    tooltip-footer="Percentiles use a five-minute rolling window."
  />
</template>
```

## 与 kumo 的差异

- 没有 `echarts` 实例 prop——渲染层自研，调用方不需要也不能传 echarts。
- 没有 `isDarkMode` prop——取色全部走 `--tx-chart-*` CSS 变量，跟随宿主 `.dark` / `[data-theme='dark']` 自动切换。
- 所有 HTML 字符串 formatter 一律改为插槽（VNode），不存在 XSS 转义面。

## 离线完整示例源码

- [ChartsLegendItemsDemo](../snapshot/apps/nexus/app/components/content/demos/ChartsLegendItemsDemo.vue.txt)
- [ChartsLegendDashboardDemo](../snapshot/apps/nexus/app/components/content/demos/ChartsLegendDashboardDemo.vue.txt)

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
