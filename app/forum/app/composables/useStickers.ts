import { stickerIndex } from '../../shared/post-markdown'

/**
 * The sticker packs (#276): the forum server's enabled stickers, read once per
 * page the first time a picker, a reaction or a post body asks. Posts render
 * only the shortcodes in this list (shared/post-markdown.ts), so a sticker an
 * admin disables shows as its plain `:code:` after the next page load.
 *
 * The demo and the snapshot have no sticker server: `available` is false and
 * the list stays empty, so pickers and reaction buttons do not render there.
 */
export function useStickers() {
  const { serverMode } = useContentSource()
  const server = useForumServerStore()

  const packs = computed(() => server.stickerPacks)
  const index = computed(() => stickerIndex(server.stickerPacks))

  function load(): void {
    if (serverMode && import.meta.client)
      void server.loadStickers()
  }

  return { available: serverMode, packs, index, load }
}
