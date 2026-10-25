<script setup lang="ts">
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import ToneTag from "../../components/ToneTag.vue";
import { templateFlags, type KindGroup } from "../../lib/mail-templates";
import type { MailKind, MailTemplate } from "../../lib/types";

/** 左边的模板列表：按信的类别分组，每套可以选中编辑、复制、设为默认、停用或启用、删除。 */
defineProps<{ groups: KindGroup[]; selectedId: string | null; busy: boolean }>();
defineEmits<{
  select: [template: MailTemplate];
  create: [kind: MailKind];
  copy: [template: MailTemplate];
  toggle: [template: MailTemplate];
  makeDefault: [template: MailTemplate];
  remove: [template: MailTemplate];
}>();
</script>

<template>
  <div class="tpl-groups">
    <TxCard v-for="group in groups" :key="group.kind">
      <template #header>
        <div class="card-head">
          <h2 class="section-title">{{ group.label }}</h2>
          <span class="count">{{ group.templates.length }} 套</span>
          <div class="card-head__actions">
            <TxButton size="sm" variant="secondary" icon="i-carbon-add" :disabled="busy" :aria-label="`新建一套「${group.label}」的信`" @click="$emit('create', group.kind)">新建</TxButton>
          </div>
        </div>
      </template>
      <p v-if="!group.templates.length" class="tpl-empty">还没有模板。发这一类的信时用代码里内置的文字，新建一套以后改用你的。</p>
      <ul v-else class="tpl-list">
        <li v-for="template in group.templates" :key="template.id" class="tpl" :class="{ 'is-selected': template.id === selectedId, 'is-off': !template.enabled }">
          <button type="button" class="tpl__main" :aria-current="template.id === selectedId ? 'true' : undefined" @click="$emit('select', template)">
            <span class="tpl__name">
              <span class="tpl__title">{{ template.name }}</span>
              <ToneTag v-for="flag in templateFlags(template)" :key="flag" :tone="flag === '默认' ? 'jade' : 'slate'" :label="flag" />
            </span>
            <span class="tpl__subject">{{ template.subject }}</span>
          </button>
          <div class="tpl__actions">
            <TxButton size="sm" variant="ghost" :disabled="busy" :aria-label="`复制「${template.name}」`" @click="$emit('copy', template)">复制</TxButton>
            <TxButton v-if="!template.is_default && template.enabled" size="sm" variant="ghost" :disabled="busy" :aria-label="`把「${template.name}」设为${group.label}的默认`" @click="$emit('makeDefault', template)">设为默认</TxButton>
            <TxButton v-if="!template.is_default" size="sm" variant="ghost" :disabled="busy" :aria-label="`${template.enabled ? '停用' : '启用'}「${template.name}」`" @click="$emit('toggle', template)">{{ template.enabled ? "停用" : "启用" }}</TxButton>
            <TxButton v-if="!template.is_default" size="sm" variant="ghost" class="tpl__remove" :disabled="busy" :aria-label="`删除「${template.name}」`" @click="$emit('remove', template)">删除</TxButton>
          </div>
        </li>
      </ul>
    </TxCard>
  </div>
</template>

<style scoped>
.tpl-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.tpl-empty {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.tpl-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tpl {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 8px 6px;
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
  padding: 2px 4px;
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
  overflow-wrap: anywhere;
}
.tpl__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 2px;
}
.tpl__remove {
  color: var(--tx-color-danger);
}
.tpl__actions :deep(button) {
  min-height: 36px;
}
</style>
