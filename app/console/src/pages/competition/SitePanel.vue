<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxFileUploader } from "@talex-touch/tuffex/file-uploader";
import { TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api, jsonBody } from "../../lib/http";
import { confirm } from "../../lib/confirm";
import { fmtDate } from "../../lib/format";
import { useAction, useResource } from "../../lib/resource";
import { SLUG_PATTERN, fmtBytes, rejectReport, siteFileError, slugError, versionState } from "../../lib/competition-contest";
import type { SiteState, SiteVersion } from "../../lib/types";

/**
 * 比赛官网（#278）：上传站点包（zip，用 pnpm contest:site pack 打的），服务端逐条校验；通过的版本可以先预览（一小时有效的签名地址），
 * 再发布到 /c/<地址>/。回滚就是发布旧版本；下线后版本和地址都留着。上传、发布、下线都要 competition.site.publish 加刚登录过。
 */
const props = defineProps<{ competitionId: string; canPublish: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const base = computed(() => `/api/console/competitions/${encodeURIComponent(props.competitionId)}/site`);
const site = useResource(() => api<SiteState>(base.value), [() => props.competitionId]);
const slug = ref("");
watch(() => site.data.value, value => {
  if (value && !slug.value) slug.value = value.slug ?? (SLUG_PATTERN.test(props.competitionId) ? props.competitionId : "");
}, { immediate: true });
const slugProblem = ref("");

// —— 上传 ——
type Picked = { id: string; name: string; size: number; type: string; file: File };
const files = ref<Picked[]>([]);
const fileProblem = ref("");
const report = ref<string[] | null>(null);
const upload = useAction(async () => {
  const picked = files.value[0];
  if (!picked) return;
  const problem = siteFileError(picked);
  fileProblem.value = problem ?? "";
  if (problem) return;
  report.value = null;
  try {
    const version = await api<SiteVersion>(`${base.value}/versions`, { method: "POST", body: picked.file, headers: { "Content-Type": "application/zip" } });
    toast({ title: `已上传 ${version.version}，校验通过，可以预览后发布`, variant: "success" });
    files.value = [];
  } catch (error) {
    const lines = rejectReport(error);
    if (!lines) throw error;
    report.value = lines;
    files.value = [];
  } finally {
    await site.reload();
  }
});
watch(files, value => { fileProblem.value = ""; if (value.length) report.value = null; });

// —— 发布、回滚、下线 ——
const publish = useAction(async (version: SiteVersion) => {
  const state = site.data.value;
  const needsSlug = !state?.slug;
  if (needsSlug) {
    const problem = slugError(slug.value);
    slugProblem.value = problem ?? "";
    if (problem) return;
  }
  const rollback = Boolean(state?.live_version_id);
  if (!(await confirm({
    title: rollback ? `把官网换成 ${version.version}？` : `发布 ${version.version}？`,
    body: needsSlug ? `发布后地址是 /c/${slug.value.trim()}/，之后不能改。` : `发布后 /c/${state?.slug}/ 立刻换成这个版本。`,
    confirmText: "发布",
  }))) return;
  const next = await api<SiteState>(`${base.value}/publish`, { method: "POST", ...jsonBody(needsSlug ? { version_id: version.id, slug: slug.value.trim() } : { version_id: version.id }) });
  site.data.value = next;
  toast({ title: `已发布 ${version.version}`, variant: "success" });
  emit("changed");
});
const unpublish = useAction(async () => {
  if (!(await confirm({ title: "下线官网？", body: "下线后 /c/ 地址回 404，门户里的「打开官网」也不再显示。版本和地址都留着，可以再发布。", confirmText: "下线", danger: true }))) return;
  site.data.value = await api<SiteState>(base.value, { method: "DELETE" });
  toast({ title: "官网已下线", variant: "success" });
  emit("changed");
});

const columns = [
  { key: "version", title: "版本", width: 160 },
  { key: "status", title: "状态", width: 96 },
  { key: "size", title: "大小", width: 130 },
  { key: "uploaded_by", title: "上传人", width: 150 },
  { key: "created_at", title: "上传时间（北京时间）", width: 150 },
  { key: "report", title: "校验结果" },
  { key: "actions", title: "操作", width: 170, align: "right" as const },
];
</script>

<template>
  <ErrorPanel v-if="site.error.value" :error="site.error.value" :retry="site.reload" />
  <LoadingBlock v-else-if="!site.data.value" :lines="5" />
  <template v-else>
    <TxCard class="section">
      <div class="section-head">
        <h2>官网</h2>
        <span class="muted">
          <template v-if="site.data.value.site_url">在线：<a :href="site.data.value.site_url" target="_blank" rel="noreferrer" class="mono">{{ site.data.value.site_url }}</a></template>
          <template v-else-if="site.data.value.slug">已下线，地址 /c/{{ site.data.value.slug }}/ 留着。</template>
          <template v-else>还没有发布。</template>
        </span>
        <span v-if="canPublish && site.data.value.live_version_id" class="section-end">
          <TxButton variant="ghost" class="danger-text" :loading="unpublish.pending.value" @click="unpublish.execute()">下线</TxButton>
        </span>
      </div>
      <ErrorAlert v-if="unpublish.error.value" :error="unpublish.error.value" @close="unpublish.reset()" />
      <TxAlert v-if="!canPublish" type="info" title="只能查看">上传和发布官网要「发布官网」权限。</TxAlert>

      <template v-if="canPublish">
        <h3 class="subhead">上传新版本</h3>
        <p class="muted lead">站点包是 zip，最大 20MB、最多 500 个文件，根目录要有 index.html 与 yzgc-site.json；页面只能引用本站的文件。本地先用 pnpm contest:site pack 打包，它跑的是同一套校验。</p>
        <TxFileUploader v-model="files" accept=".zip,application/zip" :max="1" button-text="选择 zip" drop-text="把 zip 拖到这里" hint-text="也可以点下面的按钮选文件" :disabled="upload.pending.value" />
        <span v-if="fileProblem" class="field-error">{{ fileProblem }}</span>
        <TxAlert v-if="report" type="error" title="没通过校验">
          <ul class="report">
            <li v-for="line in report" :key="line">{{ line }}</li>
          </ul>
        </TxAlert>
        <ErrorAlert v-if="upload.error.value" :error="upload.error.value" @close="upload.reset()" />
        <div class="form-actions">
          <TxButton variant="primary" :disabled="!files.length" :loading="upload.pending.value" @click="upload.execute()">上传并校验</TxButton>
        </div>

        <TxFormItem v-if="!site.data.value.slug" label="官网地址（第一次发布时定下，之后不能改）" class="slug">
          <TxInput v-model="slug" class="fill-width" placeholder="oss-challenge-2026-1">
            <template #prefix><span class="mono muted">/c/</span></template>
          </TxInput>
          <span v-if="slugProblem" class="field-error">{{ slugProblem }}</span>
        </TxFormItem>
      </template>
    </TxCard>

    <TxCard class="section">
      <div class="section-head">
        <h2>版本</h2>
        <span class="muted">预览地址一小时内有效；回滚就是发布旧版本。</span>
      </div>
      <ErrorAlert v-if="publish.error.value" :error="publish.error.value" @close="publish.reset()" />
      <TxDataTable style="--table-min: 1020px" :columns="columns" :data="site.data.value.versions" row-key="id" table-layout="fixed" scroll-x>
        <template #cell-version="{ row }: { row: SiteVersion }">
          <span class="cell-stack">
            <b>{{ row.version || "—" }}</b>
            <span class="cell-sub mono ellipsis" :title="row.sha256">{{ row.sha256.slice(0, 12) }}</span>
          </span>
        </template>
        <template #cell-status="{ row }: { row: SiteVersion }">
          <TxStatusBadge :text="versionState(row, site.data.value!.live_version_id).text" :status="versionState(row, site.data.value!.live_version_id).tone" size="sm" />
        </template>
        <template #cell-size="{ row }: { row: SiteVersion }">
          <span class="cell-stack">
            <span>{{ fmtBytes(row.size) }}</span>
            <span class="cell-sub">{{ row.files }} 个文件</span>
          </span>
        </template>
        <template #cell-uploaded_by="{ row }: { row: SiteVersion }">
          <span class="mono ellipsis" :title="`@${row.uploaded_by.username}`">@{{ row.uploaded_by.username }}</span>
        </template>
        <template #cell-created_at="{ row }: { row: SiteVersion }">
          <span class="muted">{{ fmtDate(row.created_at) }}</span>
        </template>
        <template #cell-report="{ row }: { row: SiteVersion }">
          <span v-if="row.report.length" class="clamp-2" :title="row.report.join('\n')">{{ row.report.join("；") }}</span>
          <span v-else class="muted">通过</span>
        </template>
        <template #cell-actions="{ row }: { row: SiteVersion }">
          <span class="row-actions">
            <a v-if="row.preview_url" :href="row.preview_url" target="_blank" rel="noreferrer">预览</a>
            <TxButton v-if="canPublish && row.status === 'passed' && row.id !== site.data.value!.live_version_id" size="sm" variant="ghost" :disabled="publish.pending.value" @click="publish.execute(row)">
              {{ site.data.value!.live_version_id ? "换成这个" : "发布" }}
            </TxButton>
          </span>
        </template>
        <template #empty><TxEmptyState title="还没有上传过版本" description="上传站点包后，每个版本和校验结果都会列在这里。" size="small" /></template>
      </TxDataTable>
    </TxCard>
  </template>
</template>

<style scoped src="./panel.css"></style>
<style scoped>
.lead {
  margin: -2px 0 10px;
  font-size: 0.8125rem;
  max-width: 80ch;
}
.report {
  margin: 4px 0 0;
  padding-left: 1.2em;
}
.slug {
  margin-top: 16px;
  max-width: 420px;
}
.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.row-actions a {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 8px;
}
</style>
