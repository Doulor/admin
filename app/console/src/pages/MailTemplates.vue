<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import PageHeader from "../components/PageHeader.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import ErrorAlert from "../components/ErrorAlert.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import TemplateList from "./mail-templates/TemplateList.vue";
import TemplateEditor from "./mail-templates/TemplateEditor.vue";
import TemplatePreview from "./mail-templates/TemplatePreview.vue";
import TestSend from "./mail-templates/TestSend.vue";
import { ApiError, api, jsonBody } from "../lib/http";
import { confirm } from "../lib/confirm";
import { useAction, useResource } from "../lib/resource";
import {
  IDLE_PREVIEW, copyName, createBody, createPreviewer, draftFromTemplate, draftSnapshot, groupByKind, issuesOf, newDraft, placeIssues, previewPayload, updateBody,
  type PreviewLetter, type PreviewSample, type PreviewState, type TemplateDraft,
} from "../lib/mail-templates";
import type { MailKind, MailRendered, MailTemplate, MailTemplateIssue, MailTemplateList } from "../lib/types";

/**
 * 招聘邮件模板（#285）：已收到、待面试、已录取、未通过四种信，每种可以有几套模板。左边是模板列表（复制、设为默认、停用、删除），
 * 中间编辑，右边是实时预览和向测试邮箱试发。改投递状态时（投递详情页）在同一类的几套里选一套发；不选就用这一类的默认。
 */
const list = useResource(() => api<MailTemplateList>("/api/console/mail-templates"), []);
const data = computed(() => list.data.value);
const groups = computed(() => (data.value ? groupByKind(data.value.templates, data.value.kinds) : []));

// ---- 正在编辑的草稿 ----

const editing = ref(false);
const draft = reactive<TemplateDraft>(newDraft("received", null));
/** 草稿读到时的那套模板；null 是新建的 */
const saved = ref<MailTemplate | null>(null);
const baseline = ref("");
const dirty = computed(() => editing.value && draftSnapshot(draft) !== baseline.value);
const selectedId = computed(() => (editing.value ? saved.value?.id ?? null : null));
const kindLabel = computed(() => data.value?.kinds.find(item => item.id === draft.kind)?.label ?? "");

const saveIssues = ref<MailTemplateIssue[]>([]);
const previewIssues = ref<MailTemplateIssue[]>([]);
const placed = computed(() => placeIssues([...saveIssues.value, ...previewIssues.value], draft));
// 改过草稿以后，保存时指出的问题先收起来，等再保存或预览时重新核对
watch(() => draftSnapshot(draft), () => { saveIssues.value = []; });

// ---- 实时预览 ----

const sample = reactive<PreviewSample>({ name: "", class_name: "", strengths: "" });
const letter = reactive<PreviewLetter>({ time: "", place: "", notes: "", message: "" });
const previewState = ref<PreviewState>(IDLE_PREVIEW);
const payload = computed(() => previewPayload(draft, sample, letter));
const previewer = createPreviewer({
  run: body => api<MailRendered>("/api/console/mail-templates/preview", { method: "POST", ...jsonBody(body) }),
  onState: state => {
    previewState.value = state;
    previewIssues.value = state.issues;
  },
});
watch(payload, value => { if (editing.value) previewer.request(value); });
onBeforeUnmount(() => previewer.reset());

const testTo = ref("");
const workbench = ref<HTMLElement>();

function open(next: TemplateDraft, template: MailTemplate | null) {
  Object.assign(draft, next);
  saved.value = template;
  baseline.value = draftSnapshot(draft);
  saveIssues.value = [];
  save.reset();
  changed.value = false;
  editing.value = true;
  previewer.flush(payload.value);
}

async function leave(): Promise<boolean> {
  if (!dirty.value) return true;
  return confirm({ title: "放弃没保存的修改？", body: "这套模板改过的地方还没有保存，离开后会丢掉。", confirmText: "放弃修改", danger: true });
}

/** 手机上编辑区在列表下面，选中以后滚过去 */
async function reveal() {
  if (!window.matchMedia?.("(max-width: 899px)").matches) return;
  await nextTick();
  workbench.value?.querySelector(".workbench__edit")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function select(template: MailTemplate) {
  if (template.id === selectedId.value || !(await leave())) return;
  open(draftFromTemplate(template), template);
  await reveal();
}
async function create(kind: MailKind) {
  if (!(await leave())) return;
  const base = data.value?.templates.find(item => item.kind === kind && item.is_default) ?? null;
  open(newDraft(kind, base), null);
  await reveal();
}
async function copy(template: MailTemplate) {
  if (!data.value || !(await leave())) return;
  const names = data.value.templates.filter(item => item.kind === template.kind).map(item => item.name);
  open(newDraft(template.kind, template, copyName(template.name, names, data.value.limits.name)), null);
  await reveal();
}
async function discard() {
  const template = saved.value ? data.value?.templates.find(item => item.id === saved.value?.id) ?? saved.value : null;
  if (template) open(draftFromTemplate(template), template);
  else if (data.value?.templates.length) {
    const first = data.value.templates.find(item => item.is_default) ?? data.value.templates[0];
    open(draftFromTemplate(first), first);
  } else {
    editing.value = false;
    previewer.reset();
  }
}

// ---- 保存 ----

/** 保存时服务端回 409 template_changed：别人先改了这套模板 */
const changed = ref(false);
const save = useAction(async () => {
  const wasNew = saved.value === null;
  let result: MailTemplate;
  try {
    result = wasNew
      ? await api<MailTemplate>("/api/console/mail-templates", { method: "POST", ...jsonBody(createBody(draft)) })
      : await api<MailTemplate>(`/api/console/mail-templates/${saved.value!.id}`, { method: "PATCH", ...jsonBody(updateBody(draft, saved.value!.updated_at)) });
  } catch (error) {
    // 服务端指出了哪几个输入框有问题：标在输入框下面，不再弹一条总的错误
    const found = issuesOf(error);
    if (found.length) {
      saveIssues.value = found;
      return;
    }
    if (error instanceof ApiError && error.code === "template_name_taken") {
      saveIssues.value = [{ path: "name", message: error.message }];
      return;
    }
    if (error instanceof ApiError && error.code === "template_changed") changed.value = true;
    throw error;
  }
  toast({ title: wasNew ? "已新建" : "已保存", variant: "success" });
  await list.reload();
  open(draftFromTemplate(result), result);
});

async function loadLatest() {
  const id = saved.value?.id;
  if (!id) return;
  const ok = await confirm({ title: "载入别人改过的版本？", body: "你在这套模板上改的内容会丢掉。", confirmText: "载入", danger: true });
  if (!ok) return;
  await list.reload();
  const fresh = data.value?.templates.find(item => item.id === id);
  if (fresh) open(draftFromTemplate(fresh), fresh);
  else await discard();
}

// ---- 列表上的操作 ----

/** 列表上的操作改了这套模板的启用或默认，如果草稿正是这一套且内容没变，接着用新的更新时间保存，不会被自己的操作挡成冲突 */
async function afterListChange(updated: MailTemplate) {
  await list.reload();
  if (saved.value?.id === updated.id && draftSnapshot(draftFromTemplate(updated)) === baseline.value) saved.value = updated;
}
const toggle = useAction(async (template: MailTemplate) => {
  const updated = await api<MailTemplate>(`/api/console/mail-templates/${template.id}`, { method: "PATCH", ...jsonBody({ enabled: !template.enabled }) });
  toast({ title: updated.enabled ? "已启用" : "已停用，改状态时不能再选它", variant: "success" });
  await afterListChange(updated);
});
const makeDefault = useAction(async (template: MailTemplate) => {
  const updated = await api<MailTemplate>(`/api/console/mail-templates/${template.id}`, { method: "PATCH", ...jsonBody({ is_default: true }) });
  toast({ title: `已设为「${kindLabelOf(template.kind)}」的默认`, variant: "success" });
  await afterListChange(updated);
});
const remove = useAction(async (template: MailTemplate) => {
  const ok = await confirm({
    title: `删除「${template.name}」？`, body: "已经排队或发出去的信不受影响，只是以后不能再选这一套。", confirmText: "删除", danger: true,
  });
  if (!ok) return;
  await api(`/api/console/mail-templates/${template.id}`, { method: "DELETE" });
  toast({ title: "已删除", variant: "success" });
  if (saved.value?.id === template.id) {
    editing.value = false;
    previewer.reset();
  }
  await list.reload();
  if (!editing.value) {
    const first = data.value?.templates.find(item => item.is_default) ?? data.value?.templates[0];
    if (first) open(draftFromTemplate(first), first);
  }
});
const kindLabelOf = (kind: MailKind) => data.value?.kinds.find(item => item.id === kind)?.label ?? kind;
const actionError = computed(() => toggle.error.value ?? makeDefault.error.value ?? remove.error.value);
const resetActions = () => { toggle.reset(); makeDefault.reset(); remove.reset(); };
const busy = computed(() => toggle.pending.value || makeDefault.pending.value || remove.pending.value);

// 第一次读到列表时打开默认的第一套，页面不空着
watch(data, value => {
  if (!value || editing.value) return;
  const first = value.templates.find(item => item.is_default) ?? value.templates[0];
  if (first) open(draftFromTemplate(first), first);
}, { immediate: true });
</script>

<template>
  <div class="page">
    <PageHeader
      title="邮件模板"
      description="投递人会收到四种信：已收到、待面试、已录取、未通过。每种信可以有几套模板，改投递状态时选一套发出，不选就用这一类的默认。"
    />
    <ErrorAlert v-if="actionError" :error="actionError" @close="resetActions" />

    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!data" :lines="8" />
    <template v-else>
      <p v-if="!data.mail.enabled" class="mail-note">发信还没有配置：可以编辑和预览，试发会如实告诉你没有发出。</p>
      <div ref="workbench" class="workbench">
        <TemplateList
          class="workbench__list"
          :groups="groups"
          :selected-id="selectedId"
          :busy="busy"
          @select="select"
          @create="create"
          @copy="copy"
          @toggle="toggle.execute($event)"
          @make-default="makeDefault.execute($event)"
          @remove="remove.execute($event)"
        />

        <div class="workbench__edit">
          <template v-if="editing">
            <TemplateEditor
              :draft="draft"
              :limits="data.limits"
              :block-kinds="data.block_kinds"
              :variables="data.variables"
              :issues="placed"
              :kind-label="kindLabel"
              :is-new="saved === null"
              :dirty="dirty"
              :saving="save.pending.value"
              :error="save.error.value"
              @save="save.execute()"
              @discard="discard"
              @close-error="save.reset()"
            />
            <div v-if="changed" class="changed">
              <TxButton variant="secondary" icon="i-carbon-renew" @click="loadLatest">载入别人改过的版本</TxButton>
            </div>
          </template>
          <TxCard v-else>
            <TxEmptyState title="选一套模板来编辑" description="在列表里点一套模板，或者在某一类下面新建一套。" size="small" />
          </TxCard>
        </div>

        <div v-if="editing" class="workbench__side">
          <TemplatePreview :state="previewState" :kind="draft.kind" :sample="sample" :letter="letter" @refresh="previewer.flush(payload)" />
          <TestSend v-model:to="testTo" :key="saved?.id ?? 'new'" :payload="payload" :mail="data.mail" :quota="data.test_send" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mail-note {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-color-warning);
}
.workbench {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: "list edit side";
  gap: 16px;
  align-items: start;
}
.workbench__list {
  grid-area: list;
}
.workbench__edit {
  grid-area: edit;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.workbench__side {
  grid-area: side;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}
.changed {
  display: flex;
}
@media (max-width: 1279px) {
  .workbench {
    grid-template-columns: 240px minmax(0, 1fr);
    grid-template-areas: "list edit" "list side";
  }
  .workbench__side {
    position: static;
    max-height: none;
    overflow: visible;
  }
}
@media (max-width: 899px) {
  .workbench {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "list" "edit" "side";
  }
}
</style>
