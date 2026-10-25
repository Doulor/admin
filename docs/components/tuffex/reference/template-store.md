# Store 插件商店

> 带精选、搜索、权限详情与安装流程的插件商店

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-store) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-store.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-store.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 插件商店
官方示例：`TemplateStoreDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import TemplateFrame from './TemplateFrame.vue'
import TemplateStoreAction from './TemplateStoreAction.vue'
import TemplateStorePermissions from './TemplateStorePermissions.vue'

// 按插件 id 索引的一张状态表：卡片、轮播、详情和已安装列表读同一份，
// 下载进度在各处同步显示
const installs = reactive<Record<string, InstallState>>(seedInstalls())
const confirm = reactive({ open: false, id: '' })

// 安装先弹权限确认，没有任何计时器会替读者点「允许」
function onAction(plugin: Plugin) {
  if (!installs[plugin.id].version)
    Object.assign(confirm, { open: true, id: plugin.id })
}

function grant(choice: 'always' | 'session') {
  confirm.open = false
  runFlow(confirm.id, choice) // 排队中 → 下载中 → 校验中 → 安装中 → 已安装
}
</script>

<template>
  <TemplateFrame title="插件商店" :height="580" @enter="play">
    <TxFilterChips v-model="view" :items="views" role="tablist" aria-label="商店视图" />
    <TxSearchSelect remote :options="suggestions" placeholder="搜索插件、功能或触发词…" @search="filter" @select="openDetail" />

    <!-- 手写轮播：暂停按钮常驻，非当前页 inert，叠放的页只做透明度过渡 -->
    <section role="region" aria-roledescription="carousel" aria-label="编辑精选">…</section>

    <ul class="grid">
      <li v-for="plugin in visible" :key="plugin.id">
        <TxCard size="small" :radius="14">
          <!-- 标题按钮的 ::after 铺满整张卡片，操作按钮压在它上面 -->
          <button class="open" @click="openDetail(plugin.id)">{{ plugin.name }}</button>
          <TemplateStoreAction :view="actionOf(plugin)" compact @press="onAction(plugin)" />
        </TxCard>
      </li>
    </ul>

    <!-- 详情是模板内视图（展开后是右侧栏），不用 TxDrawer -->
    <section class="detail">
      <TxTabs v-model="tab" placement="top" borderless :content-scrollable="false" indicator-variant="pill">
        <TxTabItem name="overview"><TxImageGallery :items="shots" preview-title="截图预览" /></TxTabItem>
        <TxTabItem name="permissions"><TemplateStorePermissions :rows="permissionRows" /></TxTabItem>
        <TxTabItem name="versions"><TxTimeline>…</TxTimeline></TxTabItem>
        <TxTabItem name="reviews"><TxRating v-model="draft.stars" :star-label="n => `评 ${n} 星`" /></TxTabItem>
      </TxTabs>
    </section>

    <TxModal v-model="confirm.open" title="插件权限确认">
      <TemplateStorePermissions :rows="requiredRows" compact />
      <template #footer>
        <TxButton variant="ghost" @click="reject">拒绝安装</TxButton>
        <TxButton variant="secondary" @click="grant('session')">仅本次会话</TxButton>
        <TxButton variant="primary" @click="grant('always')">始终允许</TxButton>
      </template>
    </TxModal>
  </TemplateFrame>
</template>
```

## 概述

Tuff 客户端的插件商店：清单与权限取自仓库，评分、安装量与评论为示例数据，没有任何付费入口。

- 安装、更新、授权与卸载只由你的点击开始；自动演示只把轮播转一圈并报告可更新；减少动态效果时轮播不动。
- 轮播背景在亮暗两种文档页里都是深色，整个轮播按暗色主题渲染。
- 点「安装」即弹权限确认（客户端是先下载校验再确认）：「始终允许」「仅本次会话」「拒绝安装」；社区插件另有非官方来源提示。
- 下载中可以取消；「单位换算」首次下载超时，「重试」不再重复询问权限。
- 详情在栏内替换列表，「返回」或 Esc 回到原滚动位置；展开后详情为右侧栏。不用 TxDrawer，以免焦点被拽回、一次 Esc 关掉两层。
- 轮播的非当前页 `inert`，自动播放时不播报；焦点在轮播里时 ← / → 切换。
- 风险等级的颜色与图标都附带文字；只读星级对读屏隐藏，改读一句文字。

## 自定义

- 接入真实商店时，插件、渠道、权限与理由直接读清单与商店 API；分组换成商店返回的 `category`。
- 安装状态表按插件 id 索引：把计时器换成客户端上报的阶段，各处操作位自动跟随。
- 评分与评论走审核：提交后先显示「待审核」，通过后再计入均分。
- 需要带图标的搜索建议时，用 TxSearchInput 加手写列表替换 TxSearchSelect，并自己实现组合框的键盘与读屏语义。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 顶栏 | [TxFilterChips](./filter-chips.md)、[TxSearchSelect](./search-select.md) | 视图切换与搜索建议 |
| 分类与排序 | [TxFilterChips](./filter-chips.md)、[TxFlatRadio](./flat-radio.md)、[TxSidebarNav](./sidebar-nav.md) | 分类计数与排序 |
| 精选轮播 | 手写区域、[TxButton](./button.md) | 手写轮播，控制常驻 |
| 插件卡片 | [TxCard](./card.md)、[TxIconChip](./icon-chip.md)、[TxRating](./rating.md)、[TxTag](./tag.md) | 图标、简介、评分与渠道 |
| 操作位 | [TxButton](./button.md)、[TxProgressBar](./progress-bar.md) | 共用一套状态的安装按钮 |
| 可更新提示 | [TxStatusBadge](./status-badge.md) | 检查更新后的提示 |
| 详情头部 | [TxCornerOverlay](./corner-overlay.md)、[TxTooltip](./tooltip.md)、[TxDropdownMenu](./dropdown-menu.md) | 认证角标与「⋯」菜单 |
| 详情分页 | [TxTabs](./tabs.md)、[TxImageGallery](./image-gallery.md)、[TxKbd](./kbd.md)、[TxStatusBadge](./status-badge.md)、[TxTimeline](./timeline.md) | 概览、权限、版本与评论 |
| 评论 | [TxRating](./rating.md)、[TxProgressBar](./progress-bar.md)、[TxAvatar](./avatar.md)、[TxTextarea](./textarea.md) | 均分、分布与写评论 |
| 已安装 | [TxCardItem](./card-item.md)、[TxSwitch](./switch.md)、[TxEmptyState](./empty-state.md) | 已安装列表与启用开关 |
| 确认 | [TxModal](./modal.md) | 权限、更新与卸载确认 |
| 空结果与提示 | [TxSearchEmpty](./search-empty.md)、[TxToastPanel](./toast-panel.md) | 清除搜索与结果提示 |

## 离线完整示例源码

- [TemplateStoreDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateStoreDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
