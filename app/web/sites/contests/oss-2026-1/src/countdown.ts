// 首屏倒计时：天、时、分、秒四格，每一位数字变化时从下往上滚进来。开始前倒数到开始，进行中倒数到截止，
// 结束后显示「已结束，结果公布中」；首屏顶上的状态签跟着写「未开赛 / 进行中 / 已结束」。
// 减少动态效果时直接换数。读屏只读一行文字，每分钟更新一次，不逐秒播报。
import { reducedMotion } from "./util";

type Times = { start_at: number; end_at: number };
type Unit = "days" | "hours" | "minutes" | "seconds";
const UNITS: Unit[] = ["days", "hours", "minutes", "seconds"];

function split(ms: number): Record<Unit, number> {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}
const pad = (value: number, unit: Unit) => String(value).padStart(unit === "days" && value >= 100 ? 3 : 2, "0");

/** 一位数字：旧数往上滚出，新数从下面滚进来。 */
function setDigit(slot: HTMLElement, ch: string) {
  if (slot.dataset.ch === ch) return;
  const first = slot.dataset.ch === undefined;
  slot.dataset.ch = ch;
  if (first || reducedMotion()) {
    slot.innerHTML = `<b>${ch}</b>`;
    return;
  }
  slot.querySelectorAll("b.is-out").forEach(node => node.remove());
  slot.querySelector("b")?.classList.add("is-out");
  const next = document.createElement("b");
  next.className = "is-in";
  next.textContent = ch;
  slot.append(next);
  next.addEventListener("animationend", () => {
    slot.querySelectorAll("b.is-out").forEach(node => node.remove());
    next.className = "";
  }, { once: true });
}

export function createCountdown(root: HTMLElement, phase: HTMLElement | null = null) {
  const label = root.querySelector<HTMLElement>("#countdown-label")!;
  const ended = root.querySelector<HTMLElement>("#countdown-ended")!;
  const units = root.querySelector<HTMLElement>(".cd-units")!;
  const text = root.querySelector<HTMLElement>("#countdown-text")!;
  const slots = new Map<Unit, HTMLElement>();
  for (const unit of UNITS) slots.set(unit, root.querySelector<HTMLElement>(`.cd-unit[data-unit="${unit}"] .cd-digits`)!);
  let times: Times | null = null;
  let timer = 0;
  let spoken = "";

  function setUnit(unit: Unit, value: string) {
    const holder = slots.get(unit)!;
    if (holder.childElementCount !== value.length) {
      holder.innerHTML = Array.from(value, () => `<span class="cd-digit"></span>`).join("");
    }
    Array.from(value).forEach((ch, index) => setDigit(holder.children[index] as HTMLElement, ch));
  }

  function tick() {
    if (!times) return;
    const now = Date.now();
    const before = now < times.start_at;
    const over = now > times.end_at;
    label.textContent = before ? "距离开赛还有" : "距离截止还有";
    if (phase) phase.textContent = before ? "未开赛" : over ? "已结束" : "进行中";
    units.hidden = over;
    label.hidden = over;
    ended.hidden = !over;
    if (over) {
      text.textContent = "比赛已结束，结果公布中";
      return;
    }
    const left = split((before ? times.start_at : times.end_at) - now);
    for (const unit of UNITS) setUnit(unit, pad(left[unit], unit));
    const summary = `${label.textContent} ${left.days} 天 ${left.hours} 小时 ${left.minutes} 分`;
    if (summary !== spoken) {
      spoken = summary;
      text.textContent = summary;
    }
  }

  return {
    setTimes(next: Times) {
      if (times && times.start_at === next.start_at && times.end_at === next.end_at) return;
      times = next;
      tick();
      if (!timer) {
        // 对齐到整秒再开始走，和系统时钟同步
        setTimeout(() => {
          tick();
          timer = window.setInterval(tick, 1000);
        }, 1000 - (Date.now() % 1000));
        timer = -1;
      }
    },
  };
}
