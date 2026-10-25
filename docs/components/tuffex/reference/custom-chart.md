# Custom Chart 自定义图表

> 组合式逃生舱：TxChart 容器 + 轴/网格/系列原语，自由拼装折线、面积、柱、散点与环形。

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/custom-chart) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/custom-chart.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/custom-chart.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.1.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

kumo 的逃生舱是把原始 echarts options 透传给低层 `Chart`；这一职责在这里由 [ECharts 图表家族](./echart-charts.md) 承担（`TxEChart` 加类型化封装），本页则是**组合**逃生舱：`TxChart` 建立坐标系（测量容器、推导比例尺、分配色板），轴/网格/系列作为子组件挂进它的默认插槽。系列统一 accessor 取数（key 或 `(d, i) => v`），不给 `color` 时按挂载顺序取分类色。x/y 值域缺省由所有系列的数据并集推导，`xDomain`/`yDomain` 可显式覆盖。

### 柱线复合

官方示例：`CustomChartComposedDemo`（完整源码见本页末尾）

```vue
<template>
  <TxChart x-type="band" :height="280" :padding="{ top: 24, right: 24, bottom: 36, left: 56 }">
    <TxChartGrid y />
    <TxAxis position="bottom" />
    <TxAxis position="left" :format="(v) => `${v}k`" />
    <TxBarSeries :data="rows" x="month" y="revenue" :radius="3" />
    <TxLineSeries :data="rows" x="month" y="growth" curve="monotone" show-symbol />
  </TxChart>
</template>
```

### 环形图

官方示例：`CustomChartDonutDemo`（完整源码见本页末尾）

```vue
<template>
  <TxChart :height="260" :padding="8">
    <TxArcSeries :data="data" value="count" name="label" :inner-radius="0.65" @slice-click="onSlice" />
  </TxChart>
</template>
```

### 自定义提示框

官方示例：`CustomChartTooltipDemo`（完整源码见本页末尾）

```vue
<template>
  <TxChart :height="260">
    <TxScatterSeries :data="points" x="x" y="y" :r="(d) => d.size" />
    <template #overlay>
      <TxChartTooltip follow="x" :fixed-y="8">
        <template #default="{ pointerX }">
          <span>cursor at {{ Math.round(pointerX) }}px</span>
        </template>
      </TxChartTooltip>
    </template>
  </TxChart>
</template>
```

自定义图层不会自动动画：`TxChart` 只负责坐标系，动画由系列共享的导出原语提供。首绘入场用 `useEnterProgress()`（返回 0 → 1 的 `Ref<number>`），数据更新用 `useTweenedNumbers(source)`（把数值数组平滑追到最新值），要自定节奏就用 `tween()` 配 `easings` / `cubicBezier()`。时长与阈值同样导出：`ENTER_DURATION`（1000）、`UPDATE_DURATION`（500）、`STATE_DURATION`（300）、`ANIMATION_THRESHOLD`（2000）；超过阈值的序列不做动画，`prefers-reduced-motion: reduce` 下所有补间直接落到终帧。

```vue
<script setup lang="ts">
import { ANIMATION_THRESHOLD, ENTER_DURATION, easings, useChartContext, useEnterProgress } from '@talex-touch/tuffex/charts'
import { computed } from 'vue'

const props = defineProps<{ pointCount: number }>()
const ctx = useChartContext('MyLayer')
const plot = computed(() => ctx.plot.value)

// 0 → 1 的入场进度；超阈值或 reduced-motion 时直接停在 1
const enter = useEnterProgress({
  duration: ENTER_DURATION,
  easing: easings.linear,
  enabled: () => props.pointCount <= ANIMATION_THRESHOLD,
})
const enterWidth = computed(() => plot.value.width * enter.value)
</script>

<template>
  <defs>
    <clipPath id="my-layer-enter">
      <rect :x="plot.x" :y="plot.y" :width="enterWidth" :height="plot.height" />
    </clipPath>
  </defs>
  <g :clip-path="'url(#my-layer-enter)'">
    <slot />
  </g>
</template>
```

## API 参考

### Chart Props

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `height` | `number` | `350` | 像素高；设 `aspectRatio` 时忽略。 |
| `aspectRatio` | `number \| string` | — | 容器宽高比。 |
| `width` | `number` | 容器实测 | 显式宽度（SSR/测试用）。 |
| `padding` | `number \| Partial<ChartPadding>` | `24` | 留给轴与标签的内边距。 |
| `xType` | `'linear' \| 'log' \| 'time' \| 'band'` | `'linear'` | x 比例尺类型；`log` 轴不画 x ≤ 0 的数据。 |
| `xDomain` / `yDomain` | 数组 | 自动并集 | 显式值域。 |
| `yNice` | `boolean` | `true` | y 值域取整。 |
| `ariaDescription` | `string` | — | 无障碍名称，缺省用 `labels.chart`；图表不可聚焦时以 `role="img"` 朗读。 |
| `interactive` | `boolean` | `true` | 悬停、按住拖动与方向键读数；`false` 只留一张静态图，不可聚焦也不读数。 |
| `announce` | `(x: string \| number) => string` | 按 x 轴刻度格式化 | 键盘读到某个 x 值时播报的文本。 |
| `labels` | `Partial<ChartLabels>` | 英文 | 无障碍名称与按键说明：`chart`、`instructions`，会缩放的图表改读 `zoomInstructions`。 |

### 系列 Props（共同）

| 属性名 | 类型 | 说明 |
|------|------|------|
| `data` | `T[]` | 数据行。 |
| `x` / `y` | `keyof T \| (d, i) => v` | accessor。 |
| `color` | `string` | 缺省按挂载顺序取分类色。 |

`TxLineSeries` 另有 `curve`（`linear/monotone/natural/step`）、`strokeWidth`、`showSymbol`、`dashed`，以及 `enter`（默认 `clip` 从左向右擦开；`draw` 沿线描出、描到哪个点才显示该点的标记，虚线仍用 `clip`）；`TxAreaSeries` 有 `gradient`（默认开）与 `fillOpacity`；`TxBarSeries` 有 `stack`、`barWidth`、`radius`；`TxScatterSeries` 有 `r`（常量或 accessor）；`TxArcSeries` 用 `value/name?/color?` accessor 加 `innerRadius/padAngle/cornerRadius`，点击发 `slice-click`，悬停发 `slice-hover`（带 `{ datum, index, name, value }`，指针移出弧形时为 `null`）——无轴弧形没有坐标系可读，`#overlay` 里的 `<TxChartTooltip>` 就靠它取数。弧形按住拖动时像转盘一样按角度逐片读数，松手不触发 `slice-click`；聚焦后 ← / → 逐片读数、Home / End 跳到首尾、Escape 清除，`announce` 改播报文案（默认 `name: value`）。

### ChartTooltip Props

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `open` | `boolean \| 'auto'` | `'auto'` | `'auto'` 指针在图内即显示；布尔为受控。 |
| `follow` | `'both' \| 'x'` | `'both'` | `x` 固定垂直位置。 |
| `offset` | `number` | `12` | 指针与提示框间距。 |
| `footer` | `string` | — | 行列表下方追加的一行文本（对应 kumo 的 `tooltipFooter`）。 |
| `boundary` | `'clipping-ancestors' \| Element \| Element[]` | `'clipping-ancestors'` | 碰撞边界（对应 ECharts `confine`）：默认沿裁剪祖先与视口求交后翻转。 |
| `title` / `rows` / `hiddenCount` | — | — | 默认内容；插槽整体替换。 |

提示框的节奏同样对齐 ECharts：`hideDelay` 100ms 之后才开始 200ms 淡出并移除 DOM，指针短暂划出图表不会闪断；位移交给 `transform: translate3d()` 的 400ms 过渡由浏览器补间；指针追踪按 50ms 节流（首次与最后一次各补一次采样）。

## 读数

`TxChart` 自带读数，自定义图层只需读 `pointer`：

- 鼠标悬停把读数放在指针处；按住拖动（鼠标、触屏、触控笔）超过 4px 后持续读数，拖出绘图区时停在边缘。拖动松手产生的点击会被吞掉，不会落到图表或外层元素上。
- 触屏单指按下即读数；图表设了 `touch-action: pan-y`，纵向滑动仍滚动页面。
- 聚焦图表后 ← / → 按 x 逐个数据点读数，Home / End 跳到首尾，Escape 清除；读数写进礼貌的 live region，`announce` 可改文案。
- `useChartContext().pointer` 的 `x` / `y` 是容器像素坐标，`inside` 表示正在显示读数，`pressed` 表示正在按住拖动，`source` 为 `'keyboard'` 时读数来自按键：落在数据点的 x、绘图区垂直居中，没有指针高度。
- `nearestXStop(px)` 返回离某个像素最近的数据 x，十字线据此吸附到数据上；`registerKeyLayer({ key, clear })` 注册的按键层先于逐点读数收到按键，返回 `true` 即已处理，`TxArcSeries` 的逐片读数就是这样接入的。

## 组合规则

- 系列/轴/网格必须是 `<TxChart>` 的子孙——它们通过注入的图表上下文拿比例尺，游离使用会抛错。
- 多个 `TxBarSeries`：无 `stack` 并排分道，同 `stack` 键堆叠；y 值域自动覆盖堆叠总量。
- `TxArcSeries` 不依赖坐标系，可与无轴 `TxChart` 单独使用。
- `#overlay` 插槽是 SVG 之上的 DOM 层（`pointer-events: none`），放提示框与标注。
- 深度定制可 `useChartContext()` 自写图层，或从 `TxChart` 实例的 `context` 暴露读取比例尺。

## 离线完整示例源码

- [CustomChartComposedDemo](../snapshot/apps/nexus/app/components/content/demos/CustomChartComposedDemo.vue.txt)
- [CustomChartDonutDemo](../snapshot/apps/nexus/app/components/content/demos/CustomChartDonutDemo.vue.txt)
- [CustomChartTooltipDemo](../snapshot/apps/nexus/app/components/content/demos/CustomChartTooltipDemo.vue.txt)

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
