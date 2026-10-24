// 首屏下面的滚动条：最近十几条计分的贡献横着循环滚过（谁、做了什么、加几分）。内容复制一份接在后面，
// 滚到一半正好接上；速度按内容长度算，大约每秒 70px。鼠标放上去停住。
// 这一条只是装饰，读屏不读（同样的内容在「贡献动态」里）；减少动态效果时不滚，只显示开头几条。
import type { FeedItem } from "@shared/competition-sdk";
import { escapeHtml, formatPoints } from "./util";

const ACTIONS: Record<FeedItem["kind"], string> = { pr: "合并了 MR", issue: "的 Issue 被采纳", penalty: "被扣分" };
const SHOWN = 14;
const SPEED = 70;

const itemHtml = (item: FeedItem) => `<span class="tk-item kind-${item.kind}"><b>${escapeHtml(item.display_name || item.username)}</b>${ACTIONS[item.kind]}<i>${formatPoints(item.points)}</i></span>`;

export function createTicker(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('[data-slot="ticker"]')!;
  let key = "";

  function measure() {
    const half = track.scrollWidth / 2;
    track.style.setProperty("--tk-duration", `${Math.max(20, half / SPEED).toFixed(1)}s`);
  }
  addEventListener("resize", measure);

  return {
    update(items: FeedItem[]) {
      const shown = items.filter(item => item.kind !== "penalty").slice(0, SHOWN);
      const next = shown.map(item => item.id).join(",");
      if (next === key) return;
      key = next;
      if (shown.length === 0) {
        track.innerHTML = `<span class="tk-group"><span class="tk-item">还没有计分的贡献，第一条被合并的 MR 会出现在这里</span></span>`;
        track.classList.remove("is-moving");
        return;
      }
      const group = `<span class="tk-group">${shown.map(itemHtml).join("")}</span>`;
      track.innerHTML = group + group;
      track.classList.add("is-moving");
      measure();
    },
  };
}
