<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
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
  SORT_MAX, labelTaken, newPackErrors, packCover, packDraftErrors, packDraftFrom, packNameTaken, packPatch, packUses, sortedStickers, stickerDraftErrors, stickerDraftFrom, stickerPatch, stickerToken, takenShortcodes,
  type NewPackDraft, type PackDraft, type StickerDraft,
} from "../../lib/forum";
import type { ConsoleSticker, ConsoleStickerPack, ConsoleStickersResponse } from "../../lib/types";

/**
 * 表情包与表情（#276）：先是一张张表情包卡片，点进去才是包里的表情（地址栏 `?pack=<id>`，浏览器返回回到卡片）。
 * 停用的表情不再出现在论坛的表情面板里，帖子里已经写的短码按原文显示；回应过的计数保留。
 * 表情不删，不用了就停用。排序小的排前面。每张表情在论坛里还能写成 `[包名_名字]`，所以同一个包里
 * 名字不重复，表情包也不重名。「新建表情包」建一个空包（id 之后是包里短码的前缀），「加表情」一次可以传多张。
 * 只上传有使用权的图片：B 站等平台的表情归平台和作者所有，不搬进来。
 */
const route = useRoute();
const router = useRouter();
const list = useResource(() => api<ConsoleStickersResponse>("/api/console/forum/stickers"));
const packs = computed(() => [...(list.data.value?.packs ?? [])].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)));
const taken = computed(() => takenShortcodes(list.data.value?.packs ?? []));
const current = computed(() => packs.value.find(pack => pack.id === route.query.pack));
const openPack = (pack: ConsoleStickerPack) => void router.push({ query: { ...route.query, pack: pack.id } });
const closePack = () => void router.push({ query: { ...route.query, pack: undefined } });

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
  const pack = packs.value.find(item => item.stickers.some(sticker => sticker.id === original.id));
  if (!stickerErrors.value.label && labelTaken(pack, stickerDraft.label, original.id)) stickerErrors.value.label = "这个包里已经有叫这个名字的表情了";
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
  if (!packErrors.value.name && packNameTaken(packs.value, packDraft.name, original.id)) packErrors.value.name = "已经有叫这个名字的表情包了";
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
  if (!newPackFieldErrors.value.name && packNameTaken(packs.value, newPack.name)) newPackFieldErrors.value.name = "已经有叫这个名字的表情包了";
  if (Object.keys(newPackFieldErrors.value).length) return;
  const created = await api<{ id: string; name: string }>("/api/console/forum/sticker-packs", { method: "POST", ...jsonBody({ id: newPack.id.trim(), name: newPack.name.trim() }) });
  toast({ title: `已建好「${created.name}」，接着往里加表情`, variant: "success" });
  newPackOpen.value = false;
  await list.reload();
  const pack = packs.value.find(item => item.id === created.id);
  if (pack) {
    openPack(pack);
    addTo(pack);
  }
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
    <template v-if="list.data.value && !list.error.value && !current">
      <div class="tab-head">
        <span class="head-text">
          <h2 class="section-title">表情包</h2>
          <span class="cell-sub">{{ packs.length }} 个包。论坛的表情面板按排序一包一个页签，点开一个包管理里面的表情。</span>
        </span>
        <TxButton variant="primary" icon="i-carbon-add" @click="openNewPack">新建表情包</TxButton>
      </div>
      <TxEmptyState v-if="!packs.length" title="还没有表情包" description="第一套「极客娘」随服务端迁移种进库里；也可以点「新建表情包」自己建一个。" size="small" />
      <div v-else class="pack-grid">
        <TxCard v-for="pack in packs" :key="pack.id" clickable :padding="0" :radius="16" class="pack-card" :class="{ 'pack-card--off': !pack.enabled }" :aria-label="`打开表情包「${pack.name}」`" @click="openPack(pack)">
          <div class="pack-card__cover">
            <img v-for="sticker in packCover(pack)" :key="sticker.id" :src="sticker.url" :alt="sticker.label" loading="lazy" decoding="async">
            <span v-if="!packCover(pack).length" class="cell-sub">还没有表情</span>
          </div>
          <div class="pack-card__body">
            <span class="pack-card__title">
              <span class="pack-card__name">{{ pack.name }}</span>
              <TxStatusBadge v-if="!pack.enabled" text="已停用" status="muted" size="sm" />
            </span>
            <span class="cell-sub">{{ pack.stickers.length }} 个表情 · 回应 {{ packUses(pack) }} 次</span>
          </div>
          <i class="i-carbon-chevron-right pack-card__arrow" aria-hidden="true" />
        </TxCard>
      </div>
    </template>

    <template v-else-if="current">
      <TxButton variant="bare" size="sm" icon="i-carbon-arrow-left" class="back" @click="closePack">全部表情包</TxButton>
      <div class="detail-head">
        <img v-if="packCover(current, 1)[0]" :src="packCover(current, 1)[0]!.url" alt="" class="detail-head__cover">
        <span class="detail-head__text">
          <span class="pack-card__title">
            <h2 class="section-title">{{ current.name }}</h2>
            <TxStatusBadge :text="current.enabled ? '启用中' : '已停用'" :status="current.enabled ? 'success' : 'muted'" size="sm" />
          </span>
          <span class="cell-sub">{{ current.stickers.length }} 个表情 · 回应 {{ packUses(current) }} 次 · 排序 {{ current.sort }} · id {{ current.id }}</span>
        </span>
        <span class="detail-head__actions">
          <TxButton variant="secondary" @click="editPack(current)">改名和排序</TxButton>
          <TxButton variant="secondary" :class="{ 'danger-text': current.enabled }" :disabled="toggle.pending.value" @click="toggle.execute('pack', current.id, current.name, current.enabled)">{{ current.enabled ? "停用整包" : "启用整包" }}</TxButton>
          <TxButton variant="primary" icon="i-carbon-add" @click="addTo(current)">加表情</TxButton>
        </span>
      </div>
      <p class="cell-sub detail-hint">论坛聊天框里输入 <span class="mono">{{ stickerToken(current.name, "名字") }}</span> 会变成对应的表情。帖子里存的是短码，改名字不影响已经发出去的帖子。</p>
      <TxEmptyState v-if="!current.stickers.length" title="这个包里还没有表情" description="点「加表情」，一次可以选多张图。" size="small" />
      <ul v-else class="sticker-grid">
        <li v-for="sticker in sortedStickers(current)" :key="sticker.id" class="sticker-tile" :class="{ 'sticker-tile--off': !sticker.enabled }">
          <span class="sticker-tile__img">
            <img :src="sticker.url" :alt="sticker.label" loading="lazy" decoding="async">
            <TxStatusBadge v-if="!sticker.enabled" text="已停用" status="muted" size="sm" class="sticker-tile__badge" />
          </span>
          <span class="sticker-tile__name">{{ sticker.label }}</span>
          <span class="sticker-tile__token mono" :title="`短码 :${sticker.shortcode}:`">{{ stickerToken(current.name, sticker.label) }}</span>
          <span class="sticker-tile__meta">回应 {{ sticker.use_count }} · 排序 {{ sticker.sort }}</span>
          <span class="sticker-tile__actions">
            <TxButton size="sm" variant="secondary" @click="editSticker(sticker)">编辑</TxButton>
            <TxButton size="sm" variant="secondary" :class="{ 'danger-text': sticker.enabled }" :disabled="toggle.pending.value" @click="toggle.execute('sticker', sticker.id, sticker.label, sticker.enabled)">{{ sticker.enabled ? "停用" : "启用" }}</TxButton>
          </span>
        </li>
      </ul>
    </template>
    <TxEmptyState v-else-if="list.data.value && !list.error.value && route.query.pack" title="没有这个表情包" description="可能是地址写错了。" size="small">
      <template #actions><TxButton variant="secondary" @click="closePack">看全部表情包</TxButton></template>
    </TxEmptyState>

    <TxModal v-model="stickerOpen" :title="editingSticker ? `编辑「${editingSticker.label}」` : '编辑表情'" width="min(92vw, 480px)">
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
          <p v-if="editingSticker" class="field-hint wide">短码 <span class="mono">:{{ editingSticker.shortcode }}:</span> 建好后不能改，帖子里存的是它。</p>
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
  padding: 20px 24px 24px;
}
.tab-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}
.head-text,
.detail-head__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.head-text .section-title,
.detail-head .section-title {
  margin: 0;
}
.pack-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.pack-card {
  position: relative;
}
.pack-card__cover {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  justify-items: center;
  gap: 4px;
  min-height: 96px;
  padding: 16px 16px 8px;
  border-radius: 16px 16px 0 0;
  background: var(--tx-fill-color-lighter);
}
.pack-card__cover img {
  width: 100%;
  max-width: 64px;
  aspect-ratio: 1;
  object-fit: contain;
}
.pack-card__cover .cell-sub {
  grid-column: 1 / -1;
}
.pack-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 40px 14px 16px;
}
.pack-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.pack-card__name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  color: var(--tx-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pack-card__arrow {
  position: absolute;
  right: 14px;
  bottom: 22px;
  font-size: 18px;
  color: var(--tx-text-color-secondary);
}
.pack-card--off .pack-card__cover img {
  opacity: 0.45;
}
.back {
  align-self: flex-start;
  margin-left: -8px;
}
.detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}
.detail-head__cover {
  flex: none;
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 12px;
  background: var(--tx-fill-color-lighter);
}
.detail-head__text {
  flex: 1 1 220px;
}
.detail-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.detail-hint {
  margin: 0;
}
.sticker-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 12px;
}
.sticker-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 12px 12px 14px;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: 14px;
  background: var(--tx-bg-color-overlay, #fff);
  text-align: center;
}
.sticker-tile__img {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 104px;
  margin-bottom: 4px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter);
}
.sticker-tile__img img {
  width: 88px;
  height: 88px;
  object-fit: contain;
}
.sticker-tile__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--tx-text-color-primary);
}
.sticker-tile__token {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sticker-tile__badge {
  position: absolute;
  top: 6px;
  right: 6px;
}
.sticker-tile__meta {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.sticker-tile__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  margin-top: auto;
  padding-top: 8px;
}
.sticker-tile--off .sticker-tile__img img {
  opacity: 0.4;
}
.danger-text {
  color: var(--tx-color-danger);
}
.field-hint,
.field-error {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.125rem;
}
.field-hint {
  color: var(--tx-text-color-secondary);
}
.field-error {
  color: var(--tx-color-danger);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.tab-head :deep(button),
.detail-head__actions :deep(button),
.dialog-actions :deep(button) {
  min-height: 44px;
}
.sticker-tile__actions :deep(button) {
  min-height: 40px;
}
.edit-form :deep(.tx-input__inner) {
  min-height: 44px;
}
@media (max-width: 640px) {
  .tab-body {
    padding: 16px;
  }
  .pack-grid {
    grid-template-columns: 1fr;
  }
  .sticker-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .detail-head__actions {
    width: 100%;
  }
  .detail-head__actions :deep(button) {
    flex: 1 1 auto;
  }
}
</style>
