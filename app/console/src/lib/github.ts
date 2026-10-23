// GitHub 组织页面共用：接口前缀与「能否写」。组织固定为 /api/console/me 返回的 org（服务端 CONSOLE_ORG）；
// 接口仍是 /api/admin/:org/*，能不能做按站内称号的 github.* 能力裁决，在 GitHub 上由服务器接入的 GitHub 去做（#262 第四期）。
import { computed } from "vue";
import { useSession } from "./session";

export function useOrg() {
  const { me, can } = useSession();
  const org = computed(() => me.value?.org ?? "");
  const apiBase = computed(() => `/api/admin/${encodeURIComponent(org.value)}`);
  return { org, apiBase, can, base: "/console/github" };
}

export const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;
