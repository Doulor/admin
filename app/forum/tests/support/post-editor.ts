import type { Component } from 'vue'
import type { CrepeEditorOptions, MentionQuery } from '~/editor/crepe-editor'
import type { StickerPack, SuggestedUser } from '../../shared/forum-api'
import { vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import * as forumApi from '../../shared/forum-api'
import * as postMarkdown from '../../shared/post-markdown'

/**
 * What PostEditor needs on the in-memory tree (./sfc.ts). Milkdown Crepe needs
 * a browser, so `~/editor/crepe-editor` is a stand-in that records what
 * PostEditor asks of it; `crepe` says how its dynamic import goes:
 *
 * - 'ready': the stand-in loads and replaces the textarea;
 * - 'loading': it never settles, so the textarea stays, as on a slow network;
 * - 'broken': the import fails, as when the chunk cannot be fetched.
 *
 * Typing into the loaded editor is `editor.options.onChange(markdown)`.
 */
export interface FakeCrepe {
  options: CrepeEditorOptions
  /** Every `setMarkdown` PostEditor made, in order. */
  set: string[]
  inserted: string[]
  completed: Array<[MentionQuery, string]>
  destroyed: boolean
}

export interface PostEditorKitOptions {
  crepe?: 'ready' | 'loading' | 'broken'
  /** The viewer's permission nodes (`forum.sticker.use`, `forum.upload.image`). */
  granted?: string[]
  serverMode?: boolean
  packs?: StickerPack[]
  /** With 'ready': the editor finishes starting only once this settles. */
  starting?: Promise<void>
}

export const WAVE_URL = `/api/forum/stickers/${'a'.repeat(64)}.webp`
export const WAVE_PACK: StickerPack = {
  id: 'yugc',
  name: '长大极客',
  stickers: [{ id: 'yugc-wave', shortcode: 'yugc-wave', label: '挥手', url: WAVE_URL }],
}

/** Renders a `data-sticker-picker` box; pick with `node.props.onPick(sticker)`. */
export const StickerPickerStub: Component = defineComponent({
  props: { open: Boolean, label: { type: String, default: '表情' } },
  emits: ['pick', 'update:open'],
  setup(props, { emit }) {
    return () => h('div', { 'data-sticker-picker': true, 'open': props.open, 'onPick': (sticker: unknown) => emit('pick', sticker) })
  },
})

export function postEditorKit({ crepe = 'ready', granted = [], serverMode = true, packs = [WAVE_PACK], starting }: PostEditorKitOptions = {}) {
  const editors: FakeCrepe[] = []
  const toast = vi.fn()
  /** Every `useActivityBeacon().report()` call PostEditor made, in order (#274：表情使用埋点). */
  const reported: Array<{ action: string, extra: Record<string, unknown> }> = []
  const server = {
    granted: new Set(granted),
    stickerPacks: packs,
    suggestUsers: vi.fn(async (_query: string): Promise<SuggestedUser[]> => []),
    uploadImage: vi.fn(async (_file: File): Promise<string> => '/api/forum/uploads/b.png'),
  }

  const crepeModule = {
    createCrepeEditor: async (options: CrepeEditorOptions) => {
      if (crepe === 'loading')
        return new Promise(() => {})
      const editor: FakeCrepe = { options, set: [], inserted: [], completed: [], destroyed: false }
      editors.push(editor)
      await starting
      return {
        setMarkdown: (markdown: string) => editor.set.push(markdown),
        insert: (markdown: string) => editor.inserted.push(markdown),
        completeMention: (range: MentionQuery, username: string) => editor.completed.push([range, username]),
        focus: () => {},
        destroy: async () => {
          editor.destroyed = true
        },
      }
    },
  }

  const imports: Record<string, unknown> = {
    '@talex-touch/tuffex/utils': { toast },
    '../../shared/forum-api': forumApi,
    '../../shared/post-markdown': postMarkdown,
    ...(crepe === 'broken' ? {} : { '~/editor/crepe-editor': crepeModule }),
  }
  const globals: Record<string, unknown> = {
    useForumServerStore: () => server,
    useContentSource: () => ({ serverMode }),
    useStickers: () => ({
      available: serverMode,
      packs: computed(() => server.stickerPacks),
      index: computed(() => postMarkdown.stickerIndex(server.stickerPacks)),
      load: () => {},
    }),
    useActivityBeacon: () => ({
      report: (action: string, extra: Record<string, unknown> = {}) => reported.push({ action, extra }),
    }),
  }
  return { imports, globals, editors, toast, server, reported }
}
