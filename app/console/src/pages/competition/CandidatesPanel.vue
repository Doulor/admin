<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxFilterChips } from "@talex-touch/tuffex/filter-chips";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxTag } from "@talex-touch/tuffex/tag";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import UserCell from "../../components/UserCell.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import ScoreLevels from "./ScoreLevels.vue";
import { api, jsonBody } from "../../lib/http";
import { fmtDate } from "../../lib/format";
import { useAction, useResource } from "../../lib/resource";
import { CANDIDATE_KIND_TEXT, CANDIDATE_STATUS_TEXT, collectSummary, levelsText } from "../../lib/competition-contest";
import type { Candidate, CandidateList, CandidateStatus, Core, Importance } from "../../lib/types";

/**
 * 待确认贡献（#278）：GitLab 收来的合并 MR 与 Issue。「有用」和重要程度、核心度两档标签都由有审核积分权限的人打上的，
 * 收集时已经按两档自动加分；其余在这里选两档确认，或者驳回。确认与驳回都要刚登录过，服务端写操作记录。
 */
const props = defineProps<{ competitionId: string }>();
const emit = defineEmits<{ changed: [] }>();

const status = ref<CandidateStatus>("pending");
const base = computed(() => `/api/console/competitions/${encodeURIComponent(props.competitionId)}/candidates`);
const list = useResource(() => api<CandidateList>(`${base.value}?status=${status.value}`), [() => props.competitionId, status]);
// 「加载更多」接在第一页后面；换状态或重读时清掉
const more = ref<Candidate[]>([]);
const cursor = ref<string | null>(null);
watch(() => list.data.value, value => { more.value = []; cursor.value = value?.next_cursor ?? null; });
const rows = computed(() => [...(list.data.value?.items ?? []), ...more.value]);
const loadMore = useAction(async () => {
  if (!cursor.value) return;
  const page = await api<CandidateList>(`${base.value}?status=${status.value}&cursor=${encodeURIComponent(cursor.value)}`);
  more.value = [...more.value, ...page.items];
  cursor.value = page.next_cursor;
});

const chips = computed(() => (["pending", "accepted", "rejected"] as const).map(value => ({
  value, label: `${CANDIDATE_STATUS_TEXT[value]} ${list.data.value?.counts[value] ?? 0}`,
})));

const collect = useAction(async () => {
  const result = await api<{ last_run: CandidateList["last_run"] }>(`${base.value}/collect`, { method: "POST" });
  toast({ title: collectSummary(result.last_run), variant: result.last_run?.error ? "warning" : "success" });
  await list.reload();
  emit("changed");
});

const columns = [
  { key: "item", title: "贡献", minWidth: 280 },
  { key: "author", title: "作者", width: 180 },
  { key: "points", title: "两档与分值", width: 150 },
  { key: "status", title: "状态", width: 200 },
  { key: "contributed_at", title: "时间（北京时间）", width: 150 },
  { key: "actions", title: "操作", width: 150, align: "right" as const },
];

const statusTone = (row: Candidate) => (row.status === "accepted" ? "success" : row.status === "rejected" ? "muted" : "warning");
const viaText = (row: Candidate) => (row.accepted_via === "label" ? "GitLab 标签" : row.accepted_via === "console" ? "控制台确认" : "");

// —— 确认 ——
const accepting = ref<Candidate | null>(null);
const acceptImportance = ref<Importance | "">("");
const acceptCore = ref<Core | "">("");
const acceptReason = ref("");
const acceptErrors = ref<{ importance?: string; core?: string }>({});
/** 打开确认弹窗：两档默认选 GitLab 标签上的。 */
function askAccept(row: Candidate) {
  accepting.value = row;
  acceptImportance.value = row.importance ?? "";
  acceptCore.value = row.core ?? "";
  acceptReason.value = "";
  acceptErrors.value = {};
  accept.reset();
}
const accept = useAction(async () => {
  const row = accepting.value;
  if (!row) return;
  acceptErrors.value = { importance: acceptImportance.value ? undefined : "请选重要程度。", core: acceptCore.value ? undefined : "请选核心度。" };
  if (!acceptImportance.value || !acceptCore.value) return;
  await api(`${base.value}/${encodeURIComponent(row.id)}/accept`, {
    method: "POST", ...jsonBody({ importance: acceptImportance.value, core: acceptCore.value, reason: acceptReason.value.trim() }),
  });
  toast({ title: `已给 @${row.account.username} 加分`, variant: "success" });
  accepting.value = null;
  await list.reload();
  emit("changed");
});

// —— 驳回 ——
const rejecting = ref<Candidate | null>(null);
const rejectReason = ref("");
const rejectError = ref("");
function askReject(row: Candidate) {
  rejecting.value = row;
  rejectReason.value = "";
  rejectError.value = "";
  reject.reset();
}
const reject = useAction(async () => {
  const row = rejecting.value;
  if (!row) return;
  const reason = rejectReason.value.trim();
  rejectError.value = !reason ? "请写驳回原因，作者会在记录里看到。" : [...reason].length > 200 ? "原因最多 200 个字。" : "";
  if (rejectError.value) return;
  await api(`${base.value}/${encodeURIComponent(row.id)}/reject`, { method: "POST", ...jsonBody({ reason }) });
  toast({ title: row.status === "accepted" ? "已驳回，这条加的分也撤销了" : "已驳回", variant: "success" });
  rejecting.value = null;
  await list.reload();
  emit("changed");
});
</script>

<template>
  <TxCard class="section">
    <div class="section-head">
      <h2>待确认贡献</h2>
      <span class="muted">GitLab 上合并的 MR 与 Issue。有审核积分权限的人打上「有用」和「重要程度::」「核心度::」两个标签的会自动加分，其余在这里选两档确认，或者驳回。分数不看改动行数。</span>
      <span class="section-end">
        <TxButton icon="i-carbon-renew" :loading="collect.pending.value" @click="collect.execute()">立即收集</TxButton>
      </span>
    </div>
    <p class="muted run">{{ collectSummary(list.data.value?.last_run ?? null) }}</p>
    <ErrorAlert v-if="collect.error.value" :error="collect.error.value" @close="collect.reset()" />

    <TxFilterChips :model-value="status" :items="chips" aria-label="按状态筛选" @update:model-value="value => { status = value as CandidateStatus; }" />

    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="5" />
    <template v-else>
      <TxDataTable style="--table-min: 1100px" :columns="columns" :data="rows" row-key="id" table-layout="fixed" scroll-x class="table">
        <template #cell-item="{ row }: { row: Candidate }">
          <span class="cell-stack">
            <span class="cell-title">
              <TxTag :label="CANDIDATE_KIND_TEXT[row.kind]" size="sm" />
              <a class="ellipsis" :href="row.url" target="_blank" rel="noreferrer">{{ row.title || `${row.gitlab_project}${row.kind === 'pr' ? '!' : '#'}${row.gitlab_iid}` }}</a>
            </span>
            <span class="cell-sub mono ellipsis">{{ row.gitlab_project }}{{ row.kind === "pr" ? "!" : "#" }}{{ row.gitlab_iid }}</span>
            <span v-if="row.note" class="cell-sub clamp-2">{{ row.note }}</span>
          </span>
        </template>
        <template #cell-author="{ row }: { row: Candidate }">
          <UserCell :login="row.account.username" :src="row.account.avatar_url" :sub="row.account.display_name" />
        </template>
        <template #cell-points="{ row }: { row: Candidate }">
          <span class="cell-stack">
            <span v-if="levelsText(row.importance, row.core)">{{ levelsText(row.importance, row.core) }}</span>
            <span v-else class="muted">没选两档</span>
            <span v-if="row.final_points !== null" class="cell-sub">基础分 {{ row.final_points }}</span>
            <span v-else-if="levelsText(row.importance, row.core)" class="cell-sub">GitLab 标签上的</span>
          </span>
        </template>
        <template #cell-status="{ row }: { row: Candidate }">
          <span class="cell-stack">
            <TxStatusBadge :text="CANDIDATE_STATUS_TEXT[row.status]" :status="statusTone(row)" size="sm" />
            <span v-if="row.reviewed_by" class="cell-sub ellipsis">{{ viaText(row) || "处理人" }} · @{{ row.reviewed_by.username }}</span>
            <span v-if="row.reason" class="cell-sub clamp-2">{{ row.reason }}</span>
          </span>
        </template>
        <template #cell-contributed_at="{ row }: { row: Candidate }">
          <span class="muted">{{ fmtDate(row.contributed_at) }}</span>
        </template>
        <template #cell-actions="{ row }: { row: Candidate }">
          <span class="row-actions">
            <TxButton v-if="row.status === 'pending'" size="sm" variant="ghost" @click="askAccept(row)">确认</TxButton>
            <TxButton v-if="row.status !== 'rejected'" size="sm" variant="ghost" class="danger-text" @click="askReject(row)">驳回</TxButton>
            <span v-if="row.status === 'rejected'" class="muted">—</span>
          </span>
        </template>
        <template #empty>
          <TxEmptyState :title="`没有${CANDIDATE_STATUS_TEXT[status]}的贡献`" description="比赛开始后，配了 GitLab 项目时每 10 分钟收一轮；也可以点「立即收集」。" size="small" />
        </template>
      </TxDataTable>
      <div v-if="cursor" class="more">
        <TxButton :loading="loadMore.pending.value" @click="loadMore.execute()">加载更多</TxButton>
      </div>
      <ErrorAlert v-if="loadMore.error.value" :error="loadMore.error.value" @close="loadMore.reset()" />
    </template>

    <TxModal :model-value="Boolean(accepting)" title="确认这条贡献" width="min(92vw, 520px)" @update:model-value="value => { if (!value) accepting = null; }">
      <template v-if="accepting">
        <p class="summary">{{ CANDIDATE_KIND_TEXT[accepting.kind] }} · @{{ accepting.account.username }} · {{ accepting.title }}</p>
        <p class="muted">选这条对项目的重要程度和核心度，基础分查表，再乘记分这一刻作者的年级系数，记下后不再改。</p>
        <TxForm :model="{ importance: acceptImportance, core: acceptCore, reason: acceptReason }" label-position="top" class="accept-form">
          <ScoreLevels
            :competition-id="competitionId" :account-id="accepting.account.account_id" :kind="accepting.kind" :at="accepting.contributed_at"
            :importance="acceptImportance" :core="acceptCore" :errors="acceptErrors"
            @update:importance="value => { acceptImportance = value; acceptErrors.importance = undefined; }"
            @update:core="value => { acceptCore = value; acceptErrors.core = undefined; }"
          />
          <TxFormItem label="说明（选填）" class="wide">
            <TxTextarea v-model="acceptReason" :rows="2" placeholder="例如：修了登录页的竞态，影响所有人登录。" />
          </TxFormItem>
        </TxForm>
        <ErrorAlert v-if="accept.error.value" :error="accept.error.value" @close="accept.reset()" />
      </template>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="accepting = null">取消</TxButton>
          <TxButton variant="primary" :loading="accept.pending.value" @click="accept.execute()">确认加分</TxButton>
        </div>
      </template>
    </TxModal>

    <TxModal :model-value="Boolean(rejecting)" title="驳回这条贡献" width="min(92vw, 520px)" @update:model-value="value => { if (!value) rejecting = null; }">
      <template v-if="rejecting">
        <p class="summary">{{ CANDIDATE_KIND_TEXT[rejecting.kind] }} · @{{ rejecting.account.username }} · {{ rejecting.title }}</p>
        <p class="muted">{{ rejecting.status === "accepted" ? "这条已经加过分，驳回会连同积分一起撤销，记录保留。" : "驳回后不计分，记录保留。" }}</p>
        <TxForm :model="{ reason: rejectReason }" label-position="top">
          <TxFormItem label="驳回原因">
            <TxTextarea v-model="rejectReason" :rows="3" placeholder="例如：只改了格式，没有实际改动。" />
            <span v-if="rejectError" class="field-error">{{ rejectError }}</span>
          </TxFormItem>
        </TxForm>
        <ErrorAlert v-if="reject.error.value" :error="reject.error.value" @close="reject.reset()" />
      </template>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="rejecting = null">取消</TxButton>
          <TxButton variant="danger" :loading="reject.pending.value" @click="reject.execute()">驳回</TxButton>
        </div>
      </template>
    </TxModal>
  </TxCard>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.run {
  margin: -6px 0 12px;
  font-size: 0.8125rem;
}
.table {
  margin-top: 12px;
}
.cell-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.points {
  font-weight: 600;
}
.row-actions {
  display: inline-flex;
  gap: 4px;
  white-space: nowrap;
}
.more {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.accept-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
}
.accept-form .wide {
  grid-column: 1 / -1;
}
@media (max-width: 520px) {
  .accept-form {
    grid-template-columns: minmax(0, 1fr);
  }
}
.summary {
  margin: 0 0 8px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
