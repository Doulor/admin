<script setup lang="ts">
import { TxSelect } from "@talex-touch/tuffex/select";
import type { StatusRoute } from "../../lib/mail-templates";
import type { MailKind, MailTemplate } from "../../lib/types";

/**
 * 「状态与模板」：每个投递状态发信用哪一套。选的就是这一类的默认模板，改投递状态时不特别指定就用它。
 * 「已收到」在投递提交后自动发，另外三种在投递详情页改成对应的状态时发。
 */
defineProps<{ routes: StatusRoute[]; busy: boolean }>();
const emit = defineEmits<{ choose: [template: MailTemplate] }>();

const WHEN: Record<MailKind, string> = {
  received: "投递提交后自动发",
  interview: "改成「待面试」时发",
  accepted: "改成「已录取」时发",
  rejected: "改成「未通过」时发",
};
const options = (route: StatusRoute) => route.choices.map(item => ({ value: item.id, label: item.name }));
function pick(route: StatusRoute, id: unknown) {
  const next = route.choices.find(item => item.id === id);
  if (next && next.id !== route.current?.id) emit("choose", next);
}
</script>

<template>
  <section class="routes" aria-label="状态与模板">
    <article v-for="route in routes" :key="route.kind" class="route">
      <header class="route__head">
        <h2 class="route__title">{{ route.label }}</h2>
        <span class="route__when">{{ WHEN[route.kind] }}</span>
      </header>
      <template v-if="route.choices.length">
        <label class="route__pick">
          <span class="sr-only">「{{ route.label }}」发信用的模板</span>
          <TxSelect :model-value="route.current?.id ?? ''" :options="options(route)" :searchable="false" :disabled="busy" class="fill-width" panel-background="pure" @update:model-value="pick(route, $event)" />
        </label>
        <p class="route__subject" :title="route.current?.subject">{{ route.current ? `主题：${route.current.subject}` : "没有默认的一套，发信时用代码里内置的文字。" }}</p>
      </template>
      <p v-else class="route__subject">还没有可用的模板，发信时用代码里内置的文字。</p>
    </article>
  </section>
</template>

<style scoped>
.routes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-content: start;
  gap: 12px;
}
.route {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: var(--tx-border-radius-base);
  background: var(--tx-bg-color-overlay, #fff);
}
.route__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}
.route__title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 600;
  color: var(--tx-text-color-primary);
}
.route__when {
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
}
.route__pick {
  display: block;
  min-width: 0;
}
.route__subject {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 1179px) {
  .routes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .routes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
