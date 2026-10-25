<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxRadio, TxRadioGroup } from "@talex-touch/tuffex/radio";
import { TxSwitch } from "@talex-touch/tuffex/switch";
import { TxCardItem } from "@talex-touch/tuffex/card-item";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import DateField from "../components/DateField.vue";
import PageHeader from "../components/PageHeader.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import ErrorAlert from "../components/ErrorAlert.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import { api, jsonBody } from "../lib/http";
import { confirm } from "../lib/confirm";
import { fmtDay } from "../lib/format";
import { useAction, useResource } from "../lib/resource";
import { useSession } from "../lib/session";
import { PARTICIPATION_TEXT, settingsErrors, settingsPayload, type SettingsErrors } from "../lib/competition-hub";
import { KIND_TEXT, STATUS_TEXT, emptyForm, formErrors, formFrom, formPayload, isOneDay, type CompetitionForm } from "../lib/competitions";
import type { CompetitionRecord, CompetitionStatus } from "../lib/types";

const router = useRouter();
const { can } = useSession();
const list = useResource(() => api<{ competitions: CompetitionRecord[] }>("/api/console/competitions"), []);

/** 状态色：报名中用成功色，进行中用主色，报不了名的与结束过的都弱化；规划中最弱化，组织者还在筹备。 */
const STATUS_TONE: Record<CompetitionStatus, "success" | "info" | "warning" | "muted"> = {
  planning: "muted", upcoming: "info", registering: "success", ongoing: "info", closed: "warning", ended: "muted",
};

const columns = [
  { key: "name", title: "比赛", minWidth: 220 },
  { key: "window", title: "时间（北京时间）", width: 200 },
  { key: "status", title: "状态", width: 108 },
  { key: "actions", title: "操作", width: 300, align: "right" as const },
];

const editing = ref(false);
const editingId = ref<string | null>(null);
const original = ref<CompetitionRecord>();
const form = reactive<CompetitionForm>(emptyForm());
const errors = ref<Partial<Record<string, string>>>({});
const kindOptions = [
  { value: "internal", label: "内部比赛" },
  { value: "external", label: "外部比赛" },
];
/** 新建内部赛时一起定参赛形式（#278 所有者 2026-10-24 22:17：队伍只有团队赛需要）；报名先不开放，到比赛页再开。 */
const entry = reactive({ participation: "individual" as "individual" | "team", teamMin: "2", teamMax: "4" });
const entryErrors = ref<SettingsErrors>({});

function openCreate() {
  Object.assign(form, emptyForm());
  Object.assign(entry, { participation: "individual", teamMin: "2", teamMax: "4" });
  entryErrors.value = {};
  editingId.value = null;
  original.value = undefined;
  errors.value = {};
  save.reset();
  editing.value = true;
}
function openEdit(row: CompetitionRecord) {
  Object.assign(form, formFrom(row));
  editingId.value = row.id;
  original.value = row;
  errors.value = {};
  save.reset();
  editing.value = true;
}
const creatingInternal = computed(() => !editingId.value && form.kind === "internal");
const save = useAction(async () => {
  const found = formErrors(form);
  errors.value = found;
  const settings = { enabled: false, participation: entry.participation, teamMin: entry.teamMin, teamMax: entry.teamMax, scoring: "none" as const };
  entryErrors.value = creatingInternal.value ? settingsErrors(settings, { hasDeadline: true }) : {};
  if (Object.keys(found).length || Object.keys(entryErrors.value).length) return;
  const payload = formPayload(form, original.value);
  if (editingId.value && !Object.keys(payload).length) { editing.value = false; return; }
  if (editingId.value) {
    await api(`/api/console/competitions/${editingId.value}`, { method: "PATCH", ...jsonBody(payload) });
    toast({ title: "已保存", variant: "success" });
  } else {
    const { competition } = await api<{ competition: CompetitionRecord }>("/api/console/competitions", { method: "POST", ...jsonBody(payload) });
    let saved = true;
    if (creatingInternal.value) {
      // 比赛和参赛形式是两张表、两个接口；参赛形式没存上时比赛已经建好，提示去比赛页再设，不让人以为整个没建成。
      saved = await api(`/api/console/competitions/${encodeURIComponent(competition.id)}/signup-settings`, { method: "PUT", ...jsonBody(settingsPayload(settings)) }).then(() => true, () => false);
    }
    toast(saved
      ? { title: "已新建比赛", description: form.kind === "internal" ? "到「报名、积分与官网」里开放报名、设奖项、上传官网。" : undefined, variant: "success" }
      : { title: "比赛已新建，参赛形式没保存上", description: "到「报名、积分与官网」的报名设置里再选一次。", variant: "warning" });
  }
  editing.value = false;
  await list.reload();
});
const toggleOffline = useAction(async (row: CompetitionRecord) => {
  await api(`/api/console/competitions/${row.id}`, { method: "PATCH", ...jsonBody({ offline: !row.offline }) });
  toast({ title: row.offline ? "已重新上线" : "已下线，官网不再显示", variant: "success" });
  await list.reload();
});
const remove = useAction(async (row: CompetitionRecord) => {
  await api(`/api/console/competitions/${row.id}`, { method: "DELETE" });
  toast({ title: "已删除比赛", variant: "success" });
  await list.reload();
});
async function askRemove(row: CompetitionRecord) {
  if (await confirm({ title: `删除「${row.name}」？`, body: "删除后不能恢复。只想让官网不再显示，用「下线」就好。", confirmText: "删除", danger: true })) await remove.execute(row);
}
</script>

<template>
  <div class="page">
    <PageHeader title="比赛" description="官网桌面「比赛」应用显示的赛事。时间按北京时间选，服务端按 UTC 存。">
      <template #actions>
        <TxButton v-if="can('competition.prize.redeem')" class="competition-create" icon="i-carbon-ticket" @click="router.push('/console/competitions/redeem')">核销兑奖码</TxButton>
        <TxButton class="competition-create" variant="primary" icon="i-carbon-add" @click="openCreate">新建比赛</TxButton>
      </template>
    </PageHeader>
    <ErrorAlert v-if="toggleOffline.error.value" :error="toggleOffline.error.value" @close="toggleOffline.reset()" />
    <ErrorAlert v-if="remove.error.value" :error="remove.error.value" @close="remove.reset()" />

    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="6" />
    <TxCard v-else :padding="0">
      <TxDataTable class="competitions-table" style="--table-min: 780px" :columns="columns" :data="list.data.value.competitions" row-key="id" table-layout="fixed" scroll-x>
        <template #cell-name="{ row }: { row: CompetitionRecord }">
          <span class="cell-stack">
            <span class="cell-title">
              <b>{{ row.name }}</b>
              <TxStatusBadge v-if="row.offline" text="已下线" status="muted" size="sm" />
            </span>
            <span class="cell-sub ellipsis">{{ KIND_TEXT[row.kind] }}<template v-if="row.url"> · {{ row.url }}</template></span>
          </span>
        </template>
        <template #cell-window="{ row }: { row: CompetitionRecord }">
          <span class="cell-stack">
            <span v-if="isOneDay(row)">{{ fmtDay(row.start_at) }}</span>
            <template v-else>
              <span>{{ fmtDay(row.start_at) }} 起</span>
              <span class="cell-sub">到 {{ fmtDay(row.end_at) }}</span>
            </template>
            <span v-if="row.signup_deadline" class="cell-sub">报名截止 {{ fmtDay(row.signup_deadline) }}</span>
          </span>
        </template>
        <template #cell-status="{ row }: { row: CompetitionRecord }">
          <TxStatusBadge :text="STATUS_TEXT[row.status]" :status="STATUS_TONE[row.status]" size="sm" />
        </template>
        <template #cell-actions="{ row }: { row: CompetitionRecord }">
          <span class="row-actions">
            <TxButton v-if="row.kind === 'internal'" size="sm" variant="ghost" @click="router.push(`/console/competitions/${row.id}`)">报名、积分与官网</TxButton>
            <TxButton size="sm" variant="ghost" @click="openEdit(row)">编辑</TxButton>
            <TxButton size="sm" variant="ghost" :disabled="toggleOffline.pending.value" @click="toggleOffline.execute(row)">{{ row.offline ? "上线" : "下线" }}</TxButton>
            <TxButton size="sm" variant="ghost" class="danger-text" :disabled="remove.pending.value" @click="askRemove(row)">删除</TxButton>
          </span>
        </template>
        <template #empty><TxEmptyState title="还没有比赛" description="用右上角的「新建比赛」添加第一场。" size="small" /></template>
      </TxDataTable>
      <div class="competition-cards">
        <ul v-if="list.data.value.competitions.length" class="competition-cards__list">
          <li v-for="row in list.data.value.competitions" :key="row.id">
            <TxCardItem class="competition-card">
              <template #title>{{ row.name }}</template>
              <template #subtitle>{{ KIND_TEXT[row.kind] }} · {{ isOneDay(row) ? fmtDay(row.start_at) : `${fmtDay(row.start_at)} 到 ${fmtDay(row.end_at)}` }}<template v-if="row.offline"> · 已下线</template></template>
              <template #right><TxStatusBadge :text="STATUS_TEXT[row.status]" :status="STATUS_TONE[row.status]" size="sm" /></template>
              <template #description>
                <span class="row-actions competition-card__actions">
                  <TxButton v-if="row.kind === 'internal'" size="sm" variant="ghost" @click="router.push(`/console/competitions/${row.id}`)">报名、积分与官网</TxButton>
                  <TxButton size="sm" variant="ghost" @click="openEdit(row)">编辑</TxButton>
                  <TxButton size="sm" variant="ghost" :disabled="toggleOffline.pending.value" @click="toggleOffline.execute(row)">{{ row.offline ? "上线" : "下线" }}</TxButton>
                  <TxButton size="sm" variant="ghost" class="danger-text" :disabled="remove.pending.value" @click="askRemove(row)">删除</TxButton>
                </span>
              </template>
            </TxCardItem>
          </li>
        </ul>
        <TxEmptyState v-else title="还没有比赛" description="用右上角的「新建比赛」添加第一场。" size="small" />
      </div>
    </TxCard>

    <TxModal v-model="editing" :title="editingId ? '编辑比赛' : '新建比赛'" width="min(92vw, 640px)">
      <TxForm :model="form" label-position="top">
        <div class="form-grid competition-form">
          <TxFormItem label="类型" class="wide">
            <TxRadioGroup v-model="form.kind" type="card" direction="row">
              <TxRadio v-for="option in kindOptions" :key="option.value" :value="option.value" :label="option.label" />
            </TxRadioGroup>
            <span class="field-hint">{{ form.kind === "internal" ? "我们自己办：报名、组队、积分、奖项和官网都在这里管，官网用 SDK 开发后上传，由我们托管。" : "校外或官方的赛事：这里只登记时间和官网链接，报名在对方网站上。" }}</span>
          </TxFormItem>
          <TxFormItem label="比赛名称" class="wide">
            <TxInput v-model="form.name" class="fill-width" :placeholder="form.kind === 'internal' ? '例如：极客班算法挑战赛' : '例如：全国大学生软件创新大赛'" />
            <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
          </TxFormItem>
          <TxFormItem label="规划中" class="wide">
            <TxSwitch v-model="form.planning" label="还在筹备" aria-label="规划中" />
            <span class="field-hint">打开后，开赛前官网和比赛窗口都显示「规划中」，不能报名和组队；到了开始日期自动不再算规划中。</span>
          </TxFormItem>
          <TxFormItem label="开始日期">
            <DateField v-model="form.startDate" />
            <span v-if="errors.startDate" class="field-error">{{ errors.startDate }}</span>
          </TxFormItem>
          <TxFormItem label="结束日期">
            <DateField v-model="form.endDate" />
            <span v-if="errors.endDate" class="field-error">{{ errors.endDate }}</span>
          </TxFormItem>
          <TxFormItem :label="form.kind === 'internal' ? '报名截止（开放报名前要填，当天整天都能报）' : '报名截止（选填，按对方公布的填）'" class="wide">
            <DateField v-model="form.deadlineDate" clearable />
            <span v-if="errors.deadlineDate" class="field-error">{{ errors.deadlineDate }}</span>
          </TxFormItem>
          <template v-if="creatingInternal">
            <TxFormItem label="参赛形式" class="wide">
              <TxRadioGroup v-model="entry.participation" type="card" direction="row">
                <TxRadio v-for="(text, value) in PARTICIPATION_TEXT" :key="value" :value="value" :label="text" />
              </TxRadioGroup>
              <span class="field-hint">{{ entry.participation === "team" ? "团队赛有队伍和组队广场。" : "个人赛没有队伍，每人单独计分。" }}有人报名后不能再改。</span>
            </TxFormItem>
            <template v-if="entry.participation === 'team'">
              <TxFormItem label="每队最低人数">
                <TxInput v-model="entry.teamMin" class="fill-width" inputmode="numeric" />
                <span v-if="entryErrors.teamMin" class="field-error">{{ entryErrors.teamMin }}</span>
              </TxFormItem>
              <TxFormItem label="每队最高人数">
                <TxInput v-model="entry.teamMax" class="fill-width" inputmode="numeric" />
                <span v-if="entryErrors.teamMax" class="field-error">{{ entryErrors.teamMax }}</span>
              </TxFormItem>
            </template>
          </template>
          <TxFormItem v-if="form.kind === 'external'" label="赛事官网（https）" class="wide">
            <TxInput v-model="form.url" class="fill-width" placeholder="https://" />
            <span v-if="errors.url" class="field-error">{{ errors.url }}</span>
          </TxFormItem>
          <TxFormItem label="说明（选填）" class="wide">
            <TxTextarea v-model="form.description" :rows="3" placeholder="一两句说清这是什么比赛、谁能参加。" />
            <span v-if="errors.description" class="field-error">{{ errors.description }}</span>
          </TxFormItem>
          <p v-if="creatingInternal" class="next-steps wide">建好后在列表里点「报名、积分与官网」：开放报名、设计分和奖项（奖项可以不设）、上传官网站点包。</p>
        </div>
        <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
      </TxForm>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="editing = false">取消</TxButton>
          <TxButton variant="primary" :loading="save.pending.value" @click="save.execute()">{{ editingId ? "保存" : "新建" }}</TxButton>
        </div>
      </template>
    </TxModal>
  </div>
</template>

<style scoped>
.cell-title {
  display: flex;
  align-items: center;
  gap: 8px;
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
.field-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--tx-text-color-secondary);
}
.next-steps {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-light, rgb(0 0 0 / 3%));
  font-size: 0.8125rem;
  line-height: 1.6;
}
.competition-cards {
  display: none;
}
.competition-cards__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.competition-cards__list li + li {
  border-top: 1px solid var(--tx-border-color-lighter);
}
.competition-card {
  --tx-card-item-padding: 14px 16px;
  --tx-card-item-radius: 0;
}
.competition-card :deep(.tx-card-item__title) {
  font-size: 15px;
  font-weight: 500;
}
.competition-card__actions {
  flex-wrap: wrap;
  margin: 8px 0 0 -8px;
}
.competition-form :deep(.tx-radio-group) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 640px) {
  .competitions-table {
    display: none;
  }
  .competition-cards {
    display: block;
  }
  .competition-form {
    grid-template-columns: minmax(0, 1fr);
  }
}
.field-error {
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--tx-color-danger);
}
.competition-create,
.row-actions :deep(button),
.dialog-actions :deep(button),
.competition-form :deep(.tx-radio) {
  min-height: 44px;
  min-width: 44px;
}
.competition-form :deep(.tx-input),
.competition-form :deep(.tx-date-picker-field) {
  min-height: 46px;
}
.competition-form :deep(.tx-input__inner) {
  min-height: 44px;
}
/* TxModal 会 Teleport；以本页表单为条件限定关闭按钮，不改其它弹窗。 */
:global([role="dialog"]:has(.competition-form) .tx-modal__close) {
  width: 44px;
  height: 44px;
}
</style>
