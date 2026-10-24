<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxTabs, TxTabItem } from "@talex-touch/tuffex/tabs";
import { TxButton } from "@talex-touch/tuffex/button";
import PageHeader from "../components/PageHeader.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import GroupsTab from "./permissions/GroupsTab.vue";
import NodesTab from "./permissions/NodesTab.vue";
import ExplainTab from "./permissions/ExplainTab.vue";
import CreateGroupDialog from "./permissions/CreateGroupDialog.vue";
import { api } from "../lib/http";
import { useResource } from "../lib/resource";
import { useSession } from "../lib/session";
import { vSnapIndicator } from "../lib/tabs";
import type { PermissionGroupsResponse, PermissionNodesResponse } from "../lib/types";

/**
 * 权限（SPEC §3.3–§3.5）：组（身份、部门、称号、自定义）的条目与成员、全部节点、某个账号某个节点的求值解释。
 * 页签和选中的组写在地址栏里（`?tab=nodes`、`?group=title.ai.head`），可以直接分享。
 */
const route = useRoute();
const router = useRouter();
const { can } = useSession();
const canManage = computed(() => can("perm.manage"));

const groups = useResource(() => api<PermissionGroupsResponse>("/api/console/permission-groups"));
const nodes = useResource(() => api<PermissionNodesResponse>("/api/console/permissions/nodes"));

type Tab = "groups" | "nodes" | "explain";
const TABS: { id: Tab; label: string }[] = [{ id: "groups", label: "组" }, { id: "nodes", label: "节点" }, { id: "explain", label: "解释" }];
const tab = computed<Tab>(() => (route.query.tab === "nodes" || route.query.tab === "explain" ? route.query.tab : "groups"));
const setTab = (value: string) => void router.replace({ query: { ...route.query, tab: value === "groups" ? undefined : value } });

const creating = ref(false);
async function onCreated(id: string) {
  creating.value = false;
  await groups.reload();
  void router.replace({ query: { ...route.query, tab: undefined, group: id } });
}
const ready = computed(() => groups.data.value && nodes.data.value);
const error = computed(() => groups.error.value ?? nodes.error.value);
const retry = () => Promise.all([groups.error.value ? groups.reload() : null, nodes.error.value ? nodes.reload() : null]);
</script>

<template>
  <div class="page">
    <PageHeader title="权限" description="一个账号的权限来自它所在的组：身份、部门、称号，以及自定义组。组可以继承别的组；同一个节点既有允许又有拒绝时，按拒绝算。">
      <template v-if="canManage && tab === 'groups'" #actions>
        <TxButton class="create" variant="primary" icon="i-carbon-add" :disabled="!ready" @click="creating = true">新建自定义组</TxButton>
      </template>
    </PageHeader>

    <ErrorPanel v-if="error" :error="error" :retry="retry" />
    <LoadingBlock v-else-if="!ready" :lines="10" />
    <TxCard v-else :padding="0" class="perm-card">
      <TxTabs v-snap-indicator :model-value="tab" placement="top" indicator-variant="line" borderless :content-scrollable="false" :content-padding="0" @update:model-value="setTab">
        <TxTabItem v-for="item in TABS" :key="item.id" :name="item.id">
          <template #name>{{ item.label }}</template>
          <GroupsTab v-if="item.id === 'groups'" :groups="groups.data.value!.groups" :nodes="nodes.data.value!" :reload="groups.reload" />
          <NodesTab v-else-if="item.id === 'nodes'" :nodes="nodes.data.value!" :groups="groups.data.value!.groups" />
          <ExplainTab v-else :nodes="nodes.data.value!" :groups="groups.data.value!.groups" />
        </TxTabItem>
      </TxTabs>
    </TxCard>

    <CreateGroupDialog v-if="groups.data.value" v-model:open="creating" :groups="groups.data.value.groups" @created="onCreated" />
  </div>
</template>

<style scoped>
.create {
  min-height: 44px;
}
.perm-card :deep(.tx-tabs__nav) {
  border-bottom: 1px solid var(--tx-border-color-lighter);
  padding: 0 16px;
}
/* 整张卡不能点：TxCard 悬停时的主色描边在点完页签后看着像整张卡被选中，悬停时保持原来的边框。键盘焦点照旧落在页签上。 */
.perm-card.tx-card:hover:not(.is-disabled):not(.is-plain) {
  border-color: color-mix(in srgb, var(--tx-border-color-light) 72%, transparent);
}
</style>
