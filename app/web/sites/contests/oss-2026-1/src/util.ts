// 官网各段共用的小工具：转义、北京时间格式、动效开关、数字滚动、头像。
import { iconSvg } from "./icons";

export const TAU = Math.PI * 2;
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** 由字符串得到 0–1 的稳定伪随机数：同一个用户名每次取到同一个颜色。 */
export function hashUnit(text: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 可复现的伪随机序列（首屏热力图的深浅用）。 */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, ch => ESCAPES[ch]);

const reduceQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
export const reducedMotion = () => Boolean(reduceQuery?.matches);
export function onMotionChange(callback: () => void): void {
  reduceQuery?.addEventListener("change", callback);
}

export const isNarrow = () => innerWidth < 720;

const BEIJING = "Asia/Shanghai";
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING, month: "numeric", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const shortTime = new Intl.DateTimeFormat("zh-CN", { timeZone: BEIJING, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 「11 月 15 日」 */
export function formatDay(at: number): string {
  const parts = dateFormat.formatToParts(at);
  const month = parts.find(part => part.type === "month")?.value ?? "";
  const day = parts.find(part => part.type === "day")?.value ?? "";
  return `${month} 月 ${day} 日`;
}
/** 「11 月 15 日 23:59:59」 */
export const formatDayTime = (at: number) => `${formatDay(at)} ${timeFormat.format(at)}`;
/** 「23:59:59」 */
export const formatClock = (at: number) => timeFormat.format(at);
/** 「10-21」 */
export function formatShortDay(at: number): string {
  const parts = dateFormat.formatToParts(at);
  const month = parts.find(part => part.type === "month")?.value ?? "";
  const day = parts.find(part => part.type === "day")?.value ?? "";
  return `${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** 动态里的相对时间：刚刚、5 分钟前、3 小时前，超过一天写日期。 */
export function relativeTime(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`;
  return `${formatDay(at)} ${shortTime.format(at)}`;
}

export const formatPoints = (points: number) => (points > 0 ? `+${points}` : `${points}`);

/** 名次范围：「第 1 名」「第 2–3 名」 */
export const formatRanks = (from: number, to: number) => (from === to ? `第 ${from} 名` : `第 ${from}–${to} 名`);

export const TONES = ["violet", "pink", "amber", "lime", "sky"] as const;
/**
 * 头像：只用同源地址（`/api/identity/avatar/…`）。sandbox CSP 的 img-src 只放行 'self'，
 * GitHub 之类的外部头像加载不了，这时退回首字母头像，颜色按用户名在五个强调色里取。
 */
export function avatarHtml(person: { username: string; display_name: string; avatar_url: string | null }, className = "avatar"): string {
  const name = person.display_name || person.username;
  const initial = escapeHtml(Array.from(name.trim())[0]?.toUpperCase() ?? "?");
  const tone = TONES[Math.floor(hashUnit(person.username) * TONES.length)];
  if (person.avatar_url && person.avatar_url.startsWith("/") && !person.avatar_url.startsWith("//")) {
    return `<span class="${className} tone-${tone}" data-initial="${initial}"><img src="${escapeHtml(person.avatar_url)}" alt="" loading="lazy" decoding="async" /></span>`;
  }
  return `<span class="${className} tone-${tone}" data-initial="${initial}"><span>${initial}</span></span>`;
}

/** 头像图片加载失败时换成首字母（事件委托，挂一次）。 */
export function installAvatarFallback(): void {
  document.addEventListener("error", event => {
    const target = event.target;
    if (!(target instanceof HTMLImageElement) || !target.parentElement?.dataset.initial) return;
    const holder = target.parentElement;
    const span = document.createElement("span");
    span.textContent = holder.dataset.initial ?? "?";
    target.replaceWith(span);
  }, true);
}

/** 数字从旧值滚到新值；减少动态效果时直接换。 */
export function rollNumber(node: HTMLElement, to: number, duration = 900): void {
  const from = Number(node.dataset.value ?? to);
  node.dataset.value = String(to);
  if (from === to || reducedMotion()) {
    node.textContent = to.toLocaleString("zh-CN");
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = clamp((now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = Math.round(lerp(from, to, eased)).toLocaleString("zh-CN");
    if (t < 1 && node.dataset.value === String(to)) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const DATA_ERROR = "数据暂时取不到，稍后自动重试";
export const errorHtml = (text = DATA_ERROR) => `<p class="data-error" role="status">${iconSvg("error-warning-line")}${escapeHtml(text)}</p>`;
