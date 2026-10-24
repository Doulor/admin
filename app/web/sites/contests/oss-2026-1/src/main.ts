// 第一期比赛官网入口（#278）。页面托管在 /c/<slug>/，在 sandbox CSP 下运行：
// 来源是 null，只能匿名读同源的公开接口；报名、组队都是主站链接，在新标签页打开。
// 数据全部来自 SDK 的快照（每 15 秒一次）；接口失败时各段显示「数据暂时取不到，稍后自动重试」，首屏标题与倒计时照常。
import "./styles.css";
import { createClient, type FeedItem, type Snapshot } from "@shared/competition-sdk";
import { SITE } from "../site.config";
import { createBoard } from "./board";
import { createCountdown } from "./countdown";
import { createFeed } from "./feed";
import { createFx } from "./fx";
import { hydrateIcons } from "./icons";
import { failSlot, renderGradeFactors, renderPrizes, renderTeams, renderTexts, renderTimeline } from "./sections";
import { startTerminal } from "./terminal";
import { createTicker } from "./ticker";
import { createTitle } from "./title";
import { formatClock, installAvatarFallback, onMotionChange, reducedMotion } from "./util";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

document.documentElement.classList.add("js");
hydrateIcons();
installAvatarFallback();

const client = createClient({ competition: SITE.competition_id });
for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-link="signup"]')) link.href = client.signupUrl();
for (const node of document.querySelectorAll<HTMLElement>('[data-text="repository"]')) node.textContent = SITE.repository;
for (const node of document.querySelectorAll<HTMLElement>('[data-text="origin"]')) node.textContent = location.host || "本站";
for (const node of document.querySelectorAll<HTMLElement>('[data-text="refresh"]')) node.textContent = String(Math.round(SITE.refreshMs / 1000));

const title = createTitle($<HTMLCanvasElement>("#title"));
const countdown = createCountdown($(".countdown"), $('[data-text="phase"]'));
const ticker = createTicker($(".ticker"));
const board = createBoard($("#board"));
const feed = createFeed($("#feed"), client);
const fx = createFx();

title.start();
startTerminal($(".term"));
countdown.setTimes(SITE.fallback);
renderTimeline($('[data-slot="timeline"]'), { ...SITE.fallback, signup_deadline: null });
onMotionChange(() => title.redraw());

new IntersectionObserver(([entry]) => title.setVisible(entry.isIntersecting)).observe($(".hero"));

// 页内跳转：平滑滚动并把焦点交给目标段落（读屏和键盘用户跟着走）
for (const link of document.querySelectorAll<HTMLAnchorElement>("a[data-scroll]")) {
  link.addEventListener("click", event => {
    const target = document.querySelector<HTMLElement>(link.getAttribute("href")!);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  });
}

// 各段出现时淡入上浮
const reveal = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("is-in"); reveal.unobserve(entry.target); }
}, { rootMargin: "0px 0px -8% 0px" });
document.querySelectorAll(".sec, .finale").forEach(node => reveal.observe(node));

let hasSnapshot = false;
const shown = { prizes: false, teams: false };

function apply(snapshot: Snapshot) {
  const { competition, leaderboard, stats } = snapshot;
  countdown.setTimes(competition);
  renderTimeline($('[data-slot="timeline"]'), competition);
  renderTexts(competition);
  renderGradeFactors($("#grade-list"), competition);
  renderPrizes($('[data-slot="prizes"]'), competition);
  shown.prizes = true;
  renderTeams($('[data-slot="teams"]'), leaderboard.teams, client.teamUrl());
  shown.teams = true;

  const fresh = feed.update(snapshot.feed);
  ticker.update(snapshot.feed.items);
  if (fresh.length) title.pulse();
  const flying = fresh.filter((item): item is FeedItem => item.kind !== "penalty" && item.points > 0).slice(0, 5);
  const held = new Set(flying.map(item => `u:${item.username}`));
  board.render(leaderboard, held);
  board.renderStats(stats);
  board.setMeta(competition.finalized_at
    ? "已定榜，名次不再变化"
    : `每 ${Math.round(SITE.refreshMs / 1000)} 秒刷新一次 · 最近更新 ${formatClock(leaderboard.updated_at)} · 分数已乘年级系数`);
  flying.forEach((item, index) => {
    const key = `u:${item.username}`;
    fx.launch(feed.chipFor(item.id), board.rowFor(key), () => board.land(key), index * 260);
  });

  hasSnapshot = true;
}

function fail() {
  board.fail();
  feed.fail();
  if (!shown.prizes) failSlot($('[data-slot="prizes"]'));
  if (!shown.teams) failSlot($('[data-slot="teams"]'));
  if (hasSnapshot) board.setMeta("数据暂时取不到，稍后自动重试；下面是上一次取到的结果");
}

client.subscribe(update => {
  if (update.error) fail();
  else apply(update);
}, { interval: SITE.refreshMs });
