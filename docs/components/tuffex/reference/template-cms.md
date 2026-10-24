# CMS 内容管理

> 带状态筛选、批量操作与抽屉编辑的内容后台

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-cms) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-cms.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-cms.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 内容工作台
官方示例：`TemplateCmsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

// TxDataTable 只排序、只全选它拿到的那一页：
// 宿主先对过滤后的全部文章排序，再切出当前页。
const pageRows = computed(() => articles.value
  .filter(article => matches(article, query.value))
  .sort((a, b) => compare(a, b, query.value.sort))
  .slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

// 翻页、换筛选后清空选择：表头的全选只覆盖当前页
function commit(next: Query) {
  if (next.page !== query.value.page || next.status !== query.value.status)
    selected.value = []
  query.value = next
}
</script>

<template>
  <TemplateFrame title="CMS" :height="580">
    <TxFilterChips v-model="status" :items="statusItems" aria-label="按状态筛选" />

    <TxDataTable
      v-model:selected-keys="selected"
      :columns="columns"
      :data="pageRows"
      :sort="sort"
      :sort-on-client="false"
      row-key="id"
      selectable
      highlight-selected
      sticky-header
      table-layout="fixed"
      @update:sort="onSort"
      @row-click="({ row }) => openEditor(row)"
    >
      <template #cell-status="{ row }">
        <TxStatusBadge size="sm" :text="row.statusLabel" :status="row.tone" :icon="row.icon" />
      </template>
      <template #cell-actions="{ row }">
        <!-- 单元格里的点击会冒泡成 row-click，要在这里拦下 -->
        <span @click.stop>
          <TxDropdownMenu placement="bottom-end">…</TxDropdownMenu>
        </span>
      </template>
    </TxDataTable>

    <TxPagination v-model:current-page="page" :page-size="pageSize" :total="total" />

    <TxDrawer v-model:visible="editing" title="编辑文章" size="min(560px, 94vw)">
      <TxForm ref="form" :model="draft" :rules="rules" label-position="top">…</TxForm>
      <template #footer>
        <TxSplitButton variant="primary" menu-icon="i-carbon-chevron-down" @click="save()">
          保存
          <template #menu="{ close }">…</template>
        </TxSplitButton>
      </template>
    </TxDrawer>

    <TxToastPanel :open="toast.open" side="above" :stack="0">
      {{ toast.text }}
      <button type="button" @click="undo">撤销</button>
    </TxToastPanel>
  </TemplateFrame>
</template>
```

### 看板排期
按流转看同一批文章的四列看板，适合每周排期会看全局，不适合逐条改字段。
官方示例：`TemplateCmsBoardDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

const board = reactive({ draft: [], review: [], scheduled: [], published: [] })
let pendingMove = null

// TxSortableList 的拖拽状态是实例私有的，别的列根本不接受放下。
// 宿主在列容器上放行 dragover，drop 时只记下目标……
function onColumnDragOver(event: DragEvent, column: ColumnKey) {
  if (!drag.id || column === drag.from)
    return // 本列内的排序交给 TxSortableList
  event.preventDefault()
  drag.index = insertionIndex(event.currentTarget, event.clientY)
}
function onColumnDrop(event: DragEvent, column: ColumnKey) {
  if (drag.id && column !== drag.from)
    pendingMove = { id: drag.id, to: column, index: drag.index }
}

// ……等源列表在它自己的 dragend 里收尾，再在看板根节点上真正移动
function onBoardDragEnd() {
  if (pendingMove)
    applyMove(pendingMove)
  pendingMove = null
}
</script>

<template>
  <TemplateFrame title="看板排期" :height="580" @enter="play">
    <div class="board" @dragstart="onBoardDragStart" @dragend="onBoardDragEnd" @keydown="moveWithArrows">
      <section
        v-for="column in columns"
        :key="column"
        @dragover="onColumnDragOver($event, column)"
        @drop="onColumnDrop($event, column)"
      >
        <TxBadge :value="board[column].length" :variant="overLimit(column) ? 'warning' : 'default'" />
        <TxSortableList v-model="board[column]" :item-label="card => card.title" :labels="sortLabels">
          <template #item="{ item }">
            <div class="card" @click="openDetail(item)">
              <!-- 列表把行内任何位置的 Enter / 空格都当成「拿起」，菜单要拦下 -->
              <span @click.stop @keydown.enter.stop @keydown.space.stop>
                <TxDropdownMenu>…</TxDropdownMenu>
              </span>
            </div>
          </template>
        </TxSortableList>
      </section>
    </div>

    <TxModal v-model="detailOpen" :title="detail.title">
      <TxFlatRadio v-model="detailColumn">…</TxFlatRadio>
      <TxDatePicker v-model="publishDate" variant="field" />
    </TxModal>
  </TemplateFrame>
</template>
```

## 概述

Tuff 文档与博客的内容工作台：按状态找稿件、批量发布或归档、在抽屉里编辑，每次改动都可撤销。

- 筛选、搜索、排序与翻页各模拟约 350ms 的取数：表格先留旧数据，超过 120ms 才换成同版式的骨架行，版面不跳。
- 排序作用于过滤后的全部文章，再切出当前页；翻页或换筛选会清空选择，因为表头全选只覆盖当前页。
- 编辑、发布、归档与删除立即生效，提示停留约 5 秒可「撤销」；抽屉只在保存时校验。
- 列内点行直接打开抽屉；展开后（≥ 960px）增加三列与详情栏；窄于 640px 时只留标题列。
- 看板排期：列内拖动重排，拖到另一列即换状态，展开后拖到本周某天即排期；每次移动都可撤销。
- 看板排期：键盘上每列一个停靠点，空格拿起、↑ / ↓ 移动、← / → 换列、Esc 取消；窄于 640px 时一次只显示一列。
- 看板排期：进入视口后有协作者上线并移动一张卡片；点击或按键即停止；减少动态效果时直接显示最终状态。

## 自定义

- 接真实接口时，用请求替换模拟取数，并在下一次查询发出时取消上一次。
- 后端分页时保持关闭 `sort-on-client`，把排序、筛选与页码一起交给接口。
- 新字段优先放进抽屉与详情栏；窄容器里按优先级删列，不横向滚动。
- 需要所见即所得时可换成 TxMarkdownEditor，前提是宿主能生成它的工具栏图标类。
- 看板排期：跨列拖放由宿主处理（放行 `dragover`、`drop` 只记目标、根节点 `dragend` 时改数据）；卡片内的按钮要拦下 Enter 与空格。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 顶栏 | [TxSearchInput](./search-input.md)、[TxButton](./button.md) | 搜索与新建文章 |
| 状态筛选 | [TxFilterChips](./filter-chips.md) | 单选状态与计数 |
| 文章表格 | [TxDataTable](./data-table.md)、[TxStatusBadge](./status-badge.md)、[TxTag](./tag.md)、[TxAvatar](./avatar.md) | 多选、受控排序与吸顶表头 |
| 行菜单 | [TxDropdownMenu](./dropdown-menu.md)、[TxIconButton](./button.md) | 单行编辑、发布与删除 |
| 加载与空态 | [TxSkeleton](./skeleton.md)、[TxSearchEmpty](./search-empty.md) | 骨架行与清除筛选 |
| 底栏 | [TxPagination](./pagination.md)、[TxButton](./button.md) | 分页与批量操作 |
| 结果提示 | [TxToastPanel](./toast-panel.md) | 可撤销的结果提示 |
| 详情栏（展开后） | [TxCellLink](./cell-link.md)、[TxMarkdownView](./markdown-view.md)、[TxNoSelection](./no-selection.md) | 摘要、元数据与正文预览 |
| 编辑抽屉 | [TxDrawer](./drawer.md)、[TxForm](./form.md)、[TxInput](./input.md)、[TxSelect](./select.md)、[TxTagInput](./tag-input.md)、[TxDatePicker](./date-picker.md)、[TxFlatRadio](./flat-radio.md)、[TuffSwitch](./switch.md)、[TxTextarea](./textarea.md)、[TxSplitButton](./button.md) | 带校验的编辑表单 |
| 顶栏（看板排期） | [TxAvatarGroup / TxAvatar](./avatar.md) | 在线协作者 |
| 快捷筛选（看板排期） | [TxFilterChips](./filter-chips.md)、[TxDropdownMenu](./dropdown-menu.md) | 淡化不匹配的卡片 |
| 看板列（看板排期） | [TxSortableList](./sortable-list.md)、[TxBadge](./badge.md)、[TxTooltip](./tooltip.md) | 列内拖动与在制上限 |
| 卡片（看板排期） | [TxTag](./tag.md)、[TxAvatar](./avatar.md)、[TxDropdownMenu / TxDropdownSubmenu](./dropdown-menu.md)、[TxProgressBar](./progress-bar.md) | 栏目、作者、时间与菜单 |
| 本周排期（看板排期，展开后） | [TxIconButton](./button.md)、[TxButton](./button.md) | 拖到某天即排期 |
| 卡片详情（看板排期） | [TxModal](./modal.md)、[TxFlatRadio](./flat-radio.md)、[TxDatePicker](./date-picker.md)、[TxCheckbox](./checkbox.md)、[TxStatusBadge](./status-badge.md)、[TxInput](./input.md) | 阶段、日期、清单与评论 |

## 离线完整示例源码

- [TemplateCmsDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateCmsDemo.vue.txt)
- [TemplateCmsBoardDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateCmsBoardDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
