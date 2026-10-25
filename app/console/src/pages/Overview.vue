<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxStatCard } from "@talex-touch/tuffex/stat-card";
import { TxCardItem } from "@talex-touch/tuffex/card-item";
import { TxAvatar } from "@talex-touch/tuffex/avatar";
import { TxTag } from "@talex-touch/tuffex/tag";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { TxSkeleton } from "@talex-touch/tuffex/skeleton";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import PageHeader from "../components/PageHeader.vue";
import TitleBadge from "../components/TitleBadge.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import { api } from "../lib/http";
import { fmtDate, fmtRelative } from "../lib/format";
import { useResource } from "../lib/resource";
import { actionText, actorText, outcomeText, surfaceText } from "../lib/activity";
import { modeText } from "../lib/gitlab";
import { ASSIGNER_TEXT, PROVIDER_TEXT } from "../lib/levels";
import { nodeLabel } from "../lib/permission-nodes";
import { nodesByDomain } from "../lib/permissions";
import { titleTone } from "../lib/users";
import { useSession } from "../lib/session";
import type { ActivityList, Summary } from "../lib/types";

const router = useRouter();
const { me, can } = useSession();
const summary = useResource(() => api<Summary>("/api/console/summary"));
// 接口每页固定 50 条，不认 `limit`（带了整页 400，#274），这里只显示最新的 6 条。
const activity = useResource(() => api<ActivityList>("/api/console/activity"), [], { enabled: () => can("activity.read") });
const recent = computed(() => activity.data.value?.items.slice(0, 6) ?? []);

const held = computed(() => (me.value?.permissions ?? []).filter(id => id !== "console.access"));
/** 按业务域列出我持有的权限节点；没有节点的域不列。 */
const domains = computed(() => nodesByDomain(held.value));

type Stat = { label: string; value: number; meta: string; to: string; icon: string };
const stats = computed<Stat[]>(() => {
  const s = summary.data.value;
  if (!s) return [];
  const list: Stat[] = [];
  if (s.applications) {
    list.push({ label: "待处理投递", value: s.applications.by_status.received ?? 0, meta: `共 ${s.applications.total} 份，近 7 天 ${s.applications.last_7d} 份`, to: "/console/applications?status=received", icon: "i-carbon-document-attachment" });
  }
  if (s.candidates_pending !== undefined) list.push({ label: "待确认贡献", value: s.candidates_pending, meta: "比赛里等人确认的积分", to: "/console/competitions", icon: "i-carbon-trophy" });
  if (s.registrations_today !== undefined) list.push({ label: "今天新注册", value: s.registrations_today, meta: "北京时间今天", to: "/console/users", icon: "i-carbon-user-follow" });
  if (s.blocked_today !== undefined) list.push({ label: "今天被拦下", value: s.blocked_today, meta: "被限流的请求", to: "/console/activity?outcome=limited", icon: "i-carbon-security" });
  return list;
});
const gitlabStat = computed(() => summary.data.value?.gitlab ?? null);
</script>

<template>
  <div v-if="me" class="page">
    <PageHeader title="概览" description="你的身份、能做的事，以及需要你处理的数量。" />

    <TxCard>
      <div class="identity">
        <TxAvatar :src="me.avatar_url ?? undefined" :name="me.display_name || me.username" :size="52" />
        <div class="identity__text">
          <span class="identity__name ellipsis">{{ me.display_name || me.username }}</span>
          <span class="mono muted ellipsis">@{{ me.username }}</span>
          <div v-if="me.titles.length" class="tags">
            <TitleBadge v-for="title in me.titles" :key="title.id" :label="title.name" :tone="titleTone(title, me.department)" />
          </div>
        </div>
        <dl class="identity__facts">
          <div><dt>身份</dt><dd>{{ me.level_name }}</dd></div>
          <div><dt>部门</dt><dd>{{ me.department && me.department.id !== "dept.none" ? me.department.name : "无部门" }}</dd></div>
          <div><dt>这次登录</dt><dd>{{ PROVIDER_TEXT[me.provider] ?? me.provider }}</dd></div>
          <div><dt>权限</dt><dd>{{ held.length }} 项</dd></div>
        </dl>
      </div>
    </TxCard>

    <ErrorPanel v-if="summary.error.value" :error="summary.error.value" :retry="summary.reload" size="small" />
    <div v-else-if="summary.loading.value && !summary.data.value" class="grid-stats">
      <TxCard v-for="n in 3" :key="n"><TxSkeleton :loading="true" :lines="3" :height="14" /></TxCard>
    </div>
    <div v-else-if="stats.length || gitlabStat" class="grid-stats">
      <TxStatCard
        v-for="stat in stats"
        :key="stat.label"
        :value="stat.value"
        :label="stat.label"
        :icon-class="stat.icon"
        clickable
        class="stat"
        role="link"
        tabindex="0"
        @click="router.push(stat.to)"
        @keydown.enter="router.push(stat.to)"
      >
        <template #label>
          <span class="stat__label">{{ stat.label }}</span>
          <span class="stat__meta">{{ stat.meta }}</span>
        </template>
      </TxStatCard>
      <TxCard v-if="gitlabStat" class="stat gitlab-stat" role="link" tabindex="0" @click="router.push('/console/gitlab')" @keydown.enter="router.push('/console/gitlab')">
        <div class="gitlab-stat__head">
          <span class="stat__label">GitLab 同步</span>
          <TxStatusBadge :text="gitlabStat.healthy ? '连接正常' : '连不上'" :status="gitlabStat.healthy ? 'success' : 'danger'" size="sm" />
        </div>
        <span class="stat__meta">同步{{ modeText(gitlabStat.mode) }}{{ gitlabStat.last_run ? ` · 上次同步 ${fmtRelative(gitlabStat.last_run.at)}` : "" }}</span>
      </TxCard>
    </div>

    <div class="grid-2">
      <TxCard>
        <template #header>
          <div class="card-head">
            <h2 class="section-title">你能做的事</h2>
            <span class="count">{{ held.length }} 项</span>
          </div>
        </template>
        <div v-if="domains.length" class="domains">
          <section v-for="domain in domains" :key="domain.id" class="domain">
            <h3>{{ domain.label }}</h3>
            <div class="tags">
              <TxTag v-for="node in domain.nodes" :key="node" :label="nodeLabel(node)" variant="soft" size="sm" />
            </div>
          </section>
        </div>
        <p class="domain__note">需要更多权限，请联系{{ ASSIGNER_TEXT }}。</p>
      </TxCard>

      <TxCard v-if="can('activity.read')">
        <template #header>
          <div class="card-head">
            <h2 class="section-title">最近操作</h2>
            <div class="card-head__actions">
              <TxButton variant="ghost" size="sm" @click="router.push('/console/activity')">查看全部</TxButton>
            </div>
          </div>
        </template>
        <ErrorPanel v-if="activity.error.value" :error="activity.error.value" :retry="activity.reload" size="small" />
        <TxSkeleton v-else-if="!activity.data.value" :loading="true" :lines="5" />
        <TxEmptyState v-else-if="!recent.length" title="还没有记录" description="登录、发帖、投递和控制台里的操作会记在这里。" size="small" />
        <div v-else class="recent">
          <TxCardItem
            v-for="row in recent"
            :key="row.id"
            :title="actorText(row).text"
            :avatar-text="actorText(row).text.slice(0, 1)"
            :avatar-size="28"
          >
            <template #subtitle>
              <span class="recent__action">{{ actionText(row.action) || row.action }}</span>
              <span class="muted recent__surface">{{ surfaceText(row.surface) }} · {{ outcomeText(row.outcome) }}</span>
            </template>
            <template #right>
              <span class="muted recent__time" :title="fmtDate(row.at)">{{ fmtRelative(row.at) }}</span>
            </template>
          </TxCardItem>
        </div>
      </TxCard>
    </div>
  </div>
</template>

<style scoped>
.identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 24px;
}
.identity__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 260px;
  min-width: 0;
}
.identity__name {
  font-size: 18px;
  font-weight: 600;
  color: var(--tx-text-color-primary);
}
.identity__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, auto));
  gap: 8px 28px;
  margin: 0;
  min-width: 0;
}
.identity__facts dt {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.identity__facts dd {
  margin: 2px 0 0;
  max-width: 260px;
  font-weight: 500;
}
.stat {
  cursor: pointer;
}
.stat__label {
  display: block;
}
.stat__meta {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--tx-text-color-secondary);
}
.gitlab-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
}
.gitlab-stat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.domains {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.domain h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-text-color-regular);
}
.domain__note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.recent {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.recent__action {
  color: var(--tx-color-primary);
}
.recent__surface {
  margin-left: 8px;
}
.recent__time {
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 900px) {
  .identity__facts {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    width: 100%;
  }
}
</style>
