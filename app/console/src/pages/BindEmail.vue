<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import logoUrl from "../assets/logo.png";
import ErrorPanel from "../components/ErrorPanel.vue";
import { ApiError, api, jsonBody } from "../lib/http";
import { clearSession } from "../lib/session";
import { loginIsFresh } from "../lib/account";
import { bindEmailReturn, cleanCode, codeProblem, looksLikeEmail, retryAfter } from "../lib/signin";
import type { AccountView } from "../lib/types";

/**
 * 绑定邮箱页（#273，所有者 2026-10-23 19:22：只绑了 GitHub、没有邮箱的账号，再进来或登录时必须绑定邮箱）。
 * 服务端的登录回调、对外授权、设备授权和官网、论坛、控制台读到 email_required 都把人带到这里，绑好回到 return_to。
 * 页面上只有绑定和退出。绑定用账号页同一组接口，要求 10 分钟内刚登录过；登录更早时先请人重新登录，登录完回到这一页。
 */
const route = useRoute();
const router = useRouter();
const origin = window.location.origin;
const target = computed(() => bindEmailReturn(route.query.return_to, origin));
const view = ref<AccountView | null>(null);
const loadError = ref<unknown>(null);
const now = ref(Date.now());
const tick = setInterval(() => { now.value = Date.now(); }, 30_000);

/** 这次登录超过 10 分钟，或者服务端回了 step_up_required：先重新登录。 */
const stepUp = ref(false);
const stale = computed(() => stepUp.value || (view.value ? !loginIsFresh(view.value, now.value) : false));

const email = ref("");
const code = ref("");
const sentTo = ref<string | null>(null);
const error = ref<string | null>(null);
const busy = ref<"send" | "verify" | "leave" | null>(null);
/** 这一页上刚绑好；没绑也会离开的情形是这个环境发不出信，那时不说「已经绑好」。 */
const bound = ref(false);
const cooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
onBeforeUnmount(() => { clearInterval(tick); clearInterval(cooldownTimer); });
const codeInput = computed({ get: () => code.value, set: (value: string | number) => { code.value = cleanCode(value); } });
const sendLabel = computed(() => (cooldown.value > 0 ? `${cooldown.value} 秒后重发` : sentTo.value ? "重新发送" : "获取验证码"));

function startCooldown(seconds: number) {
  clearInterval(cooldownTimer);
  cooldown.value = seconds;
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}

const messageOf = (failure: unknown) => (failure instanceof ApiError ? failure.message : "没有连上服务器，可能是网络不稳定，稍后再试一次。");
const here = () => router.resolve({ path: route.path, query: route.query }).fullPath;
const signInAgain = () => window.location.assign(`/signin?return_to=${encodeURIComponent(here())}`);
/** 回到原来要去的页面：可能是官网、论坛或控制台，整页跳转。 */
const leave = () => {
  busy.value = "leave";
  window.location.assign(target.value);
};

async function load() {
  loadError.value = null;
  try {
    view.value = await api<AccountView>("/api/identity/me");
    if (!view.value.email_required) leave();
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 401) return signInAgain();
    loadError.value = failure;
  }
}
onMounted(load);

async function sendCode() {
  error.value = null;
  const address = email.value.trim();
  if (!looksLikeEmail(address)) { error.value = "邮箱格式不对"; return; }
  busy.value = "send";
  try {
    const result = await api<{ resend_after: number }>("/api/identity/email/start", { method: "POST", ...jsonBody({ email: address }) });
    sentTo.value = address;
    code.value = "";
    startCooldown(result.resend_after);
  } catch (failure) {
    if (failure instanceof ApiError && failure.code === "step_up_required") stepUp.value = true;
    const wait = retryAfter(failure);
    if (wait !== null) startCooldown(wait);
    error.value = messageOf(failure);
  } finally {
    busy.value = null;
  }
}

async function verify() {
  error.value = null;
  const problem = codeProblem(Boolean(sentTo.value), code.value);
  if (problem) { error.value = problem; return; }
  busy.value = "verify";
  try {
    await api("/api/identity/email/verify", { method: "POST", ...jsonBody({ code: code.value }) });
    bound.value = true;
    leave();
  } catch (failure) {
    busy.value = null;
    if (failure instanceof ApiError && failure.code === "step_up_required") stepUp.value = true;
    if (failure instanceof ApiError && failure.code === "code_expired") sentTo.value = null;
    error.value = messageOf(failure);
  }
}

const signingOut = ref(false);
async function signOut() {
  signingOut.value = true;
  try { await api("/auth/signout", { method: "POST" }); } catch { /* 会话已失效时也回到登录页 */ }
  clearSession();
  void router.replace({ path: "/signin", query: { signed_out: "1" } });
}
</script>

<template>
  <div class="bind console-ground">
    <TxCard class="bind__card">
      <div class="bind__brand">
        <img :src="logoUrl" alt="" width="52" height="52" class="bind__logo">
        <div>
          <h1>绑定邮箱</h1>
          <p class="bind__lead">绑好以后才能继续使用极客班账号</p>
        </div>
      </div>

      <ErrorPanel v-if="loadError" :error="loadError" :retry="load" />
      <div v-else-if="!view || !view.email_required || busy === 'leave'" class="bind__state" role="status">
        <TxSpinner :size="18" label="正在读取账号" />
        <span>{{ bound ? "邮箱已经绑好，正在回到原来的页面…" : view ? "正在回到原来的页面…" : "正在读取账号…" }}</span>
      </div>

      <template v-else>
        <div class="bind__who">
          <span class="bind__who-label">当前极客班账号</span>
          <span class="mono">{{ view.login }}</span>
        </div>
        <p class="bind__intro">
          这个账号还没有登录邮箱。绑好以后可以用邮箱验证码或密码登录，忘了密码也能用它重设。
        </p>

        <template v-if="stale">
          <TxAlert type="warning" title="先重新登录一次" :closable="false" class="bind__alert" data-testid="bind-stale">
            为了安全，绑定邮箱要在登录后 10 分钟内完成。重新登录后会回到这一页。
          </TxAlert>
          <TxButton variant="primary" size="lg" icon="i-carbon-login" block @click="signInAgain">重新登录</TxButton>
        </template>

        <TxForm v-else label-position="top" class="bind__form" data-testid="bind-form" novalidate @submit="sentTo ? verify() : sendCode()">
          <TxFormItem v-slot="{ id }" label="邮箱">
            <div class="bind__row">
              <TxInput :id="id" v-model="email" type="email" placeholder="name@example.com" autocomplete="email" inputmode="email" spellcheck="false" />
              <TxButton
                variant="secondary"
                native-type="button"
                class="bind__send"
                :loading="busy === 'send'"
                :disabled="cooldown > 0 || busy !== null"
                data-testid="bind-send"
                @click="sendCode"
              >{{ sendLabel }}</TxButton>
            </div>
          </TxFormItem>
          <TxFormItem v-slot="{ id }" label="验证码">
            <TxInput
              :id="id"
              v-model="codeInput"
              class="bind__code"
              placeholder="6 位数字"
              autocomplete="one-time-code"
              inputmode="numeric"
              maxlength="6"
            />
            <p v-if="sentTo" class="bind__hint">验证码已发到 {{ sentTo }}，10 分钟内有效。没收到的话看看垃圾邮件。</p>
          </TxFormItem>
          <p v-if="error" class="bind__error" role="alert" data-testid="bind-error">{{ error }}</p>
          <TxButton variant="primary" size="lg" native-type="button" icon="i-carbon-checkmark" block :loading="busy === 'verify'" :disabled="busy !== null" @click="verify">
            绑定并继续
          </TxButton>
        </TxForm>

        <p class="bind__return" :title="target">绑好后回到 {{ target }}</p>
      </template>

      <div class="bind__more">
        <TxButton variant="ghost" icon="i-carbon-logout" block :loading="signingOut" @click="signOut">退出登录</TxButton>
      </div>
    </TxCard>
  </div>
</template>

<style scoped>
.bind {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px 16px;
}
/* 同 SignIn.vue：TxCard 自带 width: 100%，用 max-width 收窄才不受样式加载顺序影响 */
.bind__card {
  max-width: 440px;
}
.bind__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0 18px;
}
.bind__logo {
  flex: none;
  border-radius: 14px;
  box-shadow: var(--tx-box-shadow-light);
}
.bind h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.bind__lead {
  margin: 4px 0 0;
  color: var(--tx-text-color-secondary);
  font-size: 14px;
}
.bind__state {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter);
  color: var(--tx-text-color-secondary);
  font-size: 13px;
}
.bind__who {
  display: grid;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter);
  line-height: 18px;
  overflow-wrap: anywhere;
}
.bind__who-label {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.bind__intro {
  margin: 12px 0 14px;
  font-size: 14px;
  line-height: 22px;
}
.bind__alert {
  margin-bottom: 14px;
  text-align: left;
}
/* layout.css 给相邻的表单项再加 14px 上边距，叠在 TxForm 自己的 14px 间距上；这里和登录页一样只隔 14px */
.bind__form > .tx-form-item + .tx-form-item {
  margin-top: 0;
}
.bind__form :deep(.tx-input) {
  min-height: 44px;
}
.bind__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}
.bind__send {
  min-height: 44px;
  min-width: 112px;
  white-space: nowrap;
}
.bind__code :deep(input:not(:placeholder-shown)) {
  font-family: var(--tx-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.2em;
}
.bind__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
  overflow-wrap: anywhere;
}
.bind__error {
  margin: -4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--tx-color-danger);
}
.bind__return {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bind__more {
  display: grid;
  margin-top: 12px;
}
</style>
