# 组件变更历程

> TuffEx 版本历程与各组件的引入版本

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/changelog) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/changelog.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/changelog.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 版本概览

| 项目 | 值 |
|------|----|
| 源码版本 | **0.9.1** |
| 发布版本 | **0.9.1**（本轮 npm 发布） |
| 组件模块 | **185**：基础 94 · 进阶 56 · AI 35 |

## 版本更新历程

### 0.9.1 版本（2026-10-21）

修复 0.9.0 折射材质在大面板上的卡顿。

- **新增组件**：无。
- **主要更新组件**：base-surface、card、glass-surface
- **关键特性**：
  - `TxGlassSurface` 的位移图改为长边不超过 256px 的位图再拉伸。Chromium 每出一帧都要在 CPU 上栅格化位移图，原先整幅大小的位移图让大面板每帧花 100–200ms，改后不到 1ms。
  - `refraction` 默认改用 `css` 渲染器，不再画 SVG 玻璃层；要看到折射时传 `refractionRenderer="svg"`，强弱用新增的 `refractionGlassOpacity` 调（默认 `0.3`）。`TxCard` 透传这两个属性。
  - 新增 `setSurfacePerformanceMode('max')`：页面上所有重材质换成实色，`systemBackdrop` 的表面除外。
  - `TxCard` 被宿主用 `overflow: hidden` 裁切，或放在圆角裁切容器里时，SVG 玻璃层不再消失。

### 0.9.0 版本（2026-10-20）

学习曲线、手势交互与折射材质，包含此前未发布的组件改动。

- **新增组件**：无新增独立组件模块；学习曲线从 `charts` 导出。
- **主要更新组件**：alert、allocation-bar、attachment-tray、base-surface、card-spread、carousel-3d、charts、command-palette、dialog、drawer、fine-tune-card、flip-book、image-gallery、markdown-editor、modal、motion-dock、physics-motion、stream-element、stream-markdown、stream-text、thinking-orb、toast
- **关键特性**：
  - `TxLearningCurve` 支持平滑、多种子区间和可见窗口；图表补齐按住读数、缩放、平移与键盘操作，并修复学习曲线 Y 轴名称重叠。
  - 轮播、翻书、卡片堆与物理动效支持直接拖动和动量释放；Motion Dock 更新材质与放大布局。
  - Modal、Drawer、Command Palette 与对话框采用折射材质，透明窗口可使用 `systemBackdrop`。
  - Markdown 编辑器支持块编辑、按需加载的 CodeMirror、图片上传、AI 改写、评论与协作接口。
  - 附件托盘和图库共用预览器，补齐焦点恢复、加载失败与图标按钮的无障碍名称；Thinking Orb 新增渐变配色。

### 0.8.0 版本（2026-10-14）

固定品牌色流光底、语音播放条，以及语义数据表与表单尺寸修复。

- **新增组件（2 个）**：[flow-light](./flow-light.md)、[voice-clip](./voice-clip.md)
- **更新组件（13 个）**：base-anchor、base-surface、button、card、conversation-stream、data-table、dropdown-menu、input、number-input、select、tag-input、textarea、voice-beam
- **关键特性**：
  - `TxFlowLight` 支持 corners / rim / aurora，BaseSurface、Card 与菜单面板可透传固定品牌色流光；高对比度下隐藏
  - `TxVoiceClip` 支持播放、波形定位、键盘操作、本地录音解码与单条播放；`TxVoiceBeam` 新增 `organic` 独立起伏，尊重减少动态效果
  - `TxButton` 新增 `progress`、`showProgress`、`formatProgress`；`TxConversationStream` 挂载时测量恢复的对话行
  - `TxDataTable` 新增语义列 `type`、列级 `filter` / `filterOptions`、受控 `filter` / `defaultFilter`、`update:filter` / `filterChange`，默认客户端筛选；`filterOnClient=false` 将筛选交给调用方，`autoStickyActions` 默认固定操作列到右侧
  - `TxSelect` 在未指定 `searchable` 时，选项数达到 `searchThreshold`（默认 8）自动启用搜索；显式 `false` 或阈值不大于 0 可关闭
  - Input、Textarea、Select、NumberInput 与 TagInput 显式使用 `border-box`，无需宿主全局 reset，也不注入全局通配重置
  - DataTable 内部状态拆分与样式去重后，单组件 JS 为 42.9 KiB，完整 / 按需 CSS 为 749.0 / 719.6 KiB；总量基线为 750 / 720.5 KiB，单文件预算与导入禁令不变


### 0.7.0 版本（2026-10-09）

动效原语与 Motion 套件、悬停弹层的悬停桥，以及终端显示组件。

- **新增组件（16 个）**：[card-spread](./card-spread.md)、[carousel-3d](./carousel-3d.md)、[flip-book](./flip-book.md)、[morph](./morph.md)、[motion](./motion.md)、[motion-button](./motion-button.md)、[motion-control](./motion-control.md)、[motion-dock](./motion-dock.md)、[motion-form](./motion-form.md)、[motion-loader](./motion-loader.md)、[motion-metric](./motion-metric.md)、[motion-text](./motion-text.md)、[motion-toggle](./motion-toggle.md)、[motion-transition](./motion-transition.md)、[physics-motion](./physics-motion.md)、[terminal](./terminal.md)
- **更新组件（18 个）**：[ai-elements](./ai-elements.md)、[base-anchor](./base-anchor.md)、[button](./button.md)、[charts](./charts.md)、[chat](./chat.md)、[code-stream](./code-stream.md)、[flat-dropdown](./flat-dropdown.md)、[fusion-surface](./fusion-surface.md)、[icon-chip](./icon-chip.md)、[icon-morph](./icon-morph.md)、[liquid](./liquid.md)、[popover](./popover.md)、[rating](./rating.md)、[slider](./slider.md)、[steps](./steps.md)、[switch](./switch.md)、[tooltip](./tooltip.md)、[transition](./transition.md)
- **Motion 文档套件**：导航新增[动效套件](./motion-suite.md)，含可独立重置的实时标本，以及双语分类、侧栏、总览和演示注册
- **现有 charts 模块新增**：Motion 中的 [dither-chart](./dither-chart.md) 与 Data 中的 [mono-chart](./mono-chart.md)，均从 `@talex-touch/tuffex/charts` 导出
- **安装边界**：仍为 Base、Pro、AI 三套 barrel；Motion 只是文档套件，`/motion` 单组件子路径引入 `TxMotion`，不是第四套 barrel；复合表单、控件和指标归 Pro
- **来源与授权**：标签、内容、条目、模型和数据由调用方驱动；持续动效共享可见性、减少动态效果与清理处理，spring 与文字变化复用现有引擎。保留 Amicro 的 MIT 署名与源文件级 Apache-2.0 声明；保留的 46 个 Lucide 图标附 ISC 及适用的 Feather-MIT 声明，不引入 React 或 Lucide 运行时依赖
- **关键特性**：
  - 闭式弹簧（`solveSpring`、`createSpringTrack`）与 `useMorphBox`；TxMorph 一形多态容器；TxTransitionSmoothSize 改由弹簧驱动，并新增 blur 过渡
  - 悬停弹层与触发器之间渲染悬停桥，斜向移动由安全三角保护；锚点家族默认不画箭头，expand 回弹按面板高度封顶
  - TuffSwitch 滑块走 glide 材质，TxSlider 可越界回弹，TxLineSeries 沿线描出，TxIconMorph 新增播放与暂停，TxCopyButton 在复制、成功、失败之间形变
  - TxTerminal 在网页与 Electron 中共用 ANSI / Unicode 终端显示

### 0.6.3 版本（2026-10-01）

流式内容组件与菜单确认反馈；最初随客户端 beta 测试，2026-10-03 发布到 npm。

- **新增组件（3 个）**：[descriptions](./descriptions.md)、[stream-element](./stream-element.md)、[stream-text](./stream-text.md)
- **更新组件（6 个）**：[code-stream](./code-stream.md)、[context-menu](./context-menu.md)、[data-table](./data-table.md)、[dropdown-menu](./dropdown-menu.md)、[pagination](./pagination.md)、[stream-markdown](./stream-markdown.md)
- **关键特性**：文字、代码与回答共享流式节奏，支持引用与插槽；关闭型菜单项的确认反馈；记录详情的标签/值列表；数据表格骨架加载；分页每页条数选择

### 0.6.2 版本（2026-09-28）

交互视觉特效与后台数据容器增强。

- **新增组件（4 个）**：[bot-avatar](./bot-avatar.md)、[image-generation](./image-generation.md)、[metal-fx](./metal-fx.md)、[voice-beam](./voice-beam.md)
- **更新组件（4 个）**：[card](./card.md)、[empty-state](./empty-state.md)、[progress-bar](./progress-bar.md)、[status-badge](./status-badge.md)
- **关键特性**：
  - 智能体头像、图像生成揭示、液态金属与语音响应光束
  - TxProgressBar 支持多段聚合；后台卡片与空状态容器统一

### 0.6.1 版本（2026-09-28）

为复制、固定、失败等短时操作结果提供统一的无障碍提示。

- **新增组件（1 个）**：[status-hint](./status-hint.md)
- **关键特性**：
  - TxStatusHint 支持语气色带、字符级文字形变与重复触发强调
  - 支持深浅色、减少动态效果与单一无障碍 live region

### 0.6.0 版本（2026-09-12）

触感系统重构、视觉特效套件与通知栈重写。

- **新增组件（12 个）**：[agent-screen](./agent-screen.md)、[charts](./charts.md)、[choice-card](./choice-card.md)、[flowchart](./flowchart.md)、[fusion-surface](./fusion-surface.md)、[icon-morph](./icon-morph.md)、[icon-picker](./icon-picker.md)、[mode-chip](./mode-chip.md)、[prism-glow](./prism-glow.md)、[sensitive-input](./sensitive-input.md)、[text-morph](./text-morph.md)、[toast-panel](./toast-panel.md)
- **更新组件（17 个）**：[alert](./alert.md)、[badge](./badge.md)、[cascader](./cascader.md)、[date-picker](./date-picker.md)、[flat-radio](./flat-radio.md)、[group-block](./group-block.md)、[picker](./picker.md)、[progress-bar](./progress-bar.md)、[slider](./slider.md)、[sortable-list](./sortable-list.md)、[stream-markdown](./stream-markdown.md)、[tab-bar](./tab-bar.md)、[text-transformer](./text-transformer.md)、[toast](./toast.md)、[toast-panel](./toast-panel.md)、[transfer](./transfer.md)、[tree](./tree.md)
- **关键特性**：
  - TxTextMorph 字符形变过渡，移除第三方数字流依赖
  - TxToastHost 重构为可堆叠通知栈，支持拖拽滑落与倒计时暂停
  - TxSortableList 支持握柄与键盘排序，实时重排反馈
  - TxDatePicker 与 TxCascader 支持区间选择与多级浮层
  - 新增 TxPrismGlow 棱镜光效

### 0.5.0 版本（2026-09-07）

交互反馈打磨与性能优化。

- **更新组件（5 个）**：[card-item](./card-item.md)、[dropdown-menu](./dropdown-menu.md)、[filter-chips](./filter-chips.md)、[slider](./slider.md)、[stream-markdown](./stream-markdown.md)
- **关键特性**：
  - TxFilterChips 增加滑动填充与 icon-only 模式
  - 浮层面板改用 transform 定位，优化尺寸测量
  - 统一交互光标样式与 PostCSS 产物构建

### 0.4.0 版本（2026-09-01）

组件族收拢与文档站迁移。

- **更新组件（2 个）**：[button](./button.md)、[icon](./icon.md)
- **关键特性**：
  - 收拢 TxButton 与 TxIcon 组件族，移除冗余子路径
  - 移除弃用的 TuffFlatButton，改用 TxButton variant="flat"
  - 运行时 Demo 与公开文档迁移至 Nexus

### 0.3.9 版本（2026-06-12）

AI 原生套件与按需子路径样式。

- **新增组件（43 个）**：[agent-trace](./agent-trace.md)、[ai-elements](./ai-elements.md)、[allocation-bar](./allocation-bar.md)、[approval-card](./approval-card.md)、[attachment-tray](./attachment-tray.md)、[border-beam](./border-beam.md)、[cell-link](./cell-link.md)、[chain-of-thought](./chain-of-thought.md)、[code-stream](./code-stream.md)、[context-cards](./context-cards.md)、[context-indicator](./context-indicator.md)、[conversation-stream](./conversation-stream.md)、[diff-table](./diff-table.md)、[dot-indicator](./dot-indicator.md)、[filter-chips](./filter-chips.md)、[fine-tune-card](./fine-tune-card.md)、[flat-dropdown](./flat-dropdown.md)、[icon-chip](./icon-chip.md)、[inline-citation](./inline-citation.md)、[insight-cards](./insight-cards.md)、[liquid](./liquid.md)、[markdown-editor](./markdown-editor.md)、[message-actions](./message-actions.md)、[prompt-bar](./prompt-bar.md)、[reasoning-disclosure](./reasoning-disclosure.md)、[recommendation-card](./recommendation-card.md)、[resize-box](./resize-box.md)、[scrub-field](./scrub-field.md)、[search-panel](./search-panel.md)、[selection-actions](./selection-actions.md)、[sidebar-nav](./sidebar-nav.md)、[signal-meter](./signal-meter.md)、[sources](./sources.md)、[spark-chart](./spark-chart.md)、[stream-markdown](./stream-markdown.md)、[suggestion-chips](./suggestion-chips.md)、[task-rows](./task-rows.md)、[thinking-orb](./thinking-orb.md)、[tool-call-card](./tool-call-card.md)、[tool-chips](./tool-chips.md)、[tool-confirmation](./tool-confirmation.md)、[version-capsule](./version-capsule.md)、[working-indicator](./working-indicator.md)
- **更新组件（8 个）**：[base-anchor](./base-anchor.md)、[base-surface](./base-surface.md)、[code-editor](./code-editor.md)、[empty-state](./empty-state.md)、[flip-overlay](./flip-overlay.md)、[radio](./radio.md)、[scroll](./scroll.md)、[tabs](./tabs.md)
- **关键特性**：
  - 上线 AI 聊天、智能体屏幕、推理展示等 43 个组件
  - 提供 `@talex-touch/tuffex/<component>` 子路径按需导出
  - 导出 `base.css`，可独立加载全局 token

### 0.3.8 版本（2026-05-29）

抽屉与分割线增强。

- **更新组件（2 个）**：[divider](./divider.md)、[drawer](./drawer.md)
- **关键特性**：
  - TxDrawer 支持四方向滑出与全屏模态
  - TxDivider 增加渐变透明分割模式

### 0.3.7 版本（2026-05-28）

基础录入与排版组件补齐。

- **新增组件（4 个）**：[divider](./divider.md)、[kbd](./kbd.md)、[number-input](./number-input.md)、[textarea](./textarea.md)
- **更新组件（16 个）**：[avatar](./avatar.md)、[chat](./chat.md)、`flat-input`、[flat-radio](./flat-radio.md)、[flat-select](./flat-select.md)、[flip-overlay](./flip-overlay.md)、[glass-surface](./glass-surface.md)、[group-block](./group-block.md)、[icon](./icon.md)、[input](./input.md)、[scroll](./scroll.md)、[slider](./slider.md)、[stagger](./stagger.md)、[stat-card](./stat-card.md)、[tabs](./tabs.md)、[transfer](./transfer.md)
- **关键特性**：
  - 补齐 TxTextarea、TxNumberInput、TxDivider、TxKbd 等基础录入组件
  - 修复 SSR hydration 场景下的客户端结构同步

### 0.3.4 版本（2026-03-08）

TuffEx 独立包初始基线。

- **初始组件（101 个）**：首批 101 个核心导出组件，覆盖通用基础、表单、布局与导航

## 全组件引入版本索引

全部 183 个组件模块的引入版本与安装 barrel；文档套件分类见[组件中心页](./index.md)。

| 组件 | 安装 barrel | 引入版本 |
|---|---|---|
| [`agent-screen`](./agent-screen.md) | ai | 0.6.0 |
| [`agent-trace`](./agent-trace.md) | ai | 0.3.9 |
| [`agents`](./agents.md) | ai | 0.3.4 |
| [`ai-elements`](./ai-elements.md) | ai | 0.3.9 |
| [`alert`](./alert.md) | base | 0.3.4 |
| [`allocation-bar`](./allocation-bar.md) | pro | 0.3.9 |
| [`approval-card`](./approval-card.md) | ai | 0.3.9 |
| [`attachment-tray`](./attachment-tray.md) | ai | 0.3.9 |
| [`auto-sizer`](./auto-sizer.md) | pro | 0.3.4 |
| [`avatar`](./avatar.md) | base | 0.3.4 |
| [`badge`](./badge.md) | base | 0.3.4 |
| [`base-anchor`](./base-anchor.md) | pro | 0.3.4 |
| [`base-surface`](./base-surface.md) | pro | 0.3.4 |
| [`blank-slate`](./blank-slate.md) | base | 0.3.4 |
| [`border-beam`](./border-beam.md) | pro | 0.3.9 |
| [`bot-avatar`](./bot-avatar.md) | ai | 0.6.2 |
| [`breadcrumb`](./breadcrumb.md) | base | 0.3.4 |
| [`button`](./button.md) | base | 0.3.4 |
| [`card`](./card.md) | base | 0.3.4 |
| [`card-item`](./card-item.md) | base | 0.3.4 |
| [`card-spread`](./card-spread.md) | pro | 0.7.0 |
| [`carousel-3d`](./carousel-3d.md) | pro | 0.7.0 |
| [`cascader`](./cascader.md) | base | 0.3.4 |
| [`cell-link`](./cell-link.md) | base | 0.3.9 |
| [`chain-of-thought`](./chain-of-thought.md) | ai | 0.3.9 |
| [`charts`](./charts.md) | pro | 0.6.0 |
| [`chat`](./chat.md) | ai | 0.3.4 |
| [`checkbox`](./checkbox.md) | base | 0.3.4 |
| [`choice-card`](./choice-card.md) | ai | 0.6.0 |
| [`code-editor`](./code-editor.md) | pro | 0.3.4 |
| [`code-stream`](./code-stream.md) | ai | 0.3.9 |
| [`collapse`](./collapse.md) | base | 0.3.4 |
| [`command-palette`](./command-palette.md) | pro | 0.3.4 |
| [`container`](./container.md) | base | 0.3.4 |
| [`context-cards`](./context-cards.md) | ai | 0.3.9 |
| [`context-indicator`](./context-indicator.md) | ai | 0.3.9 |
| [`context-menu`](./context-menu.md) | base | 0.3.4 |
| [`conversation-stream`](./conversation-stream.md) | ai | 0.3.9 |
| [`corner-overlay`](./corner-overlay.md) | pro | 0.3.4 |
| [`data-table`](./data-table.md) | base | 0.3.4 |
| [`date-picker`](./date-picker.md) | base | 0.3.4 |
| [`descriptions`](./descriptions.md) | base | 0.6.3 |
| [`dialog`](./dialog.md) | base | 0.3.4 |
| [`diff-table`](./diff-table.md) | pro | 0.3.9 |
| [`divider`](./divider.md) | base | 0.3.7 |
| [`dot-indicator`](./dot-indicator.md) | base | 0.3.9 |
| [`drawer`](./drawer.md) | base | 0.3.4 |
| [`dropdown-menu`](./dropdown-menu.md) | base | 0.3.4 |
| [`edge-fade-mask`](./edge-fade-mask.md) | pro | 0.3.4 |
| [`empty`](./empty.md) | base | 0.3.4 |
| [`empty-state`](./empty-state.md) | base | 0.3.4 |
| [`error-state`](./error-state.md) | base | 0.3.4 |
| [`file-uploader`](./file-uploader.md) | base | 0.3.4 |
| [`filter-chips`](./filter-chips.md) | base | 0.3.9 |
| [`fine-tune-card`](./fine-tune-card.md) | ai | 0.3.9 |
| [`flat-dropdown`](./flat-dropdown.md) | base | 0.3.9 |
| [`flat-radio`](./flat-radio.md) | base | 0.3.4 |
| [`flat-select`](./flat-select.md) | base | 0.3.4 |
| [`flex`](./flex.md) | base | 0.3.4 |
| [`flip-book`](./flip-book.md) | pro | 0.7.0 |
| [`flip-overlay`](./flip-overlay.md) | pro | 0.3.4 |
| [`floating`](./floating.md) | pro | 0.3.4 |
| [`flow-light`](./flow-light.md) | pro | 0.8.0 |
| [`flowchart`](./flowchart.md) | ai | 0.6.0 |
| [`form`](./form.md) | base | 0.3.4 |
| [`fusion`](./fusion.md) | pro | 0.3.4 |
| [`fusion-surface`](./fusion-surface.md) | pro | 0.6.0 |
| [`glass-surface`](./glass-surface.md) | pro | 0.3.4 |
| [`glow-text`](./glow-text.md) | pro | 0.3.4 |
| [`gradient-border`](./gradient-border.md) | pro | 0.3.4 |
| [`gradual-blur`](./gradual-blur.md) | pro | 0.3.4 |
| [`grid`](./grid.md) | base | 0.3.4 |
| [`grid-layout`](./grid-layout.md) | base | 0.3.4 |
| [`group-block`](./group-block.md) | base | 0.3.4 |
| [`guide-state`](./guide-state.md) | base | 0.3.4 |
| [`icon`](./icon.md) | base | 0.3.4 |
| [`icon-chip`](./icon-chip.md) | base | 0.3.9 |
| [`icon-morph`](./icon-morph.md) | pro | 0.6.0 |
| [`icon-picker`](./icon-picker.md) | base | 0.6.0 |
| [`image-gallery`](./image-gallery.md) | base | 0.3.4 |
| [`image-generation`](./image-generation.md) | pro | 0.6.2 |
| [`image-uploader`](./image-uploader.md) | base | 0.3.4 |
| [`inline-citation`](./inline-citation.md) | ai | 0.3.9 |
| [`input`](./input.md) | base | 0.3.4 |
| [`insight-cards`](./insight-cards.md) | ai | 0.3.9 |
| [`kbd`](./kbd.md) | base | 0.3.7 |
| [`keyframe-stroke-text`](./keyframe-stroke-text.md) | pro | 0.3.4 |
| [`layout-skeleton`](./layout-skeleton.md) | base | 0.3.4 |
| [`liquid`](./liquid.md) | pro | 0.3.9 |
| [`loading-overlay`](./loading-overlay.md) | base | 0.3.4 |
| [`loading-state`](./loading-state.md) | base | 0.3.4 |
| [`markdown-editor`](./markdown-editor.md) | pro | 0.3.9 |
| [`markdown-view`](./markdown-view.md) | base | 0.3.4 |
| [`message-actions`](./message-actions.md) | ai | 0.3.9 |
| [`metal-fx`](./metal-fx.md) | pro | 0.6.2 |
| [`modal`](./modal.md) | base | 0.3.4 |
| [`mode-chip`](./mode-chip.md) | ai | 0.6.0 |
| [`morph`](./morph.md) | pro | 0.7.0 |
| [`motion`](./motion.md) | pro | 0.7.0 |
| [`motion-button`](./motion-button.md) | pro | 0.7.0 |
| [`motion-control`](./motion-control.md) | pro | 0.7.0 |
| [`motion-dock`](./motion-dock.md) | pro | 0.7.0 |
| [`motion-form`](./motion-form.md) | pro | 0.7.0 |
| [`motion-loader`](./motion-loader.md) | pro | 0.7.0 |
| [`motion-metric`](./motion-metric.md) | pro | 0.7.0 |
| [`motion-text`](./motion-text.md) | pro | 0.7.0 |
| [`motion-toggle`](./motion-toggle.md) | pro | 0.7.0 |
| [`motion-transition`](./motion-transition.md) | pro | 0.7.0 |
| [`nav-bar`](./nav-bar.md) | base | 0.3.4 |
| [`no-data`](./no-data.md) | base | 0.3.4 |
| [`no-selection`](./no-selection.md) | base | 0.3.4 |
| [`number-input`](./number-input.md) | base | 0.3.7 |
| [`offline-state`](./offline-state.md) | base | 0.3.4 |
| [`outline-border`](./outline-border.md) | pro | 0.3.4 |
| [`pagination`](./pagination.md) | base | 0.3.4 |
| [`permission-state`](./permission-state.md) | base | 0.3.4 |
| [`physics-motion`](./physics-motion.md) | pro | 0.7.0 |
| [`picker`](./picker.md) | base | 0.3.4 |
| [`popover`](./popover.md) | base | 0.3.4 |
| [`prism-glow`](./prism-glow.md) | pro | 0.6.0 |
| [`progress`](./progress.md) | base | 0.3.4 |
| [`progress-bar`](./progress-bar.md) | base | 0.3.4 |
| [`prompt-bar`](./prompt-bar.md) | ai | 0.3.9 |
| [`radio`](./radio.md) | base | 0.3.4 |
| [`rating`](./rating.md) | base | 0.3.4 |
| [`reasoning-disclosure`](./reasoning-disclosure.md) | ai | 0.3.9 |
| [`recommendation-card`](./recommendation-card.md) | ai | 0.3.9 |
| [`resize-box`](./resize-box.md) | pro | 0.3.9 |
| [`scroll`](./scroll.md) | base | 0.3.4 |
| [`scrub-field`](./scrub-field.md) | base | 0.3.9 |
| [`search-empty`](./search-empty.md) | base | 0.3.4 |
| [`search-input`](./search-input.md) | base | 0.3.4 |
| [`search-panel`](./search-panel.md) | pro | 0.3.9 |
| [`search-select`](./search-select.md) | base | 0.3.4 |
| [`segmented-slider`](./segmented-slider.md) | base | 0.3.4 |
| [`select`](./select.md) | base | 0.3.4 |
| [`selection-actions`](./selection-actions.md) | base | 0.3.9 |
| [`sensitive-input`](./sensitive-input.md) | base | 0.6.0 |
| [`sidebar-nav`](./sidebar-nav.md) | base | 0.3.9 |
| [`signal-meter`](./signal-meter.md) | pro | 0.3.9 |
| [`skeleton`](./skeleton.md) | base | 0.3.4 |
| [`slider`](./slider.md) | base | 0.3.4 |
| [`sortable-list`](./sortable-list.md) | base | 0.3.4 |
| [`sources`](./sources.md) | ai | 0.3.9 |
| [`spark-chart`](./spark-chart.md) | pro | 0.3.9 |
| [`spinner`](./spinner.md) | base | 0.3.4 |
| [`splitter`](./splitter.md) | base | 0.3.4 |
| [`stack`](./stack.md) | base | 0.3.4 |
| [`stagger`](./stagger.md) | pro | 0.3.4 |
| [`stat-card`](./stat-card.md) | base | 0.3.4 |
| [`status-badge`](./status-badge.md) | base | 0.3.4 |
| [`status-hint`](./status-hint.md) | base | 0.6.1 |
| [`steps`](./steps.md) | base | 0.3.4 |
| [`stream-element`](./stream-element.md) | ai | 0.6.3 |
| [`stream-markdown`](./stream-markdown.md) | ai | 0.3.9 |
| [`stream-text`](./stream-text.md) | ai | 0.6.3 |
| [`suggestion-chips`](./suggestion-chips.md) | ai | 0.3.9 |
| [`switch`](./switch.md) | base | 0.3.4 |
| [`tab-bar`](./tab-bar.md) | base | 0.3.4 |
| [`tabs`](./tabs.md) | base | 0.3.4 |
| [`tag`](./tag.md) | base | 0.3.4 |
| [`tag-input`](./tag-input.md) | base | 0.3.4 |
| [`task-rows`](./task-rows.md) | ai | 0.3.9 |
| [`terminal`](./terminal.md) | pro | 0.7.0 |
| [`text-morph`](./text-morph.md) | pro | 0.6.0 |
| [`text-transformer`](./text-transformer.md) | pro | 0.3.4 |
| [`textarea`](./textarea.md) | base | 0.3.7 |
| [`thinking-orb`](./thinking-orb.md) | ai | 0.3.9 |
| [`timeline`](./timeline.md) | base | 0.3.4 |
| [`toast`](./toast.md) | base | 0.3.4 |
| [`toast-panel`](./toast-panel.md) | base | 0.6.0 |
| [`tool-call-card`](./tool-call-card.md) | ai | 0.3.9 |
| [`tool-chips`](./tool-chips.md) | ai | 0.3.9 |
| [`tool-confirmation`](./tool-confirmation.md) | ai | 0.3.9 |
| [`tooltip`](./tooltip.md) | base | 0.3.4 |
| [`transfer`](./transfer.md) | base | 0.3.4 |
| [`transition`](./transition.md) | pro | 0.3.4 |
| [`tree`](./tree.md) | base | 0.3.4 |
| [`tree-select`](./tree-select.md) | base | 0.3.4 |
| [`tuff-logo-stroke`](./tuff-logo-stroke.md) | pro | 0.3.4 |
| [`version-capsule`](./version-capsule.md) | pro | 0.3.9 |
| [`virtual-list`](./virtual-list.md) | pro | 0.3.4 |
| [`voice-beam`](./voice-beam.md) | pro | 0.6.2 |
| [`voice-clip`](./voice-clip.md) | ai | 0.8.0 |
| [`working-indicator`](./working-indicator.md) | ai | 0.3.9 |

### Charts 模块新增

以下图表组件属于现有 `charts` 聚合模块，经 `@talex-touch/tuffex/charts` 引入，不计入模块数。

| 图表组件 | 文档套件 | 引入版本 |
| --- | --- | --- |
| [`dither-chart`](./dither-chart.md) | Motion | 0.7.0 |
| [`mono-chart`](./mono-chart.md) | Data | 0.7.0 |

## 版本门禁与规范

| 规则 | 校验 |
|------|------|
| 版本号变更时，`CHANGELOG.md` 与本页新增对应版本章节 | `audit:changelog`，在 CI 与发布流程中拦截 |
| 版本章节列明新增与更新的组件 | `audit:changelog` |
| 组件文档的 Since 与本索引一致，且不高于当前版本 | `audit:changelog` |
| 中英文页面标题结构对齐 | CI 静态对账 |

## 离线完整示例源码

此页没有引用独立 Demo；正文中的代码块保持原样。

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
