import { siteForumState } from '../../shared/site-state'

/**
 * 极客班论坛 (`contentSource: 'site'`): the forum server holds the data. Like
 * the snapshot plugin, this runs before the app mounts, so the upstream demo
 * seed is never on screen, not even for one frame: the store starts empty,
 * the session as a guest, and then asks `/api/forum/state` for the current
 * viewer projection (stores/forum-server.ts). A failure stays empty instead
 * of restoring source bodies that may have been restricted since build time.
 *
 * The store already starts from this state in a site build (see
 * `initialState` in stores/forum.ts); replacing it here keeps the guarantee
 * independent of how the bundle was folded.
 */
export default defineNuxtPlugin({
  name: 'geek-site-state',
  dependsOn: ['pinia'],
  setup() {
    const { isSite } = useContentSource()
    if (!isSite)
      return
    const forum = useForumStore()
    const session = useSessionStore()
    forum.replaceState(siteForumState())
    session.currentUserId = null
    void useForumServerStore().load()
  },
})
