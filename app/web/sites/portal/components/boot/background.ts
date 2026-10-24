// 「晴空」画面：天空渐变、白网格、云、心形与四角星、六边形描边、粉色 yugc_os.exe 窗口、坐在窗口上的极客娘。
// 这是开机动画最后一帧的构图（SPEC §1、§4.2）。开机动画（engine.ts）和桌面默认壁纸「晴空」共用这里的绘制函数，
// 同一时刻画出来的像素一样，开机动画淡出时底下的壁纸接得上。开机动画专属的东西（YUGC 字标、boot.log 面板、
// 彩带）在 engine.ts；公式小卡片也只在开机动画里画（makeDecor 生成，壁纸不画）。
// 绘制代码移植自 YUGC OS Boot v2（.tools/handoff/2026-10-23-yugc-os-v2/assets/），手调过的系数保持原样；
// 网格按 SPEC §1 的令牌统一成 48px、白色 55%。
import { clamp, easeBack, lerp, makeRng, smoothstep, TAU, hash } from "./math";
import { drawSegments, heartPath, hexagonPath, measureSegments, paint, roundRectPath, sparklePath, type RichPart } from "./shapes";

export const MONO = '"SF Mono","JetBrains Mono",Menlo,Consolas,"Liberation Mono","Courier New",monospace';
export const UI_FONT = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans SC","Hiragino Sans GB",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

/** 与 styles/portal.css 的 --os-* 令牌同值（canvas 读不到 CSS 变量，这里各写一份） */
export const SKY = {
  top: "#9fd6ff",
  mid: "#cfeaff",
  bottom: "#f4faff",
  grid: "rgba(255,255,255,.55)",
  gridGap: 48,
  heart: "#ffa9d2",
  winTop: "#ffdcec",
  winBottom: "#ffbad8",
  winBorder: "#f3a2c6",
  dots: ["#ff7fb3", "#ffd36e", "#6fe0b9"],
} as const;

export type Rect = { x: number; y: number; w: number; h: number };

/** 极客娘和她坐的窗口。girl 是贴图的绘制框，其余几个点都按贴图比例算出来 */
export type Figure = {
  land: boolean;
  girl: Rect;
  /** 坐下的位置（粉窗口顶边） */
  seat: number;
  chest: readonly [number, number];
  head: readonly [number, number];
  /** 粉色 yugc_os.exe 窗口 */
  win: Rect;
};

/** 贴图里的关键点（相对贴图框的比例）：坐下的位置、胸口、头顶 */
const POINTS = { seat: 0.61, chest: [0.5, 0.4], head: [0.53, 0.17] } as const;

export function figureAt(girl: Rect, land: boolean): Figure {
  const seat = girl.y + girl.h * POINTS.seat;
  return {
    land,
    girl,
    seat,
    chest: [girl.x + girl.w * POINTS.chest[0], girl.y + girl.h * POINTS.chest[1]],
    head: [girl.x + girl.w * POINTS.head[0], girl.y + girl.h * POINTS.head[1]],
    win: { x: girl.x - girl.w * 0.13, y: seat - girl.h * 0.006, w: girl.w * 1.26, h: girl.y + girl.h * 0.95 - seat + girl.h * 0.006 },
  };
}

/** 横屏构图：极客娘在 70% 宽处、底部对齐，高 86%，宽不超过 36% */
export function landGirl(w: number, h: number, aspect: number): Rect {
  let gh = h * 0.86;
  let gw = gh * aspect;
  if (gw > w * 0.36) {
    gw = w * 0.36;
    gh = gw / aspect;
  }
  return { x: w * 0.705 - gw / 2, y: h * 0.93 - 0.95 * gh, w: gw, h: gh };
}

/** 竖屏构图：在 [top, bottom] 这一段里居中摆下极客娘（贴图底部 5% 是留白），宽不超过 72% */
export function bandGirl(w: number, top: number, bottom: number, aspect: number): Rect {
  let gh = (bottom - top) / 0.95;
  let gw = gh * aspect;
  if (gw > w * 0.72) {
    gw = w * 0.72;
    gh = gw / aspect;
  }
  return { x: w / 2 - gw / 2, y: bottom - 0.95 * gh, w: gw, h: gh };
}

const FORMULAS: RichPart[][] = [["e^{iπ}+1=0"], ["∇·E = ρ/ε₀"], ["Σ 1/n² = π²/6"], ["0x59554743"], ["while(alive){ smile(); }"], ["f(", { shape: "heart" }, ") ", { shape: "arrow" }, " ∞"]];
const FORMULA_SPOTS = {
  land: [[0.04, 0.07], [0.4, 0.06], [0.96, 0.17], [0.03, 0.93], [0.42, 0.95], [0.97, 0.52]],
  portrait: [[0.04, 0.255], [0.96, 0.33], [0.04, 0.6], [0.96, 0.66]],
} as const;

type Floating = { x: number; y: number; s: number; phase: number; speed: number };
export type DecorItem =
  | (Floating & { kind: "glow" })
  | (Floating & { kind: "hex" })
  | (Floating & { kind: "spark" })
  | (Floating & { kind: "heart"; pink: boolean })
  | { kind: "chip"; x: number; y: number; parts: RichPart[]; phase: number };

/** 点缀物按画面面积定数量，种子固定：同一尺寸每次布局一样，开机动画和壁纸摆出来的位置也一样 */
export function makeDecor(w: number, h: number, land: boolean): DecorItem[] {
  const r = makeRng(1234567);
  const n = (k: number) => Math.round(k * clamp((w * h) / (1440 * 900), 0.35, 1.6)) + 3;
  const items: DecorItem[] = [];
  for (let i = 0; i < n(8); i++) items.push({ kind: "glow", x: r() * w, y: r() * h, s: (30 + r() * 110) * (land ? 1 : 0.6), phase: r() * TAU, speed: 0.2 + r() * 0.3 });
  for (let i = 0; i < n(10); i++) items.push({ kind: "hex", x: r() * w, y: r() * h, s: (10 + r() * 22) * (land ? 1 : 0.75), phase: r() * TAU, speed: (r() - 0.5) * 0.6 });
  for (let i = 0; i < n(14); i++) items.push({ kind: "heart", x: r() * w, y: r() * h, s: 9 + r() * 16, phase: r() * TAU, speed: 12 + r() * 22, pink: r() < 0.6 });
  for (let i = 0; i < n(26); i++) items.push({ kind: "spark", x: r() * w, y: r() * h, s: 3 + r() * 8, phase: r() * TAU, speed: 1.5 + r() * 2.5 });
  (land ? FORMULA_SPOTS.land : FORMULA_SPOTS.portrait).forEach(([fx, fy], i) => items.push({ kind: "chip", x: fx * w, y: fy * h, parts: FORMULAS[i % FORMULAS.length], phase: r() * TAU }));
  return items;
}

/** 天空渐变、极客娘身后的柔光、缓慢平移的白网格 */
export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, fig: Figure, t: number): void {
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, SKY.top);
  g.addColorStop(0.55, SKY.mid);
  g.addColorStop(1, SKY.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const [cx, cy] = fig.chest;
  const r = fig.girl.h * 0.75;
  g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, "rgba(255,255,255,.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const gs = SKY.gridGap;
  const o = (t * 10) % gs;
  ctx.strokeStyle = SKY.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -gs + o; x < w; x += gs) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = -gs + o * 0.6; y < h; y += gs) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawChip(ctx: CanvasRenderingContext2D, item: Extract<DecorItem, { kind: "chip" }>, t: number, alpha: number, w: number, land: boolean): void {
  const fs = land ? 13 : 10.5;
  const h = land ? 28 : 22;
  ctx.font = `600 ${fs}px ${MONO}`;
  const segs = paint(item.parts, "#4a86d8");
  const cw = measureSegments(ctx, segs, fs) + h * 0.9;
  const x = item.x < w / 2 ? item.x : item.x - cw;
  const y = item.y + Math.sin(t * 0.8 + item.phase) * 5 - h / 2;
  ctx.globalAlpha = alpha * 0.8;
  ctx.fillStyle = "rgba(255,255,255,.72)";
  roundRectPath(ctx, x, y, cw, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,180,255,.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  drawSegments(ctx, segs, x + h * 0.45, y + h / 2 + 0.5, fs);
}

/** shift 是跟手视差的偏移（点缀物按 2 倍反向移动）；chipAlpha 为 0 时不画公式小卡片 */
export function drawDecor(ctx: CanvasRenderingContext2D, items: readonly DecorItem[], t: number, alpha: number, w: number, h: number, land: boolean, shiftX = 0, shiftY = 0, chipAlpha = 0): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(-shiftX * 2, -shiftY * 2);
  for (const d of items) {
    if (d.kind === "glow") {
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(d.x, d.y + Math.sin(t * d.speed + d.phase) * 14, d.s, 0, TAU);
      ctx.fill();
    } else if (d.kind === "hex") {
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.2;
      hexagonPath(ctx, d.x + Math.sin(t * 0.5 + d.phase) * 8, d.y + Math.cos(t * 0.4 + d.phase) * 8, d.s, t * d.speed + d.phase);
      ctx.stroke();
    } else if (d.kind === "heart") {
      const y = ((((d.y - t * d.speed) % (h + 60)) + h + 60) % (h + 60)) - 30;
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = d.pink ? SKY.heart : "#ffffff";
      heartPath(ctx, d.x + Math.sin(t * 1.3 + d.phase) * 10, y, d.s, Math.sin(t + d.phase) * 0.3);
      ctx.fill();
    } else if (d.kind === "spark") {
      const tw = 0.5 + 0.5 * Math.sin(t * d.speed + d.phase);
      ctx.globalAlpha = alpha * tw;
      ctx.fillStyle = "#fff";
      sparklePath(ctx, d.x, d.y, d.s * (0.6 + 0.6 * tw));
      ctx.fill();
    } else if (chipAlpha > 0) {
      drawChip(ctx, d, t, alpha * chipAlpha, w, land);
    }
  }
  ctx.restore();
}

export function drawClouds(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, land: boolean, alpha: number, shiftX = 0): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(-shiftX, 0);
  const r = land ? 70 : 44;
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? "#ffffff" : "rgba(222,239,255,.96)";
    ctx.beginPath();
    for (let x = -r, i = 0; x < w + r * 2; x += r * 1.15, i++) {
      const q = r * (0.7 + 0.5 * hash(i * 3.1 + layer * 7));
      const y = h + r * 0.35 - (layer ? 0 : r * 0.45) + Math.sin(t * 0.6 + i) * 3;
      ctx.moveTo(x + q, y);
      ctx.arc(x, y, q, 0, TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}

/** 粉色 yugc_os.exe 窗口。pop 是弹出进度（开机动画里从 0 弹到 1，壁纸直接传 1） */
export function drawWindow(ctx: CanvasRenderingContext2D, r: Rect, dpr: number, pop = 1): void {
  if (pop <= 0) return;
  const s = easeBack(pop);
  const radius = Math.min(r.w, r.h) * 0.12;
  const cx = r.x + r.w / 2;
  const by = r.y + r.h;
  ctx.save();
  ctx.globalAlpha = clamp(pop * 3);
  ctx.translate(cx, by);
  ctx.scale(lerp(0.6, 1, s), s);
  ctx.translate(-cx, -by);
  ctx.shadowColor = "rgba(60,110,190,.3)";
  ctx.shadowBlur = 34 * dpr;
  ctx.shadowOffsetY = 14 * dpr;
  ctx.fillStyle = SKY.winBorder;
  roundRectPath(ctx, r.x, r.y + r.h * 0.05, r.w, r.h, radius);
  ctx.fill();
  ctx.shadowColor = "transparent";
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, SKY.winTop);
  g.addColorStop(1, SKY.winBottom);
  ctx.fillStyle = g;
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fill();
  ctx.lineWidth = Math.max(3, r.w * 0.012);
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  const tb = Math.min(r.h * 0.2, r.w * 0.075);
  ctx.save();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.clip();
  ctx.fillStyle = "rgba(255,150,200,.5)";
  ctx.fillRect(r.x, r.y, r.w, tb);
  ctx.fillStyle = "rgba(255,255,255,.6)";
  const sp = Math.max(12, tb * 0.7);
  for (let y = r.y + tb + sp * 0.6; y < r.y + r.h; y += sp) for (let x = r.x + sp * 0.6; x < r.x + r.w; x += sp) ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
  const dr = tb * 0.17;
  SKY.dots.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(r.x + tb * 0.6 + i * dr * 3.2, r.y + tb * 0.5, dr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  const fs = tb * 0.4;
  ctx.font = `800 ${fs}px ${MONO}`;
  const title = paint([{ shape: "heart" }, " yugc_os.exe"], "#fff");
  drawSegments(ctx, title, r.x + r.w - tb * 0.5 - measureSegments(ctx, title, fs), r.y + tb * 0.52, fs);
  ctx.restore();
}

export function drawSeatShadow(ctx: CanvasRenderingContext2D, fig: Figure, alpha: number): void {
  if (alpha <= 0) return;
  const g = fig.girl;
  ctx.save();
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillStyle = "#d3558f";
  ctx.beginPath();
  ctx.ellipse(g.x + g.w * 0.56, fig.seat + g.h * 0.008, g.w * 0.44, g.h * 0.016, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** 极客娘：坐在窗口上，breathe（0~1）是呼吸幅度，减少动态效果时传 0；hop 是 0~1 的小跳进度 */
export function drawGirl(ctx: CanvasRenderingContext2D, img: CanvasImageSource, fig: Figure, t: number, breathe: number, shiftX = 0, shiftY = 0, hop = -1): void {
  const g = fig.girl;
  let sx = 1 - breathe * 0.004 * Math.sin(t * 2.4);
  let sy = 1 + breathe * 0.007 * Math.sin(t * 2.4);
  let dy = 0;
  if (hop >= 0 && hop < 1) {
    dy = -Math.sin(Math.PI * hop) * g.h * 0.07;
    const q = hop < 0.15 ? Math.sin((hop / 0.15) * Math.PI) * 0.05 : hop > 0.85 ? Math.sin(((hop - 0.85) / 0.15) * Math.PI) * 0.06 : 0;
    sy *= 1 - q;
    sx *= 1 + q;
  }
  ctx.save();
  ctx.translate(g.x + g.w / 2 + shiftX, fig.seat + dy + shiftY);
  ctx.scale(sx, sy);
  ctx.drawImage(img, -g.w / 2, g.y - fig.seat, g.w, g.h);
  ctx.restore();
}

/** 极客娘头顶的对话气泡：t0 起弹出，dur 秒后淡出 */
export function drawBubble(ctx: CanvasRenderingContext2D, fig: Figure, text: string, t: number, t0: number, dur: number, w: number, dpr: number, shiftX = 0, shiftY = 0): void {
  const k = (t - t0) / 0.4;
  const a = clamp(k * 4) * (1 - smoothstep(dur - 0.35, dur, t - t0));
  if (a <= 0) return;
  const g = fig.girl;
  const fs = fig.land ? 16 : 12.5;
  ctx.save();
  ctx.font = `800 ${fs}px ${UI_FONT}`;
  const bw = ctx.measureText(text).width + fs * 1.6;
  const bh = fs * 2.3;
  const ax = fig.head[0] + g.w * 0.2 + shiftX;
  const ay = fig.head[1] - g.h * 0.05 + shiftY;
  const bx = Math.min(ax + 6, w - 10 - bw);
  const by = ay - bh - 8;
  const q = easeBack(k);
  ctx.globalAlpha = a;
  ctx.translate(ax, ay);
  ctx.scale(q, q);
  ctx.translate(-ax, -ay);
  ctx.shadowColor = "rgba(60,110,200,.25)";
  ctx.shadowBlur = 14 * dpr;
  ctx.shadowOffsetY = 4 * dpr;
  ctx.fillStyle = "#fff";
  roundRectPath(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.moveTo(bx + bh * 0.45, by + bh - 1);
  ctx.lineTo(ax, ay);
  ctx.lineTo(bx + bh * 0.95, by + bh - 1);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#8fc6ff";
  roundRectPath(ctx, bx, by, bw, bh, bh / 2);
  ctx.stroke();
  ctx.fillStyle = "#2f6fd8";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + fs * 0.8, by + bh / 2 + 1);
  ctx.restore();
}

/** 开机动画就绪后极客娘说的话；壁纸接着开机动画的时间轴把它说完 */
export const READY_LINE = "准备好了，点一下开始吧";
