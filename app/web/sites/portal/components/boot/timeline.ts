// 开机动画专属的东西：时间轴常量、BIOS 风格日志文案、YUGC 气泡字母、粒子预算。
// 这些只在播放期间出现，播完就跟着开机动画一起淡出，和「晴空」画面（background.ts）分开。
import { clamp, easeOut, hash, TAU } from "./math";
import { GLYPH_WIDTHS, TL } from "./layout";
import { sparklePath, type RichPart } from "./shapes";

export { TL };

/**
 * 起步门停着的时候趁空闲预画的时间点（秒），一个阶段一帧：终端打字、解体与 HUD、公式打完后的扫描重组、
 * 闪光后的晴空、字标与徽章、标语打完加就绪气泡。
 * 画布文字第一次出现时，浏览器要给公式里的希腊字母和下标（θ、ε₀、ψ、ₙ、ħ）找回退字体，
 * 各阶段的绘制函数第一次执行也慢，贴图第一次上传同样；不预热的话它们落在播放途中，
 * 3.8 秒公式打到下标 n 时主线程停 50 到 160 毫秒，接着整张画面冻住约 1 秒（#292）。
 * 预热把这些首次开销挪到起步门停留的空闲时间里，到播放那一刻字体、字形和代码路径都已就绪。
 */
export const WARM_TIMES = [0.6, 2.7, 4.6, 5.6, 7.3, 9.5] as const;

type Glyph = { w: number; path: Path2D; colors: readonly [string, string, string] };

function glyphPath(build: (p: Path2D) => void): Path2D {
  const p = new Path2D();
  build(p);
  return p;
}

/** YUGC 四个字母的气泡形状与配色（SPEC §1 的 --os-y/-u/-g/-c）；Path2D 在第一次用到时才建，模块加载时不碰 DOM */
let glyphs: Record<"Y" | "U" | "G" | "C", Glyph> | null = null;
export function logoGlyphs(): Record<"Y" | "U" | "G" | "C", Glyph> {
  glyphs ??= {
    Y: { w: GLYPH_WIDTHS.Y, path: glyphPath((p) => { p.moveTo(0.16, 0.17); p.lineTo(0.46, 0.52); p.moveTo(0.76, 0.17); p.lineTo(0.46, 0.52); p.lineTo(0.46, 0.84); }), colors: ["#c8fdec", "#3fd0a5", "#1a9a7b"] },
    U: { w: GLYPH_WIDTHS.U, path: glyphPath((p) => { p.moveTo(0.16, 0.17); p.lineTo(0.16, 0.56); p.arc(0.44, 0.56, 0.28, Math.PI, 0, true); p.lineTo(0.72, 0.17); }), colors: ["#cdeaff", "#4aa6ff", "#2a6fd6"] },
    G: { w: GLYPH_WIDTHS.G, path: glyphPath((p) => { p.arc(0.5, 0.5, 0.34, -0.2 * Math.PI, 0, true); p.lineTo(0.58, 0.5); }), colors: ["#ffd7e9", "#ff83bb", "#dc4d93"] },
    C: { w: GLYPH_WIDTHS.C, path: glyphPath((p) => { p.arc(0.5, 0.5, 0.34, -0.27 * Math.PI, 0.27 * Math.PI, true); }), colors: ["#dcdfff", "#8b93ff", "#565de0"] },
  };
  return glyphs;
}

/** 一个气泡字母：描边堆叠出厚度，渐变上色，虚线高光 */
export function drawGlyphBubble(ctx: CanvasRenderingContext2D, glyph: Glyph, x: number, y: number, s: number, rot: number, scaleX: number, scaleY: number, alpha: number, dpr: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + (glyph.w * s) / 2, y + s);
  ctx.rotate(rot);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-(glyph.w * s) / 2, -s);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const base = 0.3;
  ctx.shadowColor = "rgba(50,100,190,.28)";
  ctx.shadowBlur = 16 * dpr;
  ctx.shadowOffsetY = 8 * dpr;
  ctx.strokeStyle = "#7fb0ea";
  ctx.lineWidth = base + 0.17;
  ctx.save();
  ctx.translate(0, 0.055);
  ctx.stroke(glyph.path);
  ctx.restore();
  ctx.shadowColor = "transparent";
  for (const d of [0.04, 0.025]) {
    ctx.save();
    ctx.translate(0, d);
    ctx.stroke(glyph.path);
    ctx.restore();
  }
  ctx.strokeStyle = "#fff";
  ctx.stroke(glyph.path);
  ctx.strokeStyle = glyph.colors[2];
  ctx.lineWidth = base + 0.05;
  ctx.stroke(glyph.path);
  const gradient = ctx.createLinearGradient(0, 0.12, 0, 0.9);
  gradient.addColorStop(0, glyph.colors[0]);
  gradient.addColorStop(1, glyph.colors[1]);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = base;
  ctx.stroke(glyph.path);
  ctx.translate(-0.035, -0.045);
  ctx.strokeStyle = "rgba(255,255,255,.85)";
  ctx.lineWidth = base * 0.24;
  ctx.setLineDash([0.2, 0.5]);
  ctx.stroke(glyph.path);
  ctx.restore();
}

/** 字母落地时溅开的四角星和小圆点 */
export function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, n: number, radius: number, seed: number): void {
  if (age < 0 || age > 0.9) return;
  const k = age / 0.9;
  const e = easeOut(k);
  ctx.save();
  ctx.globalAlpha = 1 - k;
  for (let j = 0; j < n; j++) {
    const angle = (j / n) * TAU + hash(seed * 7 + j) * 0.6;
    const d = radius * (0.35 + 0.65 * e) * (0.7 + 0.5 * hash(seed + j * 3));
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    ctx.fillStyle = j % 3 === 0 ? "#ff9fcf" : j % 3 === 1 ? "#ffffff" : "#8fd0ff";
    if (j % 2) sparklePath(ctx, px, py, radius * 0.09 * (1 - k * 0.6));
    else {
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.035 * (1 - k * 0.5), 0, TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}

export type DeviceInfo = { cores: number; memory: number; gpu: string; language: string; platform: string; screen: string; dpr: string };

/** 读真实设备信息（GPU 名、核心数等），只用于 BIOS 日志，拿不到就给默认值 */
export function readDeviceInfo(): DeviceInfo {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
  let gpu = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* 拿不到 GPU 信息时留空，日志照常显示 */
  }
  gpu = String(gpu || "Canvas2D")
    .replace(/^ANGLE \(/, "")
    .replace(/\)$/, "")
    .replace(/ANGLE Metal Renderer: /, "")
    .replace(/,?\s*Unspecified Version/, "")
    .replace(/\s*Direct3D.*$/, "")
    .replace(/\(0x[0-9a-f]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    cores: nav.hardwareConcurrency || 8,
    memory: nav.deviceMemory || 8,
    gpu,
    language: nav.language || "zh-CN",
    platform: nav.userAgentData?.platform || nav.platform || "web",
    screen: `${screen.width}×${screen.height}`,
    dpr: (window.devicePixelRatio || 1).toFixed(1),
  };
}

/** h 标题行、i 设备信息、a 动作（前面一个小三角）、k 带 [ OK ] 的服务行 */
export type BootLogLine = { kind: "h" | "a" | "k"; text: RichPart[] } | { kind: "i"; label: string; value: string };

/** BIOS 风格的开机日志，桌面版更长，手机版精简 */
export function buildBootLog(d: DeviceInfo, desktop: boolean): BootLogLine[] {
  const check = { shape: "check" } as const;
  if (desktop) {
    const gpu = d.gpu.slice(0, 46);
    return [
      { kind: "h", text: ["YUGC BIOS 6.1.0   (C) 2026 YUGC LABS   SECURE BOOT ", check] },
      { kind: "i", label: "CPU", value: `${d.cores} logical cores · ${d.platform}` },
      { kind: "i", label: "GPU", value: gpu },
      { kind: "i", label: "MEM", value: `${d.memory} GB · display ${d.screen} @${d.dpr}x · ${d.language}` },
      { kind: "a", text: ["loading kernel yugc-6.1.0-kawaii @ 0x7F3A9C00"] },
      { kind: "k", text: ["mounted /dev/heart0 (", { shape: "heart" }, "fs, rw)"] },
      { kind: "k", text: ["started sparkle-shader.service"] },
      { kind: "k", text: ["loaded module ahoge_physics.ko"] },
      { kind: "k", text: ["smile engine online · σ=10 ρ=28 β=8/3"] },
      { kind: "k", text: ["e^{iπ}+1=0 · ∇·E=ρ/ε₀ · ∮B·dl=μ₀I"] },
      { kind: "k", text: ["reached target cuteness.overdrive"] },
      { kind: "a", text: ["spawning MASCOT.exe · pid 0x0D1E …"] },
    ];
  }
  return [
    { kind: "h", text: ["YUGC BIOS 6.1.0 · SECURE BOOT ", check] },
    { kind: "i", label: "CPU", value: `${d.cores} cores · MEM ${d.memory} GB` },
    { kind: "i", label: "GPU", value: d.gpu.slice(0, 30) },
    { kind: "i", label: "DSP", value: `${d.screen} @${d.dpr}x` },
    { kind: "a", text: ["kernel yugc-6.1.0-kawaii"] },
    { kind: "k", text: ["mounted /dev/heart0"] },
    { kind: "k", text: ["sparkle-shader.service"] },
    { kind: "k", text: ["ahoge_physics.ko"] },
    { kind: "k", text: ["smile engine σ=10 ρ=28"] },
    { kind: "k", text: ["e^{iπ}+1=0 · ∇·E=ρ/ε₀"] },
    { kind: "k", text: ["target cuteness.overdrive"] },
    { kind: "a", text: ["spawning MASCOT.exe …"] },
  ];
}

/** 第 k 行开始显示的时间点 */
export function logLineTime(k: number): number {
  return 0.15 + k * 0.17;
}

/** boot.log 面板里随进度轮换的状态 */
export const LOADING_MESSAGES: RichPart[][] = [["mounting /dev/heart0"], ["loading kawaii.dll"], ["syncing ahoge.physics"], ["compiling sparkle.glsl"], ["warming up smile engine"], ["handshake with you ", { shape: "heart" }]];

/**
 * 粒子数量：原版按画面面积在 [0.5, 1.4] 倍之间缩放（桌面基数 14000、手机 7000）；
 * 这里再按核心数和像素比收一收——核心少的机器 CPU 逐粒子写像素吃力，3 倍屏整屏合成的开销更大。
 */
export function particleBudget({ mobile, width, height, dpr, cores }: { mobile: boolean; width: number; height: number; dpr: number; cores: number }): number {
  const base = mobile ? 7000 : 14000;
  const area = clamp((width * height) / (mobile ? 330000 : 1296000), 0.5, 1.4);
  const cpu = clamp(cores / 8, 0.5, 1);
  const pixels = dpr > 2 ? 0.8 : 1;
  return Math.round(base * area * cpu * pixels);
}
