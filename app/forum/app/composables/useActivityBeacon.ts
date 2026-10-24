/**
 * 论坛前端埋点（#274）：攒批 POST /api/events（surface=forum），和门户 app/web/sites/portal/lib/events.ts
 * 同一套攒批逻辑——两边工具链不同，没法共享一份模块，这里单独抄一份。只在真的连着论坛后端时发
 * （`serverMode`：示例、本地快照预览没有这个接口，发了也只是静默失败，不如直接不发）。失败一律静默，
 * 不重试、不影响界面；动作必须在服务端 FORUM_EVENT_WHITELIST 里（app/server/src/lib/activity.ts），
 * 不传密码、验证码、令牌、地址栏查询串、邮箱、真实姓名或帖子正文。
 */
export type ForumEventAction = 'page.view' | 'forum.theme.change' | 'forum.sticker.use'

export type ForumEvent = { action: ForumEventAction, target_type?: string, target_id?: string, meta?: Record<string, unknown> }

const BATCH = 20
const DELAY_MS = 2000

const queue: ForumEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

function send(events: ForumEvent[]): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ surface: 'forum', events }),
    }).catch(() => undefined)
  }
  catch {
    /* 请求本身没发出去：不影响界面 */
  }
}

function flush(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  while (queue.length > 0) send(queue.splice(0, BATCH))
}

function listen(): void {
  if (listening)
    return
  listening = true
  // 关页面、切走标签页时把攒着的发掉（keepalive 让请求在页面卸载后继续）
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden')
      flush()
  })
}

export function useActivityBeacon() {
  const { serverMode } = useContentSource()

  function report(action: ForumEventAction, extra: Omit<ForumEvent, 'action'> = {}): void {
    if (!serverMode || !import.meta.client)
      return
    queue.push({ action, ...extra })
    listen()
    if (queue.length >= BATCH)
      flush()
    else if (timer === null)
      timer = setTimeout(flush, DELAY_MS)
  }

  return { report }
}
