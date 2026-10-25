<script setup lang="ts">
import { computed, ref } from "vue";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxFilterChips } from "@talex-touch/tuffex/filter-chips";
import ToneTag from "../../components/ToneTag.vue";
import { templateFlags, type KindGroup } from "../../lib/mail-templates";
import type { MailKind, MailTemplate } from "../../lib/types";

/** 模板库：所有模板一眼看全，可以按状态筛选；点一套就在编辑区打开，复制、设为默认、停用、删除只出现在选中的那一套下面。 */
const props = defineProps<{ groups: KindGroup[]; selectedId: string | null; busy: boolean }>();
const emit = defineEmits<{
  select: [template: MailTemplate];
  create: [kind: MailKind];
  copy: [template: MailTemplate];
  toggle: [template: MailTemplate];
  makeDefault: [template: MailTemplate];
  remove: [template: MailTemplate];
}>();

const filter = ref("");
const creating = ref(false);
const total = computed(() => props.groups.reduce((sum, group) => sum + group.templates.length, 0));
const chips = computed(() => [
  { value: "", label: "全部", count: total.value },
  ...props.groups.map(group => ({ value: group.kind, label: group.label, count: group.templates.length })),
]);
const shown = computed(() => (filter.value ? props.groups.filter(group => group.kind === filter.value) : props.groups));
const labelOf = (kind: MailKind) => props.groups.find(group => group.kind === kind)?.label ?? kind;
function create(kind: MailKind) {
  creating.value = false;
  emit("create", kind);
}
</script>

<template>
  <section class="lib" aria-label="模板库">
    <header class="lib__head">
      <h2 class="section-title">模板库</h2>
      <span class="count">共 {{ total }} 套</span>
      <TxButton class="lib__add" size="sm" variant="secondary" icon="i-carbon-add" :disabled="busy" :aria-expanded="creating" @click="creating = !creating">新建</TxButton>
    </header>
    <div v-if="creating" class="lib__create" role="group" aria-label="给哪个状态新建一套">
      <span class="lib__create-label">给哪个状态新建：</span>
      <TxButton v-for="group in groups" :key="group.kind" size="sm" variant="secondary" @click="create(group.kind)">{{ group.label }}</TxButton>
    </div>
    <TxFilterChips v-model="filter" class="lib__chips" :items="chips" aria-label="按状态筛选模板" />
    <div class="lib__scroll">
      <section v-for="group in shown" :key="group.kind" class="lib__group" :aria-label="group.label">
        <h3 v-if="!filter" class="lib__group-title">{{ group.label }}<span class="count">{{ group.templates.length }}</span></h3>
        <p v-if="!group.templates.length" class="lib__empty">还没有模板，发这一类的信时用代码里内置的文字。</p>
        <ul v-else class="lib__list">
          <li v-for="template in group.templates" :key="template.id" class="tpl" :class="{ 'is-selected': template.id === selectedId, 'is-off': !template.enabled }">
            <button type="button" class="tpl__main" :aria-current="template.id === selectedId ? 'true' : undefined" @click="emit('select', template)">
              <span class="tpl__name">
                <span class="tpl__title">{{ template.name }}</span>
                <ToneTag v-for="flag in templateFlags(template)" :key="flag" :tone="flag === '默认' ? 'jade' : 'slate'" :label="flag" />
              </span>
              <span class="tpl__subject">{{ template.subject }}</span>
            </button>
            <div v-if="template.id === selectedId" class="tpl__actions">
              <TxButton size="sm" variant="ghost" :disabled="busy" :aria-label="`复制「${template.name}」`" @click="emit('copy', template)">复制</TxButton>
              <TxButton v-if="!template.is_default && template.enabled" size="sm" variant="ghost" :disabled="busy" :aria-label="`把「${template.name}」设为${labelOf(template.kind)}的默认`" @click="emit('makeDefault', template)">设为默认</TxButton>
              <TxButton v-if="!template.is_default" size="sm" variant="ghost" :disabled="busy" :aria-label="`${template.enabled ? '停用' : '启用'}「${template.name}」`" @click="emit('toggle', template)">{{ template.enabled ? "停用" : "启用" }}</TxButton>
              <TxButton v-if="!template.is_default" size="sm" variant="ghost" class="tpl__remove" :disabled="busy" :aria-label="`删除「${template.name}」`" @click="emit('remove', template)">删除</TxButton>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.lib {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 14px;
}
.lib__head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}
.lib__head .count {
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.lib__add {
  margin-left: auto;
}
.lib__create {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--tx-border-radius-base);
  background: var(--tx-fill-color-lighter);
}
.lib__create-label {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.lib__chips {
  flex: none;
  flex-wrap: wrap;
  max-width: 100%;
}
.lib__scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}
.lib__group-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: var(--tx-text-color-secondary);
}
.lib__empty {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.lib__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tpl {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: var(--tx-border-radius-base);
  background: var(--tx-bg-color-overlay, #fff);
}
.tpl.is-selected {
  border-color: var(--tx-color-primary);
  background: var(--tx-color-primary-light-9);
}
.tpl.is-off .tpl__title,
.tpl.is-off .tpl__subject {
  color: var(--tx-text-color-secondary);
}
.tpl__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  min-height: 44px;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--tx-border-radius-base);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.tpl__main:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--tx-color-primary) 40%, transparent);
  outline-offset: 1px;
}
.tpl__name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}
.tpl__title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: var(--tx-text-color-primary);
  overflow-wrap: anywhere;
}
.tpl__subject {
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 2px;
  padding: 0 6px 6px;
}
.tpl__actions :deep(button) {
  min-height: 32px;
}
.tpl__remove {
  color: var(--tx-color-danger);
}
</style>
