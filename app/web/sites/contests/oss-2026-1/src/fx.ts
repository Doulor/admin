// 彗星：新的一条贡献进来时，从动态里它的加分胶囊飞出一颗带渐隐尾迹（紫到粉）的彗星，沿弧线飞到天梯里那个人的那一行，
// 到达时那一行闪光、分数滚动。画在一张盖在内容上面、不接收指针的全屏画布上，没有彗星时不跑逐帧循环。
// 减少动态效果时不飞，直接让那一行淡入闪一下。
import { TAU, clamp, lerp, reducedMotion } from "./util";

type Point = { x: number; y: number };
type Comet = { from: Point; to: Point; control: Point; born: number; duration: number; trail: Point[]; arrive: () => void; arrived: boolean };

export function createFx() {
  const canvas = document.createElement("canvas");
  canvas.className = "fx";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d")!;
  let comets: Comet[] = [];
  let frame = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
  }
  resize();
  addEventListener("resize", resize);

  function loop(now: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const comet of comets) {
      const k = clamp((now - comet.born) / comet.duration);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const x = lerp(lerp(comet.from.x, comet.control.x, e), lerp(comet.control.x, comet.to.x, e), e);
      const y = lerp(lerp(comet.from.y, comet.control.y, e), lerp(comet.control.y, comet.to.y, e), e);
      if (k < 1) comet.trail.push({ x, y });
      if (comet.trail.length > 26 || k >= 1) comet.trail.shift();
      for (let i = 1; i < comet.trail.length; i++) {
        const a = i / comet.trail.length;
        ctx.strokeStyle = `rgba(${Math.round(lerp(123, 255, a))},${Math.round(lerp(92, 79, a))},${Math.round(lerp(255, 163, a))},${a * 0.9})`;
        ctx.lineWidth = 1 + a * 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(comet.trail[i - 1].x, comet.trail[i - 1].y);
        ctx.lineTo(comet.trail[i].x, comet.trail[i].y);
        ctx.stroke();
      }
      if (k < 1) {
        const head = ctx.createRadialGradient(x, y, 0, x, y, 14);
        head.addColorStop(0, "rgba(255,79,163,1)");
        head.addColorStop(0.45, "rgba(255,184,28,.7)");
        head.addColorStop(1, "rgba(255,184,28,0)");
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, TAU);
        ctx.fill();
      } else if (!comet.arrived) {
        comet.arrived = true;
        comet.arrive();
      }
    }
    comets = comets.filter(comet => !comet.arrived || comet.trail.length > 0);
    frame = comets.length ? requestAnimationFrame(loop) : 0;
    if (!frame) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  const onScreen = (rect: DOMRect) => rect.bottom > 0 && rect.top < innerHeight && rect.width > 0;

  return {
    /** 从 source 飞到 target；两头有一头不在屏幕上就不飞，直接执行 arrive。 */
    launch(source: Element | null, target: Element | null, arrive: () => void, delay = 0) {
      if (!source || !target || reducedMotion()) { arrive(); return; }
      const a = source.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      if (!onScreen(a) || !onScreen(b)) { arrive(); return; }
      const from = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
      const to = { x: b.left + Math.min(b.width - 24, 64), y: b.top + b.height / 2 };
      const lift = Math.max(120, Math.abs(to.x - from.x) * 0.4);
      const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
      setTimeout(() => {
        comets.push({ from, to, control, born: performance.now(), duration: 1100, trail: [], arrive, arrived: false });
        if (!frame) frame = requestAnimationFrame(loop);
      }, delay);
    },
  };
}
