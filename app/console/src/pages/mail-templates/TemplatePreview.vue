<script setup lang="ts">
import { computed, ref } from "vue";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxFormItem } from "@talex-touch/tuffex/form";
import { TxModal } from "@talex-touch/tuffex/modal";
import MailPreviewFrame from "../../components/MailPreviewFrame.vue";
import TestSend from "./TestSend.vue";
import type { PreviewLetter, PreviewPayload, PreviewSample, PreviewState } from "../../lib/mail-templates";
import type { MailKind, MailTemplateList } from "../../lib/types";

/**
 * 预览栏：左边每改一下，停手以后按当前内容重新渲染（lib/mail-templates.ts 的 createPreviewer）。
 * 预览用示例投递人；「示例数据」换一份看长名字、长说明排出来什么样，「发测试邮件」把这一版发到你填的邮箱。
 * 两者都不发给任何投递人，也不动任何投递记录。
 */
const props = defineProps<{
  state: PreviewState;
  kind: MailKind;
  sample: PreviewSample;
  letter: PreviewLetter;
  payload: PreviewPayload;
  mail: MailTemplateList["mail"];
  quota: MailTemplateList["test_send"];
}>();
defineEmits<{ refresh: [] }>();
const testTo = defineModel<string>("testTo", { default: "" });

const sampleOpen = ref(false);
const testOpen = ref(false);
const status = computed(() => {
  if (props.state.phase === "loading") return "正在更新";
  if (props.state.phase === "error") return "这一版渲染不出来";
  return props.state.phase === "ready" ? "已更新" : "";
});
</script>

<template>
  <section class="preview" aria-label="预览">
    <header class="preview__bar">
      <h2 class="section-title">预览</h2>
      <span class="count" role="status" aria-live="polite">{{ status }}</span>
      <div class="preview__actions">
        <TxButton size="sm" variant="ghost" @click="sampleOpen = true">示例数据</TxButton>
        <TxButton size="sm" variant="ghost" icon="i-carbon-renew" :loading="state.phase === 'loading'" @click="$emit('refresh')">刷新</TxButton>
        <TxButton size="sm" variant="primary" icon="i-carbon-send" @click="testOpen = true">发测试邮件</TxButton>
      </div>
    </header>
    <p v-if="state.phase === 'error'" class="preview__error" role="alert">{{ state.message }}</p>
    <MailPreviewFrame
      class="preview__frame"
      :html="state.rendered?.html ?? null"
      :text="state.rendered?.text ?? null"
      :subject="state.rendered?.subject ?? ''"
      :stale="state.phase === 'error'"
    />

    <TxModal :model-value="sampleOpen" title="换一份示例数据" width="min(92vw, 480px)" @update:model-value="sampleOpen = $event">
      <div class="sample">
        <p class="hint">不填就用默认的示例。填了只影响预览和测试邮件。</p>
        <TxFormItem label="姓名">
          <template #default="field"><TxInput v-bind="field" v-model="sample.name" class="fill-width" autocomplete="off" placeholder="张三" :maxlength="200" /></template>
        </TxFormItem>
        <TxFormItem label="班级">
          <template #default="field"><TxInput v-bind="field" v-model="sample.class_name" class="fill-width" autocomplete="off" placeholder="计科 2301 班" :maxlength="200" /></template>
        </TxFormItem>
        <TxFormItem label="特长与优点">
          <template #default="field"><TxTextarea v-bind="field" v-model="sample.strengths" :rows="2" :max-length="5000" placeholder="做过一个课表小程序" /></template>
        </TxFormItem>
        <template v-if="kind === 'interview'">
          <TxFormItem label="面试时间">
            <template #default="field"><TxInput v-bind="field" v-model="letter.time" class="fill-width" autocomplete="off" placeholder="9 月 30 日（周三）19:00" :maxlength="200" /></template>
          </TxFormItem>
          <TxFormItem label="面试地点">
            <template #default="field"><TxInput v-bind="field" v-model="letter.place" class="fill-width" autocomplete="off" placeholder="东校区 3 教 301" :maxlength="300" /></template>
          </TxFormItem>
          <TxFormItem label="面试说明（一行一条）">
            <template #default="field"><TxTextarea v-bind="field" v-model="letter.notes" :rows="2" :max-length="5000" placeholder="带上学生证" /></template>
          </TxFormItem>
        </template>
        <TxFormItem v-else-if="kind === 'accepted'" label="接下来要做的事（一行一条）">
          <template #default="field"><TxTextarea v-bind="field" v-model="letter.notes" :rows="2" :max-length="5000" placeholder="加入新成员群" /></template>
        </TxFormItem>
        <TxFormItem v-else-if="kind === 'rejected'" label="写给投递人的话">
          <template #default="field"><TxTextarea v-bind="field" v-model="letter.message" :rows="2" :max-length="5000" placeholder="这一轮我们更想找做过后端项目的同学。" /></template>
        </TxFormItem>
      </div>
      <template #footer>
        <div class="dialog-actions"><TxButton variant="primary" @click="sampleOpen = false">完成</TxButton></div>
      </template>
    </TxModal>

    <TxModal :model-value="testOpen" title="发一封测试邮件" width="min(92vw, 480px)" @update:model-value="testOpen = $event">
      <TestSend v-model:to="testTo" :payload="payload" :mail="mail" :quota="quota" />
    </TxModal>
  </section>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 14px;
}
.preview__bar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.preview__bar .count {
  font-size: 13px;
  color: var(--tx-text-color-secondary);
}
.preview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.preview__error {
  flex: none;
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  border-radius: var(--tx-border-radius-base);
  color: var(--tx-color-danger);
  background: var(--tx-color-danger-light-9);
}
.preview__frame {
  flex: 1;
  min-height: 0;
}
.preview__frame :deep(.mail-frame__page),
.preview__frame :deep(.mail-frame__text),
.preview__frame :deep(.mail-frame__empty) {
  flex: 1;
  height: auto;
  min-height: 0;
}
.sample {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hint {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
