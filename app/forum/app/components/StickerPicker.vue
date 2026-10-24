<script setup lang="ts">
import type { Sticker } from '../../shared/forum-api'

/**
 * The sticker panel (#276): a button that opens the enabled packs as a grid.
 * The composer uses it to insert a sticker into the text, PostCard to react
 * with one. Clicking a sticker emits it and closes the panel; the panel reads
 * the packs on first open, so a page nobody writes on never asks for them.
 *
 * `open` is a model so the editor's slash menu (「表情」) can open the same
 * panel from inside the text.
 */
const props = withDefaults(defineProps<{
  /** The button's words; also its accessible name. */
  label?: string
  icon?: string
  size?: 'sm' | 'md'
  /** Stickers already used by the viewer (reactions), drawn as pressed. */
  selected?: string[]
}>(), { label: '表情', icon: 'i-ri-emotion-happy-line', size: 'sm', selected: () => [] })

const emit = defineEmits<{
  pick: [sticker: Sticker]
}>()

const open = defineModel<boolean>('open', { default: false })
const { packs, load } = useStickers()

watch(open, (value) => {
  if (value)
    load()
}, { immediate: true })

function pick(sticker: Sticker) {
  open.value = false
  emit('pick', sticker)
}

const chosen = computed(() => new Set(props.selected))
</script>

<template>
  <TxPopover v-model="open" placement="top-start" :width="336" :max-height="320" :show-arrow="false" panel-background="pure">
    <template #reference>
      <TxButton variant="bare" :size="size" :icon="icon" :aria-expanded="open">
        {{ label }}
      </TxButton>
    </template>

    <div class="flex flex-col gap-3 p-1" data-sticker-panel>
      <p v-if="!packs.length" class="text-sm text-$tx-text-color-secondary">
        正在读取表情…
      </p>
      <section v-for="pack in packs" :key="pack.id" class="flex flex-col gap-2" :aria-label="pack.name">
        <span class="text-xs text-$tx-text-color-secondary">{{ pack.name }}</span>
        <div class="grid grid-cols-6 gap-1">
          <TxButton
            v-for="sticker in pack.stickers"
            :key="sticker.id"
            variant="bare"
            class="!h-auto !p-1 aspect-square"
            :class="chosen.has(sticker.id) ? 'ring-1 ring-$tx-color-primary' : ''"
            :title="sticker.label"
            :aria-label="sticker.label"
            :aria-pressed="chosen.has(sticker.id) ? 'true' : undefined"
            @click="pick(sticker)"
          >
            <img :src="sticker.url" :alt="sticker.label" class="block h-12 w-12 object-contain" loading="lazy" decoding="async">
          </TxButton>
        </div>
      </section>
    </div>
  </TxPopover>
</template>
