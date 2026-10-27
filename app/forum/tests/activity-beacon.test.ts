import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadModule } from './support/sfc'

/**
 * useActivityBeacon (#274): batches reports and POSTs /api/events with
 * `surface: 'forum'` after a short delay or page hide, the same shape as the
 * portal's app/web/sites/portal/lib/events.ts. Gated on serverMode: the demo
 * and the local snapshot have no backend to receive it.
 */
function setup(serverMode = true) {
  const listeners = new Map<string, () => void>()
  vi.stubGlobal('window', { addEventListener: (name: string, handler: () => void) => listeners.set(name, handler) })
  vi.stubGlobal('document', { addEventListener: (name: string, handler: () => void) => listeners.set(name, handler), visibilityState: 'visible' })
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<{ ok: boolean }> => ({ ok: true }))
  vi.stubGlobal('fetch', fetch)
  const { useActivityBeacon } = loadModule<{ useActivityBeacon: () => { report: (action: string, extra?: Record<string, unknown>) => void } }>('composables/useActivityBeacon.ts', {
    globals: { useContentSource: () => ({ serverMode }) },
  })
  return { ...useActivityBeacon(), fetch, hidePage: () => { listeners.get('pagehide')?.() } }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useActivityBeacon', () => {
  it('sends nothing until the debounce passes, then posts the batch with surface=forum', async () => {
    vi.useFakeTimers()
    const beacon = setup()
    beacon.report('page.view', { target_type: 'route', target_id: 't-id' })
    beacon.report('forum.theme.change', { meta: { theme: 'dark' } })
    expect(beacon.fetch).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(beacon.fetch).toHaveBeenCalledOnce()
    const [url, init] = beacon.fetch.mock.calls[0]!
    expect(url).toBe('/api/events')
    expect(init).toBeDefined()
    expect(init!).toMatchObject({ method: 'POST', credentials: 'same-origin', keepalive: true })
    expect(JSON.parse(init!.body as string)).toEqual({
      surface: 'forum',
      events: [
        { action: 'page.view', target_type: 'route', target_id: 't-id' },
        { action: 'forum.theme.change', meta: { theme: 'dark' } },
      ],
    })
  })

  it('flushes immediately on pagehide, even before the debounce passes', () => {
    vi.useFakeTimers()
    const beacon = setup()
    beacon.report('forum.sticker.use', { target_type: 'sticker', target_id: 'yugc-wave' })
    beacon.hidePage()
    expect(beacon.fetch).toHaveBeenCalledOnce()
  })

  it('reports nothing without a real backend (demo, local snapshot)', async () => {
    vi.useFakeTimers()
    const beacon = setup(false)
    beacon.report('page.view')
    await vi.advanceTimersByTimeAsync(2000)
    expect(beacon.fetch).not.toHaveBeenCalled()
  })
})
