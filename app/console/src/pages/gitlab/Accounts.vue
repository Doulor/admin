<script setup lang="ts">
import { computed, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxFilterChips } from "@talex-touch/tuffex/filter-chips";
import { TxSearchInput } from "@talex-touch/tuffex/search-input";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import PageHeader from "../../components/PageHeader.vue";
import UserCell from "../../components/UserCell.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api } from "../../lib/http";
import { fmtDate, fmtRelative } from "../../lib/format";
import { canSyncNow, errorText, gitlabNote, pendingText, profileUrl, stateText, usernameOf } from "../../lib/gitlab";
import { useAction, useResource } from "../../lib/resource";
import { useSession } from "../../lib/session";
import type { GitlabAccount, GitlabAccountsResponse, GitlabSyncOutcome } from "../../lib/types";

/** 账号同步（#270）：每个极客班账号在 GitLab 上的用户名、组权限、还要做的事和最后一次失败；出错或有事没做完的可以单独重试。 */
const { can } = useSession();
const canSync = computed(() => can("gitlab.sync"));
const gitlab = useResource(() => api<GitlabAccountsResponse>("/api/console/gitlab/accounts"));

type Row = {
  id: string; account: GitlabAccount; link: string | null; username: string | null;
  state: string; pending: string; error: string; errorAt: string | undefined; syncable: boolean;
};
const rows = computed<Row[]>(() => {
  const data = gitlab.data.value;
  if (!data) return [];
  return data.accounts.map(account => ({
    id: account.account_id,
    account,
    link: profileUrl(data, account),
    username: usernameOf(account),
    state: stateText(account),
    pending: pendingText(data.mode, account.pending),
    error: account.last_error ? errorText(account.last_error) : "",
    errorAt: account.last_error_at ? fmtDate(account.last_error_at) : undefined,
    syncable: canSync.value && canSyncNow(data, account),
  }));
});
const note = computed(() => (gitlab.data.value ? gitlabNote(gitlab.data.value) : ""));

type View = "" | "failed" | "pending";
const view = ref<View>("");
const q = ref("");
const chips = computed(() => [
  { value: "", label: "全部", count: rows.value.length },
  { value: "failed", label: "出错的", count: rows.value.filter(row => row.error).length },
  { value: "pending", label: "还有事要做", count: rows.value.filter(row => row.pending).length },
]);
const shown = computed(() => {
  const text = q.value.trim().toLowerCase();
  return rows.value.filter(row =>
    (!view.value || (view.value === "failed" ? Boolean(row.error) : Boolean(row.pending)))
    && (!text || [row.account.login, row.username ?? ""].some(value => value.toLowerCase().includes(text))));
});

const resync = useAction(async (account: GitlabAccount) => {
  const outcome = await api<GitlabSyncOutcome>(`/api/console/gitlab/accounts/${encodeURIComponent(account.account_id)}/resync`, { method: "POST" });
  if (outcome.error) toast({ title: "GitLab 同步没成功", description: `@${account.login} · ${errorText(outcome.error)}`, variant: "warning" });
  else toast({ title: outcome.applied ? "已同步到 GitLab" : "GitLab 上没有要改的", description: `@${account.login}`, variant: "success" });
  await gitlab.reload();
});
const busy = ref<string | null>(null);
async function run(account: GitlabAccount) {
  busy.value = account.account_id;
  await resync.execute(account);
  busy.value = null;
}

const columns = computed(() => [
  { key: "login", title: "极客班账号", width: 200 },
  { key: "gitlab", title: "GitLab 账号", width: 220 },
  { key: "todo", title: "还要做的事", width: 240 },
  { key: "synced", title: "上次同步", width: 112 },
  ...(canSync.value ? [{ key: "actions", title: "操作", width: 112, align: "right" as const }] : []),
]);
</script>

<template>
  <div class="page">
    <PageHeader title="账号同步" description="极客班账号在 GitLab 上的用户名和组权限。后台按设置里的间隔自动同步；出错或还有事没做完的账号可以单独重试。" />
    <ErrorAlert v-if="resync.error.value" :error="resync.error.value" @close="resync.reset()" />

    <ErrorPanel v-if="gitlab.error.value" :error="gitlab.error.value" :retry="gitlab.reload" />
    <LoadingBlock v-else-if="!gitlab.data.value" :lines="8" />
    <template v-else>
      <p v-if="note" class="page-note">{{ note }}</p>
      <div class="toolbar">
        <TxFilterChips v-model="view" :items="chips" aria-label="按同步状态筛选" />
        <form role="search" class="toolbar__end search" @submit.prevent>
          <TxSearchInput v-model="q" placeholder="搜索用户名" @clear="q = ''" />
        </form>
      </div>
      <TxCard :padding="0">
        <TxDataTable class="table-wide" :style="{ '--table-min': canSync ? '884px' : '772px' }" :columns="columns" :data="shown" row-key="id" table-layout="fixed" scroll-x :loading="gitlab.loading.value">
          <template #cell-login="{ row }: { row: Row }">
            <UserCell :login="row.account.login" />
          </template>
          <template #cell-gitlab="{ row }: { row: Row }">
            <span class="cell-stack">
              <a v-if="row.link" class="mono ellipsis" :href="row.link" target="_blank" rel="noreferrer">@{{ row.username }}</a>
              <span v-else-if="row.username" class="mono ellipsis">@{{ row.username }}</span>
              <span v-if="row.state" :class="row.username ? 'cell-sub' : 'muted'">{{ row.state }}</span>
            </span>
          </template>
          <template #cell-todo="{ row }: { row: Row }">
            <span class="cell-stack">
              <span v-if="row.error" class="cell-sub danger-text" :title="row.errorAt ? `${row.errorAt} 失败` : undefined">{{ row.error }}</span>
              <span v-if="row.pending" class="cell-sub clamp-2">{{ row.pending }}</span>
              <span v-if="!row.error && !row.pending" class="muted">-</span>
            </span>
          </template>
          <template #cell-synced="{ row }: { row: Row }">
            <span v-if="row.account.synced_at" class="muted" :title="fmtDate(row.account.synced_at)">{{ fmtRelative(row.account.synced_at) }}</span>
            <span v-else class="muted">还没同步过</span>
          </template>
          <template #cell-actions="{ row }: { row: Row }">
            <TxButton
              v-if="row.syncable"
              variant="secondary"
              size="sm"
              :aria-label="`重新把 @${row.account.login} 同步到 GitLab`"
              :loading="busy === row.account.account_id"
              :disabled="busy !== null && busy !== row.account.account_id"
              @click="run(row.account)"
            >
              {{ row.error ? "重试" : "立即同步" }}
            </TxButton>
          </template>
          <template #empty>
            <TxEmptyState
              :variant="view || q ? 'search-empty' : 'no-data'"
              :title="view || q ? '没有符合条件的账号' : '还没有账号'"
              :description="view || q ? '换一个筛选条件再试。' : '有人注册极客班账号后会出现在这里。'"
              size="small"
            />
          </template>
        </TxDataTable>
        <!-- 窄屏一个账号一张卡；宽屏只显示上面的表格。 -->
        <ul class="row-cards" :aria-busy="gitlab.loading.value || undefined">
          <li v-for="row in shown" :key="row.id">
            <div class="row-card__head">
              <UserCell :login="row.account.login" />
              <span v-if="row.account.synced_at" class="cell-sub" :title="fmtDate(row.account.synced_at)">{{ fmtRelative(row.account.synced_at) }}同步</span>
              <span v-else class="cell-sub">还没同步过</span>
            </div>
            <div class="row-card__lines">
              <span class="row-card__line">
                <span class="muted">GitLab</span>
                <a v-if="row.link" class="mono" :href="row.link" target="_blank" rel="noreferrer">@{{ row.username }}</a>
                <span v-else-if="row.username" class="mono">@{{ row.username }}</span>
                <span v-if="row.state" :class="row.username ? 'cell-sub' : 'muted'">{{ row.state }}</span>
              </span>
              <span v-if="row.error" class="cell-sub danger-text" :title="row.errorAt ? `${row.errorAt} 失败` : undefined">{{ row.error }}</span>
              <span v-if="row.pending" class="cell-sub">{{ row.pending }}</span>
            </div>
            <div v-if="row.syncable" class="row-card__actions">
              <TxButton
                variant="secondary"
                size="sm"
                :aria-label="`重新把 @${row.account.login} 同步到 GitLab`"
                :loading="busy === row.account.account_id"
                :disabled="busy !== null && busy !== row.account.account_id"
                @click="run(row.account)"
              >
                {{ row.error ? "重试" : "立即同步" }}
              </TxButton>
            </div>
          </li>
          <li v-if="!shown.length">
            <TxEmptyState
              :variant="view || q ? 'search-empty' : 'no-data'"
              :title="view || q ? '没有符合条件的账号' : '还没有账号'"
              :description="view || q ? '换一个筛选条件再试。' : '有人注册极客班账号后会出现在这里。'"
              size="small"
            />
          </li>
        </ul>
      </TxCard>
    </template>
  </div>
</template>

<style scoped>
.page-note {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.search {
  width: min(260px, 100%);
}
.danger-text {
  color: var(--tx-color-danger);
}
:deep(td button) {
  min-height: 44px;
  min-width: 44px;
}
@media (max-width: 900px) {
  .search {
    width: 100%;
    margin-left: 0;
  }
}
</style>
