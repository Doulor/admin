<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxRadioGroup, TxRadio } from "@talex-touch/tuffex/radio";
import { TxButton } from "@talex-touch/tuffex/button";
import { toast } from "@talex-touch/tuffex/utils";
import DateField from "../../components/DateField.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import { api, jsonBody } from "../../lib/http";
import { emptyEntryDraft, entryInput, isMetaNode, nodeSelectGroups, type EntryDraft } from "../../lib/permissions";
import { useAction } from "../../lib/resource";
import type { PermissionGroup, PermissionGroupPatch, PermissionNodesResponse } from "../../lib/types";

/** 给一个组添加一条权限条目：节点、允许或拒绝（meta 节点填取值）、范围、到期日期。 */
const props = defineProps<{ open: boolean; group: PermissionGroup; nodes: PermissionNodesResponse }>();
const emit = defineEmits<{ "update:open": [value: boolean]; done: [] }>();

const draft = reactive<EntryDraft>(emptyEntryDraft());
const problem = ref<string | null>(null);
watch(() => props.open, open => {
  if (!open) return;
  Object.assign(draft, emptyEntryDraft());
  problem.value = null;
  save.reset();
});

const options = computed(() => nodeSelectGroups(props.nodes.nodes, props.nodes.domains));
const picked = computed(() => props.nodes.nodes.find(item => item.node === draft.node) ?? null);
const meta = computed(() => Boolean(draft.node) && isMetaNode(draft.node, props.nodes.nodes));
/** 部门组和部门里的称号最常用的范围是「只限本部门」，给一个一键填好的按钮。 */
const ownDepartment = computed(() => (props.group.kind === "department" && props.group.id !== "dept.none" ? props.group.id : props.group.department_id));

const save = useAction(async () => {
  const result = entryInput(draft, props.nodes.nodes);
  if ("error" in result) {
    problem.value = result.error;
    return;
  }
  problem.value = null;
  const patch: PermissionGroupPatch = { entries: { add: [result.input], remove: [] } };
  await api(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}`, { method: "PATCH", ...jsonBody(patch) });
  toast({ title: "已添加条目", description: result.input.node, variant: "success" });
  emit("update:open", false);
  emit("done");
});
</script>

<template>
  <TxModal :model-value="open" :title="`给「${group.name}」添加条目`" width="min(92vw, 560px)" @update:model-value="value => emit('update:open', value)">
    <TxForm :model="draft" label-position="top" class="entry-form" @submit="save.execute()">
      <TxFormItem label="节点">
        <!-- TxSelect 0.6.0 的 attrs 落在外层，用 label 给里面的输入框命名。 -->
        <label class="fill-width">
          <span class="sr-only">节点</span>
          <TxSelect v-model="draft.node" :options="options" searchable placeholder="选一个节点或通配" search-placeholder="搜索中文名或节点" empty-text="没有匹配的节点" class="fill-width" panel-background="pure" />
        </label>
        <span v-if="picked?.description" class="field-hint">{{ picked.description }}</span>
        <span v-else-if="draft.node.endsWith('*')" class="field-hint">通配会匹配它下面现在和以后加入的全部节点。</span>
      </TxFormItem>
      <TxFormItem v-if="meta" label="取值">
        <TxInput v-model="draft.metaValue" class="fill-width mono" inputmode="numeric" placeholder="例如 3；不限填 -1" />
        <span class="field-hint">多个组都给了取值时，按权重最高的组算。</span>
      </TxFormItem>
      <TxFormItem v-else label="结果">
        <TxRadioGroup v-model="draft.value" type="card" direction="row" class="choices" aria-label="结果">
          <TxRadio value="allow" label="允许" />
          <TxRadio value="deny" label="拒绝" />
        </TxRadioGroup>
        <span class="field-hint">同一个节点既有允许又有拒绝时，按拒绝算。</span>
      </TxFormItem>
      <TxFormItem label="范围（选填，留空不限）">
        <TxInput v-model="draft.scope" class="fill-width mono" spellcheck="false" autocomplete="off" placeholder='例如 {"department":["dept.ai"]}' />
        <span class="scope-row">
          <TxButton v-if="ownDepartment" size="sm" variant="ghost" native-type="button" @click="draft.scope = JSON.stringify({ department: [ownDepartment] })">只限本部门</TxButton>
        </span>
      </TxFormItem>
      <TxFormItem label="到期日期（选填，留空一直有效，当天整天有效）">
        <DateField v-model="draft.expiresDate" clearable />
      </TxFormItem>
      <p v-if="problem" class="field-error" role="alert">{{ problem }}</p>
      <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
    </TxForm>
    <template #footer>
      <div class="dialog-actions">
        <TxButton variant="secondary" @click="emit('update:open', false)">取消</TxButton>
        <TxButton variant="primary" :loading="save.pending.value" @click="save.execute()">添加</TxButton>
      </div>
    </template>
  </TxModal>
</template>

<style scoped>
.choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}
.choices :deep(.tx-radio) {
  min-height: 44px;
}
.entry-form :deep(.tx-input) {
  min-height: 44px;
}
.field-hint,
.field-error {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
}
.field-hint {
  color: var(--tx-text-color-secondary);
}
.field-error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--tx-color-danger);
}
.scope-row {
  display: flex;
  margin-top: 4px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialog-actions :deep(button),
.scope-row :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
</style>
