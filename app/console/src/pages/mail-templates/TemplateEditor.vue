<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxCheckbox } from "@talex-touch/tuffex/checkbox";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxCollapse, TxCollapseItem } from "@talex-touch/tuffex/collapse";
import ToneTag from "../../components/ToneTag.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import FieldRow from "./FieldRow.vue";
import {
  insertFence, insertVariable, issueCount, variableToken, variablesFor,
  type Caret, type FenceKind, type FieldIssues, type TemplateDraft,
} from "../../lib/mail-templates";
import type { MailTemplateLimits, MailVariable } from "../../lib/types";

/**
 * 模板编辑区，像写一份 Markdown：名称在顶上，主题和抬头两行，下面是一个正文输入框（空一行是新的一段，
 * 要点列表、信息表、引用用工具栏插入一段写法），变量一键插到光标处，摘要、小标题、按钮、页脚收在「更多设置」里。
 * 右边的预览随输入更新。草稿 draft 由页面持有，这里直接改它的字段；保存、放弃交给页面。
 */
const props = defineProps<{
  draft: TemplateDraft;
  limits: MailTemplateLimits;
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

// ---- 插入：记住最近一次点过或打过字的输入框和光标位置，没点过就是正文末尾 ----

const root = ref<HTMLElement>();
const target = ref<{ field: string; caret: Caret | null }>({ field: "body", caret: null });
const described = ref<MailVariable | null>(null);
const variableExample = variableToken("称呼");
const showVariables = ref(false);
const showHelp = ref(false);
const more = ref<string[]>([]);

const isText = (el: unknown): el is HTMLInputElement | HTMLTextAreaElement => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

function track(event: Event) {
  const el = event.target;
  if (!isText(el)) return;
  const field = el.closest<HTMLElement>("[data-field]")?.dataset.field;
  if (!field) return;
  target.value = { field, caret: { start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length } };
}

async function focusAt(field: string, caret: number) {
  await nextTick();
  await nextTick();
  const holder = root.value?.querySelector<HTMLElement>(`[data-field="${field}"]`);
  const el = isText(holder) ? holder : holder?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  el?.focus();
  el?.setSelectionRange(caret, caret);
}

async function insert(name: string) {
  const at = target.value;
  const caret = insertVariable(props.draft, at, name);
  if (caret === null) return;
  target.value = { field: at.field, caret: { start: caret, end: caret } };
  await focusAt(at.field, caret);
}

async function fence(kind: FenceKind) {
  const at = target.value.field === "body" ? target.value.caret : null;
  const next = insertFence(props.draft.body, at, kind);
  props.draft.body = next.value;
  target.value = { field: "body", caret: { start: next.caret, end: next.caret } };
  await focusAt("body", next.caret);
}
</script>

<template>
  <section class="editor" aria-label="编辑模板">
    <header class="editor__bar">
      <label class="editor__name">
        <span class="sr-only">模板名称</span>
        <TxInput v-model="draft.name" class="fill-width" autocomplete="off" :maxlength="limits.name" placeholder="给这一套起个名字" />
      </label>
      <ToneTag tone="sky" :label="kindLabel" />
      <div class="editor__actions">
        <span v-if="dirty" class="editor__dirty">有没保存的修改</span>
        <TxButton v-if="dirty" variant="ghost" :disabled="saving" @click="$emit('discard')">{{ isNew ? "不新建了" : "放弃修改" }}</TxButton>
        <TxButton variant="primary" :loading="saving" :disabled="!isNew && !dirty" @click="$emit('save')">{{ isNew ? "保存为新模板" : "保存" }}</TxButton>
      </div>
    </header>

    <div ref="root" class="editor__scroll" @focusin="track" @click="track" @keyup="track" @input="track">
      <span v-for="message in messagesOf('name')" :key="message" class="field-error" role="alert">{{ message }}</span>
      <div v-if="issueTotal || issues.general.length" class="editor__issues">
        <p v-if="issueTotal" class="field-error" role="alert">有 {{ issueTotal }} 处要先改，已经标在对应的输入框下面。</p>
        <p v-for="message in issues.general" :key="message" class="field-error" role="alert">{{ message }}</p>
      </div>
      <ErrorAlert v-if="error" :error="error" @close="$emit('closeError')" />

      <div class="head">
        <label class="head__line">
          <span class="head__label">主题</span>
          <TxInput v-model="draft.subject" class="fill-width" autocomplete="off" data-field="subject" :maxlength="limits.subject" />
        </label>
        <span v-for="message in messagesOf('subject')" :key="message" class="field-error" role="alert">{{ message }}</span>
        <label class="head__line">
          <span class="head__label">抬头</span>
          <TxInput v-model="draft.greeting" class="fill-width" autocomplete="off" data-field="greeting" :maxlength="limits.greeting" />
        </label>
        <span v-for="message in messagesOf('greeting')" :key="message" class="field-error" role="alert">{{ message }}</span>
      </div>

      <div class="toolbar" role="toolbar" aria-label="正文工具栏">
        <span class="toolbar__label">正文</span>
        <TxButton size="sm" variant="secondary" icon="i-carbon-list-bulleted" @mousedown.prevent @click="fence('list')">要点列表</TxButton>
        <TxButton size="sm" variant="secondary" icon="i-carbon-table" @mousedown.prevent @click="fence('facts')">信息表</TxButton>
        <TxButton size="sm" variant="secondary" icon="i-carbon-quotes" @mousedown.prevent @click="fence('quote')">引用</TxButton>
        <TxButton size="sm" :variant="showVariables ? 'primary' : 'secondary'" icon="i-carbon-code" :aria-expanded="showVariables" @mousedown.prevent @click="showVariables = !showVariables">插入变量</TxButton>
        <TxButton class="toolbar__help" size="sm" variant="ghost" :aria-expanded="showHelp" @click="showHelp = !showHelp">写法说明</TxButton>
      </div>

      <div v-if="showVariables" class="vars">
        <p class="hint">点一下变量，放进光标所在的位置。信发出去时它会换成投递人的真实内容；只有这里列出的变量能用。</p>
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
      </div>

      <div v-if="showHelp" class="help">
        <p>空一行，是新的一段。变量写成 <span class="mono">{{ variableExample }}</span>。</p>
        <p>要点列表：先写 <span class="mono">:::要点</span>，下面一行一条，最后一行写 <span class="mono">:::</span>；<span class="mono">:::要点 面试说明</span> 可以加标题。</p>
        <p>信息表：先写 <span class="mono">:::信息</span>，下面一行一项，写成 <span class="mono">名称：内容</span>，最后一行写 <span class="mono">:::</span>。</p>
        <p>引用：先写 <span class="mono">:::引用 标题</span>，下面写引用的话，最后一行写 <span class="mono">:::</span>。</p>
        <p>最多 {{ limits.blocks }} 块，信里全部文字加起来最多 {{ limits.totalText }} 个字。</p>
      </div>

      <TxTextarea
        v-model="draft.body"
        class="editor__body"
        data-field="body"
        resize="none"
        placeholder="在这里写信的正文。空一行是新的一段；要点列表、信息表、引用点上面的按钮。"
        :status="statusOf('body')"
        aria-label="正文"
      />
      <span v-for="message in messagesOf('body')" :key="message" class="field-error" role="alert">{{ message }}</span>

      <TxCollapse v-model="more" class="more">
        <TxCollapseItem name="more" title="更多设置：摘要、小标题、按钮、页脚">
          <div class="more__body">
            <FieldRow label="摘要" :messages="messagesOf('preheader')" hint="收件箱列表里主题后面露出的一行。">
              <template #default="field">
                <TxInput v-bind="field" v-model="draft.preheader" class="fill-width" autocomplete="off" data-field="preheader" :maxlength="limits.preheader" />
              </template>
            </FieldRow>
            <FieldRow label="小标题" :messages="messagesOf('kicker')" hint="信纸左上角的小字。">
              <template #default="field">
                <TxInput v-bind="field" v-model="draft.kicker" class="fill-width" autocomplete="off" data-field="kicker" :maxlength="limits.kicker" />
              </template>
            </FieldRow>
            <TxCheckbox v-model="draft.buttonOn" label="信的末尾放一个按钮" />
            <template v-if="draft.buttonOn">
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
            </template>
            <FieldRow label="页脚（信纸下面的小字，一行一条）" :messages="messagesOf('footer')" :hint="`最多 ${limits.footerLines} 行，每行最多 ${limits.footerLine} 个字。`">
              <template #default="field">
                <TxTextarea v-bind="field" v-model="draft.footer" :rows="3" data-field="footer" :status="statusOf('footer')" />
              </template>
            </FieldRow>
          </div>
        </TxCollapseItem>
      </TxCollapse>
    </div>
  </section>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.editor__bar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--tx-border-color-lighter);
}
.editor__name {
  flex: 1 1 160px;
  min-width: 0;
}
.editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-left: auto;
}
.editor__dirty {
  font-size: 12px;
  color: var(--tx-color-warning);
}
.editor__scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
}
.editor__issues {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-error {
  display: block;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  color: var(--tx-color-danger);
}
.hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.head {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 8px;
}
.head__line {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.head__label {
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.toolbar__label {
  margin-right: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-text-color-primary);
}
.toolbar__help {
  margin-left: auto;
}
.vars,
.help {
  flex: none;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
  border-radius: var(--tx-border-radius-base);
  background: var(--tx-fill-color-lighter);
}
.vars__group {
  margin-top: 8px;
}
.vars__label {
  margin: 0 0 4px;
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
  min-height: 30px;
}
.vars__desc {
  margin: 8px 0 0;
  min-height: 20px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  color: var(--tx-text-color-regular);
}
.help p {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 21px;
  color: var(--tx-text-color-regular);
}
.help p:last-child {
  margin-bottom: 0;
}
.editor__body {
  flex: 1 1 320px;
  min-height: 260px;
}
.editor__body :deep(.tx-textarea__field) {
  font-size: 14px;
  line-height: 1.75;
}
.more {
  flex: none;
}
.more__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
