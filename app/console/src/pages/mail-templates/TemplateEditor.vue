<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxForm } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxCheckbox } from "@talex-touch/tuffex/checkbox";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxCollapse, TxCollapseItem } from "@talex-touch/tuffex/collapse";
import { toast } from "@talex-touch/tuffex/utils";
import ToneTag from "../../components/ToneTag.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import FieldRow from "./FieldRow.vue";
import {
  blankBlock, blankFact, blockField, canAddBlock, factField, insertVariable, issueCount, moveBlock, removeBlock, variableToken, variablesFor,
  type Caret, type DraftBlock, type FieldIssues, type TemplateDraft,
} from "../../lib/mail-templates";
import type { MailBlockKind, MailTemplateLimits, MailVariable } from "../../lib/types";

/**
 * 模板编辑区：名称、主题、摘要、抬头、正文块、按钮、页脚，加上一份变量速查（点一下插到光标处）。
 * 草稿 draft 由页面持有，这里直接改它的字段；保存、放弃交给页面。
 */
const props = defineProps<{
  draft: TemplateDraft;
  limits: MailTemplateLimits;
  blockKinds: { id: MailBlockKind; label: string }[];
  variables: MailVariable[];
  issues: FieldIssues;
  kindLabel: string;
  isNew: boolean;
  dirty: boolean;
  saving: boolean;
  error: unknown;
}>();
defineEmits<{ save: []; discard: []; closeError: [] }>();

const messagesOf = (field: string) => props.issues.byField[field];
const statusOf = (field: string) => (props.issues.byField[field]?.length ? "error" : "default");
const issueTotal = computed(() => issueCount(props.issues));
const groups = computed(() => variablesFor(props.draft.kind, props.variables));
const blockLabel = (kind: DraftBlock["kind"]) => props.blockKinds.find(item => item.id === kind)?.label ?? kind;

// ---- 变量插入：记住最近一次点过或打过字的输入框和光标位置 ----

const root = ref<HTMLElement>();
const target = ref<{ field: string; caret: Caret } | null>(null);
const described = ref<MailVariable | null>(null);
const panels = ref<string[]>(typeof window !== "undefined" && window.matchMedia?.("(min-width: 1180px)").matches ? ["variables"] : []);

const isText = (el: unknown): el is HTMLInputElement | HTMLTextAreaElement => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

function track(event: Event) {
  const el = event.target;
  if (!isText(el)) return;
  const field = el.closest<HTMLElement>("[data-field]")?.dataset.field;
  if (!field) return;
  target.value = { field, caret: { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length } };
}

async function insert(name: string) {
  const at = target.value;
  if (!at) {
    toast({ title: "先点一下要插入的位置", description: "在主题、抬头或正文的输入框里点一下，再点变量。", variant: "warning" });
    return;
  }
  const caret = insertVariable(props.draft, at, name);
  if (caret === null) return;
  target.value = { field: at.field, caret: { start: caret, end: caret } };
  await nextTick();
  await nextTick();
  const holder = root.value?.querySelector<HTMLElement>(`[data-field="${at.field}"]`);
  const el = isText(holder) ? holder : holder?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  el?.focus();
  el?.setSelectionRange(caret, caret);
}

// ---- 正文块 ----

const blocks = computed(() => props.draft.blocks);
const addable = computed(() => canAddBlock(props.draft, props.limits));
const add = (kind: MailBlockKind) => { if (addable.value) props.draft.blocks.push(blankBlock(kind)); };
const move = (index: number, delta: -1 | 1) => { props.draft.blocks = moveBlock(props.draft.blocks, index, delta); };
const drop = (index: number) => { props.draft.blocks = removeBlock(props.draft.blocks, index); };
</script>

<template>
  <TxCard>
    <template #header>
      <div class="card-head">
        <h2 class="section-title">{{ isNew ? "新建模板" : "编辑模板" }}</h2>
        <ToneTag tone="sky" :label="kindLabel" />
        <span v-if="dirty && !isNew" class="count">有没保存的修改</span>
      </div>
    </template>

    <div ref="root" class="editor" @focusin="track" @click="track" @keyup="track" @input="track">
      <TxForm :model="draft" label-position="top">
        <div class="form-grid">
          <FieldRow label="名称" class="wide" :messages="messagesOf('name')" :hint="`选信的时候看到的名字，同一类里不能重名。最多 ${limits.name} 个字。`" required>
            <template #default="field">
              <TxInput v-bind="field" v-model="draft.name" class="fill-width" autocomplete="off" :maxlength="limits.name" placeholder="例如：面试邀请 · 简短" />
            </template>
          </FieldRow>
          <FieldRow label="主题" class="wide" :messages="messagesOf('subject')" required>
            <template #default="field">
              <TxInput v-bind="field" v-model="draft.subject" class="fill-width" autocomplete="off" data-field="subject" :maxlength="limits.subject" />
            </template>
          </FieldRow>
          <FieldRow label="摘要" class="wide" :messages="messagesOf('preheader')" hint="收件箱列表里主题后面露出的一行。">
            <template #default="field">
              <TxInput v-bind="field" v-model="draft.preheader" class="fill-width" autocomplete="off" data-field="preheader" :maxlength="limits.preheader" />
            </template>
          </FieldRow>
          <FieldRow label="小标题" :messages="messagesOf('kicker')" hint="信纸左上角的小字。">
            <template #default="field">
              <TxInput v-bind="field" v-model="draft.kicker" class="fill-width" autocomplete="off" data-field="kicker" :maxlength="limits.kicker" />
            </template>
          </FieldRow>
          <FieldRow label="抬头" :messages="messagesOf('greeting')" required>
            <template #default="field">
              <TxInput v-bind="field" v-model="draft.greeting" class="fill-width" autocomplete="off" data-field="greeting" :maxlength="limits.greeting" />
            </template>
          </FieldRow>
        </div>

        <TxCollapse v-model="panels" class="vars">
          <TxCollapseItem name="variables" title="可用的变量">
            <p class="hint">点一下变量，放进光标所在的输入框。信发出去时它会换成投递人的真实内容；只有这里列出的变量能用。</p>
            <div v-for="group in groups" :key="group.label" class="vars__group">
              <h3 class="vars__label">{{ group.label }}</h3>
              <div class="vars__chips">
                <TxButton
                  v-for="variable in group.variables"
                  :key="variable.name"
                  size="sm"
                  variant="secondary"
                  class="vars__chip mono"
                  :title="variable.description"
                  @mousedown.prevent
                  @mouseenter="described = variable"
                  @focus="described = variable"
                  @click="described = variable; insert(variable.name)"
                >{{ variableToken(variable.name) }}</TxButton>
              </div>
            </div>
            <p class="vars__desc">{{ described ? `${described.name}：${described.description}` : "把鼠标移到变量上，或者点一下，这里写它是什么。" }}</p>
          </TxCollapseItem>
        </TxCollapse>

        <section class="editor__section" aria-labelledby="blocks-heading">
          <h3 id="blocks-heading" class="editor__heading">正文</h3>
          <p class="hint">正文由下面的块从上到下排成，每块的文字里都可以用变量。最多 {{ limits.blocks }} 块，全部文字加起来最多 {{ limits.totalText }} 个字。</p>
          <span v-for="message in messagesOf('blocks')" :key="message" class="field-error" role="alert">{{ message }}</span>
          <ol class="blocks">
            <li v-for="(block, index) in blocks" :key="block.uid" class="block">
              <div class="block__head">
                <span class="block__kind">第 {{ index + 1 }} 块 · {{ blockLabel(block.kind) }}</span>
                <div class="block__tools">
                  <TxButton size="sm" variant="ghost" icon="i-carbon-arrow-up" :disabled="index === 0" :aria-label="`第 ${index + 1} 块上移`" @click="move(index, -1)" />
                  <TxButton size="sm" variant="ghost" icon="i-carbon-arrow-down" :disabled="index === blocks.length - 1" :aria-label="`第 ${index + 1} 块下移`" @click="move(index, 1)" />
                  <TxButton size="sm" variant="ghost" icon="i-carbon-trash-can" class="danger-text" :disabled="blocks.length <= 1" :aria-label="`删除第 ${index + 1} 块`" @click="drop(index)" />
                </div>
              </div>
              <span v-for="message in messagesOf(`blocks[${index}]`)" :key="message" class="field-error" role="alert">{{ message }}</span>

              <FieldRow v-if="block.kind === 'paragraph'" label="段落" :messages="messagesOf(blockField(index, 'text'))">
                <template #default="field">
                  <TxTextarea v-bind="field" v-model="block.text" :rows="4" :max-length="limits.paragraph" show-count :data-field="blockField(index, 'text')" :status="statusOf(blockField(index, 'text'))" />
                </template>
              </FieldRow>

              <template v-else-if="block.kind === 'list'">
                <FieldRow label="标题（选填）" :messages="messagesOf(blockField(index, 'title'))">
                  <template #default="field">
                    <TxInput v-bind="field" v-model="block.title" class="fill-width" autocomplete="off" :data-field="blockField(index, 'title')" :maxlength="limits.title" />
                  </template>
                </FieldRow>
                <FieldRow label="要点（一行一条）" :messages="messagesOf(blockField(index, 'items'))" :hint="`最多 ${limits.listItems} 条。整条只写 {{说明}} 时，填的说明每一行是一条。`">
                  <template #default="field">
                    <TxTextarea v-bind="field" v-model="block.items" :rows="4" :data-field="blockField(index, 'items')" :status="statusOf(blockField(index, 'items'))" />
                  </template>
                </FieldRow>
              </template>

              <template v-else-if="block.kind === 'facts'">
                <FieldRow label="标题（选填）" :messages="messagesOf(blockField(index, 'title'))">
                  <template #default="field">
                    <TxInput v-bind="field" v-model="block.title" class="fill-width" autocomplete="off" :data-field="blockField(index, 'title')" :maxlength="limits.title" />
                  </template>
                </FieldRow>
                <ul class="rows">
                  <li v-for="(row, rowIndex) in block.rows" :key="row.uid" class="row">
                    <FieldRow :label="`第 ${rowIndex + 1} 行的名称`" :messages="messagesOf(factField(index, rowIndex, 'label'))">
                      <template #default="field">
                        <TxInput v-bind="field" v-model="row.label" class="fill-width" autocomplete="off" :data-field="factField(index, rowIndex, 'label')" :maxlength="limits.factLabel" />
                      </template>
                    </FieldRow>
                    <FieldRow :label="`第 ${rowIndex + 1} 行的内容`" :messages="messagesOf(factField(index, rowIndex, 'value'))">
                      <template #default="field">
                        <TxInput v-bind="field" v-model="row.value" class="fill-width" autocomplete="off" :data-field="factField(index, rowIndex, 'value')" :maxlength="limits.factValue" />
                      </template>
                    </FieldRow>
                    <div class="row__tools">
                      <TxButton size="sm" variant="ghost" icon="i-carbon-trash-can" class="danger-text" :disabled="block.rows.length <= 1" :aria-label="`删除第 ${index + 1} 块的第 ${rowIndex + 1} 行`" @click="block.rows.splice(rowIndex, 1)">删除这一行</TxButton>
                    </div>
                  </li>
                </ul>
                <TxButton size="sm" variant="secondary" icon="i-carbon-add" :disabled="block.rows.length >= limits.factItems" @click="block.rows.push(blankFact())">加一行</TxButton>
                <span v-for="message in messagesOf(`blocks[${index}].items`)" :key="message" class="field-error" role="alert">{{ message }}</span>
              </template>

              <template v-else>
                <FieldRow label="标题" :messages="messagesOf(blockField(index, 'title'))" required>
                  <template #default="field">
                    <TxInput v-bind="field" v-model="block.title" class="fill-width" autocomplete="off" :data-field="blockField(index, 'title')" :maxlength="limits.title" />
                  </template>
                </FieldRow>
                <FieldRow label="引用的内容" :messages="messagesOf(blockField(index, 'text'))" required>
                  <template #default="field">
                    <TxTextarea v-bind="field" v-model="block.text" :rows="3" :max-length="limits.quote" show-count :data-field="blockField(index, 'text')" :status="statusOf(blockField(index, 'text'))" />
                  </template>
                </FieldRow>
              </template>
            </li>
          </ol>
          <div class="blocks__add">
            <span class="blocks__add-label">加一块：</span>
            <TxButton v-for="kind in blockKinds" :key="kind.id" size="sm" variant="secondary" icon="i-carbon-add" :disabled="!addable" @click="add(kind.id)">{{ kind.label }}</TxButton>
          </div>
        </section>

        <section class="editor__section" aria-labelledby="button-heading">
          <h3 id="button-heading" class="editor__heading">按钮</h3>
          <TxCheckbox v-model="draft.buttonOn" label="信的末尾放一个按钮" />
          <div v-if="draft.buttonOn" class="form-grid">
            <FieldRow label="按钮文字" :messages="messagesOf('button.label')" required>
              <template #default="field">
                <TxInput v-bind="field" v-model="draft.buttonLabel" class="fill-width" autocomplete="off" data-field="button.label" :maxlength="limits.buttonLabel" />
              </template>
            </FieldRow>
            <FieldRow label="按钮指向" :messages="messagesOf('button.path') ?? messagesOf('button')" hint="官网里的页面，路径从 / 开始，例如 /forum/；不能指向官网以外的地址。" required>
              <template #default="field">
                <TxInput v-bind="field" v-model="draft.buttonPath" class="fill-width mono" autocomplete="off" spellcheck="false" :maxlength="limits.buttonPath" />
              </template>
            </FieldRow>
          </div>
        </section>

        <section class="editor__section" aria-labelledby="footer-heading">
          <h3 id="footer-heading" class="editor__heading">页脚</h3>
          <FieldRow label="信纸下面的小字（一行一条）" :messages="messagesOf('footer')" :hint="`最多 ${limits.footerLines} 行，每行最多 ${limits.footerLine} 个字。`">
            <template #default="field">
              <TxTextarea v-bind="field" v-model="draft.footer" :rows="3" data-field="footer" :status="statusOf('footer')" />
            </template>
          </FieldRow>
        </section>
      </TxForm>

      <div class="editor__save">
        <p v-if="issueTotal" class="field-error" role="alert">有 {{ issueTotal }} 处要先改，已经标在对应的输入框下面。</p>
        <p v-for="message in issues.general" :key="message" class="field-error" role="alert">{{ message }}</p>
        <ErrorAlert v-if="error" :error="error" @close="$emit('closeError')" />
        <div class="editor__buttons">
          <TxButton variant="primary" :loading="saving" :disabled="!isNew && !dirty" @click="$emit('save')">{{ isNew ? "保存为新模板" : "保存" }}</TxButton>
          <TxButton v-if="dirty" variant="secondary" :disabled="saving" @click="$emit('discard')">{{ isNew ? "不新建了" : "放弃修改" }}</TxButton>
        </div>
      </div>
    </div>
  </TxCard>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.editor__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--tx-border-color-lighter);
}
.editor__heading {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--tx-text-color-primary);
}
.hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.field-error {
  display: block;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  color: var(--tx-color-danger);
}
.vars {
  margin-top: 16px;
}
.vars__group {
  margin-top: 10px;
}
.vars__label {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: var(--tx-text-color-secondary);
}
.vars__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.vars__chip {
  min-height: 32px;
}
.vars__desc {
  margin: 10px 0 0;
  min-height: 20px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  color: var(--tx-text-color-regular);
}
.blocks {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: var(--tx-border-radius-base);
  background: var(--tx-fill-color-lighter);
}
.block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}
.block__kind {
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.block__tools {
  display: flex;
  gap: 2px;
}
.block__tools :deep(button),
.row__tools :deep(button) {
  min-width: 36px;
  min-height: 36px;
}
.blocks__add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.blocks__add-label {
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  gap: 0 12px;
  align-items: start;
}
.row__tools {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
}
.danger-text {
  color: var(--tx-color-danger);
}
.editor__save {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid var(--tx-border-color-lighter);
}
.editor__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.editor__buttons :deep(button) {
  min-height: 40px;
}
@media (max-width: 640px) {
  .row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
