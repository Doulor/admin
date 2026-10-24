<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import { TxButton } from "@talex-touch/tuffex/button";
import ConsoleShell from "../components/ConsoleShell.vue";
import ErrorPanel from "../components/ErrorPanel.vue";
import { primaryTitle as pickTitle, titleTone } from "../lib/users";
import TitleBadge from "../components/TitleBadge.vue";
import logoUrl from "../assets/logo.png";
import { ApiError } from "../lib/http";
import { ASSIGNER_TEXT } from "../lib/levels";
import { loadMe, useSession } from "../lib/session";
import { siteUrl } from "../lib/runtime";
import { bindEmailPath, completeProfilePath } from "../lib/signin";

/**
 * /console 下所有页面的入口：先取身份，未登录去 /signin，还没有登录邮箱去 /bind-email（#273），缺姓名或年级去 /complete-profile（#280），
 * 没有「进入控制台」（console.access）时说明原因。CONTRACT §5 约定这种账号的 /api/console/me 照样回 200，
 * 服务端要是回了 403 forbidden（缺 console.access）也按同一种情况说明。
 */
const { me, meError, meLoading, reload } = useSession();
const route = useRoute();
const router = useRouter();

void loadMe();

const signedOut = computed(() => meError.value instanceof ApiError && meError.value.status === 401);
watch(signedOut, value => {
  if (!value) return;
  // 登录没成功回到这里时（?signin=<原因>），原因交给登录页说明，不跟着塞进 return_to
  const { signin, ...query } = route.query;
  const returnTo = router.resolve({ path: route.path, query, hash: route.hash }).fullPath;
  void router.replace({ path: "/signin", query: { return_to: returnTo, ...(typeof signin === "string" && { signin }) } });
}, { immediate: true });

const emailRequired = computed(() => me.value?.email_required === true);
const profileRequired = computed(() => me.value?.profile_required === true);
watch([emailRequired, profileRequired], ([email, profile]) => {
  if (email) void router.replace(bindEmailPath(route.fullPath));
  else if (profile) void router.replace(completeProfilePath(route.fullPath));
}, { immediate: true });

const noAccess = computed(() => meError.value instanceof ApiError && meError.value.status === 403 && meError.value.code === "forbidden");
const guest = computed(() => noAccess.value || Boolean(me.value && !me.value.permissions.includes("console.access")));
const primaryTitle = computed(() => (me.value ? pickTitle(me.value.titles) : null));
const goPortal = () => window.location.assign(siteUrl("portal", "/"));
const goAccount = () => void router.push("/account");
</script>

<template>
  <div v-if="(meLoading && !me) || signedOut || emailRequired || profileRequired" class="root-state" role="status">
    <TxSpinner :size="24" label="正在确认登录状态" />
    <span class="muted">正在确认登录状态</span>
  </div>

  <div v-else-if="meError && !me && !noAccess" class="root-state console-ground">
    <div class="root-state__box">
      <ErrorPanel :error="meError" :retry="reload" size="large" />
    </div>
  </div>

  <div v-else-if="guest" class="root-state console-ground">
    <TxCard class="guest">
      <img :src="logoUrl" alt="" width="48" height="48" class="guest__logo">
      <h1>你还不能使用控制台</h1>
      <template v-if="!me">
        <p>你已经登录，但这个账号没有「进入控制台」权限。</p>
        <p>官网、论坛和比赛不受影响。需要用控制台的话，请联系{{ ASSIGNER_TEXT }}。</p>
      </template>
      <template v-else-if="me.level === 'visitor' || me.level === 'registered'">
        <p>你已经登录 <span class="mono">@{{ me.username }}</span>，这个账号现在是{{ me.level_name }}，没有「进入控制台」权限。</p>
        <p>如果身份不对，请联系{{ ASSIGNER_TEXT }}，在「用户」里改成正确的身份。</p>
      </template>
      <template v-else>
        <p>你已经登录 <span class="mono">@{{ me.username }}</span>，你所在的组里还没有「进入控制台」权限。</p>
        <p>官网、论坛和比赛不受影响。需要用控制台的话，请联系{{ ASSIGNER_TEXT }}。</p>
      </template>
      <div v-if="me && primaryTitle" class="guest__badge"><TitleBadge :label="primaryTitle.name" :tone="titleTone(primaryTitle, me.department)" /></div>
      <div class="guest__actions">
        <TxButton variant="secondary" @click="goPortal">回到官网</TxButton>
        <TxButton variant="secondary" icon="i-carbon-user-avatar" @click="goAccount">我的账号</TxButton>
      </div>
    </TxCard>
  </div>

  <ConsoleShell v-else-if="me" :me="me" />
</template>

<style scoped>
.root-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  min-height: 100vh;
  padding: 24px 16px;
}
.root-state__box {
  width: min(520px, 100%);
}
.guest {
  width: min(520px, 100%);
  text-align: center;
}
.guest__logo {
  display: block;
  margin: 8px auto 12px;
  border-radius: 12px;
}
.guest h1 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
}
.guest p {
  margin: 6px 0;
  line-height: 22px;
  color: var(--tx-text-color-regular);
}
.guest__badge {
  margin: 14px 0 4px;
}
.guest__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 16px 0 8px;
}
</style>
