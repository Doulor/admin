<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxSearchInput } from "@talex-touch/tuffex/search-input";
import { TxFilterChips } from "@talex-touch/tuffex/filter-chips";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxCellLink } from "@talex-touch/tuffex/cell-link";
import { TxAvatar } from "@talex-touch/tuffex/avatar";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import PageHeader from "../components/PageHeader.vue";
import TitleBadge from "../components/TitleBadge.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import UserDrawer from "./users/UserDrawer.vue";
import { api } from "../lib/http";
import { fmtDate, fmtRelative } from "../lib/format";
import { ASSIGNABLE_LEVELS, GITLAB_STATE_TEXT, LEVEL_TEXT, USER_STATUS_TEXT, levelText } from "../lib/levels";
import { useResource } from "../lib/resource";
import { DEPT_TONE_SWATCH, deptTone } from "../lib/tone";
import { departmentChoices, departmentOf, nameOf, titleTone, userFiltersFromQuery, usersParams } from "../lib/users";
import type { ConsoleUser, GitlabSyncState, PublicDepartmentsResponse, UsersResponse } from "../lib/types";

const route = useRoute();
const router = useRouter();

const departments = useResource(() => api<PublicDepartmentsResponse>("/api/public/departments"));
const filters = computed(() => userFiltersFromQuery(route.query));
const draftQ = ref(filters.value.q);
watch(() => filters.value.q, value => { draftQ.value = value; });

// 抽屉里改过的人：先替换列表里那一行，不用整页重读。
const patched = shallowRef(new Map<string, ConsoleUser>());
watch(filters, () => { patched.value = new Map(); });
// 第一页跟着筛选条件重读；「加载更多」接在后面，筛选一变就从头来。
const list = useResource(() => api<UsersResponse>(`/api/console/users?${usersParams(filters.value)}`), [filters]);
const extra = shallowRef<ConsoleUser[]>([]);
const nextCursor = ref<string | null>(null);
const more = ref<{ pending: boolean; error: unknown }>({ pending: false, error: null });
watch(() => list.data.value, data => {
  extra.value = [];
  nextCursor.value = data?.next_cursor ?? null;
});
const rows = computed(() => {
  const merged = [...(list.data.value?.items ?? []), ...extra.value];
  return merged.map(row => patched.value.get(row.account_id) ?? row);
});
async function loadMore() {
  if (!nextCursor.value || more.value.pending) return;
  more.value = { pending: true, error: null };
  try {
    const data = await api<UsersResponse>(`/api/console/users?${usersParams(filters.value, nextCursor.value)}`);
    extra.value = [...extra.value, ...data.items];
    nextCursor.value = data.next_cursor;
    more.value = { pending: false, error: null };
  } catch (error) {
    more.value = { pending: false, error };
  }
}

function setQuery(next: Record<string, string | undefined>) {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...route.query, ...next })) if (typeof value === "string" && value) merged[key] = value;
  void router.replace({ query: merged });
}
const filtered = computed(() => Boolean(filters.value.q || filters.value.level || filters.value.department || filters.value.status));

const counts = computed(() => list.data.value?.counts);
const levelChips = computed(() => [
  { value: "", label: "全部身份" },
  ...ASSIGNABLE_LEVELS.map(id => ({ value: id, label: LEVEL_TEXT[id], count: counts.value?.[id] })),
]);
const statusChips = [{ value: "", label: "全部状态" }, { value: "active", label: USER_STATUS_TEXT.active }, { value: "disabled", label: USER_STATUS_TEXT.disabled }];
const departmentOptions = computed(() => [
  { value: "", label: "全部部门" },
  ...departmentChoices(departments.data.value?.departments ?? []),
]);

const GITLAB_BADGE: Record<GitlabSyncState, "success" | "warning" | "danger" | "muted"> = {
  synced: "success", pending: "warning", failed: "danger", blocked: "muted", none: "muted",
};

const columns = [
  { key: "user", title: "用户", width: 220 },
  { key: "level", title: "身份", width: 104 },
  { key: "department", title: "部门", width: 112 },
  { key: "titles", title: "称号", width: 150 },
  { key: "gitlab", title: "GitLab", width: 112 },
  { key: "last_login", title: "最近登录", width: 112 },
  { key: "status", title: "状态", width: 88 },
];

const openId = ref<string | null>(null);
const openUser = computed(() => rows.value.find(row => row.account_id === openId.value) ?? null);
function onUpdated(user: ConsoleUser) {
  const next = new Map(patched.value);
  next.set(user.account_id, user);
  patched.value = next;
}
const searchHref = (row: ConsoleUser) => `/console/users?q=${encodeURIComponent(row.username)}`;
</script>

<template>
  <div class="page">
    <PageHeader title="用户" description="所有注册过的账号。点一行打开详情，在里面改身份、部门、称号，或者停用账号。">
      <template v-if="counts" #meta>
        <p class="counts">
          <span>今天来过的访客 {{ counts.visitor_today }}</span>
          <span>注册用户 {{ counts.registered }}</span>
          <span>极客班成员 {{ counts.member }}</span>
          <span>往届成员 {{ counts.alumni }}</span>
        </p>
      </template>
    </PageHeader>

    <div class="toolbar">
      <TxFilterChips :model-value="filters.level" :items="levelChips" aria-label="按身份筛选" @update:model-value="value => setQuery({ level: String(value) || undefined })" />
      <TxFilterChips :model-value="filters.status" :items="statusChips" aria-label="按状态筛选" @update:model-value="value => setQuery({ status: String(value) || undefined })" />
      <div class="toolbar__end">
        <!-- TxSelect 0.6.0 的 attrs 落在外层，用 label 给里面的输入框命名。 -->
        <label class="dept-filter">
          <span class="sr-only">按部门筛选</span>
          <TxSelect :model-value="filters.department" :options="departmentOptions" class="fill-width" @update:model-value="value => setQuery({ department: String(value) || undefined })" />
        </label>
        <form role="search" class="search" @submit.prevent="setQuery({ q: draftQ.trim() || undefined })">
          <TxSearchInput v-model="draftQ" placeholder="搜索用户名或昵称" @search="setQuery({ q: draftQ.trim() || undefined })" @clear="setQuery({ q: undefined })" />
        </form>
      </div>
    </div>

    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="8" />
    <TxCard v-else :padding="0" class="table-card">
      <TxDataTable
        style="--table-min: 900px"
        :columns="columns"
        :data="rows"
        row-key="account_id"
        table-layout="fixed"
        scroll-x
        :loading="list.loading.value"
        @row-click="({ row }: { row: ConsoleUser }) => (openId = row.account_id)"
      >
        <template #cell-user="{ row }: { row: ConsoleUser }">
          <span class="person">
            <TxAvatar :src="row.avatar_url ?? undefined" :name="nameOf(row)" :size="32" />
            <span class="cell-stack">
              <TxCellLink :href="searchHref(row)" :label="nameOf(row)" :aria-label="`打开 ${nameOf(row)} 的详情`" :title="nameOf(row)" class="ellipsis person__name" @open="openId = row.account_id" />
              <span class="cell-sub mono ellipsis">@{{ row.username }}</span>
            </span>
          </span>
        </template>
        <template #cell-level="{ row }: { row: ConsoleUser }">{{ levelText(row.level) }}</template>
        <template #cell-department="{ row }: { row: ConsoleUser }">
          <span v-if="departmentOf(row)" class="dept">
            <span class="dept__dot" :style="{ background: DEPT_TONE_SWATCH[deptTone(departmentOf(row)!.tone)] }" aria-hidden="true" />
            <span class="ellipsis">{{ departmentOf(row)!.name }}</span>
          </span>
          <span v-else class="muted">无部门</span>
        </template>
        <template #cell-titles="{ row }: { row: ConsoleUser }">
          <span v-if="row.titles.length" class="tags">
            <TitleBadge v-for="title in row.titles" :key="title.id" :label="title.name" :tone="titleTone(title, row.department)" />
          </span>
          <span v-else class="muted">-</span>
        </template>
        <template #cell-gitlab="{ row }: { row: ConsoleUser }">
          <TxStatusBadge :text="GITLAB_STATE_TEXT[row.gitlab.state] ?? row.gitlab.state" :status="GITLAB_BADGE[row.gitlab.state] ?? 'muted'" size="sm" />
        </template>
        <template #cell-last_login="{ row }: { row: ConsoleUser }">
          <span v-if="row.last_login_at" class="muted" :title="fmtDate(row.last_login_at)">{{ fmtRelative(row.last_login_at) }}</span>
          <span v-else class="muted">没登录过</span>
        </template>
        <template #cell-status="{ row }: { row: ConsoleUser }">
          <TxStatusBadge :text="USER_STATUS_TEXT[row.status] ?? row.status" :status="row.status === 'active' ? 'success' : 'muted'" size="sm" />
        </template>
        <template #empty>
          <TxEmptyState
            :variant="filtered ? 'search-empty' : 'no-data'"
            :title="filtered ? '没有符合条件的用户' : '还没有人注册'"
            :description="filtered ? '换一个身份、部门或关键词再试。' : '有人注册后会出现在这里。'"
            size="small"
          />
        </template>
      </TxDataTable>
      <div v-if="nextCursor || more.error" class="pager">
        <span v-if="more.error" class="pager__error">没有读到更多，点按钮再试一次。</span>
        <TxButton variant="secondary" :loading="more.pending" @click="loadMore">加载更多</TxButton>
      </div>
    </TxCard>

    <UserDrawer
      :user="openUser"
      :departments="departments.data.value?.departments ?? []"
      @close="openId = null"
      @updated="onUpdated"
    />
  </div>
</template>

<style scoped>
.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.dept-filter {
  display: block;
  width: 150px;
}
.search {
  width: min(260px, 100%);
}
.table-card :deep(tbody tr) {
  cursor: pointer;
}
.person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.person__name {
  max-width: 100%;
  font-weight: 500;
}
.dept {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}
.dept__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
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
.pager :deep(button) {
  min-height: 44px;
}
.pager__error {
  font-size: 13px;
  color: var(--tx-color-danger);
}
@media (max-width: 900px) {
  .toolbar__end {
    margin-left: 0;
    width: 100%;
  }
  .dept-filter,
  .search {
    width: 100%;
  }
}
</style>
