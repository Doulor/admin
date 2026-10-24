import type { ForumAction, PermissionContext } from '~/data/permissions'
import { forumAccess } from '~/data/access'
import { can, isStaff as isStaffUser } from '~/data/permissions'

/**
 * The session store plus the permission check every write control asks
 * before it renders. `user` is `null` for guests.
 *
 * Against the forum server, what the viewer may do is the server's
 * `viewer.capabilities` and `viewer.nodes` (#276) and nothing else; `access`
 * says whether writing is possible at all (the server may be unreachable).
 * `signedInReader` is an account the server knows that holds no write node
 * for the action: a registered user before the invite code, who gets the
 * 成为成员 words instead of the button.
 */
export function useCurrentUser() {
  const session = useSessionStore()
  const server = useForumServerStore()
  const { mode, serverMode } = useContentSource()

  const user = computed(() => session.currentUser)
  const isLoggedIn = computed(() => session.isLoggedIn)
  const granted = computed(() => (serverMode ? server.granted : undefined))
  const isStaff = computed(() => isStaffUser(session.currentUser, granted.value))
  const { account, loaded } = useSiteAccount()
  const access = computed(() => forumAccess(mode, server.status, session.currentUser, loaded.value && !!account.value))

  function allowed(action: ForumAction, ctx?: PermissionContext): boolean {
    return access.value.writable && can(session.currentUser, action, ctx, granted.value)
  }

  /** Signed in and readable, but the server grants no write for `action`: the 成为成员 hint replaces the control. */
  function signedInReader(action: Extract<ForumAction, 'createTopic' | 'reply'>, ctx?: PermissionContext): boolean {
    return serverMode && access.value.writable && !!session.currentUser && !allowed(action, ctx)
      && !(action === 'reply' && ctx?.topic?.closed)
  }

  return { session, user, isLoggedIn, isStaff, access, can: allowed, signedInReader }
}
