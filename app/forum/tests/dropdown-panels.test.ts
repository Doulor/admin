import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Tuffex 0.6.0 draws every dropdown panel with `panel-background="refraction"` unless told otherwise: the
 * panel bends what is behind it, so on the forum's near-white pages the text underneath shows through with
 * coloured fringes (owner, 2026-10-24: 「所有的下拉框都不要这样的」). Every dropdown in the forum passes
 * `pure`, the library's own opaque recipe. TxBlockSelect cannot pass it on to its TxSelect, so it is not used.
 */
const APP = fileURLToPath(new URL('../app/', import.meta.url))
const DROPDOWNS = /<(TxSelect|TxSearchSelect|TxDropdownMenu|TxDropdownSubmenu|TxContextMenu|TxPopover)(?=\s|>)[^>]*>/g

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith('.vue') ? [path] : []
  })
}

describe('dropdown panels are opaque', () => {
  const files = vueFiles(APP).map(path => ({ path: path.slice(APP.length), text: readFileSync(path, 'utf8') }))

  it('every dropdown passes panel-background="pure"', () => {
    const tags = files.flatMap(({ path, text }) => [...text.matchAll(DROPDOWNS)].map(match => ({ path, tag: match[0] })))
    expect(tags.length).toBeGreaterThanOrEqual(10)
    for (const { path, tag } of tags)
      expect(tag, path).toMatch(/\spanel-background="pure"/)
  })

  it('does not use TxBlockSelect', () => {
    for (const { path, text } of files)
      expect(text, path).not.toMatch(/<TxBlockSelect\b/)
  })
})
