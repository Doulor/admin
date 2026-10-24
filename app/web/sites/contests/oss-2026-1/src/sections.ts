// 跟着比赛数据变的几段：奖项、年级系数、时间线、队伍，以及规则与常见问题里随设置变化的那几句话。
import type { LeaderboardTeam, PublicCompetition } from "@shared/competition-sdk";
import { iconSvg } from "./icons";
import { avatarHtml, clamp, errorHtml, escapeHtml, formatClock, formatDay, formatDayTime, formatRanks, formatShortDay, formatYuan } from "./util";

const TEAMS_SHOWN = 12;
const PRIZE_TONES = ["y", "u", "g", "c"];

export function renderPrizes(slot: HTMLElement, competition: PublicCompetition) {
  if (competition.prizes.length === 0) {
    slot.innerHTML = `<p class="empty">这场比赛没有设奖项，名次照常公布。</p>`;
    return;
  }
  const cards = competition.prizes.map((tier, index) => `<li class="prize tone-${PRIZE_TONES[index % PRIZE_TONES.length]}">
      <span class="prize-icon">${iconSvg(index === 0 ? "trophy-line" : "medal-line")}</span>
      <p class="prize-rank">${formatRanks(tier.from, tier.to)}</p>
      <p class="prize-amount">${formatYuan(tier.amount_cny)}<small>${tier.to > tier.from ? "每人" : ""}</small></p>
      ${tier.title ? `<p class="prize-title">${escapeHtml(tier.title)}</p>` : ""}
    </li>`).join("");
  const final = competition.finalized_at
    ? `已于 ${formatDayTime(competition.finalized_at)} 定榜，名次不再变化。得奖的同学在主站「我的参赛」里看到兑奖码，凭兑奖码找组织者兑奖。`
    : "比赛结束后定榜。得奖的同学在主站「我的参赛」里看到兑奖码，凭兑奖码找组织者兑奖。奖只发给个人，得分为 0 的不发。";
  slot.innerHTML = `<ul class="prizes">${cards}</ul><p class="prize-note">${iconSvg("gift-line")}<span>${final}</span></p>`;
}

export function renderGradeFactors(list: HTMLElement, competition: PublicCompetition) {
  if (competition.grade_factors.length === 0) return;
  list.innerHTML = competition.grade_factors
    .map(item => `<li><span>${escapeHtml(item.label)}</span><b>×${item.factor.toFixed(1)}</b></li>`).join("");
}

export function renderTimeline(slot: HTMLElement, times: { start_at: number; end_at: number; signup_deadline: number | null }, now = Date.now()) {
  const span = Math.max(1, times.end_at - times.start_at);
  const at = (value: number) => clamp((value - times.start_at) / span) * 100;
  const progress = at(now);
  const over = now > times.end_at;
  const before = now < times.start_at;
  const marker = before || over ? "" : `<span class="timeline-now" style="--at:${progress.toFixed(2)}%"><span class="timeline-heart">${iconSvg("heart-3-fill")}</span><span class="timeline-today">今天</span></span>`;
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
  const join = `<a class="pill pill-soft" href="${escapeHtml(teamUrl)}" target="_blank" rel="noopener">去组队${iconSvg("external-link-line", "icon icon-xs")}</a>`;
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
}

export function failSlot(slot: HTMLElement) {
  slot.innerHTML = errorHtml();
}
