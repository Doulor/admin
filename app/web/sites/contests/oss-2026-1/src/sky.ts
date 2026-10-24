// 全屏固定的天空背景：滚动进度决定天色，从深夜（--os-term-bg）经过深蓝、黎明的紫粉，到开机动画最后一帧的晴空
// （--os-sky-0/1/2 + 48px 白网格 + 底部白云）。夜空里每个已报名的参赛者是一颗星，亮度与半径按分数映射，
// 前三名有十字星芒和慢呼吸光晕，同队成员连成星座；另有三层装饰星做视差，偶尔有流星。
// 减少动态效果时只在滚动、改尺寸、数据变化时重画一帧，星星不动、不闪、没有流星与视差。
import { TAU, clamp, hashUnit, isNarrow, lerp, reducedMotion, rng, smoothstep } from "./util";

export type SkyPerson = { username: string; display_name: string; score: number; rank: number; team: string | null };

type Rgb = [number, number, number];
const hex = (value: string): Rgb => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
const mix = (a: Rgb, b: Rgb, t: number): string => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

// 天色关键帧：[滚动进度, 顶部, 中部, 底部]
const SKY: [number, Rgb, Rgb, Rgb][] = [
  [0, hex("#030914"), hex("#050f26"), hex("#0a1a3f")],
  [0.28, hex("#05123a"), hex("#0d2563"), hex("#203d8c")],
  [0.5, hex("#1f2c78"), hex("#6a58a8"), hex("#f0a6c8")],
  [0.7, hex("#78bdf3"), hex("#bfe2ff"), hex("#ffe1ee")],
  [0.86, hex("#9fd6ff"), hex("#cfeaff"), hex("#f4faff")],
  [1, hex("#9fd6ff"), hex("#cfeaff"), hex("#f4faff")],
];

function skyAt(p: number): [string, string, string] {
  let i = 0;
  while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++;
  const [p0, a0, b0, c0] = SKY[i];
  const [p1, a1, b1, c1] = SKY[i + 1];
  const t = smoothstep(p0, p1, p);
  return [mix(a0, a1, t), mix(b0, b1, t), mix(c0, c1, t)];
}

type Decor = { x: number; y: number; r: number; depth: number; phase: number; speed: number; color: string; glow: boolean };
type Star = SkyPerson & { x: number; y: number; r: number; alpha: number; px: number; py: number };
type Meteor = { x: number; y: number; vx: number; vy: number; born: number; life: number; length: number };

/** 预先画好的圆形光晕：每帧用 drawImage 贴，不用 shadowBlur。 */
function glowSprite(color: string, size = 64): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.18, color.replace(/,\s*[\d.]+\)$/, ",.55)"));
  gradient.addColorStop(1, color.replace(/,\s*[\d.]+\)$/, ",0)"));
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return canvas;
}

function sparkPath(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.closePath();
}

const PODIUM_COLORS = ["rgba(255,211,110,1)", "rgba(207,227,255,1)", "rgba(255,169,210,1)"];

export function createSky(canvas: HTMLCanvasElement, tip: HTMLElement) {
  const ctx = canvas.getContext("2d")!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let decor: Decor[] = [];
  let stars: Star[] = [];
  let people: SkyPerson[] = [];
  let meteors: Meteor[] = [];
  let nextMeteor = performance.now() + 4000;
  let frame = 0;
  let dirty = true;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, clientX: -1, clientY: -1 };
  const glow = { white: glowSprite("rgba(255,255,255,1)"), blue: glowSprite("rgba(190,220,255,1)"), podium: PODIUM_COLORS.map(color => glowSprite(color, 96)) };

  function makeDecor() {
    const random = rng(20261021);
    const count = isNarrow() ? 240 : 500;
    const palette = ["#ffffff", "#ffffff", "#ffffff", "#cfe3ff", "#d6ebff", "#ffd7e9"];
    decor = Array.from({ length: count }, () => {
      const depth = random() < 0.55 ? 0.2 : random() < 0.7 ? 0.5 : 0.9;
      return {
        x: random(), y: random() * 1.25, depth,
        r: depth < 0.3 ? 0.5 + random() * 0.6 : depth < 0.6 ? 0.8 + random() * 0.8 : 1.1 + random() * 1.2,
        phase: random() * TAU, speed: 0.6 + random() * 1.8,
        color: palette[Math.floor(random() * palette.length)], glow: depth > 0.6 && random() < 0.45,
      };
    });
  }

  function placeStars() {
    const max = Math.max(1, ...people.map(person => person.score));
    stars = people.map(person => {
      const level = Math.sqrt(Math.max(0, person.score) / max);
      // 星星落在首屏的夜空里，避开最下面的按钮区一点
      const x = 0.05 + 0.9 * hashUnit(person.username, 11);
      const y = 0.06 + 0.78 * hashUnit(person.username, 29);
      return { ...person, x, y, r: person.score > 0 ? 1.4 + 2.8 * level : 1.1, alpha: person.score > 0 ? 0.5 + 0.5 * level : 0.32, px: 0, py: 0 };
    });
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, isNarrow() ? 1.75 : 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    makeDecor();
    dirty = true;
  }

  // 页面总高度只在内容或窗口变化时重读，每帧读会逼浏览器重新排版
  let pageHeight = document.documentElement.scrollHeight;
  new ResizeObserver(() => { pageHeight = document.documentElement.scrollHeight; requestStill(); }).observe(document.body);
  const progress = () => {
    const max = pageHeight - H;
    return max > 0 ? clamp(scrollY / max) : 0;
  };

  function drawClouds(alpha: number, t: number) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = W > 720 ? 70 : 44;
    const rise = (1 - alpha) * r * 1.4;
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? "#ffffff" : "rgba(222,239,255,.96)";
      ctx.beginPath();
      for (let x = -r, i = 0; x < W + r * 2; x += r * 1.15, i++) {
        const q = r * (0.7 + 0.5 * hashUnit(`cloud${i}`, layer));
        const y = H + r * 0.35 - (layer ? 0 : r * 0.45) + rise + Math.sin(t * 0.6 + i) * 3;
        ctx.moveTo(x + q, y);
        ctx.arc(x, y, q, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(now: number) {
    const still = reducedMotion();
    const t = still ? 0 : now / 1000;
    const p = progress();
    const scroll = scrollY;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const [top, mid, bottom] = skyAt(p);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, top);
    sky.addColorStop(0.55, mid);
    sky.addColorStop(1, bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 黎明：底部升起一片暖色的光
    const dawn = smoothstep(0.32, 0.55, p) * (1 - smoothstep(0.66, 0.84, p));
    if (dawn > 0.01) {
      const sun = ctx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, Math.max(W, H) * 0.75);
      sun.addColorStop(0, `rgba(255,211,110,${0.55 * dawn})`);
      sun.addColorStop(0.35, `rgba(255,159,208,${0.35 * dawn})`);
      sun.addColorStop(1, "rgba(255,159,208,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);
    }

    // 晴空的白网格（48px）
    const grid = smoothstep(0.7, 0.9, p);
    if (grid > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * grid})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const offset = -(scroll * 0.15) % 48;
      for (let x = 0.5; x < W; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = offset + 0.5; y < H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }

    const night = 1 - smoothstep(0.36, 0.66, p);
    if (night > 0.01) {
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      const shiftX = still ? 0 : pointer.x;
      const shiftY = still ? 0 : pointer.y;
      // 装饰星：三层视差，滚动时深层动得快
      for (const star of decor) {
        const span = H * 1.25;
        const y = ((star.y * span - scroll * (0.04 + star.depth * 0.18) + shiftY * star.depth * 16) % span + span) % span - H * 0.1;
        const x = star.x * W + shiftX * star.depth * 22;
        const twinkle = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * star.speed + star.phase);
        const a = night * twinkle * (0.35 + star.depth * 0.65);
        if (star.glow) {
          const size = star.r * 9;
          ctx.globalAlpha = a * 0.5;
          ctx.drawImage(star.color === "#ffffff" ? glow.white : glow.blue, x - size / 2, y - size / 2, size, size);
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = star.color;
        ctx.fillRect(x - star.r / 2, y - star.r / 2, star.r, star.r);
      }
      ctx.globalAlpha = 1;

      // 参赛者：星座连线在下，星在上
      const depth = 0.6;
      for (const star of stars) {
        star.px = star.x * W + shiftX * depth * 22;
        star.py = star.y * H - scroll * 0.35 + shiftY * depth * 16;
      }
      const teams = new Map<string, Star[]>();
      for (const star of stars) if (star.team) teams.set(star.team, [...(teams.get(star.team) ?? []), star]);
      ctx.strokeStyle = `rgba(207,227,255,${0.28 * night})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const members of teams.values()) {
        if (members.length < 2) continue;
        const ordered = [...members].sort((a, b) => a.px - b.px);
        ctx.moveTo(ordered[0].px, ordered[0].py);
        for (const member of ordered.slice(1)) ctx.lineTo(member.px, member.py);
      }
      ctx.stroke();
      for (const star of stars) {
        if (star.py < -40 || star.py > H + 40) continue;
        const podium = star.rank >= 1 && star.rank <= 3 && star.score > 0;
        const breathe = still ? 1 : 1 + 0.16 * Math.sin(t * 2.1 + star.rank);
        if (podium) {
          const size = (star.r * 11 + 18) * breathe;
          ctx.globalAlpha = night * 0.85;
          ctx.drawImage(glow.podium[star.rank - 1], star.px - size / 2, star.py - size / 2, size, size);
          ctx.fillStyle = PODIUM_COLORS[star.rank - 1];
          sparkPath(ctx, star.px, star.py, star.r * 4.2 * breathe);
          ctx.fill();
        } else if (star.score > 0) {
          const size = star.r * 7;
          ctx.globalAlpha = night * star.alpha * 0.6;
          ctx.drawImage(glow.blue, star.px - size / 2, star.py - size / 2, size, size);
        }
        ctx.globalAlpha = night * (podium ? 1 : star.alpha);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.px, star.py, star.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 流星：10–20 秒一颗
      if (!still) {
        if (now > nextMeteor) {
          // 往左下方划过：与水平方向成 22°–34°
          const angle = (22 + Math.random() * 12) * Math.PI / 180;
          const speed = 900 + Math.random() * 400;
          meteors.push({ x: W * (0.35 + Math.random() * 0.75), y: H * Math.random() * 0.3, vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: now, life: 900 + Math.random() * 400, length: 140 + Math.random() * 90 });
          nextMeteor = now + 10_000 + Math.random() * 10_000;
        }
        meteors = meteors.filter(meteor => now - meteor.born < meteor.life);
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        for (const meteor of meteors) {
          const dt = (now - meteor.born) / 1000;
          const age = (now - meteor.born) / meteor.life;
          const x = meteor.x + meteor.vx * dt;
          const y = meteor.y + meteor.vy * dt;
          const speed = Math.hypot(meteor.vx, meteor.vy);
          const tx = x - (meteor.vx / speed) * meteor.length;
          const ty = y - (meteor.vy / speed) * meteor.length;
          const tail = ctx.createLinearGradient(x, y, tx, ty);
          tail.addColorStop(0, `rgba(255,255,255,${night * Math.sin(Math.PI * age)})`);
          tail.addColorStop(1, "rgba(160,200,255,0)");
          ctx.strokeStyle = tail;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
      }
    }

    drawClouds(smoothstep(0.8, 0.98, p), t);
    dirty = false;
  }

  function loop(now: number) {
    draw(now);
    frame = requestAnimationFrame(loop);
  }

  function updateTip() {
    if (pointer.clientX < 0 || progress() > 0.3 || stars.length === 0) { tip.hidden = true; return; }
    let best: Star | null = null;
    let bestDistance = 16;
    for (const star of stars) {
      const d = Math.hypot(star.px - pointer.clientX, star.py - pointer.clientY);
      if (d < bestDistance) { best = star; bestDistance = d; }
    }
    if (!best) { tip.hidden = true; return; }
    tip.textContent = `${best.display_name || best.username} · ${best.score} 分`;
    tip.style.transform = `translate(${Math.round(best.px)}px, ${Math.round(best.py - 14)}px) translate(-50%, -100%)`;
    tip.hidden = false;
  }

  function requestStill() {
    if (!reducedMotion()) return;
    dirty = true;
    requestAnimationFrame(now => { if (dirty) draw(now); });
  }

  addEventListener("pointermove", event => {
    if (event.pointerType === "touch") return;
    pointer.tx = (event.clientX / W - 0.5) * 2;
    pointer.ty = (event.clientY / H - 0.5) * 2;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    updateTip();
  }, { passive: true });
  addEventListener("pointerleave", () => { pointer.clientX = -1; tip.hidden = true; });
  addEventListener("deviceorientation", event => {
    if (event.gamma == null || event.beta == null) return;
    pointer.tx = clamp(event.gamma / 30, -1, 1);
    pointer.ty = clamp((event.beta - 45) / 30, -1, 1);
  }, { passive: true });
  addEventListener("scroll", () => { tip.hidden = true; requestStill(); }, { passive: true });
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { resize(); requestStill(); }, 100);
  });

  return {
    start() {
      resize();
      placeStars();
      cancelAnimationFrame(frame);
      if (reducedMotion()) draw(performance.now());
      else frame = requestAnimationFrame(loop);
    },
    restart() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (reducedMotion()) draw(performance.now());
      else frame = requestAnimationFrame(loop);
    },
    setPeople(next: SkyPerson[]) {
      people = next;
      placeStars();
      requestStill();
    },
  };
}
