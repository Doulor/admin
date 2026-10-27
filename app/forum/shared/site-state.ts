import type { ForumState } from '../app/data/types'
import { emptyForumState } from './local-snapshot'

/**
 * Site builds never embed topic/category/tag/user content. The first visible
 * projection must come from the core service for the current viewer; after an
 * identity reset or failed first read there is no static body to fall back to.
 * Demo and local-snapshot modes keep their separate sources.
 */
export function siteForumState(): ForumState {
  return emptyForumState()
}
