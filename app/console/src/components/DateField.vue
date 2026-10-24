<script setup lang="ts">
// 日期框（#283）：Tuffex 日期选择器配上控制台的默认值——中文文案、周一开头、桌面和手机都是下拉日历。
// 值和原来的原生日期框一样是 YYYY-MM-DD 字符串，空串表示没选；clearable 时选了以后旁边有「清除」。
import { TxDatePicker } from "@talex-touch/tuffex/date-picker";
import { TxButton } from "@talex-touch/tuffex/button";

const model = defineModel<string>({ default: "" });
withDefaults(defineProps<{ placeholder?: string; min?: string; max?: string; disabled?: boolean; clearable?: boolean }>(), {
  placeholder: "选择日期",
  min: undefined,
  max: undefined,
  disabled: false,
  clearable: false,
});
const pick = (value: string | [string, string]) => { model.value = typeof value === "string" ? value : value[0]; };
</script>

<template>
  <div class="date-field">
    <TxDatePicker
      class="date-field__picker"
      :model-value="model"
      variant="field"
      title="选择日期"
      :placeholder="placeholder"
      confirm-text="确定"
      cancel-text="取消"
      :week-starts-on="1"
      :min="min"
      :max="max"
      :disabled="disabled"
      @update:model-value="pick"
    />
    <TxButton v-if="clearable && model && !disabled" variant="ghost" size="sm" @click="model = ''">清除</TxButton>
  </div>
</template>

<style scoped>
.date-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}
.date-field__picker {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
