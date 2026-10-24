<script setup lang="ts">
import { renderableMarkdown, WORD_JOINER } from '../../shared/post-markdown'

// A post body as others see it. Anyone with an account can write one, so the
// text goes through `renderableMarkdown` first: raw HTML shows as text and
// links only go to http(s), mailto or the site itself (shared/post-markdown.ts).
// Sticker shortcodes on the server's list become pictures there too (#276);
// the list is read the first time a body has something that looks like one.
// TxMarkdownView then sanitizes with DOMPurify as a second layer.
//
// The HTML escape is an invisible word joiner after `<`; copying code out of a
// post must not carry it into someone's compiler, so the copy handler drops it.
const props = defineProps<{ content: string }>()

const { index: stickers, load: loadStickers } = useStickers()

const safe = computed(() => renderableMarkdown(props.content, stickers.value))

onMounted(() => {
  if (/:[a-z0-9][a-z0-9-]{1,39}:/.test(props.content))
    loadStickers()
})

function onCopy(event: ClipboardEvent) {
  const text = window.getSelection()?.toString() ?? ''
  if (!text.includes(WORD_JOINER) || !event.clipboardData)
    return
  event.preventDefault()
  event.clipboardData.setData('text/plain', text.replaceAll(WORD_JOINER, ''))
}
</script>

<template>
  <div class="overflow-x-auto max-w-full" @copy="onCopy">
    <TxMarkdownView :content="safe" />
  </div>
</template>
