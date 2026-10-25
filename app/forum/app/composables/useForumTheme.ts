import type { ForumTheme } from '../../shared/site-account'

/**
 * The forum's theme (#276): 晴空, 浅色, 深色, or 跟随系统. @nuxtjs/color-mode
 * keeps the choice in this browser and puts the class on <html> (`sky` is the
 * 晴空 tokens in uno.config.ts; `dark` is Tuffex's own). Signed in, the choice
 * also goes to the account (`prefs.forum_theme` through PATCH
 * /api/identity/profile), and a browser that has the account but not the
 * choice takes it from there (`applyAccountTheme`, called by app.vue), so
 * signing in elsewhere keeps 晴空. 跟随系统 stays in the browser: the account
 * stores null for it.
 *
 * Saving to the account is best-effort: the theme has already changed on the
 * page, and a refused save only means another browser will not follow.
 *
 * Every real change also reports `forum.theme.change` (#274: the only way a
 * visitor's theme choice — no account to save it to — shows up in the
 * activity log at all).
 */
export type ThemeChoice = ForumTheme | 'system'

export function useForumTheme() {
  const colorMode = useColorMode()
  const { account } = useSiteAccount()
  const { report } = useActivityBeacon()

  const choice = computed<ThemeChoice>(() => {
    const value = colorMode.preference
    return value === 'sky' || value === 'light' || value === 'dark' ? value : 'system'
  })

  async function set(value: ThemeChoice): Promise<void> {
    const changed = colorMode.preference !== value
    colorMode.preference = value
    if (changed)
      report('forum.theme.change', { meta: { theme: value } })
    const current = account.value
    const stored = value === 'system' ? null : value
    if (!current || current.forumTheme === stored)
      return
    try {
      const response = await fetch('/api/identity/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'accept': 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ prefs: { forum_theme: stored } }),
      })
      if (response.ok && account.value)
        account.value = { ...account.value, forumTheme: stored }
    }
    catch {
      // The page already shows the theme; only other browsers miss it.
    }
  }

  /** The account's saved theme wins over this browser's once the account is known. */
  function applyAccountTheme(theme: ForumTheme | null | undefined): void {
    if (theme && colorMode.preference !== theme)
      colorMode.preference = theme
  }

  return { choice, set, applyAccountTheme }
}
