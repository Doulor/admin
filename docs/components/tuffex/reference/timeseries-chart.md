# TimeseriesChart 时序图

> 时序折线与堆叠柱：标记聚簇、阈值线、缩放与刷选、tooltip 全功能。

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/timeseries-chart) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/timeseries-chart.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/timeseries-chart.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.1.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

`data` 是序列数组，每条序列的 `data` 是按时间排序的 `[timestamp_ms, value]` 元组。`color` 可省略——按序列位次落到分类色板，位次固定，隐藏某条序列不会让其余序列换色。悬停出 tooltip：多序列按值降序，同名序列去重，二分查找最近采样点。

### 双序列折线

官方示例：`TimeseriesChartBasicDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { TxTimeseriesChart } from '@talex-touch/tuffex/charts'

const data = [
  { name: 'Requests', data: requests },
  { name: 'Cache hits', data: cacheHits },
]
</script>

<template>
  <TxTimeseriesChart
    :data="data"
    x-axis-name="Time"
    y-axis-name="Count"
    :x-axis-tick-format="(ts) => new Date(ts).toLocaleTimeString()"
    :tooltip-value-format="(v) => `${v} req/s`"
  />
</template>
```

### 整数刻度 + tooltip 页脚

`yAxisMinInterval` 丢掉比间隔更近的刻度，适合离散计数；`tooltipFooter` 在 tooltip 行列表下方追加一行说明。

官方示例：`TimeseriesChartAxisDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const data = [
  { name: 'Retries', data: retries },
]
</script>

<template>
  <TxTimeseriesChart
    :data="data"
    :y-axis-min-interval="1"
    :y-axis-tick-count="5"
    tooltip-footer="Sampled hourly · retries only"
    :x-axis-tick-format="(ts) => new Date(ts).toLocaleTimeString()"
  />
</template>
```

## API 参考

### TimeseriesChart Props

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `data` | `TimeseriesData[]` | — | `{ name, data: [ts, value][], color? }`；`color` 缺省按位次取分类色。 |
| `type` | `'line' \| 'bar'` | `'line'` | 柱状自动堆叠。 |
| `markers` | `TimeseriesMarker[]` | — | `{ timestamp, label?, description?, color?, lineStyle? }`。 |
| `thresholds` | `TimeseriesThreshold[]` | — | `{ value, label?, color }`，y 轴自动扩展覆盖。 |
| `xAxisName` / `yAxisName` | `string` | — | 轴名。 |
| `xAxisTickCount` / `yAxisTickCount` | `number` | `5` | 建议刻度数。 |
| `xAxisTickFormat` / `yAxisTickFormat` | `(v: number) => string` | — | 刻度格式化。 |
| `yAxisMinInterval` | `number` | — | y 轴刻度最小间隔（ECharts `yAxis.minInterval`）：更近的刻度被丢弃，最低与最高刻度始终保留；设 `1` 时整数刻度不会再打印成 `1.0`。 |
| `tooltipValueFormat` | `(v: number) => string` | 原值 | tooltip 数值格式化。 |
| `tooltipMode` | `'all' \| 'single'` | `'all'` | `single` 只显示离光标 y 值最近的一条。 |
| `tooltipMaxItems` | `number` | `10` | 超出折叠为「+N more」。 |
| `tooltipFollowCursor` | `'both' \| 'x'` | `'both'` | `x` 时垂直位置固定，避免抖动。 |
| `tooltipFooter` | `string` | — | 在 tooltip 行列表下方追加一行文本。 |
| `tooltipBoundary` | `TimeseriesTooltipBoundary` | `'clipping-ancestors'` | tooltip 碰撞边界；默认沿裁剪祖先（`overflow` 非 `visible` 的 offsetParent）与视口求交后翻转。类型 `TimeseriesTooltipBoundary` 从 `@talex-touch/tuffex/charts` 入口导出。 |
| `incomplete` | `{ before?, after? }` | — | 不完整周期（仅 line）。 |
| `gradient` | `boolean` | `false` | 折线渐变填充。 |
| `loading` | `boolean` | `false` | 骨架态。 |
| `highlightedSeries` | `string \| null` | — | 高亮序列，其余降到 10% 不透明度。 |
| `height` | `number` | `350` | 像素高度。 |
| `width` | `number` | 容器实测 | 显式宽度（SSR/测试用）。 |
| `ariaDescription` | `string` | — | 图表的无障碍名称（svg `role="group"`，按键说明作为描述）；缺省用 `labels.chart`。 |
| `clusterLabel` | `(n: number) => string` | `` n => `${n} changes` `` | 聚簇标签文案。 |
| `timestampFormat` | `(ts: number) => string` | 紧凑本地化 | tooltip 时间行格式。 |
| `zoom` | `boolean` | `true` | 在图上缩放、平移时间轴；`false` 固定视图，此时挂上 `time-range-change` 仍可刷选。 |
| `window` | `[number, number] \| null` | `null` | 显示的时间窗口（毫秒时间戳），支持 `v-model:window`；`null` 显示全部。 |
| `labels` | `Partial<ChartLabels>` | 英文 | 无障碍名称与按键说明：`chart`、`instructions`、`zoomInstructions`。 |

### TimeseriesChart Events

| 事件名 | 回调参数 | 说明 |
|------|------|------|
| `time-range-change` | `(from: number, to: number)` | 刷选松手时回调所选范围，默认同时放大到这段；`zoom` 为 `false` 时挂上它才能刷选。 |
| `update:hiddenSeries` | `(names: string[])` | `v-model:hidden-series` 写回。 |
| `update:window` | `(window: [number, number] \| null)` | 缩放、平移、复位或跟随新数据后写回 `v-model:window`。 |

## 标记与阈值

`markers` 在时间轴上画竖虚线；挤在一起的标记按可视跨度自动聚簇成一条线，标签变成「N changes」（`clusterLabel` 可换文案），悬停标记线可见每条的 `label` 与 `description`。`thresholds` 在数值轴上画水平线，y 轴范围会自动扩到覆盖阈值。

### 部署标记 + SLO 线

官方示例：`TimeseriesChartMarkersDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const markers = [
  { timestamp: t1, label: 'Deploy v2.4', description: 'Rollout to 50%.' },
  { timestamp: t2, label: 'Config change' },
  { timestamp: t2 + tiny, label: 'Alert fired' },
]
const thresholds = [
  { value: 300, label: 'SLO 300ms', color: ChartPalette.semantic('Attention') },
]
</script>

<template>
  <TxTimeseriesChart :data="data" :markers="markers" :thresholds="thresholds" />
</template>
```

## 渐变与不完整数据

`gradient` 给折线加纵向渐变填充（序列色 40% → 透明）。`incomplete` 声明 `[before, after]` 之外的数据不完整：边界外的段画成虚线，且与实线段重叠一个采样点保证连线不断。

### 渐变 + 两端虚线

官方示例：`TimeseriesChartGradientDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTimeseriesChart
    :data="data"
    gradient
    :incomplete="{ before: start + 3 * hour, after: start + 20 * hour }"
  />
</template>
```

## 柱状堆叠

`type="bar"` 下所有序列自动堆叠（同 kumo 的 `stack: 'total'`），y 轴范围按每个时间点的堆叠总量计算。

### 按天堆叠

官方示例：`TimeseriesChartBarDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTimeseriesChart type="bar" :data="data" :x-axis-tick-format="formatDay" />
</template>
```

## 缩放与刷选

时间轴默认可缩放：在绘图区拖出一段，松手放大到这段；放大后拖动平移，越过两端回弹，松手后按速度滑行，按住 Shift 拖动仍是刷选。⌘/Ctrl + 滚轮或触控板捏合以指针为中心缩放，触屏双指捏合同理；触控板横向滑动平移放大后的视图，普通滚轮照常滚动页面；双击显示全部。聚焦图表后 `+` / `-` 缩放、Shift + ← / → 平移、`0` 显示全部。窗口停在最后一个时间点时随新数据前进。`v-model:window` 读写当前窗口，`null` 为全部。

监听 `time-range-change` 可在松手时拿到所选的 `(from, to)` 毫秒时间戳，选区随即清除；`:zoom="false"` 固定视图，此时挂上监听器只刷选、不缩放。拖动不足 4px 视为点击。选区矩形填充 `rgba(120, 140, 180, 0.3)`、1px 描边 `rgba(120, 140, 180, 0.8)`。拖拽过程中选区外的绘图区同步变淡：一层覆盖整个绘图区的亮度 `<mask>`（白色绘图区矩形加两条 `#4D4D4D` 条带）把选区外压到 30%，每条序列因此只挂载一次 —— 与 ECharts `outOfBrush.colorAlpha: 0.3` 等价。

### 拖拽选段

官方示例：`TimeseriesChartRangeDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTimeseriesChart :data="data" @time-range-change="(from, to) => (range = [from, to])" />
</template>
```

## 图例联动

`v-model:hidden-series` 双向绑定被隐藏的序列名数组：隐藏的序列不画、tooltip 也跳过。`highlighted-series` 高亮一条序列，其余降到 10% 不透明度（对应 ECharts blur 的 `fromState.opacity * 0.1`）。两者配合 `TxChartLegendItem` 即得可点击、可悬停高亮的图例。

### 点击隐藏 + 悬停高亮

官方示例：`TimeseriesChartLegendDemo`（完整源码见本页末尾）

```vue
<template>
  <TxChartLegendItem
    v-for="(name, i) in names"
    :key="name"
    :name="name"
    :color="ChartPalette.categoricalVar(i)"
    value=""
    :inactive="hidden.includes(name)"
    @click="toggle(name)"
    @pointerenter="highlighted = name"
    @pointerleave="highlighted = null"
  />
  <TxTimeseriesChart v-model:hidden-series="hidden" :data="data" :highlighted-series="highlighted" />
</template>
```

## 加载骨架

`loading` 用谐波波形骨架替换图表，折线与柱状两种形态共享同一条轮廓；shimmer 尊重 `prefers-reduced-motion`。

### 骨架轮播

官方示例：`TimeseriesChartLoadingDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTimeseriesChart :data="data" :type="type" :loading="loading" />
</template>
```

## 动画与交互

图表沿用 ECharts 的默认时序（kumo pin `echarts ^6.0.0`）：

- 首绘：折线/面积是从左到右的裁剪揭示，1000ms `easings.linear`；柱状从基线长出（y 由 `baseY` 插值到目标值、高度 0 → 目标）、散点由 0 缩放到半径并淡入，都是 1000ms cubicInOut。
- 数据更新：几何形变 500ms cubicInOut。
- 状态切换（emphasis / blur）：在指针到达的那一帧完成，不走 ECharts 的 300ms cubicOut（TuffEx 的悬停规则）。
- `animationThreshold` 2000：单序列点数超过它时直接渲染终态几何，不播动画。
- tooltip：隐藏前先延迟 100ms，再用 200ms 淡出并移除 DOM，短暂划过不会闪烁；位置通过 `transform: translate3d()` 交给浏览器插值出 400ms 位移（`cubic-bezier(0.23, 1, 0.32, 1)`）；指针跟踪按 50ms 节流，取 leading + trailing 两个采样。
- 刷选拖拽期间选区外变淡，松手立即恢复，见上节的单层 `<mask>`。
- 缩放：刷选、鼠标滚轮与按键以临界阻尼弹簧（响应 0.35s）过渡到新窗口；触控板捏合与拖动平移 1:1 跟手，平移松手后按速度滑行。
- 读数：悬停或按住拖动时十字线吸附到最近的采样时间戳；聚焦图表后 ← / → 逐点读数、Home / End 跳到首尾、Escape 清除，读屏播报时间与各序列的值。触屏单指按住拖动读数，纵向滑动仍滚动页面。
- 悬停绘图区时，除最接近光标所在时间戳取值的那条序列外，其余序列都降到 10% 不透明度；这是 ECharts `emphasis.focus: 'series'`（只在真正命中数据项时强调）的文档化近似。
- `prefers-reduced-motion: reduce` 下所有补间直接落到终态，CSS 过渡统一包在 `@media (prefers-reduced-motion: no-preference)` 内。

`@talex-touch/tuffex/charts` 入口同时导出动画原语，便于在自有图表里复用同一套时序：`easings`（`linear | cubicIn | cubicOut | cubicInOut`）、`cubicBezier(x1, y1, x2, y2)`、`tween({ duration, easing, delay, onUpdate, onComplete })`、`useEnterProgress(options)`、`useTweenedNumbers(source, options)`、`prefersReducedMotion()`，以及常量 `ENTER_DURATION` 1000、`UPDATE_DURATION` 500、`STATE_DURATION` 300、`ANIMATION_THRESHOLD` 2000。tooltip 时序常量（`TOOLTIP_FADE_DURATION` 200、`TOOLTIP_MOVE_DURATION` 400、`TOOLTIP_HIDE_DELAY` 100、`TOOLTIP_TRACK_THROTTLE` 50、`tooltipMoveEasing`）由图表入口内的 `core/animate` 提供。

## 与 kumo 的差异

- `enableLegendSelection` + echarts 命令式 action → `v-model:hidden-series` 声明式绑定；高亮用 `highlighted-series`。
- `tooltipBoundary` 走真实的 clipping-ancestors 碰撞：沿裁剪祖先（`overflow` 非 `visible` 的 offsetParent）与视口求交，越界时翻转，默认 `'clipping-ancestors'`。
- 刷选拖拽过程中选区外不再只是画矩形：单层亮度 `<mask>` 把选区外压到 30%，序列仍只挂载一次。
- kumo 的刷选只回调范围；这里默认同时放大，并可平移、捏合与键盘缩放，`:zoom="false"` 回到只刷选。
- 几何动画与 ECharts 对齐：饼图用 `animationType: 'expansion'` 角向生长、悬停外推 `scaleSize` 5px；sankey 与地图没有几何动画（`SankeyView` 无 `initProps`/`updateProps`，地图 `animationDurationUpdate: 0`），不是缺口。
- 绘图区悬停的系列级强调是近似：ECharts 只在真正命中数据项时 blur 其余序列，这里按光标时间戳取最近的一条。
- 建议每条序列 ≤ 5k 点：SVG 渲染在万点级会出现掉帧。

## 离线完整示例源码

- [TimeseriesChartBasicDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartBasicDemo.vue.txt)
- [TimeseriesChartAxisDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartAxisDemo.vue.txt)
- [TimeseriesChartMarkersDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartMarkersDemo.vue.txt)
- [TimeseriesChartGradientDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartGradientDemo.vue.txt)
- [TimeseriesChartBarDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartBarDemo.vue.txt)
- [TimeseriesChartRangeDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartRangeDemo.vue.txt)
- [TimeseriesChartLegendDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartLegendDemo.vue.txt)
- [TimeseriesChartLoadingDemo](../snapshot/apps/nexus/app/components/content/demos/TimeseriesChartLoadingDemo.vue.txt)

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
