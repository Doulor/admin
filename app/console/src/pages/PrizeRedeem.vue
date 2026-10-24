<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { toast } from "@talex-touch/tuffex/utils";
import PageHeader from "../components/PageHeader.vue";
import UserCell from "../components/UserCell.vue";
import ErrorAlert from "../components/ErrorAlert.vue";
import { api, jsonBody } from "../lib/http";
import { confirm } from "../lib/confirm";
import { fmtDate } from "../lib/format";
import { useAction } from "../lib/resource";
import { codeError, redeemFailure } from "../lib/competition-contest";
import type { RedeemPrize } from "../lib/types";

/**
 * 核销兑奖码（#278）：得奖的同学拿着门户「我的参赛」里的兑奖码来兑奖，在这里先查、核对是谁和哪张奖，再核销。
 * 要 competition.prize.redeem；核销再要刚登录过。输错的码每人每小时最多 20 次，查不到的查找也写进操作记录。
 */
const router = useRouter();
const code = ref("");
const codeProblem = ref("");
const prize = ref<RedeemPrize | null>(null);
const notice = ref("");

/** 查不到、已核销、输错太多次直接写在页面上；其余（要重新登录、没有权限）交给 ErrorAlert。 */
function settle(error: unknown): void {
  const failure = redeemFailure(error);
  if (!failure) throw error;
  notice.value = failure.text;
  prize.value = (failure.prize as RedeemPrize | null) ?? null;
}

const lookup = useAction(async () => {
  const problem = codeError(code.value);
  codeProblem.value = problem ?? "";
  if (problem) return;
  notice.value = "";
  prize.value = null;
  try {
    prize.value = (await api<{ prize: RedeemPrize }>("/api/console/prizes/lookup", { method: "POST", ...jsonBody({ code: code.value.trim() }) })).prize;
  } catch (error) {
    settle(error);
  }
});

const redeem = useAction(async () => {
  const target = prize.value;
  if (!target) return;
  if (!(await confirm({
    title: "核销这张奖？",
    body: `${target.competition_name} 第 ${target.rank} 名 @${target.account.username}，${target.amount_cny} 元。核销后这个兑奖码不能再用。`,
    confirmText: "核销",
  }))) return;
  notice.value = "";
  try {
    prize.value = (await api<{ prize: RedeemPrize }>("/api/console/prizes/redeem", { method: "POST", ...jsonBody({ code: code.value.trim() }) })).prize;
    toast({ title: "已核销", variant: "success" });
  } catch (error) {
    settle(error);
  }
});

function reset() {
  code.value = "";
  codeProblem.value = "";
  prize.value = null;
  notice.value = "";
  lookup.reset();
  redeem.reset();
}
</script>

<template>
  <div class="page">
    <PageHeader title="核销兑奖码" description="得奖的同学在门户「我的参赛」里看到兑奖码。先查出是谁、哪张奖，核对无误后再核销；核销后这个码不能再用。">
      <template #actions>
        <TxButton icon="i-carbon-arrow-left" @click="router.push('/console/competitions')">返回比赛列表</TxButton>
      </template>
    </PageHeader>

    <TxCard class="redeem">
      <TxForm :model="{ code }" label-position="top" @submit.prevent="lookup.execute()">
        <TxFormItem label="兑奖码">
          <TxInput v-model="code" class="fill-width code-input" placeholder="YUGC-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" @keydown.enter.prevent="lookup.execute()" />
          <span class="field-hint">不分大小写，空格和连字符可有可无。</span>
          <span v-if="codeProblem" class="field-error">{{ codeProblem }}</span>
        </TxFormItem>
        <div class="actions">
          <TxButton v-if="prize || notice" variant="secondary" @click="reset">换一个</TxButton>
          <TxButton variant="primary" :loading="lookup.pending.value" @click="lookup.execute()">查找</TxButton>
        </div>
      </TxForm>
      <ErrorAlert v-if="lookup.error.value" :error="lookup.error.value" @close="lookup.reset()" />
      <TxAlert v-if="notice" type="warning" :title="notice" />
    </TxCard>

    <TxCard v-if="prize" class="redeem">
      <div class="prize-head">
        <h2>{{ prize.competition_name }} · 第 {{ prize.rank }} 名</h2>
        <TxStatusBadge :text="prize.redeemed_at ? '已核销' : '未核销'" :status="prize.redeemed_at ? 'success' : 'warning'" />
      </div>
      <dl class="facts">
        <dt>奖项</dt>
        <dd>{{ prize.amount_cny }} 元<template v-if="prize.title"> · {{ prize.title }}</template></dd>
        <dt>分数</dt>
        <dd class="mono">{{ prize.points }}</dd>
        <dt>得奖人</dt>
        <dd><UserCell :login="prize.account.username" :src="prize.account.avatar_url" :sub="prize.real_name ? `${prize.account.display_name} · ${prize.real_name}` : prize.account.display_name" /></dd>
        <dt>兑奖码末四位</dt>
        <dd class="mono">{{ prize.code_hint }}</dd>
        <template v-if="prize.redeemed_at">
          <dt>核销</dt>
          <dd>{{ fmtDate(prize.redeemed_at) }}<template v-if="prize.redeemed_by"> · @{{ prize.redeemed_by.username }}</template></dd>
        </template>
      </dl>
      <ErrorAlert v-if="redeem.error.value" :error="redeem.error.value" @close="redeem.reset()" />
      <div v-if="!prize.redeemed_at" class="actions">
        <TxButton variant="primary" :loading="redeem.pending.value" @click="redeem.execute()">核销</TxButton>
      </div>
    </TxCard>
  </div>
</template>

<style scoped>
.redeem {
  max-width: 640px;
}
.code-input :deep(input) {
  font-family: var(--console-mono);
  letter-spacing: 0.04em;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.actions :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
.field-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  line-height: 1.125rem;
  opacity: 0.75;
}
.field-error {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--tx-color-danger);
}
.prize-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
}
.prize-head h2 {
  margin: 0;
  font-size: 1.05rem;
}
</style>
