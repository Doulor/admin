// 实时天梯（个人 / 队伍两个页签）与统计条：前三名是领奖台（高度 2:3:1.6，依次是第二、第一、第三），
// 第四名起是列表，带一条按最高分归一化的进度条。名次变了，列表行从旧位置滑到新位置；分数变化时数字滚动、
// 那一行闪一下；有彗星正在飞向某一行时，那一行先停在旧分数，等彗星到了再滚。减少动态效果时不滑不闪。
import type { Leaderboard, LeaderboardEntry, LeaderboardTeam, PublicPerson, Stats } from "@shared/competition-sdk";
import { avatarHtml, errorHtml, escapeHtml, reducedMotion, rollNumber } from "./util";

const LIST_LIMIT = 50;
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_TONES = ["pink", "violet", "amber"];

type Row = { key: string; rank: number; score: number; title: string; sub: string; people: PublicPerson[] };

const individualRows = (items: LeaderboardEntry[]): Row[] => items.map(item => ({
  key: `u:${item.username}`, rank: item.rank, score: item.score, title: item.display_name || item.username,
  sub: `@${item.username}${item.team_name ? ` · ${item.team_name}` : ""}`, people: [item],
}));
const teamRows = (items: LeaderboardTeam[]): Row[] => items.map(item => ({
  key: `t:${item.name}`, rank: item.rank, score: item.score, title: item.name,
  sub: `${item.members.length} 人`, people: item.members,
}));

function stack(people: PublicPerson[], limit = 4): string {
  const shown = people.slice(0, limit).map(person => avatarHtml(person, "avatar avatar-sm")).join("");
  const more = people.length > limit ? `<span class="avatar avatar-sm avatar-more">+${people.length - limit}</span>` : "";
  return `<span class="avatar-stack">${shown}${more}</span>`;
}

function podiumHtml(rows: Row[], team: boolean): string {
  const top = rows.slice(0, 3);
  if (top.length === 0) return "";
  const slots = PODIUM_ORDER.map(index => {
    const row = top[index];
    if (!row) return `<div class="podium-slot is-empty" aria-hidden="true"><div class="podium-block place-${index + 1}"></div></div>`;
    const face = team ? stack(row.people, 3) : avatarHtml(row.people[0], "avatar avatar-lg");
    return `<div class="podium-slot" data-key="${escapeHtml(row.key)}">
      <div class="podium-face">${face}</div>
      <div class="podium-block place-${index + 1} tone-${PODIUM_TONES[index]}"><span class="podium-rank">${row.rank}</span></div>
      <p class="podium-name">${escapeHtml(row.title)}</p>
      <p class="podium-sub">${escapeHtml(row.sub)}</p>
      <p class="podium-score"><b class="score" data-value="${row.score}">${row.score.toLocaleString("zh-CN")}</b> 分</p>
    </div>`;
  }).join("");
  return `<div class="podium">${slots}</div>`;
}

function listHtml(rows: Row[], team: boolean): string {
  const rest = rows.slice(3, LIST_LIMIT);
  if (rest.length === 0) return "";
  const max = Math.max(1, ...rows.map(row => row.score));
  const items = rest.map(row => `<li class="board-row" data-key="${escapeHtml(row.key)}">
      <span class="row-rank">${row.rank}</span>
      ${team ? stack(row.people, 3) : avatarHtml(row.people[0])}
      <span class="row-name"><b>${escapeHtml(row.title)}</b><small>${escapeHtml(row.sub)}</small></span>
      <span class="row-bar" aria-hidden="true"><i style="width:${Math.max(2, Math.round((Math.max(0, row.score) / max) * 100))}%"></i></span>
      <span class="row-score"><b class="score" data-value="${row.score}">${row.score.toLocaleString("zh-CN")}</b> 分</span>
    </li>`).join("");
  const hidden = rows.length > LIST_LIMIT ? `<p class="board-more">另有 ${rows.length - LIST_LIMIT} ${team ? "支队伍" : "人"}没有列出</p>` : "";
  return `<ol class="board-list" start="4">${items}</ol>${hidden}`;
}

export function createBoard(root: HTMLElement) {
  const panels = { individual: root.querySelector<HTMLElement>('[data-slot="individual"]')!, team: root.querySelector<HTMLElement>('[data-slot="team"]')! };
  const stats = root.querySelector<HTMLElement>('[data-slot="stats"]')!;
  const meta = root.querySelector<HTMLElement>('[data-slot="board-meta"]')!;
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  let previous = new Map<string, number>();
  const hasRendered = new WeakSet<HTMLElement>();
  let hasData = false;

  function select(index: number, focus = false) {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")!)!.hidden = !on;
      if (on && focus) tab.focus();
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index));
    tab.addEventListener("keydown", event => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      select((index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true);
    });
  });

  function renderPanel(panel: HTMLElement, rows: Row[], team: boolean, held: Set<string>) {
    if (rows.length === 0) {
      panel.innerHTML = `<p class="empty">${team ? "还没有队伍。" : "还没有人报名。"}</p>`;
      return;
    }
    const before = new Map<string, number>();
    if (!panel.hidden) for (const node of panel.querySelectorAll<HTMLElement>(".board-row[data-key]")) before.set(node.dataset.key!, node.getBoundingClientRect().top);
    panel.innerHTML = podiumHtml(rows, team) + listHtml(rows, team);
    if (!hasRendered.has(panel)) {
      hasRendered.add(panel);
      panel.classList.add("is-first");
      setTimeout(() => panel.classList.remove("is-first"), 1600);
    } else if (before.size && !reducedMotion()) {
      for (const node of panel.querySelectorAll<HTMLElement>(".board-row[data-key]")) {
        const old = before.get(node.dataset.key!);
        const shift = old === undefined ? 0 : old - node.getBoundingClientRect().top;
        if (Math.abs(shift) > 1) node.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.9,.25,1)" });
      }
    }
    for (const node of panel.querySelectorAll<HTMLElement>("[data-key]")) {
      const key = node.dataset.key!;
      const score = node.querySelector<HTMLElement>(".score")!;
      const now = Number(score.dataset.value);
      const before = previous.get(key);
      if (before === undefined || before === now) continue;
      score.dataset.value = String(before);
      score.textContent = before.toLocaleString("zh-CN");
      if (held.has(key)) continue; // 等彗星到了再滚
      rollNumber(score, now);
      flash(node);
    }
  }

  function flash(node: Element) {
    if (reducedMotion()) return;
    node.classList.remove("is-flash");
    void (node as HTMLElement).offsetWidth;
    node.classList.add("is-flash");
  }

  return {
    /** 渲染天梯；held 里是还在等彗星的行（`u:<username>`），它们先停在旧分数。 */
    render(board: Leaderboard, held: Set<string> = new Set()) {
      hasData = true;
      const individuals = individualRows(board.individuals);
      const teams = teamRows(board.teams);
      renderPanel(panels.individual, individuals, false, held);
      renderPanel(panels.team, teams, true, held);
      previous = new Map([...individuals, ...teams].map(row => [row.key, row.score]));
    },
    renderStats(value: Stats) {
      const items: [string, number][] = [["参赛", value.participants], ["队伍", value.teams], ["合并的 MR", value.merged_prs], ["采纳的 Issue", value.accepted_issues], ["总分", value.total_points]];
      if (!stats.childElementCount) {
        stats.innerHTML = items.map(([label, n]) => `<div class="stat"${label === "队伍" ? " data-team-only" : ""}><b data-value="${n}">${n.toLocaleString("zh-CN")}</b><span>${label}</span></div>`).join("");
        return;
      }
      stats.querySelectorAll<HTMLElement>(".stat b").forEach((node, i) => rollNumber(node, items[i][1]));
    },
    setMeta(text: string) {
      meta.textContent = text;
    },
    /** 彗星到了：那一行滚到新分数并闪一下。 */
    land(key: string) {
      const node = panels.individual.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
      if (!node) return;
      const score = node.querySelector<HTMLElement>(".score")!;
      const target = previous.get(key);
      if (target !== undefined) rollNumber(score, target);
      flash(node);
    },
    rowFor(key: string): Element | null {
      if (panels.individual.hidden) return null;
      return panels.individual.querySelector(`[data-key="${CSS.escape(key)}"]`);
    },
    fail() {
      if (hasData) return false;
      panels.individual.innerHTML = errorHtml();
      panels.team.innerHTML = errorHtml();
      stats.innerHTML = "";
      return true;
    },
  };
}
