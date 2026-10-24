// 首屏倒计时：天、时、分、秒四格翻牌。开始前倒数到开始，进行中倒数到截止，结束后显示「已结束，结果公布中」。
// 翻页用 CSS 3D（上半页翻下）；减少动态效果时直接换数。读屏只读一行文字，每分钟更新一次，不逐秒播报。
import { reducedMotion } from "./util";

type Times = { start_at: number; end_at: number };
type Unit = "days" | "hours" | "minutes" | "seconds";
const UNITS: Unit[] = ["days", "hours", "minutes", "seconds"];

function split(ms: number): Record<Unit, number> {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}
const pad = (value: number, unit: Unit) => String(value).padStart(unit === "days" && value >= 100 ? 3 : 2, "0");

export function createCountdown(root: HTMLElement) {
  const label = root.querySelector<HTMLElement>("#countdown-label")!;
  const ended = root.querySelector<HTMLElement>("#countdown-ended")!;
  const flips = root.querySelector<HTMLElement>(".flips")!;
  const text = root.querySelector<HTMLElement>("#countdown-text")!;
  const cards = new Map<Unit, { card: HTMLElement; value: string }>();
  for (const unit of UNITS) {
    const card = root.querySelector<HTMLElement>(`.flip[data-unit="${unit}"] .flip-card`)!;
    card.innerHTML = `<span class="flip-half flip-top"><b></b></span><span class="flip-half flip-bottom"><b></b></span>`;
    cards.set(unit, { card, value: "" });
  }
  let times: Times | null = null;
  let timer = 0;
  let spoken = "";

  function setCard(unit: Unit, value: string) {
    const entry = cards.get(unit)!;
    if (entry.value === value) return;
    entry.card.classList.toggle("is-3", value.length > 2);
    const old = entry.value;
    entry.value = value;
    const top = entry.card.querySelector<HTMLElement>(".flip-top b")!;
    const bottom = entry.card.querySelector<HTMLElement>(".flip-bottom b")!;
    if (!old || reducedMotion()) {
      top.textContent = value;
      bottom.textContent = value;
      return;
    }
    // 上半页：新数立刻在底下等着；翻下来的那片先盖着旧数。下半页：旧数留着，翻上来的那片带新数，翻完再换。
    top.textContent = value;
    entry.card.querySelectorAll(".flip-flap").forEach(node => node.remove());
    entry.card.insertAdjacentHTML("beforeend",
      `<span class="flip-half flip-top flip-flap flip-flap-down"><b>${old}</b></span><span class="flip-half flip-bottom flip-flap flip-flap-up"><b>${value}</b></span>`);
    const up = entry.card.querySelector<HTMLElement>(".flip-flap-up")!;
    up.addEventListener("animationend", () => {
      bottom.textContent = value;
      entry.card.querySelectorAll(".flip-flap").forEach(node => node.remove());
    }, { once: true });
  }

  function tick() {
    if (!times) return;
    const now = Date.now();
    const before = now < times.start_at;
    const over = now > times.end_at;
    label.textContent = before ? "距离开赛还有" : "距离截止还有";
    flips.hidden = over;
    label.hidden = over;
    ended.hidden = !over;
    if (over) {
      text.textContent = "比赛已结束，结果公布中";
      return;
    }
    const left = split((before ? times.start_at : times.end_at) - now);
    for (const unit of UNITS) setCard(unit, pad(left[unit], unit));
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
        // 对齐到整秒再开始走，翻牌和系统时钟同步
        setTimeout(() => {
          tick();
          timer = window.setInterval(tick, 1000);
        }, 1000 - (Date.now() % 1000));
        timer = -1;
      }
    },
  };
}
