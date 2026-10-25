<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { TxPermissionState } from "@talex-touch/tuffex/permission-state";
import { ASSIGNER_TEXT } from "../lib/levels";
import { useSession } from "../lib/session";

/**
 * 页面级权限门：前端只做提示，服务端仍独立校验。权限只看权限节点（SPEC §3.3）。
 */
const props = defineProps<{ anyOf: string[] }>();
const { canAny, permissionLabel } = useSession();
const router = useRouter();

const open = computed(() => canAny(props.anyOf));
const needed = computed(() => permissionLabel(props.anyOf[0]));
const title = computed(() => `你没有「${needed.value}」权限`);
const description = computed(() => `请联系${ASSIGNER_TEXT}，给你的账号或所在组加上「${needed.value}」。`);
const trace = computed(() => `403 forbidden`);
</script>

<template>
  <slot v-if="open" />
  <div v-else class="page">
    <TxPermissionState
      :title="title"
      :description="description"
      size="large"
      surface="card"
      :secondary-action="{ label: '回到概览', variant: 'secondary' }"
      @secondary="router.push('/console')"
    >
      <template #icon>
        <i class="i-carbon-locked gate-icon" aria-hidden="true" />
      </template>
    </TxPermissionState>
    <p class="mono gate-trace">{{ trace }} · {{ anyOf.join(" | ") }}</p>
  </div>
</template>

<style scoped>
.gate-icon {
  font-size: 40px;
  color: var(--tx-text-color-secondary);
}
.gate-trace {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
</style>
