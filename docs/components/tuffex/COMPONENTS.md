# Tuffex 组件与指南索引

> 按官方分类检索中文文档；每页包含 API、示例和固定版本源码链接。

状态：`reference-snapshot` · 230 篇 · 源码包 0.9.1 · 提交 `34449085a1f2be8138ab290198762dc79643b33b`

先读 [AI-GUIDE](AI-GUIDE.md) 和 [使用政策](USAGE-POLICY.md)。本索引不宣称所有上游能力已审阅或适配到本项目。

## Advanced

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [CodeEditor 代码编辑器](./reference/code-editor.md) | 基于 CodeMirror 的配置与代码编辑器 | pro | reviewed |
| [CommandPalette 命令面板](./reference/command-palette.md) | 搜索并执行命令的浮层面板 | pro | reviewed |
| [MarkdownEditor](./reference/markdown-editor.md) | 支持所见即所得、源码与预览模式的 Markdown 编辑器 | pro | reviewed |
| [MotionControl](./reference/motion-control.md) | 移植自 Amicro UIkit 的动效控件集 | pro | reviewed |
| [MotionForm](./reference/motion-form.md) | 基于 TuffEx 表单控件的十五种动效交互 | pro | documented |
| [MotionMetric](./reference/motion-metric.md) | 由调用方数据驱动的指标卡、图表与复合仪表 | pro | reviewed |
| [SearchPanel 内联搜索面板](./reference/search-panel.md) | 输入框、实时结果与空态合为一体的内联搜索卡片 | pro | reviewed |
| [Terminal 终端显示](./reference/terminal.md) | 显示 ANSI 与 Unicode 输出的终端组件 | pro | reviewed |
| [VersionCapsule 版本胶囊](./reference/version-capsule.md) | 左半下载构建、右半打开历史的分段版本胶囊 | pro | reviewed |
| [VirtualList 虚拟列表](./reference/virtual-list.md) | 只渲染可见行的固定行高长列表 | pro | reviewed |

## AiAgent

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [AgentScreen 智能体屏幕](./reference/agent-screen.md) | 呈现智能体当前画面的定比例画框 | ai | reviewed |
| [AgentTrace 智能体轨迹](./reference/agent-trace.md) | 可展开的智能体执行轨迹 | ai | reviewed |
| [Agents 智能体列表](./reference/agents.md) | 按可用状态分组的可选智能体列表 | ai | reviewed |
| [ApprovalCard 澄清问卷卡](./reference/approval-card.md) | 智能体动手前逐题澄清的问卷卡 | ai | reviewed |
| [BotAvatar](./reference/bot-avatar.md) | 用 canvas 绘制的动画机器人头像 | ai | reviewed |
| [TaskRows 任务行](./reference/task-rows.md) | 带状态与可展开明细的智能体任务行 | ai | reviewed |
| [Tool Call Card](./reference/tool-call-card.md) | 单次工具调用的状态卡片 | ai | reviewed |
| [ToolChips 工具调用流](./reference/tool-chips.md) | 一次智能体运行的紧凑工具调用流 | ai | reviewed |
| [Tool Confirmation](./reference/tool-confirmation.md) | 工具调用前的授权卡片 | ai | reviewed |
| [WorkingIndicator 工作指示器](./reference/working-indicator.md) | 长任务进行中的行内状态指示器 | ai | reviewed |

## AiChat

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Attachment Tray](./reference/attachment-tray.md) | 展示图片与文件附件的消息附件区 | ai | reviewed |
| [Chat 消息列表](./reference/chat.md) | AI 对话记录的消息列表与消息行 | ai | reviewed |
| [ChatComposer 消息输入](./reference/chat-composer.md) | 带上下文托盘的 AI 消息输入框 | 见文档 | reviewed |
| [ChoiceCard 选项卡片](./reference/choice-card.md) | 以图标、标题和说明行作答、可分步翻页的问题卡片 | ai | reviewed |
| [Conversation Stream](./reference/conversation-stream.md) | 虚拟滚动、自动吸底、向上加载历史的会话流 | ai | reviewed |
| [Message Actions](./reference/message-actions.md) | 消息下方的操作条，内置复制、重新生成与朗读 | ai | reviewed |
| [ModeChip 模式芯片](./reference/mode-chip.md) | 表示当前模式、切换时原地变身的按钮 | ai | reviewed |
| [PromptBar 提示条](./reference/prompt-bar.md) | 内联 @ 数据源、/ 命令与模型选择的紧凑输入条 | ai | reviewed |
| [Suggestion Chips](./reference/suggestion-chips.md) | 一键发起追问的建议胶囊 | ai | reviewed |
| [TypingIndicator 打字中](./reference/typing-indicator.md) | 聊天界面内联的输入中与加载状态指示器 | 见文档 | reviewed |
| [VoiceClip 语音条](./reference/voice-clip.md) | 可播放、可拖动定位的语音消息胶囊 | ai | reviewed |

## AiContext

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [ContextCards 检索片段卡](./reference/context-cards.md) | RAG 检索片段及其来源的卡片列表 | ai | reviewed |
| [Context Indicator](./reference/context-indicator.md) | 显示对话上下文用量的环形指示器 | ai | reviewed |
| [FineTuneCard 属性检查器](./reference/fine-tune-card.md) | 共用一个值对象的紧凑属性检查器 | ai | reviewed |
| [InsightCards 洞察卡](./reference/insight-cards.md) | 逐页展示结论、证据与追问的洞察卡 | ai | reviewed |
| [RecommendationCard 建议卡](./reference/recommendation-card.md) | 带置信度的智能体建议卡 | ai | reviewed |

## AiReasoning

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [AI Elements](./reference/ai-elements.md) | 用于 AI 对话界面的会话与消息基础组件 | ai | reviewed |
| [Chain of Thought](./reference/chain-of-thought.md) | 多步推理与工具调用的时间线 | ai | reviewed |
| [CodeStream 流式代码块](./reference/code-stream.md) | 带文件名头部、可流式输出的代码块 | ai | reviewed |
| [InlineCitation 行内引用](./reference/inline-citation.md) | 嵌在正文中的来源引用胶囊 | ai | reviewed |
| [Reasoning Disclosure](./reference/reasoning-disclosure.md) | 可折叠的推理过程区域 | ai | reviewed |
| [Sources](./reference/sources.md) | 可折叠的引用来源列表 | ai | reviewed |
| [StreamElement 流式回答](./reference/stream-element.md) | 流式呈现整段 AI 回答的元素 | ai | reviewed |
| [Stream Markdown](./reference/stream-markdown.md) | 面向流式输出的 Markdown 渲染器 | ai | reviewed |
| [StreamText 流式文字](./reference/stream-text.md) | 逐词匀速显影的流式文字 | ai | reviewed |
| [Thinking Orb](./reference/thinking-orb.md) | Canvas 绘制的思考指示球 | ai | reviewed |

## AiSuite

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [AI 套件](./reference/ai-suite.md) | 对话、智能体、推理与上下文组件 | 见文档 | reviewed |

## BaseSuite

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [基础套件](./reference/base-suite.md) | 通用、表单、布局、导航、数据展示、反馈与状态组件 | 见文档 | reviewed |

## Basic

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Avatar 头像](./reference/avatar.md) | 代表用户身份的图片、首字母或图标 | base | reviewed |
| [Avatar Variants 头像变体](./reference/avatar-variants.md) | 为头像添加状态点、角标与描边的组合配方 | 见文档 | reviewed |
| [Badge 徽标](./reference/badge.md) | 紧凑的计数、状态或圆点标记 | base | reviewed |
| [Button 按钮](./reference/button.md) | 触发操作的按钮，含分割、图标与复制按钮 | base | reviewed |
| [Divider 分割线](./reference/divider.md) | 分隔内容区块的水平或垂直线条 | base | reviewed |
| [Icon 图标](./reference/icon.md) | 以类名、内置名或资源渲染的图标 | base | reviewed |
| [IconChip 图标角标](./reference/icon-chip.md) | 承载格式标记、首字母或小图标的色块 | base | reviewed |
| [Kbd](./reference/kbd.md) | 显示键盘按键的标记 | base | reviewed |
| [StatusBadge 状态徽标](./reference/status-badge.md) | 以色调、图标与文字表示状态的徽标 | base | reviewed |
| [Tag 标签](./reference/tag.md) | 用于分类、筛选与状态的紧凑标签 | base | reviewed |

## Charts

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Chart Colors 图表色板](./reference/chart-colors.md) | 分类、语义、顺序与地图色板：CSS 变量随主题自动切换，ChartPalette 提供字面值。 | 见文档 | reviewed |
| [Charts 图表](./reference/charts.md) | 图表家族总览：原生 SVG 图表与按需加载的 ECharts 图表 | pro | reviewed |
| [Custom Chart 自定义图表](./reference/custom-chart.md) | 组合式逃生舱：TxChart 容器 + 轴/网格/系列原语，自由拼装折线、面积、柱、散点与环形。 | 见文档 | reviewed |
| [ECharts 图表家族](./reference/echart-charts.md) | Tuffex 的 ECharts 图表：主题化宿主 TxEChart，以及折线、柱状、饼图、漏斗、雷达、仪表盘、散点、热力图、矩形树图等类型化封装。 | 见文档 | reviewed |
| [LearningCurve 学习曲线](./reference/learning-curve.md) | 按训练步数比较多次运行的平滑指标曲线 | 见文档 | reviewed |
| [Maps 地图](./reference/maps.md) | GeoJSON 地图：气泡图与分级填色图，Mercator 默认投影，缩放平移。 | 见文档 | reviewed |
| [MonoChart](./reference/mono-chart.md) | 30 种圆角单色图表与真实数据驱动的 GitHub 活动日历。 | 见文档 | reviewed |
| [SankeyChart 桑基图](./reference/sankey-chart.md) | d3-sankey 布局的流向图：渐变连线、节点值标签、下钻标记与插槽提示框。 | 见文档 | reviewed |
| [TimeseriesChart 时序图](./reference/timeseries-chart.md) | 时序折线与堆叠柱：标记聚簇、阈值线、缩放与刷选、tooltip 全功能。 | 见文档 | reviewed |

## Data

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [CellLink 单元格链接](./reference/cell-link.md) | 表格单元格中由宿主决定如何打开的链接 | base | reviewed |
| [DataTable 数据表格](./reference/data-table.md) | 支持语义单元格、列筛选、排序、选择与展开的数据表格 | base | reviewed |
| [Descriptions 描述列表](./reference/descriptions.md) | 按列排布的只读标签与值列表 | base | reviewed |
| [DotIndicator 圆点指示器](./reference/dot-indicator.md) | 圆点加文案的状态指示原语 | base | reviewed |
| [FilterChips 筛选胶囊](./reference/filter-chips.md) | 带圆点与计数的单选筛选条 | base | reviewed |
| [ImageGallery 图片预览](./reference/image-gallery.md) | 缩略图网格加全屏灯箱预览 | base | reviewed |
| [MarkdownView Markdown 渲染](./reference/markdown-view.md) | GitHub 风格 Markdown 的渲染视图 | base | reviewed |
| [SortableList 拖拽排序](./reference/sortable-list.md) | 支持拖拽与键盘重排的可排序列表 | base | reviewed |
| [StatCard 指标卡片](./reference/stat-card.md) | 展示核心数字、趋势与进度的指标卡片 | base | reviewed |
| [Timeline 时间线](./reference/timeline.md) | 按时间顺序展示事件的列表 | base | reviewed |
| [Transfer 穿梭框](./reference/transfer.md) | 在两个列表间移动条目的穿梭框 | base | reviewed |
| [Tree 树形](./reference/tree.md) | 可筛选、可选择的层级树 | base | reviewed |

## DataSuite

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [数据套件](./reference/data-suite.md) | 可视化与图表：主包内的数据展示组件，以及图表家族子路径 | 见文档 | reviewed |

## Effects

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [BorderBeam 流光边框](./reference/border-beam.md) | 沿边框游走或呼吸的光束包装器 | pro | reviewed |
| [CornerOverlay 角标覆盖层](./reference/corner-overlay.md) | 固定在内容角落的绝对定位覆盖层 | pro | reviewed |
| [EdgeFadeMask 边缘渐隐遮罩](./reference/edge-fade-mask.md) | 仅在有隐藏溢出时渐隐边缘的滚动容器 | pro | reviewed |
| [FlipOverlay 翻转遮罩](./reference/flip-overlay.md) | 从触发源翻转展开的 3D Overlay | pro | reviewed |
| [FlowLight 流光底](./reference/flow-light.md) | 固定品牌色的面板光层 | pro | reviewed |
| [Fusion 交融](./reference/fusion.md) | 激活时让两个插槽交融的 gooey 效果 | pro | reviewed |
| [FusionSurface 融合表面](./reference/fusion-surface.md) | 边上长出凸起、凸起可拉断成水滴的圆角表面 | pro | reviewed |
| [GlassSurface 玻璃拟态](./reference/glass-surface.md) | 折射背后内容的玻璃容器 | pro | reviewed |
| [GlowText 扫光](./reference/glow-text.md) | 在文字或内容上扫过一道高光的动效 | pro | reviewed |
| [GradientBorder 渐变边框](./reference/gradient-border.md) | 环绕内容旋转的渐变边框包装器 | pro | reviewed |
| [GradualBlur 渐变模糊](./reference/gradual-blur.md) | 贴在容器或页面边缘的分层渐变模糊 | pro | reviewed |
| [IconMorph 图标形变](./reference/icon-morph.md) | 以弹簧物理在描边图标间形变的组件 | pro | reviewed |
| [ImageGeneration](./reference/image-generation.md) | 生图或慢加载图片的 WebGL 像素马赛克占位 | pro | reviewed |
| [KeyframeStrokeText 关键帧描边](./reference/keyframe-stroke-text.md) | 先描边、后填充的 SVG 文字动效 | pro | reviewed |
| [Liquid 液态流体](./reference/liquid.md) | 相触即融合的双层液态特效群组 | pro | reviewed |
| [MetalFx](./reference/metal-fx.md) | 按钮、文字与徽标的 WebGL2 液态金属材质 | pro | reviewed |
| [Morph 形变容器](./reference/morph.md) | 在多个状态间连续形变的形状容器 | pro | reviewed |
| [OutlineBorder 描边容器](./reference/outline-border.md) | 带描边与可选裁切的包裹容器 | pro | reviewed |
| [PrismGlow 棱镜光](./reference/prism-glow.md) | 从元素一条边升起、横向流动的光谱光锥 | pro | reviewed |
| [Stagger 依次进入](./reference/stagger.md) | 按子节点顺序依次进入与离开的过渡组 | pro | reviewed |
| [TextMorph 文本形变](./reference/text-morph.md) | 只让变化的字符段动起来的文本形变 | pro | reviewed |
| [TextTransformer 文本变换](./reference/text-transformer.md) | 逐字形变或整串交叉淡化的短文本过渡 | pro | reviewed |
| [Transition 动效](./reference/transition.md) | 用于内容切换、列表与推入翻页的过渡封装 | pro | reviewed |
| [TuffLogoStroke Logo 描边](./reference/tuff-logo-stroke.md) | Tuff Logo 的 SVG 描边动画 | pro | reviewed |
| [VoiceBeam](./reference/voice-beam.md) | 沿元素底边律动的音频响应辉光 | pro | reviewed |

## Feedback

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Alert 警告](./reference/alert.md) | 在页面内显示上下文状态的提示横幅 | base | reviewed |
| [Dialog 对话框](./reference/dialog.md) | 用于确认与提示的一组模态对话框 | base | reviewed |
| [Drawer 抽屉](./reference/drawer.md) | 从屏幕边缘滑出的模态面板 | base | reviewed |
| [LoadingOverlay 加载遮罩](./reference/loading-overlay.md) | 覆盖内容区域或全屏的加载遮罩 | base | reviewed |
| [Modal 模态框](./reference/modal.md) | 用于短阻塞任务的轻量对话框 | base | reviewed |
| [Popover 弹出层](./reference/popover.md) | 锚定在触发元素旁的轻量浮层 | base | reviewed |
| [Progress 进度](./reference/progress.md) | 基于 TxProgressBar 的线性进度行 | base | reviewed |
| [ProgressBar 进度条](./reference/progress-bar.md) | 显示确定、不确定或分段进度的进度条 | base | reviewed |
| [SelectionActions 划词工具条](./reference/selection-actions.md) | 把选中文字交给智能体改写的浮动工具条 | base | reviewed |
| [Spinner 加载](./reference/spinner.md) | 表示不确定等待的旋转指示器 | base | reviewed |
| [StatusHint 状态提示](./reference/status-hint.md) | 说明一次操作结果的单行状态提示 | base | reviewed |
| [Toast 提示](./reference/toast.md) | 在屏幕一角堆叠显示的短暂通知 | base | reviewed |
| [ToastPanel 浮出面板](./reference/toast-panel.md) | 从来源下方浮出新条目的面板 | base | reviewed |
| [Tooltip 提示](./reference/tooltip.md) | 悬停或聚焦时显示的简短提示 | base | reviewed |

## Flow

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Flowchart 流程画布](./reference/flowchart.md) | 点阵画布上的工作流节点：分类胶囊、卡片插槽、自动贝塞尔连线，可拖拽且始终受控。 | ai | reviewed |

## FlowSuite

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [流程套件](./reference/flow-suite.md) | 工作流编排：点阵画布上的节点、分支与连线 | 见文档 | reviewed |

## Form

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Cascader 级联选择](./reference/cascader.md) | 从层级数据中选择一条或多条路径的选择器 | base | reviewed |
| [Checkbox 复选框](./reference/checkbox.md) | 在选中与未选中之间切换的复选控件 | base | reviewed |
| [DatePicker 日期选择](./reference/date-picker.md) | 以 YYYY-MM-DD 字符串为值的日期选择器 | base | reviewed |
| [FileUploader 文件上传](./reference/file-uploader.md) | 选择或拖入文件并以受控列表管理的上传控件 | base | reviewed |
| [FlatRadio 平铺选择器](./reference/flat-radio.md) | 在 2–5 个选项间平铺选择的分段控件 | base | reviewed |
| [FlatSelect 平铺下拉选择器](./reference/flat-select.md) | 选项覆盖触发器展开的下拉选择器 | base | reviewed |
| [Form 表单](./reference/form.md) | 带字段布局与校验的表单容器 | base | reviewed |
| [IconPicker](./reference/icon-picker.md) | 选取图标并返回标识符字符串的选择器 | base | reviewed |
| [ImageUploader 图片上传](./reference/image-uploader.md) | 带本地预览的受控图片选择器 | base | reviewed |
| [Input 输入](./reference/input.md) | 接收单行或多行文本的输入框 | base | reviewed |
| [NumberInput](./reference/number-input.md) | 带步进按钮与范围限制的数字输入框 | base | reviewed |
| [Picker 滚轮选择](./reference/picker.md) | 按列滚动选值的滚轮选择器 | base | reviewed |
| [Radio 单选框](./reference/radio.md) | 在一组互斥选项中选择一项的控件 | base | reviewed |
| [Rating 评分](./reference/rating.md) | 以星级选择分值的输入控件 | base | reviewed |
| [ScrubField 拖拽数值域](./reference/scrub-field.md) | 标签即拖动手柄的紧凑数值输入 | base | reviewed |
| [SearchInput 搜索输入框](./reference/search-input.md) | 内置搜索图标、按 Enter 搜索的输入框 | base | reviewed |
| [SearchSelect 搜索选择器](./reference/search-select.md) | 输入即搜索、点选即回填的选择器 | base | reviewed |
| [SegmentedSlider 分段滑块](./reference/segmented-slider.md) | 在一组离散档位中选择一项的滑块 | base | reviewed |
| [Select 选择器](./reference/select.md) | 从下拉列表中选择一个或多个值的控件 | base | reviewed |
| [SensitiveInput 敏感输入框](./reference/sensitive-input.md) | 用于 API Key 与密钥的掩码输入框 | base | reviewed |
| [Slider 滑块](./reference/slider.md) | 在区间内选择数值的滑块 | base | reviewed |
| [Switch 开关](./reference/switch.md) | 在开与关两种状态间切换的控件 | base | reviewed |
| [TagInput 标签输入](./reference/tag-input.md) | 以回车或分隔符录入标签的输入框 | base | reviewed |
| [Textarea](./reference/textarea.md) | 带字数统计与状态样式的多行输入框 | base | reviewed |
| [TreeSelect 树选择器](./reference/tree-select.md) | 在下拉浮层中选择树形数据的选择器 | base | reviewed |

## Foundations

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [无障碍](./reference/accessibility.md) | Tuffex 组件的无障碍约定与覆盖范围 | 见文档 | reviewed |
| [组件变更历程](./reference/changelog.md) | TuffEx 版本历程与各组件的引入版本 | 见文档 | reviewed |
| [设计基础](./reference/foundations.md) | Tuffex 设计工程哲学、G2 曲率连续性、折射材质、暗色光学、排版律动与核心 Token 体系。 | 见文档 | reviewed |
| [图标体系](./reference/icons.md) | TxIcon 的图标解析顺序与加载配置 | 见文档 | reviewed |
| [理念总览](./reference/index.md) | Tuffex 的理念、套件与完整组件索引 | 见文档 | reviewed |
| [安装与引入](./reference/installation.md) | 安装 Tuffex 并按组件、按套件或从根入口引入 | 见文档 | reviewed |
| [Sound 交互音效](./reference/sound.md) | 默认关闭的合成 UI 反馈音 | 见文档 | reviewed |
| [主题定制](./reference/theming.md) | 从全局 token 到单个组件的四层主题覆盖 | 见文档 | reviewed |
| [Utils 工具函数](./reference/utils.md) | 根入口与 ./utils 导出的公开工具函数 | 见文档 | reviewed |

## Guides

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Tuffex 组合界面教程](./reference/tuffex-composition.md) | 使用 Tuffex 组件搭建可审阅、可截图验证的后台页面切片 | 见文档 | migrated |
| [TuffEx](./reference/tuffex-tooling.md) | 具有精美动画效果的现代 Vue3 组件库 | 见文档 | 未声明 |

## Layout

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Card 卡片](./reference/card.md) | 带头部、正文与底部插槽的表面容器 | base | reviewed |
| [CardItem 卡片项](./reference/card-item.md) | 带头像、文本与右侧操作的紧凑列表行 | base | reviewed |
| [Collapse 折叠面板](./reference/collapse.md) | 可展开与收起内容的面板组 | base | reviewed |
| [Container 容器](./reference/container.md) | 限定宽度与留白的容器及 24 列栅格 | base | reviewed |
| [Flex 弹性布局](./reference/flex.md) | 控制方向、对齐、换行与间距的 Flexbox 容器 | base | reviewed |
| [Grid 栅格](./reference/grid.md) | 按行与列排布内容的网格容器 | base | reviewed |
| [GridLayout 网格布局](./reference/grid-layout.md) | 列数自动适配、带指针光斑的网格容器 | base | reviewed |
| [GroupBlock 分组块](./reference/group-block.md) | 承载设置行的可折叠分组 | base | reviewed |
| [Scroll 滚动](./reference/scroll.md) | 基于 BetterScroll 或原生滚动的滚动容器 | base | reviewed |
| [Splitter 分割面板](./reference/splitter.md) | 可拖拽调整比例的双面板布局 | base | reviewed |
| [Stack 堆叠](./reference/stack.md) | 沿单一方向排列子元素并统一间距的容器 | base | reviewed |

## MotionButtons

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [MotionButton 动效按钮](./reference/motion-button.md) | 保留原生按钮和链接语义的 13 类交互与 35 个来源图标组合 | pro | reviewed |

## MotionCards

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [卡片展开](./reference/card-spread.md) | 内容驱动的九种展开几何与聚焦模糊链接，支持选择、抽出卡片、邮票参数和键盘操作。 | pro | 未声明 |

## MotionCarousels

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [三维轮播](./reference/carousel-3d.md) | 弧线、CoverFlow 和 Time Machine 独立轨迹，支持彩色、单色内容、受控当前项、拖动和时间轴。 | pro | 未声明 |
| [翻页书](./reference/flip-book.md) | 真实双面书页、拖动翻页、DitherBook 控件和宽屏书页预设，支持调用方内容与纸张参数。 | pro | 未声明 |

## MotionCharts

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [DitherChart](./reference/dither-chart.md) | 由真实数据驱动的像素图表、有序抖动和SVG纹理，支持周期、图例和日期游标。 | 见文档 | reviewed |

## MotionInteraction

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Motion 通用交互](./reference/motion.md) | 由调用方内容、指针和滚动位置驱动的入场、悬停与可见性效果。 | pro | 未声明 |
| [动态应用栏](./reference/motion-dock.md) | 调用方项目支持临近弹簧放大、指针拖动和键盘排序。 | pro | reviewed |

## MotionLoaders

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [动态加载器](./reference/motion-loader.md) | 137 个源定义加载场景，支持独立播放、本地化和可见性控制。 | pro | reviewed |

## MotionPhysics

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [物理动效](./reference/physics-motion.md) | 保留 61 种独立的折叠、笔画、堆叠和机械运动结构，可以抓住并甩出。 | pro | reviewed |

## MotionSuite

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [动效套件](./reference/motion-suite.md) | 按钮、卡片展开、3D 轮播、加载动效、抖动图表与输入驱动动效 | 见文档 | reviewed |

## MotionText

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [MotionText](./reference/motion-text.md) | 45 个可追溯文字效果、4 个 registry 揭示，以及乱序揭示、调用方行内媒体和真实焦点模糊交互。 | pro | reviewed |

## MotionToggles

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [MotionToggle 动态开关](./reference/motion-toggle.md) | 12 种受控开关与操作样式，保留真实模型、图标反馈和调用方计数。 | pro | 未声明 |

## MotionTransitions

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [MotionTransition](./reference/motion-transition.md) | 受控内容转场，支持门、液体波、光圈、翻转和分层帘 | pro | reviewed |

## Navigation

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Breadcrumb 面包屑](./reference/breadcrumb.md) | 显示当前页在层级中位置的导航路径 | base | reviewed |
| [ContextMenu 右键菜单](./reference/context-menu.md) | 在指针或指定坐标处打开的命令菜单 | base | reviewed |
| [DropdownMenu 下拉菜单](./reference/dropdown-menu.md) | 从触发器展开的短命令菜单 | base | reviewed |
| [FlatDropdown 扁平下拉](./reference/flat-dropdown.md) | 由插槽定义触发器与内容的浮层下拉面板 | base | migrated |
| [NavBar 导航栏](./reference/nav-bar.md) | 页面顶部的标题与操作栏 | base | reviewed |
| [Pagination 分页](./reference/pagination.md) | 在多页数据间切换的导航控件 | base | reviewed |
| [SidebarNav 侧边导航](./reference/sidebar-nav.md) | 带搜索与分组的工作区侧边导航 | base | reviewed |
| [Steps 步骤条](./reference/steps.md) | 显示流程进度的步骤序列 | base | reviewed |
| [TabBar 底部导航](./reference/tab-bar.md) | 移动端底部的主导航栏 | base | reviewed |
| [Tabs 标签页](./reference/tabs.md) | 用可交互的标签在多个面板间切换 | base | reviewed |

## Primitives

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [AutoSizer 自适应尺寸](./reference/auto-sizer.md) | 随内容变化平滑调整宽高的容器 | pro | reviewed |
| [BaseAnchor 锚点定位](./reference/base-anchor.md) | 锚定在触发元素旁的浮层基础组件 | pro | reviewed |
| [BaseSurface 基础表面层](./reference/base-surface.md) | 可切换材质并在运动中降级的背景层 | pro | reviewed |
| [Floating 浮动层](./reference/floating.md) | 随指针产生视差位移的容器 | pro | reviewed |
| [ResizeBox 显式尺寸动画](./reference/resize-box.md) | 在显式宽高目标之间过渡的容器 | pro | reviewed |

## ProSuite

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [进阶套件](./reference/pro-suite.md) | 高级交互、视觉效果与底层原语 | 见文档 | reviewed |

## Status

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [BlankSlate 空白页](./reference/blank-slate.md) | 引导首次使用者开始操作的大号空状态 | base | reviewed |
| [Empty 空状态](./reference/empty.md) | 用于面板与筛选结果的紧凑空状态卡片 | base | reviewed |
| [EmptyState 空态引导](./reference/empty-state.md) | 表示空、加载、错误等页面状态的占位视图 | base | reviewed |
| [ErrorState 错误状态](./reference/error-state.md) | 加载或操作失败时显示的状态视图 | base | reviewed |
| [GuideState 引导状态](./reference/guide-state.md) | 引导用户完成初始设置的状态视图 | base | reviewed |
| [LayoutSkeleton 布局骨架](./reference/layout-skeleton.md) | 模拟完整应用布局的骨架占位 | base | reviewed |
| [LoadingState 加载态](./reference/loading-state.md) | 整块区域加载时显示的状态视图 | base | reviewed |
| [NoData 无数据](./reference/no-data.md) | 数据源返回零条记录时的空状态 | base | reviewed |
| [NoSelection 未选择](./reference/no-selection.md) | 详情面板等待用户选择时的空状态 | base | reviewed |
| [OfflineState 离线](./reference/offline-state.md) | 网络不可用时显示的状态视图 | base | reviewed |
| [PermissionState 权限不足](./reference/permission-state.md) | 访问被拒绝时显示的状态视图 | base | reviewed |
| [SearchEmpty 搜索空态](./reference/search-empty.md) | 搜索或筛选无结果时的空状态 | base | reviewed |
| [Skeleton 骨架屏](./reference/skeleton.md) | 在内容加载前占位的骨架形状 | base | reviewed |

## TemplateAi

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [AgentChat 智能体对话](./reference/template-agent-chat.md) | 带权限闸门、实时计划与改动面板的编码智能体会话 | 见文档 | reviewed |
| [AiAnswer 问答助手](./reference/template-ai-answer.md) | 流式写出、带编号引用与追问的多轮问答 | 见文档 | reviewed |
| [Research 研究助手](./reference/template-research.md) | 带研究过程、编号引用与证据栏的研究助手 | 见文档 | reviewed |

## TemplateApp

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Launcher 启动器](./reference/template-launcher.md) | 仿 CoreBox、带实时预览的键盘优先启动器 | 见文档 | reviewed |
| [Onboarding 登录引导](./reference/template-onboarding.md) | 从登录、工作区、偏好到系统权限的五步首启引导 | 见文档 | reviewed |
| [Settings 设置中心](./reference/template-settings.md) | 分区导航、分组设置行、改动即时保存的设置中心 | 见文档 | reviewed |
| [Shell 应用外壳](./reference/template-shell.md) | 侧栏、命令面板、通知与看板组成的应用外壳 | 见文档 | reviewed |

## TemplateContent

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [CMS 内容管理](./reference/template-cms.md) | 带状态筛选、批量操作与抽屉编辑的内容后台 | 见文档 | reviewed |
| [Docs 知识库](./reference/template-docs.md) | 带目录树、本页目录与 ⌘K 检索的帮助中心阅读器 | 见文档 | reviewed |
| [Files 文件管理](./reference/template-files.md) | 带文件夹树、多选、右键菜单与拖入上传的文件管理器 | 见文档 | reviewed |
| [Gallery 画廊](./reference/template-gallery.md) | 带合集、三种布局与作品详情的作品墙 | 见文档 | reviewed |
| [Inbox 收件箱](./reference/template-inbox.md) | 带键盘快捷键与新邮件提示的三栏收件箱 | 见文档 | reviewed |
| [Store 插件商店](./reference/template-store.md) | 带精选、搜索、权限详情与安装流程的插件商店 | 见文档 | reviewed |

## TemplateData

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [Automation 自动化编排](./reference/template-automation.md) | 带流程画布、节点配置与运行日志的自动化编辑器 | 见文档 | reviewed |
| [Dashboard 数据看板](./reference/template-dashboard.md) | 带指标卡、趋势图与热门插件表的产品数据看板 | 见文档 | reviewed |
| [Release 发布控制台](./reference/template-release.md) | 从 CI 构建到灰度放量、由人审批的发布控制台 | 见文档 | reviewed |

## Visualization

| 文档 | 用途 | 运行时套件 | 上游同步状态 |
|---|---|---|---|
| [AllocationBar 占比条](./reference/allocation-bar.md) | 按份额分段的胶囊条 + 图例胶囊，选中哪段就检查哪段。 | pro | reviewed |
| [DiffTable 变更表格](./reference/diff-table.md) | 以变更集语义呈现 AI 提议的改动，按阶段依次标红、展开新增行。 | pro | reviewed |
| [SignalMeter 信号量表](./reference/signal-meter.md) | 分段强度条，用几格填充表达置信度、相关度或信号强弱。 | pro | reviewed |
| [SparkChart 迷你折线图](./reference/spark-chart.md) | 带平滑曲线、可选坐标轴、活动十字线与可访问悬停读值的 canvas 趋势图。 | pro | reviewed |
