<script setup lang="ts">
import { computed } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import UserCell from "../../components/UserCell.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api } from "../../lib/http";
import { confirm } from "../../lib/confirm";
import { fmtDate } from "../../lib/format";
import { useAction, useResource } from "../../lib/resource";
import type { CompetitionPrize, FinalView } from "../../lib/types";

/**
 * 定榜（#278）：比赛结束后冻结名次，按奖项给得奖的人各发一个兑奖码（本人在门户「我的参赛」看到，这里只有末四位）。
 * 定榜后积分、规则、候选都不能再改；有奖已经核销时不能撤销定榜。要 competition.manage 加刚登录过。
 */
const props = defineProps<{ competitionId: string; endAt: number; canManage: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const path = computed(() => `/api/console/competitions/${encodeURIComponent(props.competitionId)}/final`);
const final = useResource(() => api<FinalView>(path.value), [() => props.competitionId]);
const ended = computed(() => Date.now() > props.endAt);
const finalized = computed(() => final.data.value?.finalized_at !== null && final.data.value?.finalized_at !== undefined);
const redeemedCount = computed(() => final.data.value?.prizes.filter(prize => prize.redeemed_at !== null).length ?? 0);
const winners = computed(() => final.data.value?.preview.filter(row => row.amount_cny !== null).length ?? 0);

const finalize = useAction(async () => {
  if (!(await confirm({
    title: "定榜？",
    body: `按现在的分数冻结名次，给 ${winners.value} 位得奖的同学各发一个兑奖码。定榜后不能再加分、改规则或确认贡献。`,
    confirmText: "定榜",
  }))) return;
  final.data.value = await api<FinalView>(path.value, { method: "POST" });
  toast({ title: "已定榜，兑奖码已发出", variant: "success" });
  emit("changed");
});
const unfinalize = useAction(async () => {
  if (!(await confirm({ title: "撤销定榜？", body: "名次快照和全部兑奖码都会删掉，得奖的同学手里的码随之作废。之后可以继续加分，再重新定榜。", confirmText: "撤销定榜", danger: true }))) return;
  final.data.value = await api<FinalView>(path.value, { method: "DELETE" });
  toast({ title: "已撤销定榜", variant: "success" });
  emit("changed");
});

const previewColumns = [
  { key: "rank", title: "名次", width: 80 },
  { key: "account", title: "选手" },
  { key: "points", title: "分数", width: 100 },
  { key: "prize", title: "奖项", width: 260 },
];
const prizeColumns = [
  { key: "rank", title: "名次", width: 80 },
  { key: "account", title: "得奖人" },
  { key: "prize", title: "奖项", width: 240 },
  { key: "code", title: "兑奖码", width: 130 },
  { key: "redeemed", title: "核销", width: 220 },
];
</script>

<template>
  <ErrorPanel v-if="final.error.value" :error="final.error.value" :retry="final.reload" />
  <LoadingBlock v-else-if="!final.data.value" :lines="6" />
  <TxCard v-else class="section">
    <div class="section-head">
      <h2>定榜</h2>
      <span class="muted">
        <template v-if="finalized">{{ fmtDate(final.data.value.finalized_at) }} <template v-if="final.data.value.finalized_by">由 @{{ final.data.value.finalized_by.username }} </template>定榜。</template>
        <template v-else>比赛结束后定榜：冻结名次、给得奖的人发兑奖码。</template>
      </span>
      <span v-if="canManage" class="section-end">
        <TxButton v-if="!finalized" variant="primary" :disabled="!ended" :loading="finalize.pending.value" @click="finalize.execute()">定榜</TxButton>
        <TxButton v-else variant="ghost" class="danger-text" :disabled="redeemedCount > 0" :loading="unfinalize.pending.value" @click="unfinalize.execute()">撤销定榜</TxButton>
      </span>
    </div>
    <TxAlert v-if="!finalized && !ended" type="info" title="比赛还没结束">{{ fmtDate(endAt) }} 结束后才能定榜。下面是按现在的分数排的名次。</TxAlert>
    <TxAlert v-if="finalized && redeemedCount > 0" type="info" title="不能撤销">已经有 {{ redeemedCount }} 张奖核销过了。</TxAlert>
    <ErrorAlert v-if="finalize.error.value" :error="finalize.error.value" @close="finalize.reset()" />
    <ErrorAlert v-if="unfinalize.error.value" :error="unfinalize.error.value" @close="unfinalize.reset()" />

    <template v-if="!finalized">
      <h3 class="subhead">现在的名次</h3>
      <TxDataTable style="--table-min: 620px" :columns="previewColumns" :data="final.data.value.preview" row-key="rank" table-layout="fixed" scroll-x>
        <template #cell-rank="{ row }: { row: FinalView['preview'][number] }"><span class="mono">{{ row.rank }}</span></template>
        <template #cell-account="{ row }: { row: FinalView['preview'][number] }">
          <UserCell :login="row.account.username" :src="row.account.avatar_url" :sub="row.account.display_name" />
        </template>
        <template #cell-points="{ row }: { row: FinalView['preview'][number] }"><span class="mono">{{ row.points }}</span></template>
        <template #cell-prize="{ row }: { row: FinalView['preview'][number] }">
          <span v-if="row.amount_cny !== null">{{ row.amount_cny }} 元<template v-if="row.title"> · {{ row.title }}</template></span>
          <span v-else class="muted">—</span>
        </template>
        <template #empty><TxEmptyState title="还没有人得分" description="有了有效积分后，这里按分数排名次。" size="small" /></template>
      </TxDataTable>
    </template>

    <template v-else>
      <h3 class="subhead">奖项与兑奖码</h3>
      <TxDataTable style="--table-min: 760px" :columns="prizeColumns" :data="final.data.value.prizes" row-key="id" table-layout="fixed" scroll-x>
        <template #cell-rank="{ row }: { row: CompetitionPrize }"><span class="mono">{{ row.rank }}</span></template>
        <template #cell-account="{ row }: { row: CompetitionPrize }">
          <UserCell :login="row.account.username" :src="row.account.avatar_url" :sub="`${row.account.display_name} · ${row.points} 分`" />
        </template>
        <template #cell-prize="{ row }: { row: CompetitionPrize }">
          <span>{{ row.amount_cny }} 元<template v-if="row.title"> · {{ row.title }}</template></span>
        </template>
        <template #cell-code="{ row }: { row: CompetitionPrize }"><span class="mono muted">末四位 {{ row.code_hint }}</span></template>
        <template #cell-redeemed="{ row }: { row: CompetitionPrize }">
          <span class="cell-stack">
            <TxStatusBadge :text="row.redeemed_at ? '已核销' : '未核销'" :status="row.redeemed_at ? 'success' : 'warning'" size="sm" />
            <span v-if="row.redeemed_at" class="cell-sub">{{ fmtDate(row.redeemed_at) }} · @{{ row.redeemed_by?.username ?? "—" }}</span>
          </span>
        </template>
        <template #empty><TxEmptyState title="这次没有发奖" description="没有设奖项，或者没有人分数大于 0。" size="small" /></template>
      </TxDataTable>
    </template>
  </TxCard>
</template>

<style scoped src="./panel.css"></style>
