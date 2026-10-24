<script setup lang="ts">
import type { Sticker } from '../../shared/forum-api'

/**
 * The sticker panel (#276): a button that opens the enabled packs. The
 * composer uses it to insert a sticker into the text, PostCard to react with
 * one. Clicking a sticker emits it and closes the panel; the panel reads the
 * packs on first open, so a page nobody writes on never asks for them.
 *
 * Laid out like Bilibili's (the owner on 2026-10-24: 「表情包的表现可以学习b站的表现，
 * 因为我看了这些表情包我不知道都是代表什么，太糊了，看不清」): one pack at a time, its
 * name on top, a grid of big pictures with each sticker's name under it, and a
 * row of tabs at the bottom, one per pack with its first sticker as the cover.
 * 最近 (a clock tab in front of the packs) appears once this browser has used
 * a sticker: the last 8, newest first, kept under `forum:stickers:recent` (shortcodes only; one an admin
 * has disabled since drops out).
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

const RECENT_KEY = 'forum:stickers:recent'
const RECENT_MAX = 8

const open = defineModel<boolean>('open', { default: false })
const { packs, load } = useStickers()
const recentCodes = ref<string[]>([])

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((code): code is string => typeof code === 'string').slice(0, RECENT_MAX) : []
  }
  catch {
    return []
  }
}

function remember(sticker: Sticker) {
  recentCodes.value = [sticker.shortcode, ...recentCodes.value.filter(code => code !== sticker.shortcode)].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentCodes.value))
  }
  catch {
    // Private mode or a full quota: the panel still works without 最近.
  }
}

const byCode = computed(() => new Map(packs.value.flatMap(pack => pack.stickers.map(sticker => [sticker.shortcode, sticker] as const))))
const recent = computed(() => recentCodes.value.map(code => byCode.value.get(code)).filter((sticker): sticker is Sticker => !!sticker))

interface Tab { id: string, name: string, cover?: string, stickers: Sticker[] }
const tabs = computed<Tab[]>(() => [
  ...(recent.value.length ? [{ id: 'recent', name: '最近使用', stickers: recent.value }] : []),
  ...packs.value.filter(pack => pack.stickers.length).map(pack => ({ id: pack.id, name: pack.name, cover: pack.stickers[0]?.url, stickers: pack.stickers })),
])
const activeId = ref('')
// Opens on the first pack, as Bilibili does; 最近 is the clock tab in front of it.
const active = computed(() => tabs.value.find(tab => tab.id === activeId.value) ?? tabs.value.find(tab => tab.id !== 'recent') ?? tabs.value[0])

watch(open, (value) => {
  if (!value)
    return
  load()
  recentCodes.value = readRecent()
  activeId.value = ''
}, { immediate: true })

function pick(sticker: Sticker) {
  remember(sticker)
  open.value = false
  emit('pick', sticker)
}

const chosen = computed(() => new Set(props.selected))
</script>

<template>
  <TxPopover v-model="open" placement="top-start" :width="376" :show-arrow="false" panel-background="pure" :panel-padding="0">
    <template #reference>
      <TxButton variant="bare" :size="size" :icon="icon" :aria-expanded="open">
        {{ label }}
      </TxButton>
    </template>

    <div class="w-full flex flex-col" data-sticker-panel>
      <p v-if="!active" class="m-0 p-4 text-sm text-$tx-text-color-regular">
        正在读取表情…
      </p>
      <template v-else>
        <span class="px-4 pb-1 pt-3 text-xs text-$tx-text-color-regular">{{ active.name }}</span>
        <div class="grid grid-cols-4 h-72 content-start gap-1 overflow-y-auto overscroll-contain px-3 pb-2" role="tabpanel" :aria-label="active.name">
          <TxButton
            v-for="sticker in active.stickers"
            :key="sticker.id"
            variant="bare"
            class="!h-24 !rounded-lg !px-1 !py-1.5 hover:!bg-$tx-fill-color-light"
            :class="chosen.has(sticker.id) ? '!bg-$tx-fill-color ring-1 ring-$tx-color-primary' : ''"
            :title="sticker.label"
            :aria-label="sticker.label"
            :aria-pressed="chosen.has(sticker.id) ? 'true' : undefined"
            @click="pick(sticker)"
          >
            <span class="w-full flex flex-col items-center gap-1">
              <img :src="sticker.url" :alt="sticker.label" class="block h-16 w-16 object-contain" loading="lazy" decoding="async">
              <span class="block w-full truncate text-center text-xs text-$tx-text-color-regular">{{ sticker.label }}</span>
            </span>
          </TxButton>
        </div>
        <div class="flex items-center gap-1 overflow-x-auto border-t border-$tx-border-color-lighter bg-$tx-fill-color-lighter px-2 py-1.5" role="tablist" aria-label="表情包">
          <TxButton
            v-for="tab in tabs"
            :key="tab.id"
            variant="bare"
            size="sm"
            class="!h-9 !w-11 shrink-0 !rounded-md !p-0"
            :class="tab.id === active.id ? '!bg-$tx-fill-color-darker' : ''"
            role="tab"
            :title="tab.name"
            :aria-label="tab.name"
            :aria-selected="tab.id === active.id ? 'true' : 'false'"
            @click="activeId = tab.id"
          >
            <img v-if="tab.cover" :src="tab.cover" alt="" class="block h-7 w-7 object-contain">
            <i v-else class="i-ri-time-line text-lg" aria-hidden="true" />
          </TxButton>
        </div>
      </template>
    </div>
  </TxPopover>
</template>
