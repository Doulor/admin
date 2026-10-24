<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxInput } from "@talex-touch/tuffex/input";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxSpinner } from "@talex-touch/tuffex/spinner";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import logoUrl from "../assets/logo.png";
import ErrorPanel from "../components/ErrorPanel.vue";
import { ApiError, api, jsonBody } from "../lib/http";
import { clearSession } from "../lib/session";
import { GRADE_OPTIONS, gradeProblem, isSelectableGrade, realNameProblem } from "../lib/grade";
import { bindEmailPath, completeProfileReturn } from "../lib/signin";
import type { AccountView } from "../lib/types";

/**
 * 补资料页（#280，所有者 2026-10-24 13:45：老账号和新账号都要填所在年级和真实姓名，年级是下拉框，不能自己填写）。
 * 服务端的登录回调、对外授权、设备授权和官网、论坛、控制台读到 profile_required 都把人带到这里，填好回到 return_to。
 * 还没有登录邮箱时先去绑定邮箱页，绑好再回这一页。页面上只有填写和退出；填好后本人不能再改，要改找管理员。
 */
const route = useRoute();
const router = useRouter();
const origin = window.location.origin;
const target = computed(() => completeProfileReturn(route.query.return_to, origin));
const view = ref<AccountView | null>(null);
const loadError = ref<unknown>(null);

const realName = ref("");
const grade = ref<number | "">("");
const gradeInput = computed({ get: () => grade.value, set: (value: string | number | (string | number)[]) => { grade.value = typeof value === "number" ? value : ""; } });
const error = ref<string | null>(null);
const busy = ref<"save" | "leave" | null>(null);
const saved = ref(false);

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
    if (view.value.email_required) return void router.replace(bindEmailPath(here()));
    if (!view.value.profile_required) return leave();
    realName.value = view.value.real_name ?? "";
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 401) return signInAgain();
    loadError.value = failure;
  }
}
onMounted(load);

/** 管理员只清掉了其中一项时，另一项已经填过、不再让本人改，页面上只显示 */
const hasName = computed(() => Boolean(view.value?.real_name));
const hasGrade = computed(() => view.value?.grade !== null && view.value?.grade !== undefined);

async function save() {
  error.value = null;
  const problem = (hasName.value ? null : realNameProblem(realName.value)) ?? (hasGrade.value ? null : gradeProblem(grade.value));
  if (problem) { error.value = problem; return; }
  // 已经有的那一项服务端不会改，照接口要求带上现在的值；已毕业不是下拉框里的值，带哪个都一样
  const current = view.value?.grade;
  const chosen = isSelectableGrade(grade.value) ? grade.value : isSelectableGrade(current) ? current : 4;
  busy.value = "save";
  try {
    await api("/api/identity/real-info", { method: "POST", ...jsonBody({ real_name: hasName.value ? view.value!.real_name : realName.value.trim(), grade: chosen }) });
    saved.value = true;
    leave();
  } catch (failure) {
    busy.value = null;
    if (failure instanceof ApiError && failure.code === "real_info_locked") { saved.value = true; return leave(); }
    if (failure instanceof ApiError && failure.status === 401) return signInAgain();
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
  <div class="profile console-ground">
    <TxCard class="profile__card">
      <div class="profile__brand">
        <img :src="logoUrl" alt="" width="52" height="52" class="profile__logo">
        <div>
          <h1>填写姓名和年级</h1>
          <p class="profile__lead">填好以后才能继续使用极客班账号</p>
        </div>
      </div>

      <ErrorPanel v-if="loadError" :error="loadError" :retry="load" />
      <div v-else-if="!view || view.email_required || !view.profile_required || busy === 'leave'" class="profile__state" role="status">
        <TxSpinner :size="18" label="正在读取账号" />
        <span>{{ saved ? "已经保存，正在回到原来的页面…" : view ? "正在打开下一步…" : "正在读取账号…" }}</span>
      </div>

      <template v-else>
        <div class="profile__who">
          <span class="profile__who-label">当前极客班账号</span>
          <span class="mono">{{ view.login }}</span>
        </div>
        <p class="profile__intro">极客班要求实名。年级只能从下拉框里选，每年 9 月 1 日自动升一级，大四之后显示已毕业。填好后自己不能再改，填错了请联系管理员在控制台修改。</p>

        <TxForm label-position="top" class="profile__form" data-testid="profile-form" novalidate @submit="save">
          <TxFormItem v-slot="{ id }" label="真实姓名">
            <TxInput v-if="!hasName" :id="id" v-model="realName" placeholder="和学籍上一致" autocomplete="name" maxlength="32" spellcheck="false" />
            <p v-else class="profile__fixed">{{ view.real_name }}</p>
          </TxFormItem>
          <TxFormItem label="所在年级">
            <!-- TxSelect 0.6.0 的 attrs 落在外层，用 label 给里面的输入框命名。 -->
            <label v-if="!hasGrade" class="fill-width">
              <span class="sr-only">所在年级</span>
              <TxSelect v-model="gradeInput" :options="GRADE_OPTIONS" placeholder="选择年级" class="fill-width" data-testid="profile-grade" />
            </label>
            <p v-else class="profile__fixed">{{ view.grade_label }}</p>
          </TxFormItem>
          <p v-if="error" class="profile__error" role="alert" data-testid="profile-error">{{ error }}</p>
          <TxButton variant="primary" size="lg" native-type="submit" icon="i-carbon-checkmark" block :loading="busy === 'save'" :disabled="busy !== null">
            保存并继续
          </TxButton>
        </TxForm>

        <p class="profile__return" :title="target">填好后回到 {{ target }}</p>
      </template>

      <div class="profile__more">
        <TxButton variant="ghost" icon="i-carbon-logout" block :loading="signingOut" @click="signOut">退出登录</TxButton>
      </div>
    </TxCard>
  </div>
</template>

<style scoped>
.profile {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px 16px;
}
/* 同 BindEmail.vue：TxCard 自带 width: 100%，用 max-width 收窄才不受样式加载顺序影响 */
.profile__card {
  max-width: 440px;
}
.profile__brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 6px 0 18px;
}
.profile__logo {
  flex: none;
  border-radius: 14px;
  box-shadow: var(--tx-box-shadow-light);
}
.profile h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.profile__lead {
  margin: 4px 0 0;
  color: var(--tx-text-color-secondary);
  font-size: 14px;
}
.profile__state {
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
.profile__who {
  display: grid;
  gap: 2px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter);
  line-height: 18px;
  overflow-wrap: anywhere;
}
.profile__who-label {
  font-size: 12px;
  color: var(--tx-text-color-secondary);
}
.profile__intro {
  margin: 12px 0 14px;
  font-size: 14px;
  line-height: 22px;
}
/* layout.css 给相邻的表单项再加 14px 上边距，叠在 TxForm 自己的 14px 间距上；这里和登录页一样只隔 14px */
.profile__form > .tx-form-item + .tx-form-item {
  margin-top: 0;
}
.profile__form :deep(.tx-input) {
  min-height: 44px;
}
.profile__fixed {
  margin: 0;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--tx-fill-color-lighter);
  font-size: 14px;
}
.profile__error {
  margin: -4px 0 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--tx-color-danger);
}
.profile__return {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--tx-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile__more {
  display: grid;
  margin-top: 12px;
}
</style>
