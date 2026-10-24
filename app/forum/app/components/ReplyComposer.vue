<script setup lang="ts">
import type { Post, Topic } from '~/data/types'
import { nextZIndex, toast, toastStore } from '@talex-touch/tuffex/utils'
import { MEMBER_CONTENT_MAX } from '../../shared/forum-api'
import { quoteDraft } from '../../shared/post-markdown'

/**
 * Discourse's composer: a panel that slides up from the bottom of the topic
 * instead of a separate page, so the thread stays readable behind it.
 *
 * Opening it with a `replyTo` post turns the new post into a reply with a
 * backlink; opening it from 引用 (`quoteFrom`) also inserts
 * `> @username：<first 80 characters>` after whatever the draft holds (#276).
 * Someone else's text goes into PostEditor as written: posts render through
 * ForumMarkdown, so raw HTML in it shows as text, as it does on the page.
 *
 * The draft is saved in this browser every 2 seconds (`usePostDraft`, key
 * `forum:draft:<topicId>`), put back when the drawer next opens empty, and
 * cleared once the server took the reply. ⌘ or Ctrl + Enter sends.
 * Guest replies are gone (#276): the drawer only opens for an account the
 * server lets reply.
 *
 * Against the forum server the drawer closes as soon as a reply is sent
 * (#145). A reply the server refuses comes back into the drawer with the post
 * it answered, in front of whatever the drawer holds by then, so nothing
 * typed is lost: not when another reply was started meanwhile, not when two
 * were refused, not when the page was left before the refusal arrived.
 */
const props = defineProps<{
  visible: boolean
  topic: Topic
  /** Reply target; absent means a reply to the topic itself. */
  replyTo?: Post
  /** Set when opened from 引用: this post's first line goes into the draft as a quote. */
  quoteFrom?: Post
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  /** A refused reply goes back to the post it answered (`undefined`: the topic). */
  'update:replyTo': [post: Post | undefined]
  'submitted': [postId: string]
}>()

const forum = useForumStore()
const server = useForumServerStore()
const actions = useForumActions()
const { serverMode } = useContentSource()
const { user, can } = useCurrentUser()

const content = ref('')
/** The draft as it will be sent. */
const text = computed(() => content.value.trim())
const submitting = ref(false)
const draft = usePostDraft(() => props.topic.id, content)

const contentMax = computed(() => (serverMode ? MEMBER_CONTENT_MAX : Number.POSITIVE_INFINITY))
const tooLong = computed(() => text.value.length > contentMax.value)
const canSend = computed(() => !!text.value && !tooLong.value)

const replyToUser = computed(() => (props.replyTo ? forum.userById(props.replyTo.authorId) : undefined))
const replyToFloor = computed(() => {
  if (!props.replyTo)
    return 0
  return forum.postsOfTopic(props.topic.id).findIndex(post => post.id === props.replyTo?.id) + 1
})

const title = computed(() => (replyToUser.value
  ? `回复 @${replyToUser.value.username} 的 #${replyToFloor.value}`
  : `回复：${props.topic.title}`))

// TxDrawer keeps its content mounted while closed, PostEditor included, so a
// new key per open is what gives every reply a fresh editor (#144). The draft
// lives in `content`, not in the editor, so it survives the new editor.
const editorKey = ref(0)

// At the bottom right a toast would lie over this drawer's 取消 and 回复, so
// while it is open app.vue shows toasts at the top (#162).
const { composerOpen } = useShell()
watch(() => props.visible, (visible) => {
  composerOpen.value = visible
}, { immediate: true })
onBeforeUnmount(() => {
  composerOpen.value = false
})

// On open: an empty drawer takes back the draft this browser kept, and 引用
// adds its quote after whatever is there. Reopening without 引用 adds nothing,
// so a draft the author is still writing never gets a second quote.
watch(() => props.visible, (visible) => {
  if (!visible)
    return
  submitting.value = false
  editorKey.value += 1
  if (!content.value.trim())
    content.value = draft.read()
  if (props.quoteFrom) {
    const author = forum.userById(props.quoteFrom.authorId)
    const quote = quoteDraft(props.quoteFrom, author?.username)
    content.value = content.value.trim() ? `${content.value.trimEnd()}\n\n${quote}` : quote
  }
})

function close() {
  emit('update:visible', false)
}

/**
 * Puts this topic's refused replies back (stores/forum-server.ts keeps them):
 * each one in front of what the drawer holds, a blank line between, and the
 * drawer answers the post the last of them answered.
 *
 * The toast saying why came first and took a z-index; the drawer takes the
 * next one as it opens and its mask would cover the toast (#162). Once the
 * drawer has opened, the toasts take another one and are on top again.
 */
function takeBackRefused() {
  const refused = server.takeRefusedReplies(props.topic.id)
  const last = refused.at(-1)
  if (!last)
    return
  let draft = content.value.trim() ? content.value : ''
  for (const reply of refused)
    draft = draft ? `${reply.content}\n\n${draft}` : reply.content
  content.value = draft
  emit('update:replyTo', last.replyToPostId ? forum.postById(last.replyToPostId) : undefined)
  emit('update:visible', true)
  void nextTick(() => {
    toastStore.zIndex = nextZIndex()
  })
}

onMounted(takeBackRefused)
watch(() => server.refusedReplies.length, takeBackRefused)

/**
 * The reply is on the page as soon as this is called (against the server under
 * a `pending:` id, see stores/forum-server.ts), so the panel closes at once and
 * the page is told where it is. 回复已发布 waits for the server; if it refuses,
 * its toast says why and the text goes to the server store with its target,
 * from where `takeBackRefused` puts it back.
 */
async function submit() {
  const current = user.value
  const body = text.value
  if (!canSend.value || submitting.value)
    return
  const topicId = props.topic.id
  const replyToPostId = props.replyTo?.id
  let shownId: string | null = null
  const shown = (postId: string) => {
    shownId = postId
    emit('submitted', postId)
  }
  if (!current || !can('reply', { topic: props.topic }))
    return
  const sending = actions.createPost({ topicId: props.topic.id, authorId: current.id, content: body, ...(replyToPostId ? { replyToPostId } : {}) }, shown)
  submitting.value = true
  content.value = ''
  emit('update:visible', false)
  try {
    const postId = await sending
    if (!postId) {
      server.keepRefusedReply({ topicId, content: body, ...(replyToPostId ? { replyToPostId } : {}) })
      return
    }
    draft.clear()
    toast({ title: '回复已发布', variant: 'success' })
    if (postId !== shownId)
      emit('submitted', postId)
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <TxDrawer
    :visible="visible"
    direction="bottom"
    :size="500"
    :close-on-click-mask="false"
    :title="title"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <TxFlex align="center" :gap="8">
        <i class="i-carbon-reply" aria-hidden="true" />
        <span class="font-medium">{{ title }}</span>
      </TxFlex>
    </template>

    <TxStack :gap="12">
      <PostEditor
        :key="editorKey"
        v-model="content"
        :min-height="240"
        placeholder="写下你的回复，输入 / 打开菜单，@ 可以提到人"
        label="回复内容"
        @submit="submit"
      />

      <p v-if="tooLong" class="text-sm text-$tx-color-danger">
        正文超过了 {{ contentMax }} 字，删减一些再发。
      </p>
    </TxStack>

    <template #footer>
      <TxFlex justify="flex-end" :gap="8">
        <TxButton variant="secondary" @click="close">
          取消
        </TxButton>
        <TxButton
          variant="primary"
          :loading="submitting"
          :disabled="!canSend"
          @click="submit"
        >
          回复
        </TxButton>
      </TxFlex>
    </template>
  </TxDrawer>
</template>
