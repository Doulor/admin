<script setup lang="ts">
import { computed, ref } from "vue";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxTextarea } from "@talex-touch/tuffex/textarea";
import { TxFormItem } from "@talex-touch/tuffex/form";
import { TxCollapse, TxCollapseItem } from "@talex-touch/tuffex/collapse";
import MailPreviewFrame from "../../components/MailPreviewFrame.vue";
import type { PreviewLetter, PreviewSample, PreviewState } from "../../lib/mail-templates";
import type { MailKind } from "../../lib/types";

/**
 * 右边的实时预览：左边每改一下，停手以后按当前内容重新渲染（lib/mail-templates.ts 的 createPreviewer）。
 * 预览用示例投递人，可以在下面换一份示例数据看长名字、长说明排出来什么样；不发信，也不动任何投递记录。
 */
const props = defineProps<{ state: PreviewState; kind: MailKind; sample: PreviewSample; letter: PreviewLetter }>();
defineEmits<{ refresh: [] }>();

const open = ref<string[]>([]);
const status = computed(() => {
  if (props.state.phase === "loading") return "正在更新";
  if (props.state.phase === "error") return "这一版渲染不出来";
  return props.state.phase === "ready" ? "已更新" : "";
});
</script>

<template>
  <TxCard>
    <template #header>
      <div class="card-head">
        <h2 class="section-title">预览</h2>
        <span class="count" role="status" aria-live="polite">{{ status }}</span>
        <div class="card-head__actions">
          <TxButton size="sm" variant="secondary" icon="i-carbon-renew" :loading="state.phase === 'loading'" @click="$emit('refresh')">刷新预览</TxButton>
        </div>
      </div>
    </template>
    <p class="hint">用示例投递人渲染，不会发出任何邮件，也不改任何投递记录。</p>
    <p v-if="state.phase === 'error'" class="preview-error" role="alert">{{ state.message }}</p>
    <MailPreviewFrame
      class="preview-frame"
      :html="state.rendered?.html ?? null"
      :text="state.rendered?.text ?? null"
      :subject="state.rendered?.subject ?? ''"
      :stale="state.phase === 'error'"
    />
    <TxCollapse v-model="open" class="sample">
      <TxCollapseItem name="sample" title="换一份示例数据">
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
      </TxCollapseItem>
    </TxCollapse>
  </TxCard>
</template>

<style scoped>
.hint {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.preview-error {
  margin: 0 0 10px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  border-radius: var(--tx-border-radius-base);
  color: var(--tx-color-danger);
  background: var(--tx-color-danger-light-9);
}
.preview-frame {
  --mail-frame-height: clamp(380px, calc(100vh - 380px), 640px);
}
.sample {
  margin-top: 12px;
}
</style>
