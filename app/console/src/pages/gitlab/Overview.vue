<script setup lang="ts">
import { useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxStatCard } from "@talex-touch/tuffex/stat-card";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import PageHeader from "../../components/PageHeader.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api } from "../../lib/http";
import { fmtDate, fmtRelative } from "../../lib/format";
import { modeText } from "../../lib/gitlab";
import { useResource } from "../../lib/resource";
import type { GitlabStatus } from "../../lib/types";

/** GitLab 概览（SPEC §3.9）：同步模式、版本、连接状况、上次同步和最近 24 小时的错误数。令牌只说配没配。 */
const router = useRouter();
const status = useResource(() => api<GitlabStatus>("/api/console/gitlab/status"));
const MODE_STATUS = { off: "muted", "dry-run": "warning", on: "success" } as const;
</script>

<template>
  <div class="page">
    <PageHeader title="GitLab 概览" description="自建 GitLab 的连接状况和账号同步的结果。" />

    <ErrorPanel v-if="status.error.value" :error="status.error.value" :retry="status.reload" />
    <LoadingBlock v-else-if="!status.data.value" :lines="6" />
    <template v-else>
      <div class="grid-stats">
        <TxCard class="stat">
          <span class="stat__label">同步模式</span>
          <TxStatusBadge :text="modeText(status.data.value.mode)" :status="MODE_STATUS[status.data.value.mode] ?? 'muted'" />
        </TxCard>
        <TxCard class="stat">
          <span class="stat__label">连接</span>
          <TxStatusBadge :text="status.data.value.healthy ? '正常' : '连不上'" :status="status.data.value.healthy ? 'success' : 'danger'" />
        </TxCard>
        <TxCard class="stat">
          <span class="stat__label">上次同步</span>
          <span v-if="status.data.value.last_run" class="stat__value" :title="fmtDate(status.data.value.last_run.at)">{{ fmtRelative(status.data.value.last_run.at) }}</span>
          <span v-else class="stat__value muted">还没有</span>
        </TxCard>
        <TxStatCard
          :value="status.data.value.errors_24h"
          label="最近 24 小时出错"
          icon-class="i-carbon-warning"
          clickable
          class="stat stat--link"
          role="link"
          tabindex="0"
          @click="router.push('/console/gitlab/accounts')"
          @keydown.enter="router.push('/console/gitlab/accounts')"
        />
      </div>

      <TxCard>
        <template #header><h2 class="section-title">详情</h2></template>
        <dl class="facts">
          <dt>地址</dt>
          <dd>
            <a v-if="status.data.value.url" class="mono" :href="status.data.value.url" target="_blank" rel="noreferrer">{{ status.data.value.url }}</a>
            <span v-else class="muted">没有配置</span>
          </dd>
          <dt>群组</dt><dd class="mono">{{ status.data.value.group || "-" }}</dd>
          <dt>版本</dt><dd>{{ status.data.value.version ?? "读不到" }}</dd>
          <dt>令牌</dt><dd>{{ status.data.value.token_configured ? "已配置" : "未配置" }}</dd>
          <dt>上次同步</dt>
          <dd v-if="status.data.value.last_run">
            {{ fmtDate(status.data.value.last_run.at) }}，改了 {{ status.data.value.last_run.changed }} 个账号，{{ status.data.value.last_run.failed }} 个失败
          </dd>
          <dd v-else class="muted">还没有同步过</dd>
        </dl>
      </TxCard>
    </template>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.stat--link {
  cursor: pointer;
}
.stat__label {
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.stat__value {
  font-size: 20px;
  font-weight: 600;
}
.facts {
  grid-template-columns: 96px minmax(0, 1fr);
}
.facts a {
  overflow-wrap: anywhere;
}
</style>
