<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxNumberInput } from "@talex-touch/tuffex/number-input";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxButton } from "@talex-touch/tuffex/button";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorAlert from "../../components/ErrorAlert.vue";
import { api, jsonBody } from "../../lib/http";
import { GROUP_KIND_TEXT, createGroupInput, emptyGroupDraft, groupLabel, type GroupDraft } from "../../lib/permissions";
import { useAction } from "../../lib/resource";
import type { PermissionGroup } from "../../lib/types";

/** 新建自定义组：编号 custom.<小写字母、数字、下划线>，建好后不能改编号。条目和成员建好后在组详情里加。 */
const props = defineProps<{ open: boolean; groups: PermissionGroup[] }>();
const emit = defineEmits<{ "update:open": [value: boolean]; created: [id: string] }>();

const draft = reactive<GroupDraft>(emptyGroupDraft());
const problem = ref<string | null>(null);
watch(() => props.open, open => {
  if (!open) return;
  Object.assign(draft, emptyGroupDraft());
  problem.value = null;
  create.reset();
});
const parentOptions = computed(() => props.groups.map(item => ({ value: item.id, label: `${groupLabel(item, props.groups)}（${GROUP_KIND_TEXT[item.kind] ?? item.kind}）` })));

const create = useAction(async () => {
  const result = createGroupInput(draft, props.groups);
  if ("error" in result) {
    problem.value = result.error;
    return;
  }
  problem.value = null;
  await api("/api/console/permission-groups", { method: "POST", ...jsonBody(result.payload) });
  toast({ title: "已新建", description: result.payload.name, variant: "success" });
  emit("created", result.payload.id);
});
</script>

<template>
  <TxModal :model-value="open" title="新建自定义组" width="min(92vw, 560px)" @update:model-value="value => emit('update:open', value)">
    <TxForm :model="draft" label-position="top" class="create-form" @submit="create.execute()">
      <TxFormItem label="编号">
        <TxInput v-model="draft.slug" class="fill-width mono" spellcheck="false" autocomplete="off" placeholder="例如 event_staff">
          <template #prefix><span class="mono muted">custom.</span></template>
        </TxInput>
        <span class="field-hint">只用小写字母、数字和下划线，建好后不能改。</span>
      </TxFormItem>
      <TxFormItem label="名称">
        <TxInput v-model="draft.name" class="fill-width" maxlength="32" placeholder="例如 活动志愿者" />
      </TxFormItem>
      <TxFormItem label="说明（选填）">
        <TxTextarea v-model="draft.description" :rows="2" placeholder="这个组给谁用、给了哪些权限" />
      </TxFormItem>
      <TxFormItem label="权重（0–1000）">
        <TxNumberInput v-model="draft.weight" :min="0" :max="1000" :step="5" decrease-label="减少" increase-label="增加" class="fill-width" />
        <span class="field-hint">几个组都给了同一个取值节点时，权重高的组说了算。</span>
      </TxFormItem>
      <TxFormItem label="继承（选填）">
        <label class="fill-width">
          <span class="sr-only">继承的组</span>
          <TxSelect v-model="draft.parents" :options="parentOptions" multiple searchable placeholder="不继承" search-placeholder="搜索组" empty-text="没有这个组" class="fill-width" />
        </label>
      </TxFormItem>
      <p v-if="problem" class="field-error" role="alert">{{ problem }}</p>
      <ErrorAlert v-if="create.error.value" :error="create.error.value" @close="create.reset()" />
    </TxForm>
    <template #footer>
      <div class="dialog-actions">
        <TxButton variant="secondary" @click="emit('update:open', false)">取消</TxButton>
        <TxButton variant="primary" :loading="create.pending.value" @click="create.execute()">新建</TxButton>
      </div>
    </template>
  </TxModal>
</template>

<style scoped>
.create-form :deep(.tx-input) {
  min-height: 44px;
}
.field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.field-error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--tx-color-danger);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialog-actions :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
</style>
