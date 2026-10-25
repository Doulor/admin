// 终端输出里的颜色码（ESC[…m）切成带样式的片段，https 地址切成链接（#279）。
// 只认 0 复位、1 加粗、22 取消加粗、30–37 / 90–97 前景色、39 默认色；别的码丢掉不显示。

export type Span = { text: string; bold?: boolean; color?: number; href?: string };

const SGR = /\x1b\[([0-9;]*)m/g;
const URL = /https:\/\/[^\s'"<>()]+/g;

export function toSpans(text: string): Span[] {
  const spans: Span[] = [];
  let bold = false;
  let color: number | undefined;
  let at = 0;
  const push = (piece: string) => {
    if (!piece) return;
    let last = 0;
    for (const match of piece.matchAll(URL)) {
      const start = match.index ?? 0;
      if (start > last) spans.push({ text: piece.slice(last, start), bold, color });
      spans.push({ text: match[0], bold, color, href: match[0] });
      last = start + match[0].length;
    }
    if (last < piece.length) spans.push({ text: piece.slice(last), bold, color });
  };
  for (const match of text.matchAll(SGR)) {
    push(text.slice(at, match.index));
    at = (match.index ?? 0) + match[0].length;
    for (const code of (match[1] || "0").split(";").map(Number)) {
      if (code === 0) {
        bold = false;
        color = undefined;
      } else if (code === 1) bold = true;
      else if (code === 22) bold = false;
      else if (code === 39) color = undefined;
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) color = code;
    }
  }
  push(text.slice(at));
  return spans;
}

/** 去掉颜色码，读屏和复制用 */
export function plain(text: string): string {
  return text.replace(SGR, "");
}
