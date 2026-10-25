<script setup lang="ts">
import { ref } from "vue";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxRadioGroup, TxRadio } from "@talex-touch/tuffex/radio";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api, jsonBody } from "../../lib/http";
import { useAction, useResource } from "../../lib/resource";
import { VISIBILITY_OPTIONS, visibilityLabel } from "../../lib/forum";
import type { ForumCategoriesResponse, ForumCategoryRow, ForumVisibility } from "../../lib/types";

/**
 * 分类的可见范围（#276）：所有人、注册用户、极客班成员。改了马上生效；话题可以在论坛的「话题管理」里
 * 单独设得比分类更严，不能更松。分类本身来自论坛的 content/curation.json，这里不增删。
 */
const list = useResource(() => api<ForumCategoriesResponse>("/api/console/forum/categories"));

const columns = [
  { key: "name", title: "分类", minWidth: 180 },
  { key: "topics", title: "话题", width: 88, align: "right" as const },
  { key: "visibility", title: "谁能看", width: 340 },
];

const saving = ref<string | null>(null);
const change = useAction(async (row: ForumCategoryRow, value: ForumVisibility) => {
  if (value === row.visibility) return;
  saving.value = row.id;
  try {
    await api(`/api/console/forum/categories/${encodeURIComponent(row.id)}`, { method: "PATCH", ...jsonBody({ visibility: value }) });
    toast({ title: `「${row.name}」改成${visibilityLabel(value)}能看`, variant: "success" });
    await list.reload();
  } finally {
    saving.value = null;
  }
});
</script>

<template>
  <div class="tab-body">
    <p class="muted intro">没登录的人只能看「所有人」的分类。话题可以在论坛的「话题管理」里单独设得更严，不能比分类更松。</p>
    <ErrorAlert v-if="change.error.value" :error="change.error.value" @close="change.reset()" />
    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="6" />
    <TxDataTable v-else class="table-wide" style="--table-min: 620px" :columns="columns" :data="list.data.value.categories" row-key="id" table-layout="fixed" scroll-x>
      <template #cell-name="{ row }: { row: ForumCategoryRow }">
        <span class="cell-stack">
          <span>{{ row.name }}</span>
          <span class="cell-sub mono">{{ row.id }}</span>
        </span>
      </template>
      <template #cell-topics="{ row }: { row: ForumCategoryRow }">{{ row.topic_count }}</template>
      <template #cell-visibility="{ row }: { row: ForumCategoryRow }">
        <TxRadioGroup
          :model-value="row.visibility"
          type="button"
          :disabled="saving !== null"
          :aria-label="`${row.name}谁能看`"
          @update:model-value="change.execute(row, $event as ForumVisibility)"
        >
          <TxRadio v-for="option in VISIBILITY_OPTIONS" :key="option.value" :value="option.value" :label="option.label" />
        </TxRadioGroup>
      </template>
      <template #empty><TxEmptyState title="还没有分类" description="分类写在论坛的 content/curation.json 里，发版后出现在这里。" size="small" /></template>
    </TxDataTable>
    <!-- 窄屏一个分类一张卡；宽屏只显示上面的表格。 -->
    <ul v-if="list.data.value" class="row-cards category-cards">
      <li v-for="row in list.data.value.categories" :key="row.id">
        <div class="row-card__head">
          <span class="cell-stack">
            <span class="row-card__title">{{ row.name }}</span>
            <span class="cell-sub mono">{{ row.id }}</span>
          </span>
          <span class="cell-sub">{{ row.topic_count }} 个话题</span>
        </div>
        <TxRadioGroup
          class="category-cards__visibility"
          :model-value="row.visibility"
          type="button"
          :disabled="saving !== null"
          :aria-label="`${row.name}谁能看`"
          @update:model-value="change.execute(row, $event as ForumVisibility)"
        >
          <TxRadio v-for="option in VISIBILITY_OPTIONS" :key="option.value" :value="option.value" :label="option.label" />
        </TxRadioGroup>
      </li>
      <li v-if="!list.data.value.categories.length"><TxEmptyState title="还没有分类" description="分类写在论坛的 content/curation.json 里，发版后出现在这里。" size="small" /></li>
    </ul>
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.intro {
  margin: 0;
  font-size: 13px;
}
.category-cards > li {
  padding-inline: 0;
}
.category-cards__visibility {
  margin-top: 10px;
}
</style>
