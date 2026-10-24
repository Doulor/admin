<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api, jsonBody } from "../../lib/http";
import { fmtDate } from "../../lib/format";
import { useAction, useResource } from "../../lib/resource";
import {
  CORE_HINT, CORE_TEXT, GRADE_KEYS, GRADE_TEXT, emptyPrizeRow, rubricRows, rulesErrors, rulesForm, rulesPayload, rulesValid,
  type RubricRow, type RulesErrors, type RulesForm,
} from "../../lib/competition-contest";
import type { CompetitionRules } from "../../lib/types";

/**
 * 计分与奖项（#278）：两档基础分表与防刷规则（只读，写在服务端 competition-rubric.ts）、年级系数（加分乘它，按记分那一刻
 * 的年级，记下后不再改）、可选的奖项、从哪些 GitLab 项目收贡献。
 * 看要 competition.manage 或 competition.score.review，改要 competition.manage 加刚登录过；定榜后不能改。
 */
const props = defineProps<{ competitionId: string; canEdit: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const path = computed(() => `/api/console/competitions/${encodeURIComponent(props.competitionId)}/rules`);
const rules = useResource(() => api<CompetitionRules>(path.value), [() => props.competitionId]);
const form = reactive<RulesForm>({ factors: { year1: "", year2: "", year3: "", year4: "", graduated: "", none: "" }, prizes: [], projects: "" });
const errors = ref<RulesErrors>({ factors: {}, prizes: [] });
watch(() => rules.data.value, value => {
  if (!value) return;
  Object.assign(form, rulesForm(value));
  errors.value = { factors: {}, prizes: [] };
}, { immediate: true });

const rubric = computed(() => (rules.data.value ? rubricRows(rules.data.value.scoring) : []));
const rubricColumns = [
  { key: "kind", title: "类型", width: 80 },
  { key: "importance", title: "重要程度", width: 96 },
  ...(["edge", "business", "core"] as const).map(key => ({ key, title: `${CORE_TEXT[key]}（${CORE_HINT[key]}）` })),
];
const trivialRule = computed(() => {
  const scoring = rules.data.value?.scoring;
  if (!scoring) return "";
  const rest = scoring.trivial_percent === 0 ? "之后的记 0 分" : `之后的按 ${scoring.trivial_percent}% 算`;
  return `防刷：同一个人在同一周（北京时间周一 0 点起）里「一般 × 边缘」的记录只照算前 ${scoring.trivial_per_week} 条，${rest}，记录照留。作弊扣 ${-scoring.penalty} 分，不乘系数。`;
});

const locked = computed(() => rules.data.value?.finalized ?? false);
const editable = computed(() => props.canEdit && !locked.value);

const addPrize = () => form.prizes.push(emptyPrizeRow(form.prizes.at(-1)));
const removePrize = (index: number) => form.prizes.splice(index, 1);

const save = useAction(async () => {
  const found = rulesErrors(form);
  errors.value = found;
  if (!rulesValid(found)) return;
  const next = await api<CompetitionRules>(path.value, { method: "PUT", ...jsonBody(rulesPayload(form)) });
  rules.data.value = next;
  toast({ title: "计分规则与奖项已保存，官网和门户十几秒内更新", variant: "success" });
  emit("changed");
});
</script>

<template>
  <ErrorPanel v-if="rules.error.value" :error="rules.error.value" :retry="rules.reload" />
  <LoadingBlock v-else-if="!rules.data.value" :lines="6" />
  <TxCard v-else class="section">
    <div class="section-head">
      <h2>计分与奖项</h2>
      <span class="muted">
        <template v-if="rules.data.value.updated_at">{{ fmtDate(rules.data.value.updated_at) }} 由 {{ rules.data.value.updated_by ? `@${rules.data.value.updated_by.username}` : "系统" }} 改过。</template>
        <template v-else>还是默认值。</template>
      </span>
    </div>
    <TxAlert v-if="locked" type="info" title="已定榜">名次和兑奖码已经发出，规则不能再改。要改先在「定榜」里撤销定榜。</TxAlert>
    <TxAlert v-else-if="!canEdit" type="info" title="只能查看">改规则要「管理比赛」权限。</TxAlert>

    <h3 class="subhead">基础分</h3>
    <p class="muted lead">标记「有用」时选这条对项目的重要程度和核心度，基础分查下表；同样两档，MR 比 Issue 高。不看代码行数、文件数和提交数。</p>
    <TxDataTable style="--table-min: 640px" :columns="rubricColumns" :data="rubric" row-key="key" table-layout="fixed" scroll-x class="rubric">
      <template #cell-edge="{ row }: { row: RubricRow }"><span class="mono">{{ row.edge }}</span></template>
      <template #cell-business="{ row }: { row: RubricRow }"><span class="mono">{{ row.business }}</span></template>
      <template #cell-core="{ row }: { row: RubricRow }"><span class="mono">{{ row.core }}</span></template>
    </TxDataTable>
    <p class="muted lead rule">{{ trivialRule }}</p>

    <TxForm :model="form" label-position="top" class="rules-form">
      <h3 class="subhead">年级系数</h3>
      <p class="muted lead">只有被标记「有用」的 Issue 和 MR 加分，基础分乘作者在记分那一刻的年级系数；扣分不乘。低年级系数高，是为了鼓励大一、大二参加；默认值按模拟选的（大一 3.5、大二 2.2、大三 1.4），可填 0.5 到 5。改了系数只影响之后记的分。</p>
      <div class="factors">
        <TxFormItem v-for="key in GRADE_KEYS" :key="key" :label="GRADE_TEXT[key]">
          <TxInput v-model="form.factors[key]" inputmode="decimal" :disabled="!editable" class="fill-width" :aria-label="`${GRADE_TEXT[key]}的系数`" />
          <span v-if="errors.factors[key]" class="field-error">{{ errors.factors[key] }}</span>
        </TxFormItem>
      </div>

      <h3 class="subhead">奖项（选填）</h3>
      <p class="muted lead">按名次从小到大写，一档可以覆盖几个名次；不设奖项时官网和门户不显示奖项。定榜时给每档里的人各发一个兑奖码。</p>
      <div v-for="(row, index) in form.prizes" :key="index" class="prize">
        <TxFormItem label="从第几名">
          <TxInput v-model="row.from" type="number" min="1" max="100" :disabled="!editable" class="fill-width" />
        </TxFormItem>
        <TxFormItem label="到第几名">
          <TxInput v-model="row.to" type="number" min="1" max="100" :disabled="!editable" class="fill-width" />
        </TxFormItem>
        <TxFormItem label="金额（元）">
          <TxInput v-model="row.amount" type="number" min="0" max="100000" :disabled="!editable" class="fill-width" />
        </TxFormItem>
        <TxFormItem label="说明" class="prize-title">
          <TxInput v-model="row.title" :disabled="!editable" class="fill-width" placeholder="例如：GPT Plus 订阅的价格" />
        </TxFormItem>
        <TxButton v-if="editable" class="prize-remove danger-text" variant="ghost" icon="i-carbon-trash-can" :aria-label="`删除第 ${index + 1} 档`" @click="removePrize(index)">删除</TxButton>
        <span v-if="errors.prizes[index]" class="field-error prize-error">{{ errors.prizes[index] }}</span>
      </div>
      <p v-if="!form.prizes.length" class="muted">没有设奖项。</p>
      <span v-if="errors.prizeOrder" class="field-error">{{ errors.prizeOrder }}</span>
      <TxButton v-if="editable" icon="i-carbon-add" class="add" :disabled="form.prizes.length >= 20" @click="addPrize">加一档</TxButton>

      <h3 class="subhead">GitLab 项目</h3>
      <TxFormItem label="从这些项目收合并的 MR 与 Issue，每行一个">
        <TxTextarea v-model="form.projects" :rows="3" :disabled="!editable" placeholder="geek/admin" />
        <span class="field-hint">最多 10 个。GitLab 同步打开时每 10 分钟收一轮。</span>
        <span v-if="errors.projects" class="field-error">{{ errors.projects }}</span>
      </TxFormItem>

      <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
      <div v-if="editable" class="form-actions">
        <TxButton variant="primary" :loading="save.pending.value" @click="save.execute()">保存</TxButton>
      </div>
    </TxForm>
  </TxCard>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.rubric {
  margin-bottom: 8px;
}
.rule {
  margin-top: 8px;
}
.lead {
  margin: -2px 0 10px;
  font-size: 0.8125rem;
  max-width: 72ch;
}
.factors {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px 12px;
}
.prize {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 120px)) minmax(0, 1fr) auto;
  align-items: end;
  gap: 4px 12px;
  margin-bottom: 8px;
}
.prize-error {
  grid-column: 1 / -1;
}
.prize-remove {
  margin-bottom: 4px;
}
.add {
  margin-top: 4px;
}
.rules-form :deep(.tx-input) {
  min-height: 44px;
}
.rules-form :deep(.add),
.rules-form :deep(.prize-remove) {
  min-height: 44px;
}
@media (max-width: 760px) {
  .factors {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .prize {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .prize-title {
    grid-column: 1 / -1;
  }
}
</style>
