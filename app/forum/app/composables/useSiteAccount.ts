import type { SiteAccount } from '../../shared/site-account'
import { toast } from '@talex-touch/tuffex/utils'
import { signinOutcomes } from '../../shared/signin-outcomes'
import { bindEmailHref, completeProfileHref, emailRequired, parseMe, profileRequired } from '../../shared/site-account'

export type { SiteAccount } from '../../shared/site-account'

/**
 * 极客班统一登录的会话（真实数据模式用）。
 *
 * 登录只有一个入口：极客班统一登录页 `/signin`（#262）→ 选一种登录方式 → `/auth/callback` 写下 `sid` cookie，官网、论坛、控制台共用；
 * 登录没成功时核心服务回到 `/signin` 说明原因；这里只处理旧链接里残留的 `?signin=`（说一次再从地址里拿掉）。
 * 注册邀请码从 #274 起选填：邮箱、Google、GitHub 注册都不再要求先加入极客班 GitHub 组织，登录成功就是真实成员；
 * 不登录也能看论坛。
 * 论坛与官网、控制台同域（线上 `/forum/` 由 web 容器反代），所以直接读同域的 `/auth/me` 就知道是谁；
 * 本机独立端口上没有 `/auth/me`（返回 404 或 HTML），当作未登录。回答怎么读见 `shared/site-account.ts`。
 * 账号还没有登录邮箱（`email_required`，#273）时整页跳到绑定邮箱页，缺真实姓名或年级（`profile_required`，#280）时
 * 跳到补资料页，办好都回到当前页。
 */
/** 顶栏调用本组合函数；同一页面只发一次 /auth/me。 */
let inflight: Promise<void> | null = null
let accountVersion = 0

export function useSiteAccount() {
  const account = useState<SiteAccount | null>('site-account', () => null)
  const loaded = useState<boolean>('site-account:loaded', () => false)
  const outcomeShown = useState<boolean>('site-account:outcome-shown', () => false)
  const route = useRoute()
  const router = useRouter()

  function refresh(): Promise<void> {
    if (!import.meta.client)
      return Promise.resolve()
    if (!inflight) {
      const pending = fetchAccount().finally(() => {
        if (inflight === pending)
          inflight = null
      })
      inflight = pending
    }
    return inflight
  }

  function acceptAccount(next: SiteAccount | null): void {
    const changed = account.value?.login !== next?.login
    account.value = next
    if (useContentSource().serverMode) {
      const server = useForumServerStore()
      // /auth/me does not expose the forum's exact read level. Revalidate an
      // active projection rather than guessing rights from a login. The
      // projection can be loading or rate-limited while /auth/me answers;
      // refreshIdentity must still advance its version before that old read
      // or write can settle.
      const activeProjection = server.status === 'ready' || server.status === 'loading' || server.status === 'busy'
      if (activeProjection && (changed || loaded.value || !next))
        void server.refreshIdentity({ preserveLocalWork: !changed && !!next })
    }
  }

  async function fetchAccount(): Promise<void> {
    const version = accountVersion
    try {
      const response = await fetch('/auth/me', { credentials: 'same-origin', headers: { accept: 'application/json' } })
      const body: unknown = response.ok && response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : null
      if (version !== accountVersion)
        return
      if (emailRequired(body) || profileRequired(body)) {
        const { pathname, search, hash } = window.location
        const back = `${pathname}${search}${hash}`
        window.location.assign(emailRequired(body) ? bindEmailHref(back) : completeProfileHref(back))
        return
      }
      acceptAccount(parseMe(body))
    }
    catch {
      if (version === accountVersion)
        acceptAccount(null)
    }
    finally {
      if (version === accountVersion)
        loaded.value = true
    }
  }

  function showSigninOutcome(): void {
    outcomeShown.value = true
    const raw = route.query.signin
    // 登录没成功的原因在这里说明一次，然后把参数从地址里拿掉，刷新页面不会重复提示。
    const outcomes = signinOutcomes({ hasPosts: !useContentSource().isSite || useForumStore().state.topics.length > 0 })
    const outcome = typeof raw === 'string' ? outcomes[raw] : undefined
    if (raw === undefined)
      return
    if (outcome)
      toast({ ...outcome, duration: 8000 })
    void router.replace({ query: { ...route.query, signin: undefined }, hash: route.hash })
  }

  /**
   * 在任一处退出，官网、论坛、控制台一起变成未登录（同一个 `sid`）。
   * 只有服务端确认清掉了会话才显示已退出；没成功就保持原样并说明，不让界面和实际状态对不上。
   * 极客班论坛同时回到游客身份，并重新读一次论坛（书签、通知只属于登录的人）。
   */
  async function signOut(): Promise<void> {
    const ok = await fetch('/auth/signout', { method: 'POST', credentials: 'same-origin' })
      .then(response => response.ok)
      .catch(() => false)
    if (ok) {
      accountVersion += 1
      inflight = null
      account.value = null
      loaded.value = true
      if (useContentSource().serverMode) {
        void useForumServerStore().refreshIdentity()
      }
      return
    }
    toast({ title: '没有退出成功', description: '请刷新页面后再试一次。', variant: 'warning' })
  }

  if (import.meta.client && !loaded.value)
    void refresh()
  if (import.meta.client && !outcomeShown.value)
    showSigninOutcome()

  return { account, loaded, refresh, signOut }
}
