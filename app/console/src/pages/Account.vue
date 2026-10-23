<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import { toast } from "@talex-touch/tuffex/utils";
import logoUrl from "../assets/logo.png";
import ErrorPanel from "../components/ErrorPanel.vue";
import LoadingBlock from "../components/LoadingBlock.vue";
import { ApiError, api, jsonBody } from "../lib/http";
import { useResource } from "../lib/resource";
import { siteUrl } from "../lib/runtime";
import { clearSession } from "../lib/session";
import { cleanCode, retryAfter } from "../lib/signin";
import { fmtDate, fmtRelative } from "../lib/format";
import { PROVIDER_ICON, PROVIDER_TEXT, RESULT_TEXT, actionText, loginIsFresh, membershipText, passwordProblem, providerText } from "../lib/account";
import type { AccountView } from "../lib/types";

/**
 * 账号页（#262）：任何登录的人都能来，不要控制台能力。看登录方式、绑定邮箱、设置或修改密码、成员资格、这次登录和最近的账号记录。
 * 绑定邮箱、第一次设密码要求 10 分钟内刚登录过；超时了就请人重新登录再回到这里。
 */
const router = useRouter();
const origin = window.location.origin;
const account = useResource(() => api<AccountView>("/api/identity/me"));
const signedOut = computed(() => account.error.value instanceof ApiError && account.error.value.status === 401);
const view = computed(() => account.data.value);
const signInAgain = () => window.location.assign(`/signin?return_to=${encodeURIComponent("/account")}`);
const now = ref(Date.now());
const tick = setInterval(() => { now.value = Date.now(); }, 30_000);
onBeforeUnmount(() => clearInterval(tick));
const fresh = computed(() => (view.value ? loginIsFresh(view.value, now.value) : false));
const hasEmail = computed(() => view.value?.identities.some(item => item.provider === "email") ?? false);
const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "没有连上服务器，可能是网络不稳定，稍后再试一次。");
const stepUpNeeded = (error: unknown) => error instanceof ApiError && error.code === "step_up_required";

// ── 绑定邮箱 ──
const bindEmail = ref("");
const bindCode = ref("");
const bindSentTo = ref<string | null>(null);
const bindError = ref<string | null>(null);
const bindBusy = ref<"send" | "verify" | null>(null);
const cooldown = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
onBeforeUnmount(() => clearInterval(cooldownTimer));
const bindCodeInput = computed({ get: () => bindCode.value, set: (value: string | number) => { bindCode.value = cleanCode(value); } });
function startCooldown(seconds: number) {
  clearInterval(cooldownTimer);
  cooldown.value = seconds;
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}
const stepUp = ref(false);

async function sendBindCode() {
  bindError.value = null;
  const target = bindEmail.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) { bindError.value = "邮箱格式不对"; return; }
  bindBusy.value = "send";
  try {
    const result = await api<{ resend_after: number }>("/api/identity/email/start", { method: "POST", ...jsonBody({ email: target }) });
    bindSentTo.value = target;
    bindCode.value = "";
    startCooldown(result.resend_after);
  } catch (error) {
    if (stepUpNeeded(error)) stepUp.value = true;
    const wait = retryAfter(error);
    if (wait !== null) startCooldown(wait);
    bindError.value = messageOf(error);
  } finally {
    bindBusy.value = null;
  }
}
async function verifyBindCode() {
  bindError.value = null;
  if (bindCode.value.length !== 6) { bindError.value = "验证码是 6 位数字"; return; }
  bindBusy.value = "verify";
  try {
    await api("/api/identity/email/verify", { method: "POST", ...jsonBody({ code: bindCode.value }) });
    toast({ title: "邮箱已绑定，现在可以用它登录", variant: "success" });
    bindSentTo.value = null;
    bindEmail.value = "";
    bindCode.value = "";
    await account.reload();
  } catch (error) {
    if (error instanceof ApiError && error.code === "code_expired") bindSentTo.value = null;
    bindError.value = messageOf(error);
  } finally {
    bindBusy.value = null;
  }
}

// ── 密码 ──
const password = ref("");
const passwordAgain = ref("");
const currentPassword = ref("");
const passwordError = ref<string | null>(null);
const passwordBusy = ref(false);
/** 已经有密码、而且这次登录超过 10 分钟：要填当前密码。 */
const needCurrent = computed(() => Boolean(view.value?.has_password) && !fresh.value);
async function savePassword() {
  passwordError.value = null;
  const problem = passwordProblem(password.value, passwordAgain.value);
  if (problem) { passwordError.value = problem; return; }
  if (needCurrent.value && !currentPassword.value) { passwordError.value = "填上当前密码"; return; }
  passwordBusy.value = true;
  try {
    await api("/api/identity/password", {
      method: "POST",
      ...jsonBody({ password: password.value, ...(needCurrent.value && { current_password: currentPassword.value }) }),
    });
    toast({ title: view.value?.has_password ? "密码已修改" : "密码已设置，现在可以用邮箱加密码登录", variant: "success" });
    password.value = "";
    passwordAgain.value = "";
    currentPassword.value = "";
    await account.reload();
  } catch (error) {
    if (stepUpNeeded(error)) stepUp.value = true;
    passwordError.value = messageOf(error);
  } finally {
    passwordBusy.value = false;
  }
}

// ── 退出 ──
const leaving = ref(false);
async function signOut() {
  leaving.value = true;
  try { await api("/auth/signout", { method: "POST" }); } catch { /* 会话已失效时也要回到登录页 */ }
  clearSession();
  void router.replace({ path: "/signin", query: { signed_out: "1" } });
}
const goConsole = () => void router.push("/console");
const goPortal = () => window.location.assign(siteUrl("portal", "/"));
</script>

<template>
  <div class="account console-ground">
    <div class="account__wrap">
      <header class="account__head">
        <img :src="logoUrl" alt="" width="44" height="44" class="account__logo">
        <div class="account__title">
          <h1>我的账号</h1>
          <p v-if="view" class="mono account__login">{{ view.login }}</p>
        </div>
        <div class="account__links">
          <TxButton variant="ghost" size="sm" icon="i-carbon-dashboard" @click="goConsole">控制台</TxButton>
          <TxButton variant="ghost" size="sm" icon="i-carbon-home" @click="goPortal">官网</TxButton>
        </div>
      </header>

      <TxCard v-if="signedOut" class="account__card">
        <h2>还没有登录</h2>
        <p class="muted">登录后才能看自己的账号。</p>
        <TxButton variant="primary" icon="i-carbon-login" @click="signInAgain">去登录</TxButton>
      </TxCard>
      <ErrorPanel v-else-if="account.error.value" :error="account.error.value" :retry="account.reload" />
      <LoadingBlock v-else-if="!view" :lines="8" />

      <template v-else>
        <TxAlert v-if="stepUp" type="warning" title="这一步要求刚登录过" :closable="false" class="account__alert">
          <span>为了安全，绑定邮箱和设置密码要在登录后 10 分钟内完成。重新登录一次就会回到这里。</span>
          <span class="account__alert-action"><TxButton size="sm" variant="primary" @click="signInAgain">重新登录</TxButton></span>
        </TxAlert>

        <TxCard class="account__card" data-testid="account-identities">
          <h2>登录方式</h2>
          <ul class="account__identities">
            <li v-for="item in view.identities" :key="item.provider" class="account__identity">
              <i :class="PROVIDER_ICON[item.provider]" class="account__identity-icon" aria-hidden="true" />
              <span class="account__identity-text">
                <b>{{ PROVIDER_TEXT[item.provider] }}</b>
                <span class="mono">{{ item.label }}</span>
              </span>
              <span class="account__identity-meta">
                绑定于 {{ fmtDate(item.linked_at) }}<template v-if="item.last_login_at"> · 上次登录 {{ fmtRelative(item.last_login_at, now) }}</template>
              </span>
            </li>
          </ul>

          <form v-if="view.available.includes('email')" class="account__form" novalidate @submit.prevent="bindSentTo ? verifyBindCode() : sendBindCode()">
            <h3>绑定邮箱</h3>
            <p class="account__hint">绑好以后可以用邮箱验证码登录，也可以设密码。</p>
            <div class="account__row">
              <TxInput v-model="bindEmail" type="email" placeholder="name@example.com" autocomplete="email" inputmode="email" spellcheck="false" aria-label="要绑定的邮箱" />
              <TxButton variant="secondary" native-type="button" :loading="bindBusy === 'send'" :disabled="cooldown > 0 || bindBusy !== null" @click="sendBindCode">
                {{ cooldown > 0 ? `${cooldown} 秒后重发` : bindSentTo ? "重新发送" : "获取验证码" }}
              </TxButton>
            </div>
            <template v-if="bindSentTo">
              <p class="account__hint">验证码已发到 {{ bindSentTo }}，10 分钟内有效。</p>
              <div class="account__row">
                <TxInput v-model="bindCodeInput" placeholder="6 位验证码" autocomplete="one-time-code" inputmode="numeric" maxlength="6" aria-label="验证码" />
                <TxButton variant="primary" native-type="submit" :loading="bindBusy === 'verify'">绑定</TxButton>
              </div>
            </template>
            <p v-if="bindError" class="account__error" role="alert">{{ bindError }}</p>
          </form>
        </TxCard>

        <TxCard class="account__card" data-testid="account-password">
          <h2>密码</h2>
          <p v-if="!hasEmail" class="account__hint">密码登录用邮箱作账号，先在上面绑定邮箱再设密码。</p>
          <template v-else>
            <p class="account__hint">
              <template v-if="view.has_password">已设置<template v-if="view.password_updated_at">，上次修改 {{ fmtDate(view.password_updated_at) }}</template>。登录时填绑定的邮箱和这个密码。</template>
              <template v-else>还没有设置。设好以后可以用邮箱加密码登录，不用每次收验证码。</template>
            </p>
            <form class="account__form" novalidate @submit.prevent="savePassword">
              <label v-if="needCurrent" class="account__field">
                <span>当前密码</span>
                <TxInput v-model="currentPassword" type="password" autocomplete="current-password" />
              </label>
              <label class="account__field">
                <span>{{ view.has_password ? "新密码" : "密码" }}（至少 15 位）</span>
                <TxInput v-model="password" type="password" autocomplete="new-password" />
              </label>
              <label class="account__field">
                <span>再输一次</span>
                <TxInput v-model="passwordAgain" type="password" autocomplete="new-password" />
              </label>
              <p v-if="!view.has_password && !fresh" class="account__hint">第一次设密码要在登录后 10 分钟内完成；现在已经超过了，先重新登录一次。</p>
              <p v-if="passwordError" class="account__error" role="alert">{{ passwordError }}</p>
              <div class="account__actions">
                <TxButton v-if="!view.has_password && !fresh" variant="secondary" native-type="button" @click="signInAgain">重新登录</TxButton>
                <TxButton variant="primary" native-type="submit" :loading="passwordBusy">{{ view.has_password ? "修改密码" : "设置密码" }}</TxButton>
              </div>
            </form>
          </template>
        </TxCard>

        <TxCard class="account__card" data-testid="account-membership">
          <h2>成员资格</h2>
          <p class="account__line">
            <TxStatusBadge :text="view.membership.state === 'active' ? '有效' : '已失效'" :status="view.membership.state === 'active' ? 'success' : 'muted'" size="sm" />
            <span>{{ membershipText(view.membership) }}</span>
          </p>
          <p class="account__hint">账号建于 {{ fmtDate(view.created_at) }}。</p>
        </TxCard>

        <TxCard class="account__card" data-testid="account-session">
          <h2>这次登录</h2>
          <dl class="account__facts">
            <dt>方式</dt>
            <dd><i :class="PROVIDER_ICON[view.session.provider]" aria-hidden="true" /> {{ PROVIDER_TEXT[view.session.provider] }}</dd>
            <dt>登录于</dt>
            <dd>{{ fmtDate(view.session.created_at) }}</dd>
            <dt>有效到</dt>
            <dd>{{ fmtDate(view.session.expires_at) }}</dd>
          </dl>
          <p v-if="view.session.provider !== 'github'" class="account__hint">控制台里 GitHub 组织的页面要用 GitHub 登录才能打开，其他页面不受影响。</p>
          <div class="account__actions">
            <TxButton variant="secondary" icon="i-carbon-logout" :loading="leaving" @click="signOut">退出登录</TxButton>
          </div>
        </TxCard>

        <TxCard class="account__card" data-testid="account-recent">
          <h2>最近的账号记录</h2>
          <p v-if="!view.recent.length" class="account__hint">还没有记录。</p>
          <ol v-else class="account__recent">
            <li v-for="(item, index) in view.recent" :key="index">
              <span class="account__recent-time">{{ fmtDate(item.at) }}</span>
              <span>{{ actionText(item.action) }}<template v-if="item.provider"> · {{ providerText(item.provider) }}</template></span>
              <TxStatusBadge v-if="item.result !== 'ok'" :text="RESULT_TEXT[item.result]" status="warning" size="sm" />
            </li>
          </ol>
        </TxCard>
      </template>
    </div>
  </div>
</template>

<style scoped>
.account {
  min-height: 100vh;
  padding: 24px 16px 40px;
}
.account__wrap {
  display: grid;
  gap: 14px;
  width: min(640px, 100%);
  margin: 0 auto;
}
.account__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 6px;
}
.account__logo {
  flex: none;
  border-radius: 12px;
}
.account__title {
  flex: 1;
  min-width: 0;
}
.account__title h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  white-space: nowrap;
}
.account__login {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--tx-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account__links {
  display: flex;
  flex: none;
  gap: 4px;
}
.account__card h2 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
}
.account__card h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.account__identities {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.account__identity {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 2px 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter);
}
.account__identity-icon {
  grid-row: span 2;
  font-size: 20px;
}
.account__identity-text {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.account__identity-meta {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.account__form {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}
.account__card > .account__form:first-child,
.account__hint + .account__form {
  margin-top: 6px;
}
.account__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}
.account__row :deep(.tx-input),
.account__field :deep(.tx-input) {
  min-height: 44px;
}
.account__row :deep(.tx-button) {
  min-height: 44px;
  white-space: nowrap;
}
.account__field {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-text-color-regular);
}
.account__hint {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
  overflow-wrap: anywhere;
}
.account__error {
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--tx-color-danger);
}
.account__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.account__actions :deep(.tx-button) {
  min-height: 44px;
}
.account__line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 14px;
}
.account__facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 16px;
  margin: 0 0 8px;
  font-size: 14px;
}
.account__facts dt {
  color: var(--tx-text-color-secondary);
}
.account__facts dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.account__alert {
  text-align: left;
}
.account__alert-action {
  display: block;
  margin-top: 8px;
}
.account__recent {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.account__recent li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
.account__recent-time {
  min-width: 132px;
  font-variant-numeric: tabular-nums;
  color: var(--tx-text-color-secondary);
}
@media (max-width: 520px) {
  .account__links :deep(.tx-button) {
    padding-inline: 8px;
  }
}
</style>
