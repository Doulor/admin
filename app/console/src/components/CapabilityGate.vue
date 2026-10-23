<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxPermissionState } from "@talex-touch/tuffex/permission-state";
import { needsGithubConnection } from "../lib/nav";
import { useSession } from "../lib/session";
import { assignerText } from "../lib/titles";

/**
 * 页面级能力门：前端只做提示，服务端仍独立校验。能力只看站内称号（#262 第四期）。
 * 没有所需能力时，说明缺哪项、找谁指派；GitHub 组织的页面有能力但服务器还没接上 GitHub（没配 GitHub App，
 * 这次也不是用 GitHub 登录的）时，说明原因并给「用 GitHub 继续」，登录后回到这一页；`githubOptional` 的页面不拦，由页面自己说明。
 */
const props = defineProps<{ anyOf: string[]; githubOptional?: boolean }>();
const { me, catalogue, canAny, capabilityLabel } = useSession();
const route = useRoute();
const router = useRouter();

const allowed = computed(() => canAny(props.anyOf));
const notConnected = computed(() => allowed.value && !props.githubOptional && needsGithubConnection(props.anyOf) && me.value?.github === "none");
const open = computed(() => allowed.value && !notConnected.value);
const needed = computed(() => capabilityLabel(props.anyOf[0]));
const title = computed(() => notConnected.value ? "GitHub 还没接上" : `你没有「${needed.value}」权限`);
const description = computed(() => {
  if (!notConnected.value) return `请联系${assignerText(catalogue.value)}，在「成员与权限」里给你指派带有「${needed.value}」的称号。`;
  const text = "服务器还没配 GitHub App。配好之前，GitHub 组织的页面要借你本人的 GitHub 授权去读写 GitHub：用 GitHub 登录一次就能打开，其他页面不受影响。";
  return me.value?.site_role === "admin"
    ? `${text}GitHub App 要由 GitHub 组织的一位所有者在 GitHub 上建好、装到组织上，再把 App ID 和私钥配到服务器。`
    : text;
});
const primary = computed(() => notConnected.value
  ? { label: "用 GitHub 继续", variant: "primary" as const, icon: "i-carbon-logo-github" }
  : { label: "回到概览", variant: "secondary" as const });
const secondary = computed(() => notConnected.value ? { label: "回到概览", variant: "secondary" as const } : undefined);
const githubHref = computed(() => `/auth/github?return_to=${encodeURIComponent(`${window.location.origin}${route.fullPath}`)}`);
const onPrimary = () => notConnected.value ? window.location.assign(githubHref.value) : void router.push("/console");
const trace = computed(() => notConnected.value ? "409 github_not_connected" : "403 missing_capability");
</script>

<template>
  <slot v-if="open" />
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
        <i :class="notConnected ? 'i-carbon-logo-github' : 'i-carbon-locked'" class="gate-icon" aria-hidden="true" />
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
