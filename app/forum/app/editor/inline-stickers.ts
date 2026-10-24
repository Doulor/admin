import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'

/**
 * Stickers in the post editor (#276), kept apart from crepe-editor.ts so the
 * rule can be tested without starting Milkdown; only types come from it here.
 */

export type StickerLookup = (key: { src: string } | { token: string }) => { src: string, label: string } | undefined

/** Site sticker files (the same rule as shared/forum-api.ts isStickerUrl). */
const STICKER_SRC = /^\/api\/forum\/stickers\/[0-9a-f]{64}\.webp$/
/** `[包名_名字]` (shared/post-markdown.ts TOKEN), checked against the sticker list. */
const STICKER_TOKEN = /\[[^[\]\n]{1,64}\]/g

/**
 * Puts stickers back in the line: Crepe turns a paragraph holding nothing but
 * one picture into a picture block (a sticker sent on its own comes back from
 * the server that way), and `[包名_名字]` typed or pasted is still text. Both
 * become an inline image. Returns null when there is nothing to change.
 */
export function inlineStickers(state: EditorState, find: StickerLookup): Transaction | null {
  const { image, paragraph } = state.schema.nodes
  if (!image || !paragraph)
    return null
  const edits: { from: number, to: number, node: ProseNode }[] = []
  state.doc.descendants((node, pos, parent) => {
    if (node.type.name === 'image-block' && STICKER_SRC.test(String(node.attrs.src))) {
      const sticker = find({ src: String(node.attrs.src) })
      edits.push({ from: pos, to: pos + node.nodeSize, node: paragraph.create(null, image.create({ src: node.attrs.src, alt: sticker?.label ?? '' })) })
      return false
    }
    if (!node.isText || !node.text?.includes('[') || parent?.type.spec.code || node.marks.some(mark => mark.type.spec.code))
      return true
    for (const match of node.text.matchAll(STICKER_TOKEN)) {
      const sticker = find({ token: match[0] })
      if (sticker) {
        const from = pos + (match.index ?? 0)
        edits.push({ from, to: from + match[0].length, node: image.create({ src: sticker.src, alt: sticker.label }) })
      }
    }
    return false
  })
  if (!edits.length)
    return null
  const tr = state.tr
  for (const edit of edits.reverse())
    tr.replaceWith(edit.from, edit.to, edit.node)
  return tr
}
