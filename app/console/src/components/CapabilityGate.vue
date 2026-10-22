<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxPermissionState } from "@talex-touch/tuffex/permission-state";
import { BLOCK_REASON_TEXT } from "../lib/nav";
import { useSession } from "../lib/session";
import { assignerText } from "../lib/titles";

/**
 * 页面级能力门：前端只做提示，服务端仍独立校验。
 * 没有任何一项所需能力时，说明缺哪项；称号给了但被 GitHub 组织角色挡住时，说明是这个原因。
 * 只差一次 GitHub 登录的（邮箱、Google 会话打开 GitHub 组织的页面）给「用 GitHub 继续」，登录后回到这一页。
 */
const props = defineProps<{ anyOf: string[] }>();
const { me, catalogue, canAny, capabilityLabel } = useSession();
const route = useRoute();
const router = useRouter();

const PROVIDER_TEXT: Record<string, string> = { email: "邮箱", google: " Google " };
const allowed = computed(() => canAny(props.anyOf));
const blocked = computed(() => me.value?.blocked.find(item => props.anyOf.includes(item.capability)) ?? null);
const needsGithub = computed(() => blocked.value?.reason === "github_session_required");
const needed = computed(() => capabilityLabel(blocked.value?.capability ?? props.anyOf[0]));
const title = computed(() => needsGithub.value ? "这一页要用 GitHub 登录" : `你没有「${needed.value}」权限`);
const description = computed(() => {
  if (needsGithub.value) {
    const via = PROVIDER_TEXT[me.value?.provider ?? ""] ?? "其他方式";
    return `你这次是用${via}登录的。GitHub 组织的页面要用你本人的 GitHub 账号去读写 GitHub，用 GitHub 登录一次就能打开，其他页面不受影响。`;
  }
  return blocked.value
    ? `你的称号包含这项权限，但${BLOCK_REASON_TEXT[blocked.value.reason]}才能使用。控制台不能超出你在 GitHub 组织里的角色。`
    : `请联系${assignerText(catalogue.value)}，在「成员与权限」里给你指派带有「${needed.value}」的称号。`;
});
const primary = computed(() => needsGithub.value
  ? { label: "用 GitHub 继续", variant: "primary" as const, icon: "i-carbon-logo-github" }
  : { label: "回到概览", variant: "secondary" as const });
const secondary = computed(() => needsGithub.value ? { label: "回到概览", variant: "secondary" as const } : undefined);
const githubHref = computed(() => `/auth/github?return_to=${encodeURIComponent(`${window.location.origin}${route.fullPath}`)}`);
const onPrimary = () => needsGithub.value ? window.location.assign(githubHref.value) : void router.push("/console");
const trace = computed(() => needsGithub.value ? "403 github_session_required" : "403 missing_capability");
</script>

<template>
  <slot v-if="allowed" />
  <div v-else class="page">
    <TxPermissionState
      :title="title"
      :description="description"
      size="large"
      surface="card"
      :primary-action="primary"
      :secondary-action="secondary"
      @primary="onPrimary"
      @secondary="router.push('/console')"
    >
      <template #icon>
        <i :class="needsGithub ? 'i-carbon-logo-github' : 'i-carbon-locked'" class="gate-icon" aria-hidden="true" />
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
