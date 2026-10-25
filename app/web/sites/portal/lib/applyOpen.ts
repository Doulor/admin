// 招新总开关（#284）在官网这一侧的读法：GET /api/public/config 的 apply_open。
// 开关只由服务端裁决：关闭时 POST /api/portal/apply 回 403 apply_closed（routes/portal/apply.ts）。官网读不到、旧服务端没有这个字段，
// 都当作开放，最坏是多让人看到一次信纸，不会替人把招新关掉。
import { useEffect, useState } from "react";
import { requestJson } from "@shared/lib/http";

/** 只有明确写着 false 才算关闭 */
export function applyOpenOf(config: unknown): boolean {
  return (config as { apply_open?: unknown } | null)?.apply_open !== false;
}

/** 「加入我们」窗口现在该显示什么：配置没读到之前是 loading；读到后按开关；寄信时服务端说已经关了也是 closed */
export type JoinView = "loading" | "letter" | "closed";

export function joinView(state: { loaded: boolean; open: boolean; closedByServer: boolean }): JoinView {
  if (state.closedByServer) return "closed";
  if (!state.loaded) return "loading";
  return state.open ? "letter" : "closed";
}

/**
 * 桌面用：挂载时读一次，便签、「关于」窗口、图标说明据此不再叫人去写信；「加入我们」窗口每次打开都会自己重读一遍，
 * 并通过返回的 setter 把结果同步回来，所以开关在刷新页面或重新打开窗口时生效。读不到时保持开放。
 */
export function useApplyOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    let cancelled = false;
    requestJson<unknown>("/api/public/config")
      .then((config) => {
        if (!cancelled) setOpen(applyOpenOf(config));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return [open, setOpen];
}
