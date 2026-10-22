<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import logoUrl from "../assets/logo.png";
import { api } from "../lib/http";
import { isMock, siteUrl } from "../lib/runtime";
import {
  parseSignInOutcome, providerHref, providerIcon, readProviders, safeReturnPath,
  type LoginProvider, type OutcomeAction,
} from "../lib/signin";

/**
 * 极客班统一登录页（#262）。官网、论坛、控制台的「登录」都到这里：登录方式按 GET /auth/providers 渲染，前端不写死渠道；
 * 登录后回到 return_to（只接受本站路径）；登录没成功时服务端也回到这里并带上 ?signin=<原因>，原因在这里讲清。
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
const start = (provider: LoginProvider) => {
  leaving.value = provider.id;
  window.location.assign(providerHref(provider, returnPath.value, origin));
};
const goPortal = () => window.location.assign(siteUrl("portal", "/"));
const followAction = (action: OutcomeAction) => {
  if (action.target === "_blank") window.open(action.href, "_blank", "noopener,noreferrer");
  else window.location.assign(action.href);
};
</script>

<template>
  <div class="signin console-ground">
    <TxCard class="signin__card">
      <div class="signin__brand">
        <img :src="logoUrl" alt="" width="52" height="52" class="signin__logo">
        <div>
          <h1>极客班统一登录</h1>
          <p class="signin__lead">官网、论坛、控制台和比赛都用这个账号登录</p>
        </div>
      </div>

      <TxAlert v-if="signedOut" type="success" title="你已退出登录" :closable="false" class="signin__alert">官网、论坛、控制台已一起退出。</TxAlert>
      <TxAlert v-if="outcome" :type="outcome.type" :title="outcome.title" :closable="false" class="signin__alert" data-testid="signin-outcome">
        <template v-if="outcome.body">{{ outcome.body }}</template>
      </TxAlert>
      <TxAlert v-if="isMock()" type="info" title="开发预览" :closable="false" class="signin__alert">
        当前是样板数据，登录按钮会连到本地后端。要看登录后的页面，去掉地址里的 __persona=signed_out。
      </TxAlert>

      <section class="signin__methods" aria-labelledby="signin-methods">
        <h2 id="signin-methods">选择登录方式</h2>
        <div v-if="state === 'loading'" class="signin__loading" role="status">
          <TxSpinner :size="18" label="正在读取登录方式" />
          <span>正在读取可用的登录方式…</span>
        </div>
        <div v-else-if="state === 'failed'" class="signin__failed" role="alert">
          <span>登录方式没有加载出来，可能是网络不稳定。</span>
          <TxButton variant="secondary" size="sm" icon="i-carbon-renew" @click="loadProviders">重试</TxButton>
        </div>
        <div v-else class="signin__providers">
          <TxButton
            v-for="(provider, index) in redirectProviders"
            :key="provider.id"
            :variant="index === 0 ? 'primary' : 'secondary'"
            size="lg"
            :icon="providerIcon(provider)"
            :loading="leaving === provider.id"
            :data-provider="provider.id"
            block
            @click="start(provider)"
          >通过 {{ provider.name }} 继续</TxButton>
        </div>
        <p class="signin__note">
          GitHub 只是登录方式之一。登录后全站认的是你的极客班账号，称号、帖子和参赛记录都跟着账号走。
        </p>
      </section>

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
}
.signin__alert {
  margin-bottom: 14px;
  text-align: left;
}
.signin__methods h2 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-text-color-secondary);
  letter-spacing: 0.04em;
}
.signin__providers {
  display: grid;
  gap: 10px;
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
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 19px;
  color: var(--tx-text-color-secondary);
}
.signin__return {
  margin: 16px 0 0;
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
