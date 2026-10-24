<script setup lang="ts">
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxTooltip } from "@talex-touch/tuffex/tooltip";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import PageHeader from "../components/PageHeader.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import { api } from "../lib/http";
import { isMock } from "../lib/runtime";
import { fmtDate } from "../lib/format";
import { OUTCOME_STATUS, OUTCOME_TEXT } from "../lib/activity";
import { useResource } from "../lib/resource";
import { useSession } from "../lib/session";
import type { ActivityList } from "../lib/types";

/**
 * 一键系统备份（#282，所有者 2026-10-24 22:22：论坛和所有数据要能一键导出下载，方便挂了或搬迁时恢复）。
 * 下载走普通的 `<a download>` 浏览器下载（和「用户 → 操作记录 → 导出 CSV」同一种做法），同源 cookie
 * 自动带上，不用自己拼 fetch；浏览器自己的下载进度条就是这次下载的进度。
 */
const { can } = useSession();

const records = useResource(
  () => api<ActivityList>("/api/console/activity?action=system.backup.export"),
  [],
  { enabled: () => can("activity.read") },
);

const columns = [
  { key: "at", title: "时间", width: 170 },
  { key: "who", title: "发起人", minWidth: 140 },
  { key: "outcome", title: "结果", width: 90 },
  { key: "summary", title: "归档内容", minWidth: 220 },
];
</script>

<template>
  <div class="page">
    <PageHeader title="备份" description="导出整个系统当前的数据快照，方便原来的服务器坏了或者要搬到新机器时恢复。">
      <template #actions>
        <TxTooltip v-if="isMock()" content="开发预览不能导出，请连接本地后端">
          <TxButton icon="i-carbon-data-backup" disabled>下载完整备份</TxButton>
        </TxTooltip>
        <a v-else href="/api/console/backup" download class="backup-download-link">
          <TxButton icon="i-carbon-data-backup" tabindex="-1">下载完整备份</TxButton>
        </a>
      </template>
    </PageHeader>

    <TxCard class="backup-scope">
      <h2 class="section-title">这份备份里有什么</h2>
      <div class="scope-grid">
        <div>
          <h3>包含</h3>
          <ul>
            <li>全部账号、密码、权限、部门与称号</li>
            <li>论坛的话题、回复、点赞、收藏、关注、表情包与头像</li>
            <li>招新投递、意见箱、比赛报名与积分、操作记录</li>
            <li>已发布的比赛官网文件</li>
          </ul>
        </div>
        <div>
          <h3>不包含</h3>
          <ul>
            <li>登录中的会话、命令行设备授权、对外登录（OIDC）的临时授权与令牌——到新环境都要重新登录</li>
            <li>邮箱验证码与各种限流计数——都是几分钟到几天就失效的数据</li>
            <li>任何密钥：数据库密码哈希之外的真实密钥永远不会写进去</li>
          </ul>
        </div>
      </div>
      <p class="scope-note">下载下来是一个 .tar.gz 文件，打开能看到 manifest.json（版本、表行数、每个文件的校验和要恢复到的环境变量名单）、data.db（数据库快照）和 sites（比赛官网文件）。恢复时在新环境运行 scripts/backup-restore.mjs，完整步骤见仓库的 docs/ops/BACKUP.md。</p>
    </TxCard>

    <TxCard v-if="can('activity.read')" :padding="0" class="backup-records">
      <h2 class="section-title with-padding">最近的备份记录</h2>
      <ErrorPanel v-if="records.error.value" :error="records.error.value" :retry="records.reload" />
      <LoadingBlock v-else-if="!records.data.value" :lines="3" />
      <TxDataTable v-else :columns="columns" :data="records.data.value.items" row-key="id" table-layout="fixed">
        <template #cell-at="{ row }: { row: ActivityList['items'][number] }">{{ fmtDate(row.at) }}</template>
        <template #cell-who="{ row }: { row: ActivityList['items'][number] }">{{ row.account?.display_name || row.account?.username || "系统" }}</template>
        <template #cell-outcome="{ row }: { row: ActivityList['items'][number] }">
          <TxStatusBadge :text="OUTCOME_TEXT[row.outcome]" :status="OUTCOME_STATUS[row.outcome]" size="sm" />
        </template>
        <template #cell-summary="{ row }: { row: ActivityList['items'][number] }">
          {{ typeof row.meta.files === "number" ? `${row.meta.files} 个文件、${row.meta.tables} 张表` : "没有记下归档内容" }}
        </template>
        <template #empty><TxEmptyState title="还没有导出过备份" description="点右上角的「下载完整备份」导出第一份。" size="small" /></template>
      </TxDataTable>
    </TxCard>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 12px;
}
.section-title.with-padding {
  padding: 16px 16px 0;
}
.scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.scope-grid h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 6px;
}
.scope-grid ul {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.875rem;
  color: var(--tx-text-color-secondary);
}
.scope-note {
  margin: 16px 0 0;
  font-size: 0.8125rem;
  color: var(--tx-text-color-secondary);
}
.backup-records {
  margin-top: 16px;
}
.backup-download-link :deep(button) {
  min-height: 44px;
}
</style>
