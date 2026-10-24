// 比赛官网起步模板（#278）：演示站点包必带的几个接口怎么接——比赛信息、人员、队伍、奖励，加天梯。
// 完整字段、每个接口的决策点见 docs/services/server/contest-site-quickstart.md；
// 开发时先 `node scripts/contest-site.mjs dev <构建产物目录>` 看带示例数据的效果，不用先接真实后端。
import "./styles.css";
import { createClient, type Participant, type PublicCompetition, type TeamEntry } from "@shared/competition-sdk";
import { SITE } from "../site.config";

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const client = createClient({ competition: SITE.competition_id });

// 报名、组队都是主站链接，在新标签页打开；不要自己拼地址，服务端给的 app_url 换了也不用改这份代码。
$('[data-slot="signup"]').setAttribute("href", client.signupUrl());

function renderCompetition(competition: PublicCompetition) {
  $('[data-slot="name"]').textContent = competition.name;
  $('[data-slot="description"]').textContent = competition.description;
}

/**
 * 奖励（站点包必带的接口，但可选）：这场比赛没设置奖励时 `prizes` 是空数组，不是错误——
 * 调用方判断「空就不画这一段」，不要把空数组当成接口失败去重试。
 */
function renderPrizes(prizes: PublicCompetition["prizes"]) {
  const slot = $('[data-slot="prizes"]');
  if (prizes.length === 0) { slot.innerHTML = "<p>这场比赛没有设置奖励。</p>"; return; }
  slot.innerHTML = `<ul>${prizes.map(tier =>
    `<li>第 ${tier.from === tier.to ? `${tier.from} 名` : `${tier.from}–${tier.to} 名`}：${tier.amount_cny} 元${tier.title ? `（${tier.title}）` : ""}</li>`,
  ).join("")}</ul>`;
}

function renderBoard(individuals: { rank: number; display_name: string; team_name: string | null; score: number }[]) {
  const slot = $('[data-slot="board"]');
  if (individuals.length === 0) { slot.innerHTML = "<p>还没有人上榜。</p>"; return; }
  slot.innerHTML = `<ol>${individuals.map(row =>
    `<li>第 ${row.rank} 名　${row.display_name}${row.team_name ? `（${row.team_name}）` : ""}　${row.score} 分</li>`,
  ).join("")}</ol>`;
}

/** 人员：全部已报名的参赛者，不是只有拿过分的人。超过一页时用 `next_cursor` 继续翻，这里只演示翻到底。 */
async function renderPeople() {
  const slot = $('[data-slot="people"]');
  const people: Participant[] = [];
  let cursor: string | null = null;
  do {
    const page = await client.getParticipants({ cursor });
    people.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  if (people.length === 0) { slot.innerHTML = "<p>还没有人报名。</p>"; return; }
  slot.innerHTML = `<ul>${people.map(person =>
    `<li>${person.display_name}${person.department ? `　${person.department.name}` : ""}</li>`,
  ).join("")}</ul>`;
}

/**
 * 队伍：个人赛调 `getTeams()` 不会报错，`enabled` 为 false 时直接跳过这一段——不用先判断这场比赛
 * 是不是团队赛再决定调不调这个接口。
 */
function renderTeams(teams: { enabled: boolean; teams: TeamEntry[] }) {
  const section = $('[data-slot="teams"]').closest("section")!;
  if (!teams.enabled) { section.hidden = true; return; }
  const slot = $('[data-slot="teams"]');
  if (teams.teams.length === 0) { slot.innerHTML = "<p>还没有队伍。</p>"; return; }
  slot.innerHTML = `<ul>${teams.teams.map(team =>
    `<li>${team.name}${team.status === "recruiting" ? "（还在招募）" : ""}　${team.member_count} 人：${team.members.map(member => member.display_name).join("、")}</li>`,
  ).join("")}</ul>`;
}

async function boot() {
  try {
    const [competition, board, teams] = await Promise.all([client.getCompetition(), client.getLeaderboard(), client.getTeams()]);
    renderCompetition(competition);
    renderPrizes(competition.prizes);
    renderBoard(board.individuals);
    renderTeams(teams);
    await renderPeople();
  } catch {
    // 接口失败时给一句能重试的提示，不要让页面停在「正在读取」——和 oss-2026-1 的处理方式一致。
    $('[data-slot="name"]').textContent = "数据暂时取不到，稍后自动重试";
    setTimeout(boot, 5_000);
  }
}

void boot();
