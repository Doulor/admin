<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxFileUploader } from "@talex-touch/tuffex/file-uploader";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorAlert from "../../components/ErrorAlert.vue";
import { api } from "../../lib/http";
import { useAction } from "../../lib/resource";
import { STICKER_FILE_TYPES, newStickerErrors, stickerFileProblem, stickerUploadPath, type NewStickerDraft } from "../../lib/forum";
import type { ConsoleStickerPack } from "../../lib/types";

/**
 * 往一个表情包里加表情（#276）：图片本身是请求体，服务端和头像一样处理成 256px 的 WebP；
 * 短码和名字在查询串里。短码定了就不能改，帖子里写的就是它。
 */
const props = defineProps<{ pack: ConsoleStickerPack | null; taken: ReadonlySet<string> }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ created: [] }>();

type Picked = { file: File };
const draft = reactive<NewStickerDraft>({ shortcode: "", label: "" });
const file = ref<File | null>(null);
const preview = ref("");
const errors = ref<Partial<Record<"shortcode" | "label" | "file", string>>>({});
let pick = 0;

watch(open, (value) => {
  if (!value) return;
  draft.shortcode = props.pack ? `${props.pack.id}-` : "";
  draft.label = "";
  file.value = null;
  preview.value = "";
  errors.value = {};
  save.reset();
});

function choose(next: Picked[]) {
  const picked = next.at(-1)?.file;
  if (!picked) return;
  const problem = stickerFileProblem(picked);
  if (problem) {
    errors.value = { ...errors.value, file: problem };
    return;
  }
  const mine = ++pick;
  file.value = picked;
  errors.value = { ...errors.value, file: undefined };
  // 控制台的 CSP 不放行 blob: 图片，预览用 data: 地址。
  const reader = new FileReader();
  reader.onload = () => {
    if (mine === pick && typeof reader.result === "string") preview.value = reader.result;
  };
  reader.readAsDataURL(picked);
}

const accept = STICKER_FILE_TYPES.join(",");
const title = computed(() => (props.pack ? `往「${props.pack.name}」加表情` : "加表情"));

const save = useAction(async () => {
  const pack = props.pack;
  if (!pack) return;
  const found = newStickerErrors(draft, file.value, props.taken);
  errors.value = found;
  if (Object.keys(found).length || !file.value) return;
  await api(stickerUploadPath(pack.id, draft), { method: "PUT", body: file.value, headers: { "Content-Type": file.value.type } });
  toast({ title: `已加上 :${draft.shortcode.trim()}:`, variant: "success" });
  open.value = false;
  emit("created");
});
</script>

<template>
  <TxModal v-model="open" :title="title" width="min(92vw, 520px)">
    <TxForm :model="draft" label-position="top">
      <div class="form-grid sticker-form">
        <TxFormItem label="图片" class="wide">
          <div class="pick">
            <img v-if="preview" :src="preview" alt="选中的图片" class="pick__preview">
            <TxFileUploader
              :model-value="[]"
              :multiple="false"
              :max="1"
              :accept="accept"
              button-text="选择图片"
              drop-text="把图片拖到这里"
              hint-text="PNG、JPEG 或 WebP，不超过 2MB，最好是透明背景的方图"
              class="pick__uploader"
              @update:model-value="choose"
            />
          </div>
          <span v-if="errors.file" class="field-error">{{ errors.file }}</span>
        </TxFormItem>
        <TxFormItem label="短码" class="wide">
          <TxInput v-model="draft.shortcode" class="fill-width mono" spellcheck="false" autocomplete="off" />
          <span v-if="errors.shortcode" class="field-error">{{ errors.shortcode }}</span>
          <span v-else class="field-hint">帖子里写成 :{{ draft.shortcode.trim() || "短码" }}: 就会显示这个表情；建好后不能改。</span>
        </TxFormItem>
        <TxFormItem label="名字" class="wide">
          <TxInput v-model="draft.label" class="fill-width" placeholder="例如：打招呼" />
          <span v-if="errors.label" class="field-error">{{ errors.label }}</span>
          <span v-else class="field-hint">读屏和鼠标悬停时读这个名字。</span>
        </TxFormItem>
      </div>
      <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
    </TxForm>
    <template #footer>
      <div class="dialog-actions">
        <TxButton variant="secondary" @click="open = false">取消</TxButton>
        <TxButton variant="primary" icon="i-carbon-upload" :loading="save.pending.value" @click="save.execute()">上传</TxButton>
      </div>
    </template>
  </TxModal>
</template>

<style scoped>
.pick {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}
.pick__preview {
  flex: none;
  width: 96px;
  height: 96px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid var(--tx-border-color-lighter);
  background: var(--tx-fill-color-lighter);
}
.pick__uploader {
  flex: 1;
  min-width: 0;
}
.field-error,
.field-hint {
  font-size: 0.75rem;
  line-height: 1.125rem;
}
.field-error {
  color: var(--tx-color-danger);
}
.field-hint {
  color: var(--tx-text-color-secondary);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialog-actions :deep(button) {
  min-height: 44px;
}
.sticker-form :deep(.tx-input__inner) {
  min-height: 44px;
}
</style>
