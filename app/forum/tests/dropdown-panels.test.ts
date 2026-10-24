import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Tuffex 0.6.0 draws every dropdown panel with `panel-background="refraction"` unless told otherwise: the
 * panel bends what is behind it, so on the forum's near-white pages the text underneath shows through with
 * coloured fringes (owner, 2026-10-24: 「所有的下拉框都不要这样的」). Every dropdown in the forum passes
 * `pure`, the library's own opaque recipe. TxBlockSelect cannot pass it on to its TxSelect, so it is not used.
 * (Since 0.9.1 the forum also turns every glass surface opaque page-wide: app/plugins/opaque-surfaces.ts.)
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

  it('every TxSelect has Chinese search words or no search box', () => {
    // From 0.8.0 a TxSelect with 8 or more options opens a search box by itself, with the words
    // 「Search」 and 「No results」 unless told otherwise.
    const selects = files.flatMap(({ path, text }) => [...text.matchAll(/<TxSelect(?=\s|>)[^>]*>/g)].map(match => ({ path, tag: match[0] })))
    for (const { path, tag } of selects)
      expect(tag, path).toMatch(/\s(?:search-placeholder="[^"]*[\u4E00-\u9FFF][^"]*"[^>]*\sempty-text="[^"]*[\u4E00-\u9FFF]|:searchable="false")/)
  })

  it('does not use TxBlockSelect', () => {
    for (const { path, text } of files)
      expect(text, path).not.toMatch(/<TxBlockSelect\b/)
  })
})
