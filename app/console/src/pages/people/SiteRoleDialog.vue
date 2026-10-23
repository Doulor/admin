<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { TxModal } from "@talex-touch/tuffex/modal";
import { TxForm, TxFormItem } from "@talex-touch/tuffex/form";
import { TxSelect } from "@talex-touch/tuffex/select";
import { TxButton } from "@talex-touch/tuffex/button";
import { toast } from "@talex-touch/tuffex/utils";
import ErrorAlert from "../../components/ErrorAlert.vue";
import { api, jsonBody } from "../../lib/http";
import { SITE_ROLE_TEXT, UNRECORDED_ROLE_TEXT } from "../../lib/people";
import { useAction } from "../../lib/resource";
import { useSession } from "../../lib/session";
import { titleLabel } from "../../lib/titles";
import type { Person, SiteRoleChoice, SiteRoleResponse } from "../../lib/types";

/**
 * 改一个账号的站内角色（#262 第四期，权限只认极客班账号）：管理员（提督）、成员（舰员），或不是成员（移出极客班）。
 * 只有提督会打开它；服务端再核对一遍，并且不让改掉最后一位管理员。改完对方下一次请求就按新角色算。
 */
const props = defineProps<{ open: boolean; person: Person | null }>();
const emit = defineEmits<{ "update:open": [value: boolean]; done: [] }>();
const { catalogue } = useSession();

const choice = ref<SiteRoleChoice>("member");
watch(() => [props.open, props.person] as const, ([open, person]) => {
  if (!open || !person) return;
  choice.value = person.role_unrecorded ? "member" : person.site_role ?? "none";
  save.reset();
}, { immediate: true });

const options = computed(() => [
  { value: "admin", label: SITE_ROLE_TEXT.admin, description: `是${titleLabel("admin", catalogue.value)}，拥有全部权限` },
  { value: "member", label: SITE_ROLE_TEXT.member, description: `是${titleLabel("member", catalogue.value)}，按称号拿权限` },
  { value: "none", label: SITE_ROLE_TEXT.none, description: "移出极客班，不能再登录" },
]);
/** 现在的站内角色；回填的老账号还没记过时为 null，三种都可以选。 */
const current = computed<SiteRoleChoice | null>(() => props.person?.role_unrecorded ? null : props.person?.site_role ?? "none");
const effect = computed(() => {
  if (choice.value === "none") return "移出后对方不能再登录，已经登录的会话立刻没有任何权限。称号会保留，改回成员后照常生效。";
  if (choice.value === "admin") return `对方会成为${titleLabel("admin", catalogue.value)}，拥有控制台的全部权限，包括改别人的站内角色。`;
  return "对方按称号拿权限；没有别的称号时只有成员的基础权限。";
});

const save = useAction(async () => {
  const person = props.person!;
  const result = await api<SiteRoleResponse>(`/api/console/people/${encodeURIComponent(person.account_id!)}/site-role`, {
    method: "PATCH",
    ...jsonBody({ site_role: choice.value }),
  });
  toast({ title: result.changed ? "站内角色已更新" : "站内角色没有变化", description: `@${person.login} · ${SITE_ROLE_TEXT[choice.value]}`, variant: "success" });
  emit("done");
  emit("update:open", false);
});
</script>

<template>
  <TxModal :model-value="open" title="站内角色" width="min(92vw, 480px)" @update:model-value="value => emit('update:open', value)">
    <TxForm v-if="person" :model="{ choice }" label-position="top" class="role-form" @submit="save.execute()">
      <p class="role-form__who">
        <span class="mono">@{{ person.login }}</span>
        <span class="muted">现在：{{ current === null ? UNRECORDED_ROLE_TEXT : SITE_ROLE_TEXT[current] }}</span>
      </p>
      <p v-if="current === null" class="role-form__effect">这是以前用 GitHub 登录时建的账号，还没记过站内角色，下次用 GitHub 时会按 GitHub 组织补记；在这里定下后就不再看 GitHub。</p>
      <TxFormItem label="改成">
        <TxSelect v-model="choice" :options="options" class="fill-width" />
      </TxFormItem>
      <p v-if="choice !== current" class="role-form__effect">{{ effect }}</p>
      <ErrorAlert v-if="save.error.value" :error="save.error.value" @close="save.reset()" />
    </TxForm>
    <template #footer>
      <div class="dialog-actions">
        <TxButton variant="secondary" @click="emit('update:open', false)">取消</TxButton>
        <TxButton :variant="choice === 'none' ? 'danger' : 'primary'" :loading="save.pending.value" :disabled="choice === current" @click="save.execute()">保存</TxButton>
      </div>
    </template>
  </TxModal>
</template>

<style scoped>
.role-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.role-form__who {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
}
.role-form__effect {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--tx-text-color-secondary);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
