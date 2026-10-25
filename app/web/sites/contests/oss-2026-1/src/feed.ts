// 贡献动态：竖直时间流，每条是头像、昵称、动作、两档（重要程度 × 核心度）、标题、加分胶囊与相对时间。扣分只写「被扣分」，不写原因。
// 刷新时把新出现的条目插到最前面并返回它们，main.ts 用它们放彗星；「再看 20 条」按游标往后翻。
import type { CompetitionClient, Feed, FeedItem } from "@shared/competition-sdk";
import { FALLBACK } from "../site.config";
import { iconSvg } from "./icons";
import { avatarHtml, errorHtml, escapeHtml, formatPoints, relativeTime } from "./util";

const ACTIONS: Record<FeedItem["kind"], string> = { pr: "合并了 MR", issue: "提交的 Issue 被采纳", penalty: "被扣分" };
const LEVEL_LABELS = new Map<string, string>([...FALLBACK.scoring.importance, ...FALLBACK.scoring.core].map(item => [item.key, item.label]));
/** 被防刷规则记成 0 分的「一般 × 边缘」：加一句原因，免得看成漏算。 */
const isDamped = (item: FeedItem) => item.kind !== "penalty" && item.points === 0 && item.importance === "normal" && item.core === "edge";
const levelsText = (item: FeedItem) => (item.importance && item.core ? `${LEVEL_LABELS.get(item.importance) ?? item.importance} × ${LEVEL_LABELS.get(item.core) ?? item.core}` : "");

function itemHtml(item: FeedItem, fresh: boolean): string {
  const name = escapeHtml(item.display_name || item.username);
  const title = item.title
    ? item.url
      ? `<a class="feed-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}${iconSvg("external-link-line", "icon icon-xs")}</a>`
      : `<span class="feed-title">${escapeHtml(item.title)}</span>`
    : "";
  const tone = item.kind === "penalty" ? "tone-bad" : item.kind === "pr" ? "tone-violet" : "tone-lime";
  return `<li class="feed-item kind-${item.kind}${fresh ? " is-new" : ""}" data-id="${escapeHtml(item.id)}">
    ${avatarHtml(item)}
    <div class="feed-main">
      <p class="feed-line"><b>${name}</b><span class="feed-user">@${escapeHtml(item.username)}</span><span class="feed-action">${ACTIONS[item.kind]}</span>${levelsText(item) ? `<span class="feed-levels">${escapeHtml(levelsText(item))}</span>` : ""}${isDamped(item) ? `<span class="feed-damped">本周的「一般 × 边缘」已算过一条，这条记 0 分</span>` : ""}</p>
      ${title}
    </div>
    <div class="feed-side">
      <b class="chip ${tone}" data-points>${formatPoints(item.points)}</b>
      <time datetime="${new Date(item.at).toISOString()}" data-at="${item.at}">${relativeTime(item.at)}</time>
    </div>
  </li>`;
}

export function createFeed(root: HTMLElement, client: CompetitionClient) {
  const list = root.querySelector<HTMLOListElement>('[data-slot="feed"]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-slot="feed-more"]')!;
  let items: FeedItem[] = [];
  let cursor: string | null = null;
  let loaded = false;
  let loadingMore = false;

  function render(freshIds: Set<string>) {
    if (items.length === 0) {
      list.innerHTML = `<li class="empty">还没有计分的贡献。第一条被标「有用」的 Issue 或 MR 会出现在这里。</li>`;
    } else {
      list.innerHTML = items.map(item => itemHtml(item, freshIds.has(item.id))).join("");
    }
    more.hidden = !cursor;
  }

  more.addEventListener("click", async () => {
    if (!cursor || loadingMore) return;
    loadingMore = true;
    more.disabled = true;
    more.textContent = "正在读取";
    try {
      const page = await client.getFeed({ cursor });
      const known = new Set(items.map(item => item.id));
      items = [...items, ...page.items.filter(item => !known.has(item.id))];
      cursor = page.next_cursor;
      render(new Set());
      more.textContent = "再看 20 条";
    } catch {
      more.textContent = "没取到，再点一次";
    } finally {
      loadingMore = false;
      more.disabled = false;
    }
  });

  // 相对时间每分钟刷新一次
  setInterval(() => {
    for (const node of list.querySelectorAll<HTMLElement>("time[data-at]")) node.textContent = relativeTime(Number(node.dataset.at));
  }, 60_000);

  return {
    /** 合并最新一页；返回这次新出现的条目（第一次加载不算新的）。 */
    update(page: Feed): FeedItem[] {
      const known = new Set(items.map(item => item.id));
      const fresh = loaded ? page.items.filter(item => !known.has(item.id)) : [];
      // 第一页覆盖掉已撤销的条目：只保留新一页里有的，再接上之前多翻出来的
      const firstIds = new Set(page.items.map(item => item.id));
      const oldest = page.items.at(-1);
      const tail = oldest ? items.filter(item => !firstIds.has(item.id) && (item.at < oldest.at || (item.at === oldest.at && item.id < oldest.id))) : [];
      items = [...page.items, ...tail];
      if (!loaded || tail.length === 0) cursor = page.next_cursor;
      loaded = true;
      render(new Set(fresh.map(item => item.id)));
      return fresh;
    },
    chipFor(id: string): Element | null {
      return list.querySelector(`[data-id="${CSS.escape(id)}"] [data-points]`);
    },
    fail() {
      if (loaded) return false;
      list.innerHTML = `<li>${errorHtml()}</li>`;
      more.hidden = true;
      return true;
    },
  };
}
