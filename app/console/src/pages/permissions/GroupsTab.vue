<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCardItem } from "@talex-touch/tuffex/card-item";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import GroupDetail from "./GroupDetail.vue";
import { groupLabel, groupSections } from "../../lib/permissions";
import { DEPT_TONE_SWATCH, deptTone } from "../../lib/tone";
import type { PermissionGroup, PermissionNodesResponse } from "../../lib/types";

/** 组页签：左边按身份、部门、称号、自定义分段列出全部组，右边是选中的组。窄屏把列表换成下拉框。 */
const props = defineProps<{ groups: PermissionGroup[]; nodes: PermissionNodesResponse; reload: () => Promise<void> }>();
const route = useRoute();
const router = useRouter();

const sections = computed(() => groupSections(props.groups));
const firstId = computed(() => sections.value[0]?.items[0]?.id ?? null);
const selectedId = computed(() => {
  const wanted = typeof route.query.group === "string" ? route.query.group : null;
  return wanted && props.groups.some(group => group.id === wanted) ? wanted : firstId.value;
});
const selected = computed(() => props.groups.find(group => group.id === selectedId.value) ?? null);
const select = (id: string | number) => void router.replace({ query: { ...route.query, group: String(id) } });
const label = (group: PermissionGroup) => groupLabel(group, props.groups);

/** 部门和部门里的称号用部门色，其余用「无部门」的色。 */
function dotColor(group: PermissionGroup): string {
  const department = group.kind === "department" ? group : props.groups.find(item => item.id === group.department_id);
  return DEPT_TONE_SWATCH[deptTone(department?.kind === "department" ? department.tone : null)];
}
const selectGroups = computed(() => sections.value.map(section => ({
  label: section.label,
  options: section.items.map(group => ({ value: group.id, label: label(group) })),
})));
</script>

<template>
  <div class="groups">
    <nav class="group-list" aria-label="全部组">
      <section v-for="section in sections" :key="section.kind" class="group-list__section">
        <p class="group-list__heading">{{ section.label }}</p>
        <TxCardItem
          v-for="group in section.items"
          :key="group.id"
          clickable
          role="button"
          :active="group.id === selectedId"
          :aria-current="group.id === selectedId ? 'true' : undefined"
          :title="label(group)"
          :subtitle="`${group.member_count} 人 · 权重 ${group.weight}`"
          class="group-item"
          @click="select(group.id)"
          @keydown.enter.prevent="select(group.id)"
          @keydown.space.prevent="select(group.id)"
        >
          <template #avatar><span class="dot" :style="{ background: dotColor(group) }" aria-hidden="true" /></template>
        </TxCardItem>
      </section>
    </nav>

    <div class="group-picker">
      <!-- TxSelect 0.6.0 的 attrs 落在外层，用 label 给里面的输入框命名。 -->
      <label class="fill-width">
        <span class="sr-only">选择组</span>
        <TxSelect :model-value="selectedId ?? ''" :options="selectGroups" searchable search-placeholder="搜索组" empty-text="没有这个组" class="fill-width" @update:model-value="select" />
      </label>
    </div>

    <section class="group-panel" :aria-label="selected ? label(selected) : '组详情'">
      <GroupDetail v-if="selected" :key="selected.id" :group="selected" :groups="groups" :nodes="nodes" :reload="reload" />
      <TxEmptyState v-else variant="no-data" title="还没有组" description="服务端初始化后会有身份、部门和称号这些系统组。" size="small" />
    </section>
  </div>
</template>

<style scoped>
.groups {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-height: 560px;
}
.group-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  max-height: min(860px, 82dvh);
  padding: 20px 14px;
  overflow-y: auto;
  border-right: 1px solid var(--tx-border-color-lighter);
  background: var(--tx-fill-color-light);
}
.group-list__section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.group-list__heading {
  margin: 0 12px 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-text-color-secondary);
}
.group-item {
  --tx-card-item-padding: 10px 12px;
  flex: 0 0 auto;
  min-width: 0;
  min-height: 44px;
  border-radius: 10px;
}
.group-item[aria-current="true"] {
  background: color-mix(in srgb, var(--tx-color-primary) 9%, white);
}
.dot {
  display: block;
  width: 10px;
  height: 10px;
  margin: 0 2px;
  border-radius: 50%;
}
.group-picker {
  display: none;
  padding: 16px;
  border-bottom: 1px solid var(--tx-border-color-lighter);
}
.group-panel {
  min-width: 0;
  padding: 20px 24px 28px;
}
@media (max-width: 900px) {
  .groups {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
  }
  .group-list {
    display: none;
  }
  .group-picker {
    display: block;
  }
  .group-panel {
    padding: 16px;
  }
}
</style>
