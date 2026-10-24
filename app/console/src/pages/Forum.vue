<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxTabs, TxTabItem } from "@talex-touch/tuffex/tabs";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import PageHeader from "../components/PageHeader.vue";
import CategoriesTab from "./forum/CategoriesTab.vue";
import StickersTab from "./forum/StickersTab.vue";
import { FORUM_PERMISSIONS } from "../lib/nav";
import { nodeLabel } from "../lib/permission-nodes";
import { siteUrl } from "../lib/runtime";
import { useSession } from "../lib/session";
import { vSnapIndicator } from "../lib/tabs";

/**
 * 论坛管理（#276）：分类的可见范围（`forum.category.manage`）、表情包（`forum.sticker.manage`）、
 * 自己有哪些论坛权限。只显示持有节点的页签；页签写在地址栏里（`?tab=stickers`，打开的表情包是 `&pack=<id>`，换页签时清掉）。
 * 置顶、关闭、编辑别人的帖子这些版务在论坛页面上做。
 */
const FORUM_ACTIONS: Record<string, string> = {
  "forum.moderate.pin": "置顶或取消置顶话题",
  "forum.moderate.close": "关闭或重新打开话题",
  "forum.moderate.edit": "编辑别人的帖子，改话题的可见范围",
  "forum.moderate.delete": "删除别人的帖子",
  "forum.category.manage": "改分类的可见范围",
  "forum.sticker.manage": "管理表情包",
  "forum.badge.grant": "授予论坛徽章",
};

const route = useRoute();
const router = useRouter();
const { me, can } = useSession();

type Tab = "categories" | "stickers" | "mine";
const tabs = computed(() => [
  ...(can("forum.category.manage") ? [{ id: "categories" as Tab, label: "分类" }] : []),
  ...(can("forum.sticker.manage") ? [{ id: "stickers" as Tab, label: "表情" }] : []),
  { id: "mine" as Tab, label: "我的论坛权限" },
]);
const tab = computed<Tab>(() => tabs.value.find(item => item.id === route.query.tab)?.id ?? tabs.value[0].id);
const setTab = (value: string) => void router.replace({ query: { ...route.query, pack: undefined, tab: value === tabs.value[0].id ? undefined : value } });

const mine = computed(() => FORUM_PERMISSIONS.map(id => ({
  id, label: nodeLabel(id), action: FORUM_ACTIONS[id], has: Boolean(me.value?.permissions.includes(id)),
})));
const openForum = () => window.open(siteUrl("forum", "/"), "_blank", "noopener");
</script>

<template>
  <div class="page">
    <PageHeader title="论坛管理" description="分类谁能看、论坛里有哪些表情，在这里改；置顶、关闭和编辑别人的帖子在论坛页面上做。谁能做这些，由「权限」里的组决定。">
      <template #actions>
        <TxButton variant="secondary" icon="i-carbon-launch" @click="openForum">打开论坛</TxButton>
      </template>
    </PageHeader>

    <TxCard :padding="0" class="forum-card">
      <TxTabs v-snap-indicator :model-value="tab" placement="top" indicator-variant="line" borderless :content-scrollable="false" :content-padding="0" @update:model-value="setTab">
        <TxTabItem v-for="item in tabs" :key="item.id" :name="item.id">
          <template #name>{{ item.label }}</template>
          <CategoriesTab v-if="item.id === 'categories'" />
          <StickersTab v-else-if="item.id === 'stickers'" />
          <div v-else class="mine">
            <div class="card-head">
              <h2 class="section-title">你的论坛权限</h2>
              <span class="count">{{ mine.filter(row => row.has).length }} / {{ mine.length }}</span>
            </div>
            <ul class="caps">
              <li v-for="row in mine" :key="row.id" class="caps__row" :class="{ 'caps__row--off': !row.has }">
                <span class="caps__text">
                  <span class="caps__label">{{ row.label }}</span>
                  <span class="caps__action">{{ row.action }}</span>
                </span>
                <TxStatusBadge :text="row.has ? '有' : '没有'" :status="row.has ? 'success' : 'muted'" size="sm" />
              </li>
            </ul>
            <TxButton v-if="can('perm.view')" variant="ghost" size="sm" icon="i-carbon-security" class="caps__link" @click="router.push('/console/permissions?tab=nodes')">看哪些组有这些权限</TxButton>
          </div>
        </TxTabItem>
      </TxTabs>
    </TxCard>
  </div>
</template>

<style scoped>
.forum-card :deep(.tx-tabs__nav) {
  border-bottom: 1px solid var(--tx-border-color-lighter);
  padding: 4px 20px 0;
}
.mine {
  width: 100%;
  box-sizing: border-box;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.caps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.caps__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--tx-border-color-lighter);
  border-radius: 12px;
  background: var(--tx-bg-color-overlay, #fff);
}
.caps__row--off {
  background: var(--tx-fill-color-lighter, #fafafa);
}
.caps__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.caps__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--tx-text-color-primary);
}
.caps__action {
  font-size: 13px;
  line-height: 20px;
  color: var(--tx-text-color-secondary);
}
.caps__link {
  align-self: flex-start;
}
@media (max-width: 640px) {
  .mine {
    padding: 16px;
  }
}
</style>
