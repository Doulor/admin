<script setup lang="ts">
import type { CrepeEditor, MentionQuery } from '~/editor/crepe-editor'
import type { Sticker, SuggestedUser } from '../../shared/forum-api'
import { toast } from '@talex-touch/tuffex/utils'
import { ForumApiError } from '../../shared/forum-api'
import { imagesToStickers, stickersToImages } from '../../shared/post-markdown'

/**
 * Where a post body is written: new topics, replies (quotes included) and
 * edits (#276: what you see while writing is what the post will look like).
 *
 * The editor is Milkdown Crepe, imported only when this component mounts
 * (app/editor/crepe-editor.ts), so the first screen does not carry it. Until
 * it is ready, and for good if it fails to load, a plain textarea holds the
 * same Markdown; whatever was typed there carries over.
 *
 * The text stays Markdown in and out, with stickers as `:shortcode:` (the
 * editor shows them as pictures; `stickersToImages` / `imagesToStickers`
 * translate). Raw HTML in the text never becomes markup on the page:
 * posts render through ForumMarkdown → shared/post-markdown.ts → DOMPurify.
 *
 * - Pasted or dropped images upload to the forum and go in as pictures.
 * - 表情 (the button, or 「表情」 in the `/` menu) inserts a sticker.
 * - `@` and a few letters lists matching accounts; ↑ ↓ Enter pick one.
 * - ⌘ or Ctrl + Enter emits `submit`; the caller decides whether to send.
 *
 * A caller that keeps it mounted between uses gives it a new `key` per use,
 * as the reply drawer does on every open, so each use starts clean (#144).
 */
const props = withDefaults(defineProps<{
  placeholder?: string
  /** What screen readers call the text field, e.g. 「回复内容」. */
  label: string
  /** In px; the three heights the forum uses map to static classes below. */
  minHeight?: 200 | 240 | 320
}>(), { placeholder: '', minHeight: 240 })

const emit = defineEmits<{
  submit: []
}>()

const content = defineModel<string>({ required: true })

const server = useForumServerStore()
const { serverMode } = useContentSource()
const { available: stickersAvailable, index } = useStickers()
const { report } = useActivityBeacon()

const canSticker = computed(() => stickersAvailable && server.granted.has('forum.sticker.use'))
const canUpload = computed(() => serverMode && server.granted.has('forum.upload.image'))

// Spelled out so UnoCSS finds the classes (app/ has no inline styles). The
// editor's own heights live with its padding in uno.config.ts.
const HEIGHT_CLASS = {
  200: { field: '!min-h-50', editor: 'forum-editor-200' },
  240: { field: '!min-h-60', editor: 'forum-editor-240' },
  320: { field: '!min-h-80', editor: 'forum-editor-320' },
} as const
const height = computed(() => HEIGHT_CLASS[props.minHeight])

const host = ref<HTMLElement | null>(null)
const ready = ref(false)
const failed = ref(false)
const stickerOpen = ref(false)
let editor: CrepeEditor | null = null
/** The Markdown this component last emitted, so its own update does not bounce back into the editor. */
let lastEmitted = content.value
let disposed = false

const mention = reactive<{ range: MentionQuery | null, users: SuggestedUser[], active: number }>({ range: null, users: [], active: 0 })
const mentionOpen = computed(() => !!mention.range && mention.users.length > 0)
let mentionTimer: ReturnType<typeof setTimeout> | undefined
let mentionAsked = ''

function closeMention() {
  clearTimeout(mentionTimer)
  mention.range = null
  mention.users = []
  mention.active = 0
}

function onMention(range: MentionQuery | null) {
  if (!range || !range.query || !serverMode) {
    closeMention()
    return
  }
  mention.range = range
  if (range.query === mentionAsked)
    return
  clearTimeout(mentionTimer)
  // Typing is the debounce: ask once the letters stop for a moment (30 a minute is the server's limit).
  mentionTimer = setTimeout(async () => {
    mentionAsked = range.query
    const users = await server.suggestUsers(range.query)
    if (mention.range?.query !== range.query)
      return
    mention.users = users
    mention.active = 0
  }, 250)
}

function completeMention(user: SuggestedUser) {
  const range = mention.range
  if (!range || !editor)
    return
  editor.completeMention(range, user.username)
  mentionAsked = ''
  closeMention()
}

function onMentionKey(key: string): boolean {
  if (!mentionOpen.value)
    return false
  if (key === 'Escape') {
    closeMention()
    return true
  }
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const step = key === 'ArrowDown' ? 1 : -1
    mention.active = (mention.active + step + mention.users.length) % mention.users.length
    return true
  }
  const user = mention.users[mention.active]
  if (key === 'Enter' && user) {
    completeMention(user)
    return true
  }
  return false
}

async function upload(file: File): Promise<string> {
  if (!canUpload.value) {
    toast({ title: '图片没有传上去', description: '现在不能上传图片，可以贴图片地址。', variant: 'warning' })
    throw new Error('upload unavailable')
  }
  try {
    return await server.uploadImage(file)
  }
  catch (error) {
    toast({ title: '图片没有传上去', description: error instanceof ForumApiError ? error.message : '请稍后再试。', variant: 'warning' })
    throw error
  }
}

function insertSticker(sticker: Sticker) {
  // #274：只记表情的编号（公开的素材标识，不是帖子正文），用了哪个表情、用了几次。
  report('forum.sticker.use', { target_type: 'sticker', target_id: sticker.shortcode })
  if (editor) {
    editor.insert(`![${sticker.label}](${sticker.url})`)
    return
  }
  const text = content.value
  content.value = `${text}${text && !/\s$/.test(text) ? ' ' : ''}:${sticker.shortcode}: `
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {
    event.preventDefault()
    event.stopPropagation()
    emit('submit')
  }
}

onMounted(async () => {
  try {
    const { createCrepeEditor } = await import('~/editor/crepe-editor')
    if (disposed || !host.value)
      return
    const initial = content.value
    lastEmitted = initial
    const created = await createCrepeEditor({
      root: host.value,
      value: stickersToImages(initial, index.value),
      placeholder: props.placeholder || '写点什么，输入 / 打开菜单',
      onChange: (markdown) => {
        const text = imagesToStickers(markdown, index.value)
        if (text === lastEmitted)
          return
        lastEmitted = text
        content.value = text
      },
      onUpload: upload,
      onStickerMenu: canSticker.value ? () => { stickerOpen.value = true } : null,
      onMention,
      onMentionKey,
    })
    if (disposed) {
      void created.destroy()
      return
    }
    editor = created
    ready.value = true
    // Typed into the textarea, or put back as a draft, while the editor was starting.
    if (content.value !== initial) {
      lastEmitted = content.value
      created.setMarkdown(stickersToImages(content.value, index.value))
    }
  }
  catch {
    failed.value = true
  }
})

// Text set from outside (a quote, a draft put back, cleared after sending) goes into the editor.
watch(content, (value) => {
  if (!editor || value === lastEmitted)
    return
  lastEmitted = value
  editor.setMarkdown(stickersToImages(value, index.value))
})

onBeforeUnmount(() => {
  disposed = true
  clearTimeout(mentionTimer)
  void editor?.destroy()
  editor = null
})
</script>

<template>
  <div class="@container w-full flex flex-col gap-2" data-post-editor @keydown.capture="onKeydown">
    <div
      v-show="ready"
      ref="host"
      class="forum-editor overflow-hidden rounded-xl border border-$tx-border-color"
      :class="height.editor"
      role="group"
      :aria-label="label"
      data-crepe-host
    />
    <TxTextarea
      v-if="!ready"
      v-model="content"
      class="h-full"
      :class="height.field"
      :placeholder="placeholder"
      :aria-label="label"
    />

    <TxCard v-if="mentionOpen" variant="plain" :padding="6" data-mention-list>
      <TxFlex direction="column" :gap="2" role="listbox" aria-label="提到的人">
        <TxButton
          v-for="(user, at) in mention.users"
          :key="user.username"
          variant="bare"
          size="sm"
          class="!justify-start"
          :class="at === mention.active ? 'bg-$tx-fill-color' : ''"
          role="option"
          :aria-selected="at === mention.active ? 'true' : 'false'"
          @mousedown.prevent="completeMention(user)"
        >
          <span class="font-medium">{{ user.displayName }}</span>
          <span class="ml-2 text-$tx-text-color-secondary">@{{ user.username }}</span>
        </TxButton>
      </TxFlex>
    </TxCard>

    <TxFlex align="center" justify="space-between" wrap="wrap" :gap="8">
      <TxFlex align="center" :gap="4" wrap="wrap">
        <StickerPicker v-if="canSticker" v-model:open="stickerOpen" @pick="insertSticker" />
        <span v-if="failed" class="text-xs text-$tx-text-color-secondary">
          编辑器没有加载出来，先用纯文本写，支持 Markdown。
        </span>
      </TxFlex>
      <span class="text-xs text-$tx-text-color-secondary">
        {{ ready ? '输入 / 打开菜单，' : '' }}⌘ 或 Ctrl + Enter 发送
      </span>
    </TxFlex>
  </div>
</template>
