// 开机动画引擎：Canvas2D，零依赖。移植自 YUGC OS Boot v2 标准页（.tools/handoff/2026-10-23-yugc-os-v2/assets/
// YUGC_OS_Boot_{Desktop,Mobile}_v2.html，两份文件唯一的差别是 window.MODE）。
// 时间轴：起步门 → BIOS 日志 → 文字解体成粒子 → 粒子汇聚成极客娘轮廓 → 扫描重组真实贴图 → 闪光切换到晴空 →
// 窗口弹出 → YUGC 字标逐字落地 → OS 徽章 → 标语 → boot.log 进度条 → 就绪（TL.ready ≈ 9.15 秒）。
// 和原版的差异：
//   - window.MODE 改成调用方按视口算好的 mobile；
//   - 右上角静音、重播和右下角跳过改成真实 DOM 按钮（BootSequence.tsx），起步门上盖一个透明按钮给键盘和读屏用；
//   - 就绪后不再停在原地互动：onReady 通知外壳转场进桌面，这里只把跟手视差收回到 0，让最后一帧和桌面壁纸对齐；
//   - 天空、网格、云、粉窗口、极客娘在 background.ts，和桌面「晴空」壁纸共用；
//   - 符号按 SPEC §1 换成矢量图形（shapes.ts），颜文字删掉，气泡改成平实中文；
//   - 粒子数量再按核心数和像素比收一收（timeline.ts 的 particleBudget）。
import { drawBubble, drawClouds, drawDecor, drawGirl, drawSeatShadow, drawSky, drawWindow, makeDecor, MONO, READY_LINE, UI_FONT, type DecorItem } from "./background";
import { bootLayout, READY_BUBBLE, type BootLayout, type TermLayout } from "./layout";
import { clamp, easeBack, easeElastic, easeInOut, easeOut, hash, lerp, makeRng, smoothstep, TAU } from "./math";
import { drawSegments, heartPath, measureSegments, paint, roundRectPath, segmentsLength, sliceSegments, sparklePath, type Segment } from "./shapes";
import { buildBootLog, drawBurst, drawGlyphBubble, LOADING_MESSAGES, logLineTime, logoGlyphs, particleBudget, readDeviceInfo, TL, WARM_TIMES } from "./timeline";

/** gate 等起步；dark 深色 BIOS 段；light 闪光之后的晴空段；ready 就绪 */
export type BootPhase = "gate" | "dark" | "light" | "ready";
/** epoch 是时间轴零点（performance.now() 秒）；跳过时会被挪到让「现在」正好是就绪的位置 */
export type BootReady = { epoch: number; skipped: boolean };

export type BootEngineOptions = {
  /** 视口判定出的手机模式（宽 < 768 或竖屏），创建时定好，播放期间不跟着旋转屏幕变 */
  mobile: boolean;
  girlSrc: string;
  muted: boolean;
  /** 安全区上下内边距（刘海、底部横条） */
  insets: () => { top: number; bottom: number };
  onStart: () => void;
  onPhase: (phase: BootPhase) => void;
  /** 第一次到达就绪（自然播完或跳过）时触发一次 */
  onReady: (info: BootReady) => void;
};

export type BootEngine = {
  start(): void;
  /** 手机长按起步：按下开始计时，按满 0.7 秒自动 start() */
  beginHold(): void;
  endHold(): void;
  skip(): void;
  replay(): void;
  toggleMute(): boolean;
  dispose(): void;
};

const HOLD_SECONDS = 0.7;

function makeOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}

/** 抬头显示里的两行公式，3.0 与 3.4 秒起逐字打出来 */
const HUD_FORMULAS = ["r(θ) = r₀·e^{−kθ}·(1 + ε·cos 3θ)", "ψ(x,t) = Σ cₙ φₙ(x) e^{−iEₙt/ħ}"] as const;
const HUD_FORMULA_COLOR = "rgba(170,220,255,.92)";
const hudFormulaSize = (land: boolean) => (land ? 13 : 11);

/**
 * 一行文字预先画成位图，并记下每个前缀的宽度，逐字打出来时按前缀宽度裁一块贴上去。
 * 公式里的下标 ₙ（U+2099）不在等宽字体里，每次 fillText 都要找回退字体：3.8 秒打到它时主线程停 50 到 160 毫秒、
 * 画面再冻住约 1 秒，而回退字体的缓存不可靠（预热过也会在几秒后失效）。位图在起步门时画好，播放途中不再碰字体（#292）。
 */
type TextSheet = { canvas: HTMLCanvasElement; widths: number[]; height: number };

function makeTextSheet(text: string, font: string, fontSize: number, color: string, dpr: number): TextSheet {
  const measure = makeOffscreen(1, 1).getContext("2d")!;
  measure.font = font;
  const widths = [0];
  for (let i = 1; i <= text.length; i++) widths.push(measure.measureText(text.slice(0, i)).width);
  const height = Math.ceil(fontSize * 1.8);
  const sheet = makeOffscreen(Math.ceil((widths[text.length] + 4) * dpr), Math.ceil(height * dpr));
  const g = sheet.getContext("2d")!;
  g.scale(dpr, dpr);
  g.font = font;
  g.fillStyle = color;
  g.textBaseline = "middle";
  g.fillText(text, 0, height / 2);
  return { canvas: sheet, widths, height };
}

export function createBootEngine(canvas: HTMLCanvasElement, opts: BootEngineOptions): BootEngine {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas2D 不可用");
  const ctx: CanvasRenderingContext2D = context;
  const { mobile } = opts;
  const desktop = !mobile;
  const device = readDeviceInfo();
  const bootLog = buildBootLog(device, desktop);
  const glyphs = logoGlyphs();

  let W = 1, H = 1, DPR = 1, SAT = 0, SAB = 0;
  let L: BootLayout | null = null;
  let decor: DecorItem[] = [];

  const img = new Image();
  let imgReady = false;
  let aspect = 0.527;
  let disposed = false;

  function layout(): void {
    L = bootLayout(W, H, aspect, SAT, SAB);
    decor = makeDecor(W, H, L.land);
  }

  // ── 开机日志：逐行打字，粒子从这些文字像素里出生 ──
  function termSegments(k: number, t0: number): Segment[] {
    const line = bootLog[k];
    const segs: Segment[] = [];
    if (desktop) segs.push({ text: `[${(t0 * 1.7 + 0.0012 * k).toFixed(6)}] `, color: "#3d67a3" });
    if (line.kind === "h") segs.push(...paint(line.text, "#ffffff"));
    else if (line.kind === "i") segs.push({ text: line.label.padEnd(5, " "), color: "#6fb0ff" }, { text: line.value, color: "#d6ebff" });
    else if (line.kind === "a") segs.push({ shape: "play", color: "#ff8fd0" }, { text: " ", color: "#ff8fd0" }, ...paint(line.text, "#a8dcff"));
    else segs.push({ text: "[ ", color: "#5b7fb5" }, { text: "OK", color: "#5ef2c2" }, { text: " ] ", color: "#5b7fb5" }, ...paint(line.text, "#cfe6ff"));
    return segs;
  }

  function drawTermLines(target: CanvasRenderingContext2D, term: TermLayout, T: number, alpha: number): void {
    const fs = term.fontSize;
    const lh = fs * 1.62;
    target.save();
    target.globalAlpha = alpha;
    target.font = `500 ${fs}px ${MONO}`;
    let y = term.y;
    let last: [number, number] | null = null;
    for (let k = 0; k < bootLog.length; k++) {
      const t0 = logLineTime(k);
      if (T < t0) break;
      const segs = termSegments(k, t0);
      const x = drawSegments(target, segs, term.x, y + fs / 2, fs, Math.ceil(segmentsLength(segs) * clamp((T - t0) / 0.14)));
      last = [x, y];
      y += lh;
    }
    if (last && T < TL.dis && (T * 2.5) % 1 < 0.6) {
      target.fillStyle = "#9fd4ff";
      target.fillRect(last[0] + 2, last[1], fs * 0.6, fs * 1.05);
    }
    target.restore();
  }

  // ── 粒子：终端文字像素裂解，汇聚成极客娘轮廓 ──
  const PARTICLE_SCALE = desktop ? 1.5 : 1.3;
  let particleCount = 0;
  let P: { sx: Float32Array; sy: Float32Array; ty: Float32Array; a0: Float32Array; r0: Float32Array; r1: Float32Array; dA: Float32Array; delay: Float32Array; rn: Float32Array; sc: Uint8Array; tc: Uint8Array } | null = null;
  let pBuf: HTMLCanvasElement | null = null;
  let pCtx: CanvasRenderingContext2D | null = null;
  let pImage: ImageData | null = null;
  let bloom: HTMLCanvasElement | null = null;
  let bloomCtx: CanvasRenderingContext2D | null = null;
  let hudSheets: TextSheet[] | null = null;
  let bw = 1, bh = 1;
  let holo: HTMLCanvasElement | null = null;

  function prep(): void {
    if (!L || !imgReady) return;
    const M = L.fig.girl;
    const hw = Math.round(M.w * DPR), hh = Math.round(M.h * DPR);
    holo = makeOffscreen(hw, hh);
    const h = holo.getContext("2d")!;
    h.drawImage(img, 0, 0, hw, hh);
    h.globalCompositeOperation = "source-atop";
    const g = h.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, "rgba(130,230,255,.9)");
    g.addColorStop(1, "rgba(60,110,255,.9)");
    h.fillStyle = g;
    h.fillRect(0, 0, hw, hh);
    h.globalCompositeOperation = "destination-out";
    h.fillStyle = "rgba(0,0,0,.5)";
    for (let y = 0; y < hh; y += 3 * DPR) h.fillRect(0, y, hw, DPR);

    const sw = desktop ? 240 : 170;
    const sh = Math.round((sw * M.h) / M.w);
    const s = makeOffscreen(sw, sh).getContext("2d", { willReadFrequently: true })!;
    s.drawImage(img, 0, 0, sw, sh);
    const sd = s.getImageData(0, 0, sw, sh).data;
    const cand: number[] = [];
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (sd[(y * sw + x) * 4 + 3] > 160) cand.push(y * sw + x);
    const r = makeRng(99);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = (r() * (i + 1)) | 0;
      const t = cand[i];
      cand[i] = cand[j];
      cand[j] = t;
    }
    particleCount = Math.min(cand.length, particleBudget({ mobile, width: W, height: H, dpr: window.devicePixelRatio || 1, cores: device.cores }));

    const term = L.term;
    const ox = term.x - 24, oy = term.y - 12;
    const tw = Math.ceil(Math.min(W - ox, term.w + 80));
    const th = Math.ceil(bootLog.length * term.fontSize * 1.62 + 30);
    const t = makeOffscreen(tw, th).getContext("2d", { willReadFrequently: true })!;
    t.translate(-ox, -oy);
    drawTermLines(t, term, 99, 1);
    const td = t.getImageData(0, 0, tw, th).data;
    const tp: number[] = [];
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = (y * tw + x) * 4;
      if (td[i + 3] > 110) tp.push(x + ox, y + oy, td[i], td[i + 1], td[i + 2]);
    }
    const ntp = tp.length / 5;
    const [cx, cy] = L.fig.chest;
    const F = (n: number) => new Float32Array(n);
    const n = particleCount;
    const next = { sx: F(n), sy: F(n), ty: F(n), a0: F(n), r0: F(n), r1: F(n), dA: F(n), delay: F(n), rn: F(n), sc: new Uint8Array(n * 3), tc: new Uint8Array(n * 3) };
    for (let i = 0; i < n; i++) {
      const id = cand[i];
      const px = id % sw, py = (id / sw) | 0;
      const tx = M.x + ((px + 0.5) / sw) * M.w, ty = M.y + ((py + 0.5) / sh) * M.h;
      let sx: number, sy: number;
      let c0 = [150, 205, 255];
      if (ntp) {
        const k = ((hash(i * 0.731 + 0.1) * ntp) | 0) * 5;
        sx = tp[k];
        sy = tp[k + 1];
        c0 = [tp[k + 2], tp[k + 3], tp[k + 4]];
      } else {
        sx = term.x + hash(i) * term.w;
        sy = term.y + hash(i * 3.7) * bootLog.length * term.fontSize * 1.6;
      }
      const a0 = Math.atan2(sy - cy, sx - cx), a1 = Math.atan2(ty - cy, tx - cx), rn = hash(i * 1.37 + 0.5);
      let da = a1 - a0;
      da = ((da % TAU) + TAU) % TAU;
      next.sx[i] = sx;
      next.sy[i] = sy;
      next.ty[i] = ty;
      next.a0[i] = a0;
      next.r0[i] = Math.hypot(sx - cx, sy - cy);
      next.r1[i] = Math.hypot(tx - cx, ty - cy);
      next.dA[i] = rn < 0.3 ? da - TAU * 2 : da + TAU;
      next.rn[i] = rn;
      next.delay[i] = (py / sh) * 0.4 + hash(i * 2.11) * 0.15;
      const j = id * 4;
      for (let q = 0; q < 3; q++) {
        next.sc[i * 3 + q] = c0[q];
        next.tc[i * 3 + q] = Math.min(255, 50 + sd[j + q] * 0.85);
      }
    }
    P = next;
    bw = Math.ceil(W / PARTICLE_SCALE);
    bh = Math.ceil(H / PARTICLE_SCALE);
    pBuf = makeOffscreen(bw, bh);
    pCtx = pBuf.getContext("2d")!;
    pImage = pCtx.createImageData(bw, bh);
    bloom = makeOffscreen(Math.ceil(bw / 5), Math.ceil(bh / 5));
    bloomCtx = bloom.getContext("2d")!;
    const hudFont = hudFormulaSize(L.land);
    hudSheets = HUD_FORMULAS.map((text) => makeTextSheet(text, `500 ${hudFont}px ${MONO}`, hudFont, HUD_FORMULA_COLOR, DPR));
  }

  // ── 深色世界（日志 → 解体 → 粒子汇聚 → 扫描重组）──
  function drawDarkBG(T: number): void {
    if (!L) return;
    ctx.fillStyle = "#030914";
    ctx.fillRect(0, 0, W, H);
    const [cx, cy] = L.fig.chest;
    const R = Math.max(W, H) * 0.75;
    const glow = 0.3 + 0.45 * smoothstep(2.4, 5.2, T);
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, `rgba(20,70,165,${glow})`);
    g.addColorStop(1, "rgba(3,9,20,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const hy = H * (L.land ? 0.62 : 0.68), vx = L.land ? W * 0.6 : W / 2, a = 0.2 + 0.25 * smoothstep(2.4, 5, T);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, W, H - hy);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(80,160,255,${a})`;
    ctx.beginPath();
    for (let i = -16; i <= 16; i++) {
      ctx.moveTo(vx + i * W * 0.012, hy);
      ctx.lineTo(vx + i * W * 0.17, H);
    }
    ctx.stroke();
    for (let j = 0; j < 14; j++) {
      const z = ((j + T * 0.9) % 14) / 14, y = hy + (H - hy) * z * z;
      ctx.strokeStyle = `rgba(80,160,255,${a * z * 1.5})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
    g = ctx.createLinearGradient(0, hy - 1, 0, hy + 30);
    g.addColorStop(0, `rgba(130,205,255,${a * 0.9})`);
    g.addColorStop(1, "rgba(130,205,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - 1, W, 31);
  }

  let scanPattern: CanvasPattern | null = null;
  function drawCRT(alpha: number): void {
    if (!scanPattern) {
      const c = makeOffscreen(4, 4);
      const g = c.getContext("2d")!;
      g.fillStyle = "rgba(0,0,0,.24)";
      g.fillRect(0, 0, 4, 1);
      g.fillStyle = "rgba(120,190,255,.04)";
      g.fillRect(0, 2, 4, 1);
      scanPattern = ctx.createPattern(c, "repeat");
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    if (scanPattern) {
      ctx.fillStyle = scanPattern;
      ctx.fillRect(0, 0, W, H);
    }
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawTermFrame(alpha: number): void {
    if (!L || !L.land) return;
    const r = L.term, w = r.w + 30, h = bootLog.length * r.fontSize * 1.62 + 58, x = r.x - 16, y = r.y - 42;
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fillStyle = "rgba(20,50,105,.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(110,180,255,.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 28);
    ctx.lineTo(x + w, y + 28);
    ctx.stroke();
    ["#ff7fb3", "#ffd36e", "#6fe0b9"].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + 16 + i * 14, y + 14, 4, 0, TAU);
      ctx.fill();
    });
    ctx.font = `600 12px ${MONO}`;
    ctx.fillStyle = "#6f9ad6";
    ctx.textBaseline = "middle";
    ctx.fillText("tty1 — root@yugc:~# boot --verbose --kawaii", x + 62, y + 14.5);
    ctx.restore();
  }

  function scanY(T: number): number {
    if (!L) return 0;
    const M = L.fig.girl;
    return M.y + M.h * 1.02 * easeInOut((T - TL.scan0) / (TL.scan1 - TL.scan0));
  }

  function drawParticles(T: number): void {
    if (!particleCount || !P || !pImage || !pCtx || !pBuf || !L || T < TL.dis || T > TL.scan1 + 0.3) return;
    const data = pImage.data;
    data.fill(0);
    const [cx, cy] = L.fig.chest;
    const scy = T > TL.scan0 ? scanY(T) : -1e9;
    const fin = clamp((T - TL.dis) / 0.18);
    const fade = H * 0.05;
    const { sx, sy, ty, a0, r0, r1, dA, delay, rn, sc, tc } = P;
    for (let i = 0; i < particleCount; i++) {
      const u = clamp((T - TL.conv - delay[i]) / TL.dur);
      let x: number, y: number, b: number;
      if (u <= 0) {
        x = sx[i];
        y = sy[i];
        b = 0.85 * fin;
      } else {
        const e = easeInOut(u), er = easeOut(u), a = a0[i] + dA[i] * e, s = Math.sin(Math.PI * e);
        const R = lerp(r0[i], r1[i], er) * (1 + 0.16 * s * Math.sin(3 * a + T * 2.4 + rn[i] * 6));
        x = cx + R * Math.cos(a);
        y = cy + R * Math.sin(a);
        b = 0.7 + 0.8 * s;
      }
      if (ty[i] < scy) {
        const f = 1 - (scy - ty[i]) / fade;
        if (f <= 0) continue;
        b *= f;
      }
      const px = (x / PARTICLE_SCALE) | 0, py = (y / PARTICLE_SCALE) | 0;
      if (px < 0 || py < 0 || px >= bw - 1 || py >= bh - 1) continue;
      const i3 = i * 3, cyan = rn[i] < 0.5, m0 = cyan ? 90 : 175, m1 = cyan ? 225 : 150;
      let R: number, G: number, B: number;
      if (u < 0.5) {
        const k = u * 2;
        R = lerp(sc[i3], m0, k);
        G = lerp(sc[i3 + 1], m1, k);
        B = lerp(sc[i3 + 2], 255, k);
      } else {
        const k = (u - 0.5) * 2;
        R = lerp(m0, tc[i3], k);
        G = lerp(m1, tc[i3 + 1], k);
        B = lerp(255, tc[i3 + 2], k);
      }
      R *= b;
      G *= b;
      B *= b;
      let j = (py * bw + px) * 4;
      data[j] += R;
      data[j + 1] += G;
      data[j + 2] += B;
      data[j + 3] = 255;
      if (u > 0 && u < 0.85) {
        R *= 0.5;
        G *= 0.5;
        B *= 0.5;
        j += 4;
        data[j] += R;
        data[j + 1] += G;
        data[j + 2] += B;
        data[j + 3] = 255;
        j += bw * 4 - 4;
        data[j] += R;
        data[j + 1] += G;
        data[j + 2] += B;
        data[j + 3] = 255;
      }
    }
    pCtx.putImageData(pImage, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(pBuf, 0, 0, W, H);
    if (bloomCtx && bloom) {
      bloomCtx.clearRect(0, 0, bloom.width, bloom.height);
      bloomCtx.drawImage(pBuf, 0, 0, bloom.width, bloom.height);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(bloom, 0, 0, W, H);
    }
    ctx.restore();
  }

  function drawReveal(T: number): void {
    if (!L || T < TL.scan0 || !imgReady || !holo) return;
    const M = L.fig.girl, sy = scanY(T), done = T >= TL.scan1;
    ctx.save();
    if (!done) {
      ctx.beginPath();
      ctx.rect(0, 0, W, sy);
      ctx.clip();
    }
    ctx.drawImage(img, M.x, M.y, M.w, M.h);
    const ha = clamp(1 - (T - TL.scan1) / 0.35) * 0.75;
    if (ha > 0) {
      ctx.globalAlpha = ha;
      ctx.drawImage(holo, M.x, M.y, M.w, M.h);
      ctx.globalAlpha = 1;
    }
    if (T < TL.flash) {
      const fr = Math.floor(T * 24);
      if (hash(fr) > 0.55)
        for (let j = 0; j < 3; j++) {
          const yy = M.y + hash(fr * 3.1 + j) * M.h, hh = 3 + hash(fr * 5.7 + j) * M.h * 0.025, dx = (hash(fr * 9.3 + j) - 0.5) * M.w * 0.08;
          if (yy > sy) continue;
          ctx.drawImage(holo, 0, ((yy - M.y) / M.h) * holo.height, holo.width, (hh / M.h) * holo.height, M.x + dx, yy, M.w, hh);
        }
    }
    ctx.restore();
    if (!done) {
      const g = ctx.createLinearGradient(0, sy - 26, 0, sy + 2);
      g.addColorStop(0, "rgba(120,220,255,0)");
      g.addColorStop(1, "rgba(160,235,255,.75)");
      ctx.fillStyle = g;
      ctx.fillRect(M.x - M.w * 0.15, sy - 26, M.w * 1.3, 28);
      ctx.fillStyle = "#e8fbff";
      ctx.fillRect(M.x - M.w * 0.22, sy - 1, M.w * 1.44, 2);
    }
  }

  const hudTitle: Segment[] = [{ shape: "play", color: "#9fd8ff" }, { text: " MASCOT.EXE // MATERIALIZING", color: "#9fd8ff" }];
  function drawHUD(T: number): void {
    if (!L) return;
    const a = smoothstep(2.55, 2.95, T) * (1 - smoothstep(5.15, 5.4, T));
    if (a <= 0) return;
    const M = L.fig.girl, p = M.w * 0.1, x0 = M.x - p, y0 = M.y - p * 0.6, x1 = M.x + M.w + p, y1 = Math.min(H - 8, M.y + M.h + p * 0.3);
    const cl = Math.min(40, M.w * 0.12) * easeOut((T - 2.55) / 0.5);
    const c = ctx;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = "#7fd0ff";
    c.lineWidth = 2;
    c.beginPath();
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
      c.moveTo(x + sx * cl, y);
      c.lineTo(x, y);
      c.lineTo(x, y + sy * cl);
    }
    c.stroke();
    const fs = L.land ? 12 : 10;
    c.font = `600 ${fs}px ${MONO}`;
    drawSegments(c, hudTitle, x0, y0 - 6 - fs / 2, fs, Math.ceil(segmentsLength(hudTitle) * clamp((T - 2.7) / 1.1)));
    c.fillStyle = "#9fd8ff";
    c.textBaseline = "bottom";
    c.textAlign = "right";
    c.fillText(`VOXELS ${particleCount} · SYNC ${Math.round(clamp((T - 2.5) / (TL.scan1 - 2.5)) * 100)}%`, x1 - 8, y1 - 8);
    c.textAlign = "left";
    const [cx, cy] = L.fig.chest, R1 = M.w * 0.62;
    c.lineWidth = 1.5;
    c.strokeStyle = "rgba(127,208,255,.55)";
    c.setLineDash([6, 10]);
    c.beginPath();
    c.arc(cx, cy, R1, T * 0.8, T * 0.8 + TAU * 0.8);
    c.stroke();
    c.setLineDash([2, 6]);
    c.beginPath();
    c.arc(cx, cy, R1 * 1.12, -T * 0.6, -T * 0.6 + TAU * 0.6);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    for (let i = 0; i < 36; i++) {
      const an = (i / 36) * TAU + T * 0.2, q0 = R1 * 1.2, q1 = q0 + (i % 3 ? 5 : 11);
      c.moveTo(cx + Math.cos(an) * q0, cy + Math.sin(an) * q0);
      c.lineTo(cx + Math.cos(an) * q1, cy + Math.sin(an) * q1);
    }
    c.stroke();
    const typed = (text: string, t: number) => Math.ceil(text.length * clamp(t));
    const [k1, k2] = [typed(HUD_FORMULAS[0], T - 3.0), typed(HUD_FORMULAS[1], T - 3.4)];
    if (L.land) {
      typedFormula(0, k1, x0 - 28, cy - 12, true);
      typedFormula(1, k2, x0 - 28, cy + 12, true);
    } else {
      typedFormula(0, k1, x0, y0 - 44, false);
      typedFormula(1, k2, x0, y0 - 27, false);
    }
    c.restore();
  }

  /** 公式第 i 行打出前 k 个字：有预画的位图就按前缀宽度裁一块贴上去（对齐到设备像素，和直接写字一样清晰）；图还没载入时直接写字 */
  function typedFormula(i: 0 | 1, k: number, x: number, y: number, alignRight: boolean): void {
    if (k <= 0) return;
    const sheet = hudSheets?.[i];
    if (!sheet) {
      ctx.font = `500 ${hudFormulaSize(L!.land)}px ${MONO}`;
      ctx.fillStyle = HUD_FORMULA_COLOR;
      ctx.textBaseline = "middle";
      ctx.textAlign = alignRight ? "right" : "left";
      ctx.fillText(HUD_FORMULAS[i].slice(0, k), x, y);
      ctx.textAlign = "left";
      return;
    }
    const sw = Math.round(sheet.widths[k] * DPR), sh = Math.round(sheet.height * DPR);
    if (sw <= 0) return;
    const w = sw / DPR;
    ctx.drawImage(sheet.canvas, 0, 0, sw, sh, Math.round((alignRight ? x - w : x) * DPR) / DPR, Math.round((y - sheet.height / 2) * DPR) / DPR, w, sh / DPR);
  }

  // ── 闪光之后 ──
  function speedLines(T: number): void {
    if (!L) return;
    const k = (T - TL.flash) / 0.75;
    if (k < 0 || k > 1) return;
    const [cx, cy] = L.fig.chest, R = L.maxR;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.85;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    for (let i = 0; i < 64; i++) {
      const an = (i / 64) * TAU + hash(i) * 0.08, w = 0.006 + 0.012 * hash(i * 3.3);
      const q0 = R * (0.3 + 0.25 * hash(i * 7.7)) + k * R * 0.3, q1 = R * 1.3;
      ctx.moveTo(cx + Math.cos(an) * q0, cy + Math.sin(an) * q0);
      ctx.lineTo(cx + Math.cos(an - w) * q1, cy + Math.sin(an - w) * q1);
      ctx.lineTo(cx + Math.cos(an + w) * q1, cy + Math.sin(an + w) * q1);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  const tagline: Segment[] = [{ text: "HELLO, WORLD ", color: "#3a76d6" }, { shape: "heart", color: "#3a76d6" }, { text: "  欢迎来到 YUGC OS", color: "#3a76d6" }];
  function drawLogo(T: number): void {
    if (!L) return;
    const lg = L.logo, s = lg.s, y = lg.cy - s / 2;
    "YUGC".split("").forEach((ch, i) => {
      const glyph = glyphs[ch as "Y"];
      const t0 = TL.logo + i * 0.2, k = (T - t0) / 0.8;
      if (k <= 0) return;
      const sc = easeElastic(k), drop = (1 - easeOut(k * 1.6)) * s * 0.7, idle = smoothstep(1, 2, k), wob = (1 - clamp(k)) * Math.sin(k * 16) * 0.22 * (i % 2 ? 1 : -1);
      drawGlyphBubble(ctx, glyph, lg.xs[i] - OX * 0.6, y - drop + Math.sin(T * 2.1 + i * 1.1) * s * 0.025 * idle, s, wob + 0.035 * Math.sin(T * 1.5 + i * 1.7) * idle, sc, lerp(1.25, 1, clamp(k * 1.5)) * sc, clamp(k * 4), DPR);
      drawBurst(ctx, lg.xs[i] + (glyph.w * s) / 2, y + s * 0.5, T - t0 - 0.08, 9, s * 0.9, i);
    });
    const k = (T - TL.os) / 0.6;
    if (k > 0) {
      const bw = s * 0.8, bh = s * 0.4, bx = lg.x1 - s * 0.08 - OX * 0.6, by = lg.cy + s * 0.18 + Math.sin(T * 2 + 4) * s * 0.02 * smoothstep(1, 2, k);
      const c = ctx;
      c.save();
      c.translate(bx + bw / 2, by + bh / 2);
      c.rotate(-0.12 + (1 - clamp(k)) * 0.5);
      const q = easeBack(k);
      c.scale(q, q);
      c.shadowColor = "rgba(40,90,190,.35)";
      c.shadowBlur = 14 * DPR;
      c.shadowOffsetY = 5 * DPR;
      const g = c.createLinearGradient(0, -bh / 2, 0, bh / 2);
      g.addColorStop(0, "#6fb8ff");
      g.addColorStop(1, "#3a78f0");
      c.fillStyle = g;
      roundRectPath(c, -bw / 2, -bh / 2, bw, bh, bh / 2);
      c.fill();
      c.shadowColor = "transparent";
      c.lineWidth = s * 0.05;
      c.strokeStyle = "#fff";
      c.stroke();
      c.fillStyle = "#fff";
      c.font = `900 ${bh * 0.6}px ${UI_FONT}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("OS", 0, bh * 0.04);
      c.restore();
      drawBurst(c, bx + bw / 2, by + bh / 2, T - TL.os - 0.05, 7, s * 0.6, 9);
    }
    const tk = T - TL.tag;
    if (tk > 0) {
      const fs = s * (L.land ? 0.15 : 0.17);
      ctx.save();
      ctx.font = `800 ${fs}px ${UI_FONT}`;
      const shown = sliceSegments(tagline, Math.ceil(segmentsLength(tagline) * clamp(tk)));
      const width = measureSegments(ctx, shown, fs);
      drawSegments(ctx, shown, (lg.x0 + lg.x1) / 2 - OX * 0.6 - width / 2, lg.cy + s * 0.82, fs);
      ctx.restore();
    }
  }

  function bootProgress(T: number): number {
    const x = clamp((T - TL.p0) / (TL.p1 - TL.p0));
    return 0.22 * smoothstep(0, 0.28, x) + 0.3 * smoothstep(0.22, 0.6, x) + 0.33 * smoothstep(0.55, 0.9, x) + 0.15 * smoothstep(0.86, 1, x);
  }
  let fps = 60;
  const readySegs: Segment[] = [{ text: "SYSTEM READY ", color: "#17a77a" }, { shape: "check", color: "#17a77a" }, { text: "  欢迎回来", color: "#17a77a" }];
  function drawPanel(T: number): void {
    if (!L) return;
    const k = (T - TL.p0 + 0.25) / 0.6;
    if (k <= 0) return;
    const r = L.panel, R = L.land ? 18 : 14, pad = L.land ? 20 : 14, hh = L.land ? 32 : 25, fs = L.land ? 13 : 11;
    const c = ctx;
    c.save();
    c.globalAlpha = clamp(k * 2.5);
    c.translate(-OX * 0.6, (1 - easeBack(k)) * 30);
    c.shadowColor = "rgba(60,120,210,.25)";
    c.shadowBlur = 26 * DPR;
    c.shadowOffsetY = 8 * DPR;
    c.fillStyle = "rgba(255,255,255,.8)";
    roundRectPath(c, r.x, r.y, r.w, r.h, R);
    c.fill();
    c.shadowColor = "transparent";
    c.lineWidth = 2;
    c.strokeStyle = "#fff";
    c.stroke();
    ["#ff8fbf", "#ffd36e", "#6fe0b9"].forEach((color, i) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(r.x + pad + i * 14, r.y + hh * 0.6, 4.2, 0, TAU);
      c.fill();
    });
    c.font = `600 ${fs - 1}px ${MONO}`;
    c.fillStyle = "#7d9cc8";
    c.textBaseline = "middle";
    c.fillText("boot.log — yugc@os", r.x + pad + 46, r.y + hh * 0.6);
    const p = bootProgress(T), ready = T >= TL.ready;
    c.textAlign = "right";
    c.font = `800 ${L.land ? 20 : 16}px ${UI_FONT}`;
    c.fillStyle = ready ? "#1fb487" : "#2f6fd8";
    c.fillText(`${Math.round(p * 100)}%`, r.x + r.w - pad, r.y + hh * 0.62);
    c.font = `700 ${fs}px ${MONO}`;
    const statusY = r.y + hh + (r.h - hh) * (L.land ? 0.2 : 0.24);
    if (ready) drawSegments(c, readySegs, r.x + pad, statusY, fs);
    else {
      const msg = LOADING_MESSAGES[Math.min(LOADING_MESSAGES.length - 1, Math.floor(p * LOADING_MESSAGES.length))];
      const dots = ["", ".", "..", "..."][Math.floor(T * 6) % 4];
      drawSegments(c, [{ shape: "play", color: "#2d5fb0" }, { text: " ", color: "#2d5fb0" }, ...paint(msg, "#2d5fb0"), { text: dots, color: "#2d5fb0" }], r.x + pad, statusY, fs);
    }
    const bx = r.x + pad, bW = r.w - pad * 2, bH = L.land ? 18 : 14, by = r.y + hh + (r.h - hh) * (L.land ? 0.42 : 0.52);
    c.fillStyle = "#e4f1ff";
    roundRectPath(c, bx, by, bW, bH, bH / 2);
    c.fill();
    c.strokeStyle = "rgba(120,170,240,.35)";
    c.lineWidth = 1;
    c.stroke();
    const fw = Math.max(bH, bW * p);
    c.save();
    roundRectPath(c, bx, by, fw, bH, bH / 2);
    c.clip();
    const g = c.createLinearGradient(bx, 0, bx + bW, 0);
    g.addColorStop(0, "#7cc8ff");
    g.addColorStop(0.55, "#a99cff");
    g.addColorStop(1, "#ff9fd0");
    c.fillStyle = g;
    c.fillRect(bx, by, fw, bH);
    c.fillStyle = "rgba(255,255,255,.3)";
    const sp = bH * 1.1, o = (T * 40) % (sp * 2);
    c.beginPath();
    for (let x = bx - bH * 2 + o; x < bx + fw; x += sp * 2) {
      c.moveTo(x, by + bH);
      c.lineTo(x + bH, by);
      c.lineTo(x + bH + sp, by);
      c.lineTo(x + sp, by + bH);
      c.closePath();
    }
    c.fill();
    c.restore();
    c.fillStyle = "#ff7fb5";
    heartPath(c, bx + fw - bH * 0.15, by + bH * 0.5 + Math.sin(T * 8) * 1.5, bH * 1.3, 0);
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 2;
    c.stroke();
    if (L.land) {
      c.font = `500 ${fs - 2}px ${MONO}`;
      c.fillStyle = "#8aa6cc";
      c.textAlign = "left";
      c.fillText(`CPU ${device.cores}c · MEM ${device.memory}G · ${particleCount} particles · ${fps} fps · uptime ${Math.max(0, T).toFixed(2)}s`, r.x + pad, r.y + r.h - pad * 0.9);
    }
    c.restore();
  }

  function confetti(T: number): void {
    if (!L) return;
    const age = T - TL.ready;
    if (age < 0 || age > 2.2) return;
    const [cx, cy] = L.fig.chest, n = desktop ? 46 : 30, v0 = desktop ? 520 : 380, gr = desktop ? 520 : 420;
    const c = ctx;
    c.save();
    c.globalAlpha = clamp(1 - age / 2.2);
    for (let j = 0; j < n; j++) {
      const an = -Math.PI / 2 + (hash(j * 1.7) - 0.5) * Math.PI * 1.5, v = v0 * (0.5 + 0.6 * hash(j * 3.3));
      const x = cx + Math.cos(an) * v * age, y = cy + Math.sin(an) * v * age + gr * age * age, s = (desktop ? 9 : 7) * (0.7 + 0.6 * hash(j));
      c.fillStyle = ["#ff9fcf", "#8fd0ff", "#ffffff", "#b9a8ff", "#7ee0c3"][j % 5];
      if (j % 3 === 0) {
        heartPath(c, x, y, s * 1.5, age * 3 + j);
        c.fill();
      } else if (j % 3 === 1) {
        sparklePath(c, x, y, s);
        c.fill();
      } else {
        c.save();
        c.translate(x, y);
        c.rotate(age * 6 + j);
        c.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);
        c.restore();
      }
    }
    c.restore();
  }

  const irisR = (T: number) => easeOut((T - TL.flash) / TL.iris) * (L?.maxR ?? 0);
  function drawFlash(T: number): void {
    if (!L) return;
    const k = T - TL.flash;
    if (k < -0.06 || k > 1.2) return;
    const a = Math.exp(-Math.pow(k / 0.11, 2)) * 0.9 + (k > 0 ? Math.exp(-k * 6) * 0.25 : 0);
    if (a > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (k > 0 && k < TL.iris + 0.15) {
      const R = irisR(T), [cx, cy] = L.fig.chest;
      ctx.save();
      ctx.lineWidth = Math.max(1, 10 * (1 - k));
      ctx.strokeStyle = "rgba(255,255,255,.95)";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(120,220,255,.8)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,140,200,.7)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.025, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── 起步门：深色背景、极客娘全息淡影、标题；手机版是长按的进度环 ──
  let holdAt: number | null = null;
  function drawGate(n: number): void {
    if (!L) return;
    const c = ctx;
    drawDarkBG(0);
    const cx = W / 2, cy = H * (L.land ? 0.46 : 0.42), s = Math.min(W, H);
    if (holo) {
      const M = L.fig.girl;
      c.save();
      c.globalAlpha = 0.1 + 0.04 * Math.sin(n * 3);
      c.drawImage(holo, M.x, M.y, M.w, M.h);
      c.restore();
    }
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#eaf6ff";
    c.font = `800 ${s * (L.land ? 0.07 : 0.11)}px ${MONO}`;
    c.fillText("YUGC OS", cx, cy);
    c.fillStyle = "#6fa8e8";
    c.font = `600 ${s * (L.land ? 0.018 : 0.03)}px ${MONO}`;
    c.fillText("BOOTLOADER 6.1 · KAWAII KERNEL · READY", cx, cy + s * (L.land ? 0.06 : 0.085));
    if (desktop) {
      if ((n * 1.6) % 1 < 0.62) {
        c.fillStyle = "#9fe0ff";
        c.font = `700 ${Math.max(14, s * 0.022)}px ${UI_FONT}`;
        c.fillText("点击或按任意键启动", cx, cy + s * 0.16);
      }
    } else {
      const hp = holdAt !== null ? clamp((n - holdAt) / HOLD_SECONDS) : 0;
      const ry = cy + s * 0.36, q = s * 0.11;
      c.lineWidth = 3;
      c.strokeStyle = "rgba(120,190,255,.35)";
      c.beginPath();
      c.arc(cx, ry, q, 0, TAU);
      c.stroke();
      c.strokeStyle = "#8fe0ff";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, ry, q, -Math.PI / 2, -Math.PI / 2 + TAU * hp);
      c.stroke();
      c.fillStyle = "#bfe6ff";
      c.globalAlpha = 0.3 + 0.7 * hp;
      heartPath(c, cx, ry + q * 0.05, q * 0.75, 0);
      c.fill();
      c.globalAlpha = 1;
      c.font = `700 ${s * 0.04}px ${UI_FONT}`;
      c.fillStyle = "#9fe0ff";
      c.fillText(hp > 0 ? "保持按住…" : "长按启动", cx, ry + q + s * 0.08);
    }
    c.textAlign = "left";
    drawCRT(1);
  }

  // ── 跟手视差：OX/OY 是平滑后的偏移像素，就绪后收回到 0，最后一帧和桌面壁纸对齐 ──
  let OX = 0, OY = 0, pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;

  function render(T: number, n: number): void {
    if (!L) return;
    const c = ctx;
    const sk = T - TL.flash;
    let shx = 0, shy = 0;
    if (sk > 0 && sk < 0.45) {
      const a = (1 - sk / 0.45) * (L.land ? 9 : 6), f = Math.floor(T * 60);
      shx = (hash(f) - 0.5) * 2 * a;
      shy = (hash(f + 0.5) - 0.5) * 2 * a;
    }
    c.setTransform(DPR, 0, 0, DPR, shx * DPR, shy * DPR);
    if (T < 0) {
      drawGate(n);
      return;
    }
    const irisDone = T >= TL.flash + TL.iris;
    const awake = smoothstep(TL.flash + 0.8, TL.flash + 1.6, T);
    const follow = awake * (1 - smoothstep(TL.ready, TL.ready + 0.35, T));
    OX = pointerX * 6 * follow;
    OY = pointerY * 3 * follow;
    if (!irisDone) {
      drawDarkBG(T);
      const ta = 1 - clamp((T - TL.dis) / 0.2);
      if (ta > 0) {
        drawTermFrame(ta * 0.9);
        drawTermLines(c, L.term, T, ta);
      }
      drawParticles(T);
      drawReveal(T);
      drawHUD(T);
      drawCRT(1);
    }
    if (T >= TL.flash) {
      const fig = L.fig;
      c.save();
      if (!irisDone) {
        c.beginPath();
        c.arc(fig.chest[0], fig.chest[1], irisR(T), 0, TAU);
        c.clip();
      }
      const k = T - TL.flash;
      drawSky(c, W, H, fig, T);
      drawDecor(c, decor, T, smoothstep(0, 0.7, k), W, H, L.land, OX, OY, 1);
      drawClouds(c, T, W, H, L.land, smoothstep(0.1, 0.8, k), OX);
      c.save();
      c.translate(OX, OY);
      drawWindow(c, fig.win, DPR, (T - TL.win) / 0.55);
      drawSeatShadow(c, fig, smoothstep(TL.win, TL.win + 0.4, T));
      c.restore();
      speedLines(T);
      if (imgReady) drawGirl(c, img, fig, T, awake, OX, OY);
      drawLogo(T);
      drawPanel(T);
      confetti(T);
      drawBubble(c, fig, READY_LINE, T, READY_BUBBLE.at, READY_BUBBLE.seconds, W, DPR, OX, OY);
      c.restore();
    }
    drawFlash(T);
  }

  // ── 音频（Web Audio 合成，不用音频文件）──
  let audio: AudioContext | null = null, master: GainNode | null = null, bus: GainNode | null = null, noiseBuffer: AudioBuffer | null = null, scheduled = false;
  let muted = opts.muted;
  function ensureAudio(): void {
    try {
      if (!audio) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        audio = new Ctor();
        master = audio.createGain();
        master.gain.value = muted ? 0 : 0.6;
        const compressor = audio.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 4;
        master.connect(compressor);
        compressor.connect(audio.destination);
        audio.onstatechange = () => {
          if (audio?.state === "running" && startedAt !== null && !scheduled) schedule(Math.max(0, timeline()));
        };
      }
      if (audio.state !== "running") void audio.resume().catch(() => undefined);
    } catch {
      /* 没有 Web Audio 时静默，动画照常播放 */
    }
  }
  function tone(t: number, f: number, d: number, o: { type?: OscillatorType; g?: number; f2?: number; a?: number; rel?: number; dest?: AudioNode } = {}): void {
    if (!audio || !master) return;
    const { type = "sine", g = 0.2, f2 = 0, a = 0.005, rel = 0 } = o;
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + d);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(g, t + a);
    if (rel) {
      gain.gain.setValueAtTime(g, t + d - rel);
      gain.gain.linearRampToValueAtTime(0.0001, t + d);
    } else gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(gain);
    gain.connect(o.dest || bus || master);
    osc.start(t);
    osc.stop(t + d + 0.05);
  }
  function noise(t: number, d: number, o: { g?: number; f?: number; f2?: number; q?: number; type?: BiquadFilterType; swell?: number } = {}): void {
    if (!audio || !master) return;
    const { g = 0.15, f = 1200, f2 = 0, q = 0.8, type = "bandpass", swell = 0 } = o;
    if (!noiseBuffer) {
      noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 2), audio.sampleRate);
      const ch = noiseBuffer.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const src = audio.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f, t);
    if (f2) filter.frequency.exponentialRampToValueAtTime(f2, t + d);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    if (swell) {
      gain.gain.exponentialRampToValueAtTime(g, t + d * 0.93);
      gain.gain.linearRampToValueAtTime(0.0001, t + d);
    } else {
      gain.gain.linearRampToValueAtTime(g, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
    }
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus || master);
    src.start(t);
    src.stop(t + d + 0.05);
  }
  function newBus(): void {
    if (!audio || !master) return;
    if (bus) {
      try {
        bus.disconnect();
      } catch {
        /* 已经断开 */
      }
    }
    bus = audio.createGain();
    bus.connect(master);
  }
  function sfxReady(t: number): void {
    [783.99, 1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => {
      tone(t + i * 0.075, f, 0.6, { type: "triangle", g: 0.11 });
      tone(t + i * 0.075, f * 2, 0.25, { g: 0.025 });
    });
    [523.25, 659.25, 783.99, 987.77].forEach((f) => tone(t + 0.3, f, 2.6, { g: 0.035, a: 0.3, rel: 1.2 }));
  }
  function schedule(from: number): void {
    if (!audio || audio.state !== "running") return;
    scheduled = true;
    newBus();
    const b = audio.currentTime + 0.03 - from;
    const at = (t: number) => b + t, ok = (t: number) => t >= from - 0.01;
    if (ok(0)) {
      tone(at(0), 90, 0.5, { g: 0.35, f2: 40 });
      noise(at(0), 0.25, { g: 0.1, f: 3000, type: "highpass" });
      tone(at(0), 55, 5.4, { type: "sawtooth", g: 0.03, a: 1.2, rel: 0.4 });
      tone(at(0), 82.4, 5.4, { g: 0.06, a: 1.5, rel: 0.4 });
    }
    bootLog.forEach((_, k) => {
      const t = logLineTime(k);
      if (!ok(t)) return;
      tone(at(t), 1600 + (k % 5) * 180, 0.035, { type: "square", g: 0.03 });
      for (let j = 1; j < 4; j++) tone(at(t + j * 0.035), 2400 + ((k * j) % 4) * 300, 0.015, { type: "square", g: 0.012 });
    });
    if (ok(TL.conv)) {
      noise(at(TL.conv), TL.flash - TL.conv, { g: 0.15, f: 300, f2: 5200, q: 1.2, swell: 1 });
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
      for (let t = TL.conv + 0.4, i = 0; t < TL.flash - 0.1; t += 0.085, i++) tone(at(t), pentatonic[(i * 3) % 8] * (i % 4 === 0 ? 2 : 1), 0.22, { type: "triangle", g: 0.02 + (0.02 * (t - TL.conv)) / 3 });
    }
    if (ok(TL.scan0)) tone(at(TL.scan0), 300, TL.scan1 - TL.scan0, { f2: 1800, g: 0.04, a: 0.1, rel: 0.1 });
    if (ok(TL.flash)) {
      const t = at(TL.flash);
      tone(t, 130, 1.1, { g: 0.55, f2: 38 });
      noise(t, 0.8, { g: 0.18, f: 2500, type: "highpass" });
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(t + i * 0.012, f, 2.2, { type: "triangle", g: 0.07 }));
      tone(t, 2093, 0.6, { g: 0.05 });
      tone(t + 0.05, 2637, 0.5, { g: 0.04 });
    }
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = TL.logo + i * 0.2 + 0.06;
      if (!ok(t)) return;
      tone(at(t), f * 0.75, 0.2, { g: 0.22, f2: f * 1.5 });
      tone(at(t), f * 2, 0.09, { type: "triangle", g: 0.05 });
    });
    if (ok(TL.os)) {
      tone(at(TL.os + 0.03), 880, 0.12, { g: 0.18, f2: 1320 });
      tone(at(TL.os + 0.11), 1320, 0.14, { g: 0.16, f2: 1760 });
    }
    [6.6, 7.4, 8.2, 8.8].forEach((t) => {
      if (ok(t)) tone(at(t), 1975.5, 0.06, { g: 0.05 });
    });
    if (ok(TL.ready)) sfxReady(at(TL.ready));
  }
  const live = () => !!audio && audio.state === "running";

  // ── 控制 ──
  const now = () => performance.now() / 1000;
  let startedAt: number | null = null;
  let warmStep = 0, warmHandle = 0;

  // ── 预热：起步门停着的时候，把各阶段的画面各画一帧（时间点见 timeline.ts 的 WARM_TIMES）──
  // 画在主画布上没关系：起步门的每一帧都会把整张画布重画，而预热只在没开始播放时进行。
  // 一帧一个任务、中间留出空档，起步门的闪烁提示照常重画；点得比预热快时，start() 先把剩下的补完再计时，播放途中不再遇到首次开销。
  function warmNext(): void {
    warmHandle = 0;
    if (disposed || startedAt !== null || !L || !imgReady || warmStep >= WARM_TIMES.length) return;
    render(WARM_TIMES[warmStep++], now());
    if (warmStep < WARM_TIMES.length) warmHandle = window.setTimeout(warmNext, 40);
  }
  function cancelWarm(): void {
    window.clearTimeout(warmHandle);
    warmHandle = 0;
  }
  function scheduleWarm(): void {
    cancelWarm();
    warmStep = 0;
    warmHandle = window.setTimeout(warmNext, 60);
  }
  function finishWarm(): void {
    cancelWarm();
    if (!L || !imgReady) return;
    while (warmStep < WARM_TIMES.length) render(WARM_TIMES[warmStep++], now());
  }
  let readyFired = false;
  let skipped = false;
  let phase: BootPhase | null = null;
  function timeline(): number {
    return startedAt === null ? -1 : now() - startedAt;
  }

  function canvasPos(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function onPointerMove(e: PointerEvent): void {
    const [x, y] = canvasPos(e);
    targetX = (x / W) * 2 - 1;
    targetY = (y / H) * 2 - 1;
  }
  // 播放中连点两下跳过（原版行为，桌面的双击也走这里）
  let lastTap = 0;
  function onPointerDown(): void {
    if (startedAt === null) return;
    ensureAudio();
    if (timeline() >= TL.ready - 0.3) return;
    const n = now();
    if (n - lastTap < 0.32) skip();
    lastTap = n;
  }
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);

  let rafId = 0, frameAt = now(), frames = 0;
  function loop(): void {
    const n = now();
    pointerX += (targetX - pointerX) * 0.06;
    pointerY += (targetY - pointerY) * 0.06;
    if (mobile && startedAt === null && holdAt !== null && n - holdAt >= HOLD_SECONDS) {
      holdAt = null;
      start();
    }
    const T = timeline();
    render(T, n);
    frames++;
    if (n - frameAt >= 0.5) {
      fps = Math.round(frames / (n - frameAt));
      frames = 0;
      frameAt = n;
    }
    const nextPhase: BootPhase = T < 0 ? "gate" : T < TL.flash + 0.3 ? "dark" : T < TL.ready ? "light" : "ready";
    if (nextPhase !== phase) {
      phase = nextPhase;
      opts.onPhase(phase);
    }
    if (!readyFired && T >= TL.ready && startedAt !== null) {
      readyFired = true;
      opts.onReady({ epoch: startedAt, skipped });
    }
    rafId = requestAnimationFrame(loop);
  }

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const insets = opts.insets();
    SAT = insets.top;
    SAB = insets.bottom;
    layout();
    if (imgReady) {
      prep();
      scheduleWarm();
    }
  }
  // 拖动改窗口大小时每帧都会触发：等停下 120ms 再重算粒子（和原版一样）
  let resizeTimer = 0;
  let measured = false;
  const observer = new ResizeObserver(() => {
    if (!measured) {
      measured = true;
      return;
    }
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 120);
  });
  observer.observe(canvas);

  img.onload = () => {
    if (disposed) return;
    imgReady = true;
    aspect = img.naturalWidth / img.naturalHeight;
    resize();
  };
  img.src = opts.girlSrc;
  resize();
  rafId = requestAnimationFrame(loop);

  function start(): void {
    if (startedAt !== null) return;
    holdAt = null;
    finishWarm();
    startedAt = now();
    ensureAudio();
    scheduled = false;
    schedule(0);
    opts.onStart();
  }
  function skip(): void {
    if (startedAt === null || timeline() >= TL.ready - 0.2) return;
    startedAt = now() - TL.ready - 0.02;
    skipped = true;
    if (live() && audio) {
      newBus();
      scheduled = true;
      sfxReady(audio.currentTime + 0.02);
    }
  }
  function replay(): void {
    if (startedAt === null || readyFired) return;
    startedAt = now();
    skipped = false;
    if (live()) schedule(0);
    else scheduled = false;
  }

  return {
    start,
    beginHold() {
      if (startedAt !== null) return;
      ensureAudio();
      holdAt = now();
    },
    endHold() {
      holdAt = null;
      ensureAudio();
    },
    skip,
    replay,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.6;
      return muted;
    },
    dispose() {
      disposed = true;
      cancelWarm();
      cancelAnimationFrame(rafId);
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      img.onload = null;
      if (audio) void audio.close().catch(() => undefined);
    },
  };
}
