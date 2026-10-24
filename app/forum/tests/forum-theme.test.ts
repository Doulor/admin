import type { ForumTheme, SiteAccount } from '../shared/site-account'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { loadModule } from './support/sfc'

/**
 * useForumTheme (#276): the choice goes on the page at once through
 * @nuxtjs/color-mode, then to the account; 跟随系统 is stored as null; the
 * account's saved theme wins in a browser that has not chosen.
 */
type ThemeChoice = ForumTheme | 'system'

function setup(preference: string, forumTheme: ForumTheme | null | undefined, signedIn = true) {
  const colorMode = reactive({ preference })
  const account = ref(signedIn ? { username: 'ada', forumTheme } as unknown as SiteAccount : null)
  const { useForumTheme } = loadModule<{ useForumTheme: () => { choice: { value: ThemeChoice }, set: (value: ThemeChoice) => Promise<void>, applyAccountTheme: (theme: ForumTheme | null | undefined) => void } }>('composables/useForumTheme.ts', {
    globals: { useColorMode: () => colorMode, useSiteAccount: () => ({ account }) },
  })
  return { theme: useForumTheme(), colorMode, account }
}

function stubFetch(ok = true) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => ({ ok }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('useForumTheme', () => {
  it('reads 晴空, 浅色 and 深色 as themselves and anything else as 跟随系统', () => {
    expect(setup('sky', null).theme.choice.value).toBe('sky')
    expect(setup('dark', null).theme.choice.value).toBe('dark')
    expect(setup('system', null).theme.choice.value).toBe('system')
    expect(setup('sepia', null).theme.choice.value).toBe('system')
  })

  it('changes the page first, then saves the choice to the account', async () => {
    const fetch = stubFetch()
    const { theme, colorMode, account } = setup('system', null)
    const saving = theme.set('sky')
    expect(colorMode.preference).toBe('sky')
    await saving
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]![0]).toBe('/api/identity/profile')
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ prefs: { forum_theme: 'sky' } }) })
    expect(account.value?.forumTheme).toBe('sky')
  })

  it('stores 跟随系统 as null', async () => {
    const fetch = stubFetch()
    const { theme } = setup('dark', 'dark')
    await theme.set('system')
    expect(fetch.mock.calls[0]![1]).toMatchObject({ body: JSON.stringify({ prefs: { forum_theme: null } }) })
  })

  it('sends nothing signed out or when the account already has it, and keeps the page on a refused save', async () => {
    const fetch = stubFetch(false)
    await setup('light', null, false).theme.set('sky')
    await setup('light', 'sky').theme.set('sky')
    expect(fetch).not.toHaveBeenCalled()

    const refused = setup('light', 'light')
    await refused.theme.set('dark')
    expect(refused.colorMode.preference).toBe('dark')
    expect(refused.account.value?.forumTheme).toBe('light')
  })

  it('takes the account\'s theme, and leaves the browser alone when the account has none', () => {
    const { theme, colorMode } = setup('system', null)
    theme.applyAccountTheme(null)
    expect(colorMode.preference).toBe('system')
    theme.applyAccountTheme('sky')
    expect(colorMode.preference).toBe('sky')
  })
})
