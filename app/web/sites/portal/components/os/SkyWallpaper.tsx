// 默认壁纸「晴空」：开机动画最后一帧的画面，用开机动画同一组绘制函数（components/boot/background.ts）在 canvas 里接着画。
// 刚播完开机动画时拿开机动画的起点当时间零点，网格、云、点缀物、极客娘的呼吸和头顶那句话都从同一帧接上，
// 开机动画层淡出时看不出接缝；YUGC 字标、boot.log 面板、公式小卡片只属于开机动画，跟着它一起淡出。
// 手机竖屏上，开机动画层卸掉以后极客娘从开机动画里的位置滑到主屏幕图标下面、搜索框上面那一段，不压着图标；
// 横屏（电脑、手机横着拿）她坐在原位，只有 Dock 会挡住她坐的窗口时（比如 1024×768、1280×720）以头顶为准缩小，坐到 Dock 上面。
// 没播开机动画（今天播过）时直接画在最终位置；开了「减少动态效果」只画一帧，窗口大小变了再画。
import { useEffect, useRef } from "react";
import girlSrc from "../../assets/mascot/geek-girl.webp";
import { bandGirl, drawBubble, drawClouds, drawDecor, drawGirl, drawSeatShadow, drawSky, drawWindow, figureAt, makeDecor, READY_LINE, type DecorItem, type Figure, type Rect } from "../boot/background";
import { bootLayout, isLand, READY_BUBBLE } from "../boot/layout";
import { clamp, easeInOut, lerp } from "../boot/math";
import { useReducedMotion } from "../../lib/useReducedMotion";

/** 一段竖直区间（视口坐标）：手机竖屏主屏上是图标下沿到搜索框上沿；横屏是菜单栏或状态栏下沿到 Dock 上沿 */
export type SkyBand = { top: number; bottom: number };

export type SkyScene = {
  /** 刚播完的开机动画的起点（performance.now() 的秒数）；这次没播开机动画时为 null */
  epoch: number | null;
  /** 开机动画层已经卸掉，极客娘可以往主屏的位置滑了 */
  settled: boolean;
  /** 留给极客娘的一段（见 SkyBand）；没有时停在开机动画最后一帧的位置 */
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
 * 横屏：极客娘坐的窗口底边（贴图 95% 处）不低于 bottom、头顶不高于 top。放得下就是原来的位置；放不下以头顶为准缩小，
 * 水平中心不变，露出来的部分最矮 MIN_BAND。
 */
export function landFit(girl: Rect, top: number, bottom: number): Rect {
  const y = Math.max(girl.y, top);
  const gh = Math.min(girl.h, Math.max(MIN_BAND, bottom - y) / 0.95);
  if (y === girl.y && gh === girl.h) return girl;
  const gw = gh * (girl.w / girl.h);
  return { x: girl.x + girl.w / 2 - gw / 2, y, w: gw, h: gh };
}

/**
 * 这一刻极客娘在哪。没有区间时就是开机动画最后一帧的位置（components/boot/layout.ts 的 bootLayout）；有区间时 glide 从 0 到 1，
 * 从开机动画的位置滑到区间里：竖屏底边对齐区间下沿、水平居中，横屏按 landFit 只在放不下时缩小。
 */
export function skyFigure(w: number, h: number, aspect: number, insets: Insets, band: SkyBand | null, glide: number): Figure {
  const boot = bootLayout(w, h, aspect, insets.top, insets.bottom);
  if (!band) return boot.fig;
  const target = boot.land ? landFit(boot.fig.girl, band.top, band.bottom) : bandGirl(w, Math.min(band.top, band.bottom - MIN_BAND), band.bottom, aspect);
  return figureAt(lerpRect(boot.fig.girl, target, easeInOut(glide)), boot.land);
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

/**
 * 壁纸面板里「晴空」的缩略图：按这块屏幕的宽度画一帧再整体缩小，点缀物、线宽和极客娘的位置都和真桌面一样；手机竖屏传进主屏上
 * 留给极客娘的那一段（band），缩略图里她也在图标下面。按缩略图实际显示的大小画，面板换了尺寸就重画，放大了也不糊。
 */
export function SkyThumb({ width, height, band = null }: { width: number; height: number; band?: SkyBand | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let girl: HTMLImageElement | null = null;
    let cancelled = false;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width || width;
      const ch = rect.height || height;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      const vw = window.innerWidth || (cw > ch ? 1440 : 390);
      const vh = (vw * ch) / cw;
      // 缩略图和屏幕的高宽比不一定一样：区间按高度等比换算
      const k = vh / (window.innerHeight || vh);
      const zone = band && { top: band.top * k, bottom: band.bottom * k };
      const aspect = girl ? girl.naturalWidth / girl.naturalHeight || GIRL_ASPECT : GIRL_ASPECT;
      const fig = skyFigure(vw, vh, aspect, { top: 0, bottom: 0 }, zone, 1);
      paintSky(ctx, { w: vw, h: vh, dpr: (dpr * cw) / vw, t: 0, fig, decor: makeDecor(vw, vh, isLand(vw, vh)), girl, breathe: 0, bubble: false });
    };
    draw();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    void loadGirl().then((img) => {
      if (!img || cancelled) return;
      girl = img;
      draw();
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [width, height, band]);
  return <canvas ref={ref} className="pt-sky-thumb" width={width} height={height} aria-hidden="true" />;
}
