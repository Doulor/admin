// 宣传片窗口的纯逻辑（#284，tests/web/portal-promo-window.test.ts 覆盖）：要不要自动弹出、窗口多大放哪、窗口收起和露出时对视频做什么。
// 窗口怎么开、关、最小化、恢复用的是桌面已有的窗口管理（components/os/YugcOs.tsx），这里不另写一套。

export type PromoEntry = "open" | "mark_seen" | "none";

/**
 * 「加入我们」窗口挂上时要不要自动弹出宣传片窗口。条件和原来全屏播放层的一样（#77、#122）：
 * 这个浏览器没看过、也没开减少动态效果，就弹；开了减少动态效果不自动播，按看过算（只写 cookie，什么都不弹、不下载播放器）；看过了什么都不做。
 */
export function promoEntry({ seen, reducedMotion }: { seen: boolean; reducedMotion: boolean }): PromoEntry {
  if (seen) return "none";
  return reducedMotion ? "mark_seen" : "open";
}

/** 播放器自己的阶段：loading 还没出画面，playing 在播，buffering 播放中卡住，paused 被浏览器停下或自动播被拒 */
export type PromoPhase = "loading" | "playing" | "buffering" | "paused";

/**
 * 窗口收起（最小化；手机上被别的窗口盖住）和露出来时对视频做什么。
 * 收起时正在播（或卡在缓冲）的暂停，并记下是我们暂停的；还没出画面、已经被浏览器停下的不动。
 * 露出来时只恢复我们暂停的，从停下的位置接着播，不恢复别人停下的。
 */
export function visibilityStep(visible: boolean, phase: PromoPhase, pausedByHide: boolean): { act: "pause" | "play" | null; pausedByHide: boolean } {
  if (!visible) return phase === "playing" || phase === "buffering" ? { act: "pause", pausedByHide: true } : { act: null, pausedByHide };
  return pausedByHide ? { act: "play", pausedByHide: false } : { act: null, pausedByHide: false };
}

/** 窗口标题栏高度；画面 16:9；窗口顶边最高到菜单栏下面；Dock 连名字要让出的高度（styles/os.css 的 .pt-win max-height） */
const BAR = 44;
const TOP = 44;
const DOCK_ROOM = 120;
const MAX_WIDTH = 860;
const MIN_WIDTH = 320;

/**
 * 桌面上宣传片窗口的宽度：画面 16:9，高度要在窗口的 max-height（顶边到 Dock 上沿）里放得下，所以矮屏幕上窄一些，
 * 不然画面下半截会被窗口截掉。上限 860，屏幕窄时留 12px 边。
 */
export function promoWidth(viewport: { width: number; height: number }): number {
  const room = viewport.height - TOP - DOCK_ROOM - BAR;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, viewport.width - 24, Math.floor((room * 16) / 9)));
}

/** 顶边：照桌面窗口的层叠位置（wanted）放，放不下就往上提，直到整个窗口（标题栏加画面）落在 Dock 上沿以上 */
export function promoTop(viewport: { width: number; height: number }, wanted: number): number {
  const total = BAR + Math.round((promoWidth(viewport) * 9) / 16);
  return Math.max(TOP, Math.min(wanted, viewport.height - DOCK_ROOM - total));
}

/** 画面上的说明：播放器里两种播不了的情况，和播放器分包加载失败（components/PromoLazy.tsx 的 PromoUnavailable）说同样的话 */
export const PROMO_UNSUPPORTED = "这个浏览器放不了宣传片";
export const PROMO_FAILED = "宣传片没加载出来，关掉窗口再打开试试";
