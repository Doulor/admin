// 首屏标题「OSS CHALLENGE」：拼在一张贡献热力图上。每个字母是 5×7 的点阵（热力图正好一周七行），
// 字母格是亮色、背景格是浅灰；颜色沿横向从紫过渡到粉、黄、绿、蓝。
// 载入时格子从左到右一格格「提交」上去；之后随机有格子闪一下，背景里偶尔冒出一格浅色的新提交；
// 指针附近的格子放大变亮，点一下从点击处扩出一圈波纹，波纹扫过的字母格换一档颜色。
// 有新贡献进天梯时（main.ts 调 pulse）从随机一格扩出波纹。减少动态效果时只画定稿，不响应指针。
import { clamp, lerp, reducedMotion, rng } from "./util";

const GLYPHS: Record<string, readonly string[]> = {
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
};
const GLYPH_W = 5;
const GLYPH_H = 7;

/** 紫、粉、黄、绿、蓝：和页面的五个强调色一致。 */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [123, 92, 255], [255, 79, 163], [255, 184, 28], [38, 214, 120], [41, 182, 255],
];
const EMPTY = [21, 19, 29] as const;

type Cell = {
  x: number; y: number; col: number; lit: boolean;
  level: number; tone: number; born: number; flash: number; commit: number; shifted: number; scale: number;
};
type Wave = { x: number; y: number; t0: number };

function paletteAt(t: number): [number, number, number] {
  const span = PALETTE.length;
  const x = ((t % span) + span) % span;
  const i = Math.floor(x);
  const a = PALETTE[i];
  const b = PALETTE[(i + 1) % span];
  const k = x - i;
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

/** 文字排成点阵，返回字母格的 (列, 行) 与总宽。空格占 3 列，字母之间空 1 列。 */
function layoutLine(text: string): { cells: [number, number][]; width: number } {
  const cells: [number, number][] = [];
  let x = 0;
  for (const ch of text) {
    if (ch === " ") { x += 3; continue; }
    const glyph = GLYPHS[ch];
    glyph.forEach((row, y) => { for (let gx = 0; gx < GLYPH_W; gx++) if (row[gx] === "#") cells.push([x + gx, y]); });
    x += GLYPH_W + 1;
  }
  return { cells, width: x - 1 };
}

export function createTitle(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const host = canvas.parentElement!;
  let cells: Cell[] = [];
  let litCells: Cell[] = [];
  let pitch = 10;
  let cols = 0;
  let rows = 0;
  let dpr = 1;
  let frame = 0;
  let visible = true;
  let started = 0;
  let pointer: { x: number; y: number } | null = null;
  let waves: Wave[] = [];
  let nextFlash = 0;
  let nextCommit = 0;

  function build() {
    const narrow = host.clientWidth < 720;
    const lines = narrow ? ["OSS", "CHALLENGE"] : ["OSS CHALLENGE"];
    const padX = narrow ? 1 : 3;
    const padY = narrow ? 1 : 2;
    const laid = lines.map(layoutLine);
    const textW = Math.max(...laid.map(line => line.width));
    cols = textW + padX * 2;
    rows = padY * 2 + lines.length * GLYPH_H + (lines.length - 1) * 2;
    const width = host.clientWidth;
    pitch = width / cols;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${Math.round(rows * pitch)}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(rows * pitch * dpr);

    const lit = new Set<string>();
    laid.forEach((line, index) => {
      const offsetX = padX + Math.floor((textW - line.width) / 2);
      const offsetY = padY + index * (GLYPH_H + 2);
      for (const [x, y] of line.cells) lit.add(`${x + offsetX},${y + offsetY}`);
    });
    const random = rng(278);
    cells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const on = lit.has(`${x},${y}`);
        cells.push({
          x, y, col: x, lit: on,
          // 字母格 3–4 档，像真实的提交数有深有浅；背景格大多是 0 档，少数 1 档
          level: on ? (random() < 0.3 ? 3 : 4) : random() < 0.04 ? 1 : 0,
          tone: (x / Math.max(1, cols - 1)) * (PALETTE.length - 1),
          born: on ? 120 + x * 16 + random() * 260 : x * 5 + random() * 300,
          flash: -1e9, commit: -1e9, shifted: -1e9, scale: 1,
        });
      }
    }
    litCells = cells.filter(cell => cell.lit);
  }

  function cellColor(cell: Cell, now: number, t: number): string {
    const appear = clamp((t - cell.born) / 380);
    if (cell.lit) {
      // 闪一下时颜色往下一档偏一点；深浅两档与白底混合
      const flash = Math.max(0, 1 - (now - cell.flash) / 900);
      const [r, g, b] = paletteAt(cell.tone + flash * 0.6);
      const strength = (cell.level === 4 ? 1 : 0.86) * appear;
      return `rgb(${lerp(255, r, strength) | 0},${lerp(255, g, strength) | 0},${lerp(255, b, strength) | 0})`;
    }
    // 背景格不用彩色，免得和字母混在一起；只有刚冒出来的新提交短暂带一点颜色
    const commit = Math.max(0, 1 - (now - cell.commit) / 2400);
    if (commit > 0) {
      const [r, g, b] = paletteAt(cell.tone);
      return `rgba(${r | 0},${g | 0},${b | 0},${((0.1 + commit * 0.3) * appear).toFixed(3)})`;
    }
    return `rgba(${EMPTY[0]},${EMPTY[1]},${EMPTY[2]},${((cell.level > 0 ? 0.13 : 0.07) * appear).toFixed(3)})`;
  }

  function draw(now: number) {
    const t = reducedMotion() ? 1e9 : now - started;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = pitch * 0.78;
    const radius = Math.max(1, size * 0.24);
    const reach = pitch * 5;
    waves = waves.filter(wave => now - wave.t0 < 2200);
    for (const cell of cells) {
      const cx = (cell.x + 0.5) * pitch;
      const cy = (cell.y + 0.5) * pitch;
      let target = cell.lit ? 1 + Math.max(0, 1 - (now - cell.flash) / 900) * 0.22 : 1;
      if (pointer) {
        const d = Math.hypot(cx - pointer.x, cy - pointer.y);
        if (d < reach) target += (1 - d / reach) * (cell.lit ? 0.42 : 0.3);
      }
      for (const wave of waves) {
        const front = (now - wave.t0) * 0.75;
        const d = Math.hypot(cx - wave.x, cy - wave.y);
        const band = Math.abs(d - front);
        if (band < pitch * 1.6) target += (1 - band / (pitch * 1.6)) * 0.5;
        // 波纹扫过的字母格换一档颜色（只换一次）
        if (cell.lit && d < front && cell.shifted < wave.t0) {
          cell.shifted = wave.t0;
          cell.tone += 1;
          cell.flash = now;
        }
      }
      cell.scale += (target - cell.scale) * 0.22;
      const appear = clamp((t - cell.born) / 380);
      const pop = cell.lit && appear < 1 ? 0.4 + appear * 0.6 + Math.sin(appear * Math.PI) * 0.25 : 1;
      const s = size * cell.scale * pop;
      ctx.fillStyle = cellColor(cell, now, t);
      ctx.beginPath();
      ctx.roundRect(cx - s / 2, cy - s / 2, s, s, radius * cell.scale);
      ctx.fill();
    }
  }

  function idle(now: number) {
    if (now > nextFlash && litCells.length) {
      litCells[Math.floor(Math.random() * litCells.length)].flash = now;
      nextFlash = now + 90 + Math.random() * 160;
    }
    if (now > nextCommit) {
      const quiet = cells.filter(cell => !cell.lit);
      if (quiet.length) quiet[Math.floor(Math.random() * quiet.length)].commit = now;
      nextCommit = now + 140 + Math.random() * 260;
    }
  }

  function loop(now: number) {
    idle(now);
    draw(now);
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function run() {
    stop();
    if (reducedMotion()) { draw(performance.now()); return; }
    if (visible && !document.hidden) frame = requestAnimationFrame(loop);
  }

  const local = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  host.addEventListener("pointermove", event => { if (!reducedMotion() && event.pointerType === "mouse") pointer = local(event); });
  host.addEventListener("pointerleave", () => { pointer = null; });
  canvas.addEventListener("pointerdown", event => {
    if (reducedMotion()) return;
    const at = local(event);
    waves.push({ ...at, t0: performance.now() });
  });
  document.addEventListener("visibilitychange", run);
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { const before = cols; build(); if (cols !== before) started = performance.now() - 2000; run(); }, 120);
  });

  return {
    start() {
      build();
      started = performance.now();
      run();
    },
    redraw() {
      run();
    },
    setVisible(value: boolean) {
      visible = value;
      run();
    },
    /** 有新贡献：从随机一个字母格扩出一圈波纹。 */
    pulse() {
      if (reducedMotion() || !litCells.length) return;
      const cell = litCells[Math.floor(Math.random() * litCells.length)];
      waves.push({ x: (cell.x + 0.5) * pitch, y: (cell.y + 0.5) * pitch, t0: performance.now() });
    },
  };
}
