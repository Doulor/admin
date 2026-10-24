// 跟着比赛数据变的几段：奖项、时间线、队伍，以及首屏、规则与常见问题里随设置变化的那几句话。计分表和年级系数在 scoring.ts。
import type { LeaderboardTeam, PublicCompetition } from "@shared/competition-sdk";
import { iconSvg } from "./icons";
import { avatarHtml, clamp, errorHtml, escapeHtml, formatClock, formatDay, formatDayTime, formatRanks, formatShortDay } from "./util";

const TEAMS_SHOWN = 12;
const PRIZE_TONES = ["violet", "pink", "amber", "lime", "sky"];

export function renderPrizes(slot: HTMLElement, competition: PublicCompetition) {
  if (competition.prizes.length === 0) {
    slot.innerHTML = `<p class="empty">这场比赛没有设奖项，名次照常公布。</p>`;
    return;
  }
  // 第一档单独放大，边框是一圈转动的渐变
  const cards = competition.prizes.map((tier, index) => `<li class="prize tone-${PRIZE_TONES[index % PRIZE_TONES.length]}${index === 0 ? " is-top" : ""}">
      <div class="prize-inner">
        <span class="prize-icon">${iconSvg(index === 0 ? "trophy-line" : "medal-line")}</span>
        <p class="prize-rank">${formatRanks(tier.from, tier.to)}</p>
        <p class="prize-amount"><b>${tier.amount_cny.toLocaleString("zh-CN")}</b> 元${tier.to > tier.from ? "<small>每人</small>" : ""}</p>
        ${tier.title ? `<p class="prize-title">${escapeHtml(tier.title)}</p>` : ""}
      </div>
    </li>`).join("");
  const final = competition.finalized_at
    ? `已于 ${formatDayTime(competition.finalized_at)} 定榜，名次不再变化。得奖的同学在主站「我的参赛」里看到兑奖码，凭兑奖码找组织者兑奖。`
    : "比赛结束后定榜。得奖的同学在主站「我的参赛」里看到兑奖码，凭兑奖码找组织者兑奖。奖只发给个人，得分为 0 的不发。";
  slot.innerHTML = `<ul class="prizes">${cards}</ul><p class="prize-note">${iconSvg("gift-line")}<span>${final}</span></p>`;
}

export function renderTimeline(slot: HTMLElement, times: { start_at: number; end_at: number; signup_deadline: number | null }, now = Date.now()) {
  const span = Math.max(1, times.end_at - times.start_at);
  const at = (value: number) => clamp((value - times.start_at) / span) * 100;
  const progress = at(now);
  const over = now > times.end_at;
  const before = now < times.start_at;
  const marker = before || over ? "" : `<span class="timeline-now" style="--at:${progress.toFixed(2)}%"><span class="timeline-pin">${iconSvg("time-line")}今天</span></span>`;
  const deadline = times.signup_deadline && times.signup_deadline > times.start_at && times.signup_deadline < times.end_at
    ? `<li class="timeline-stop" style="--at:${at(times.signup_deadline).toFixed(2)}%"><b>报名截止</b><span>${formatShortDay(times.signup_deadline)}</span></li>`
    : "";
  slot.innerHTML = `<div class="timeline${over ? " is-over" : ""}">
      <div class="timeline-track" role="progressbar" aria-label="比赛进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}">
        <span class="timeline-fill" style="--p:${progress.toFixed(2)}%"></span>
        ${marker}
      </div>
      <ol class="timeline-stops">
        <li class="timeline-stop is-start" style="--at:0%"><b>开赛</b><span>${formatShortDay(times.start_at)}</span></li>
        ${deadline}
        <li class="timeline-stop is-end" style="--at:100%"><b>截止</b><span>${formatShortDay(times.end_at)} ${formatClock(times.end_at)}</span></li>
      </ol>
      <p class="timeline-after">${iconSvg("flag-line")}<span>截止之后：组织者标记完最后一批贡献，定榜并公布结果。</span></p>
    </div>`;
}

export function renderTeams(slot: HTMLElement, teams: LeaderboardTeam[], teamUrl: string) {
  const join = `<a class="btn btn-ghost btn-sm" href="${escapeHtml(teamUrl)}" target="_blank" rel="noopener">去组队${iconSvg("external-link-line", "icon icon-xs")}</a>`;
  if (teams.length === 0) {
    slot.innerHTML = `<p class="empty">还没有队伍。</p><div class="teams-cta">${join}</div>`;
    return;
  }
  const card = (team: LeaderboardTeam) => `<li class="team">
      <p class="team-rank">第 ${team.rank} 名</p>
      <p class="team-name">${escapeHtml(team.name)}</p>
      <span class="avatar-stack">${team.members.map(member => avatarHtml(member, "avatar avatar-sm")).join("")}</span>
      <p class="team-score"><b>${team.score.toLocaleString("zh-CN")}</b> 分 · ${team.members.length} 人</p>
    </li>`;
  const shown = teams.slice(0, TEAMS_SHOWN).map(card).join("");
  const rest = teams.slice(TEAMS_SHOWN);
  const folded = rest.length
    ? `<details class="teams-rest"><summary>其余 ${rest.length} 支队伍${iconSvg("arrow-down-s-line")}</summary><ul class="teams">${rest.map(card).join("")}</ul></details>`
    : "";
  // 展开状态在刷新后保留
  const open = slot.querySelector<HTMLDetailsElement>(".teams-rest")?.open ?? false;
  slot.innerHTML = `<ul class="teams">${shown}</ul>${folded}<div class="teams-cta">${join}</div>`;
  const details = slot.querySelector<HTMLDetailsElement>(".teams-rest");
  if (details) details.open = open;
}

/** 规则、常见问题里随比赛设置变化的句子。 */
export function renderTexts(competition: PublicCompetition) {
  const signup = competition.signup;
  const team = signup.participation === "team";
  const size = signup.team_min === signup.team_max ? `${signup.team_max} 人` : `${signup.team_min} 到 ${signup.team_max} 人`;
  const deadline = competition.signup_deadline ? `，${formatDay(competition.signup_deadline)}前都能报` : "";
  for (const node of document.querySelectorAll<HTMLElement>('[data-text="team-rule"]')) {
    node.textContent = team
      ? `在主站的比赛窗口报名${deadline}。可以一个人参加，也可以组队，每队 ${size}。`
      : `在主站的比赛窗口报名${deadline}。这场比赛按个人计分。`;
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-text="faq-team"]')) {
    node.textContent = team
      ? `可以。一个人报名就是一人一队，个人榜和队伍榜上都会出现；想组队的，每队 ${size}。`
      : "可以，这场比赛本来就按个人计分。";
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-text="end-at"]')) node.textContent = formatDayTime(competition.end_at);
  for (const node of document.querySelectorAll<HTMLElement>('[data-text="kicker-team"]')) node.textContent = team ? "一个人或组队都能参加" : "按个人计分";
  for (const node of document.querySelectorAll<HTMLElement>('[data-text="span"]')) node.textContent = `${formatDay(competition.start_at)}到 ${formatDay(competition.end_at)}`;
  // 个人赛没有队伍：天梯的「个人 / 队伍」页签、「队伍」这一节和统计里的队伍数都不显示（styles.css 按 data-participation 藏），
  // 后面几节的编号顺延，不留空号。静态页面默认按第一期的个人赛写，读到设置后再改。
  document.documentElement.dataset.participation = team ? "team" : "individual";
  let index = 0;
  for (const node of document.querySelectorAll<HTMLElement>(".sec-no")) {
    if (!team && node.closest("[data-team-only]")) continue;
    index += 1;
    node.textContent = String(index).padStart(2, "0");
  }
}

export function failSlot(slot: HTMLElement) {
  slot.innerHTML = errorHtml();
}
