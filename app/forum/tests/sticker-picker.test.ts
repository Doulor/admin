import type { StickerPack } from '../shared/forum-api'
import type { TestNode } from './support/sfc'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import * as postMarkdown from '../shared/post-markdown'
import { find, findAll, loadComponent, mount, textOf } from './support/sfc'
import { TUFFEX_STUBS } from './support/tuffex-stubs'

/**
 * The sticker panel, mounted (#276): laid out like Bilibili's, one pack at a
 * time with each sticker's name under its picture, a tab per pack, and 最近
 * once this browser has used a sticker. TxPopover is a plain box here; the
 * popover itself is checked in a browser.
 */
const url = (code: string) => `/api/forum/stickers/${code.padEnd(64, '0')}.webp`
const PACKS: StickerPack[] = [
  { id: 'yugc', name: '极客娘', stickers: [
    { id: 'yugc-wave', shortcode: 'yugc-wave', label: '打招呼', url: url('a') },
    { id: 'yugc-heart', shortcode: 'yugc-heart', label: '比心', url: url('b') },
  ] },
  { id: 'cats', name: '猫猫', stickers: [{ id: 'cats-hi', shortcode: 'cats-hi', label: '招手', url: url('c') }] },
  { id: 'empty', name: '空包', stickers: [] },
]

function stubStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  })
  return items
}

afterEach(() => vi.unstubAllGlobals())

function mountPicker() {
  const load = vi.fn()
  const StickerPicker = loadComponent('components/StickerPicker.vue', {
    imports: { '../../shared/post-markdown': postMarkdown },
    globals: { useStickers: () => ({ packs: computed(() => PACKS), load }) },
  })
  const open = ref(true)
  const picked: string[] = []
  const Parent = defineComponent({
    setup: () => () => h(StickerPicker, {
      'open': open.value,
      'onUpdate:open': (value: boolean) => {
        open.value = value
      },
      'onPick': (sticker: { shortcode: string }) => picked.push(sticker.shortcode),
    }),
  })
  const TxPopover = defineComponent({
    setup: (_props, { slots }) => () => h('div', null, Object.values(slots).flatMap(slot => (typeof slot === 'function' ? slot() : []))),
  })
  const { root } = mount(Parent, {}, { ...TUFFEX_STUBS, TxPopover })
  return { root, open, picked, load }
}

const tabs = (root: TestNode) => findAll(root, node => node.tag === 'button' && node.props.role === 'tab')
const grid = (root: TestNode) => find(root, node => node.props.role === 'tabpanel')!

describe('the sticker panel', () => {
  it('opens on the first pack with each sticker\'s name under its picture, one tab per pack that has stickers', async () => {
    stubStorage()
    const { root, load } = mountPicker()
    await nextTick()
    expect(load).toHaveBeenCalled()
    expect(tabs(root).map(tab => tab.props['aria-label'])).toEqual(['极客娘', '猫猫'])
    expect(grid(root).props['aria-label']).toBe('极客娘')
    expect(textOf(grid(root))).toBe('打招呼比心')
    // Hovering a sticker shows how to type it; the header says so too.
    expect(find(grid(root), node => node.props['aria-label'] === '打招呼')!.props.title).toBe('[极客娘_打招呼]')
    expect(textOf(root)).toContain('输入 [极客娘_名字] 也能发')
  })

  it('switches packs from the tabs', async () => {
    stubStorage()
    const { root } = mountPicker()
    await nextTick()
    ;(tabs(root)[1]!.props.onClick as () => void)()
    await nextTick()
    expect(grid(root).props['aria-label']).toBe('猫猫')
    expect(tabs(root)[1]!.props['aria-selected']).toBe('true')
  })

  it('remembers what was picked: newest first, at most 8, under forum:stickers:recent, and shows 最近 as the first tab', async () => {
    const storage = stubStorage({ 'forum:stickers:recent': JSON.stringify(['yugc-gone', 'yugc-heart']) })
    const { root, picked, open } = mountPicker()
    await nextTick()
    // A shortcode no pack has any more (disabled since) drops out.
    expect(tabs(root).map(tab => tab.props['aria-label'])).toEqual(['最近使用', '极客娘', '猫猫'])
    ;(find(grid(root), node => node.tag === 'button' && node.props['aria-label'] === '打招呼')!.props.onClick as () => void)()
    await nextTick()
    expect(picked).toEqual(['yugc-wave'])
    expect(open.value).toBe(false)
    expect(JSON.parse(storage.get('forum:stickers:recent')!)).toEqual(['yugc-wave', 'yugc-gone', 'yugc-heart'])
    open.value = true
    await nextTick()
    ;(tabs(root)[0]!.props.onClick as () => void)()
    await nextTick()
    expect(textOf(grid(root))).toBe('打招呼比心')
  })
})
