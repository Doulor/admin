# ECharts 图表家族

> Tuffex 的 ECharts 图表：主题化宿主 TxEChart，以及折线、柱状、饼图、漏斗、雷达、仪表盘、散点、热力图、矩形树图等类型化封装。

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/echart-charts) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/echart-charts.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/echart-charts.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 安装

`echarts` 是可选 peer 依赖：宿主装了它，这一族就点亮；不装，Tuffex 其它部分毫无变化。它永远不会被打进主包——组件在挂载时动态引入，因此第一次渲染才单独出一块 chunk。

```bash
pnpm add echarts @talex-touch/tuffex
```

```ts
import { TxEChart, TxLineChart } from '@talex-touch/tuffex/charts'
```

## 用法

### 最佳实践

- 给宿主一个确定的高度。高度为 0 的容器画不出任何东西。
- 优先用类型化封装；旭日图可直接给 `TxEChart` 传 `type: 'sunburst'` 的分层 `data`，运行时已注册该类型。其它长尾类型须先通过 `loadECharts()` 取得运行时并注册对应的 ECharts 模块。
- 传 `aria-label`：它让 canvas 图表对辅助技术可读。
- 传数据而不是像素：封装负责把数据映射成 option，主题色与坐标轴质感才能保持一致。
- 在宿主应用里安装 `echarts`；缺少 peer 时容器内会给出提示，而不是静默空白。

## API 参考

这一族每张图都接受下列公共 props，外加各自的data props，并且都转发一份原始 `option` 覆盖在生成的 option 之上——对象深度合并，数组整体替换。`series` 与 `dataZoom` 都在此列：传入的 `dataZoom` 列表会取代内置的缩放。

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `option` | `EChartsOption` | — | 覆盖在生成 option 之上：每张图的自定义出口。 |
| `height` | `number \| string` | `320` | 图表高度：px 或任意 CSS 长度。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | `auto` 跟随周围主题。 |
| `ariaLabel` | `string` | — | 无障碍名称；同时在宿主上加 `role="img"`。 |
| `loading` | `boolean` | `false` | 数据到达前的主题化 loading 遮罩。 |

`update` 只存在于 `TxEChart`：`'replace'`（默认）整体替换series数组，被移除的series立即停止绘制；`'merge'` 保留 ECharts 自身的合并语义。

`cooperativeWheel`（默认 `true`）存在于 `TxEChart` 以及会缩放的封装：折线、柱状、散点与矩形树图。见「指针输入」。

### Per-chart props

| 图表 | Props |
|------|------|
| `TxLineChart` | `series`（`name`、`data`、`color?`、`area?`、`smooth?`、`stack?`、`dashed?`）、`categories?`、`xAxisName?`、`yAxisName?`、`showLegend?`、`grid?`、`zoom?`、`cooperativeWheel?` |
| `TxBarChart` | `series`（`name`、`data`、`color?`、`stack?`）、`categories?`、`xAxisName?`、`yAxisName?`、`showLegend?`、`grid?`、`stacked?`、`horizontal?`、`barWidth?`、`showLabel?`、`zoom?`、`cooperativeWheel?` |
| `TxPieChart` | `data`（`name`、`value`、`color?`）、`donut?`、`roseType?`、`showLegend?`、`labelPosition?`、`centerLabel?`、`unit?` |
| `TxFunnelChart` | `data`（`name`、`value`、`color?`）、`sort?`、`gap?`、`minSize?`、`maxSize?`、`labelPosition?`、`showLabel?`、`showLegend?`、`unit?` |
| `TxRadarChart` | `indicators`（`name`、`max`、`min?`）、`series`（`name`、`data`、`color?`、`area?`）、`shape?`、`splitNumber?`、`showLegend?`、`showAxisName?` |
| `TxGaugeChart` | `value`、`min?`、`max?`、`name?`、`unit?`、`precision?`、`progress?`、`segments?`、`color?` |
| `TxScatterChart` | `series`（`name`、`data`、`color?`、`symbolSize?`）、`xAxisName?`、`yAxisName?`、`symbolSize?`、`showLegend?`、`grid?`、`xMin?`、`xMax?`、`yMin?`、`yMax?`、`zoom?`、`cooperativeWheel?` |
| `TxHeatmapChart` | `values`、`rows`、`columns`、`xAxisName?`、`yAxisName?`、`visualMap?`、`min?`、`max?`、`showLabel?`、`unit?`、`selectable?`、`labels?` |
| `TxTreemapChart` | `data`（`name`、`value?`、`color?`、`children?`）、`maxDepth?`、`showBreadcrumb?`、`showLabel?`、`unit?`、`roam?`、`cooperativeWheel?` |

构造器本身也是公开 API——`buildBarChartOption`、`buildLineChartOption` 等都返回一份普通 `EChartsOption`。需要在一张图里混用图形类型时，用它们先各自生成再合并，然后把结果交给 `TxEChart`。

## 主题化宿主

`TxEChart` 负责整个生命周期：解析当前主题的图表 token、应用主题、再把你的 option 画上去。主题把 `stateAnimation.duration` 设为 0，悬停高亮与其余 series 变淡都在指针到达的那一帧完成；要恢复 ECharts 的 300ms 过渡，在 option 里传 `stateAnimation`。旭日图已注册，可直接传入分层数据；未内置注册的其它 ECharts 类型需要先注册对应模块。

```vue
<script setup lang="ts">
import { TxEChart } from '@talex-touch/tuffex/charts'
import type { EChartsOption } from 'echarts'

const option: EChartsOption = {
  tooltip: { trigger: 'item' },
  series: [{
    type: 'sunburst',
    radius: ['20%', '90%'],
    data: [
      { name: '2.5.x', children: [{ name: '2.5.1-beta.2', value: 40 }, { name: '2.5.0', value: 35 }] },
      { name: '2.4.x', children: [{ name: '2.4.13', value: 25 }] },
    ],
  }],
}
</script>

<template>
  <TxEChart :option="option" :height="280" aria-label="版本系列与具体版本分布" />
</template>
```

## 图表

### 折线图

`TxLineChart` 在类目轴上绘制一条或多条series，可选面积填充、堆叠与平滑曲线。多条series共用同一坐标轴；tooltip 按轴触发，所以悬停类目下的每条series都会列出。`zoom`（默认开启）沿类目轴加入缩放与平移；手势见「指针输入」。

官方示例：`EChartLineChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const categories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const series = [
  { name: 'Installs', data: [420, 468, 512, 494, 548, 610, 586], area: true },
  { name: 'Sessions', data: [820, 932, 901, 934, 1290, 1330, 1320] },
]
</script>

<template>
  <TxLineChart :series="series" :categories="categories" y-axis-name="Count" :height="260" />
</template>
```

### 柱状图

`TxBarChart` 在类目轴上绘制分组或堆叠柱，默认纵向。`stacked` 会给未自带 `stack` 的每条series都挂上共享 id `total`，于是堆叠与独立series可以共存于一张图；`showLabel` 把数值写在柱上（`horizontal` 时写在右侧）。`zoom`（默认开启）以同样的方式缩放、平移类目。

官方示例：`EChartBarChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const categories = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const series = [
  { name: 'Installs', data: [420, 468, 512, 494, 548, 610, 586] },
  { name: 'Sessions', data: [820, 932, 901, 934, 1290, 1330, 1320] },
]
</script>

<template>
  <TxBarChart :series="series" :categories="categories" y-axis-name="Count" :height="260" />
</template>
```

### 饼图

整体的切片，可选择中空。`donut` 传 `true` 用 60% 内径，传数字则精确指定内径百分比；`centerLabel` 只在环形图里渲染，`labelPosition` 把切片标签放到外侧、内侧或中心。

官方示例：`EChartPieChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const data = [
  { name: 'Docs', value: 4820 },
  { name: 'Blog', value: 3160 },
  { name: 'Store', value: 2140 },
  { name: 'Pricing', value: 980 },
  { name: 'Other', value: 640 },
]
</script>

<template>
  <TxPieChart :data="data" donut center-label="Traffic share" unit="views" :height="260" />
</template>
```

### 漏斗图

逐级转化。`sort` 重排阶段（默认 `descending`）；`labelPosition: 'outside'` 映射到 ECharts 的 `outer` 位置，于是阶段名落在漏斗旁边而不是内部。每个标签的转化率以 `data` 的第一个元素为基数，所以请按希望被统计的顺序传入阶段。

官方示例：`EChartFunnelChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const data = [
  { name: 'Visit', value: 12000 },
  { name: 'Signup', value: 3600 },
  { name: 'Trial', value: 1800 },
  { name: 'Paid', value: 540 },
  { name: 'Renew', value: 380 },
]
</script>

<template>
  <TxFunnelChart :data="data" unit="users" :height="260" />
</template>
```

### 雷达图

在同一组坐标轴上比较多个对象。`indicators` 的每一项是一根轴，每条series按位置给数值：`data[i]` 对应 `indicators[i]`。`shape` 在 `polygon` 与 `circle` 之间切换外框，`splitNumber` 设置环数，`showAxisName: false` 在周边文案已点明时去掉轴名。

官方示例：`EChartRadarChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const indicators = [
  { name: 'Launch', max: 100 },
  { name: 'Search', max: 100 },
  { name: 'Plugins', max: 100 },
  { name: 'Sync', max: 100 },
  { name: 'Memory', max: 100 },
]
const series = [
  { name: 'Desktop', data: [92, 88, 84, 90, 62], area: true },
  { name: 'Mobile', data: [78, 82, 70, 86, 88], area: true },
]
</script>

<template>
  <TxRadarChart :indicators="indicators" :series="series" :height="260" />
</template>
```

### 仪表盘

一个读数画在表盘上；传 `progress` 则变成细圆环。`precision` 控制读数位数，`unit` 直接拼接且不加分隔符（`72` 加 `%` 显示为 `72%`）。`color` 只染进度环与读数、不染表盘，所以刻度质感仍由主题决定。

官方示例：`EChartGaugeChartDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGaugeChart :value="72" name="P95 hit rate" unit="%" :height="260" />
</template>
```

### 散点图

数值平面上的点，每条series一对坐标轴。`symbolSize` 设置整图点径，series 级的值优先；需要多张图共用同一量纲时，用 `xMin` / `xMax` / `yMin` / `yMax` 固定值域。`zoom`（默认开启）同时缩放、平移两个坐标轴。

官方示例：`EChartScatterChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const series = [
  { name: 'On-device', data: [[12, 180], [18, 240], [24, 260], [31, 300]] },
  { name: 'Cloud', data: [[48, 620], [62, 780], [75, 860], [90, 940]] },
]
</script>

<template>
  <TxScatterChart :series="series" x-axis-name="Latency (ms)" y-axis-name="Throughput (req/s)" :height="260" />
</template>
```

### 热力图

强度矩阵。`values` 按行主序传入（`values[row][column]`），`rows` 与 `columns` 命名两个类目轴。构造器把这两个数组原样交给 ECharts，而 ECharts 把第一个类目画在底部——所以 `rows[0]` 是最下面那一行。声明的 `visualMap` 默认读顺序色板的 token 渐变，除非你自己传 `inRange.color`。

在绘图区拖拽可框选一块单元格。`select` 给出 `HeatmapSelection`——`rows` 与 `columns` 是含两端的索引区间，`cells` 是区间内的单元格——清除后给出 `null`。`cells` 是快照：标签不变而 `values` 更新时，选区保留且不会再次触发 `select`；`rows` 或 `columns` 变化则清除选区。拖拽不会触发 `click`；`:selectable="false"` 关闭框选。朗读文案与播报来自 `labels`，合并到 `HEATMAP_DEFAULT_LABELS` 之上。

官方示例：`EChartHeatmapChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const columns = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const rows = ['00-04', '04-08', '08-12', '12-16', '16-20']
const values = [
  [10, 8, 12, 9, 7, 22, 27],
  [6, 5, 8, 7, 4, 12, 15],
  [38, 43, 40, 47, 52, 32, 26],
  [50, 55, 52, 58, 65, 40, 34],
  [34, 40, 37, 42, 60, 47, 30],
]
</script>

<template>
  <TxHeatmapChart :values="values" :rows="rows" :columns="columns" :height="260" />
</template>
```

### 矩形树图

面向层级的占比图。节点通过 `children` 嵌套，节点的 `color` 就是它的填充色，`showBreadcrumb` 打开 ECharts 的面包屑下钻条；`maxDepth` 只画前 N 层并开启该下钻，不传则整棵树一次画完。不传 `children` 时同一个 prop 画出扁平矩形树。

`roam` 默认开启：拖拽平移，⌘/Ctrl + 滚轮或双指捏合从适配尺寸起放大，双击重新布局。`:roam="false"` 让方块保持不动，并把触屏滑动还给页面。

官方示例：`EChartTreemapChartDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
const data = [
  { name: 'Desktop', children: [
    { name: 'Workbench', value: 46 },
    { name: 'Marketplace', value: 28 },
    { name: 'Settings', value: 14 },
  ] },
  { name: 'Mobile', children: [
    { name: 'Home', value: 38 },
    { name: 'Messages', value: 22 },
    { name: 'Profile', value: 12 },
  ] },
]
</script>

<template>
  <TxTreemapChart :data="data" unit="visits" :height="260" />
</template>
```

## 指针输入

折线、柱状、散点与矩形树图可以缩放、平移，热力图可以框选。页面保留自己的滚动：普通滚轮不会缩放。

| 图表 | 输入 | 效果 |
|------|------|------|
| 折线、柱状、散点 | ⌘/Ctrl + 滚轮、双指捏合 | 以指针为中心缩放。 |
| 折线、柱状、散点 | 拖拽 | 放大之后平移。 |
| 折线、柱状、散点 | 双击绘图区 | 动画回到完整区间。 |
| 矩形树图 | ⌘/Ctrl + 滚轮、双指捏合 | 以指针为中心缩放，不会小于适配尺寸。 |
| 矩形树图 | 拖拽 | 平移方块。 |
| 矩形树图 | 双击 | 重新布局。 |
| 热力图 | 在绘图区拖拽 | 框选一块完整的单元格，并触发 `select`。 |
| 热力图 | 单击、`Escape` | 清除选区。 |

`cooperativeWheel`（默认 `true`）让普通滚轮继续滚动页面。设为 `false` 会把滚轮还给 ECharts：绘图区上的每一次滚轮都缩放，页面不再滚动。

放大后的区间在传入新的 `option`、切换主题和调用 `redraw()` 之后都会保留。例外是自带 `start`、`end`、`startValue` 或 `endValue` 的 `dataZoom` 项：它每次都从自己写明的区间开始。

与原生的地图、桑基图相比：

- 缩放按 ECharts 固定的档位前进（每次事件 1.1×、1.2× 或 1.4×），而不是跟随手势连续变化。没有弹簧、没有松手后的惯性、没有橡皮筋：平移在指针停下的地方停下。
- 复位动画 350 ms；`prefers-reduced-motion: reduce` 下直接跳到终点。
- 没有键盘缩放与平移。热力图是唯一带焦点停靠点的图表：有选区时才是 Tab 停靠点，让 `Escape` 能清除它。它的 `labels` 携带朗读文案与带 `{count}` / `{total}` 的播报。
- 触屏上双指捏合可以缩放。未缩放的折线、柱状、散点让滑动滚动页面，放大之后滑动改为平移；带 `roam` 的矩形树图始终占用滑动，请给它留出可供页面滚动的边距，或设 `:roam="false"`。可框选的热力图同样占用所有滑动，因为触屏就是靠滑动来框选的：想让页面从它上面滚过去，请设 `:selectable="false"`。
- 矩形树图的平移没有边界，这是 ECharts 的原生行为，双击即可回位。热力图的选区吸附到整格。

## Events

| Event | Payload | Description |
|------|------|-------------|
| `ready` | `(instance: ECharts)` | 实例已就绪——option 表达不了的事情从这里拿命令式句柄。 |
| `click` / `dblclick` | `(params: EChartEventParams)` | series 与标记上的指针事件。 |
| `mouseover` / `mouseout` | `(params: EChartEventParams)` | series 与标记上的悬停事件。 |
| `legendselectchanged` | `(params: EChartEventParams)` | 图例项被切换。 |
| `datazoom` | `(params: EChartEventParams)` | dataZoom 区间变化，内置缩放也算在内。 |
| `select` | `(selection: HeatmapSelection \| null)` | 仅 `TxHeatmapChart`：拖拽框选了一块单元格，或选区被清除。 |

## 技术实现

- 组件源码：`packages/tuffex/packages/components/src/charts/src/echart/src/`。
- option 构造器：`packages/tuffex/packages/components/src/charts/src/echart/src/options/`。
- 主题与 token：`packages/tuffex/packages/components/src/charts/src/echart/src/core/theme.ts`。
- 指针输入：`packages/tuffex/packages/components/src/charts/src/echart/src/core/interaction.ts`。
- 改编自 Cloudflare kumo (https://github.com/cloudflare/kumo)，© Cloudflare, Inc.，MIT —— `EChart.tsx`。



## 使用场景

原生 SVG 家族（`TxChart`、`TxTimeseriesChart`、`TxSankeyChart`、`TxChoroplethMap`、`TxSparkChart`、`TxAllocationBar`）仍是默认选择：体积更小、走 CSS token 主题化、形状贴合产品真实要画的东西。当你需要原生家族没有的图表类型，或者想直接用 ECharts 自己的配置面——dataZoom、visualMap、自定义 series、逐点样式——就用 `TxEChart` 及其类型化封装。

两族读同一套颜色 token，所以把 ECharts 图放在原生图旁边，两种主题下都自动对齐，一个样式 prop 都不用传。

## 离线完整示例源码

- [EChartLineChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartLineChartDemo.vue.txt)
- [EChartBarChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartBarChartDemo.vue.txt)
- [EChartPieChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartPieChartDemo.vue.txt)
- [EChartFunnelChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartFunnelChartDemo.vue.txt)
- [EChartRadarChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartRadarChartDemo.vue.txt)
- [EChartGaugeChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartGaugeChartDemo.vue.txt)
- [EChartScatterChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartScatterChartDemo.vue.txt)
- [EChartHeatmapChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartHeatmapChartDemo.vue.txt)
- [EChartTreemapChartDemo](../snapshot/apps/nexus/app/components/content/demos/EChartTreemapChartDemo.vue.txt)

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
