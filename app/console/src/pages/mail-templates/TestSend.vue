<script setup lang="ts">
import { computed, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxFormItem } from "@talex-touch/tuffex/form";
import ErrorAlert from "../../components/ErrorAlert.vue";
import { api, jsonBody } from "../../lib/http";
import { useAction } from "../../lib/resource";
import { testAddressError, testSendFailure, testSendOutcome, type PreviewPayload } from "../../lib/mail-templates";
import type { MailTemplateList, MailTestSend } from "../../lib/types";

/**
 * 向测试邮箱试发一封样信：内容是左边正在编辑的这一版（没保存也能发），数据是示例投递人，
 * 只发到这里填的这一个邮箱，不会发给任何投递人，也不改任何投递记录。结果照实显示：发出了、没发（为什么）、发失败了（对方的错误码）。
 */
const props = defineProps<{ payload: PreviewPayload; mail: MailTemplateList["mail"]; quota: MailTemplateList["test_send"] }>();
const to = defineModel<string>("to", { default: "" });

const checked = ref(false);
const addressError = computed(() => (checked.value ? testAddressError(to.value) : null));
const result = ref<MailTestSend | null>(null);

const send = useAction(async () => {
  checked.value = true;
  result.value = null;
  if (testAddressError(to.value)) return;
  result.value = await api<MailTestSend>("/api/console/mail-templates/test-send", { method: "POST", ...jsonBody({ ...props.payload, to: to.value.trim() }) });
});
const outcome = computed(() => (result.value ? testSendOutcome(result.value) : null));
const failure = computed(() => testSendFailure(send.error.value));
const hint = computed(() => {
  if (!props.mail.enabled) return "发信还没有配置，点发送会如实告诉你这封没有发出。";
  if (props.mail.recipients === "allowlist") return "当前只给白名单里的邮箱发信，不在白名单的地址不会收到。";
  return "";
});
</script>

<template>
  <TxCard>
    <template #header>
      <h2 class="section-title">发一封测试邮件</h2>
    </template>
    <p class="hint">发的是正在编辑的这一版，没保存也可以。主题前会加「【测试】」，数据是示例投递人，只发到下面这个邮箱，不会发给任何投递人，也不改任何投递记录。每个账号一小时最多发 {{ quota.per_hour_per_account }} 封。</p>
    <p v-if="hint" class="note">{{ hint }}</p>
    <TxFormItem label="测试邮箱">
      <template #default="field">
        <TxInput
          v-bind="field"
          v-model="to"
          class="fill-width"
          type="email"
          autocomplete="email"
          inputmode="email"
          spellcheck="false"
          placeholder="例如 name@example.com"
          :maxlength="320"
          :aria-invalid="Boolean(addressError)"
          @keydown.enter.prevent="send.execute()"
        />
        <span v-if="addressError" class="field-error" role="alert">{{ addressError }}</span>
      </template>
    </TxFormItem>
    <TxButton variant="primary" icon="i-carbon-send" :loading="send.pending.value" @click="send.execute()">发送测试邮件</TxButton>
    <p v-if="outcome" class="result" :class="`is-${outcome.tone}`" role="status">{{ outcome.text }}</p>
    <p v-if="failure" class="field-error" role="alert">{{ failure }}</p>
    <ErrorAlert v-else-if="send.error.value" class="alert" :error="send.error.value" @close="send.reset()" />
  </TxCard>
</template>

<style scoped>
.hint,
.note {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.note {
  color: var(--tx-color-warning);
}
.field-error {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  color: var(--tx-color-danger);
}
.result {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  color: var(--tx-text-color-regular);
}
.result.is-success {
  color: var(--tx-color-success);
}
.result.is-warning {
  color: var(--tx-color-warning);
}
.result.is-danger {
  color: var(--tx-color-danger);
}
.alert {
  margin-top: 12px;
}
:deep(button) {
  min-height: 40px;
}
</style>
