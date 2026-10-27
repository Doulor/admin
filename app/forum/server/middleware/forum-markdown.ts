import type { H3Event } from 'h3'
import type { ForumState } from '../../app/data/types'
import type { MarkdownSite } from '../../shared/forum-markdown'
import { createSeed } from '../../app/data/seed'
import { forumLlmsTxt, topicMarkdown } from '../../shared/forum-markdown'
import { loadLocalSnapshot, snapshotConfigured, snapshotHttpError } from '../utils/local-snapshot'

/**
 * `/t/<id>.md` and `/llms.txt`: the Markdown views of shared/forum-markdown.ts.
 *
 * A middleware rather than `routes/t/[id].md.ts`: the router reads `:id.md`
 * as one placeholder spanning the whole segment, so that file would also
 * answer `/t/<id>` and shadow the topic page on the dev server.
 *
 * Demo/snapshot keep their old local behavior. Site mode never reads the
 * published source here: local dev proxies documents and published images to
 * core's `/forum/*` routes, which use the same viewer as `/api/forum/state`.
 * Production is a static image; web nginx sends those external paths directly
 * to core before the forum image.
 */

const TOPIC_MARKDOWN = /^\/t\/([^/]+)\.md$/
const PUBLISHED_ASSET = /^\/published\/[a-f0-9]{16}\.webp$/

/** One seed per server process, so every file of a build shares one clock. */
let seed: ForumState | undefined

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD')
    return
  const path = event.path.split('?')[0] ?? ''
  const topicMatch = TOPIC_MARKDOWN.exec(path)
  const publishedAsset = PUBLISHED_ASSET.test(path)
  if (path !== '/llms.txt' && !topicMatch && !publishedAsset)
    return

  if (useRuntimeConfig().public.contentSource === 'site')
    return proxyRequest(event, `http://127.0.0.1:3000/forum${path}`)
  // In demo/snapshot mode public/ owns these source images exactly as before.
  if (publishedAsset)
    return

  const { state, notice } = await markdownSource()
  const site = siteOf(notice)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  if (!topicMatch)
    return text(event, 'text/plain', forumLlmsTxt(state, site))

  // h3 has already percent-decoded the path; decoding again would throw on a literal `%`.
  const markdown = topicMarkdown(state, topicMatch[1] ?? '', site)
  if (markdown === null) {
    setResponseStatus(event, 404)
    return text(event, 'text/plain', '这个话题不存在。\n')
  }
  return text(event, 'text/markdown', markdown)
})

async function markdownSource(): Promise<{ state: ForumState, notice: string }> {
  if (import.meta.dev && snapshotConfigured()) {
    try {
      const { document } = await loadLocalSnapshot()
      return { state: document.state, notice: `内容来自极客班论坛的本机只读快照，采集于 ${document.capturedAt}。` }
    }
    catch (error) {
      throw snapshotHttpError(error)
    }
  }
  seed ??= createSeed()
  return {
    state: seed,
    notice: '内容是论坛的示例数据，只包含构建时就有的话题，时间按构建时刻推算；在浏览器里新发的话题和回复只保存在那个浏览器里，不在这里。',
  }
}

function siteOf(notice: string): MarkdownSite {
  const config = useRuntimeConfig()
  return {
    siteName: String(config.public.siteName),
    origin: config.public.siteDeployment.origin,
    basePath: config.app.baseURL,
    notice,
  }
}

function text(event: H3Event, type: string, body: string): string {
  setHeader(event, 'Content-Type', `${type}; charset=utf-8`)
  return body
}
