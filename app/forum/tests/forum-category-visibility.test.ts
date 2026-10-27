import type { Ref } from 'vue'
import type { SiteAccount } from '../shared/site-account'
import { clearToasts } from '@talex-touch/tuffex/utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { matchExcerpt } from '~/utils/excerpt'
import { highlightParts } from '~/utils/highlight'
import { useForumStore } from '~/stores/forum'
import { stateRetryDelay, useForumServerStore } from '~/stores/forum-server'
import { useSessionStore } from '~/stores/session'
import * as siteAccount from '../shared/site-account'
import { fakeServer, held, json } from './fixtures/fake-server'
import { MEMBER_VIEWER, REGISTERED_VIEWER, serverState, writeBody } from './fixtures/server-state'
import { loadComponent, loadModule, mount, textOf } from './support/sfc'

function memberBody() {
  const state = serverState(MEMBER_VIEWER)
  state.categories.push({ id: 'c-private', slug: 'private', name: '合成成员分类', description: '合成私有说明', color: '#3346c8', icon: 'i-carbon-education' })
  Object.assign(state.topics[1]!, { categoryId: 'c-private', title: '合成成员话题', visibility: 'member' })
  Object.assign(state.posts[1]!, { excerpt: '合成成员正文' })
  state.bookmarks.push({ userId: 'm1001', postId: 'p10001', createdAt: 25 })
  return { state }
}

function guestBody() {
  const state = serverState()
  state.topics = state.topics.filter(topic => topic.id === 't73')
  state.posts = state.posts.filter(post => post.topicId === 't73')
  return { state }
}

function setup() {
  setActivePinia(createPinia())
  return { forum: useForumStore(), session: useSessionStore(), server: useForumServerStore() }
}

/** Real composable and Pinia stores; only Nuxt globals and the HTTP seam are supplied. */
function accountMenu(initialLogin = 'ada') {
  const states = new Map<string, Ref<unknown>>([
    ['site-account', ref<SiteAccount | null>({ login: initialLogin, avatarUrl: null, consoleLink: false, forumTheme: null })],
    ['site-account:loaded', ref(true)],
    ['site-account:outcome-shown', ref(true)],
  ])
  const { useSiteAccount } = loadModule<{ useSiteAccount: () => { account: Ref<SiteAccount | null>, refresh: () => Promise<void>, signOut: () => Promise<void> } }>('composables/useSiteAccount.ts', {
    imports: {
      '@talex-touch/tuffex/utils': { toast: vi.fn() },
      '../../shared/published': { publishedTopicIds: () => [] },
      '../../shared/signin-outcomes': { signinOutcomes: () => ({}) },
      '../../shared/site-account': siteAccount,
    },
    globals: {
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
      useState: <T>(key: string, init: () => T) => {
        if (!states.has(key))
          states.set(key, ref(init()))
        return states.get(key) as Ref<T>
      },
      useRoute: () => ({ query: {}, hash: '' }),
      useRouter: () => ({ replace: vi.fn() }),
      useContentSource: () => ({ serverMode: true, isSite: true }),
      useForumServerStore,
      useForumStore,
      useSessionStore,
    },
  })
  return useSiteAccount()
}

function expectAnonymous(forum: ReturnType<typeof useForumStore>) {
  expect(forum.state.categories).toEqual([])
  expect(forum.state.tags).toEqual([])
  expect(forum.state.topics).toEqual([])
  expect(forum.state.posts).toEqual([])
  expect(forum.state.users).toEqual([])
  expect(forum.state.notifications).toEqual([])
  expect(forum.state.bookmarks).toEqual([])
  expect(JSON.stringify(forum.state)).not.toContain('合成成员')
  for (const topic of forum.state.topics)
    expect(forum.categoryById(topic.categoryId)).toBeDefined()
}

function mountSearch() {
  const Search = loadComponent('pages/search.vue', {
    globals: {
      useHead: () => {},
      useRoute: () => reactive({ query: { q: '合成' } }),
      useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
      useForumStore,
      useForumServerStore,
      useContentSource: () => ({ serverMode: true }),
      useDebounceFn: (fn: unknown) => fn,
      matchExcerpt,
      highlightParts,
    },
  })
  const container = defineComponent({
    setup: (_props, { slots }) => () => h('div', Object.values(slots).flatMap(slot => slot?.() ?? [])),
  })
  const components = Object.fromEntries(['TxStack', 'TxCard', 'TxTabs', 'TxTabItem', 'TxFlex', 'TxBadge', 'TxDivider', 'TxSearchInput', 'TxCardItem', 'UserAvatar', 'TxStatusBadge']
    .map(name => [name, container]))
  return mount(Search, {}, {
    ...components,
    TopicRow: defineComponent({ props: ['topic'], setup: props => () => h('div', props.topic.title) }),
    TxEmptyState: defineComponent({ props: ['title'], setup: props => () => h('div', props.title) }),
  })
}

beforeEach(() => clearToasts())
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('category projection across session changes (GitHub #272 / A3)', () => {
  it('clears member categories, topics, bodies and personal references immediately on the real sign-out entry, before the guest read answers', async () => {
    const guest = held()
    fakeServer(json(memberBody()), json({ ok: true }), guest.answer)
    const { forum, session, server } = setup()
    await server.load()
    const account = accountMenu()
    expect(forum.state.categories.some(category => category.id === 'c-private')).toBe(true)
    await account.signOut()
    expect(account.account.value).toBeNull()
    expect(session.currentUserId).toBeNull()
    expect(server.viewer).toBeNull()
    expectAnonymous(forum)
    guest.release(json(guestBody()))
    await vi.waitFor(() => expect(server.status).toBe('ready'))
    expect(forum.state.categories.map(category => category.id)).toEqual(['c-exam'])
  })

  it('ignores a member state read that arrives after sign-out and does not release a newer in-flight guest read', async () => {
    const old = held()
    const guest = held()
    const calls = fakeServer(json(memberBody()), old.answer, json({ ok: true }), guest.answer)
    const { forum, server } = setup()
    await server.load()
    const oldLoad = server.load()
    await accountMenu().signOut()
    expectAnonymous(forum)
    old.release(json(memberBody()))
    expect(await oldLoad).toBe(false)
    expectAnonymous(forum)
    const currentLoad = server.load()
    expect(calls.map(call => call.url)).toEqual(['/api/forum/state', '/api/forum/state', '/auth/signout', '/api/forum/state'])
    guest.release(json(guestBody()))
    expect(await currentLoad).toBe(true)
    expect(server.viewer?.kind).toBe('guest')
    expect(forum.state.categories.map(category => category.id)).toEqual(['c-exam'])
  })

  it.each(['busy', 'offline'] as const)('keeps only anonymous fallback after sign-out even when the new state is %s', async (failure) => {
    vi.useFakeTimers()
    fakeServer(json(memberBody()), json({ ok: true }), failure === 'busy'
      ? json({ error: 'rate_limited' }, 429)
      : () => { throw new TypeError('offline') })
    const { forum, server } = setup()
    await server.load()
    await accountMenu().signOut()
    await vi.advanceTimersByTimeAsync(0)
    expectAnonymous(forum)
    expect(server.status).toBe(failure === 'busy' ? 'busy' : 'error')
  })

  it('retries an offline guest projection and restores only the public state when core recovers', async () => {
    vi.useFakeTimers()
    fakeServer(
      json(memberBody()),
      json({ ok: true }),
      () => { throw new TypeError('offline') },
      json(guestBody()),
    )
    const { forum, server } = setup()
    await server.load()
    await accountMenu().signOut()
    await vi.advanceTimersByTimeAsync(0)
    expect(server.status).toBe('error')
    expectAnonymous(forum)
    await vi.advanceTimersByTimeAsync(stateRetryDelay(0))
    await vi.waitFor(() => expect(server.status).toBe('ready'))
    expect(forum.state.categories.map(category => category.id)).toEqual(['c-exam'])
    expect(forum.state.topics.map(topic => topic.id)).toEqual(['t73'])
  })

  it.each(['loadTopic', 'probeTopic', 'search'] as const)('does not restore member metadata from a late %s answer after sign-out', async (operation) => {
    const old = held()
    fakeServer(json(memberBody()), old.answer, json({ ok: true }), json(guestBody()))
    const { forum, server } = setup()
    await server.load()
    const reading = server[operation]('t1001')
    await accountMenu().signOut()
    await vi.waitFor(() => expect(server.viewer?.kind).toBe('guest'))
    const state = forum.state
    const post = { ...memberBody().state.posts[1]!, content: '合成成员正文' }
    old.release(json(operation === 'search'
      ? { results: { topics: [memberBody().state.topics[1]!], posts: [post], users: [] } }
      : { posts: [post] }))
    const answer = await reading
    expect(answer).toBe(operation === 'loadTopic' ? false : operation === 'search' ? null : 'unknown')
    expect(forum.state).toBe(state)
    expect(forum.postById('p10001')).toBeUndefined()
    expect(JSON.stringify(forum.state)).not.toContain('合成成员')
  })

  it.each(['bookmark-success', 'bookmark-refused', 'reply', 'topic', 'reaction'] as const)('ignores a late %s response without merging, rolling back or sending again under a new identity', async (operation) => {
    const old = held()
    const calls = fakeServer(json(memberBody()), old.answer, json({ ok: true }), json(guestBody()))
    const { forum, server } = setup()
    await server.load()
    const sticker = { stickerId: 's1', shortcode: 'test-smile', url: `/api/forum/stickers/${'a'.repeat(64)}.webp` }
    const writing = operation.startsWith('bookmark')
      ? server.toggleBookmark('p10001')
      : operation === 'reply'
        ? server.createPost({ topicId: 't1001', content: '合成成员回复' })
        : operation === 'topic'
          ? server.createTopic({ categoryId: 'c-private', title: '合成成员话题', content: '合成成员正文', tags: [] })
          : server.react('body-73', sticker, true)
    await accountMenu().signOut()
    await vi.waitFor(() => expect(server.viewer?.kind).toBe('guest'))
    const before = JSON.stringify(forum.state)
    old.release(operation === 'bookmark-refused'
      ? json({ error: 'forbidden', message: '合成拒绝' }, 403)
      : operation === 'reaction'
        ? json({ reactions: [{ ...sticker, mine: true, count: 1 }] })
        : json(writeBody({ topics: [memberBody().state.topics[1]!], posts: [{ ...memberBody().state.posts[1]!, content: '合成成员正文' }] }, MEMBER_VIEWER, { topicId: 't1001', postId: 'p10001' })))
    expect(await writing).toBe(operation === 'reaction' ? false : null)
    expect(JSON.stringify(forum.state)).toBe(before)
    expect(server.viewer?.kind).toBe('guest')
    expect(calls).toHaveLength(4)
  })

  it.each(['account', 'level', 'nodes', 'capabilities'] as const)('clears the old projection before merging a write whose viewer changes %s', async (changed) => {
    const guest = held()
    const viewer = changed === 'account' ? { ...MEMBER_VIEWER, userId: 'g1' }
      : changed === 'level' ? REGISTERED_VIEWER
        : changed === 'nodes' ? { ...MEMBER_VIEWER, nodes: [] }
          : { ...MEMBER_VIEWER, capabilities: ['forum.topic.pin'] }
    fakeServer(json(memberBody()), json(writeBody({ posts: [memberBody().state.posts[1]!] }, viewer)), guest.answer)
    const { forum, server } = setup()
    await server.load()
    expect(await server.toggleLike('body-73')).toBeNull()
    expectAnonymous(forum)
    guest.release(json(guestBody()))
    await vi.waitFor(() => expect(server.viewer?.kind).toBe('guest'))
  })

  it('invalidates older body reads when a fresh state lowers the same account to registered', async () => {
    const old = held()
    const registered = guestBody()
    registered.state.viewer = REGISTERED_VIEWER
    fakeServer(json(memberBody()), old.answer, json(registered))
    const { forum, server } = setup()
    await server.load()
    const reading = server.loadTopic('t1001')
    expect(await server.load()).toBe(true)
    expect(server.viewer?.level).toBe('registered')
    old.release(json({ posts: [{ ...memberBody().state.posts[1]!, content: '合成成员正文' }] }))
    expect(await reading).toBe(false)
    expect(forum.postById('p10001')).toBeUndefined()
  })

  it('clears the forum projection when the real account refresh discovers a different login, before the new forum state answers', async () => {
    const next = held()
    fakeServer(json(memberBody()), json({ signed_in: true, login: 'new_account' }), next.answer)
    const { forum, server } = setup()
    await server.load()
    const account = accountMenu()
    server.keepRefusedReply({ topicId: 't1001', content: '不应跨账号保留' })
    await account.refresh()
    expect(account.account.value?.login).toBe('new_account')
    expectAnonymous(forum)
    expect(server.refusedReplies).toEqual([])
    next.release(json(guestBody()))
    await vi.waitFor(() => expect(server.status).toBe('ready'))
  })

  it.each([
    { label: 'another login', auth: { signed_in: true, login: 'new_account' }, next: memberBody() },
    { label: 'signed out', auth: { signed_in: false }, next: guestBody() },
  ])('invalidates the late old state when /auth/me changes identity during loading (%s)', async ({ auth, next }) => {
    const old = held()
    const fresh = held()
    const calls = fakeServer(old.answer, json(auth), fresh.answer)
    const { forum, server } = setup()
    const oldLoad = server.load()
    expect(server.status).toBe('loading')

    const account = accountMenu()
    await account.refresh()
    await vi.waitFor(() => expect(calls).toHaveLength(3))
    expect(server.projectionVersion).toBe(1)
    expect(server.status).toBe('loading')

    old.release(json(memberBody()))
    expect(await oldLoad).toBe(false)
    expect(forum.topicById('t1001')).toBeUndefined()
    expect(JSON.stringify(forum.state)).not.toContain('合成成员')

    fresh.release(json(next))
    await vi.waitFor(() => expect(server.status).toBe('ready'))
    expect(account.account.value?.login ?? null).toBe(auth.signed_in ? auth.login : null)
  })

  it('restarts the forum projection when the same account is revalidated during busy', async () => {
    vi.useFakeTimers()
    try {
      const fresh = held()
      const calls = fakeServer(json({ error: 'rate_limited' }, 429), json({ signed_in: true, login: 'ada' }), fresh.answer)
      const { server, forum } = setup()
      expect(await server.load()).toBe(false)
      expect(server.status).toBe('busy')
      const before = server.projectionVersion

      const account = accountMenu()
      await account.refresh()
      await vi.waitFor(() => expect(calls).toHaveLength(3))
      expect(server.projectionVersion).toBe(before + 1)
      expect(server.status).toBe('loading')
      expectAnonymous(forum)

      fresh.release(json(guestBody()))
      await vi.waitFor(() => expect(server.status).toBe('ready'))
      expect(server.viewer?.kind).toBe('guest')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('invalidates an old public write when /auth/me changes identity during busy', async () => {
    vi.useFakeTimers()
    try {
      const oldWrite = held()
      const fresh = held()
      const calls = fakeServer(
        json({ error: 'rate_limited' }, 429),
        oldWrite.answer,
        json({ signed_in: true, login: 'new_account' }),
        fresh.answer,
      )
      const { forum, server } = setup()
      expect(await server.load()).toBe(false)
      expect(server.status).toBe('busy')

      const writing = server.toggleBookmark('p10001')
      await vi.waitFor(() => expect(calls).toHaveLength(2))

      const account = accountMenu()
      await account.refresh()
      await vi.waitFor(() => expect(calls).toHaveLength(4))
      expect(server.projectionVersion).toBe(1)
      expect(server.status).toBe('loading')
      expectAnonymous(forum)

      oldWrite.release(json(writeBody({ posts: [memberBody().state.posts[1]!] }, MEMBER_VIEWER)))
      expect(await writing).toBeNull()
      expectAnonymous(forum)

      fresh.release(json(guestBody()))
      await vi.waitFor(() => expect(server.status).toBe('ready'))
      expect(account.account.value?.login).toBe('new_account')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('keeps same-account refused work while resetting the projection and invalidating an old optimistic failure', async () => {
    const write = held()
    const fresh = held()
    const calls = fakeServer(json(memberBody()), write.answer, json({ signed_in: true, login: 'ada' }), fresh.answer)
    const { forum, server } = setup()
    await server.load()
    server.keepRefusedReply({ topicId: 't1001', content: '保留的回复草稿' })

    const writing = server.toggleBookmark('p10001')
    expect(forum.isBookmarked('m1001', 'p10001')).toBe(false)

    const account = accountMenu()
    await account.refresh()
    await vi.waitFor(() => expect(calls).toHaveLength(4))
    expect(server.projectionVersion).toBe(1)
    expectAnonymous(forum)
    expect(server.refusedReplies).toEqual([{ topicId: 't1001', content: '保留的回复草稿' }])

    write.release(json({ error: 'forbidden', message: '旧投影已失效' }, 403))
    expect(await writing).toBeNull()
    expect(server.refusedReplies).toEqual([{ topicId: 't1001', content: '保留的回复草稿' }])

    fresh.release(json(memberBody()))
    await vi.waitFor(() => expect(server.status).toBe('ready'))
    expect(forum.isBookmarked('m1001', 'p10001')).toBe(true)
    expect(server.refusedReplies).toEqual([{ topicId: 't1001', content: '保留的回复草稿' }])
  })

  it('does not restore the signed-in header or member projection from an auth/me request that arrives after sign-out', async () => {
    const old = held()
    fakeServer(json(memberBody()), old.answer, json({ ok: true }), json(guestBody()))
    const { forum, server } = setup()
    await server.load()
    const account = accountMenu()
    const refreshing = account.refresh()
    await account.signOut()
    await vi.waitFor(() => expect(server.viewer?.kind).toBe('guest'))
    old.release(json({ signed_in: true, login: 'ada' }))
    await refreshing
    expect(account.account.value).toBeNull()
    expect(forum.topicById('t1001')).toBeUndefined()
  })

  it.each(['busy', 'offline'] as const)('discards the member projection when /state ends the session and the guest retry is %s', async (failure) => {
    vi.useFakeTimers()
    fakeServer(json(memberBody()), json({ error: 'session_expired' }, 401), failure === 'busy'
      ? json({ error: 'rate_limited' }, 429)
      : () => { throw new TypeError('offline') })
    const { forum, session, server } = setup()
    await server.load()
    expect(await server.load()).toBe(false)
    expectAnonymous(forum)
    expect(session.currentUserId).toBeNull()
    expect(server.signinLapse.ended).toBe(true)
    expect(server.status).toBe(failure === 'busy' ? 'busy' : 'error')
  })

  it('keeps the current readable projection on an ordinary same-identity 429', async () => {
    vi.useFakeTimers()
    fakeServer(json(memberBody()), json({ error: 'rate_limited' }, 429))
    const { forum, server } = setup()
    await server.load()
    const before = forum.state
    expect(await server.load()).toBe(false)
    expect(forum.state).toBe(before)
    expect(server.viewer?.userId).toBe('m1001')
    expect(server.status).toBe('ready')
  })

  it('clears already rendered member search results on sign-out and repeats the unchanged query only after the new projection is ready', async () => {
    const guest = held()
    const calls = fakeServer(json(memberBody()), json({ results: { topics: [memberBody().state.topics[1]!], posts: [], users: [] } }),
      json({ ok: true }), guest.answer, json({ results: { topics: [], posts: [], users: [] } }))
    const { server } = setup()
    await server.load()
    const page = mountSearch()
    try {
      await vi.waitFor(() => expect(textOf(page.root)).toContain('合成成员话题'))
      await accountMenu().signOut()
      await nextTick()
      expect(textOf(page.root)).not.toContain('合成成员')
      expect(calls.filter(call => call.url.startsWith('/api/forum/search'))).toHaveLength(1)
      guest.release(json(guestBody()))
      await vi.waitFor(() => expect(calls.filter(call => call.url.startsWith('/api/forum/search'))).toHaveLength(2))
      await vi.waitFor(() => expect(textOf(page.root)).toContain('没有找到和「合成」有关的内容'))
    }
    finally {
      page.unmount()
    }
  })

  it('does not restore a removed topic from a body answer older than an authoritative state with the same viewer', async () => {
    const old = held()
    const restricted = guestBody()
    restricted.state.viewer = MEMBER_VIEWER
    fakeServer(json(memberBody()), old.answer, json(restricted))
    const { forum, server } = setup()
    await server.load()
    const reading = server.loadTopic('t1001')
    expect(await server.load()).toBe(true)
    old.release(json({ posts: [{ ...memberBody().state.posts[1]!, content: '合成成员正文' }] }))
    expect(await reading).toBe(false)
    expect(forum.postById('p10001')).toBeUndefined()
    for (const post of forum.state.posts)
      expect(forum.topicById(post.topicId)).toBeDefined()
  })
})
