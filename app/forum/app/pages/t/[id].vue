<script setup lang="ts">
import type { BreadcrumbItem } from '@talex-touch/tuffex/breadcrumb'
import type { Post, Visibility } from '~/data/types'
import type { TopicAbsence } from '~/stores/forum-server'
import { toast } from '@talex-touch/tuffex/utils'
import { topicMarkdownPath } from '../../../shared/forum-markdown'

// Discourse's /t/<slug>/<id>: the post stream with its right-hand timeline,
// the topic control bar, the bottom composer and the suggested topics.
definePageMeta({
  // Re-run setup when the id changes; the query string must not remount.
  key: route => route.path,
})

/** How long a jumped-to or freshly posted card keeps its highlight. */
const FLASH_MS = 1200
const BREADCRUMB_TITLE_LENGTH = 24

const route = useRoute()
const router = useRouter()
const forum = useForumStore()
const server = useForumServerStore()
const actions = useForumActions()
const { can } = useCurrentUser()
const { isDesktop, loginOpen } = useShell()
const { isSnapshot, serverMode } = useContentSource()

const topicId = String(route.params.id)
// Read through the store rather than capturing the object: `重置示例数据`
// replaces the whole state, and a captured entity would keep rendering (and
// answering `can()`) from a tree nothing writes to any more.
const topic = computed(() => forum.topicById(topicId) ?? (/^\d+$/.test(topicId) ? forum.topicById(`t${topicId}`) : undefined))

// The 话题管理 menu lists only what the viewer may do. Pinning and closing are
// separate forum capabilities (a 项目部 head may pin but not close), so each
// item asks can() on its own and the menu shows when either one holds.
const canPin = computed(() => topic.value !== undefined && can('pinTopic', { topic: topic.value }))
const canClose = computed(() => topic.value !== undefined && can('closeTopic', { topic: topic.value }))
const canSetVisibility = computed(() => topic.value !== undefined && can('setVisibility', { topic: topic.value }))

/** 话题上的可见范围标记（#276）：公开的不标。 */
const VISIBILITY_BADGE: Record<Exclude<Visibility, 'public'>, string> = { registered: '注册用户可见', member: '成员可见' }
const visibilityBadge = computed(() => {
  const level = topic.value?.visibility ?? 'public'
  return level === 'public' ? null : VISIBILITY_BADGE[level]
})

/**
 * A topic the state does not hold (#276): against the server it may exist
 * but be hidden from this viewer, so the page asks before saying 404. The
 * answer says only which identity would see it, never the title.
 */
const absence = ref<TopicAbsence | null>(null)

// Raised rather than thrown: a `throw` in setup still renders the template once
// with every binding undefined, which logs a handful of Vue warnings on the way
// to the error page. `showError` lets setup finish and the root `v-if` keeps
// the template from rendering anything at all.
function notFound() {
  showError(createError({
    statusCode: 404,
    // h3 warns when `statusMessage` carries prose ("prefer `message`"), and that
    // warning is a console error by AC3's standards; the Chinese copy lives in
    // `message`, which is what error.vue renders anyway.
    statusMessage: 'Not Found',
    message: '这个话题不存在，它可能已被删除。',
    fatal: true,
  }))
}

if (!topic.value) {
  if (serverMode && import.meta.client) {
    absence.value = 'unknown'
    void server.probeTopic(/^\d+$/.test(topicId) ? `t${topicId}` : topicId).then((found) => {
      absence.value = found
      if (found === 'missing' || (found === 'unknown' && !topic.value))
        notFound()
    })
  }
  else {
    notFound()
  }
}

useHead({ title: () => topic.value?.title ?? '话题' })

// The Markdown twin for AI readers (server/middleware/forum-markdown.ts). Only
// advertised where a file exists: every topic of the dev server's snapshot,
// otherwise the topics the static build wrote (`markdownTopicIds` from
// nuxt.config.ts: the seed topics, none for 极客班论坛 yet). A topic started
// in this browser lives in localStorage alone and has none. The list comes
// from the runtime config rather than the seed module, so a 极客班论坛 build
// does not bundle the demo topics for this check.
const { app: { baseURL }, public: { markdownTopicIds } } = useRuntimeConfig()
const markdownHref = computed(() => (topic.value && (isSnapshot || markdownTopicIds.includes(topic.value.id))
  ? `${baseURL}${topicMarkdownPath(topic.value.id)}`
  : undefined))
useHead({
  link: () => (markdownHref.value ? [{ rel: 'alternate', type: 'text/markdown', href: markdownHref.value }] : []),
})

const posts = computed<Post[]>(() => (topic.value ? forum.postsOfTopic(topic.value.id) : []))
/**
 * Whether this topic's bodies are still on their way (#156). The topic page
 * asks for them on mounting; while the answer is out the cards show the
 * server's one-line excerpt rather than an empty body, and a failed read says
 * so instead of looking like a deleted post.
 */
const bodiesPending = ref(false)
const category = computed(() => (topic.value ? forum.categoryById(topic.value.categoryId) : undefined))
const tags = computed(() => (topic.value ? topic.value.tagIds.map(id => forum.tagById(id)).filter(tag => tag !== undefined) : []))

const composerOpen = ref(false)
const replyTo = ref<Post | undefined>()
/** Set when the composer opens from 「引用」: the drawer inserts that post's quote (#276). */
const quoteFrom = ref<Post | undefined>()
const flashPostId = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined

const breadcrumb = computed<BreadcrumbItem[]>(() => [
  { label: '话题' },
  { label: category.value?.name ?? '' },
  { label: truncate(topic.value?.title ?? '', BREADCRUMB_TITLE_LENGTH) },
])

function onBreadcrumb(_item: BreadcrumbItem, index: number) {
  if (index === 0)
    void router.push('/')
  else if (index === 1 && category.value)
    void router.push(`/c/${category.value.slug}`)
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

/** Scrolls a post into view and highlights it, for both backlinks and new replies. */
function focusPost(postId: string) {
  const element = document.getElementById(`post-${postId}`)
  if (!element)
    return
  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  flashPostId.value = postId
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    if (flashPostId.value === postId)
      flashPostId.value = null
  }, FLASH_MS)
}

function openComposer(post?: Post, quote = false) {
  if (!topic.value || !can('reply', { topic: topic.value }))
    return
  replyTo.value = post
  quoteFrom.value = quote ? post : undefined
  composerOpen.value = true
}

/** Only stricter than the category is allowed; the server says so when a choice is not (`visibility_too_open`). */
async function setVisibility(visibility: Visibility | null) {
  const current = topic.value
  if (!current || !canSetVisibility.value)
    return
  if (await actions.setVisibility(current.id, visibility))
    toast({ id: `forum-visibility:${current.id}`, title: '可见范围已更新', variant: 'success' })
}

// Called twice against the server: once for the reply shown while it is sent,
// once for the post the server made of it. A refused reply reopens the
// composer and sets `replyTo` back to the post it answered (#145).
async function onSubmitted(postId: string) {
  await nextTick()
  focusPost(postId)
}

// The topic changes before the call returns (#145); a refusal puts it back
// with its own toast. The success toast waits for the server (#162) and
// names what it settled on, which after quick clicks may be where it began.
async function togglePinned() {
  const current = topic.value
  if (!current || !can('pinTopic', { topic: current }))
    return
  if (await actions.setPinned(current.id, !current.pinned))
    toast({ id: `forum-pinned:${current.id}`, title: (forum.topicById(current.id) ?? current).pinned ? '话题已置顶' : '已取消置顶', variant: 'success' })
}

async function toggleClosed() {
  const current = topic.value
  if (!current || !can('closeTopic', { topic: current }))
    return
  if (await actions.setClosed(current.id, !current.closed))
    toast({ id: `forum-closed:${current.id}`, title: (forum.topicById(current.id) ?? current).closed ? '话题已关闭' : '话题已重新开放', variant: 'success' })
}

// One view per topic per browser session, so re-reading a thread in the same
// tab does not inflate its count. The bodies arrive with the same mount: the
// state the page starts from holds summaries, not content (#156).
onMounted(() => {
  const current = topic.value
  if (!current)
    return
  // The bodies are not in the state the page starts from (#156): ask for this
  // topic's posts, and keep saying 正在读取正文… until the answer lands.
  bodiesPending.value = true
  void server.loadTopic(current.id).finally(() => {
    bodiesPending.value = false
  })
  const key = `tuff-forum:viewed:${current.id}`
  try {
    if (sessionStorage.getItem(key))
      return
    sessionStorage.setItem(key, '1')
  }
  catch {
    // Storage disabled: count the view anyway rather than losing it.
  }
  actions.recordView(current.id)
})

onBeforeUnmount(() => clearTimeout(flashTimer))
</script>

<template>
  <TxStack v-if="topic" :gap="16">
    <!-- No `href`: TxBreadcrumb renders a real <a>, which would reload the SPA. -->
    <TxBreadcrumb :items="breadcrumb" @click="onBreadcrumb" />

    <TxStack :gap="8">
      <TxFlex align="center" :gap="8" wrap="wrap">
        <h1 class="inline-flex items-center gap-2 text-2xl font-semibold">
          <i v-if="topic.closed" class="i-carbon-locked" aria-hidden="true" />
          <span>{{ topic.title }}</span>
        </h1>

        <TxDropdownMenu v-if="canPin || canClose || canSetVisibility" placement="bottom-end" reference-class="ml-auto" panel-background="pure">
          <template #trigger>
            <TxIconButton icon="i-carbon-overflow-menu-horizontal" label="话题管理" />
          </template>
          <TxDropdownItem v-if="canPin" @select="togglePinned">
            {{ topic.pinned ? '取消置顶' : '置顶话题' }}
          </TxDropdownItem>
          <TxDropdownItem v-if="canClose" @select="toggleClosed">
            {{ topic.closed ? '重新开放' : '关闭话题' }}
          </TxDropdownItem>
          <template v-if="canSetVisibility">
            <TxDropdownItem @select="setVisibility('registered')">
              只给注册用户看
            </TxDropdownItem>
            <TxDropdownItem @select="setVisibility('member')">
              只给成员看
            </TxDropdownItem>
            <TxDropdownItem @select="setVisibility(null)">
              跟随分类的可见范围
            </TxDropdownItem>
          </template>
        </TxDropdownMenu>
      </TxFlex>

      <TxFlex align="center" :gap="6" wrap="wrap">
        <CategoryTag :category="category" clickable />
        <TxTag v-for="tag in tags" :key="tag.id" :label="tag.name" variant="plain" size="sm" />
        <TxStatusBadge v-if="topic.pinned" text="已置顶" icon="i-carbon-pin" status="muted" size="sm" />
        <TxStatusBadge v-if="topic.closed" text="已关闭" icon="i-carbon-locked" status="muted" size="sm" />
        <TxStatusBadge v-if="visibilityBadge" :text="visibilityBadge" icon="i-carbon-view" status="muted" size="sm" />
      </TxFlex>
    </TxStack>

    <TxRow :gutter="24">
      <TxCol :span="24" :lg="17">
        <TxStack :gap="16">
          <TxStack :gap="12">
            <PostCard
              v-for="(post, index) in posts"
              :key="post.id"
              :post="post"
              :topic="topic"
              :floor="index + 1"
              :flash="flashPostId === post.id"
              :bodies-pending="bodiesPending"
              @reply="openComposer"
              @quote="openComposer($event, true)"
              @jump="focusPost"
            />
          </TxStack>

          <TopicControls :topic="topic" @reply="openComposer()" />

          <SuggestedTopics :topic-id="topic.id" />
        </TxStack>
      </TxCol>

      <TxCol v-if="isDesktop" :lg="7">
        <div class="sticky top-20">
          <TopicTimeline :topic="topic" />
        </div>
      </TxCol>
    </TxRow>

    <ReplyComposer
      v-model:visible="composerOpen"
      v-model:reply-to="replyTo"
      :topic="topic"
      :quote-from="quoteFrom"
      @submitted="onSubmitted"
    />
  </TxStack>

  <TxCard v-else-if="absence === 'need-registered' || absence === 'need-member'" variant="plain" :padding="24" data-topic-hidden>
    <!-- A hidden topic (#276): which identity would see it, and nothing of what it says. -->
    <TxStack :gap="12" align="start">
      <h1 class="text-xl font-semibold">
        {{ absence === 'need-member' ? '成员可看' : '登录后可看' }}
      </h1>
      <p class="text-$tx-text-color-secondary">
        {{ absence === 'need-member'
          ? '这个话题只给极客班成员看。在桌面右上角的账号资料里填邀请码，成为成员后就能打开。'
          : '这个话题只给注册用户看，登录后就能打开。' }}
      </p>
      <TxFlex :gap="8">
        <TxButton v-if="absence === 'need-registered'" variant="primary" @click="loginOpen = true">
          登录
        </TxButton>
        <TxButton variant="secondary" @click="router.push('/')">
          回到话题列表
        </TxButton>
      </TxFlex>
    </TxStack>
  </TxCard>
</template>
