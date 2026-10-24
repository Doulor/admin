<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxFilterChips } from "@talex-touch/tuffex/filter-chips";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxCellLink } from "@talex-touch/tuffex/cell-link";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxTooltip } from "@talex-touch/tuffex/tooltip";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { TxDrawer } from "@talex-touch/tuffex/drawer";
import { toast } from "@talex-touch/tuffex/utils";
import DateField from "../components/DateField.vue";
import PageHeader from "../components/PageHeader.vue";
import AccountPicker from "../components/AccountPicker.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import { api } from "../lib/http";
import { fmtDate, fmtRelative } from "../lib/format";
import { isMock } from "../lib/runtime";
import { useResource } from "../lib/resource";
import { useSession } from "../lib/session";
import {
  ACTIVITY_OUTCOMES, ACTIVITY_SURFACES, OUTCOME_STATUS, OUTCOME_TEXT, SURFACE_TEXT, actionText, activityParams, actorText, bucketText,
  filtersFromQuery, filtersToQuery, outcomeText, rangeProblem, surfaceText, targetText, type ActivityFilters,
} from "../lib/activity";
import type { ActivityEvent, ActivityList } from "../lib/types";

const route = useRoute();
const router = useRouter();
const { can } = useSession();

const filters = computed(() => filtersFromQuery(route.query));
const draft = reactive<ActivityFilters>({ ...filters.value });
watch(filters, value => Object.assign(draft, value));
const problem = ref<string | null>(null);

function apply(next: Partial<ActivityFilters>) {
  const merged = { ...filters.value, ...next };
  problem.value = rangeProblem(merged);
  if (problem.value) return;
  void router.replace({ query: filtersToQuery(merged) });
}
// 文字和日期改完点「筛选」才生效；账号、来源、结果选了就生效。
const submit = () => apply({ visitor: draft.visitor.trim(), action: draft.action.trim(), from: draft.from, to: draft.to });
const clearAll = () => { problem.value = null; void router.replace({ query: {} }); };
const filtered = computed(() => Object.values(filters.value).some(Boolean));

const list = useResource(() => api<ActivityList>(`/api/console/activity?${activityParams(filters.value, { limit: 50 })}`), [filters]);
const extra = shallowRef<ActivityEvent[]>([]);
const nextCursor = ref<string | null>(null);
const more = ref<{ pending: boolean; error: unknown }>({ pending: false, error: null });
watch(() => list.data.value, data => {
  extra.value = [];
  nextCursor.value = data?.next_cursor ?? null;
});
const rows = computed(() => [...(list.data.value?.items ?? []), ...extra.value]);
async function loadMore() {
  if (!nextCursor.value || more.value.pending) return;
  more.value = { pending: true, error: null };
  try {
    const data = await api<ActivityList>(`/api/console/activity?${activityParams(filters.value, { cursor: nextCursor.value, limit: 50 })}`);
    extra.value = [...extra.value, ...data.items];
    nextCursor.value = data.next_cursor;
    more.value = { pending: false, error: null };
  } catch (error) {
    more.value = { pending: false, error };
  }
}

const blocked = computed(() => [...(list.data.value?.blocked_today ?? [])].sort((a, b) => b.count - a.count));
const blockedTotal = computed(() => blocked.value.reduce((sum, item) => sum + item.count, 0));

const surfaceChips = [{ value: "", label: "全部来源" }, ...ACTIVITY_SURFACES.map(id => ({ value: id, label: SURFACE_TEXT[id] }))];
const outcomeChips = [{ value: "", label: "全部结果" }, ...ACTIVITY_OUTCOMES.map(id => ({ value: id, label: OUTCOME_TEXT[id] }))];

/** 地址栏只带了账号编号：从读到的记录里找这个人的名字给选择框。 */
const accountText = computed(() => {
  const hit = rows.value.find(row => row.account?.id === filters.value.account)?.account;
  return hit ? `${hit.display_name || hit.username} @${hit.username}` : "";
});

const columns = [
  { key: "at", title: "时间", width: 112 },
  { key: "who", title: "谁", width: 180 },
  { key: "surface", title: "来源", width: 80 },
  { key: "action", title: "动作", width: 220, align: "left" as const },
  { key: "target", title: "目标", width: 160 },
  { key: "outcome", title: "结果", width: 80 },
  { key: "ip", title: "IP", width: 130 },
];
const exportHref = computed(() => `/api/console/activity.csv?${activityParams(filters.value)}`);

const open = ref<ActivityEvent | null>(null);
const drawerOpen = computed({ get: () => open.value !== null, set: value => { if (!value) open.value = null; } });
const metaText = (event: ActivityEvent) => JSON.stringify(event.meta ?? {}, null, 2);
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "已复制", variant: "success" });
  } catch {
    toast({ title: "没能复制，请手动选中", variant: "warning" });
  }
}
</script>

<template>
  <div class="page">
    <PageHeader title="操作记录" description="官网、论坛、控制台和命令行上的操作，以及被拒绝、被限流的请求。记录保留 180 天，IP 保留 90 天。">
      <template v-if="can('activity.export')" #actions>
        <TxTooltip v-if="isMock()" content="开发预览不能导出，请连接本地后端">
          <TxButton icon="i-carbon-download" disabled>导出 CSV</TxButton>
        </TxTooltip>
        <a v-else :href="exportHref" download class="export-link">
          <TxButton icon="i-carbon-download" tabindex="-1">导出 CSV</TxButton>
        </a>
      </template>
    </PageHeader>

    <TxCard v-if="list.data.value" class="blocked">
      <div class="card-head">
        <h2 class="section-title">今天被拦下 {{ blockedTotal }} 次</h2>
        <span class="card-head__actions">
          <TxButton v-if="blockedTotal && filters.outcome !== 'limited'" size="sm" variant="ghost" @click="apply({ outcome: 'limited' })">只看被限流的</TxButton>
        </span>
      </div>
      <ul v-if="blocked.length" class="buckets">
        <li v-for="item in blocked" :key="item.bucket" class="bucket">
          <span class="bucket__count">{{ item.count }}</span>
          <span class="cell-stack">
            <span>{{ bucketText(item.bucket) || item.bucket }}</span>
            <span v-if="bucketText(item.bucket)" class="cell-sub mono">{{ item.bucket }}</span>
          </span>
        </li>
      </ul>
      <p v-else class="muted note">今天还没有请求被限流。北京时间零点重新计数。</p>
    </TxCard>

    <TxCard>
      <TxForm :model="draft" label-position="top" class="filters" @submit="submit">
        <div class="filter-grid">
          <TxFormItem label="账号">
            <AccountPicker v-if="can('users.view')" :model-value="filters.account" :initial-text="accountText" label="账号" @update:model-value="value => apply({ account: value })" />
            <TxInput v-else v-model="draft.account" class="fill-width mono" placeholder="账号编号" spellcheck="false" autocomplete="off" @keydown.enter.prevent="apply({ account: draft.account.trim() })" @blur="apply({ account: draft.account.trim() })" />
          </TxFormItem>
          <TxFormItem label="访客编号">
            <TxInput v-model="draft.visitor" class="fill-width mono" placeholder="访客编号" spellcheck="false" autocomplete="off" />
          </TxFormItem>
          <TxFormItem label="动作前缀">
            <TxInput v-model="draft.action" class="fill-width mono" placeholder="例如 auth. 或 forum.topic" spellcheck="false" autocomplete="off" />
          </TxFormItem>
          <TxFormItem label="开始日期">
            <DateField v-model="draft.from" clearable />
          </TxFormItem>
          <TxFormItem label="结束日期">
            <DateField v-model="draft.to" clearable />
          </TxFormItem>
          <div class="filter-actions">
            <TxButton variant="primary" native-type="submit" icon="i-carbon-filter">筛选</TxButton>
            <TxButton v-if="filtered" variant="secondary" native-type="button" @click="clearAll">清空</TxButton>
          </div>
        </div>
        <p v-if="problem" class="field-error" role="alert">{{ problem }}</p>
      </TxForm>
      <div class="chips">
        <TxFilterChips :model-value="filters.surface" :items="surfaceChips" aria-label="按来源筛选" @update:model-value="value => apply({ surface: String(value) })" />
        <TxFilterChips :model-value="filters.outcome" :items="outcomeChips" aria-label="按结果筛选" @update:model-value="value => apply({ outcome: String(value) })" />
      </div>
    </TxCard>

    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="8" />
    <TxCard v-else :padding="0" class="table-card">
      <TxDataTable
        style="--table-min: 962px"
        :columns="columns"
        :data="rows"
        row-key="id"
        table-layout="fixed"
        scroll-x
        :loading="list.loading.value"
        @row-click="({ row }: { row: ActivityEvent }) => (open = row)"
      >
        <template #cell-at="{ row }: { row: ActivityEvent }">
          <span class="muted" :title="fmtDate(row.at)">{{ fmtRelative(row.at) }}</span>
        </template>
        <template #cell-who="{ row }: { row: ActivityEvent }">
          <span class="cell-stack">
            <template v-if="row.account">
              <TxCellLink
                :href="`/console/activity?account=${encodeURIComponent(row.account.id)}`"
                :label="actorText(row).text"
                :aria-label="`只看 ${actorText(row).text} 的记录`"
                class="ellipsis"
                @open="apply({ account: row.account.id })"
              />
              <span class="cell-sub mono ellipsis">@{{ row.account.username }}</span>
            </template>
            <span v-else class="muted ellipsis" :class="{ mono: row.visitor_id }">{{ actorText(row).text }}</span>
          </span>
        </template>
        <template #cell-surface="{ row }: { row: ActivityEvent }">{{ surfaceText(row.surface) }}</template>
        <template #cell-action="{ row }: { row: ActivityEvent }">
          <span class="cell-stack">
            <span v-if="actionText(row.action)" class="ellipsis">{{ actionText(row.action) }}</span>
            <span class="mono ellipsis" :class="{ 'cell-sub': actionText(row.action) }" :title="row.action">{{ row.action }}</span>
          </span>
        </template>
        <template #cell-target="{ row }: { row: ActivityEvent }">
          <span v-if="targetText(row)" class="mono ellipsis cell-sub" :title="targetText(row)">{{ targetText(row) }}</span>
          <span v-else class="muted">-</span>
        </template>
        <template #cell-outcome="{ row }: { row: ActivityEvent }">
          <TxStatusBadge :text="outcomeText(row.outcome)" :status="OUTCOME_STATUS[row.outcome] ?? 'muted'" size="sm" />
        </template>
        <template #cell-ip="{ row }: { row: ActivityEvent }">
          <span class="mono ellipsis cell-sub">{{ row.ip ?? "-" }}</span>
        </template>
        <template #empty>
          <TxEmptyState
            :variant="filtered ? 'search-empty' : 'no-data'"
            :title="filtered ? '没有符合条件的记录' : '还没有记录'"
            :description="filtered ? '换一个筛选条件，或者点「清空」看全部。' : '有人登录、发帖或在控制台里操作后会记在这里。'"
            size="small"
          />
        </template>
      </TxDataTable>
      <div v-if="nextCursor || more.error" class="pager">
        <span v-if="more.error" class="pager__error">没有读到更多，点按钮再试一次。</span>
        <TxButton variant="secondary" :loading="more.pending" @click="loadMore">加载更多</TxButton>
      </div>
    </TxCard>

    <TxDrawer v-model:visible="drawerOpen" title="记录详情" direction="right" size="min(520px, 100vw)" :mobile-adapt="false" :show-footer="false">
      <div v-if="open" class="detail">
        <dl class="facts">
          <dt>时间</dt><dd>{{ fmtDate(open.at) }}</dd>
          <dt>谁</dt>
          <dd>
            <template v-if="open.account">{{ actorText(open).text }} <span class="mono muted">@{{ open.account.username }}</span></template>
            <template v-else>{{ actorText(open).text }}</template>
          </dd>
          <template v-if="open.visitor_id"><dt>访客编号</dt><dd class="mono">{{ open.visitor_id }}</dd></template>
          <dt>来源</dt><dd>{{ surfaceText(open.surface) }}</dd>
          <dt>动作</dt><dd><span v-if="actionText(open.action)">{{ actionText(open.action) }} </span><span class="mono">{{ open.action }}</span></dd>
          <dt>目标</dt><dd class="mono">{{ targetText(open) || "-" }}</dd>
          <dt>结果</dt><dd><TxStatusBadge :text="outcomeText(open.outcome)" :status="OUTCOME_STATUS[open.outcome] ?? 'muted'" size="sm" /></dd>
          <dt>IP</dt><dd class="mono">{{ open.ip ?? "-" }}</dd>
          <dt>浏览器</dt><dd class="ua">{{ open.ua ?? "-" }}</dd>
          <template v-if="open.request_id">
            <dt>请求编号</dt>
            <dd class="request">
              <span class="mono">{{ open.request_id }}</span>
              <TxButton size="sm" variant="ghost" icon="i-carbon-copy" :aria-label="`复制请求编号 ${open.request_id}`" @click="copy(open.request_id)" />
            </dd>
          </template>
        </dl>
        <section v-if="Object.keys(open.meta ?? {}).length" class="meta">
          <h3 class="section-title">附加信息</h3>
          <pre class="pre">{{ metaText(open) }}</pre>
        </section>
        <div class="detail__links">
          <TxButton v-if="open.account" variant="secondary" @click="apply({ account: open.account.id }); open = null">只看这个人的记录</TxButton>
          <RouterLink v-if="open.account && can('users.view')" :to="{ path: '/console/users', query: { q: open.account.username } }" class="more-link">打开用户详情</RouterLink>
        </div>
      </div>
    </TxDrawer>
  </div>
</template>

<style scoped>
.export-link {
  text-decoration: none;
}
.blocked .card-head {
  margin-bottom: 10px;
}
.buckets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bucket {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 14px;
}
.bucket__count {
  min-width: 2.5ch;
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tx-color-warning);
}
.note {
  margin: 0;
  font-size: 13px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 16px;
  align-items: end;
}
/* 网格里每一格自己排，不吃 .tx-form--label-top 相邻项的上边距。 */
.filter-grid > :deep(.tx-form-item) {
  margin-top: 0;
}
.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-actions :deep(button),
.pager :deep(button),
.detail__links :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
.filters :deep(.tx-input),
.filters :deep(.tx-date-picker-field) {
  min-height: 44px;
}
.field-error {
  margin: 0;
  font-size: 13px;
  color: var(--tx-color-danger);
}
.chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--tx-border-color-lighter);
}
.table-card :deep(tbody tr) {
  cursor: pointer;
}
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--tx-border-color-lighter);
}
.pager__error {
  font-size: 13px;
  color: var(--tx-color-danger);
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.ua {
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.request {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.more-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 14px;
}
@media (max-width: 1080px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .filter-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .filter-actions {
    padding-bottom: 0;
  }
}
</style>
