import type { Ref } from 'vue'
import type { SiteAccount } from '../shared/site-account'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { accountMenu } from '~/data/account-menu'
import * as siteAccount from '../shared/site-account'
import { bindEmailHref, completeProfileHref, emailRequired, parseMe, profileRequired } from '../shared/site-account'
import { loadModule } from './support/sfc'

describe('parseMe', () => {
  it('reads a signed-in answer', () => {
    expect(parseMe({ signed_in: true, login: 'ada', avatar_url: 'https://avatars.githubusercontent.com/u/1', console_link: true }))
      .toEqual({ login: 'ada', avatarUrl: 'https://avatars.githubusercontent.com/u/1', consoleLink: true, forumTheme: null })
  })

  it('reads the forum theme the account saved, and only the three themes (#276)', () => {
    for (const theme of ['sky', 'light', 'dark'] as const)
      expect(parseMe({ signed_in: true, login: 'ada', prefs: { forum_theme: theme } })?.forumTheme).toBe(theme)
    for (const prefs of [undefined, {}, { forum_theme: null }, { forum_theme: 'system' }, { forum_theme: 'neon' }, 'sky'])
      expect(parseMe({ signed_in: true, login: 'ada', prefs })?.forumTheme).toBeNull()
  })

  it('hides 控制台 unless console_link is exactly true', () => {
    for (const console_link of [undefined, false, 'true', 1, null]) {
      const account = parseMe({ signed_in: true, login: 'ada', ...(console_link === undefined ? {} : { console_link }) })
      expect(account?.consoleLink).toBe(false)
      expect(accountMenu({ login: 'ada', consoleLink: account!.consoleLink, user: null }).items.map(item => item.key)).not.toContain('console')
    }
    const admin = parseMe({ signed_in: true, login: 'ada', console_link: true })
    expect(accountMenu({ login: 'ada', consoleLink: admin!.consoleLink, user: null }).items.map(item => item.key)).toContain('console')
  })

  it('treats anything but a signed-in answer with a login as signed out', () => {
    for (const body of [null, undefined, '<!doctype html>', {}, { signed_in: false, login: 'ada' }, { signed_in: 'yes', login: 'ada' }, { signed_in: true }, { signed_in: true, login: '' }, { signed_in: true, login: 42 }])
      expect(parseMe(body)).toBeNull()
  })

  it('keeps no avatar that is not a string', () => {
    expect(parseMe({ signed_in: true, login: 'ada', avatar_url: null })?.avatarUrl).toBeNull()
    expect(parseMe({ signed_in: true, login: 'ada', avatar_url: 7 })?.avatarUrl).toBeNull()
  })
})

describe('emailRequired', () => {
  it('is true only for a signed-in answer that says the account has no login email yet (#273)', () => {
    expect(emailRequired({ signed_in: true, login: 'ada', email_required: true })).toBe(true)
    for (const body of [null, undefined, '<!doctype html>', {}, { signed_in: true, login: 'ada' }, { signed_in: true, login: 'ada', email_required: 'true' }, { signed_in: false, email_required: true }])
      expect(emailRequired(body)).toBe(false)
  })

  it('sends the browser to the bind page with the page it is on, site paths only', () => {
    expect(bindEmailHref('/forum/t/7?page=2#p3')).toBe('/bind-email?return_to=%2Fforum%2Ft%2F7%3Fpage%3D2%23p3')
    expect(bindEmailHref('//evil.test/')).toBe('/bind-email?return_to=%2F')
    expect(bindEmailHref('https://evil.test/')).toBe('/bind-email?return_to=%2F')
  })
})

describe('profileRequired', () => {
  it('is true only for a signed-in answer that says the name or grade is missing (#280)', () => {
    expect(profileRequired({ signed_in: true, login: 'ada', profile_required: true })).toBe(true)
    for (const body of [null, undefined, {}, { signed_in: true, login: 'ada' }, { signed_in: true, login: 'ada', profile_required: 'true' }, { signed_in: false, profile_required: true }])
      expect(profileRequired(body)).toBe(false)
  })

  it('sends the browser to the profile page with the page it is on, site paths only', () => {
    expect(completeProfileHref('/forum/t/7?page=2#p3')).toBe('/complete-profile?return_to=%2Fforum%2Ft%2F7%3Fpage%3D2%23p3')
    expect(completeProfileHref('//evil.test/')).toBe('/complete-profile?return_to=%2F')
  })
})

describe('useSiteAccount reading /auth/me', () => {
  const ADA: SiteAccount = { login: 'ada', avatarUrl: null, consoleLink: false, forumTheme: null }

  /** The page shows ada as signed in; `/auth/me` answers `body`. */
  async function ask(body: unknown) {
    const assign = vi.fn()
    const fetch = vi.fn(async () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }))
    const states = new Map<string, Ref<unknown>>([['site-account', ref(ADA)]])
    const { useSiteAccount } = loadModule<{ useSiteAccount: () => { account: Ref<SiteAccount | null>, refresh: () => Promise<void> } }>('composables/useSiteAccount.ts', {
      imports: {
        '@talex-touch/tuffex/utils': { toast: vi.fn() },
        '../../shared/published': { publishedTopicIds: () => [] },
        '../../shared/signin-outcomes': { signinOutcomes: () => ({}) },
        '../../shared/site-account': siteAccount,
      },
      globals: {
        fetch,
        useState: <T>(key: string, init: () => T) => {
          if (!states.has(key))
            states.set(key, ref(init()))
          return states.get(key) as Ref<T>
        },
        useRoute: () => ({ query: {}, hash: '' }),
        useRouter: () => ({ replace: vi.fn() }),
        useContentSource: () => ({ serverMode: true, isSite: true }),
        useForumServerStore: () => ({}),
        window: { location: { pathname: '/forum/t/7', search: '?page=2', hash: '#p3', assign } },
      },
    })
    // Using it asks /auth/me once; refresh() waits for that same answer.
    const { account, refresh } = useSiteAccount()
    await refresh()
    expect(fetch).toHaveBeenCalledTimes(1)
    return { account: account.value, assign }
  }

  it('sends an account without a login email to the bind page and back to this page (#273)', async () => {
    const { assign } = await ask({ signed_in: true, login: 'ada', email_required: true })
    expect(assign).toHaveBeenCalledWith('/bind-email?return_to=%2Fforum%2Ft%2F7%3Fpage%3D2%23p3')
    expect((await ask({ signed_in: true, login: 'ada', email_required: false })).assign).not.toHaveBeenCalled()
  })

  it('sends an account without a name or grade to the profile page, and to the bind page first when the email is missing too (#280)', async () => {
    expect((await ask({ signed_in: true, login: 'ada', profile_required: true })).assign).toHaveBeenCalledWith('/complete-profile?return_to=%2Fforum%2Ft%2F7%3Fpage%3D2%23p3')
    expect((await ask({ signed_in: true, login: 'ada', email_required: true, profile_required: true })).assign).toHaveBeenCalledWith('/bind-email?return_to=%2Fforum%2Ft%2F7%3Fpage%3D2%23p3')
  })

  it('reads a plain signed-in or signed-out answer straight into the account state', async () => {
    const signedIn = await ask({ signed_in: true, login: 'ada', console_link: false })
    expect(signedIn.account).toEqual(ADA)
    for (const body of [{ signed_in: false }, null]) {
      const { account } = await ask(body)
      expect(account).toBeNull()
    }
  })
})
