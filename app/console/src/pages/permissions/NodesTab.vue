<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxSearchInput } from "@talex-touch/tuffex/search-input";
import { TxFilterChips } from "@talex-touch/tuffex/filter-chips";
import { TxTag } from "@talex-touch/tuffex/tag";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { groupLabel } from "../../lib/permissions";
import type { PermissionGroup, PermissionNodeDef, PermissionNodesResponse } from "../../lib/types";

/** 节点页签：服务端节点目录的全部节点，按业务域筛选、按中文名或节点搜索；每个节点列出直接给了它的组。 */
const props = defineProps<{ nodes: PermissionNodesResponse; groups: PermissionGroup[] }>();
const route = useRoute();
const router = useRouter();

const domain = ref("");
const q = ref("");
const chips = computed(() => [
  { value: "", label: "全部", count: props.nodes.nodes.length },
  ...props.nodes.domains.map(item => ({ value: item.id, label: item.label, count: props.nodes.nodes.filter(node => node.domain === item.id).length })),
]);
const rows = computed(() => {
  const text = q.value.trim().toLowerCase();
  return props.nodes.nodes.filter(item =>
    (!domain.value || item.domain === domain.value)
    && (!text || [item.node, item.label, item.description].some(value => value.toLowerCase().includes(text))));
});

/** 直接写了这个节点的组（不含通配和继承；要看某个人最终有没有，用「解释」）。 */
function grantedBy(node: string): PermissionGroup[] {
  return props.groups.filter(group => group.entries.some(entry => entry.node === node));
}
const openGroup = (id: string) => void router.replace({ query: { ...route.query, tab: undefined, group: id } });

const columns = [
  { key: "node", title: "节点", width: 240 },
  { key: "description", title: "说明", width: 260 },
  { key: "groups", title: "直接给了它的组", width: 260 },
];
</script>

<template>
  <div class="nodes">
    <div class="toolbar">
      <TxFilterChips v-model="domain" :items="chips" aria-label="按业务域筛选" />
      <form role="search" class="toolbar__end search" @submit.prevent>
        <TxSearchInput v-model="q" placeholder="搜索中文名或节点" @clear="q = ''" />
      </form>
    </div>
    <TxDataTable class="table-wide" style="--table-min: 760px" :columns="columns" :data="rows" row-key="node" table-layout="fixed" scroll-x>
      <template #cell-node="{ row }: { row: PermissionNodeDef }">
        <span class="cell-stack">
          <span class="ellipsis">{{ row.label }}</span>
          <span class="cell-sub mono ellipsis">{{ row.node }}</span>
          <TxTag v-if="row.meta" label="取值" variant="outline" size="sm" />
        </span>
      </template>
      <template #cell-description="{ row }: { row: PermissionNodeDef }">
        <span class="clamp-2 muted">{{ row.description || "-" }}</span>
      </template>
      <template #cell-groups="{ row }: { row: PermissionNodeDef }">
        <span v-if="grantedBy(row.node).length" class="tags">
          <TxButton v-for="group in grantedBy(row.node)" :key="group.id" size="sm" variant="ghost" class="group-link" @click="openGroup(group.id)">{{ groupLabel(group, groups) }}</TxButton>
        </span>
        <span v-else class="muted">没有组直接写它</span>
      </template>
      <template #empty>
        <TxEmptyState variant="search-empty" title="没有符合条件的节点" description="换一个业务域或关键词再试。" size="small" />
      </template>
    </TxDataTable>
    <!-- 窄屏一个节点一张卡；宽屏只显示上面的表格。 -->
    <ul class="row-cards node-cards">
      <li v-for="row in rows" :key="row.node">
        <div class="row-card__head">
          <span class="cell-stack">
            <span class="row-card__title">{{ row.label }}</span>
            <span class="cell-sub mono">{{ row.node }}</span>
          </span>
          <TxTag v-if="row.meta" label="取值" variant="outline" size="sm" />
        </div>
        <div class="row-card__lines">
          <span class="muted">{{ row.description || "-" }}</span>
          <span v-if="grantedBy(row.node).length" class="tags">
            <TxButton v-for="group in grantedBy(row.node)" :key="group.id" size="sm" variant="ghost" class="group-link" @click="openGroup(group.id)">{{ groupLabel(group, groups) }}</TxButton>
          </span>
          <span v-else class="muted">没有组直接写它</span>
        </div>
      </li>
      <li v-if="!rows.length">
        <TxEmptyState variant="search-empty" title="没有符合条件的节点" description="换一个业务域或关键词再试。" size="small" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.nodes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0 0;
  min-width: 0;
}
.toolbar {
  padding: 0 16px;
}
.search {
  width: min(280px, 100%);
}
.group-link {
  min-height: 44px;
}
@media (max-width: 900px) {
  .search {
    width: 100%;
    margin-left: 0;
  }
}
</style>
