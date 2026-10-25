<script setup lang="ts">
import { ref } from "vue";
import { TxButton } from "@talex-touch/tuffex/button";

/**
 * 一封信渲染出来的样子（#285）：邮件样式放进一个没有任何权限的 iframe（sandbox 为空：不跑脚本、不能点链接跳走、
 * 不能提交表单），另一个页签看纯文本版。服务端渲染出来的 HTML 只在这个 iframe 里展示，不拼进控制台的页面。
 * stale 为真时说明显示的是上一次渲染成功的结果，这一版还没渲染出来。
 */
defineProps<{ html: string | null; text: string | null; subject: string; stale?: boolean }>();
const mode = ref<"html" | "text">("html");
</script>

<template>
  <div class="mail-frame" :class="{ 'is-stale': stale }">
    <div class="mail-frame__bar">
      <p class="mail-frame__subject" :title="subject">主题：{{ subject || "（空）" }}</p>
      <div class="mail-frame__modes" role="group" aria-label="预览方式">
        <TxButton size="sm" :variant="mode === 'html' ? 'secondary' : 'ghost'" :aria-pressed="mode === 'html'" @click="mode = 'html'">邮件样式</TxButton>
        <TxButton size="sm" :variant="mode === 'text' ? 'secondary' : 'ghost'" :aria-pressed="mode === 'text'" @click="mode = 'text'">纯文本</TxButton>
      </div>
    </div>
    <iframe
      v-if="mode === 'html' && html !== null"
      class="mail-frame__page"
      title="邮件预览"
      sandbox=""
      referrerpolicy="no-referrer"
      :srcdoc="html"
    />
    <pre v-else-if="mode === 'text' && text !== null" class="mail-frame__text">{{ text }}</pre>
    <div v-else class="mail-frame__empty">还没有可以预览的内容。</div>
  </div>
</template>

<style scoped>
.mail-frame {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.mail-frame__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.mail-frame__subject {
  flex: 1 1 200px;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  color: var(--tx-text-color-regular);
}
.mail-frame__modes {
  display: flex;
  gap: 4px;
}
.mail-frame__page,
.mail-frame__text,
.mail-frame__empty {
  width: 100%;
  height: var(--mail-frame-height, 560px);
  box-sizing: border-box;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: var(--tx-border-radius-base);
  background: #fff;
}
.mail-frame__text {
  margin: 0;
  padding: 12px 16px;
  overflow: auto;
  font-family: var(--console-mono);
  font-size: 12.5px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--tx-text-color-regular);
}
.mail-frame__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tx-text-color-secondary);
  font-size: 14px;
}
.is-stale .mail-frame__page,
.is-stale .mail-frame__text {
  opacity: 0.55;
}
</style>
