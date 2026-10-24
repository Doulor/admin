<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxNumberInput } from "@talex-touch/tuffex/number-input";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxTag } from "@talex-touch/tuffex/tag";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { TxSkeleton } from "@talex-touch/tuffex/skeleton";
import { toast } from "@talex-touch/tuffex/utils";
import AccountPicker from "../../components/AccountPicker.vue";
import UserCell from "../../components/UserCell.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import EntryDialog from "./EntryDialog.vue";
import { api, jsonBody } from "../../lib/http";
import { confirm } from "../../lib/confirm";
import { dateEdge } from "../../lib/competitions";
import { fmtDate, fmtDay } from "../../lib/format";
import {
  GROUP_KIND_TEXT, entryNodeLabel, entryValueText, groupForm, groupLabel, groupPatch, isExpired, scopeText, type GroupForm,
} from "../../lib/permissions";
import { useAction, useResource } from "../../lib/resource";
import { useSession } from "../../lib/session";
import type { PermissionEntry, PermissionGroup, PermissionGroupMember, PermissionGroupMembersResponse, PermissionNodesResponse } from "../../lib/types";

/** 一个组：基本信息（名称、说明、权重、继承）、条目、成员。系统组不能删，名称和说明可以改。 */
const props = defineProps<{ group: PermissionGroup; groups: PermissionGroup[]; nodes: PermissionNodesResponse; reload: () => Promise<void> }>();
const route = useRoute();
const router = useRouter();
const { can, me } = useSession();
const canManage = computed(() => can("perm.manage"));

const labelOf = (id: string) => {
  const group = props.groups.find(item => item.id === id);
  return group ? groupLabel(group, props.groups) : id;
};
const nodeText = (node: string) => entryNodeLabel(node, value => props.nodes.nodes.find(item => item.node === value)?.label ?? value);
const departmentName = (id: string) => props.groups.find(item => item.id === id && item.kind === "department")?.name ?? id;
const open = (id: string) => void router.replace({ query: { ...route.query, group: id } });

/** 沿着继承往上走：每个祖先组只列一次，记下它有几条条目。 */
const ancestors = computed(() => {
  const seen = new Set<string>([props.group.id]);
  const result: PermissionGroup[] = [];
  const queue = [...props.group.parents];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const parent = props.groups.find(item => item.id === id);
    if (!parent) continue;
    result.push(parent);
    queue.push(...parent.parents);
  }
  return result;
});

// ---- 基本信息 ----

const editing = ref(false);
const form = reactive<GroupForm>(groupForm(props.group));
const formProblem = ref<string | null>(null);
function startEdit() {
  Object.assign(form, groupForm(props.group));
  formProblem.value = null;
  saveInfo.reset();
  editing.value = true;
}
const parentOptions = computed(() => props.groups
  .filter(item => item.id !== props.group.id)
  .map(item => ({ value: item.id, label: `${labelOf(item.id)}（${GROUP_KIND_TEXT[item.kind] ?? item.kind}）` })));
const saveInfo = useAction(async () => {
  const result = groupPatch(props.group, form);
  if ("error" in result) {
    formProblem.value = result.error;
    return;
  }
  formProblem.value = null;
  if (!result.patch) {
    editing.value = false;
    return;
  }
  await api(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}`, { method: "PATCH", ...jsonBody(result.patch) });
  toast({ title: "已保存", description: form.name.trim(), variant: "success" });
  editing.value = false;
  await props.reload();
});

const remove = useAction(async () => {
  await api(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}`, { method: "DELETE" });
  toast({ title: "已删除", description: props.group.name, variant: "success" });
  void router.replace({ query: { ...route.query, group: undefined } });
  await props.reload();
});
async function askRemove() {
  const ok = await confirm({
    title: `删除「${props.group.name}」？`,
    body: `组里的 ${props.group.member_count} 个人会失去它给的权限，继承它的组也不再继承。删除后不能恢复。`,
    confirmText: "删除", danger: true,
  });
  if (ok) await remove.execute();
}

// ---- 条目 ----

const entryColumns = [
  { key: "node", title: "节点", width: 220 },
  { key: "value", title: "结果", width: 96 },
  { key: "scope", title: "范围", width: 180 },
  { key: "expires", title: "到期", width: 110 },
  ...(canManage.value ? [{ key: "actions", title: "操作", width: 72, align: "right" as const }] : []),
];
const sortedEntries = computed(() => [...props.group.entries].sort((a, b) => a.node.localeCompare(b.node)));
const adding = ref(false);
const removeEntry = useAction(async (entry: PermissionEntry) => {
  await api(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}`, { method: "PATCH", ...jsonBody({ entries: { add: [], remove: [entry.id] } }) });
  toast({ title: "已删除条目", description: entry.node, variant: "success" });
  await props.reload();
});
async function askRemoveEntry(entry: PermissionEntry) {
  const ok = await confirm({ title: `删除「${nodeText(entry.node)}」这一条？`, body: `「${props.group.name}」和继承它的组里的人都会受影响。`, confirmText: "删除", danger: true });
  if (ok) await removeEntry.execute(entry);
}

// ---- 成员 ----

/** 访客组没有账号；没分部门的账号隐含属于无部门，不用手动加。 */
const implicit = computed(() => props.group.id === "level.visitor" || props.group.id === "dept.none");
const members = useResource(
  () => api<PermissionGroupMembersResponse>(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}/members`),
  [],
  { enabled: () => !implicit.value },
);
const memberColumns = [
  { key: "person", title: "成员", width: 220 },
  { key: "created_at", title: "加入时间", width: 140 },
  { key: "expires", title: "到期", width: 110 },
  ...(canManage.value ? [{ key: "actions", title: "操作", width: 72, align: "right" as const }] : []),
];
const memberDraft = reactive({ account: "", expiresDate: "" });
const memberProblem = ref<string | null>(null);
const addMember = useAction(async () => {
  if (!memberDraft.account) {
    memberProblem.value = "先选一个账号";
    return;
  }
  const body: { account_id: string; expires_at?: number } = { account_id: memberDraft.account };
  if (memberDraft.expiresDate) {
    const at = dateEdge(memberDraft.expiresDate, "end");
    if (at === null || at <= Date.now()) {
      memberProblem.value = "到期日期要在今天或以后";
      return;
    }
    body.expires_at = at;
  }
  memberProblem.value = null;
  await api(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}/members`, { method: "POST", ...jsonBody(body) });
  toast({ title: "已加入", description: props.group.name, variant: "success" });
  Object.assign(memberDraft, { account: "", expiresDate: "" });
  await Promise.all([members.reload(), props.reload()]);
});
const removeMember = useAction(async (member: PermissionGroupMember) => {
  await api(`/api/console/permission-groups/${encodeURIComponent(props.group.id)}/members/${encodeURIComponent(member.account_id)}`, { method: "DELETE" });
  toast({ title: "已移出", description: `${member.display_name || member.username}`, variant: "success" });
  await Promise.all([members.reload(), props.reload()]);
});
async function askRemoveMember(member: PermissionGroupMember) {
  const self = member.account_id === me.value?.account_id;
  const ok = await confirm({
    title: `把 ${member.display_name || member.username} 移出「${props.group.name}」？`,
    body: self ? "这是你自己，移出后你可能马上失去这个组给的权限。" : "这个人会失去这个组给的权限。",
    confirmText: "移出", danger: true,
  });
  if (ok) await removeMember.execute(member);
}
const MEMBER_NOTE: Partial<Record<PermissionGroup["kind"], string>> = {
  level: "每个账号只有一个身份，加进来会把这个人从原来的身份组里移走。也可以在「用户」里改。",
  department: "每个账号最多在一个部门，加进来会把这个人从原来的部门移走，原部门的称号一起去掉。",
  title: "称号组的人要先在对应的部门里。也可以在「用户」里改称号。",
};
</script>

<template>
  <div class="detail">
    <header class="head">
      <div class="head__text">
        <h2 class="head__title">{{ labelOf(group.id) }}</h2>
        <p class="head__meta">
          <TxTag :label="GROUP_KIND_TEXT[group.kind] ?? group.kind" variant="outline" size="sm" />
          <span class="mono muted">{{ group.id }}</span>
          <span v-if="group.system" class="muted">系统组</span>
        </p>
        <p v-if="group.description && !editing" class="head__desc">{{ group.description }}</p>
      </div>
      <div v-if="canManage && !editing" class="head__actions">
        <TxButton variant="secondary" icon="i-carbon-edit" @click="startEdit">编辑</TxButton>
        <TxButton v-if="!group.system" variant="danger" icon="i-carbon-trash-can" :loading="remove.pending.value" @click="askRemove">删除</TxButton>
      </div>
    </header>
    <ErrorAlert v-if="remove.error.value" :error="remove.error.value" @close="remove.reset()" />

    <TxForm v-if="editing" :model="form" label-position="top" class="info-form" @submit="saveInfo.execute()">
      <div class="form-grid">
        <TxFormItem label="名称">
          <TxInput v-model="form.name" class="fill-width" maxlength="32" />
        </TxFormItem>
        <TxFormItem label="权重（0–1000，越大越靠前，取 meta 值时优先）">
          <TxNumberInput v-model="form.weight" :min="0" :max="1000" :step="5" decrease-label="减少" increase-label="增加" class="fill-width" />
        </TxFormItem>
        <TxFormItem label="说明" class="wide">
          <TxTextarea v-model="form.description" :rows="2" placeholder="这个组给谁用、给了哪些权限" />
        </TxFormItem>
        <TxFormItem label="继承（这个组拥有所选组的全部条目）" class="wide">
          <label class="fill-width">
            <span class="sr-only">继承的组</span>
            <TxSelect v-model="form.parents" :options="parentOptions" multiple searchable placeholder="不继承" search-placeholder="搜索组" empty-text="没有这个组" class="fill-width" panel-background="pure" />
          </label>
        </TxFormItem>
      </div>
      <p v-if="formProblem" class="field-error" role="alert">{{ formProblem }}</p>
      <ErrorAlert v-if="saveInfo.error.value" :error="saveInfo.error.value" @close="saveInfo.reset()" />
      <div class="actions">
        <TxButton variant="secondary" native-type="button" @click="editing = false">取消</TxButton>
        <TxButton variant="primary" native-type="submit" :loading="saveInfo.pending.value">保存</TxButton>
      </div>
    </TxForm>
    <dl v-else class="facts">
      <dt>权重</dt><dd>{{ group.weight }}</dd>
      <dt>继承</dt>
      <dd>
        <span v-if="group.parents.length" class="tags">
          <TxButton v-for="id in group.parents" :key="id" size="sm" variant="ghost" class="link-chip" @click="open(id)">{{ labelOf(id) }}</TxButton>
        </span>
        <span v-else class="muted">不继承</span>
      </dd>
      <dt>成员</dt><dd>{{ implicit ? "-" : `${group.member_count} 人` }}</dd>
    </dl>

    <section class="block">
      <div class="card-head">
        <h3 class="section-title">条目</h3>
        <span class="count">{{ group.entries.length }} 条</span>
        <span v-if="canManage" class="card-head__actions">
          <TxButton variant="secondary" icon="i-carbon-add" @click="adding = true">添加条目</TxButton>
        </span>
      </div>
      <ErrorAlert v-if="removeEntry.error.value" :error="removeEntry.error.value" @close="removeEntry.reset()" />
      <div class="table-wrap">
        <TxDataTable style="--table-min: 640px" :columns="entryColumns" :data="sortedEntries" row-key="id" table-layout="fixed" scroll-x>
          <template #cell-node="{ row }: { row: PermissionEntry }">
            <span class="cell-stack">
              <span class="ellipsis">{{ nodeText(row.node) }}</span>
              <span class="cell-sub mono ellipsis">{{ row.node }}</span>
            </span>
          </template>
          <template #cell-value="{ row }: { row: PermissionEntry }">
            <TxStatusBadge :text="entryValueText(row).text" :status="entryValueText(row).status" size="sm" />
          </template>
          <template #cell-scope="{ row }: { row: PermissionEntry }">
            <span class="clamp-2 cell-sub" :title="JSON.stringify(row.scope)">{{ scopeText(row.scope, departmentName) }}</span>
          </template>
          <template #cell-expires="{ row }: { row: PermissionEntry }">
            <TxStatusBadge v-if="isExpired(row.expires_at)" text="已过期" status="muted" size="sm" />
            <span v-else class="muted">{{ row.expires_at ? fmtDay(row.expires_at) : "一直有效" }}</span>
          </template>
          <template #cell-actions="{ row }: { row: PermissionEntry }">
            <TxButton size="sm" variant="ghost" icon="i-carbon-trash-can" :aria-label="`删除 ${row.node} 这一条`" @click="askRemoveEntry(row)" />
          </template>
          <template #empty>
            <TxEmptyState variant="no-data" title="这个组自己没有条目" :description="ancestors.length ? '它的权限全部来自继承的组。' : '还没有给这个组任何权限。'" size="small" />
          </template>
        </TxDataTable>
      </div>
      <p v-if="ancestors.length" class="inherited">
        继承来的：
        <span v-for="(parent, index) in ancestors" :key="parent.id">
          <TxButton size="sm" variant="ghost" class="link-chip" @click="open(parent.id)">{{ labelOf(parent.id) }} {{ parent.entries.length }} 条</TxButton><span v-if="index < ancestors.length - 1" aria-hidden="true">、</span>
        </span>
      </p>
    </section>

    <section class="block">
      <div class="card-head">
        <h3 class="section-title">成员</h3>
        <span v-if="!implicit" class="count">{{ group.member_count }} 人</span>
      </div>
      <p v-if="group.id === 'level.visitor'" class="hint">没登录的人都按访客算，这个组没有账号。</p>
      <p v-else-if="group.id === 'dept.none'" class="hint">没分部门的账号都算在这里，不用手动加。要给人分部门，到「用户」里改，或者把人加进对应的部门组。</p>
      <template v-else>
        <p v-if="MEMBER_NOTE[group.kind]" class="hint">{{ MEMBER_NOTE[group.kind] }}</p>
        <form v-if="canManage" class="add-member" @submit.prevent="addMember.execute()">
          <div class="add-member__account">
            <AccountPicker v-model="memberDraft.account" label="要加入的账号" />
          </div>
          <label class="add-member__date">
            <span class="sr-only">到期日期（选填）</span>
            <TxInput v-model="memberDraft.expiresDate" type="date" class="fill-width" />
          </label>
          <TxButton variant="primary" native-type="submit" icon="i-carbon-add" :loading="addMember.pending.value">加入</TxButton>
        </form>
        <p v-if="canManage" class="hint">到期日期选填，留空一直有效。</p>
        <p v-if="memberProblem" class="field-error" role="alert">{{ memberProblem }}</p>
        <ErrorAlert v-if="addMember.error.value" :error="addMember.error.value" @close="addMember.reset()" />
        <ErrorAlert v-if="removeMember.error.value" :error="removeMember.error.value" @close="removeMember.reset()" />

        <ErrorPanel v-if="members.error.value" :error="members.error.value" :retry="members.reload" size="small" />
        <TxSkeleton v-else-if="!members.data.value" :loading="true" :lines="4" />
        <div v-else class="table-wrap">
          <TxDataTable style="--table-min: 540px" :columns="memberColumns" :data="members.data.value.members" row-key="account_id" table-layout="fixed" scroll-x :loading="members.loading.value">
            <template #cell-person="{ row }: { row: PermissionGroupMember }">
              <UserCell :login="row.username" :src="row.avatar_url" :sub="row.display_name" />
            </template>
            <template #cell-created_at="{ row }: { row: PermissionGroupMember }">
              <span class="muted">{{ fmtDate(row.created_at) }}</span>
            </template>
            <template #cell-expires="{ row }: { row: PermissionGroupMember }">
              <TxStatusBadge v-if="isExpired(row.expires_at)" text="已过期" status="muted" size="sm" />
              <span v-else class="muted">{{ row.expires_at ? fmtDay(row.expires_at) : "一直有效" }}</span>
            </template>
            <template #cell-actions="{ row }: { row: PermissionGroupMember }">
              <TxButton size="sm" variant="ghost" icon="i-carbon-subtract-alt" :aria-label="`把 ${row.username} 移出`" :loading="removeMember.pending.value" @click="askRemoveMember(row)" />
            </template>
            <template #empty>
              <TxEmptyState variant="no-data" title="这个组里还没有人" :description="canManage ? '用上面的搜索框找到账号，点「加入」。' : '有人加入后会出现在这里。'" size="small" />
            </template>
          </TxDataTable>
        </div>
      </template>
    </section>

    <EntryDialog v-if="canManage" v-model:open="adding" :group="group" :nodes="nodes" @done="reload" />
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
}
.head__text {
  flex: 1 1 280px;
  min-width: 0;
}
.head__title {
  margin: 0;
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.head__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 6px 0 0;
  font-size: 13px;
}
.head__desc {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--tx-text-color-regular);
}
.head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.head__actions :deep(button),
.actions :deep(button),
.add-member :deep(button),
.card-head__actions :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
.info-form {
  padding: 16px;
  border-radius: var(--tx-border-radius-base);
  background: var(--tx-fill-color-lighter);
}
.info-form :deep(.tx-input) {
  min-height: 44px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid var(--tx-border-color-lighter);
}
.table-wrap {
  min-width: 0;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: var(--tx-border-radius-base);
  overflow: hidden;
}
.table-wrap :deep(td button),
.link-chip {
  min-height: 44px;
  min-width: 44px;
}
.inherited {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin: 0;
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.hint {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.field-error {
  margin: 0;
  font-size: 13px;
  color: var(--tx-color-danger);
}
.add-member {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px auto;
  gap: 8px;
  align-items: center;
}
.add-member :deep(.tx-input) {
  min-height: 44px;
}
@media (max-width: 640px) {
  .add-member {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
