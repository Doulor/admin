// 开机动画与晴空壁纸共用的矢量图形：圆角矩形、心形（替代 ♡）、四角星（替代 ✧）、六边形描边、勾选（替代 ✓）、
// 三角（替代 ▸ ▶）、箭头（替代 →）。路径函数只画路径，调用方自己 fill/stroke；drawSegments 画文字和这些图标的混排。
// 来源同 math.ts 的移植说明。

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 心形：替代 ♡。(x,y) 是底部顶点，s 是整体尺寸，rot 是弧度旋转 */
export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.45);
  ctx.bezierCurveTo(-s * 0.62, s * 0.05, -s * 0.46, -s * 0.52, 0, -s * 0.17);
  ctx.bezierCurveTo(s * 0.46, -s * 0.52, s * 0.62, s * 0.05, 0, s * 0.45);
  ctx.closePath();
  ctx.restore();
}

/** 四角闪光星：替代 ✧ */
export function sparklePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
}

export function hexagonPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * s;
    const py = y + Math.sin(a) * s;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/** 勾选：替代 ✓（用在「SECURE BOOT」「SYSTEM READY」后面） */
export function checkPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s * 0.36, y + s * 0.38);
  ctx.lineTo(x + s, y - s * 0.42);
}

/** 实心小三角：替代日志与 HUD 里的三角箭头字符 */
export function playPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.5);
  ctx.lineTo(x + s * 0.8, y);
  ctx.lineTo(x, y + s * 0.5);
  ctx.closePath();
}

/** 右箭头：替代公式里的箭头字符 */
export function arrowPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const head = w * 0.32;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.moveTo(x + w - head, y - head * 0.8);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - head, y + head * 0.8);
}

/** 混排文字里的矢量小图标（心形、勾选、三角、箭头），按字符一样参与打字机式逐字出现 */
export type InlineShape = "heart" | "check" | "play" | "arrow";
export type RichPart = string | { shape: InlineShape };
export type Segment = { text: string; color: string } | { shape: InlineShape; color: string };

/** 图标占的宽度（相对字号）：心形、勾选约一个汉字宽，三角约一个等宽字符宽 */
const SHAPE_ADVANCE: Record<InlineShape, number> = { heart: 0.95, check: 0.95, play: 0.62, arrow: 1.05 };

export function segmentsLength(segs: readonly Segment[]): number {
  return segs.reduce((sum, seg) => sum + ("text" in seg ? seg.text.length : 1), 0);
}

export function measureSegments(ctx: CanvasRenderingContext2D, segs: readonly Segment[], fs: number): number {
  return segs.reduce((sum, seg) => sum + ("text" in seg ? ctx.measureText(seg.text).width : SHAPE_ADVANCE[seg.shape] * fs), 0);
}

function drawShape(ctx: CanvasRenderingContext2D, shape: InlineShape, x: number, mid: number, fs: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (shape === "heart") {
    heartPath(ctx, x + fs * 0.47, mid + fs * 0.04, fs * 0.8);
    ctx.fill();
  } else if (shape === "check") {
    ctx.lineWidth = Math.max(1.5, fs * 0.13);
    checkPath(ctx, x + fs * 0.12, mid + fs * 0.02, fs * 0.68);
    ctx.stroke();
  } else if (shape === "play") {
    playPath(ctx, x + fs * 0.1, mid, fs * 0.5);
    ctx.fill();
  } else {
    ctx.lineWidth = Math.max(1.2, fs * 0.09);
    arrowPath(ctx, x + fs * 0.1, mid, fs * 0.82);
    ctx.stroke();
  }
  ctx.restore();
}

/** 从 x 开始画一行混排文字，mid 是文字的竖直中线；只画前 reveal 个「字」（图标算一个）。返回画到的末尾 x */
export function drawSegments(ctx: CanvasRenderingContext2D, segs: readonly Segment[], x: number, mid: number, fs: number, reveal = Infinity): number {
  let left = reveal;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const seg of segs) {
    if (left <= 0) break;
    if ("text" in seg) {
      const shown = seg.text.slice(0, left);
      left -= shown.length;
      ctx.fillStyle = seg.color;
      ctx.fillText(shown, x, mid);
      x += ctx.measureText(shown).width;
    } else {
      left -= 1;
      drawShape(ctx, seg.shape, x, mid, fs, seg.color);
      x += SHAPE_ADVANCE[seg.shape] * fs;
    }
  }
  return x;
}

/** 把 RichPart 列表统一上色成 Segment 列表 */
export function paint(parts: readonly RichPart[], color: string): Segment[] {
  return parts.map((part) => (typeof part === "string" ? { text: part, color } : { shape: part.shape, color }));
}

/** 取前 n 个「字」（图标算一个），打字机效果要先量出已出现部分的宽度时用 */
export function sliceSegments(segs: readonly Segment[], n: number): Segment[] {
  const out: Segment[] = [];
  let left = n;
  for (const seg of segs) {
    if (left <= 0) break;
    if ("text" in seg) {
      const text = seg.text.slice(0, left);
      left -= text.length;
      out.push({ text, color: seg.color });
    } else {
      left -= 1;
      out.push(seg);
    }
  }
  return out;
}
