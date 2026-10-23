// 开机动画的构图（极客娘、YUGC 字标、boot.log 面板、开机日志的位置）和时间轴。系数来自原版（见 math.ts 的移植说明）。
// 单独放一个文件，是因为桌面的「晴空」壁纸要知道开机动画最后一帧极客娘在哪、什么时候就绪，好从同一个位置、同一句话接上。
import { bandGirl, figureAt, landGirl, type Figure, type Rect } from "./background";
import { clamp } from "./math";

/** 时间轴（秒）：解体 → 粒子汇聚 → 扫描重组 → 闪光变身 → 窗口弹出 → 字标 → OS 徽章 → 标语 → 进度条 → 就绪 */
export const TL = { dis: 2.45, conv: 2.5, dur: 1.6, scan0: 4.3, scan1: 5.1, flash: 5.3, iris: 0.8, win: 5.4, logo: 5.85, os: 6.85, tag: 7.0, p0: 5.95, p1: 9.0, ready: 9.15 } as const;

/** 就绪后极客娘头顶那句话（background.ts 的 READY_LINE）什么时候冒出来、说多久；开机动画淡出后壁纸接着说完 */
export const READY_BUBBLE = { at: TL.ready + 0.2, seconds: 4.6 } as const;

/** 横屏构图的判定：宽高比大于 1.15 */
export function isLand(w: number, h: number): boolean {
  return w / h > 1.15;
}

/** YUGC 四个气泡字母各自的宽度（相对字高） */
export const GLYPH_WIDTHS = { Y: 0.92, U: 0.88, G: 1.0, C: 0.94 } as const;

export type TermLayout = { x: number; y: number; w: number; fontSize: number };
export type LogoLayout = { cx: number; cy: number; s: number; x0: number; x1: number; xs: number[] };
export type BootLayout = { land: boolean; fig: Figure; logo: LogoLayout; panel: Rect; term: TermLayout; maxR: number };

/** sat / sab 是安全区上下内边距（刘海、底部横条） */
export function bootLayout(w: number, h: number, aspect: number, sat = 0, sab = 0): BootLayout {
  const land = isLand(w, h);
  let girl: Rect;
  let logo: LogoLayout;
  let panel: Rect;
  let term: TermLayout;
  if (land) {
    girl = landGirl(w, h, aspect);
    logo = { cx: w * 0.285, cy: h * 0.3, s: Math.min(h * 0.165, w * 0.095), x0: 0, x1: 0, xs: [] };
    const pw = Math.min(w * 0.4, 600);
    const ph = Math.min(h * 0.2, 176);
    panel = { x: w * 0.285 - pw / 2, y: h * 0.56, w: pw, h: ph };
    term = { x: w * 0.055, y: h * 0.12, w: w * 0.46, fontSize: clamp(h * 0.0175, 11, 15.5) };
  } else {
    const ls = Math.min(w * 0.17, h * 0.085);
    logo = { cx: w * 0.47, cy: sat + h * 0.045 + ls * 0.62, s: ls, x0: 0, x1: 0, xs: [] };
    const ph = Math.min(h * 0.13, 112);
    const pw = w * 0.88;
    const py = h - sab - h * 0.035 - ph - 22;
    panel = { x: (w - pw) / 2, y: py, w: pw, h: ph };
    girl = bandGirl(w, logo.cy + ls * 0.95, py - h * 0.02, aspect);
    term = { x: w * 0.06, y: sat + h * 0.045, w: w * 0.88, fontSize: clamp(w * 0.029, 9.5, 12.5) };
  }
  const fig = figureAt(girl, land);
  const s = logo.s;
  const gap = -0.02 * s;
  let tw = -gap;
  for (const ch of "YUGC") tw += GLYPH_WIDTHS[ch as keyof typeof GLYPH_WIDTHS] * s + gap;
  const ox = logo.cx - tw / 2 - (land ? 0 : s * 0.18);
  let x = ox;
  for (const ch of "YUGC") {
    logo.xs.push(x);
    x += GLYPH_WIDTHS[ch as keyof typeof GLYPH_WIDTHS] * s + gap;
  }
  logo.x0 = ox;
  logo.x1 = x - gap;
  const [cx, cy] = fig.chest;
  return { land, fig, logo, panel, term, maxR: Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 40 };
}
