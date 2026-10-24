import type { TestNode } from './support/sfc'
import type { PostEditorKitOptions } from './support/post-editor'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { ForumApiError } from '../shared/forum-api'
import { postEditorKit, StickerPickerStub, WAVE_PACK, WAVE_URL } from './support/post-editor'
import { find, isShown, loadComponent, mount, textOf } from './support/sfc'
import { TUFFEX_STUBS } from './support/tuffex-stubs'

/**
 * PostEditor, mounted (#276): the textarea until Milkdown Crepe has loaded
 * (and for good if it cannot), the Markdown going in and out of the editor
 * with stickers as `:shortcode:`, ⌘ / Ctrl + Enter, stickers, `@` mentions and
 * image uploads. Crepe itself is a stand-in here (support/post-editor.ts);
 * what it draws is checked in a browser.
 */
const WAVE = WAVE_PACK.stickers[0]!

async function settle() {
  await new Promise(resolve => setTimeout(resolve))
  await nextTick()
}

function mountEditor(initial = '', kitOptions: PostEditorKitOptions = {}, props: Record<string, unknown> = {}) {
  const kit = postEditorKit(kitOptions)
  const PostEditor = loadComponent('components/PostEditor.vue', { imports: kit.imports, globals: kit.globals })
  const text = ref(initial)
  const submit = vi.fn()
  const Parent = defineComponent({
    setup: () => () => h(PostEditor, {
      'modelValue': text.value,
      'onUpdate:modelValue': (value: string) => {
        text.value = value
      },
      'onSubmit': submit,
      'label': '回复内容',
      ...props,
    }),
  })
  const { root, unmount } = mount(Parent, {}, { ...TUFFEX_STUBS, StickerPicker: StickerPickerStub })
  return {
    ...kit,
    root,
    unmount,
    text,
    submit,
    textarea: () => find(root, node => node.tag === 'textarea'),
    host: () => find(root, node => 'data-crepe-host' in node.props)!,
    picker: () => find(root, node => 'data-sticker-picker' in node.props),
    mentions: () => find(root, node => 'data-mention-list' in node.props),
    type: async (value: string) => {
      (find(root, node => node.tag === 'textarea')!.props.onInput as (value: string) => void)(value)
      await nextTick()
    },
  }
}

function key(root: TestNode, init: Partial<KeyboardEvent>) {
  const event = { key: 'Enter', metaKey: false, ctrlKey: false, isComposing: false, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...init }
  const editor = find(root, node => 'data-post-editor' in node.props)!
  ;(editor.props.onKeydownCapture as (event: unknown) => void)(event)
  return event
}

afterEach(() => vi.useRealTimers())

describe('before and without the editor', () => {
  it('keeps a labelled textarea with the placeholder and the height while Crepe loads', async () => {
    const editor = mountEditor('先写的字', { crepe: 'loading' }, { placeholder: '写下你的回复', minHeight: 320 })
    await settle()
    const textarea = editor.textarea()!
    expect(textarea.props.value).toBe('先写的字')
    expect(textarea.props['aria-label']).toBe('回复内容')
    expect(textarea.props.placeholder).toBe('写下你的回复')
    expect(String(textarea.props.class).split(' ')).toContain('!min-h-80')
    expect(isShown(editor.host())).toBe(false)
    await editor.type('先写的字，接着写')
    expect(editor.text.value).toBe('先写的字，接着写')
    expect(textOf(editor.root)).not.toContain('编辑器没有加载出来')
  })

  it('stays a textarea and says so when the editor cannot load', async () => {
    const editor = mountEditor('', { crepe: 'broken' })
    await settle()
    expect(editor.textarea()).toBeDefined()
    expect(isShown(editor.host())).toBe(false)
    expect(textOf(editor.root)).toContain('编辑器没有加载出来，先用纯文本写，支持 Markdown。')
    expect(textOf(editor.root)).toContain('⌘ 或 Ctrl + Enter 发送')
    expect(textOf(editor.root)).not.toContain('输入 / 打开菜单')
  })

  it('appends a picked sticker to the textarea as its shortcode', async () => {
    const editor = mountEditor('你好', { crepe: 'broken', granted: ['forum.sticker.use'] })
    await settle()
    ;(editor.picker()!.props.onPick as (sticker: unknown) => void)(WAVE)
    await nextTick()
    expect(editor.text.value).toBe('你好 :yugc-wave: ')
  })
})

describe('the loaded editor', () => {
  it('replaces the textarea, keeps the label and the height, and starts from the text with stickers as pictures', async () => {
    const editor = mountEditor('先打个招呼 :yugc-wave:', { crepe: 'ready' }, { minHeight: 200 })
    await settle()
    expect(editor.textarea()).toBeUndefined()
    expect(isShown(editor.host())).toBe(true)
    expect(editor.host().props['aria-label']).toBe('回复内容')
    expect(String(editor.host().props.class).split(' ')).toContain('forum-editor-200')
    expect(editor.editors).toHaveLength(1)
    expect(editor.editors[0]!.options.value).toBe(`先打个招呼 ![挥手](${WAVE_URL})`)
    expect(editor.editors[0]!.options.placeholder).toBe('写点什么，输入 / 打开菜单')
    expect(textOf(editor.root)).toContain('输入 / 打开菜单，⌘ 或 Ctrl + Enter 发送')
  })

  it('carries over what was typed into the textarea while the editor was starting', async () => {
    let started = () => {}
    const editor = mountEditor('开头', { crepe: 'ready', starting: new Promise<void>((resolve) => {
      started = resolve
    }) })
    await settle()
    await editor.type('开头，加载时接着写 :yugc-wave:')
    started()
    await settle()
    expect(editor.textarea()).toBeUndefined()
    expect(editor.editors[0]!.options.value).toBe('开头')
    expect(editor.editors[0]!.set).toEqual([`开头，加载时接着写 ![挥手](${WAVE_URL})`])
    editor.editors[0]!.options.onChange(`开头，加载时接着写 ![挥手](${WAVE_URL})`)
    await nextTick()
    expect(editor.text.value).toBe('开头，加载时接着写 :yugc-wave:')
    expect(editor.editors[0]!.set).toHaveLength(1)
  })

  it('emits what is typed as Markdown with stickers back as shortcodes, and does not echo it into the editor', async () => {
    const editor = mountEditor('', { crepe: 'ready' })
    await settle()
    const crepe = editor.editors[0]!
    crepe.options.onChange(`**好** ![挥手](${WAVE_URL})`)
    await nextTick()
    expect(editor.text.value).toBe('**好** :yugc-wave:')
    expect(crepe.set).toEqual([])
  })

  it('puts text set from outside (a quote, a cleared draft) into the editor', async () => {
    const editor = mountEditor('', { crepe: 'ready' })
    await settle()
    editor.text.value = '> @ada：原话\n\n:yugc-wave:'
    await nextTick()
    editor.text.value = ''
    await nextTick()
    expect(editor.editors[0]!.set).toEqual([`> @ada：原话\n\n![挥手](${WAVE_URL})`, ''])
  })

  it('inserts a picked sticker as a picture at the cursor', async () => {
    const editor = mountEditor('', { crepe: 'ready', granted: ['forum.sticker.use'] })
    await settle()
    ;(editor.picker()!.props.onPick as (sticker: unknown) => void)(WAVE)
    expect(editor.editors[0]!.inserted).toEqual([`![挥手](${WAVE_URL})`])
  })

  it('opens the sticker panel from the slash menu, and leaves the item out without the right', async () => {
    const allowed = mountEditor('', { crepe: 'ready', granted: ['forum.sticker.use'] })
    await settle()
    allowed.editors[0]!.options.onStickerMenu!()
    await nextTick()
    expect(allowed.picker()!.props.open).toBe(true)

    const refused = mountEditor('', { crepe: 'ready' })
    await settle()
    expect(refused.editors[0]!.options.onStickerMenu).toBeNull()
    expect(refused.picker()).toBeUndefined()
  })

  it('shows no sticker button in the demo, which has no sticker server', async () => {
    const editor = mountEditor('', { crepe: 'ready', granted: ['forum.sticker.use'], serverMode: false })
    await settle()
    expect(editor.picker()).toBeUndefined()
  })

  it('destroys the editor when it unmounts', async () => {
    const editor = mountEditor('', { crepe: 'ready' })
    await settle()
    editor.unmount()
    expect(editor.editors[0]!.destroyed).toBe(true)
  })
})

describe('⌘ or Ctrl + Enter', () => {
  it.each([
    ['⌘ + Enter', { metaKey: true }],
    ['Ctrl + Enter', { ctrlKey: true }],
  ])('%s emits submit and goes no further', async (_name, init) => {
    const editor = mountEditor('回复', { crepe: 'loading' })
    const event = key(editor.root, init)
    expect(editor.submit).toHaveBeenCalledOnce()
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
  })

  it.each([
    ['Enter alone', {}],
    ['⌘ + Enter while an input method is composing', { metaKey: true, isComposing: true }],
    ['⌘ + S', { key: 's', metaKey: true }],
  ])('%s does not', async (_name, init) => {
    const editor = mountEditor('回复', { crepe: 'loading' })
    key(editor.root, init)
    expect(editor.submit).not.toHaveBeenCalled()
  })
})

describe('@ mentions', () => {
  const users = [
    { username: 'ada', displayName: 'Ada', avatarUrl: null },
    { username: 'adam', displayName: '亚当', avatarUrl: null },
  ]

  async function mentioning() {
    vi.useFakeTimers()
    const editor = mountEditor('', { crepe: 'ready' })
    await vi.runAllTimersAsync()
    editor.server.suggestUsers.mockResolvedValue(users)
    const crepe = editor.editors[0]!
    const range = { query: 'ad', from: 1, to: 4 }
    crepe.options.onMention(range)
    return { editor, crepe, range }
  }

  it('asks the server once the letters stop for 250ms and lists who matches', async () => {
    const { editor } = await mentioning()
    await vi.advanceTimersByTimeAsync(249)
    expect(editor.server.suggestUsers).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(editor.server.suggestUsers).toHaveBeenCalledExactlyOnceWith('ad')
    await nextTick()
    expect(textOf(editor.mentions()!)).toBe('Ada@ada亚当@adam')
  })

  it('moves with the arrows, picks with Enter and writes the username into the editor', async () => {
    const { editor, crepe, range } = await mentioning()
    await vi.advanceTimersByTimeAsync(250)
    await nextTick()
    expect(crepe.options.onMentionKey('ArrowDown')).toBe(true)
    expect(crepe.options.onMentionKey('ArrowDown')).toBe(true)
    expect(crepe.options.onMentionKey('ArrowUp')).toBe(true)
    await nextTick()
    const selected = find(editor.mentions()!, node => node.props['aria-selected'] === 'true')!
    expect(textOf(selected)).toBe('亚当@adam')
    expect(crepe.options.onMentionKey('Enter')).toBe(true)
    await nextTick()
    expect(crepe.completed).toEqual([[range, 'adam']])
    expect(editor.mentions()).toBeUndefined()
  })

  it('closes on Escape and leaves keys to the editor when nothing is listed', async () => {
    const { editor, crepe } = await mentioning()
    expect(crepe.options.onMentionKey('Enter')).toBe(false)
    await vi.advanceTimersByTimeAsync(250)
    await nextTick()
    expect(crepe.options.onMentionKey('Escape')).toBe(true)
    await nextTick()
    expect(editor.mentions()).toBeUndefined()
    expect(crepe.options.onMentionKey('Enter')).toBe(false)
  })

  it('asks nothing for a bare @ or in the demo', async () => {
    const { editor, crepe } = await mentioning()
    crepe.options.onMention({ query: '', from: 1, to: 2 })
    await vi.advanceTimersByTimeAsync(500)
    expect(editor.server.suggestUsers).not.toHaveBeenCalled()

    const demo = mountEditor('', { crepe: 'ready', serverMode: false })
    await vi.runAllTimersAsync()
    demo.editors[0]!.options.onMention({ query: 'ad', from: 1, to: 4 })
    await vi.advanceTimersByTimeAsync(500)
    expect(demo.server.suggestUsers).not.toHaveBeenCalled()
  })
})

describe('pasted and dropped images', () => {
  const file = new File(['x'], 'a.png', { type: 'image/png' })

  it('upload to the forum and go in as the address the server gave', async () => {
    const editor = mountEditor('', { crepe: 'ready', granted: ['forum.upload.image'] })
    await settle()
    expect(await editor.editors[0]!.options.onUpload(file)).toBe('/api/forum/uploads/b.png')
    expect(editor.server.uploadImage).toHaveBeenCalledExactlyOnceWith(file)
    expect(editor.toast).not.toHaveBeenCalled()
  })

  it('say why when the server refuses the picture', async () => {
    const editor = mountEditor('', { crepe: 'ready', granted: ['forum.upload.image'] })
    await settle()
    editor.server.uploadImage.mockRejectedValue(new ForumApiError(413, 'too_large', '图片不能超过 5MB'))
    await expect(editor.editors[0]!.options.onUpload(file)).rejects.toBeInstanceOf(ForumApiError)
    expect(editor.toast).toHaveBeenCalledExactlyOnceWith({ title: '图片没有传上去', description: '图片不能超过 5MB', variant: 'warning' })
  })

  it('are not sent without the upload right, and the toast says to paste an address', async () => {
    const editor = mountEditor('', { crepe: 'ready' })
    await settle()
    await expect(editor.editors[0]!.options.onUpload(file)).rejects.toThrow()
    expect(editor.server.uploadImage).not.toHaveBeenCalled()
    expect(editor.toast).toHaveBeenCalledExactlyOnceWith({ title: '图片没有传上去', description: '现在不能上传图片，可以贴图片地址。', variant: 'warning' })
  })
})
