/**
 * A post being written, kept in this browser (#276): saved every 2 seconds
 * while it changes, under `forum:draft:<topicId>` for a reply and
 * `forum:draft:new` for a new topic, and cleared once the server took it.
 * Closing the tab or the drawer loses nothing that was typed 2 seconds before.
 *
 * Storage may be off (private mode, full quota); then nothing is kept and
 * nothing fails. An empty draft removes the key instead of storing "".
 */
const PREFIX = 'forum:draft:'
const SAVE_EVERY_MS = 2000

export function usePostDraft(id: MaybeRefOrGetter<string>, content: Ref<string>) {
  let saved: string | null = null
  let timer: ReturnType<typeof setInterval> | undefined

  const key = (): string => `${PREFIX}${toValue(id)}`

  function read(): string {
    try {
      return globalThis.localStorage?.getItem(key()) ?? ''
    }
    catch {
      return ''
    }
  }

  function write(text: string): void {
    try {
      if (text.trim())
        globalThis.localStorage?.setItem(key(), text)
      else
        globalThis.localStorage?.removeItem(key())
    }
    catch {
      // Storage off or full: the draft lives only in the page.
    }
  }

  function save(): void {
    const text = content.value
    if (text === saved)
      return
    saved = text
    write(text)
  }

  function clear(): void {
    saved = ''
    write('')
  }

  onMounted(() => {
    saved = read()
    timer = setInterval(save, SAVE_EVERY_MS)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    save()
  })

  return { read, save, clear }
}
