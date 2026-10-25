<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxNumberInput } from "@talex-touch/tuffex/number-input";
import { TxRadioGroup, TxRadio } from "@talex-touch/tuffex/radio";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { toast } from "@talex-touch/tuffex/utils";
import PageHeader from "../../components/PageHeader.vue";
import ErrorPanel from "../../components/ErrorPanel.vue";
import ErrorAlert from "../../components/ErrorAlert.vue";
import LoadingBlock from "../../components/LoadingBlock.vue";
import { api, jsonBody } from "../../lib/http";
import { useAction, useResource } from "../../lib/resource";
import type { GitlabSettings, GitlabSyncMode } from "../../lib/types";

/** GitLab 设置（CONTRACT §6）：同步模式、群组路径、同步间隔存在数据库里；令牌只在目标机的环境变量里，这里只显示配没配。 */
const settings = useResource(() => api<GitlabSettings>("/api/console/gitlab/settings"));
type Form = { sync_mode: GitlabSyncMode; group_path: string; interval_minutes: number | null };
const form = reactive<Form>({ sync_mode: "off", group_path: "", interval_minutes: 60 });
const fill = (data: GitlabSettings) => Object.assign(form, { sync_mode: data.sync_mode, group_path: data.group_path, interval_minutes: data.interval_minutes });
watch(() => settings.data.value, data => { if (data) fill(data); }, { immediate: true });

const MODES: { value: GitlabSyncMode; label: string; hint: string }[] = [
  { value: "off", label: "关闭", hint: "不建号、不封禁，也不改群组。" },
  { value: "dry-run", label: "预演", hint: "只算出要做的事，在账号同步里列出来，不改 GitLab。" },
  { value: "on", label: "打开", hint: "按间隔自动建号、封禁、调整组权限。" },
];

const problem = ref<string | null>(null);
function check(): string | null {
  const path = form.group_path.trim();
  if (!/^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*$/.test(path)) return "群组路径只用字母、数字、点、横线和下划线，子群组用 / 隔开";
  const minutes = form.interval_minutes;
  if (minutes === null || !Number.isInteger(minutes) || minutes < 5 || minutes > 1440) return "同步间隔填 5–1440 的整数";
  return null;
}
const changed = computed(() => {
  const data = settings.data.value;
  return Boolean(data) && (form.sync_mode !== data!.sync_mode || form.group_path.trim() !== data!.group_path || form.interval_minutes !== data!.interval_minutes);
});
const save = useAction(async () => {
  problem.value = check();
  if (problem.value) return;
  const updated = await api<GitlabSettings>("/api/console/gitlab/settings", {
    method: "PATCH",
    ...jsonBody({ sync_mode: form.sync_mode, group_path: form.group_path.trim(), interval_minutes: form.interval_minutes }),
  });
  fill(updated);
  toast({ title: "已保存", description: "下一轮同步按新的设置执行", variant: "success" });
  await settings.reload();
});
</script>

<template>
  <div class="page">
    <PageHeader title="GitLab 设置" description="同步模式、群组路径和同步间隔。令牌只在服务器的环境变量里配置，这里不能改。" />

    <ErrorPanel v-if="settings.error.value" :error="settings.error.value" :retry="settings.reload" />
    <LoadingBlock v-else-if="!settings.data.value" :lines="6" />
    <TxCard v-else>
      <TxForm :model="form" label-position="top" class="settings-form" @submit="save.execute()">
        <TxFormItem label="同步模式">
          <TxRadioGroup v-model="form.sync_mode" type="card" direction="row" class="modes" aria-label="同步模式">
            <TxRadio v-for="mode in MODES" :key="mode.value" :value="mode.value">
              <span class="mode">
                <span class="mode__label">{{ mode.label }}</span>
                <span class="mode__hint">{{ mode.hint }}</span>
              </span>
            </TxRadio>
          </TxRadioGroup>
        </TxFormItem>
        <TxFormItem label="群组路径">
          <TxInput v-model="form.group_path" class="fill-width mono" spellcheck="false" autocomplete="off" placeholder="例如 geek" />
          <span class="field-hint">极客班成员会被加进这个群组。</span>
        </TxFormItem>
        <TxFormItem label="同步间隔（分钟，5–1440）">
          <TxNumberInput v-model="form.interval_minutes" :min="5" :max="1440" :step="5" decrease-label="减少" increase-label="增加" class="fill-width" />
        </TxFormItem>
        <TxFormItem label="令牌">
          <TxStatusBadge :text="settings.data.value.token_configured ? '已配置' : '未配置'" :status="settings.data.value.token_configured ? 'success' : 'warning'" />
          <span v-if="!settings.data.value.token_configured" class="field-hint">没有令牌，同步没法调用 GitLab。令牌由维护者在服务器上配置。</span>
        </TxFormItem>
        <p v-if="problem" class="field-error" role="alert">{{ problem }}</p>
        <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
        <div class="form-actions">
          <TxButton variant="secondary" native-type="button" :disabled="!changed || save.pending.value" @click="fill(settings.data.value!); problem = null">还原</TxButton>
          <TxButton variant="primary" native-type="submit" :disabled="!changed" :loading="save.pending.value">保存</TxButton>
        </div>
      </TxForm>
    </TxCard>
  </div>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 720px;
}
.settings-form :deep(.tx-input) {
  min-height: 44px;
}
.modes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}
.modes :deep(.tx-radio) {
  min-height: 44px;
  align-items: flex-start;
}
.mode {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mode__label {
  font-weight: 500;
}
.mode__hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.field-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.field-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--tx-color-danger);
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.form-actions :deep(button) {
  min-height: 44px;
  min-width: 44px;
}
@media (max-width: 640px) {
  .modes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
