<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxRadio, TxRadioGroup } from "@talex-touch/tuffex/radio";
import logoUrl from "../assets/logo.png";
import { ApiError, api } from "../lib/http";
import { isMock, siteUrl } from "../lib/runtime";
import {
  cleanCode, parseSignInOutcome, providerHref, providerIcon, readProviders, retryAfter, safeReturnPath, sendSigninCode, signInWithPassword,
  verifySigninCode, type LoginProvider, type OutcomeAction,
} from "../lib/signin";

/**
 * 极客班统一登录页（#262）。官网、论坛、控制台的「登录」都到这里：登录方式按 GET /auth/providers 渲染，前端不写死渠道；
 * 登录后回到 return_to（只接受本站路径）；登录没成功时服务端也回到这里并带上 ?signin=<原因>，原因在这里讲清。
 * GitHub、Google 是整页跳转；邮箱在本页完成，验证码和密码两种方式（所有者 2026-10-23）。没有账号的邮箱、Google 账号
 * 要填邀请码注册：服务端回 invite_required 时才出现邀请码输入框，验证码不作废。
 */
const route = useRoute();
const origin = window.location.origin;
const returnPath = computed(() => safeReturnPath(route.query.return_to, origin));
const signedOut = computed(() => route.query.signed_out === "1");
const outcomeKey = computed(() => (typeof route.query.signin === "string" ? route.query.signin : null));
const outcome = computed(() => parseSignInOutcome(route.query.signin));

const providers = ref<LoginProvider[]>([]);
const state = ref<"loading" | "ready" | "failed">("loading");
const leaving = ref<string | null>(null);

async function loadProviders() {
  state.value = "loading";
  try {
    providers.value = readProviders(await api<unknown>("/auth/providers"));
    state.value = providers.value.length ? "ready" : "failed";
  } catch {
    state.value = "failed";
  }
}
onMounted(loadProviders);

const redirectProviders = computed(() => providers.value.filter(provider => provider.kind === "redirect"));
const emailProvider = computed(() => providers.value.find(provider => provider.kind === "email_code") ?? null);
/** Google 回来说要邀请码（或邀请码不对）时，在按钮上方放邀请码输入框，填好再用 Google 继续。 */
const googleInviteNeeded = computed(() => route.query.provider === "google" && (outcomeKey.value === "invite_required" || outcomeKey.value === "invalid_invite"));
const googleInvite = ref("");
const providerVariant = (provider: LoginProvider, index: number) =>
  (googleInviteNeeded.value ? provider.id === "google" : index === 0) ? "primary" : "secondary";
const providerLabel = (provider: LoginProvider) =>
  (provider.id === "google" && googleInviteNeeded.value ? "用 Google 注册" : `通过 ${provider.name} 继续`);

const start = (provider: LoginProvider) => {
  leaving.value = provider.id;
  const invite = provider.id === "google" && googleInviteNeeded.value ? googleInvite.value : undefined;
  window.location.assign(providerHref(provider, returnPath.value, origin, invite));
};
const goPortal = () => window.location.assign(siteUrl("portal", "/"));
const followAction = (action: OutcomeAction) => {
  if (action.target === "_blank") window.open(action.href, "_blank", "noopener,noreferrer");
  else window.location.assign(action.href);
};

// ── 邮箱登录 ──
type Mode = "code" | "password";
const mode = ref<Mode>("code");
const email = ref("");
const code = ref("");
const password = ref("");
const invite = ref("");
const inviteNeeded = ref(false);
const sentTo = ref<string | null>(null);
const cooldown = ref(0);
const sending = ref(false);
const submitting = ref(false);
const emailError = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

const codeInput = computed({ get: () => code.value, set: (value: string | number) => { code.value = cleanCode(value); } });
const emailLooksValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));
const sendLabel = computed(() => (cooldown.value > 0 ? `${cooldown.value} 秒后重发` : sentTo.value ? "重新发送" : "获取验证码"));

function startCooldown(seconds: number) {
  clearInterval(timer);
  cooldown.value = seconds;
  timer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) clearInterval(timer);
  }, 1000);
}
onBeforeUnmount(() => clearInterval(timer));
// 换了邮箱，之前的验证码和邀请码提示都不算数
watch(email, () => { sentTo.value = null; inviteNeeded.value = false; emailError.value = null; });
watch(mode, () => { emailError.value = null; });

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "没有连上服务器，可能是网络不稳定，稍后再试一次。");
/** 成功后整页跳转：服务端给的地址也只认本站路径。 */
const leave = (target: string) => window.location.assign(safeReturnPath(target, origin, returnPath.value));

async function sendCode() {
  emailError.value = null;
  if (!emailLooksValid.value) { emailError.value = "邮箱格式不对"; return; }
  sending.value = true;
  try {
    const target = email.value.trim();
    const result = await sendSigninCode(target, returnPath.value, origin);
    sentTo.value = target;
    code.value = "";
    startCooldown(result.resend_after);
  } catch (error) {
    const wait = retryAfter(error);
    if (wait !== null) startCooldown(wait);
    emailError.value = messageOf(error);
  } finally {
    sending.value = false;
  }
}

async function submitCode() {
  emailError.value = null;
  if (!sentTo.value) { emailError.value = "先获取验证码"; return; }
  if (code.value.length !== 6) { emailError.value = "验证码是 6 位数字"; return; }
  if (inviteNeeded.value && !invite.value.trim()) { emailError.value = "填上邀请码才能注册"; return; }
  submitting.value = true;
  try {
    const result = await verifySigninCode(code.value, inviteNeeded.value ? invite.value : undefined);
    leave(result.return_to);
  } catch (error) {
    submitting.value = false;
    if (error instanceof ApiError && error.code === "invite_required") { inviteNeeded.value = true; return; }
    if (error instanceof ApiError && error.code === "code_expired") { sentTo.value = null; code.value = ""; cooldown.value = 0; clearInterval(timer); }
    emailError.value = messageOf(error);
  }
}

async function submitPassword() {
  emailError.value = null;
  if (!emailLooksValid.value) { emailError.value = "邮箱格式不对"; return; }
  if (!password.value) { emailError.value = "填上密码"; return; }
  submitting.value = true;
  try {
    const result = await signInWithPassword(emailProvider.value ?? {}, email.value.trim(), password.value, returnPath.value, origin);
    leave(result.return_to);
  } catch (error) {
    submitting.value = false;
    emailError.value = messageOf(error);
  }
}
const submitEmail = () => (mode.value === "code" ? submitCode() : submitPassword());
</script>

<template>
  <div class="signin console-ground">
    <TxCard class="signin__card">
      <div class="signin__brand">
        <img :src="logoUrl" alt="" width="52" height="52" class="signin__logo">
        <div class="signin__heading">
          <h1>极客班统一登录</h1>
          <p class="signin__lead">官网、论坛、控制台和比赛共用一个账号</p>
        </div>
      </div>

      <TxAlert v-if="signedOut" type="success" title="你已退出登录" :closable="false" class="signin__alert">官网、论坛、控制台已一起退出。</TxAlert>
      <TxAlert v-if="outcome" :type="outcome.type" :title="outcome.title" :closable="false" class="signin__alert" data-testid="signin-outcome">
        <template v-if="outcome.body">{{ outcome.body }}</template>
      </TxAlert>
      <TxAlert v-if="isMock()" type="info" title="开发预览" :closable="false" class="signin__alert">
        当前是样板数据，登录按钮会连到本地后端。要看登录后的页面，去掉地址里的 __persona=signed_out。
      </TxAlert>

      <div v-if="state === 'loading'" class="signin__loading" role="status">
        <TxSpinner :size="18" label="正在读取登录方式" />
        <span>正在读取可用的登录方式…</span>
      </div>
      <div v-else-if="state === 'failed'" class="signin__failed" role="alert">
        <span>登录方式没有加载出来，可能是网络不稳定。</span>
        <TxButton variant="secondary" size="sm" icon="i-carbon-renew" @click="loadProviders">重试</TxButton>
      </div>
      <template v-else>
        <section v-if="redirectProviders.length" class="signin__providers" aria-label="用其他网站的账号登录">
          <div v-if="googleInviteNeeded" class="signin__field">
            <label for="google-invite">邀请码</label>
            <TxInput id="google-invite" v-model="googleInvite" placeholder="向邀请你的人要" autocomplete="off" spellcheck="false" />
          </div>
          <TxButton
            v-for="(provider, index) in redirectProviders"
            :key="provider.id"
            :variant="providerVariant(provider, index)"
            size="lg"
            :icon="providerIcon(provider)"
            :loading="leaving === provider.id"
            :disabled="provider.id === 'google' && googleInviteNeeded && !googleInvite.trim()"
            :data-provider="provider.id"
            block
            @click="start(provider)"
          >{{ providerLabel(provider) }}</TxButton>
        </section>

        <div v-if="redirectProviders.length && emailProvider" class="signin__divider" role="separator"><span>或者用邮箱</span></div>

        <form v-if="emailProvider" class="signin__email" data-provider="email" novalidate @submit.prevent="submitEmail">
          <TxRadioGroup v-model="mode" type="button" class="signin__modes" aria-label="邮箱登录方式">
            <TxRadio value="code" label="验证码" />
            <TxRadio value="password" label="密码" />
          </TxRadioGroup>

          <div class="signin__field">
            <label for="signin-email">邮箱</label>
            <TxInput id="signin-email" v-model="email" type="email" placeholder="name@example.com" autocomplete="email" inputmode="email" spellcheck="false" />
          </div>

          <template v-if="mode === 'code'">
            <div class="signin__field">
              <label for="signin-code">验证码</label>
              <div class="signin__code-row">
                <TxInput
                  id="signin-code"
                  v-model="codeInput"
                  class="signin__code"
                  placeholder="6 位数字"
                  autocomplete="one-time-code"
                  inputmode="numeric"
                  maxlength="6"
                />
                <TxButton
                  variant="secondary"
                  native-type="button"
                  class="signin__send"
                  :loading="sending"
                  :disabled="cooldown > 0 || sending"
                  data-testid="send-code"
                  @click="sendCode"
                >{{ sendLabel }}</TxButton>
              </div>
              <p v-if="sentTo" class="signin__hint" data-testid="code-sent">验证码已发到 {{ sentTo }}，10 分钟内有效。没收到的话看看垃圾邮件。</p>
            </div>
            <div v-if="inviteNeeded" class="signin__field">
              <TxAlert type="info" title="这个邮箱还没有极客班账号" :closable="false" class="signin__alert">填上邀请码再登录，就会用这个邮箱注册。验证码还能用，不用重新获取。</TxAlert>
              <label for="signin-invite">邀请码</label>
              <TxInput id="signin-invite" v-model="invite" placeholder="向邀请你的人要" autocomplete="off" spellcheck="false" />
            </div>
          </template>

          <div v-else class="signin__field">
            <label for="signin-password">密码</label>
            <TxInput id="signin-password" v-model="password" type="password" placeholder="至少 15 位" autocomplete="current-password" />
            <p class="signin__hint">还没设过密码就先用验证码登录，再到「我的账号」里设置。</p>
          </div>

          <p v-if="emailError" class="signin__error" role="alert" data-testid="email-error">{{ emailError }}</p>
          <TxButton variant="primary" size="lg" native-type="submit" :loading="submitting" block :icon="inviteNeeded && mode === 'code' ? 'i-carbon-user-follow' : 'i-carbon-login'">
            {{ inviteNeeded && mode === "code" ? "注册并登录" : "登录" }}
          </TxButton>
        </form>

        <p class="signin__note">
          登录后全站认的是你的极客班账号。第一次用邮箱或 Google 登录会注册新账号，要填邀请码。
        </p>
      </template>

      <p v-if="returnPath !== '/'" class="signin__return" :title="returnPath">登录后回到 {{ returnPath }}</p>
      <div class="signin__more" :class="{ 'signin__more--pair': outcome?.action }">
        <TxButton v-if="outcome?.action" variant="secondary" :icon="outcome.action.icon" block @click="followAction(outcome.action)">
          {{ outcome.action.label }}
        </TxButton>
        <TxButton variant="ghost" icon="i-carbon-arrow-left" block @click="goPortal">回到官网</TxButton>
      </div>
    </TxCard>
  </div>
</template>

<style scoped>
.signin {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px 16px;
}
/* TxCard 自带 width: 100%，和这里同优先级，构建后谁的样式后加载谁生效；用它没设的 max-width 收窄 */
.signin__card {
  max-width: 440px;
}
.signin__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0 18px;
}
.signin__heading {
  min-width: 0;
}
.signin__logo {
  flex: none;
  border-radius: 14px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
}
.signin h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.signin__lead {
  margin: 4px 0 0;
  color: var(--tx-text-color-secondary);
  font-size: 14px;
  line-height: 20px;
  text-wrap: balance;
}
.signin__alert {
  margin-bottom: 14px;
  text-align: left;
}
.signin__providers {
  display: grid;
  gap: 10px;
}
.signin__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 14px;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.signin__divider::before,
.signin__divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--tx-border-color-light);
}
.signin__email {
  display: grid;
  gap: 14px;
}
.signin__modes {
  justify-self: start;
}
.signin__field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.signin__field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-text-color-regular);
}
.signin__field :deep(.tx-input) {
  min-height: 44px;
}
.signin__code-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}
.signin__code :deep(input:not(:placeholder-shown)) {
  font-family: var(--tx-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.2em;
}
.signin__send {
  min-height: 44px;
  min-width: 112px;
  white-space: nowrap;
}
.signin__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tx-text-color-secondary);
  overflow-wrap: anywhere;
}
.signin__error {
  margin: -4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--tx-color-danger);
}
.signin__loading,
.signin__failed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter, rgba(127, 127, 127, 0.06));
  color: var(--tx-text-color-secondary);
  font-size: 13px;
}
.signin__loading {
  justify-content: flex-start;
}
.signin__note {
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 19px;
  color: var(--tx-text-color-secondary);
}
.signin__return {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.signin__more {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}
.signin__more--pair {
  grid-template-columns: 1fr 1fr;
}
@media (max-width: 440px) {
  .signin__more--pair {
    grid-template-columns: 1fr;
  }
}
</style>
