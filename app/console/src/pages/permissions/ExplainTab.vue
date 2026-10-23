<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { TxSkeleton } from "@talex-touch/tuffex/skeleton";
import AccountPicker from "../../components/AccountPicker.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import { api } from "../../lib/http";
import { fmtDay } from "../../lib/format";
import { EXPLAIN_TEXT, entryValueText, groupLabel, hitSourceText, metaValueText, nodesByDomain, scopeText } from "../../lib/permissions";
import { useResource } from "../../lib/resource";
import { useSession } from "../../lib/session";
import type { PermissionExplain, PermissionGroup, PermissionNodesResponse } from "../../lib/types";

/**
 * 解释页签：某个账号对某个具体节点是允许、拒绝还是没有设置，以及命中的每一条条目从哪个组、经过哪条继承链来。
 * 账号和节点写在地址栏（`?tab=explain&account=…&node=…`），用户详情里的链接直接带过来。
 */
const props = defineProps<{ nodes: PermissionNodesResponse; groups: PermissionGroup[] }>();
const route = useRoute();
const router = useRouter();
const { can } = useSession();

const fromQuery = (key: string) => (typeof route.query[key] === "string" ? (route.query[key] as string) : "");
const account = ref(fromQuery("account"));
const node = ref(fromQuery("node"));
watch(() => route.query, () => {
  account.value = fromQuery("account");
  node.value = fromQuery("node");
});
const asked = computed(() => ({ account: fromQuery("account"), node: fromQuery("node") }));
const ready = computed(() => Boolean(asked.value.account && asked.value.node));

// 只能问具体节点（SPEC §3.5），通配不在选项里。
const nodeOptions = computed(() => nodesByDomain(props.nodes.nodes.map(item => item.node), value => props.nodes.nodes.find(item => item.node === value)?.domain ?? "", props.nodes.domains)
  .map(domain => ({ label: domain.label, options: domain.nodes.map(value => ({ value, label: `${props.nodes.nodes.find(item => item.node === value)?.label ?? value} ${value}` })) })));
const problem = ref<string | null>(null);
function submit() {
  if (!account.value.trim()) { problem.value = "先选一个账号"; return; }
  if (!node.value) { problem.value = "再选一个节点"; return; }
  problem.value = null;
  void router.replace({ query: { ...route.query, account: account.value.trim(), node: node.value } });
}

const result = useResource(
  () => api<PermissionExplain>(`/api/console/permissions/explain?${new URLSearchParams({ account: asked.value.account, node: asked.value.node })}`),
  [asked],
  { enabled: () => ready.value },
);
const current = computed(() => (ready.value ? result.data.value : undefined));
const verdict = computed(() => (current.value ? EXPLAIN_TEXT[current.value.result] ?? EXPLAIN_TEXT.unset : null));
const nodeName = computed(() => props.nodes.nodes.find(item => item.node === current.value?.node)?.label ?? current.value?.node ?? "");
const isMeta = computed(() => Boolean(props.nodes.nodes.find(item => item.node === current.value?.node)?.meta));

const nameOf = (id: string) => {
  const group = props.groups.find(item => item.id === id);
  return group ? groupLabel(group, props.groups) : id;
};
const departmentName = (id: string) => props.groups.find(item => item.id === id && item.kind === "department")?.name ?? id;
const openGroup = (id: string) => void router.replace({ query: { tab: undefined, group: id } });
/** 命中条目的结果：value 为 null 的是 meta 取值条目。 */
const hitBadge = (value: boolean | null) =>
  value === null ? { text: "取值", status: "info" as const } : entryValueText({ value, meta_value: null });
</script>

<template>
  <div class="explain">
    <TxForm :model="{ account, node }" label-position="top" class="ask" @submit="submit">
      <div class="ask__grid">
        <TxFormItem label="账号">
          <AccountPicker v-if="can('users.view')" v-model="account" label="账号" />
          <TxInput v-else v-model="account" class="fill-width mono" placeholder="账号编号" spellcheck="false" autocomplete="off" />
        </TxFormItem>
        <TxFormItem label="节点">
          <label class="fill-width">
            <span class="sr-only">节点</span>
            <TxSelect v-model="node" :options="nodeOptions" searchable placeholder="选一个节点" search-placeholder="搜索中文名或节点" empty-text="没有匹配的节点" class="fill-width" />
          </label>
        </TxFormItem>
        <div class="ask__action">
          <TxButton variant="primary" native-type="submit" icon="i-carbon-search">解释</TxButton>
        </div>
      </div>
      <p v-if="problem" class="field-error" role="alert">{{ problem }}</p>
    </TxForm>

    <TxEmptyState v-if="!ready" variant="no-data" title="选一个账号和一个节点" description="这里会列出命中的每一条条目，以及它从哪个组、经过哪条继承链来。" size="small" />
    <ErrorPanel v-else-if="result.error.value" :error="result.error.value" :retry="result.reload" size="small" />
    <TxSkeleton v-else-if="!current || result.loading.value" :loading="true" :lines="5" />
    <section v-else class="answer" aria-live="polite">
      <div class="verdict">
        <TxStatusBadge :text="verdict!.text" :status="verdict!.status" />
        <p class="verdict__text">
          <span>{{ nodeName }}</span> <span class="mono muted">{{ current.node }}</span>
        </p>
      </div>
      <p class="hint">{{ isMeta ? "取值节点不分允许和拒绝，看下面的取值。" : verdict!.detail }}</p>
      <p v-if="current.meta_value !== undefined" class="meta">取值 {{ metaValueText(current.meta_value) }}</p>

      <ol v-if="current.hits.length" class="hits">
        <li v-for="(hit, index) in current.hits" :key="index" class="hit">
          <div class="hit__head">
            <TxStatusBadge :text="hitBadge(hit.entry.value).text" :status="hitBadge(hit.entry.value).status" size="sm" />
            <span class="mono">{{ hit.entry.node }}</span>
          </div>
          <p class="hit__source">
            来自
            <TxButton v-if="hit.group" size="sm" variant="ghost" class="group-link" @click="openGroup(hit.group.id)">{{ hitSourceText(hit, nameOf) }}</TxButton>
            <span v-else>{{ hitSourceText(hit, nameOf) }}</span>
          </p>
          <p class="hit__facts">
            <span>{{ scopeText(hit.entry.scope, departmentName) }}</span>
            <span>{{ hit.entry.expires_at ? `${fmtDay(hit.entry.expires_at)} 到期` : "一直有效" }}</span>
          </p>
        </li>
      </ol>
      <p v-else class="hint">没有任何条目命中。</p>
    </section>
  </div>
</template>

<style scoped>
.explain {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px 28px;
  min-width: 0;
}
.ask__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px 16px;
  align-items: end;
}
.ask__grid > :deep(.tx-form-item) {
  margin-top: 0;
}
.ask__action {
  padding-bottom: 18px;
}
.ask__action :deep(button),
.group-link {
  min-height: 44px;
  min-width: 44px;
}
.ask :deep(.tx-input) {
  min-height: 44px;
}
.field-error {
  margin: 0;
  font-size: 13px;
  color: var(--tx-color-danger);
}
.answer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--tx-border-color-lighter);
}
.verdict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.verdict__text {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.hint,
.meta {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.meta {
  font-size: 14px;
  color: var(--tx-text-color-primary);
}
.hits {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}
.hit {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: var(--tx-border-radius-base);
  min-width: 0;
}
.hit__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.hit__source,
.hit__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 0;
  font-size: 13px;
  color: var(--tx-text-color-secondary);
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .explain {
    padding: 16px;
  }
  .ask__grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .ask__action {
    padding-bottom: 0;
  }
}
</style>
