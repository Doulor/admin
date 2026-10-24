<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxDataTable } from "@talex-touch/tuffex/data-table";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxNumberInput } from "@talex-touch/tuffex/number-input";
import { TxEmptyState } from "@talex-touch/tuffex/empty-state";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import NewStickerDialog from "./NewStickerDialog.vue";
import { api, jsonBody } from "../../lib/http";
import { useAction, useResource } from "../../lib/resource";
import {
  SORT_MAX, newPackErrors, packDraftErrors, packDraftFrom, packPatch, packUses, sortedStickers, stickerDraftErrors, stickerDraftFrom, stickerPatch, takenShortcodes,
  type NewPackDraft, type PackDraft, type StickerDraft,
} from "../../lib/forum";
import type { ConsoleSticker, ConsoleStickerPack, ConsoleStickersResponse } from "../../lib/types";

/**
 * 表情包与表情（#276）：停用的表情不再出现在论坛的表情面板里，帖子里已经写的短码按原文显示；
 * 回应过的计数保留。表情不删，不用了就停用。排序小的排前面。
 * 「新建表情包」建一个空包（id 之后是包里短码的前缀），「加表情」一次可以传多张。
 * 只上传有使用权的图片：B 站等平台的表情归平台和作者所有，不搬进来。
 */
const list = useResource(() => api<ConsoleStickersResponse>("/api/console/forum/stickers"));
const packs = computed(() => [...(list.data.value?.packs ?? [])].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)));
const taken = computed(() => takenShortcodes(list.data.value?.packs ?? []));

const columns = [
  { key: "sticker", title: "表情", minWidth: 220 },
  { key: "sort", title: "排序", width: 80, align: "right" as const },
  { key: "uses", title: "回应", width: 80, align: "right" as const },
  { key: "state", title: "状态", width: 92 },
  { key: "actions", title: "操作", width: 150, align: "right" as const },
];

const toggle = useAction(async (kind: "pack" | "sticker", id: string, name: string, enabled: boolean) => {
  const path = kind === "pack" ? `/api/console/forum/sticker-packs/${encodeURIComponent(id)}` : `/api/console/forum/stickers/${encodeURIComponent(id)}`;
  await api(path, { method: "PATCH", ...jsonBody({ enabled: !enabled }) });
  toast({ title: enabled ? `已停用「${name}」` : `已启用「${name}」`, variant: "success" });
  await list.reload();
});

// 改表情的名字和排序
const stickerOpen = ref(false);
const editingSticker = ref<ConsoleSticker>();
const stickerDraft = reactive<StickerDraft>({ label: "", sort: 0 });
const stickerErrors = ref<Partial<Record<keyof StickerDraft, string>>>({});
function editSticker(sticker: ConsoleSticker) {
  editingSticker.value = sticker;
  Object.assign(stickerDraft, stickerDraftFrom(sticker));
  stickerErrors.value = {};
  saveSticker.reset();
  stickerOpen.value = true;
}
const saveSticker = useAction(async () => {
  const original = editingSticker.value;
  if (!original) return;
  stickerErrors.value = stickerDraftErrors(stickerDraft);
  if (Object.keys(stickerErrors.value).length) return;
  const patch = stickerPatch(stickerDraft, original);
  if (Object.keys(patch).length) {
    await api(`/api/console/forum/stickers/${encodeURIComponent(original.id)}`, { method: "PATCH", ...jsonBody(patch) });
    toast({ title: "已保存", variant: "success" });
    await list.reload();
  }
  stickerOpen.value = false;
});

// 改表情包的名字和排序
const packOpen = ref(false);
const editingPack = ref<ConsoleStickerPack>();
const packDraft = reactive<PackDraft>({ name: "", sort: 0 });
const packErrors = ref<Partial<Record<keyof PackDraft, string>>>({});
function editPack(pack: ConsoleStickerPack) {
  editingPack.value = pack;
  Object.assign(packDraft, packDraftFrom(pack));
  packErrors.value = {};
  savePack.reset();
  packOpen.value = true;
}
const savePack = useAction(async () => {
  const original = editingPack.value;
  if (!original) return;
  packErrors.value = packDraftErrors(packDraft);
  if (Object.keys(packErrors.value).length) return;
  const patch = packPatch(packDraft, original);
  if (Object.keys(patch).length) {
    await api(`/api/console/forum/sticker-packs/${encodeURIComponent(original.id)}`, { method: "PATCH", ...jsonBody(patch) });
    toast({ title: "已保存", variant: "success" });
    await list.reload();
  }
  packOpen.value = false;
});

// 新建表情包
const newPackOpen = ref(false);
const newPack = reactive<NewPackDraft>({ id: "", name: "" });
const newPackFieldErrors = ref<Partial<Record<keyof NewPackDraft, string>>>({});
function openNewPack() {
  Object.assign(newPack, { id: "", name: "" });
  newPackFieldErrors.value = {};
  createPack.reset();
  newPackOpen.value = true;
}
const createPack = useAction(async () => {
  newPackFieldErrors.value = newPackErrors(newPack, new Set(packs.value.map(pack => pack.id)));
  if (Object.keys(newPackFieldErrors.value).length) return;
  const created = await api<{ id: string; name: string }>("/api/console/forum/sticker-packs", { method: "POST", ...jsonBody({ id: newPack.id.trim(), name: newPack.name.trim() }) });
  toast({ title: `已建好「${created.name}」，接着往里加表情`, variant: "success" });
  newPackOpen.value = false;
  await list.reload();
  const pack = packs.value.find(item => item.id === created.id);
  if (pack) addTo(pack);
});

const adding = ref(false);
const addingTo = ref<ConsoleStickerPack | null>(null);
function addTo(pack: ConsoleStickerPack) {
  addingTo.value = pack;
  adding.value = true;
}
</script>

<template>
  <div class="tab-body">
    <ErrorAlert v-if="toggle.error.value" :error="toggle.error.value" @close="toggle.reset()" />
    <ErrorPanel v-if="list.error.value" :error="list.error.value" :retry="list.reload" />
    <LoadingBlock v-else-if="!list.data.value" :lines="8" />
    <div v-if="list.data.value && !list.error.value" class="tab-head">
      <span class="cell-sub">论坛的表情面板按这里的顺序一包一个页签，每张图下面写名字。只上传有使用权的图片。</span>
      <TxButton variant="primary" icon="i-carbon-add" @click="openNewPack">新建表情包</TxButton>
    </div>
    <TxEmptyState v-if="list.data.value && !list.error.value && !packs.length" title="还没有表情包" description="第一套「极客娘」随服务端迁移种进库里；也可以点「新建表情包」自己建一个。" size="small" />
    <template v-else-if="list.data.value && !list.error.value">
      <TxCard v-for="pack in packs" :key="pack.id" :padding="0" class="pack">
        <template #header>
          <div class="pack__head">
            <span class="cell-stack">
              <span class="pack__title">
                <span class="section-title">{{ pack.name }}</span>
                <TxStatusBadge :text="pack.enabled ? '启用' : '已停用'" :status="pack.enabled ? 'success' : 'muted'" size="sm" />
              </span>
              <span class="cell-sub">{{ pack.stickers.length }} 个表情 · 回应过 {{ packUses(pack) }} 次 · 排序 {{ pack.sort }}</span>
            </span>
            <span class="pack__actions">
              <TxButton size="sm" variant="ghost" @click="editPack(pack)">改名和排序</TxButton>
              <TxButton size="sm" variant="ghost" :class="{ 'danger-text': pack.enabled }" :disabled="toggle.pending.value" @click="toggle.execute('pack', pack.id, pack.name, pack.enabled)">{{ pack.enabled ? "停用整包" : "启用整包" }}</TxButton>
              <TxButton size="sm" variant="primary" icon="i-carbon-add" @click="addTo(pack)">加表情</TxButton>
            </span>
          </div>
        </template>
        <TxDataTable style="--table-min: 640px" :columns="columns" :data="sortedStickers(pack)" row-key="id" table-layout="fixed" scroll-x>
          <template #cell-sticker="{ row }: { row: ConsoleSticker }">
            <span class="sticker">
              <img :src="row.url" :alt="row.label" class="sticker__img" :class="{ 'sticker__img--off': !row.enabled }" loading="lazy" decoding="async">
              <span class="cell-stack">
                <span>{{ row.label }}</span>
                <span class="cell-sub mono">:{{ row.shortcode }}:</span>
              </span>
            </span>
          </template>
          <template #cell-sort="{ row }: { row: ConsoleSticker }">{{ row.sort }}</template>
          <template #cell-uses="{ row }: { row: ConsoleSticker }">{{ row.use_count }}</template>
          <template #cell-state="{ row }: { row: ConsoleSticker }">
            <TxStatusBadge :text="row.enabled ? '启用' : '已停用'" :status="row.enabled ? 'success' : 'muted'" size="sm" />
          </template>
          <template #cell-actions="{ row }: { row: ConsoleSticker }">
            <span class="row-actions">
              <TxButton size="sm" variant="ghost" @click="editSticker(row)">编辑</TxButton>
              <TxButton size="sm" variant="ghost" :class="{ 'danger-text': row.enabled }" :disabled="toggle.pending.value" @click="toggle.execute('sticker', row.id, row.label, row.enabled)">{{ row.enabled ? "停用" : "启用" }}</TxButton>
            </span>
          </template>
          <template #empty><TxEmptyState title="这个包里还没有表情" description="用右上角的「加表情」上传第一个。" size="small" /></template>
        </TxDataTable>
      </TxCard>
    </template>

    <TxModal v-model="stickerOpen" :title="editingSticker ? `编辑 :${editingSticker.shortcode}:` : '编辑表情'" width="min(92vw, 480px)">
      <TxForm :model="stickerDraft" label-position="top">
        <div class="form-grid edit-form">
          <TxFormItem label="名字" class="wide">
            <TxInput v-model="stickerDraft.label" class="fill-width" />
            <span v-if="stickerErrors.label" class="field-error">{{ stickerErrors.label }}</span>
          </TxFormItem>
          <TxFormItem label="排序（小的在前）" class="wide">
            <TxNumberInput v-model="stickerDraft.sort" :min="0" :max="SORT_MAX" :step="10" decrease-label="减少" increase-label="增加" class="fill-width" />
            <span v-if="stickerErrors.sort" class="field-error">{{ stickerErrors.sort }}</span>
          </TxFormItem>
        </div>
        <ErrorAlert v-if="saveSticker.error.value" :error="saveSticker.error.value" @close="saveSticker.reset()" />
      </TxForm>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="stickerOpen = false">取消</TxButton>
          <TxButton variant="primary" :loading="saveSticker.pending.value" @click="saveSticker.execute()">保存</TxButton>
        </div>
      </template>
    </TxModal>

    <TxModal v-model="packOpen" title="表情包的名字和排序" width="min(92vw, 480px)">
      <TxForm :model="packDraft" label-position="top">
        <div class="form-grid edit-form">
          <TxFormItem label="名字" class="wide">
            <TxInput v-model="packDraft.name" class="fill-width" />
            <span v-if="packErrors.name" class="field-error">{{ packErrors.name }}</span>
          </TxFormItem>
          <TxFormItem label="排序（小的在前）" class="wide">
            <TxNumberInput v-model="packDraft.sort" :min="0" :max="SORT_MAX" :step="10" decrease-label="减少" increase-label="增加" class="fill-width" />
            <span v-if="packErrors.sort" class="field-error">{{ packErrors.sort }}</span>
          </TxFormItem>
        </div>
        <ErrorAlert v-if="savePack.error.value" :error="savePack.error.value" @close="savePack.reset()" />
      </TxForm>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="packOpen = false">取消</TxButton>
          <TxButton variant="primary" :loading="savePack.pending.value" @click="savePack.execute()">保存</TxButton>
        </div>
      </template>
    </TxModal>

    <TxModal v-model="newPackOpen" title="新建表情包" width="min(92vw, 480px)">
      <TxForm :model="newPack" label-position="top">
        <div class="form-grid edit-form">
          <TxFormItem label="名字" class="wide">
            <TxInput v-model="newPack.name" class="fill-width" placeholder="例如：猫猫" />
            <span v-if="newPackFieldErrors.name" class="field-error">{{ newPackFieldErrors.name }}</span>
          </TxFormItem>
          <TxFormItem label="id" class="wide">
            <TxInput v-model="newPack.id" class="fill-width mono" spellcheck="false" autocomplete="off" placeholder="例如：cats" />
            <span v-if="newPackFieldErrors.id" class="field-error">{{ newPackFieldErrors.id }}</span>
            <span v-else class="field-hint">小写字母、数字和 -；包里表情的短码会以「{{ newPack.id.trim() || "id" }}-」开头，建好后不能改。</span>
          </TxFormItem>
        </div>
        <ErrorAlert v-if="createPack.error.value" :error="createPack.error.value" @close="createPack.reset()" />
      </TxForm>
      <template #footer>
        <div class="dialog-actions">
          <TxButton variant="secondary" @click="newPackOpen = false">取消</TxButton>
          <TxButton variant="primary" :loading="createPack.pending.value" @click="createPack.execute()">新建</TxButton>
        </div>
      </template>
    </TxModal>

    <NewStickerDialog v-model:open="adding" :pack="addingTo" :taken="taken" @created="list.reload()" />
  </div>
</template>

<style scoped>
.tab-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.tab-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-hint {
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--tx-text-color-secondary);
}
.pack__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pack__title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pack__actions,
.row-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.row-actions {
  flex-wrap: nowrap;
  white-space: nowrap;
}
.sticker {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.sticker__img {
  flex: none;
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.sticker__img--off {
  opacity: 0.4;
}
.danger-text {
  color: var(--tx-color-danger);
}
.field-error {
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: var(--tx-color-danger);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.tab-head :deep(button),
.pack__actions :deep(button),
.row-actions :deep(button),
.dialog-actions :deep(button) {
  min-height: 44px;
}
.edit-form :deep(.tx-input__inner) {
  min-height: 44px;
}
</style>
