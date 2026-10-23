<script setup lang="ts">
import { computed, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxCopyButton } from "@talex-touch/tuffex/button";
import { TxSearchInput } from "@talex-touch/tuffex/search-input";
import { TxTag } from "@talex-touch/tuffex/tag";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import PageHeader from "../../components/PageHeader.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api } from "../../lib/http";
import { fmtDate, fmtRelative } from "../../lib/format";
import { useResource } from "../../lib/resource";
import type { GitlabProject, GitlabProjectsResponse } from "../../lib/types";

/** 群组与项目：同步群组下的子群组和全部项目，克隆地址可以直接复制。服务端缓存 5 分钟。 */
const data = useResource(() => api<GitlabProjectsResponse>("/api/console/gitlab/projects"));

const VISIBILITY_TEXT: Record<string, string> = { private: "私有", internal: "登录可见", public: "公开" };
const visibilityText = (value: string) => VISIBILITY_TEXT[value] ?? value;

const q = ref("");
const projects = computed(() => {
  const text = q.value.trim().toLowerCase();
  const list = data.data.value?.projects ?? [];
  return text ? list.filter(item => [item.name, item.path_with_namespace, item.description ?? ""].some(value => value.toLowerCase().includes(text))) : list;
});

const columns = [
  { key: "name", title: "项目", width: 260 },
  { key: "visibility", title: "可见性", width: 96 },
  { key: "activity", title: "最近活动", width: 112 },
  { key: "clone", title: "克隆", width: 300 },
];
</script>

<template>
  <div class="page">
    <PageHeader title="群组与项目" description="GitLab 同步群组下的子群组和项目。列表每 5 分钟从 GitLab 读一次。" />

    <ErrorPanel v-if="data.error.value" :error="data.error.value" :retry="data.reload" />
    <LoadingBlock v-else-if="!data.data.value" :lines="8" />
    <template v-else>
      <TxCard v-if="data.data.value.groups.length">
        <template #header><h2 class="section-title">群组</h2></template>
        <ul class="groups">
          <li v-for="group in data.data.value.groups" :key="group.id">
            <span class="mono">{{ group.full_path }}</span>
            <TxTag :label="visibilityText(group.visibility)" variant="outline" size="sm" />
          </li>
        </ul>
      </TxCard>

      <div class="toolbar">
        <h2 class="section-title">项目 {{ data.data.value.projects.length }} 个</h2>
        <form role="search" class="toolbar__end search" @submit.prevent>
          <TxSearchInput v-model="q" placeholder="搜索项目名或路径" @clear="q = ''" />
        </form>
      </div>
      <TxCard :padding="0">
        <TxDataTable style="--table-min: 768px" :columns="columns" :data="projects" row-key="id" table-layout="fixed" scroll-x>
          <template #cell-name="{ row }: { row: GitlabProject }">
            <span class="cell-stack">
              <a class="ellipsis project-name" :href="row.web_url" target="_blank" rel="noreferrer">{{ row.name }}</a>
              <span class="cell-sub mono ellipsis">{{ row.path_with_namespace }}</span>
              <span v-if="row.description" class="cell-sub clamp-2">{{ row.description }}</span>
            </span>
          </template>
          <template #cell-visibility="{ row }: { row: GitlabProject }">{{ visibilityText(row.visibility) }}</template>
          <template #cell-activity="{ row }: { row: GitlabProject }">
            <span v-if="row.last_activity_at" class="muted" :title="fmtDate(row.last_activity_at)">{{ fmtRelative(row.last_activity_at) }}</span>
            <span v-else class="muted">-</span>
          </template>
          <template #cell-clone="{ row }: { row: GitlabProject }">
            <span class="clone">
              <span class="clone__row">
                <span class="clone__kind">HTTPS</span>
                <span class="mono ellipsis clone__url" :title="row.http_url_to_repo">{{ row.http_url_to_repo }}</span>
                <TxCopyButton :text="row.http_url_to_repo" copy-label="复制" copied-label="已复制" />
              </span>
              <span class="clone__row">
                <span class="clone__kind">SSH</span>
                <span class="mono ellipsis clone__url" :title="row.ssh_url_to_repo">{{ row.ssh_url_to_repo }}</span>
                <TxCopyButton :text="row.ssh_url_to_repo" copy-label="复制" copied-label="已复制" />
              </span>
            </span>
          </template>
          <template #empty>
            <TxEmptyState
              :variant="q ? 'search-empty' : 'no-data'"
              :title="q ? '没有符合条件的项目' : '群组里还没有项目'"
              :description="q ? '换一个关键词再试。' : '在 GitLab 上建好项目后，最多 5 分钟会出现在这里。'"
              size="small"
            />
          </template>
        </TxDataTable>
      </TxCard>
    </template>
  </div>
</template>

<style scoped>
.groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.groups li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.search {
  width: min(260px, 100%);
}
.project-name {
  font-weight: 500;
}
.clone {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.clone__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.clone__kind {
  flex: none;
  width: 44px;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.clone__url {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}
.clone :deep(button) {
  flex: none;
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
