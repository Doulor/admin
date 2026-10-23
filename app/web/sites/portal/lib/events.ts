// 门户前端埋点：攒批 POST /api/events（CONTRACT-274 §4），一批最多 20 条，2 秒或页面隐藏时发出。
// 失败一律静默，不重试、不影响界面；动作必须在服务端白名单里。
export type PortalEventAction = "os.boot.played" | "os.boot.skipped" | "os.app.open" | "os.note.dismissed" | "forum.theme.change" | "page.view";

export type PortalEvent = { action: PortalEventAction; target_type?: string; target_id?: string; meta?: Record<string, unknown> };

const BATCH = 20;
const DELAY_MS = 2000;

const queue: PortalEvent[] = [];
let timer: number | null = null;
let listening = false;

function send(events: PortalEvent[]): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
    }).catch(() => undefined);
  } catch {
    /* 请求本身没发出去：不影响界面 */
  }
}

export function flushEvents(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  while (queue.length > 0) send(queue.splice(0, BATCH));
}

function listen(): void {
  if (listening) return;
  listening = true;
  // 关页面、切走标签页时把攒着的发掉（keepalive 让请求在页面卸载后继续）
  window.addEventListener("pagehide", flushEvents);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushEvents();
  });
}

export function reportEvent(action: PortalEventAction, extra: Omit<PortalEvent, "action"> = {}): void {
  queue.push({ action, ...extra });
  listen();
  if (queue.length >= BATCH) flushEvents();
  else if (timer === null) timer = window.setTimeout(flushEvents, DELAY_MS);
}
