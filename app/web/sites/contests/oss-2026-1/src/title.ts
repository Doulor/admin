// 首屏标题「OSS CHALLENGE」：照开机动画 YUGC 泡泡字母的画法（字形是一条骨架线，用粗圆头描边叠出
// 投影、白描边、深色描边、渐变主体和高光），每个字母先画成离屏小图，动画时只做位移和缩放。
// 载入时逐个字母从 0.6 弹起（间隔 60ms），之后极轻地上下浮动；减少动态效果时直接画定稿。
import { TAU, clamp, lerp, reducedMotion } from "./util";

type Glyph = { w: number; path: Path2D };
type Tone = readonly [light: string, body: string, line: string];

const TONES: Record<"y" | "u" | "g" | "c", Tone> = {
  y: ["#c8fdec", "#3fd0a5", "#1a9a7b"],
  u: ["#cdeaff", "#4aa6ff", "#2a6fd6"],
  g: ["#ffd7e9", "#ff83bb", "#dc4d93"],
  c: ["#dcdfff", "#8b93ff", "#565de0"],
};
const CYCLE = ["y", "u", "g", "c"] as const;

const path = (draw: (p: Path2D) => void) => {
  const p = new Path2D();
  draw(p);
  return p;
};

// 骨架线在 w×1 的单位格里，描边宽 0.3：竖向从 0.17 到 0.83，加上描边正好填满一格高。
const GLYPHS: Record<string, Glyph> = {
  O: { w: 1, path: path(p => p.ellipse(0.5, 0.5, 0.33, 0.33, 0, 0, TAU)) },
  S: { w: 0.86, path: path(p => {
    p.moveTo(0.68, 0.27);
    p.bezierCurveTo(0.6, 0.13, 0.2, 0.12, 0.2, 0.34);
    p.bezierCurveTo(0.2, 0.52, 0.68, 0.46, 0.68, 0.67);
    p.bezierCurveTo(0.68, 0.9, 0.24, 0.89, 0.17, 0.72);
  }) },
  C: { w: 0.94, path: path(p => p.arc(0.5, 0.5, 0.34, -0.27 * Math.PI, 0.27 * Math.PI, true)) },
  H: { w: 0.88, path: path(p => {
    p.moveTo(0.17, 0.17); p.lineTo(0.17, 0.83);
    p.moveTo(0.71, 0.17); p.lineTo(0.71, 0.83);
    p.moveTo(0.17, 0.5); p.lineTo(0.71, 0.5);
  }) },
  A: { w: 0.92, path: path(p => {
    p.moveTo(0.15, 0.83); p.lineTo(0.46, 0.17); p.lineTo(0.77, 0.83);
    p.moveTo(0.28, 0.6); p.lineTo(0.64, 0.6);
  }) },
  L: { w: 0.72, path: path(p => { p.moveTo(0.17, 0.17); p.lineTo(0.17, 0.83); p.lineTo(0.58, 0.83); }) },
  E: { w: 0.76, path: path(p => {
    p.moveTo(0.62, 0.17); p.lineTo(0.17, 0.17); p.lineTo(0.17, 0.83); p.lineTo(0.62, 0.83);
    p.moveTo(0.17, 0.5); p.lineTo(0.54, 0.5);
  }) },
  N: { w: 0.88, path: path(p => { p.moveTo(0.17, 0.83); p.lineTo(0.17, 0.17); p.lineTo(0.71, 0.83); p.lineTo(0.71, 0.17); }) },
  G: { w: 1, path: path(p => { p.arc(0.5, 0.5, 0.34, -0.2 * Math.PI, 0, true); p.lineTo(0.58, 0.5); }) },
};

const WORDS = ["OSS", "CHALLENGE"];
const GAP = -0.02;
const SPACE = 0.42;
const STROKE = 0.3;

const eOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const eElastic = (t: number) => {
  t = clamp(t);
  return t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin(((t * 9 - 0.75) * TAU) / 3) + 1;
};

type Letter = { ch: string; tone: Tone; x: number; y: number; w: number; sprite: HTMLCanvasElement; index: number };

/** 画一个泡泡字母到离屏画布：坐标系已经缩放到字号 s，单位格左上角在 (pad, pad)。 */
function renderGlyph(glyph: Glyph, tone: Tone, size: number, dpr: number): HTMLCanvasElement {
  const pad = size * 0.35;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((glyph.w * size + pad * 2) * dpr);
  canvas.height = Math.ceil((size + pad * 2) * dpr);
  const g = canvas.getContext("2d")!;
  g.scale(dpr, dpr);
  g.translate(pad, pad);
  g.scale(size, size);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.shadowColor = "rgba(50,100,190,.34)";
  g.shadowBlur = 16 * dpr;
  g.shadowOffsetY = 8 * dpr;
  g.strokeStyle = "#7fb0ea";
  g.lineWidth = STROKE + 0.17;
  g.save(); g.translate(0, 0.055); g.stroke(glyph.path); g.restore();
  g.shadowColor = "transparent";
  for (const d of [0.04, 0.025]) { g.save(); g.translate(0, d); g.stroke(glyph.path); g.restore(); }
  g.strokeStyle = "#fff";
  g.stroke(glyph.path);
  g.strokeStyle = tone[2];
  g.lineWidth = STROKE + 0.05;
  g.stroke(glyph.path);
  const body = g.createLinearGradient(0, 0.12, 0, 0.9);
  body.addColorStop(0, tone[0]);
  body.addColorStop(1, tone[1]);
  g.strokeStyle = body;
  g.lineWidth = STROKE;
  g.stroke(glyph.path);
  g.translate(-0.035, -0.045);
  g.strokeStyle = "rgba(255,255,255,.85)";
  g.lineWidth = STROKE * 0.24;
  g.setLineDash([0.2, 0.5]);
  g.stroke(glyph.path);
  return canvas;
}

export function createTitle(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  let letters: Letter[] = [];
  let size = 0;
  let pad = 0;
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let startedAt = performance.now();
  let frame = 0;

  const wordWidth = (word: string) => Array.from(word).reduce((sum, ch) => sum + GLYPHS[ch].w + GAP, -GAP);

  function layout() {
    const box = canvas.parentElement!.getBoundingClientRect();
    cssW = Math.min(box.width - 24, 1180);
    const twoLines = cssW < 860 || innerWidth / innerHeight < 1.05;
    const units = twoLines ? Math.max(...WORDS.map(wordWidth)) : WORDS.map(wordWidth).reduce((a, b) => a + b, 0) + SPACE;
    const maxBy = twoLines ? innerHeight * 0.12 : innerHeight * 0.17;
    size = Math.max(34, Math.min(cssW / (units + 0.6), maxBy, 148));
    pad = size * 0.35;
    const lines = twoLines ? [WORDS[0], WORDS[1]] : [`${WORDS[0]} ${WORDS[1]}`];
    cssH = Math.ceil(size * lines.length + size * 0.08 * (lines.length - 1) + pad * 1.2);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    letters = [];
    let index = 0;
    lines.forEach((line, row) => {
      const words = line.split(" ");
      const lineUnits = words.map(wordWidth).reduce((a, b) => a + b, 0) + SPACE * (words.length - 1);
      let x = (cssW - lineUnits * size) / 2;
      const y = pad * 0.5 + row * size * 1.08;
      words.forEach((word, wordIndex) => {
        Array.from(word).forEach((ch, i) => {
          const glyph = GLYPHS[ch];
          const tone = TONES[CYCLE[i % CYCLE.length]];
          letters.push({ ch, tone, x, y, w: glyph.w * size, sprite: renderGlyph(glyph, tone, size, dpr), index: index++ });
          x += (glyph.w + GAP) * size;
        });
        if (wordIndex < words.length - 1) x += SPACE * size;
      });
    });
  }

  function draw(now: number) {
    const t = (now - startedAt) / 1000;
    const still = reducedMotion();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let busy = false;
    for (const letter of letters) {
      const k = still ? 1 : (t - letter.index * 0.06) / 0.8;
      if (k <= 0) { busy = true; continue; }
      if (k < 2) busy = true;
      const scale = still ? 1 : lerp(0.6, 1, eElastic(k));
      const drop = still ? 0 : (1 - eOut(k * 1.6)) * size * 0.35;
      const idle = still ? 0 : clamp(k - 1);
      const float = Math.sin(t * 1.9 + letter.index * 0.9) * size * 0.022 * idle;
      const tilt = still ? 0 : (1 - clamp(k)) * Math.sin(k * 16) * 0.16 * (letter.index % 2 ? 1 : -1) + 0.025 * Math.sin(t * 1.4 + letter.index * 1.7) * idle;
      const sw = letter.sprite.width / dpr;
      const sh = letter.sprite.height / dpr;
      const cx = letter.x + letter.w / 2;
      const base = letter.y + size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = still ? 1 : clamp(k * 4);
      ctx.translate(cx, base - drop + float);
      ctx.rotate(tilt);
      ctx.scale(scale, scale * (still ? 1 : lerp(1.18, 1, clamp(k * 1.5))));
      ctx.drawImage(letter.sprite, -letter.w / 2 - pad, -size - pad, sw, sh);
    }
    ctx.globalAlpha = 1;
    return busy || !still;
  }

  function loop(now: number) {
    const keep = draw(now);
    frame = keep && !reducedMotion() ? requestAnimationFrame(loop) : 0;
  }

  function start() {
    layout();
    startedAt = performance.now();
    cancelAnimationFrame(frame);
    if (reducedMotion()) draw(startedAt);
    else frame = requestAnimationFrame(loop);
  }

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      layout();
      if (!frame) draw(performance.now() + 10_000);
    }, 120);
  });

  return {
    start,
    /** 标题是否在视口里：不在时停掉逐帧浮动，省电。 */
    setVisible(visible: boolean) {
      if (reducedMotion()) return;
      if (visible && !frame) frame = requestAnimationFrame(loop);
      if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
    },
    redraw() {
      cancelAnimationFrame(frame);
      frame = 0;
      layout();
      if (reducedMotion()) draw(performance.now());
      else frame = requestAnimationFrame(loop);
    },
  };
}
