import type { EditorView } from '@milkdown/kit/prose/view'
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx } from '@milkdown/kit/core'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { $prose, insert, replaceAll } from '@milkdown/kit/utils'
import '@milkdown/crepe/theme/common/style.css'

/**
 * Milkdown Crepe for the post editor (#276), loaded only when someone starts
 * a topic or a reply: PostEditor imports this module dynamically, so none of
 * it reaches the first screen. It lives outside `utils/` because Nuxt
 * auto-imports that folder, and one auto-imported name would pull the whole
 * editor into the main bundle.
 *
 * Only Crepe's structural stylesheet (theme/common) is loaded; its colours are
 * `--crepe-*` variables pointed at the Tuffex tokens in uno.config.ts, so the
 * editor follows the forum's theme. Features the forum cannot show are off:
 * math (posts do not render it), the top bar and the AI helper.
 *
 * Pasted or dropped images go through Crepe's upload hook to the forum's
 * upload endpoint; the slash menu gains 「表情」, which opens the sticker panel
 * (the panel is Vue, so this module only says when). `@` followed by letters
 * reports the word being typed so PostEditor can list matching accounts;
 * while that list is open, ↑ ↓ Enter and Esc belong to it.
 */

export interface MentionQuery {
  /** The text after `@`, at most 24 characters. */
  query: string
  /** Where `@` starts and the word ends, in document positions. */
  from: number
  to: number
}

export interface CrepeEditorOptions {
  root: HTMLElement
  value: string
  placeholder: string
  onChange: (markdown: string) => void
  onUpload: (file: File) => Promise<string>
  /** null when stickers are not available to this viewer: the menu item is left out. */
  onStickerMenu: (() => void) | null
  onMention: (query: MentionQuery | null) => void
  /** The mention list is open and takes this key (ArrowUp, ArrowDown, Enter, Escape): return true when it did. */
  onMentionKey: (key: string) => boolean
}

export interface CrepeEditor {
  /** Replaces the whole text (a draft put back, the editor cleared after sending). */
  setMarkdown: (markdown: string) => void
  /** Inserts Markdown at the cursor, inline. */
  insert: (markdown: string) => void
  /** Replaces `@query` with `@username ` and puts the cursor after it. */
  completeMention: (range: MentionQuery, username: string) => void
  focus: () => void
  destroy: () => Promise<void>
}

/** `@` at the start of a line or after a space, then up to 24 letters, digits, `_`, `-` or CJK. */
const MENTION_BEFORE_CURSOR = /(?:^|\s)@([\w一-鿿-]{0,24})$/

/** What `@…` is being typed right before the cursor, or null. */
export function mentionAt(view: Pick<EditorView, 'state'>): MentionQuery | null {
  const { selection } = view.state
  if (!selection.empty)
    return null
  const { $from } = selection
  if ($from.parent.type.spec.code)
    return null
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
  const match = MENTION_BEFORE_CURSOR.exec(before)
  if (!match)
    return null
  const query = match[1] ?? ''
  return { query, from: $from.pos - query.length - 1, to: $from.pos }
}

export async function createCrepeEditor(options: CrepeEditorOptions): Promise<CrepeEditor> {
  const crepe = new Crepe({
    root: options.root,
    defaultValue: options.value,
    features: {
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.TopBar]: false,
      [Crepe.Feature.AI]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: options.placeholder, mode: 'doc' },
      [Crepe.Feature.ImageBlock]: {
        onUpload: options.onUpload,
        inlineOnUpload: options.onUpload,
        blockOnUpload: options.onUpload,
        inlineUploadButton: '上传',
        inlineUploadPlaceholderText: '或粘贴图片地址',
        inlineConfirmButton: '确定',
        blockUploadButton: '上传图片',
        blockUploadPlaceholderText: '或粘贴图片地址',
        blockConfirmButton: '确定',
        blockCaptionPlaceholderText: '图片说明',
      },
      [Crepe.Feature.BlockEdit]: {
        textGroup: {
          label: '文字',
          text: { label: '正文' },
          h1: { label: '一级标题' },
          h2: { label: '二级标题' },
          h3: { label: '三级标题' },
          h4: null,
          h5: null,
          h6: null,
          quote: { label: '引用' },
          divider: { label: '分隔线' },
        },
        listGroup: {
          label: '列表',
          bulletList: { label: '无序列表' },
          orderedList: { label: '有序列表' },
          taskList: { label: '待办列表' },
        },
        advancedGroup: {
          label: '插入',
          image: { label: '图片' },
          codeBlock: { label: '代码块' },
          table: { label: '表格' },
          math: null,
        },
        buildMenu: (builder) => {
          const open = options.onStickerMenu
          if (!open)
            return
          builder.addGroup('forum', '论坛').addItem('sticker', {
            label: '表情',
            icon: STICKER_ICON,
            onRun: () => open(),
          })
        },
      },
    },
  })

  const mentionPlugin = $prose(() => new Plugin({
    key: new PluginKey('forum-mention'),
    view: () => ({
      update: view => options.onMention(mentionAt(view)),
    }),
    props: {
      handleKeyDown: (view, event) => {
        if (!mentionAt(view))
          return false
        if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(event.key))
          return false
        return options.onMentionKey(event.key === 'Tab' ? 'Enter' : event.key)
      },
    },
  }))
  crepe.editor.use(mentionPlugin)

  crepe.on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => options.onChange(markdown))
  })
  await crepe.create()

  const run = (action: (view: EditorView) => void): void => {
    crepe.editor.action(ctx => action(ctx.get(editorViewCtx)))
  }

  return {
    setMarkdown: markdown => crepe.editor.action(replaceAll(markdown)),
    insert: (markdown) => {
      crepe.editor.action(insert(markdown, true))
      run(view => view.focus())
    },
    completeMention: (range, username) => run((view) => {
      view.dispatch(view.state.tr.insertText(`@${username} `, range.from, range.to))
      view.focus()
    }),
    focus: () => run(view => view.focus()),
    destroy: async () => {
      await crepe.destroy()
    },
  }
}

/** Remix `emotion-happy-line`, the same glyph as the composer's 表情 button. */
const STICKER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM7 13H9C9 14.6569 10.3431 16 12 16C13.6569 16 15 14.6569 15 13H17C17 15.7614 14.7614 18 12 18C9.23858 18 7 15.7614 7 13ZM8 11C7.17157 11 6.5 10.3284 6.5 9.5C6.5 8.67157 7.17157 8 8 8C8.82843 8 9.5 8.67157 9.5 9.5C9.5 10.3284 8.82843 11 8 11ZM16 11C15.1716 11 14.5 10.3284 14.5 9.5C14.5 8.67157 15.1716 8 16 8C16.8284 8 17.5 8.67157 17.5 9.5C17.5 10.3284 16.8284 11 16 11Z"/></svg>'
