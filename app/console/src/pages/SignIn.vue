<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxRadio, TxRadioGroup } from "@talex-touch/tuffex/radio";
import { TxTabs, TxTabItem } from "@talex-touch/tuffex/tabs";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxDivider } from "@talex-touch/tuffex/divider";
import logoUrl from "../assets/logo.png";
import { ApiError, api } from "../lib/http";
import { isMock, siteUrl } from "../lib/runtime";
import { PASSWORD_MIN_LENGTH } from "../lib/account";
import {
  backFromGoogleForInvite, cleanCode, codeProblem, initialSignInTab, looksLikeEmail, parseSignInOutcome, providerHref, providerIcon, readProviders,
  registerProblem, registerWithEmail, resetPasswordWithCode, resetProblem, retryAfter, safeReturnPath, sendSigninCode, signInWithPassword, verifySigninCode,
  type LoginProvider, type OutcomeAction, type RegisterOutcome, type SignInTab,
} from "../lib/signin";

/**
 * 极客班统一登录页（#262）。官网、论坛、控制台的「登录」都到这里：登录方式按 GET /auth/providers 渲染，前端不写死渠道；
 * 登录后回到 return_to（只接受本站路径）；登录没成功时服务端也回到这里并带上 ?signin=<原因>，原因在这里讲清。
 * 上面是「登录」「注册」两个标签的邮箱表单，下面隔一条「或者」是 GitHub、Google 的跳转按钮（所有者 2026-10-23 10:32）。
 * 邮箱登录有验证码和密码两种；注册填邮箱、邀请码、验证码，密码可以顺手设。用验证码登录时邮箱还没有账号，会转到「注册」，
 * 已填的邮箱和验证码都留着。Google 注册也要邀请码，用「注册」里填的那个。
 * 注册后邮箱原来就有账号、或者填的密码没设上，先在页面上说一句，再让人选继续还是去「我的账号」。
 * 密码登录下面有「忘记密码？」（#273）：用邮箱验证码设新密码并直接登录；记得旧密码、只想换一个的，登录后到「我的账号」里改。
 */
const route = useRoute();
const origin = window.location.origin;
const returnPath = computed(() => safeReturnPath(route.query.return_to, origin));
const signedOut = computed(() => route.query.signed_out === "1");
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

const tab = ref<SignInTab>(initialSignInTab(route.query));
const registering = computed(() => tab.value === "register");
const TAB_LABEL: Record<SignInTab, string> = { signin: "登录", register: "注册" };
const tabs: SignInTab[] = ["signin", "register"];
/** 没有邮箱登录时只剩跳转按钮；从 Google 回来要邀请码时仍给一个邀请码框。 */
const inviteWithoutEmail = computed(() => !emailProvider.value && registering.value);
/** 从 Google 回来填邀请码时，主按钮让给「用 Google 注册」，免得点成邮箱注册；点过「获取验证码」就是在走邮箱，主按钮还给邮箱。 */
const googleFirst = computed(() => registering.value && backFromGoogleForInvite(route.query) && !usingEmail.value);

const googleRegister = (provider: LoginProvider) => provider.id === "google" && registering.value;
const providerLabel = (provider: LoginProvider) => (googleRegister(provider) ? "用 Google 注册" : `通过 ${provider.name} 继续`);
const providerBlocked = (provider: LoginProvider) => googleRegister(provider) && !invite.value.trim();

const start = (provider: LoginProvider) => {
  leaving.value = provider.id;
  window.location.assign(providerHref(provider, returnPath.value, origin, googleRegister(provider) ? invite.value : undefined));
};
const goPortal = () => window.location.assign(siteUrl("portal", "/"));
const followAction = (action: OutcomeAction) => {
  if (action.target === "_blank") window.open(action.href, "_blank", "noopener,noreferrer");
  else window.location.assign(action.href);
};

// ── 邮箱 ──
type Mode = "code" | "password";
const mode = ref<Mode>("code");
const email = ref("");
const code = ref("");
const password = ref("");
const newPassword = ref("");
const invite = ref("");
/** 忘记密码（#273）：换成「邮箱、验证码、新密码」的表单，标签和登录方式先收起来。 */
const forgot = ref(false);
/** 用验证码登录时服务端说这个邮箱还没有账号，转到「注册」后在表单上方说明一句。 */
const movedToRegister = ref(false);
/** 注册后要先说一句再走的两种情况（见 lib/signin.ts 的 RegisterOutcome）。 */
const registerNotice = ref<Exclude<RegisterOutcome, { kind: "done" }> | null>(null);
/** 注册后的说明出现时，上次登录没成功的原因和它的按钮都收起来：人已经登录了。 */
const shownOutcome = computed(() => (registerNotice.value ? null : outcome.value));
const sentTo = ref<string | null>(null);
/** 点过「获取验证码」：换邮箱、验证码过期都不再变回去。 */
const usingEmail = ref(false);
const cooldown = ref(0);
const sending = ref(false);
const submitting = ref(false);
const emailError = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

const codeInput = computed({ get: () => code.value, set: (value: string | number) => { code.value = cleanCode(value); } });
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
/** 验证码过期了：清掉，按钮回到「获取验证码」。 */
function resetCode() {
  sentTo.value = null;
  code.value = "";
  cooldown.value = 0;
  clearInterval(timer);
}
// 换了邮箱，之前发的验证码不算数
watch(email, () => { sentTo.value = null; movedToRegister.value = false; emailError.value = null; });
watch([mode, tab, forgot], () => { emailError.value = null; });

const messageOf = (error: unknown) => (error instanceof ApiError ? error.message : "没有连上服务器，可能是网络不稳定，稍后再试一次。");
/** 成功后整页跳转：服务端给的地址也只认本站路径。 */
const leave = (target: string) => window.location.assign(safeReturnPath(target, origin, returnPath.value));

async function sendCode() {
  emailError.value = null;
  if (!looksLikeEmail(email.value)) { emailError.value = "邮箱格式不对"; return; }
  usingEmail.value = true;
  sending.value = true;
  try {
    const target = email.value.trim();
    const result = await sendSigninCode(target, returnPath.value, origin, forgot.value ? "reset" : "signin");
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
  const problem = codeProblem(Boolean(sentTo.value), code.value);
  if (problem) { emailError.value = problem; return; }
  submitting.value = true;
  try {
    const result = await verifySigninCode(code.value);
    leave(result.return_to);
  } catch (error) {
    submitting.value = false;
    if (error instanceof ApiError && error.code === "invite_required") { movedToRegister.value = true; tab.value = "register"; return; }
    if (error instanceof ApiError && error.code === "code_expired") resetCode();
    emailError.value = messageOf(error);
  }
}

async function submitPassword() {
  emailError.value = null;
  if (!looksLikeEmail(email.value)) { emailError.value = "邮箱格式不对"; return; }
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

async function submitRegister() {
  emailError.value = null;
  const problem = registerProblem({ email: email.value, invite: invite.value, codeSent: Boolean(sentTo.value), code: code.value, password: newPassword.value });
  if (problem) { emailError.value = problem; return; }
  submitting.value = true;
  try {
    const outcome = await registerWithEmail({ code: code.value, invite: invite.value, password: newPassword.value });
    if (outcome.kind === "done") { leave(outcome.returnTo); return; }
    submitting.value = false;
    registerNotice.value = outcome;
  } catch (error) {
    submitting.value = false;
    if (error instanceof ApiError && error.code === "code_expired") resetCode();
    emailError.value = messageOf(error);
  }
}

async function submitReset() {
  emailError.value = null;
  const problem = resetProblem({ email: email.value, codeSent: Boolean(sentTo.value), code: code.value, password: newPassword.value });
  if (problem) { emailError.value = problem; return; }
  submitting.value = true;
  try {
    const result = await resetPasswordWithCode(code.value, newPassword.value);
    leave(result.return_to);
  } catch (error) {
    submitting.value = false;
    if (error instanceof ApiError && error.code === "code_expired") resetCode();
    emailError.value = messageOf(error);
  }
}

const submitEmail = () => (forgot.value ? submitReset() : registering.value ? submitRegister() : mode.value === "code" ? submitCode() : submitPassword());
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
      <TxAlert v-if="shownOutcome" :type="shownOutcome.type" :title="shownOutcome.title" :closable="false" class="signin__alert" data-testid="signin-outcome">
        <template v-if="shownOutcome.body">{{ shownOutcome.body }}</template>
      </TxAlert>
      <TxAlert v-if="isMock()" type="info" title="开发预览" :closable="false" class="signin__alert">
        当前是样板数据，登录按钮会连到本地后端。要看登录后的页面，去掉地址里的 __persona=signed_out。
      </TxAlert>

      <template v-if="registerNotice">
        <TxAlert v-if="registerNotice.kind === 'existing'" type="info" title="这个邮箱原来就有极客班账号，已经登录" :closable="false" class="signin__alert" data-testid="register-notice">
          密码没有改。要设或改密码，到「我的账号」里操作。
        </TxAlert>
        <TxAlert v-else type="warning" title="账号已经建好并登录了，密码没设上" :closable="false" class="signin__alert" data-testid="register-notice">
          {{ messageOf(registerNotice.error) }}到「我的账号」里可以再设。
        </TxAlert>
        <div class="signin__more signin__more--pair">
          <TxButton variant="primary" icon="i-carbon-arrow-right" block @click="leave(registerNotice.returnTo)">继续</TxButton>
          <TxButton variant="secondary" icon="i-carbon-user-avatar" block @click="leave('/account')">去我的账号</TxButton>
        </div>
      </template>
      <div v-else-if="state === 'loading'" class="signin__loading" role="status">
        <TxSpinner :size="18" label="正在读取登录方式" />
        <span>正在读取可用的登录方式…</span>
      </div>
      <div v-else-if="state === 'failed'" class="signin__failed" role="alert">
        <span>登录方式没有加载出来，可能是网络不稳定。</span>
        <TxButton variant="secondary" size="sm" icon="i-carbon-renew" @click="loadProviders">重试</TxButton>
      </div>
      <template v-else>
        <div v-if="emailProvider && forgot" class="signin__forgot-head">
          <h2>重设密码</h2>
          <TxButton variant="bare" size="sm" icon="i-carbon-arrow-left" native-type="button" data-testid="forgot-back" @click="forgot = false">返回登录</TxButton>
        </div>
        <TxTabs
          v-else-if="emailProvider"
          v-model="tab"
          placement="top"
          indicator-variant="line"
          borderless
          :content-scrollable="false"
          :content-padding="0"
          class="signin__tabs"
        >
          <TxTabItem v-for="id in tabs" :key="id" :name="id">
            <template #name>{{ TAB_LABEL[id] }}</template>
          </TxTabItem>
        </TxTabs>

        <TxForm v-if="emailProvider" label-position="top" class="signin__form" data-provider="email" :data-tab="tab" novalidate @submit="submitEmail">
          <TxRadioGroup v-if="!registering && !forgot" v-model="mode" type="button" class="signin__modes" aria-label="邮箱登录方式">
            <TxRadio value="code" label="验证码" />
            <TxRadio value="password" label="密码" />
          </TxRadioGroup>
          <TxAlert v-if="registering && movedToRegister" type="info" title="这个邮箱还没有极客班账号" :closable="false" class="signin__alert signin__alert--tight">
            填上邀请码就能用它注册，刚才的验证码还能用。
          </TxAlert>

          <TxFormItem v-slot="{ id }" label="邮箱">
            <TxInput :id="id" v-model="email" type="email" placeholder="name@example.com" autocomplete="email" inputmode="email" spellcheck="false" />
          </TxFormItem>

          <TxFormItem v-if="registering" v-slot="{ id }" label="邀请码">
            <TxInput :id="id" v-model="invite" placeholder="向邀请你的人要" autocomplete="off" spellcheck="false" />
          </TxFormItem>

          <TxFormItem v-if="registering || forgot || mode === 'code'" v-slot="{ id }" label="验证码">
            <div class="signin__code-row">
              <TxInput
                :id="id"
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
          </TxFormItem>

          <TxFormItem v-if="forgot" v-slot="{ id }" label="新密码">
            <TxInput :id="id" v-model="newPassword" type="password" :placeholder="`至少 ${PASSWORD_MIN_LENGTH} 位`" autocomplete="new-password" />
            <p class="signin__hint">验证码对了就换成新密码并登录，旧密码不再能用。</p>
          </TxFormItem>
          <TxFormItem v-else-if="registering" v-slot="{ id }" label="密码（可以不填）">
            <TxInput :id="id" v-model="newPassword" type="password" :placeholder="`至少 ${PASSWORD_MIN_LENGTH} 位`" autocomplete="new-password" />
            <p class="signin__hint">设了以后可以用邮箱加密码登录；不填就用验证码登录，以后在「我的账号」里再设。</p>
          </TxFormItem>
          <TxFormItem v-else-if="mode === 'password'" v-slot="{ id }" label="密码">
            <TxInput :id="id" v-model="password" type="password" :placeholder="`至少 ${PASSWORD_MIN_LENGTH} 位`" autocomplete="current-password" />
            <div class="signin__password-foot">
              <p class="signin__hint">还没设过密码就先用验证码登录，再到「我的账号」里设置。</p>
              <TxButton variant="bare" size="sm" native-type="button" class="signin__forgot" data-testid="forgot-password" @click="forgot = true">忘记密码？</TxButton>
            </div>
          </TxFormItem>

          <p v-if="emailError" class="signin__error" role="alert" data-testid="email-error">{{ emailError }}</p>
          <TxButton v-if="forgot" variant="primary" size="lg" native-type="submit" :loading="submitting" block icon="i-carbon-password">重设密码并登录</TxButton>
          <TxButton v-else :variant="googleFirst ? 'secondary' : 'primary'" size="lg" native-type="submit" :loading="submitting" block :icon="registering ? 'i-carbon-user-follow' : 'i-carbon-login'">
            {{ registering ? "注册并登录" : "登录" }}
          </TxButton>
        </TxForm>

        <TxForm v-if="inviteWithoutEmail" label-position="top" class="signin__form">
          <TxFormItem v-slot="{ id }" label="邀请码">
            <TxInput :id="id" v-model="invite" placeholder="向邀请你的人要" autocomplete="off" spellcheck="false" />
          </TxFormItem>
        </TxForm>

        <TxDivider v-if="redirectProviders.length && emailProvider && !forgot" class="signin__divider">或者</TxDivider>

        <section v-if="redirectProviders.length && !(emailProvider && forgot)" class="signin__providers" aria-label="用其他网站的账号登录">
          <TxButton
            v-for="provider in redirectProviders"
            :key="provider.id"
            :variant="googleFirst && googleRegister(provider) ? 'primary' : 'secondary'"
            size="lg"
            :icon="providerIcon(provider)"
            :loading="leaving === provider.id"
            :disabled="providerBlocked(provider)"
            :data-provider="provider.id"
            block
            @click="start(provider)"
          >{{ providerLabel(provider) }}</TxButton>
        </section>

        <p class="signin__note">
          <template v-if="forgot">验证码发到账号绑定的邮箱。记得旧密码、只想换一个的话，登录后到「我的账号」里改。只用 GitHub 或 Google 登录、还没绑邮箱的账号，先用原来的方式登录再绑邮箱。</template>
          <template v-else-if="registering">邮箱和 Google 注册要邀请码，向邀请你的人要。GitHub 组织的成员直接用 GitHub 登录，账号会自动建好。</template>
          <template v-else>登录后全站认的是你的极客班账号，改密码在「我的账号」里。还没有账号就切到「注册」。</template>
        </p>
      </template>

      <p v-if="returnPath !== '/'" class="signin__return" :title="returnPath">登录后回到 {{ returnPath }}</p>
      <div class="signin__more" :class="{ 'signin__more--pair': shownOutcome?.action }">
        <TxButton v-if="shownOutcome?.action" variant="secondary" :icon="shownOutcome.action.icon" block @click="followAction(shownOutcome.action)">
          {{ shownOutcome.action.label }}
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
  box-shadow: var(--tx-box-shadow-light);
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
.signin__alert--tight {
  margin-bottom: 0;
}
.signin__tabs {
  margin: -4px 0 14px;
}
/* 按卡片里的实际宽度排：放得下两个完整的大按钮才并排，不按窗口宽度猜 */
.signin__providers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.signin__divider {
  margin: 18px 0 14px;
  font-size: 12px;
}
.signin__modes {
  align-self: flex-start;
}
.signin__forgot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: -4px 0 14px;
}
.signin__forgot-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.signin__password-foot {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.signin__forgot {
  flex: none;
  margin-top: -2px;
}
/* layout.css 给相邻的表单项再加 14px 上边距，叠在 TxForm 自己的 14px 间距上；登录卡片的字段和其它控件一样只隔 14px */
.signin__form > .tx-form-item + .tx-form-item {
  margin-top: 0;
}
.signin__form :deep(.tx-input) {
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
  background: var(--tx-fill-color-lighter);
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
