// 首屏右侧两张卡：奖金（每一档多少、一共多少、凭兑奖码兑奖）和实时天梯前几名（桌面 5 名，手机 3 名）。
// 首屏动效：指针附近跟着一团柔光，两张卡随指针轻微倾斜（逐帧缓动，停下就不再跑循环）。
// 减少动态效果或触屏时不跟随、不倾斜；接口失败且还没拿到过数据时，天梯卡显示「数据暂时取不到，稍后自动重试」。
import type { LeaderboardEntry, PrizeTier } from "@shared/competition-sdk";
import { prizeTotal } from "./scoring";
import { avatarHtml, errorHtml, escapeHtml, formatRanks, reducedMotion, rollNumber } from "./util";

const MINI_ROWS = 5;

export function renderPurse(list: HTMLElement, total: HTMLElement, prizes: PrizeTier[]) {
  if (prizes.length === 0) {
    list.innerHTML = `<li class="tier tier-empty">这场比赛没有设奖项，名次照常公布。</li>`;
    total.textContent = "";
    return;
  }
  list.innerHTML = prizes.map((tier, index) => `<li class="tier${index === 0 ? " is-top" : ""}">
      <span class="tier-rank">${formatRanks(tier.from, tier.to)}</span>
      <span class="tier-amount"><b>${tier.amount_cny.toLocaleString("zh-CN")}</b> 元${tier.to > tier.from ? "<small>每人</small>" : ""}</span>
    </li>`).join("");
  const sum = prizeTotal(prizes);
  total.textContent = `前 ${sum.through} 名有奖，共 ${sum.total.toLocaleString("zh-CN")} 元`;
}

export function createMini(slot: HTMLElement) {
  let last = new Map<string, number>();
  let hasData = false;

  const row = (entry: LeaderboardEntry) => {
    const before = last.get(entry.username);
    const shown = before ?? entry.score;
    return `<li class="mini-row place-${Math.min(entry.rank, 4)}${before !== undefined && before !== entry.score ? " is-flash" : ""}" data-user="${escapeHtml(entry.username)}">
        <span class="mini-rank">${entry.rank}</span>
        ${avatarHtml(entry, "avatar avatar-sm")}
        <span class="mini-name"><b>${escapeHtml(entry.display_name || entry.username)}</b><small>@${escapeHtml(entry.username)}</small></span>
        <span class="mini-score"><b class="score" data-value="${shown}">${shown.toLocaleString("zh-CN")}</b> 分</span>
      </li>`;
  };

  return {
    render(entries: LeaderboardEntry[]) {
      hasData = true;
      const top = entries.slice(0, MINI_ROWS);
      if (top.length === 0) {
        slot.innerHTML = `<p class="empty">还没有人得分。第一条被标「有用」的贡献进来后，这里出现名次。</p>`;
        last = new Map();
        return;
      }
      slot.innerHTML = `<ol class="mini-list">${top.map(row).join("")}</ol>`;
      for (const entry of top) {
        const node = slot.querySelector<HTMLElement>(`li[data-user="${CSS.escape(entry.username)}"] .score`);
        if (node) rollNumber(node, entry.score);
      }
      last = new Map(top.map(entry => [entry.username, entry.score]));
    },
    fail() {
      if (!hasData) slot.innerHTML = errorHtml();
    },
  };
}

export function startHeroFx(hero: HTMLElement) {
  const spot = hero.querySelector<HTMLElement>(".hero-spot")!;
  const cards = Array.from(hero.querySelectorAll<HTMLElement>(".tilt"));
  const target = { x: 0.5, y: 0.5 };
  const current = { x: 0.5, y: 0.5 };
  let frame = 0;

  function apply() {
    const rect = hero.getBoundingClientRect();
    spot.style.transform = `translate3d(${(current.x * rect.width).toFixed(1)}px, ${(current.y * rect.height).toFixed(1)}px, 0)`;
    const ry = (current.x - 0.5) * 12;
    const rx = (0.5 - current.y) * 9;
    for (const card of cards) card.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }

  function step() {
    current.x += (target.x - current.x) * 0.12;
    current.y += (target.y - current.y) * 0.12;
    apply();
    frame = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.001 ? requestAnimationFrame(step) : 0;
  }
  const kick = () => { if (!frame) frame = requestAnimationFrame(step); };

  hero.addEventListener("pointermove", event => {
    if (reducedMotion() || event.pointerType !== "mouse") return;
    const rect = hero.getBoundingClientRect();
    target.x = (event.clientX - rect.left) / rect.width;
    target.y = (event.clientY - rect.top) / rect.height;
    hero.classList.add("is-lit");
    kick();
  });
  hero.addEventListener("pointerleave", () => {
    target.x = 0.5;
    target.y = 0.5;
    hero.classList.remove("is-lit");
    kick();
  });
}
