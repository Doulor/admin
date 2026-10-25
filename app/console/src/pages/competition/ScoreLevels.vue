<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { TxFormItem } from "@talex-touch/tuffex/form";
import { TxSelect } from "@talex-touch/tuffex/select";
import { api } from "../../lib/http";
import { coreOptions, importanceOptions, previewQuery, previewText } from "../../lib/competition-contest";
import type { Core, Importance, ScoreKind, ScorePreview } from "../../lib/types";

/**
 * 两档评定（#278，所有者 2026-10-24 16:59）：重要程度、核心度两个下拉框，选完就向服务端试算这条会记多少分
 * （基础分 × 年级系数 × 防刷折扣），和真正登记是同一套算法。积分登记表单与「待确认贡献」的确认弹窗共用。
 */
const props = defineProps<{
  competitionId: string;
  accountId: string;
  kind: ScoreKind;
  /** 贡献发生的时间：候选传 contributed_at，手工登记不传（按现在算）。 */
  at?: number;
  importance: Importance | "";
  core: Core | "";
  errors?: { importance?: string; core?: string };
}>();
const emit = defineEmits<{ "update:importance": [Importance]; "update:core": [Core] }>();

const query = computed(() => previewQuery({ accountId: props.accountId, kind: props.kind, importance: props.importance, core: props.core, at: props.at }));
const preview = shallowRef<ScorePreview | null>(null);
const failed = ref(false);
let seq = 0;
watch([query, () => props.competitionId], async ([value]) => {
  const mine = ++seq;
  preview.value = null;
  failed.value = false;
  if (!value) return;
  try {
    const result = await api<ScorePreview>(`/api/console/competitions/${encodeURIComponent(props.competitionId)}/score-preview?${value}`);
    if (mine === seq) preview.value = result;
  } catch {
    if (mine === seq) failed.value = true;
  }
}, { immediate: true });

const hint = computed(() => {
  if (preview.value) return previewText(props.kind, preview.value);
  if (failed.value) return "现在算不出分数，登记时以服务端为准。";
  if (props.kind === "penalty") return props.accountId ? "" : "选好选手后显示扣多少分。";
  return props.accountId ? "选好两档后显示这条会记多少分。" : "选好选手和两档后显示这条会记多少分。";
});
</script>

<template>
  <template v-if="kind !== 'penalty'">
    <TxFormItem label="重要程度">
      <!-- TxSelect 0.6.0 的 attrs 落在外层，用 label 给里面的输入框命名。 -->
      <label class="fill-width">
        <span class="sr-only">重要程度</span>
        <TxSelect :model-value="importance" :options="importanceOptions" placeholder="选一档" panel-background="pure" :searchable="false" class="fill-width" @update:model-value="value => emit('update:importance', value as Importance)" />
      </label>
      <span v-if="errors?.importance" class="field-error">{{ errors.importance }}</span>
    </TxFormItem>
    <TxFormItem label="核心度">
      <label class="fill-width">
        <span class="sr-only">核心度</span>
        <TxSelect :model-value="core" :options="coreOptions" placeholder="选一档" panel-background="pure" :searchable="false" class="fill-width" @update:model-value="value => emit('update:core', value as Core)" />
      </label>
      <span v-if="errors?.core" class="field-error">{{ errors.core }}</span>
    </TxFormItem>
  </template>
  <p v-if="hint" class="levels-result wide" :class="{ 'levels-result--ready': preview }" aria-live="polite">{{ hint }}</p>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.levels-result {
  grid-column: 1 / -1;
  margin: 0 0 8px;
  font-size: 0.875rem;
  opacity: 0.8;
}
.levels-result--ready {
  font-weight: 600;
  opacity: 1;
}
</style>
