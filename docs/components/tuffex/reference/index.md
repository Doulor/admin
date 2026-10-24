# 理念总览

> Tuffex 的理念、套件与完整组件索引

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/index.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/index.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.9`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

Tuffex（`@talex-touch/tuffex`）是服务 CoreBox、插件界面与本文档站的 Vue 3 组件库。

## 理念

| 页面 | 内容 |
|------|------|
| [安装与引入](./installation.md) | 三种引入方式与样式文件 |
| [设计基础](./foundations.md) | G2 曲率、琉光折射、暗色光学、13-14px 排版与 Token 体系 |
| [设计工程概念手册](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/concepts/index.zh.mdc) | 18 篇深度专栏：物理曲率、着色器色散、微动效与流式防抖 |
| [主题定制](./theming.md) | 覆盖 token、深色与高对比度 |
| [图标体系](./icons.md) | `TxIcon` 如何解析与加载图标 |
| [无障碍](./accessibility.md) | 焦点、动效、对比度与 ARIA 约定 |
| [Utils 工具函数](./utils.md) | 层级、提示、对话框与动画工具 |
| [Sound 交互音效](./sound.md) | 默认关闭的合成反馈音 |
| [组件变更历程](./changelog.md) | 版本历程与 Since 索引 |

## 套件总览

| 套件 | 分组 | 页数 | 引入入口 |
|------|------|------|----------|
| [理念](./index.md) | 安装、设计规则、概念手册与工具 | 27 | 纯文档 |
| [模板](./template-shell.md) | 应用框架 / 内容运营 / AI 应用 / 数据与流程 | 16 | 组合现有入口 |
| [基础套件](./base-suite.md) | 通用 / 表单 / 布局 / 导航 / 数据展示 / 反馈 / 状态占位 | 95 | `@talex-touch/tuffex/base` |
| [进阶套件](./pro-suite.md) | 高级交互 / 视觉效果 / 底层原语 | 40 | `@talex-touch/tuffex/pro` |
| [AI 套件](./ai-suite.md) | 对话 / 智能体 / 推理与生成 / 上下文与洞察 | 36 | `@talex-touch/tuffex/ai` |
| [数据套件](./data-suite.md) | 图表 / 可视化 | 12 | `@talex-touch/tuffex/pro` + `/charts` |
| [流程套件](./flow-suite.md) | 流程编排 | 1 | `@talex-touch/tuffex/ai` |
| [动效套件](./motion-suite.md) | 按钮、轮播、加载、文字、转场等 10 组 | 12 | `@talex-touch/tuffex/pro` + `/charts` |

- 页数按文档条目计，不含套件总览页，不等于导出组件数。
- 套件入口只有 `base`、`pro`、`ai` 三个；数据、流程、动效是文档分类，图表另有 `@talex-touch/tuffex/charts`。

## 组合示例

官方示例：`ComponentsWorkflowPanelDemo`（完整源码见本页末尾）

```vue
<template>
  <TxButton variant="primary" size="sm" icon="i-carbon-rocket">发布</TxButton>
  <TuffInput v-model="query" placeholder="搜索任务" prefix-icon="i-carbon-search" clearable />
  <TuffSwitch v-model="automationEnabled" />
  <TxProgressBar :percentage="84" status="success" show-text />
  <TxStatusBadge text="审阅中" status="warning" />
  <TxDataTable v-model:selected-keys="selectedKeys" :columns="columns" :data="rows" row-key="id" selectable />
</template>
```

## 教程路径

- 先读《[Tuffex 组合界面教程](./tuffex-composition.md)》，按「操作区 → 状态区 → 数据区」切分页面。
- 列表页用 `TxSearchInput`、`TxSearchSelect`、`TxSearchEmpty` 串起搜索与无结果恢复，`TxDataTable` + `TxPagination` 承载数据。
- 数据区同时设计加载、空态与错误：`TxLoadingState`、`TxEmptyState`、`TxErrorState`。
- 后台页组合 `TxDataTable`、`TxStatusBadge`、`TxProgressBar` 与图表，不手写一次性 SVG 或状态 UI；设置页用 `TxTabs` 分区、`TxDrawer` 承载高密度配置。

## 迁移状态看板

`已确认`：人工审阅完成；`已迁移`：AI 迁移，建议对照源码；`迁移中` / `未迁移`：示例与 API 仍可能调整。侧边栏只标出仍需关注的页面。

此处为官网动态目录/交互图库；离线组件与审阅状态见 [组件索引](../COMPONENTS.md)。

## 模板

### 应用框架

- [应用外壳](./template-shell.md)
- [启动器](./template-launcher.md)
- [设置](./template-settings.md)
- [引导](./template-onboarding.md)

### 内容运营

- [CMS](./template-cms.md)
- [图库](./template-gallery.md)
- [收件箱](./template-inbox.md)
- [文件](./template-files.md)
- [商店](./template-store.md)
- [文档](./template-docs.md)

### AI 应用

- [智能体对话](./template-agent-chat.md)
- [AI 回答](./template-ai-answer.md)
- [研究](./template-research.md)

### 数据与流程

- [仪表盘](./template-dashboard.md)
- [自动化](./template-automation.md)
- [发布](./template-release.md)

## 基础组件

### 通用

- [Button 按钮](./button.md)
- [Icon 图标](./icon.md)
- [Avatar 头像](./avatar.md)
- [Avatar Variants 头像变体](./avatar-variants.md)
- [Tag 标签](./tag.md)
- [Badge 徽标](./badge.md)
- [StatusBadge 状态徽标](./status-badge.md)
- [IconChip 图标角标](./icon-chip.md)
- [Kbd 快捷键](./kbd.md)
- [Divider 分割线](./divider.md)

### 表单

- [Form 表单](./form.md)
- [Input 输入](./input.md)
- [SensitiveInput 敏感输入框](./sensitive-input.md)
- [Textarea 多行输入](./textarea.md)
- [NumberInput 数字输入](./number-input.md)
- [SearchInput 搜索输入框](./search-input.md)
- [TagInput 标签输入](./tag-input.md)
- [ScrubField 拖拽数值域](./scrub-field.md)
- [Select 选择器](./select.md)
- [FlatSelect 扁平选择](./flat-select.md)
- [SearchSelect 搜索选择器](./search-select.md)
- [TreeSelect 树选择器](./tree-select.md)
- [Cascader 级联选择](./cascader.md)
- [Picker 滚轮选择](./picker.md)
- [DatePicker 日期选择](./date-picker.md)
- [IconPicker 图标选择器](./icon-picker.md)
- [Radio 单选框](./radio.md)
- [FlatRadio 平铺单选](./flat-radio.md)
- [Checkbox 复选框](./checkbox.md)
- [Switch 开关](./switch.md)
- [Slider 滑块](./slider.md)
- [SegmentedSlider 分段滑块](./segmented-slider.md)
- [Rating 评分](./rating.md)
- [FileUploader 文件上传](./file-uploader.md)
- [ImageUploader 图片上传](./image-uploader.md)

### 布局

- [Container 容器](./container.md)
- [Flex 弹性布局](./flex.md)
- [Grid 栅格](./grid.md)
- [GridLayout 网格布局](./grid-layout.md)
- [Stack 堆叠](./stack.md)
- [Splitter 分割面板](./splitter.md)
- [Scroll 滚动](./scroll.md)
- [Collapse 折叠](./collapse.md)
- [Card 卡片](./card.md)
- [CardItem 卡片项](./card-item.md)
- [GroupBlock 分组块](./group-block.md)

### 导航

- [Tabs 标签页](./tabs.md)
- [TabBar 底部导航](./tab-bar.md)
- [NavBar 导航栏](./nav-bar.md)
- [SidebarNav 侧边导航](./sidebar-nav.md)
- [Breadcrumb 面包屑](./breadcrumb.md)
- [Steps 步骤条](./steps.md)
- [Pagination 分页](./pagination.md)
- [DropdownMenu 下拉菜单](./dropdown-menu.md)
- [FlatDropdown 扁平下拉](./flat-dropdown.md)
- [ContextMenu 右键菜单](./context-menu.md)

### 数据展示

- [DataTable 数据表格](./data-table.md)
- [Descriptions 描述列表](./descriptions.md)
- [Tree 树形](./tree.md)
- [SortableList 拖拽排序](./sortable-list.md)
- [Timeline 时间线](./timeline.md)
- [Transfer 穿梭框](./transfer.md)
- [StatCard 指标卡片](./stat-card.md)
- [CellLink 单元格链接](./cell-link.md)
- [DotIndicator 圆点指示器](./dot-indicator.md)
- [FilterChips 筛选胶囊](./filter-chips.md)
- [MarkdownView Markdown 渲染](./markdown-view.md)
- [ImageGallery 图片预览](./image-gallery.md)

### 反馈

- [Dialog 弹窗](./dialog.md)
- [Modal 模态框](./modal.md)
- [Drawer 抽屉](./drawer.md)
- [Popover 弹出层](./popover.md)
- [Tooltip 提示](./tooltip.md)
- [Toast 提示](./toast.md)
- [ToastPanel 浮出面板](./toast-panel.md)
- [Alert 提示条](./alert.md)
- [StatusHint 状态提示](./status-hint.md)
- [Progress 进度](./progress.md)
- [ProgressBar 进度条](./progress-bar.md)
- [Spinner 加载](./spinner.md)
- [LoadingOverlay 加载遮罩](./loading-overlay.md)
- [SelectionActions 划词工具条](./selection-actions.md)

### 状态占位

- [Empty 空状态](./empty.md)
- [EmptyState 空态引导](./empty-state.md)
- [NoData 无数据](./no-data.md)
- [NoSelection 未选择](./no-selection.md)
- [SearchEmpty 搜索空态](./search-empty.md)
- [ErrorState 错误状态](./error-state.md)
- [OfflineState 离线](./offline-state.md)
- [PermissionState 权限不足](./permission-state.md)
- [GuideState 引导状态](./guide-state.md)
- [BlankSlate 空白页](./blank-slate.md)
- [LoadingState 加载态](./loading-state.md)
- [Skeleton 骨架屏](./skeleton.md)
- [LayoutSkeleton 布局骨架](./layout-skeleton.md)

## 进阶套件

### 高级交互

- [CommandPalette 命令面板](./command-palette.md)
- [SearchPanel 内联搜索面板](./search-panel.md)
- [MarkdownEditor Markdown 编辑器](./markdown-editor.md)
- [CodeEditor 代码编辑器](./code-editor.md)
- [Terminal 终端显示](./terminal.md)
- [VirtualList 虚拟列表](./virtual-list.md)
- [VersionCapsule 版本胶囊](./version-capsule.md)
- [MotionForm 动效表单](./motion-form.md)
- [MotionControl 复合控件](./motion-control.md)
- [MotionMetric 复合指标](./motion-metric.md)

### 视觉效果

- [GlassSurface 玻璃拟态](./glass-surface.md)
- [GradientBorder 渐变边框](./gradient-border.md)
- [OutlineBorder 描边容器](./outline-border.md)
- [BorderBeam 流光边框](./border-beam.md)
- [PrismGlow 棱镜光](./prism-glow.md)
- [CornerOverlay 角标容器](./corner-overlay.md)
- [GradualBlur 渐变模糊](./gradual-blur.md)
- [EdgeFadeMask 边缘渐隐遮罩](./edge-fade-mask.md)
- [GlowText 扫光](./glow-text.md)
- [KeyframeStrokeText 关键帧描边](./keyframe-stroke-text.md)
- [TuffLogoStroke Logo 描边](./tuff-logo-stroke.md)
- [TextMorph 文本形变](./text-morph.md)
- [IconMorph 图标形变](./icon-morph.md)
- [Morph 形变容器](./morph.md)
- [TextTransformer 文本变换](./text-transformer.md)
- [Transition 动效](./transition.md)
- [Stagger 依次进入](./stagger.md)
- [Fusion 交融](./fusion.md)
- [FusionSurface 融合表面](./fusion-surface.md)
- [FlowLight 流光底](./flow-light.md)
- [Liquid 液态流体](./liquid.md)
- [FlipOverlay 翻转遮罩](./flip-overlay.md)
- [ImageGeneration 生图占位](./image-generation.md)
- [MetalFx 液态金属](./metal-fx.md)
- [VoiceBeam 语音光束](./voice-beam.md)

### 底层原语

- [BaseSurface 基础表面](./base-surface.md)
- [BaseAnchor 锚点定位](./base-anchor.md)
- [Floating 浮动层](./floating.md)
- [AutoSizer 自适应尺寸](./auto-sizer.md)
- [ResizeBox 显式尺寸动画](./resize-box.md)

## AI 套件

部分移植自 [Beautiful UI](https://www.beautifului.dev)（MIT）。

### 对话

- [Chat 消息列表](./chat.md)
- [ChatComposer 消息输入](./chat-composer.md)
- [PromptBar 提示条](./prompt-bar.md)
- [AttachmentTray 附件区](./attachment-tray.md)
- [ModeChip 模式芯片](./mode-chip.md)
- [MessageActions 消息操作条](./message-actions.md)
- [SuggestionChips 建议胶囊](./suggestion-chips.md)
- [ChoiceCard 选项卡片](./choice-card.md)
- [TypingIndicator 打字中](./typing-indicator.md)
- [ConversationStream 会话流](./conversation-stream.md)
- [VoiceClip 语音条](./voice-clip.md)

### 智能体

- [Agents 智能体列表](./agents.md)
- [AgentScreen 智能体屏幕](./agent-screen.md)
- [AgentTrace 智能体轨迹](./agent-trace.md)
- [TaskRows 任务行](./task-rows.md)
- [ToolCallCard 工具调用卡片](./tool-call-card.md)
- [ToolChips 工具调用流](./tool-chips.md)
- [ToolConfirmation 工具授权](./tool-confirmation.md)
- [ApprovalCard 澄清问卷卡](./approval-card.md)
- [WorkingIndicator 工作指示器](./working-indicator.md)
- [BotAvatar 机器人头像](./bot-avatar.md)

### 推理与生成

- [AI Elements AI 对话元素](./ai-elements.md)
- [ChainOfThought 推理时间线](./chain-of-thought.md)
- [ReasoningDisclosure 推理过程](./reasoning-disclosure.md)
- [ThinkingOrb 思考指示球](./thinking-orb.md)
- [StreamElement 流式回答](./stream-element.md)
- [StreamText 流式文字](./stream-text.md)
- [StreamMarkdown 流式 Markdown](./stream-markdown.md)
- [CodeStream 流式代码块](./code-stream.md)
- [InlineCitation 行内引用](./inline-citation.md)
- [Sources 引用来源](./sources.md)

### 上下文与洞察

- [ContextCards 检索片段卡](./context-cards.md)
- [ContextIndicator 上下文用量](./context-indicator.md)
- [InsightCards 洞察卡](./insight-cards.md)
- [RecommendationCard 建议卡](./recommendation-card.md)
- [FineTuneCard 属性检查器](./fine-tune-card.md)

## 数据

### 图表

- [Charts 图表](./charts.md)
- [Chart Colors 图表色板](./chart-colors.md)
- [ECharts 图表](./echart-charts.md)
- [TimeseriesChart 时序图](./timeseries-chart.md)
- [LearningCurve 学习曲线](./learning-curve.md)
- [Maps 地图](./maps.md)
- [MonoChart 单色图表](./mono-chart.md)
- [SankeyChart 桑基图](./sankey-chart.md)
- [Custom Chart 自定义图表](./custom-chart.md)

### 可视化

- [SparkChart 迷你折线图](./spark-chart.md)
- [AllocationBar 占比条](./allocation-bar.md)
- [DiffTable 变更表格](./diff-table.md)
- [SignalMeter 信号量表](./signal-meter.md)

## 流程

### 流程编排

- [Flowchart 流程画布](./flowchart.md)

## 动效

### 按钮

- [MotionButton 动效按钮](./motion-button.md)

### 卡片展开

- [CardSpread 卡片展开](./card-spread.md)

### 3D 轮播

- [Carousel3D 三维轮播](./carousel-3d.md)
- [FlipBook 翻页书](./flip-book.md)

### 加载动效

- [MotionLoader 加载动效](./motion-loader.md)

### 抖动图表

- [DitherChart 抖动图表](./dither-chart.md)

### 文字

- [MotionText 文字动效](./motion-text.md)

### 物理动效

- [PhysicsMotion 物理动效](./physics-motion.md)

### 悬停、指针与滚动

- [MotionDock 动效 Dock](./motion-dock.md)
- [Motion 悬停与滚动](./motion.md)

### 切换控件

- [MotionToggle 动效切换](./motion-toggle.md)

### 转场

- [MotionTransition 动效转场](./motion-transition.md)

## 技术实现

- 导出组件 slug 集合：`packages/tuffex/packages/components/src/components.ts`；本页须链接每个已文档化的导出组件，由 `apps/nexus/test/docs/tuffex-component-docs-coverage.test.ts` 校验。
- 演示注册表：`apps/nexus/app/components/content/demo-registry.ts`；套件预览网格：`apps/nexus/app/components/docs/DocsComponentsGallery.vue`（`suite` 必填）。

## 离线完整示例源码

- [ComponentsWorkflowPanelDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsWorkflowPanelDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
