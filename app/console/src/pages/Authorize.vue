<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxAvatar } from "@talex-touch/tuffex/avatar";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import logoUrl from "../assets/logo.png";
import { ApiError, api } from "../lib/http";
import { siteUrl } from "../lib/runtime";
import { remainingText } from "../lib/device";
import {
  authorizeBindEmailPath, authorizeCompleteProfilePath, authorizeSignInPath, closedNotice, decisionPath, detailsPath, interactionUid, scopeLines, type AuthorizeView,
} from "../lib/authorize";

/**
 * 对外授权的同意页（#270，ADR-0005 决策 8）。GitLab 这样的应用第一次用极客班账号登录时，服务端把浏览器带到这里，
 * 本人看清是哪个应用、回到哪个网站、要哪些信息后允许或拒绝；之后再从同一个应用登录不再问。
 */
type Phase = "loading" | "review" | "leaving" | "closed";

const route = useRoute();
const uid = interactionUid(route.query.uid);
const phase = ref<Phase>("loading");
const view = ref<AuthorizeView | null>(null);
const notice = ref<{ title: string; body: string } | null>(null);
const busy = ref<"confirm" | "abort" | null>(null);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const NETWORK = { title: "没有连上服务器", body: "可能是网络不稳定，稍后再试一次。" };

const goPortal = () => window.location.assign(siteUrl("portal", "/"));
const remaining = computed(() => (view.value ? remainingText(view.value.expires_at, now.value) : ""));
const scopes = computed(() => (view.value ? scopeLines(view.value.scopes) : []));

function close(reason: Parameters<typeof closedNotice>[0]) {
  notice.value = closedNotice(reason);
  phase.value = "closed";
}

/** 交互接口的错误：没登录去登录页，还没有登录邮箱去绑定邮箱页（#273），缺姓名或年级去补资料页（#280），过期 404，换了账号 409，其它当作网络问题。 */
function failed(error: unknown): void {
  if (error instanceof ApiError && error.status === 401 && uid) return window.location.assign(authorizeSignInPath(uid));
  if (error instanceof ApiError && error.code === "email_required" && uid) return window.location.assign(authorizeBindEmailPath(uid));
  if (error instanceof ApiError && error.code === "profile_required" && uid) return window.location.assign(authorizeCompleteProfilePath(uid));
  if (error instanceof ApiError && error.status === 404) return close("expired");
  if (error instanceof ApiError && error.status === 409) return close("mismatch");
  notice.value = NETWORK;
}

async function load() {
  if (!uid) return close("missing");
  phase.value = "loading";
  notice.value = null;
  try {
    view.value = await api<AuthorizeView>(detailsPath(uid));
    if (view.value.expires_at > Date.now()) phase.value = "review";
    else close("expired");
  } catch (error) {
    failed(error);
    if (phase.value === "loading") phase.value = "closed";
  }
}

async function decide(decision: "confirm" | "abort") {
  if (busy.value || !uid) return;
  busy.value = decision;
  notice.value = null;
  try {
    const { redirect_to } = await api<{ redirect_to: string }>(decisionPath(uid, decision), { method: "POST" });
    phase.value = "leaving";
    window.location.assign(redirect_to);
  } catch (error) {
    failed(error);
  } finally {
    busy.value = null;
  }
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
    if (phase.value === "review" && view.value && view.value.expires_at <= now.value) close("expired");
  }, 1000);
  void load();
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="authorize console-ground">
    <TxCard class="authorize__card">
      <div class="authorize__brand">
        <img :src="logoUrl" alt="" width="52" height="52" class="authorize__logo">
        <div>
          <h1>授权登录</h1>
          <p class="authorize__lead">用极客班账号登录其它应用</p>
        </div>
      </div>

      <div v-if="phase === 'loading' || phase === 'leaving'" class="authorize__state" role="status">
        <TxSpinner :size="18" :label="phase === 'loading' ? '正在读取这次登录' : '正在回到应用'" />
        <span>{{ phase === "loading" ? "正在读取这次登录…" : `正在回到 ${view?.client.name ?? "应用"}…` }}</span>
      </div>

      <div v-if="view && phase !== 'closed'" class="authorize__who">
        <TxAvatar :src="view.account.picture ?? undefined" :name="view.account.login" :size="32" />
        <div>
          <span class="authorize__who-label">当前极客班账号</span>
          <b><span v-if="view.account.name !== view.account.login">{{ view.account.name }} </span><span class="mono">@{{ view.account.login }}</span></b>
        </div>
      </div>

      <TxAlert v-if="notice && phase !== 'closed'" type="warning" :title="notice.title" :closable="false" class="authorize__alert" data-testid="authorize-notice">
        {{ notice.body }}
      </TxAlert>

      <section v-if="phase === 'review' && view" class="authorize__review" aria-labelledby="authorize-request">
        <div class="authorize__client">
          <span class="authorize__client-icon" aria-hidden="true"><span class="i-carbon-application-web" /></span>
          <div>
            <h2 id="authorize-request">{{ view.client.name }} 请求用你的极客班账号登录</h2>
            <span class="authorize__host mono">允许后回到 {{ view.client.host }}</span>
          </div>
        </div>
        <ul class="authorize__scopes" aria-label="允许后它可以">
          <li v-for="line in scopes" :key="line"><span class="i-carbon-checkmark" aria-hidden="true" />{{ line }}</li>
        </ul>
        <p class="authorize__expire">以后从这个应用登录不再问 · <span>{{ remaining }}</span> 后这次请求失效</p>
        <div class="authorize__actions">
          <TxButton variant="secondary" size="lg" icon="i-carbon-close" block :loading="busy === 'abort'" :disabled="!!busy" @click="decide('abort')">拒绝</TxButton>
          <TxButton variant="primary" size="lg" icon="i-carbon-checkmark" block :loading="busy === 'confirm'" :disabled="!!busy" data-testid="authorize-confirm" @click="decide('confirm')">允许</TxButton>
        </div>
      </section>

      <TxAlert v-else-if="phase === 'closed' && notice" type="warning" :title="notice.title" :closable="false" class="authorize__alert" data-testid="authorize-result">
        {{ notice.body }}
      </TxAlert>

      <div class="authorize__more">
        <TxButton v-if="phase === 'closed' && notice?.title === '没有连上服务器'" variant="secondary" icon="i-carbon-renew" block @click="load">再试一次</TxButton>
        <TxButton variant="ghost" icon="i-carbon-arrow-left" block @click="goPortal">回到官网</TxButton>
      </div>
    </TxCard>
  </div>
</template>

<style scoped>
.authorize {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px 16px;
}
/* 同 Device.vue：TxCard 自带 width: 100%，用 max-width 收窄 */
.authorize__card {
  max-width: 440px;
}
.authorize__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0 18px;
}
.authorize__logo {
  flex: none;
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
.authorize h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.authorize__lead {
  margin: 4px 0 0;
  color: var(--tx-text-color-secondary);
  font-size: 14px;
}
.authorize__state {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin-bottom: 14px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter, rgba(127, 127, 127, 0.06));
  color: var(--tx-text-color-secondary);
  font-size: 13px;
}
.authorize__who {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter, rgba(127, 127, 127, 0.06));
}
.authorize__who > div {
  display: grid;
  min-width: 0;
  line-height: 18px;
}
.authorize__who b {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.authorize__who-label {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.authorize__alert {
  margin-bottom: 14px;
  text-align: left;
}
.authorize__client {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.authorize__client > div {
  min-width: 0;
}
/* 图标类自己用 mask + currentColor 画，底色放在外层，否则 background 会盖掉图标 */
.authorize__client-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--tx-color-primary-light-9, rgba(64, 128, 255, 0.12));
  color: var(--tx-color-primary, #4080ff);
  font-size: 22px;
}
.authorize__client h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 620;
  line-height: 22px;
}
.authorize__host {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
  overflow-wrap: anywhere;
}
.authorize__scopes {
  display: grid;
  gap: 8px;
  margin: 0 0 14px;
  padding: 12px;
  border-radius: 12px;
  background: var(--tx-fill-color-lighter, rgba(127, 127, 127, 0.06));
  list-style: none;
  font-size: 13px;
  line-height: 19px;
}
.authorize__scopes li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.authorize__scopes span {
  flex: none;
  margin-top: 2px;
  color: var(--tx-color-success, #00b42a);
}
.authorize__expire {
  margin: 0 0 12px;
  font-size: 12px;
  text-align: center;
  color: var(--tx-text-color-secondary);
}
.authorize__expire span {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.authorize__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.authorize__more {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.mono {
  font-family: var(--tx-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
</style>
