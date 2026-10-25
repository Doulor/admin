<script setup lang="ts">
import { TxFormItem } from "@talex-touch/tuffex/form";

/** 编辑页里一个带标签的输入：标签、控件、一句提示，服务端指出的问题写在控件下面。控件从插槽里放，拿到 id 和 aria 属性。 */
defineProps<{ label: string; hint?: string; messages?: string[]; required?: boolean }>();
</script>

<template>
  <TxFormItem :label="label" :required="required">
    <template #default="field">
      <slot v-bind="field" />
      <span v-for="message in messages" :key="message" class="field-error" role="alert">{{ message }}</span>
      <span v-if="hint && !messages?.length" class="field-hint">{{ hint }}</span>
    </template>
  </TxFormItem>
</template>

<style scoped>
.field-error,
.field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.field-error {
  color: var(--tx-color-danger);
}
.field-hint {
  color: var(--tx-text-color-secondary);
}
</style>
