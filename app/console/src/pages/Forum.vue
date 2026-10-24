<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { TxCard } from "@talex-touch/tuffex/card";
import { TxButton } from "@talex-touch/tuffex/button";
import { TxStatusBadge } from "@talex-touch/tuffex/status-badge";
import PageHeader from "../components/PageHeader.vue";
import { FORUM_PERMISSIONS } from "../lib/nav";
import { nodeLabel } from "../lib/permission-nodes";
import { siteUrl } from "../lib/runtime";
import { useSession } from "../lib/session";

/** 论坛版务动作对应的权限节点说明；#276（论坛 v2）会把这些接到真实的论坛接口上。 */
const FORUM_ACTIONS: Record<string, string> = {
  "forum.moderate.pin": "置顶或取消置顶话题",
  "forum.moderate.close": "关闭或重新打开话题",
  "forum.moderate.edit": "编辑别人的帖子",
  "forum.moderate.delete": "删除别人的帖子",
  "forum.category.manage": "管理分类",
  "forum.sticker.manage": "管理表情包",
  "forum.badge.grant": "授予论坛徽章",
};

const router = useRouter();
const { me, can } = useSession();
const mine = computed(() => FORUM_PERMISSIONS.map(id => ({
  id, label: nodeLabel(id), action: FORUM_ACTIONS[id], has: Boolean(me.value?.permissions.includes(id)),
})));
const openForum = () => window.open(siteUrl("forum", "/"), "_blank", "noopener");
</script>

<template>
  <div class="page">
    <PageHeader title="论坛管理" description="论坛版务由权限组决定。要改谁能做版务，到「权限」里编辑对应部门或称号的组。">
      <template #actions>
        <TxButton variant="primary" icon="i-carbon-launch" @click="openForum">打开论坛</TxButton>
      </template>
    </PageHeader>

    <TxCard>
      <template #header>
        <div class="card-head">
          <h2 class="section-title">你的论坛权限</h2>
          <span class="count">{{ mine.filter(item => item.has).length }} / {{ mine.length }}</span>
        </div>
      </template>
      <ul class="caps">
        <li v-for="item in mine" :key="item.id" class="caps__row">
          <TxStatusBadge :text="item.has ? '有' : '无'" :status="item.has ? 'success' : 'muted'" size="sm" />
          <span class="caps__text">
            <span>{{ item.label }}</span>
            <span class="muted">{{ item.action }}</span>
          </span>
        </li>
      </ul>
      <TxButton v-if="can('perm.view')" variant="ghost" size="sm" icon="i-carbon-security" class="caps__link" @click="router.push('/console/permissions?tab=nodes')">看哪些组有这些权限</TxButton>
    </TxCard>
  </div>
</template>

<style scoped>
.caps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.caps__row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.caps__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
}
.caps__text > span:first-child {
  font-size: 14px;
  color: var(--tx-text-color-primary);
}
.caps__link {
  margin-top: 14px;
  min-height: 44px;
}
</style>
