<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxFileUploader } from "@talex-touch/tuffex/file-uploader";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorAlert from "../../components/ErrorAlert.vue";
import { api, ApiError } from "../../lib/http";
import { useAction } from "../../lib/resource";
import { STICKER_FILE_TYPES, draftsFromFiles, newStickerErrors, stickerFileProblem, stickerUploadPath } from "../../lib/forum";
import type { ConsoleStickerPack } from "../../lib/types";

/**
 * 往一个表情包里加表情（#276）：一次可以选多张图，每张一行，短码和名字按文件名起草，上传前都能改。
 * 图片本身是请求体，服务端和头像一样处理成 256px 的 WebP；短码和名字在查询串里。短码定了就不能改，
 * 帖子里写的就是它。按顺序一张一张传，传失败的留在列表里写明原因，改好再点一次只传剩下的。
 */
const props = defineProps<{ pack: ConsoleStickerPack | null; taken: ReadonlySet<string> }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ created: [] }>();

const BATCH_MAX = 40;
type Row = {
  key: number;
  file: File;
  preview: string;
  shortcode: string;
  label: string;
  state: "wait" | "done" | "fail";
  problem?: string;
};
const rows = ref<Row[]>([]);
const pickProblem = ref("");
let nextKey = 0;

watch(open, (value) => {
  if (!value) return;
  rows.value = [];
  pickProblem.value = "";
  save.reset();
});

function choose(next: { file: File }[]) {
  const pack = props.pack;
  if (!pack) return;
  const files = next.map(item => item.file).filter(Boolean);
  const bad = files.filter(file => stickerFileProblem(file));
  pickProblem.value = bad.length ? `${bad.length} 个文件没加进来：只支持 PNG、JPEG、WebP，每张不超过 2MB` : "";
  const room = BATCH_MAX - rows.value.length;
  const good = files.filter(file => !stickerFileProblem(file)).slice(0, Math.max(0, room));
  if (files.length - bad.length > good.length) pickProblem.value = `一次最多 ${BATCH_MAX} 张，多出来的没加进来`;
  const used = new Set([...props.taken, ...rows.value.map(row => row.shortcode.trim())]);
  const drafts = draftsFromFiles(pack.id, good.map(file => file.name), used);
  good.forEach((file, index) => {
    const row: Row = { key: nextKey++, file, preview: "", ...drafts[index]!, state: "wait" };
    rows.value.push(row);
    // 控制台的 CSP 不放行 blob: 图片，预览用 data: 地址。
    const reader = new FileReader();
    reader.onload = () => {
      const target = rows.value.find(item => item.key === row.key);
      if (target && typeof reader.result === "string") target.preview = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function remove(key: number) {
  rows.value = rows.value.filter(row => row.key !== key);
}

const pending = computed(() => rows.value.filter(row => row.state !== "done"));
const accept = STICKER_FILE_TYPES.join(",");
const title = computed(() => (props.pack ? `往「${props.pack.name}」加表情` : "加表情"));

/** 先在本地查一遍（短码格式、已用的、同一批里重复的），全过了才开始传。 */
function checkRows(): boolean {
  const seen = new Set<string>();
  let ok = true;
  for (const row of pending.value) {
    const errors = newStickerErrors(row, row.file, props.taken);
    const shortcode = row.shortcode.trim();
    const problem = errors.shortcode ?? errors.label ?? errors.file ?? (seen.has(shortcode) ? "和这一批里另一张的短码重复了" : undefined);
    seen.add(shortcode);
    row.problem = problem;
    row.state = problem ? "fail" : "wait";
    if (problem) ok = false;
  }
  return ok;
}

const save = useAction(async () => {
  const pack = props.pack;
  if (!pack || !pending.value.length || !checkRows()) return;
  let done = 0;
  for (const row of pending.value) {
    try {
      await api(stickerUploadPath(pack.id, row), { method: "PUT", body: row.file, headers: { "Content-Type": row.file.type } });
      row.state = "done";
      row.problem = undefined;
      done += 1;
    }
    catch (error) {
      row.state = "fail";
      row.problem = error instanceof ApiError ? error.message : "没有传上去，稍后再试";
    }
  }
  if (done) {
    toast({ title: `已加上 ${done} 个表情`, variant: "success" });
    emit("created");
  }
  if (!pending.value.length) open.value = false;
});
</script>

<template>
  <TxModal v-model="open" :title="title" width="min(94vw, 640px)">
    <div class="batch">
      <TxFileUploader
        :model-value="[]"
        multiple
        :max="BATCH_MAX"
        :accept="accept"
        button-text="选择图片"
        drop-text="把图片拖到这里，可以一次选多张"
        hint-text="PNG、JPEG 或 WebP，每张不超过 2MB，最好是透明背景的方图；短码和名字按文件名先填好"
        @update:model-value="choose"
      />
      <span v-if="pickProblem" class="field-error">{{ pickProblem }}</span>

      <ul v-if="rows.length" class="rows">
        <li v-for="row in rows" :key="row.key" class="row" :class="{ 'row--done': row.state === 'done' }">
          <img v-if="row.preview" :src="row.preview" :alt="row.label" class="row__img">
          <span v-else class="row__img" />
          <span class="row__fields">
            <TxInput v-model="row.shortcode" class="mono" spellcheck="false" autocomplete="off" aria-label="短码" :disabled="row.state === 'done'" />
            <TxInput v-model="row.label" aria-label="名字" placeholder="名字，例如：打招呼" :disabled="row.state === 'done'" />
            <span v-if="row.problem" class="field-error row__problem">{{ row.problem }}</span>
          </span>
          <span class="row__side">
            <TxStatusBadge v-if="row.state === 'done'" text="已上传" status="success" size="sm" />
            <TxButton v-else size="sm" variant="ghost" :disabled="save.pending.value" @click="remove(row.key)">移除</TxButton>
          </span>
        </li>
      </ul>
      <p v-if="rows.length" class="field-hint">帖子里写成 :短码: 就会显示这个表情，短码建好后不能改；名字写在表情面板里每张图下面。</p>
      <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
    </div>
    <template #footer>
      <div class="dialog-actions">
        <TxButton variant="secondary" @click="open = false">{{ rows.some(row => row.state === "done") ? "关闭" : "取消" }}</TxButton>
        <TxButton variant="primary" icon="i-carbon-upload" :disabled="!pending.length" :loading="save.pending.value" @click="save.execute()">
          {{ pending.length > 1 ? `上传 ${pending.length} 个` : "上传" }}
        </TxButton>
      </div>
    </template>
  </TxModal>
</template>

<style scoped>
.batch {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: 12px;
}
.row--done {
  background: var(--tx-fill-color-lighter);
}
.row__img {
  width: 64px;
  height: 64px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--tx-fill-color-lighter);
}
.row__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}
.row__problem {
  grid-column: 1 / -1;
}
.field-error,
.field-hint {
  margin: 0;
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
.row__fields :deep(.tx-input__inner) {
  min-height: 40px;
}
@media (max-width: 640px) {
  .row {
    grid-template-columns: 48px minmax(0, 1fr);
  }
  .row__img {
    width: 48px;
    height: 48px;
  }
  .row__fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .row__side {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
