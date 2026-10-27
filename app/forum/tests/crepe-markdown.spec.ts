import type { CrepeEditor, CrepeEditorOptions, MentionQuery } from '../app/editor/crepe-editor'
import type { StickerRef } from '../shared/post-markdown'
import { transferableAbortController } from 'node:util'
import { TxMarkdownView } from '@talex-touch/tuffex/markdown-view'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import { createCrepeEditor } from '../app/editor/crepe-editor'
import { createForumApi } from '../shared/forum-api'
import { imagesToStickers, renderableMarkdown, replyQuote, stickerIndex, stickersToImages, WORD_JOINER } from '../shared/post-markdown'

const cleanups: (() => unknown | Promise<unknown>)[] = []
let topicId: string
let origin: string

beforeAll(async () => {
  origin = process.env.TUFF_FORUM_URL ?? ''
  // Never send test posts to an ordinary development, preview or real site.
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
    throw new Error('TUFF_FORUM_URL must be the isolated A4 HTTP fixture on 127.0.0.1')
  const response = await fetch(`${origin}/__a4/health`)
  const fixture = await response.json()
  expect(fixture).toMatchObject({ fixture: 'A4', database: ':memory:', externalRequests: false })
  expect(typeof fixture.topicId).toBe('string')
  topicId = fixture.topicId
  // jsdom has no layout engine. Supply only its missing Range geometry APIs
  // for Crepe's cursor positioning; these tests make no geometry/UI claims.
  if (!Range.prototype.getClientRects)
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null })
  if (!Range.prototype.getBoundingClientRect)
    Range.prototype.getBoundingClientRect = () => new DOMRect()
  if (!globalThis.IntersectionObserver) {
    // jsdom cannot measure visibility. Report observed elements as visible so
    // Crepe initializes its real CodeMirror view instead of leaving a fallback.
    globalThis.IntersectionObserver = class implements IntersectionObserver {
      readonly root = null
      readonly rootMargin = '0px'
      readonly thresholds = [0]
      private readonly targets = new Set<Element>()
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.targets.add(target)
        queueMicrotask(() => {
          if (!this.targets.has(target))
            return
          const rect = new DOMRect()
          this.callback([{
            target, isIntersecting: true, intersectionRatio: 1, time: performance.now(),
            boundingClientRect: rect, intersectionRect: rect, rootBounds: rect,
          }], this)
        })
      }

      unobserve(target: Element) { this.targets.delete(target) }
      disconnect() { this.targets.clear() }
      takeRecords() { return [] }
    }
  }
})

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse())
    await cleanup()
})

async function openEditor(value: string, options: Partial<Pick<CrepeEditorOptions, 'onMention' | 'onMentionKey' | 'findSticker'>> = {}) {
  const root = document.createElement('div')
  document.body.append(root)
  const changes: string[] = []
  const editor: CrepeEditor = await createCrepeEditor({
    root,
    value,
    placeholder: '回复内容',
    onChange: markdown => changes.push(markdown),
    onUpload: async () => { throw new Error('Unexpected upload') },
    onStickerMenu: null,
    onMention: () => {},
    onMentionKey: () => false,
    findSticker: () => undefined,
    ...options,
  })
  cleanups.push(async () => {
    await editor.destroy()
    root.remove()
  })
  const editable = root.querySelector<HTMLElement>('.ProseMirror')
  expect(editable).not.toBeNull()
  return { editor, editable: editable!, changes }
}

async function showPost(content: string, stickers?: ReadonlyMap<string, StickerRef>) {
  const root = document.createElement('div')
  document.body.append(root)
  // The production post-rendering path, including Tuffex's real sanitizer.
  const app = createApp(() => h(TxMarkdownView, { content: renderableMarkdown(content, stickers) }))
  app.mount(root)
  cleanups.push(() => {
    app.unmount()
    root.remove()
  })
  await vi.waitFor(() => expect(root.querySelector('.markdown-body')?.textContent).toBeTruthy())
  return root
}

const visibleText = (node: Element) => node.textContent?.replaceAll(WORD_JOINER, '') ?? ''

async function fixtureFetch(path: string, init: RequestInit = {}) {
  // jsdom and Node's native fetch have different AbortSignal realms. Bridge
  // the external HTTP boundary without changing the client or its timeouts.
  const controller = transferableAbortController()
  const abort = () => controller.abort()
  if (init.signal?.aborted)
    abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  try {
    return await fetch(`${origin}${path}`, { ...init, signal: controller.signal })
  }
  finally {
    init.signal?.removeEventListener('abort', abort)
  }
}

async function saveAndRead(content: string) {
  const api = createForumApi(fixtureFetch)
  const written = await api.createPost({ topicId, content })
  const read = (await api.topicPosts(topicId)).find(post => post.id === written.postId)!
  expect(read.content).toBe(content)
  return read.content!
}

it('sends a quote with an empty paragraph, reads it back and reopens without visible HTML placeholders', async () => {
  const { editable, changes } = await openEditor(`${replyQuote('引用原文', 'ada')}回复正文`)
  const reply = [...editable.children].find(node => node.textContent === '回复正文')!
  expect(reply).toBeDefined()
  // The DOM mutations a contenteditable edit produces. ProseMirror's real
  // DOM observer parses them; no editor/serializer/plugin is replaced.
  editable.insertBefore(document.createElement('p'), reply)
  editable.dispatchEvent(new Event('input', { bubbles: true }))
  await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0))

  const content = changes.at(-1)!
  const read = await saveAndRead(content)
  const rendered = await showPost(read)
  expect(rendered.querySelector('blockquote')?.textContent).toContain('@ada：引用原文')
  expect([...rendered.querySelectorAll('p')].map(visibleText).filter(Boolean)).toEqual(['@ada：引用原文', '回复正文'])
  expect(visibleText(rendered)).not.toContain('<br')

  const reopened = await openEditor(read)
  expect(reopened.editable.querySelector('blockquote')?.textContent).toContain('@ada：引用原文')
  expect(reopened.editable.textContent).toContain('回复正文')
  expect(reopened.editable.textContent).not.toContain('<br')
})

it('keeps soft and hard breaks inside and outside a quote through save and reopen', async () => {
  const source = '> 引用软一\n> 引用软二\n>\n> 引用硬一  \n> 引用硬二\n\n正文软一\n正文软二\n\n正文硬一  \n正文硬二'
  const { editor, changes } = await openEditor('')
  editor.setMarkdown(source)
  await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0))
  const read = await saveAndRead(changes.at(-1)!)
  const rendered = await showPost(read)
  expect([...rendered.querySelectorAll('p')].map(visibleText)).toEqual([
    '引用软一引用软二', '引用硬一引用硬二', '正文软一正文软二', '正文硬一正文硬二',
  ])
  expect(rendered.querySelectorAll('br')).toHaveLength(4)
  for (const paragraph of rendered.querySelectorAll('p'))
    expect(paragraph.querySelectorAll('br')).toHaveLength(1)
  expect(rendered.querySelectorAll('blockquote p')).toHaveLength(2)
  expect(visibleText(rendered)).not.toContain('<br')
  const reopened = await openEditor(read)
  // Crepe represents a soft break as an inline space, a hard break as <br>.
  expect(reopened.editable.querySelectorAll('[data-type="hardbreak"]')).toHaveLength(4)
  expect(reopened.editable.querySelectorAll('br:not(.ProseMirror-trailingBreak)')).toHaveLength(2)
  expect(reopened.editable.querySelectorAll('blockquote p')).toHaveLength(2)
})

it('normalizes leading, repeated and trailing empty paragraphs without growing tags on another edit', async () => {
  const { editable, changes } = await openEditor('前段\n\n后段')
  const after = [...editable.children].find(node => node.textContent === '后段')!
  expect(after).toBeDefined()
  editable.prepend(document.createElement('p'))
  editable.insertBefore(document.createElement('p'), after)
  editable.insertBefore(document.createElement('p'), after)
  editable.append(document.createElement('p'))
  editable.dispatchEvent(new Event('input', { bubbles: true }))
  await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0))
  const read = await saveAndRead(changes.at(-1)!)
  const rendered = await showPost(read)
  expect([...rendered.querySelectorAll('p')].map(visibleText).filter(Boolean)).toEqual(['前段', '后段'])
  expect(visibleText(rendered)).not.toContain('<br')

  const reopened = await openEditor('')
  reopened.editor.setMarkdown(read)
  await vi.waitFor(() => expect(reopened.changes.length).toBeGreaterThan(0))
  // Markdown collapses extra empty paragraphs on parse, not into HTML tags.
  expect(reopened.changes.at(-1)).toBe('前段\n\n后段\n')
  expect([...reopened.editable.querySelectorAll('p')].map(visibleText).filter(Boolean)).toEqual(['前段', '后段'])
})

it('completes a real @ query with Enter and saves the chosen username as text', async () => {
  let range: MentionQuery | null = null
  const { editor, editable, changes } = await openEditor('', {
    onMention: query => { range = query },
    onMentionKey: (key) => {
      if (key !== 'Enter' || !range)
        return false
      complete()
      return true
    },
  })
  editor.insert('@ad')
  await vi.waitFor(() => expect(range?.query).toBe('ad'))
  const complete = () => editor.completeMention(range!, 'ada')
  const enter = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
  editable.dispatchEvent(enter)
  expect(enter.defaultPrevented).toBe(true)
  editor.insert('你好')
  await vi.waitFor(() => expect(changes.at(-1)).toContain('@ada 你好'))
  const read = await saveAndRead(changes.at(-1)!)
  const rendered = await showPost(read)
  expect(visibleText(rendered).trim()).toBe('@ada 你好')
  const reopened = await openEditor(read)
  expect(reopened.editable.textContent).toBe('@ada 你好')
})

it('saves pictures as Markdown and stickers as shortcodes, then reopens both as pictures', async () => {
  const picture = `/api/forum/uploads/${'b'.repeat(64)}.webp`
  const wave = { shortcode: 'a4-wave', label: '挥手', url: `/api/forum/stickers/${'a'.repeat(64)}.webp` }
  const stickers = stickerIndex([{ name: 'A4', stickers: [wave] }])
  const findSticker: CrepeEditorOptions['findSticker'] = key =>
    ('src' in key ? key.src === wave.url : key.token === '[A4_挥手]') ? { src: wave.url, label: wave.label } : undefined
  const { editor, changes } = await openEditor('', { findSticker })
  editor.setMarkdown(`正文 ![截图](${picture}) 末尾`)
  await vi.waitFor(() => expect(changes.at(-1)).toContain(picture))
  editor.insertSticker({ src: wave.url, label: wave.label })
  await vi.waitFor(() => expect(changes.at(-1)).toContain(wave.url))
  const read = await saveAndRead(imagesToStickers(changes.at(-1)!, stickers))
  expect(read).toContain(':a4-wave:')
  expect(read).toContain(picture)
  const rendered = await showPost(read, stickers)
  expect([...rendered.querySelectorAll('img')].map(img => img.getAttribute('src')).sort()).toEqual([picture, wave.url].sort())
  expect(rendered.querySelector('img.forum-sticker')?.getAttribute('alt')).toBe('挥手')
  expect(visibleText(rendered)).toContain('正文')
  expect(visibleText(rendered)).toContain('末尾')
  expect(visibleText(rendered)).not.toContain('<br')
  const reopened = await openEditor(stickersToImages(read, stickers), { findSticker })
  // Crepe's image UI also contains an empty preview <img> with no src.
  expect([...reopened.editable.querySelectorAll('img[src]')].map(img => img.getAttribute('src')).sort()).toEqual([picture, wave.url].sort())
})

it('keeps authored HTML and code literal while scripts, handlers and unsafe links stay inert', async () => {
  const source = [
    '原文 <br /> 不替换',
    '`<br />`',
    '```html\n<br />\n<script>alert(1)</script>\n```',
    '<script>globalThis.__a4Xss = 1</script>',
    '<img src="x" onerror="globalThis.__a4Xss = 1">',
    '[危险链接](javascript:alert(1))',
  ].join('\n\n')
  const { editor, editable, changes } = await openEditor('')
  editor.setMarkdown(source)
  // The first code block lazily loads CodeMirror's HTML language support.
  await vi.waitFor(() => expect(changes.length).toBeGreaterThan(0), { timeout: 5000 })
  await vi.waitFor(() => expect(editable.querySelector('.cm-content')).not.toBeNull())
  expect(editable.querySelector('script, [onerror], [onload], iframe')).toBeNull()
  expect(editable.textContent).toContain('原文 <br /> 不替换')
  const read = await saveAndRead(changes.at(-1)!)
  const rendered = await showPost(read)
  expect(rendered.querySelector('script, [onerror], [onload], iframe, svg')).toBeNull()
  expect([...rendered.querySelectorAll('[href], [src]')].every(node => !/^(?:javascript|data|vbscript):/i.test(node.getAttribute('href') ?? node.getAttribute('src') ?? ''))).toBe(true)
  expect(visibleText(rendered)).toContain('原文 <br /> 不替换')
  expect([...rendered.querySelectorAll('code')].map(visibleText)).toEqual(['<br />', '<br />\n<script>alert(1)</script>\n'])
  const reopened = await openEditor(read)
  expect(reopened.editable.querySelector('script, [onerror], [onload], iframe')).toBeNull()
  expect(reopened.editable.textContent).toContain('原文 <br /> 不替换')
  expect(Reflect.get(globalThis, '__a4Xss')).toBeUndefined()
})
