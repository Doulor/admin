// 开机动画与晴空壁纸共用的纯数学工具：缓动、夹紧、哈希伪随机、打字机式文本裁切。
// 从 YUGC OS Boot v2（.tools/handoff/2026-10-23-yugc-os-v2/assets/YUGC_OS_Boot_Desktop_v2.html）整体移植，
// 算法与手调过的时间常数保持原样，只整理了命名和类型。

export const TAU = Math.PI * 2;

export function clamp(x: number, a = 0, b = 1): number {
  return x < a ? a : x > b ? b : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 平滑阶跃：x 在 [a,b] 外时是 0/1，中间按三次曲线过渡 */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - clamp(t), 3);
}

export function easeInOut(t: number): number {
  const v = clamp(t);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

export function easeBack(t: number): number {
  const v = clamp(t);
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2);
}

export function easeElastic(t: number): number {
  const v = clamp(t);
  if (v === 0 || v === 1) return v;
  return Math.pow(2, -9 * v) * Math.sin(((v * 9 - 0.75) * TAU) / 3) + 1;
}

/** 一维哈希，输出 [0,1)；确定性伪随机，同样的 n 永远给同样的值 */
export function hash(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** 带种子的伪随机数生成器（xorshift32），用于粒子与装饰物的可复现布局 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s >>>= 0;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/** 打字机效果：按 t/d 的进度裁出字符串前缀 */
export function typed(s: string, t: number, d: number): string {
  return s.slice(0, Math.ceil(s.length * clamp(t / d)));
}
