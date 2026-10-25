<script setup lang="ts">
import { reactive, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import DateField from "../components/DateField.vue";
import PageHeader from "../components/PageHeader.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import ErrorAlert from "../components/ErrorAlert.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import { api, jsonBody } from "../lib/http";
import { fmtDate, fmtDay } from "../lib/format";
import { useAction, useResource } from "../lib/resource";
import {
  INVITE_STATE_TEXT, emptyInviteForm, inviteErrors, inviteFormFrom, invitePayload, inviteState, randomInviteCode, usesText,
  type InviteForm, type InviteState,
} from "../lib/invites";
import type { InviteCode, InviteList } from "../lib/types";

/**
 * 注册邀请码（#262、CONTRACT-274 §2）：注册时选填，填了有效的就成为极客班成员，不填是注册用户，之后还能兑换。
 * 邀请码不删，不用了就停用；账号上记着用的是哪一个。
 */
const list = useResource(() => api<InviteList>("/api/console/invites"), []);

const STATE_TONE: Record<InviteState, "success" | "warning" | "muted"> = { usable: "success", disabled: "muted", expired: "warning", used_up: "warning" };

const columns = [
  { key: "code", title: "邀请码", minWidth: 200 },
  { key: "uses", title: "已用", width: 132 },
  { key: "expires", title: "过期（北京时间）", width: 150 },
  { key: "state", title: "状态", width: 120 },
  { key: "actions", title: "操作", width: 180, align: "right" as const },
];

const editing = ref(false);
const original = ref<InviteCode>();
const form = reactive<InviteForm>(emptyInviteForm());
const errors = ref<Partial<Record<string, string>>>({});

function openCreate() {
  Object.assign(form, emptyInviteForm());
  original.value = undefined;
  errors.value = {};
  save.reset();
  editing.value = true;
}
function openEdit(row: InviteCode) {
  Object.assign(form, inviteFormFrom(row));
  original.value = row;
  errors.value = {};
  save.reset();
  editing.value = true;
}
const save = useAction(async () => {
  const found = inviteErrors(form, !original.value);
  errors.value = found;
  if (Object.keys(found).length) return;
  const payload = invitePayload(form, original.value);
  if (original.value && !Object.keys(payload).length) { editing.value = false; return; }
  if (original.value) await api(`/api/console/invites/${original.value.id}`, { method: "PATCH", ...jsonBody(payload) });
  else await api("/api/console/invites", { method: "POST", ...jsonBody(payload) });
  toast({ title: original.value ? "已保存" : "已新建邀请码", variant: "success" });
  editing.value = false;
  await list.reload();
});
const toggle = useAction(async (row: InviteCode) => {
  await api(`/api/console/invites/${row.id}`, { method: "PATCH", ...jsonBody({ disabled: !row.disabled }) });
  toast({ title: row.disabled ? "已重新启用" : "已停用，这个邀请码不能再注册", variant: "success" });
  await list.reload();
});
async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    toast({ title: "已复制", variant: "success" });
  } catch {
    toast({ title: "没能复制，请手动选中", variant: "warning" });
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="注册邀请码" description="注册时填了有效的邀请码就是极客班成员；不填也能注册，是注册用户，以后再兑换邀请码。邀请码不能删，不用了就停用。">
      <template #actions>
        <TxButton class="invite-create" variant="primary" icon="i-carbon-add" @click="openCreate">新建邀请码</TxButton>
      </template>
    </PageHeader>
    <ErrorAlert v-if="toggle.error.value" :error="toggle.error.value" @close="toggle.reset()" />

    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="5" />
    <TxCard v-else :padding="0">
      <TxDataTable class="table-wide" style="--table-min: 760px" :columns="columns" :data="list.data.value.invites" row-key="id" table-layout="fixed" scroll-x>
        <template #cell-code="{ row }: { row: InviteCode }">
          <span class="cell-stack">
            <span class="cell-title">
              <b class="mono">{{ row.code }}</b>
              <TxButton size="sm" variant="ghost" icon="i-carbon-copy" :aria-label="`复制 ${row.code}`" @click="copy(row.code)" />
            </span>
            <span class="cell-sub ellipsis">{{ row.note || "没有备注" }} · {{ row.created_by }} 建于 {{ fmtDate(row.created_at) }}</span>
          </span>
        </template>
        <template #cell-uses="{ row }: { row: InviteCode }">{{ usesText(row) }}</template>
        <template #cell-expires="{ row }: { row: InviteCode }">{{ row.expires_at === null ? "不过期" : fmtDay(row.expires_at) }}</template>
        <template #cell-state="{ row }: { row: InviteCode }">
          <TxStatusBadge :text="INVITE_STATE_TEXT[inviteState(row)]" :status="STATE_TONE[inviteState(row)]" size="sm" />
        </template>
        <template #cell-actions="{ row }: { row: InviteCode }">
          <span class="row-actions">
            <TxButton size="sm" variant="ghost" @click="openEdit(row)">编辑</TxButton>
            <TxButton size="sm" variant="ghost" :class="{ 'danger-text': !row.disabled }" :disabled="toggle.pending.value" @click="toggle.execute(row)">{{ row.disabled ? "启用" : "停用" }}</TxButton>
          </span>
        </template>
        <template #empty><TxEmptyState title="还没有邀请码" description="用右上角的「新建邀请码」建第一个，发给要注册的人。" size="small" /></template>
      </TxDataTable>
      <!-- 窄屏一个邀请码一张卡；宽屏只显示上面的表格。 -->
      <ul class="row-cards">
        <li v-for="row in list.data.value.invites" :key="row.id">
          <div class="row-card__head">
            <span class="cell-title">
              <b class="mono">{{ row.code }}</b>
              <TxButton size="sm" variant="ghost" icon="i-carbon-copy" :aria-label="`复制 ${row.code}`" @click="copy(row.code)" />
            </span>
            <TxStatusBadge :text="INVITE_STATE_TEXT[inviteState(row)]" :status="STATE_TONE[inviteState(row)]" size="sm" />
          </div>
          <div class="row-card__lines">
            <span class="row-card__line">
              <span>已用 {{ usesText(row) }}</span>
              <span>过期 {{ row.expires_at === null ? "不过期" : fmtDay(row.expires_at) }}</span>
            </span>
            <span class="cell-sub">{{ row.note || "没有备注" }} · {{ row.created_by }} 建于 {{ fmtDate(row.created_at) }}</span>
          </div>
          <div class="row-card__actions">
            <TxButton size="sm" variant="ghost" @click="openEdit(row)">编辑</TxButton>
            <TxButton size="sm" variant="ghost" :class="{ 'danger-text': !row.disabled }" :disabled="toggle.pending.value" @click="toggle.execute(row)">{{ row.disabled ? "启用" : "停用" }}</TxButton>
          </div>
        </li>
        <li v-if="!list.data.value.invites.length"><TxEmptyState title="还没有邀请码" description="用右上角的「新建邀请码」建第一个，发给要注册的人。" size="small" /></li>
      </ul>
    </TxCard>

    <TxModal v-model="editing" :title="original ? '编辑邀请码' : '新建邀请码'" width="min(92vw, 520px)">
      <TxForm :model="form" label-position="top">
        <div class="form-grid invite-form">
          <TxFormItem label="邀请码" class="wide">
            <div v-if="!original" class="invite-code-row">
              <TxInput v-model="form.code" class="fill-width mono" spellcheck="false" autocomplete="off" />
              <TxButton variant="secondary" icon="i-carbon-renew" @click="form.code = randomInviteCode()">换一个</TxButton>
            </div>
            <span v-else class="mono">{{ form.code }}</span>
            <span v-if="errors.code" class="field-error">{{ errors.code }}</span>
            <span v-else-if="!original" class="field-hint">不分大小写；建好后不能改，要换就新建一个。</span>
          </TxFormItem>
          <TxFormItem label="备注（选填）" class="wide">
            <TxInput v-model="form.note" class="fill-width" placeholder="例如：2026 秋季招新群" />
            <span v-if="errors.note" class="field-error">{{ errors.note }}</span>
          </TxFormItem>
          <TxFormItem label="最多用几次（留空不限）" class="wide">
            <TxInput v-model="form.maxUses" class="fill-width" inputmode="numeric" placeholder="不限" />
            <span v-if="errors.maxUses" class="field-error">{{ errors.maxUses }}</span>
          </TxFormItem>
          <TxFormItem label="过期日期（留空不过期，当天整天都能用）" class="wide">
            <DateField v-model="form.expiresDate" clearable />
            <span v-if="errors.expiresDate" class="field-error">{{ errors.expiresDate }}</span>
          </TxFormItem>
        </div>
        <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
      </TxForm>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="editing = false">取消</TxButton>
          <TxButton variant="primary" :loading="save.pending.value" @click="save.execute()">{{ original ? "保存" : "新建" }}</TxButton>
        </div>
      </template>
    </TxModal>
  </div>
</template>

<style scoped>
.cell-title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.row-actions {
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}
.danger-text {
  color: var(--tx-color-danger);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.invite-code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  width: 100%;
}
.field-error,
.field-hint {
  font-size: 0.75rem;
  line-height: 1.125rem;
}
.field-error {
  color: var(--tx-color-danger);
}
.field-hint {
  color: var(--tx-text-color-secondary);
}
.invite-create,
.row-actions :deep(button),
.dialog-actions :deep(button),
.invite-code-row :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
.invite-form :deep(.tx-input) {
  min-height: 46px;
}
.invite-form :deep(.tx-input__inner) {
  min-height: 44px;
}
:global([role="dialog"]:has(.invite-form) .tx-modal__close) {
  width: 44px;
  height: 44px;
}
</style>
