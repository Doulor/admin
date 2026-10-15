<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxAlert } from "@talex-touch/tuffex/alert";
import logoUrl from "../assets/logo.png";
import { isMock, signInHref, siteUrl } from "../lib/runtime";
import { parseSignInOutcome, type OutcomeAction } from "../lib/signin";

/** 未登录：只有一个 GitHub 登录按钮。登录后回到原来要去的控制台页面。 */
const route = useRoute();
const returnPath = computed(() => {
  const raw = typeof route.query.return_to === "string" ? route.query.return_to : "";
  return raw.startsWith("/console") || raw.startsWith("/admin") ? raw : "/console";
});
const href = computed(() => signInHref(`${window.location.origin}${returnPath.value}`));
const signedOut = computed(() => route.query.signed_out === "1");

const outcome = computed(() => parseSignInOutcome(route.query.signin));
const portal = siteUrl("portal", "/");
const signIn = () => window.location.assign(href.value);
const goPortal = () => window.location.assign(portal);
const followAction = (action: OutcomeAction) => {
  if (action.target === "_blank") window.open(action.href, "_blank", "noopener,noreferrer");
  else window.location.assign(action.href);
};
</script>

<template>
  <div class="signin console-ground">
    <TxCard class="signin__card">
      <img :src="logoUrl" alt="" width="56" height="56" class="signin__logo">
      <h1>极客班控制台</h1>
      <p>只对极客班 GitHub 组织的成员开放。能看到哪些页面、做哪些操作，取决于你的称号。</p>
      <TxAlert v-if="signedOut" type="success" title="你已退出登录" :closable="false" class="signin__alert" />
      <TxAlert v-if="outcome" :type="outcome.type" :title="outcome.title" :closable="false" class="signin__alert">
        <template v-if="outcome.body">{{ outcome.body }}</template>
      </TxAlert>
      <TxAlert v-if="isMock()" type="info" title="开发预览" :closable="false" class="signin__alert">
        当前是样板数据，登录按钮会连到本地后端。要看登录后的页面，去掉地址里的 __persona=signed_out。
      </TxAlert>
      <TxButton variant="primary" size="lg" icon="i-carbon-logo-github" block @click="signIn">用 GitHub 登录</TxButton>
      <div class="signin__more" :class="{ 'signin__more--pair': outcome?.action }">
        <TxButton v-if="outcome?.action" variant="secondary" :icon="outcome.action.icon" block @click="followAction(outcome.action)">
          {{ outcome.action.label }}
        </TxButton>
        <TxButton variant="secondary" icon="i-carbon-arrow-left" block @click="goPortal">回到官网</TxButton>
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
.signin__card {
  width: min(420px, 100%);
  text-align: center;
}
.signin__logo {
  display: block;
  margin: 12px auto 16px;
  border-radius: 14px;
}
.signin h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}
.signin p {
  margin: 8px 0 20px;
  line-height: 22px;
  color: var(--tx-text-color-secondary);
}
.signin__alert {
  margin-bottom: 16px;
  text-align: left;
}
.signin__more {
  display: grid;
  gap: 12px;
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
