import type { AccountDepartment } from '~/data/types'
import { parsePublicDepartments } from '~/data/account-badges'

/**
 * 部门的名字与色调，给 `TitleBadge` 的新称号标签取色用（#276 CONTRACT §9）：读同域的
 * `/api/public/departments`（不登录也能读，不含人和权限）。读到之前、失败或内容不合格时是空表，
 * 标签改用这个人自己部门的色调，不提示。旧的 `/api/public/org` 不再读。
 *
 * 只在全站登录的部署（siteLogin）里读；示例登录与本机快照后面没有核心服务，用不上新称号。
 * 本机论坛在 3456，`nuxt.config.ts` 的 devProxy 把这个路径转给 127.0.0.1:3000。
 */

/** 一个页面里所有标签共用一次请求，失败也不重试。 */
let inflight: Promise<void> | null = null

export function useOrgTitles() {
  const departments = useState<Map<string, AccountDepartment>>('geek:departments', () => new Map())
  const loaded = useState<boolean>('geek:departments:loaded', () => false)

  async function fetchDepartments(): Promise<void> {
    try {
      const response = await fetch('/api/public/departments', { credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (response.ok && response.headers.get('content-type')?.includes('application/json'))
        departments.value = parsePublicDepartments(await response.json() as unknown)
    }
    catch {
      // 读不到就用每个人自己的部门色调。
    }
    finally {
      loaded.value = true
    }
  }

  const { siteLogin } = useContentSource()
  if (import.meta.client && siteLogin && !loaded.value)
    inflight ??= fetchDepartments().finally(() => { inflight = null })

  return departments
}
