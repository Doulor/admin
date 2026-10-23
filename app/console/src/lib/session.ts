// 当前登录者与权限节点清单。`can` 只决定显示什么；真正的授权在服务端。
import { computed, reactive } from "vue";
import { ApiError, api, onSignedOut } from "./http";
import { nodeLabel } from "./permission-nodes";
import type { ConsoleMe, Permission } from "./types";

const state = reactive({
  me: null as ConsoleMe | null,
  meError: null as unknown,
  meLoading: false,
});

let pendingMe: Promise<void> | null = null;

export async function loadMe(force = false): Promise<void> {
  if (pendingMe && !force) return pendingMe;
  state.meLoading = true;
  pendingMe = (async () => {
    try {
      state.me = await api<ConsoleMe>("/api/console/me");
      state.meError = null;
    } catch (error) {
      state.me = null;
      state.meError = error;
    } finally {
      state.meLoading = false;
      pendingMe = null;
    }
  })();
  return pendingMe;
}

export function clearSession() {
  state.me = null;
  state.meError = null;
}

/**
 * 任何接口返回 401 都算登录已失效（#133）：清掉身份，把这个 401 当作身份读取失败交给 meError。
 * ConsoleRoot 监听的就是 meError 的 401，会带着当前地址跳 /signin，登录后回到原页面。
 */
function signedOut(error: ApiError) {
  if (state.meError instanceof ApiError && state.meError.status === 401) return;
  state.me = null;
  state.meError = error;
}
onSignedOut(signedOut);

export function useSession() {
  const me = computed(() => state.me);
  const can = (node: Permission) => Boolean(state.me?.permissions.includes(node));
  const canAny = (anyOf: Permission[]) => anyOf.some(can);
  return {
    me, can, canAny,
    permissionLabel: nodeLabel,
    meError: computed(() => state.meError),
    meLoading: computed(() => state.meLoading),
    reload: () => loadMe(true),
  };
}
