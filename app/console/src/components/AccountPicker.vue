<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { TxSearchSelect } from "@talex-touch/tuffex/search-select";
import { api } from "../lib/http";
import { describeError } from "../lib/errors";
import { nameOf } from "../lib/users";
import type { ConsoleUser, UsersResponse } from "../lib/types";

/**
 * 选一个账号：按用户名或昵称搜 GET /api/console/users?q=（要「查看用户」权限），值是 account_id。
 * TxSearchSelect 只在选中项还在 options 里时显示它的名字，所以选中的那一项一直留在列表里；
 * 没结果、出错时放一条不能选的说明，替掉组件自带的英文空状态。`initialText` 是地址栏带进来的值的显示名。
 */
const props = withDefaults(defineProps<{ modelValue: string; label: string; placeholder?: string; initialText?: string; disabled?: boolean }>(), {
  placeholder: "搜索用户名或昵称", initialText: "", disabled: false,
});
const emit = defineEmits<{ "update:modelValue": [value: string]; pick: [user: ConsoleUser | null] }>();

type Option = { value: string; label: string; disabled?: boolean };
const optionText = (user: Pick<ConsoleUser, "display_name" | "username">) => `${nameOf(user)} @${user.username}`;

const results = ref<ConsoleUser[]>([]);
const loading = ref(false);
const failure = ref<string | null>(null);
const searched = ref("");
const picked = ref<Option | null>(props.modelValue ? { value: props.modelValue, label: props.initialText || props.modelValue } : null);
watch(() => props.modelValue, value => {
  if (!value) picked.value = null;
  else if (picked.value?.value !== value) picked.value = { value, label: props.initialText || value };
});
// 地址栏只带了编号，名字是页面读到数据后才知道的：知道了就换上。
watch(() => props.initialText, text => {
  if (text && picked.value && picked.value.label === picked.value.value) picked.value = { ...picked.value, label: text };
});

let seq = 0;
async function search(query: string) {
  const text = query.trim();
  searched.value = text;
  const mine = ++seq;
  if (!text) {
    results.value = [];
    failure.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const data = await api<UsersResponse>(`/api/console/users?${new URLSearchParams({ q: text })}`);
    if (mine !== seq) return;
    results.value = data.items.slice(0, 8);
    failure.value = null;
  } catch (error) {
    if (mine !== seq) return;
    results.value = [];
    failure.value = describeError(error).title;
  } finally {
    if (mine === seq) loading.value = false;
  }
}

const options = computed<Option[]>(() => {
  const list: Option[] = results.value.map(user => ({ value: user.account_id, label: optionText(user) }));
  if (picked.value && !list.some(option => option.value === picked.value!.value)) list.unshift(picked.value);
  if (!loading.value && !results.value.length) {
    const hint = failure.value ?? (searched.value ? `没有找到「${searched.value}」` : "输入用户名或昵称搜索");
    list.push({ value: "__hint", label: hint, disabled: true });
  }
  return list;
});

function onChange(value: string | number) {
  const id = String(value);
  if (id === "__hint") return;
  if (!id) {
    picked.value = null;
    emit("update:modelValue", "");
    emit("pick", null);
    return;
  }
  const user = results.value.find(item => item.account_id === id) ?? null;
  if (user) picked.value = { value: id, label: optionText(user) };
  emit("update:modelValue", id);
  emit("pick", user);
}
</script>

<template>
  <!-- TxSearchSelect 0.6.0 的 attrs 落在外层，用 label 给里面的输入框命名。 -->
  <label class="account-picker">
    <span class="sr-only">{{ label }}</span>
    <TxSearchSelect
      :model-value="modelValue"
      :options="options"
      :loading="loading"
      :placeholder="placeholder"
      :disabled="disabled"
      remote
      :search-debounce="250"
      panel-background="pure"
      @search="search"
      @change="onChange"
    />
  </label>
</template>

<style scoped>
.account-picker {
  display: block;
  width: 100%;
  min-width: 0;
}
</style>
