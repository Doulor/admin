<script setup lang="ts">
import { computed } from "vue";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxButton } from "@talex-touch/tuffex/button";
import { describeError, errorAction, errorTrace } from "../lib/errors";
import { signInHref } from "../lib/runtime";
import { useSession } from "../lib/session";

/**
 * 写操作失败：内联横幅，保留用户已填的内容。登录失效或要求重新确认身份（step_up_required）时
 * 再点保存也只会被拦，横幅里给「重新登录」，登录后回到当前页。
 */
const props = defineProps<{ error: unknown }>();
defineEmits<{ close: [] }>();
const { permissionLabel } = useSession();
const view = computed(() => describeError(props.error, permissionLabel));
const action = computed(() => errorAction(view.value, false));
const signIn = () => window.location.assign(signInHref(window.location.href));
</script>

<template>
  <TxAlert type="error" :title="view.title" :closable="true" @close="$emit('close')">
    <span>{{ view.detail }}</span>
    <span class="mono trace">{{ errorTrace(view) }}</span>
    <span v-if="action?.kind === 'signin'" class="alert-action">
      <TxButton size="sm" variant="primary" icon="i-carbon-login" @click="signIn">{{ action.label }}</TxButton>
    </span>
  </TxAlert>
</template>

<style scoped>
.trace {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.8;
  overflow-wrap: anywhere;
}
.alert-action {
  display: block;
  margin-top: 8px;
}
</style>
