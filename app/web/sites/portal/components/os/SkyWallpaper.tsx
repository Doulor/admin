// 默认壁纸「晴空」：开机动画最后一帧的画面，用开机动画同一组绘制函数（components/boot/background.ts）在 canvas 里接着画。
// 刚播完开机动画时拿开机动画的起点当时间零点，网格、云、点缀物、极客娘的呼吸和头顶那句话都从同一帧接上，
// 开机动画层淡出时看不出接缝；YUGC 字标、boot.log 面板、公式小卡片只属于开机动画，跟着它一起淡出。
// 手机竖屏上，开机动画层卸掉以后极客娘从开机动画里的位置滑到主屏幕图标下面、搜索框上面那一段，不压着图标。
// 没播开机动画（今天播过）时直接画在最终位置；开了「减少动态效果」只画一帧，窗口大小变了再画。
import { useEffect, useRef } from "react";
import girlSrc from "../../assets/mascot/geek-girl.webp";
import { bandGirl, drawBubble, drawClouds, drawDecor, drawGirl, drawSeatShadow, drawSky, drawWindow, figureAt, makeDecor, READY_LINE, type DecorItem, type Figure, type Rect } from "../boot/background";
import { bootLayout, isLand, READY_BUBBLE } from "../boot/layout";
import { clamp, easeInOut, lerp } from "../boot/math";
import { useReducedMotion } from "../../lib/useReducedMotion";

/** 一段竖直区间（视口坐标）：手机主屏上图标下沿到搜索框上沿 */
export type SkyBand = { top: number; bottom: number };

export type SkyScene = {
  /** 刚播完的开机动画的起点（performance.now() 的秒数）；这次没播开机动画时为 null */
  epoch: number | null;
  /** 开机动画层已经卸掉，极客娘可以往主屏的位置滑了 */
  settled: boolean;
  /** 手机竖屏主屏上留给极客娘的一段；没有时停在开机动画最后一帧的位置 */
  band: SkyBand | null;
};

/** geek-girl.webp 是 883×1676；贴图解码前先按这个比例算构图 */
const GIRL_ASPECT = 883 / 1676;
const GLIDE_SECONDS = 0.9;
/** 区间太矮时极客娘至少这么高（会压到一点图标下沿） */
const MIN_BAND = 150;
/** 网格、云、点缀物动得很慢，平时 30fps 就够；滑动和说话期间按屏幕刷新率画 */
const IDLE_FRAME = 1 / 30;
/** 和开机动画一样，像素比最高按 2 算 */
const MAX_DPR = 2;

type Insets = { top: number; bottom: number };

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

/**
 * 这一刻极客娘在哪。横屏、没有主屏区间时就是开机动画最后一帧的位置（components/boot/layout.ts 的 bootLayout）；
 * 竖屏有区间时 glide 从 0 到 1，从开机动画的位置滑到区间里（底边对齐区间下沿，水平居中）。
 */
export function skyFigure(w: number, h: number, aspect: number, insets: Insets, band: SkyBand | null, glide: number): Figure {
  const boot = bootLayout(w, h, aspect, insets.top, insets.bottom);
  if (boot.land || !band) return boot.fig;
  const target = bandGirl(w, Math.min(band.top, band.bottom - MIN_BAND), band.bottom, aspect);
  return figureAt(lerpRect(boot.fig.girl, target, easeInOut(glide)), false);
}

type Frame = { w: number; h: number; dpr: number; t: number; fig: Figure; decor: readonly DecorItem[]; girl: CanvasImageSource | null; breathe: number; bubble: boolean };

/** 画一帧：天空、网格、点缀物（不画公式小卡片）、云、粉色窗口、极客娘，刚播完开机动画时再加她头顶那句话 */
function paintSky(ctx: CanvasRenderingContext2D, f: Frame): void {
  ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
  drawSky(ctx, f.w, f.h, f.fig, f.t);
  drawDecor(ctx, f.decor, f.t, 1, f.w, f.h, f.fig.land);
  drawClouds(ctx, f.t, f.w, f.h, f.fig.land, 1);
  drawWindow(ctx, f.fig.win, f.dpr);
  drawSeatShadow(ctx, f.fig, 1);
  if (f.girl) drawGirl(ctx, f.girl, f.fig, f.t, f.breathe);
  if (f.bubble) drawBubble(ctx, f.fig, READY_LINE, f.t, READY_BUBBLE.at, READY_BUBBLE.seconds, f.w, f.dpr);
}

/** 贴图在整个页面里只下载解码一次（开机动画已经下过同一个地址，命中缓存） */
let girlImage: Promise<HTMLImageElement | null> | null = null;
function loadGirl(): Promise<HTMLImageElement | null> {
  girlImage ??= (() => {
    const img = new Image();
    img.decoding = "async";
    img.src = girlSrc;
    return img.decode().then(
      () => img,
      () => {
        girlImage = null;
        return null;
      },
    );
  })();
  return girlImage;
}

export default function SkyWallpaper({ epoch, settled, band }: SkyScene) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const safeRef = useRef<HTMLSpanElement>(null);
  const still = useReducedMotion();
  const scene = useRef({ settled, band, still });
  scene.current = { settled, band, still };
  const wake = useRef<() => void>(() => undefined);
  // 时间零点只在挂载时定：重播开机动画会先卸掉整个桌面，播完重新挂
  const bootEpoch = useRef(epoch);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const now = () => performance.now() / 1000;
    const played = bootEpoch.current !== null;
    // 没播开机动画时零点放在很久以前：那句话早就说完了
    const zero = bootEpoch.current ?? now() - 60;
    let w = 1, h = 1, dpr = 1;
    let insets: Insets = { top: 0, bottom: 0 };
    let decor: DecorItem[] = [];
    let girl: HTMLImageElement | null = null;
    let aspect = GIRL_ASPECT;
    // 没播开机动画就不用滑：一开始就在主屏的位置
    let glideStart = played ? Infinity : -Infinity;
    let raf = 0;
    let last = -Infinity;
    let fast = true;
    let disposed = false;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const style = safeRef.current ? getComputedStyle(safeRef.current) : null;
      insets = { top: parseFloat(style?.paddingTop ?? "") || 0, bottom: parseFloat(style?.paddingBottom ?? "") || 0 };
      decor = makeDecor(w, h, isLand(w, h));
    };

    /** 画一帧；返回接下来是不是还在滑动或说话（要按刷新率画） */
    const paint = (at: number): boolean => {
      const { settled: gone, band: zone, still: frozen } = scene.current;
      if (gone && glideStart === Infinity) glideStart = frozen ? -Infinity : at;
      const glide = clamp((at - glideStart) / GLIDE_SECONDS);
      const t = at - zero;
      const talking = played && t < READY_BUBBLE.at + READY_BUBBLE.seconds;
      paintSky(ctx, { w, h, dpr, t, fig: skyFigure(w, h, aspect, insets, zone, glide), decor, girl, breathe: frozen ? 0 : 1, bubble: played && !frozen });
      return (glide > 0 && glide < 1) || talking;
    };

    const frame = () => {
      raf = 0;
      if (disposed) return;
      const at = now();
      if (scene.current.still) {
        paint(at);
        return;
      }
      if (fast || at - last >= IDLE_FRAME - 0.004) {
        fast = paint(at);
        last = at;
      }
      raf = requestAnimationFrame(frame);
    };
    const schedule = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(frame);
    };
    wake.current = () => {
      fast = true;
      schedule();
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        measure();
        wake.current();
      }, 120);
    };

    measure();
    paint(now());
    schedule();
    window.addEventListener("resize", onResize);
    void loadGirl().then((img) => {
      if (!img || disposed) return;
      girl = img;
      aspect = img.naturalWidth / img.naturalHeight || GIRL_ASPECT;
      wake.current();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // 开机动画层卸掉、主屏区间变了、动效偏好变了：减少动态效果时只靠这里重画
  useEffect(() => wake.current(), [settled, band?.top, band?.bottom, still]);

  return (
    <>
      <canvas ref={canvasRef} className="pt-sky" aria-hidden="true" />
      <span ref={safeRef} className="pt-sky-safe" aria-hidden="true" />
    </>
  );
}

/** 壁纸面板里「晴空」的缩略图：按一块常见屏幕的尺寸画一帧再整体缩小，点缀物和线宽的比例和真桌面一样 */
export function SkyThumb({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const vw = width > height ? 1440 : 390;
    const vh = (vw * height) / width;
    const scale = (dpr * width) / vw;
    let cancelled = false;
    const draw = (girl: HTMLImageElement | null) => {
      const aspect = girl ? girl.naturalWidth / girl.naturalHeight || GIRL_ASPECT : GIRL_ASPECT;
      const fig = skyFigure(vw, vh, aspect, { top: 0, bottom: 0 }, null, 1);
      paintSky(ctx, { w: vw, h: vh, dpr: scale, t: 0, fig, decor: makeDecor(vw, vh, isLand(vw, vh)), girl, breathe: 0, bubble: false });
    };
    draw(null);
    void loadGirl().then((img) => {
      if (img && !cancelled) draw(img);
    });
    return () => {
      cancelled = true;
    };
  }, [width, height]);
  return <canvas ref={ref} className="pt-sky-thumb" width={width} height={height} aria-hidden="true" />;
}
