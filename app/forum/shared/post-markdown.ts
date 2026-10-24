/**
 * 帖子正文按 Markdown 原样存，游客也能发，渲染给别人看之前先在这里过一遍，再交给 TxMarkdownView。
 *
 * 1. 原始 HTML 一律当文字显示：每个可能开始 HTML 的 `<`（后面紧跟字母、`/`、`!`、`?`）后面插一个
 *    WORD JOINER（U+2060，不可见、不断行）。marked 的所有 HTML 规则都要求 `<` 后面紧跟这几类字符，
 *    插进去以后整篇文字里就不会再有标签、注释或 HTML 块，不需要猜哪里是代码：在代码里它同样看不见，
 *    `#include <stdio.h>` 照常显示；复制时 `ForumMarkdown.vue` 把它从剪贴板里去掉。
 *    `<https://…>`、`<mailto:…>` 这种自动链接不含空格，本来就不可能是标签，原样保留。
 * 2. Typora 这类编辑器常写 `<img src="…" alt="…" style="zoom:33%">`（公开的旧帖里就有），
 *    代码块之外的 `<img>` 换成等价的 Markdown 图片 `![alt](src)`，属性只留 src 和 alt。
 * 3. 链接和图片的地址只放行 http(s)、mailto 和不带协议的站内地址；`javascript:`、`data:`、`vbscript:`
 *    等其它协议（包括写成实体、夹着控制字符的）前面加 `#`，变成页内锚点。引用式定义 `[x]: …` 同样处理。
 *
 * 4. 表情（#276）：代码之外的 `:yugc-wave:` 这类短码，只要在表情白名单里（`GET /api/forum/stickers`
 *    给的、启用中的），换成 `<img class="forum-sticker" alt="<名字>" src="<站内地址>">`。这一步在第 1 步
 *    之后做，插进去的标签不会被当成文字；地址只认站内按哈希的表情地址，名字按属性转义。不在白名单里的
 *    （停用的、拼错的）原样显示。服务端存的仍是短码。
 *
 * TxMarkdownView 默认还会用 DOMPurify 清理一遍，这里是第一道；任何一道的默认值变了，另一道仍然挡着。
 * 写帖子的编辑器（PostEditor.vue）里别人的文字（回复时的引用、版主编辑别人的帖子）原样放进去，不另做转义；
 * 编辑器里表情显示成图片，进出编辑器时用 `stickersToImages` / `imagesToStickers` 在短码和图片之间换。
 */

import { postLine } from '../app/utils/excerpt'

export const WORD_JOINER = '\u2060'

/** 白名单里的一个表情：短码（不带冒号）、名字、站内图片地址。 */
export interface StickerRef {
  shortcode: string
  label: string
  url: string
}

/** 短码的写法与服务端 `STICKER_ID_PATTERN` 相同，两边用冒号包住。 */
const SHORTCODE = /:([a-z0-9][a-z0-9-]{1,39}):/g
/** 站内按内容哈希的表情地址（与 shared/forum-api.ts 的 isStickerUrl 同一条规则）。 */
const STICKER_URL = /^\/api\/forum\/stickers\/[0-9a-f]{64}\.webp$/
/** 编辑器里的表情图片 `![名字](地址)` 或 `![名字](地址 "标题")`。 */
const STICKER_IMAGE = /!\[[^\]\n]*\]\((\/api\/forum\/stickers\/[0-9a-f]{64}\.webp)(?:\s+"[^"\n]*")?\)/g

const SAFE_SCHEMES = new Set(['http', 'https', 'mailto'])

/** 与 marked 同样的围栏：行首最多 3 个空格，3 个以上的 ` 或 ~；反引号围栏的信息串里不能再有反引号。 */
const FENCE_OPEN = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/

/** `<` 后面是这些字符时，marked 可能把它当成 HTML 的开头。 */
const HTML_START = /<(?=[a-z/!?])/gi
/** 不含空白的 http(s)/mailto 自动链接，marked 只会把它当链接。粘性匹配，从每个 `<` 的位置试一次。 */
const AUTOLINK = /<(?:https?:\/\/|mailto:)[^\s<>]*>/iy

/** 行内链接与图片 `](dest`、引用式定义 `]: dest`（地址可以在下一行）。 */
const INLINE_DESTINATION = /(\]\(\s*<?)([^\s)>]*)/g
const DEFINITION_DESTINATION = /(\]:[ \t]*(?:\n[ \t]*)?<?)([^\s>]*)/g

export function renderableMarkdown(source: string, stickers?: ReadonlyMap<string, StickerRef>): string {
  const withImages = convertImgTags(source)
  const withSafeLinks = withImages
    .replace(INLINE_DESTINATION, neutralize)
    .replace(DEFINITION_DESTINATION, neutralize)
  const escaped = escapeHtmlStarts(withSafeLinks)
  return stickers?.size ? mapOutsideCode(escaped, text => text.replace(SHORTCODE, (match, code: string) => stickerTag(stickers.get(code)) ?? match)) : escaped
}

/** 短码换成的标签；地址不是站内表情地址时不换（返回 null，原样显示短码）。 */
function stickerTag(sticker: StickerRef | undefined): string | null {
  if (!sticker || !STICKER_URL.test(sticker.url))
    return null
  return `<img class="forum-sticker" alt="${escapeAttribute(sticker.label)}" src="${sticker.url}">`
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 白名单按短码查：服务端给的表情包摊平成一张表。 */
export function stickerIndex(packs: ReadonlyArray<{ stickers: ReadonlyArray<StickerRef> }>): Map<string, StickerRef> {
  return new Map(packs.flatMap(pack => pack.stickers).map(sticker => [sticker.shortcode, sticker]))
}

/** 进编辑器之前：代码之外白名单里的短码换成 Markdown 图片，编辑时看到的就是表情。 */
export function stickersToImages(source: string, stickers: ReadonlyMap<string, StickerRef>): string {
  if (!stickers.size)
    return source
  return mapOutsideCode(source, text => text.replace(SHORTCODE, (match, code: string) => {
    const sticker = stickers.get(code)
    return sticker && STICKER_URL.test(sticker.url) ? `![${sticker.label.replace(/[\\[\]]/g, '')}](${sticker.url})` : match
  }))
}

/** 从编辑器出来以后：表情图片换回短码，存进服务端的仍是 `:yugc-wave:`。认不出的图片原样留下。 */
export function imagesToStickers(source: string, stickers: ReadonlyMap<string, StickerRef>): string {
  if (!stickers.size)
    return source
  const byUrl = new Map([...stickers.values()].map(sticker => [sticker.url, sticker.shortcode]))
  return mapOutsideCode(source, text => text.replace(STICKER_IMAGE, (match, url: string) => {
    const code = byUrl.get(url)
    return code ? `:${code}:` : match
  }))
}

/** 回复框引用的摘要最多这么长。 */
export const QUOTE_LENGTH = 80

/** 引用一条回复时插入的文字（#276）：`> @用户名：那一帖的前 80 个字`。 */
export function replyQuote(excerpt: string, username?: string): string {
  return username ? `> @${username}：${excerpt}\n\n` : `> ${excerpt}\n\n`
}

/**
 * 点「引用」时插入的内容（ReplyComposer.vue）。
 * 引的是那一帖的一行文字（#156）：页面在列表里拿到的可能只有服务端截好的 `excerpt`。
 */
export function quoteDraft(post: { content?: string, excerpt?: string }, username?: string): string {
  return replyQuote(postLine(post, QUOTE_LENGTH), username)
}

function neutralize(match: string, lead: string, destination: string): string {
  return isUnsafeDestination(destination) ? `${lead}#${destination}` : match
}

/**
 * 地址里有协议且不在白名单里就算不安全。浏览器会先解码属性里的实体、忽略控制字符和空白再判断协议，
 * 这里照做，`java&#115;cript:`、`jav&#x09;ascript:`、`JaVaScRiPt:` 都拦得住。
 */
export function isUnsafeDestination(destination: string): boolean {
  const decoded = destination
    .replace(/\\(.)/g, '$1')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16) % 0x110000))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(Number(dec) % 0x110000))
    .replace(/&colon;/gi, ':')
    .replace(/&(?:tab|newline);/gi, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0020\u007F-\u009F\u2060\u200B]/g, '')
    .toLowerCase()
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(decoded)?.[1]
  return scheme !== undefined && !SAFE_SCHEMES.has(scheme)
}

function escapeHtmlStarts(text: string): string {
  return text.replace(HTML_START, (match, offset: number) => {
    AUTOLINK.lastIndex = offset
    return AUTOLINK.test(text) ? match : `<${WORD_JOINER}`
  })
}

/**
 * 只在围栏代码块和同一行的行内代码之外换 `<img>`；判断错了也不影响安全（换不成的 `<img` 最后仍会被
 * 第 1 步当作文字），只影响代码里的 `<img>` 会不会被改写。
 */
function convertImgTags(source: string): string {
  return mapOutsideCode(source, text => text.replace(/<img\b[^>]*>/gi, imgToMarkdown))
}

/** 对围栏代码块和行内代码之外的文字做 `map`；表情短码与 `<img>` 改写共用。 */
function mapOutsideCode(source: string, map: (text: string) => string): string {
  let fence: string | null = null
  return source.split('\n').map((line) => {
    if (fence !== null) {
      if (new RegExp(`^ {0,3}${fence}[~\`]* *$`).test(line))
        fence = null
      return line
    }
    const open = FENCE_OPEN.exec(line)
    if (open) {
      fence = open[1] as string
      return line
    }
    return mapOutsideCodeSpans(line, map)
  }).join('\n')
}

function mapOutsideCodeSpans(line: string, map: (text: string) => string): string {
  let out = ''
  let plain = ''
  let index = 0
  while (index < line.length) {
    const char = line[index] as string
    if (char === '\\') {
      plain += line.slice(index, index + 2)
      index += 2
      continue
    }
    if (char === '`') {
      const run = /^`+/.exec(line.slice(index))?.[0] as string
      const close = findClosingRun(line, index + run.length, run.length)
      if (close >= 0) {
        out += map(plain) + line.slice(index, close + run.length)
        plain = ''
        index = close + run.length
        continue
      }
      plain += run
      index += run.length
      continue
    }
    plain += char
    index += 1
  }
  return out + map(plain)
}

function findClosingRun(line: string, from: number, length: number): number {
  const pattern = /`+/g
  pattern.lastIndex = from
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    if (match[0].length === length)
      return match.index
  }
  return -1
}

function imgToMarkdown(tag: string): string {
  const src = attribute(tag, 'src')
  if (!src || /[\s()<>]/.test(src) || isUnsafeDestination(src))
    return tag
  const alt = (attribute(tag, 'alt') ?? '').replace(/[\\[\]]/g, '\\$&').replace(/\s+/g, ' ')
  return `![${alt}](${src})`
}

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(tag)
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined
}
