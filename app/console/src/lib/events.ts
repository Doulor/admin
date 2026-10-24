// 控制台前端埋点（#274）：批量 POST /api/events（surface=console），和门户 app/web/sites/portal/lib/events.ts
// 同一套攒批逻辑，三个前端各自工具链不同，没法共享一份模块。开发预览（isMock）没有真的后端，不发。
// 失败一律静默，不重试、不影响界面；动作必须在服务端 CONSOLE_EVENT_WHITELIST 里（app/server/src/lib/activity.ts）。
import { isMock } from "./runtime";

export type ConsoleEventAction = "page.view";
export type ConsoleEvent = { action: ConsoleEventAction; target_type?: string; target_id?: string; meta?: Record<string, unknown> };

const BATCH = 20;
const DELAY_MS = 2000;

const queue: ConsoleEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function send(events: ConsoleEvent[]): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ surface: "console", events }),
    }).catch(() => undefined);
  } catch {
    /* 请求本身没发出去：不影响界面 */
  }
}

export function flushEvents(): void {
  if (timer !== null) {
    clearTimeout(timer);
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

export function reportEvent(action: ConsoleEventAction, extra: Omit<ConsoleEvent, "action"> = {}): void {
  if (isMock()) return;
  queue.push({ action, ...extra });
  listen();
  if (queue.length >= BATCH) flushEvents();
  else if (timer === null) timer = setTimeout(flushEvents, DELAY_MS);
}
