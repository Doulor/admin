# Gallery 画廊

> 带合集、三种布局与作品详情的作品墙

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-gallery) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-gallery.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-gallery.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 作品墙
官方示例：`TemplateGalleryDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

// TxStagger 只在挂载时读取 appear：换 key 让新的一组重播入场，
// 第一次在模板滚进视口时播放，减弱动态效果时不播放。
const entranceKey = ref(0)
const playAppear = ref(false)
function play() {
  playAppear.value = !matchMedia('(prefers-reduced-motion: reduce)').matches
  entranceKey.value += 1
}
</script>

<template>
  <TemplateFrame title="Gallery" :height="580" @enter="play">
    <TxFilterChips v-model="collection" :items="collections" role="tablist" aria-label="作品合集" />

    <section class="wall" :style="{ '--thumb-min': `${thumbMin}px` }">
      <!-- 玻璃工具条浮在滚动区上方；排序用会 teleport 的下拉，玻璃层裁不到它 -->
      <TxGlassSurface width="100%" :height="46" :border-radius="14" :background-opacity="0.62">
        <TxSegmentedSlider v-model="size" :segments="sizes" :show-labels="false" />
        <TxFlatRadio v-model="layout" size="sm">
          <TxFlatRadioItem value="grid" icon="i-carbon-grid" aria-label="网格" />
          <TxFlatRadioItem value="masonry" icon="i-carbon-column" aria-label="瀑布流" />
          <TxFlatRadioItem value="list" icon="i-carbon-list" aria-label="列表" />
        </TxFlatRadio>
        <TxDropdownMenu>…</TxDropdownMenu>
      </TxGlassSurface>

      <TxEdgeFadeMask axis="vertical">
        <TxStagger :key="entranceKey" tag="ul" :appear="playAppear">
          <li v-for="art in visible" :key="art.id">
            <button type="button" :aria-label="art.title" @click="open(art)">
              <img :src="art.url" alt="">
            </button>
            <TxIconButton
              :icon="art.liked ? 'i-carbon-favorite-filled' : 'i-carbon-favorite'"
              :pressed="art.liked"
              :label="`收藏《${art.title}》`"
              @click="toggleLike(art)"
            />
          </li>
        </TxStagger>
      </TxEdgeFadeMask>
    </section>

    <TxModal v-model="detailOpen" :title="current.title" width="min(960px, calc(100vw - 48px))">
      <TxRating v-model="current.myRating" :star-label="n => `评 ${n} 星`" />
      <TxImageGallery :items="variants" preview-title="变体预览" />
    </TxModal>
  </TemplateFrame>
</template>

<style scoped>
.wall :deep(.tx-stagger) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--thumb-min), 1fr));
}

@container template (max-width: 639px) {
  .wall :deep(.tx-stagger) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
```

## 概述

Tuff 社区的作品墙：壁纸、CoreBox 主题与插件封面在同一面墙上浏览、收藏与评分。

- 作品图全部是由代码生成的 SVG，另有三张站内 JPG，不请求外部图片。
- 首次进入视口时播放一次错峰入场，切合集、布局、排序或「只看收藏」时重播；减少动态效果时不播放，也取消悬停缩放。
- 缩略图大小经 CSS 变量 `--thumb-min` 决定网格与瀑布流的列宽；窄于 640px 固定两列。
- 详情里 ← / → 切换作品，只在详情内生效；评分与设为壁纸的结果显示在详情内部。
- 上传的图片只在本页预览；每个文件的 object URL 由模板自己持有，重置或卸载时回收。

## 自定义

- 换成真实作品时，每件只需 `url`、朝向与色板；缩略图用服务端裁好的小图，大图在详情里按需加载。
- 想要卡片「翻开」成详情的动效，可换成 TxFlipOverlay，并用 teleport 到 body 的版本（在 `content-visibility` 容器里就地渲染会错位）。
- 收藏与评分走接口时，先乐观更新计数，失败再回滚并说明原因。
- 瀑布流基于 CSS 多列，先列后行；需要严格按时间逐行排列时用网格。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 顶栏 | [TxBadge](./badge.md)、[TxAvatarGroup](./avatar.md)、[TxIconButton](./button.md)、[TxTooltip](./tooltip.md)、[TxPopover](./popover.md)、[TxImageUploader](./image-uploader.md) | 总数、收藏筛选与上传 |
| 合集 | [TxFilterChips](./filter-chips.md) | 标签页语义的合集切换 |
| 工具条 | [TxGlassSurface](./glass-surface.md)、[TxSegmentedSlider](./segmented-slider.md)、[TxFlatRadio](./flat-radio.md)、[TxDropdownMenu](./dropdown-menu.md) | 缩略图大小、布局与排序 |
| 作品墙 | [TxEdgeFadeMask](./edge-fade-mask.md)、[TxStagger](./stagger.md)、[TxRating](./rating.md)、[TxAvatar](./avatar.md)、[TxTag](./tag.md) | 渐隐、错峰入场与卡片信息 |
| 空态 | [TxEmptyState](./empty-state.md) | 还没有收藏时 |
| 结果提示 | [TxToastPanel](./toast-panel.md) | 收藏与上传的结果 |
| 作品详情 | [TxModal](./modal.md)、[TxRating](./rating.md)、[TxButton](./button.md)、[TxImageGallery](./image-gallery.md)、[TxToastPanel](./toast-panel.md) | 大图、评分、色板与变体 |
| 合集栏（展开后） | [TxAvatarGroup](./avatar.md)、[TxTag](./tag.md)、[TxImageUploader](./image-uploader.md) | 合集简介、标签与上传区 |

## 离线完整示例源码

- [TemplateGalleryDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateGalleryDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
