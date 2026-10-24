// 比赛的公开读模型（#278，CONTRACT-278 §2）：官网 SDK 与匿名访客读的天梯、贡献动态、统计和整份快照。
//
// 只给公开字段：昵称、@用户名、头像、队名、分数、贡献标题与链接、时间。不给邮箱、account_id、真实姓名、IP，
// 扣分不给原因。人的展示资料取统一资料 account_profiles（用户名、显示名、头像），没上传头像时用 GitHub 头像。
// 定榜之后个人名次换成定榜快照里的严格名次（和发奖用的一致），定榜前同分并列（1,1,3）。
import type Database from "better-sqlite3";
import { avatarPath } from "./account-profiles.js";
import { toPublicCompetition, type CompetitionRecord, type CompetitionStore } from "./competition-store.js";
import type { CompetitionSignupStore } from "./competition-signup-store.js";
import type { CompetitionScoreStore } from "./competition-score-store.js";
import { GRADE_KEYS, GRADE_KEY_LABELS, type CompetitionRulesStore, type PrizeTier } from "./competition-rules-store.js";
import { isCore, isImportance, scoringView, type Core, type Importance } from "./competition-rubric.js";
import type { CompetitionSiteStore } from "./competition-site-store.js";

export type PublicPerson = { username: string; display_name: string; avatar_url: string | null };
export type PublicLeaderboard = {
  updated_at: number;
  individuals: (PublicPerson & { rank: number; team_name: string | null; score: number })[];
  teams: { rank: number; name: string; members: PublicPerson[]; score: number }[];
};
export type PublicFeedItem = PublicPerson & {
  id: string; at: number; kind: "pr" | "issue" | "penalty"; title: string | null; url: string | null; points: number;
  importance: Importance | null; core: Core | null;
};
export type PublicFeed = { items: PublicFeedItem[]; next_cursor: string | null };
export type PublicStats = { participants: number; teams: number; merged_prs: number; accepted_issues: number; total_points: number; updated_at: number };
export type PublicGradeFactor = { grade: string; label: string; factor: number };

export const FEED_PAGE_SIZE = 20;
export const FEED_PAGE_MAX = 50;
/** 公开接口的服务端缓存：天梯「几秒到十几秒」内更新（所有者 2026-10-24），写入时按比赛主动清掉。 */
export const PUBLIC_CACHE_TTL_MS = 10_000;
export const publicCacheKey = (competitionId: string, part: string) => `competition-public:${competitionId}:${part}`;
export const publicCachePrefix = (competitionId: string) => `competition-public:${competitionId}:`;

/** 门户比赛窗口里这场比赛的深链（`?open=competitions&competition=<id>`，YugcOs 打开窗口、CompetitionsApp 选中这场）。 */
export const competitionAppUrl = (competitionId: string) => `/?open=competitions&competition=${encodeURIComponent(competitionId)}`;

type ProfileRow = { username: string | null; display_name: string; avatar_hash: string | null };
type FeedRow = {
  id: string; account_id: string; kind: string; points: number; weighted_points: number | null; created_at: number;
  importance: string | null; core: string | null; title: string | null; url: string | null;
};

const encodeCursor = (at: number, id: string) => Buffer.from(`${at}:${id}`, "utf8").toString("base64url");
function decodeCursor(cursor: string): { at: number; id: string } | null {
  const text = Buffer.from(cursor, "base64url").toString("utf8");
  const match = /^([0-9]{1,15}):([0-9a-f-]{36})$/.exec(text);
  return match ? { at: Number(match[1]), id: match[2] } : null;
}

export function createCompetitionPublic(db: Database.Database, deps: {
  competitions: Pick<CompetitionStore, "get">;
  signups: Pick<CompetitionSignupStore, "settingsOf" | "person" | "activeSignups" | "teams">;
  scores: Pick<CompetitionScoreStore, "leaderboard">;
  rules: Pick<CompetitionRulesStore, "get">;
  sites: Pick<CompetitionSiteStore, "site">;
}) {
  const selectProfile = db.prepare("SELECT username, display_name, avatar_hash FROM account_profiles WHERE account_id = ?");
  const selectFinal = db.prepare("SELECT finalized_at, standings FROM competition_finals WHERE competition_id = ?");
  const selectFeedFirst = db.prepare(`SELECT e.id, e.account_id, e.kind, e.points, e.weighted_points, e.created_at, e.importance, e.core, c.title, c.url
    FROM competition_score_events e LEFT JOIN competition_score_candidates c ON c.score_event_id = e.id
    WHERE e.competition_id = ? AND e.status = 'active' ORDER BY e.created_at DESC, e.id DESC LIMIT ?`);
  const selectFeedAfter = db.prepare(`SELECT e.id, e.account_id, e.kind, e.points, e.weighted_points, e.created_at, e.importance, e.core, c.title, c.url
    FROM competition_score_events e LEFT JOIN competition_score_candidates c ON c.score_event_id = e.id
    WHERE e.competition_id = ? AND e.status = 'active' AND (e.created_at < ? OR (e.created_at = ? AND e.id < ?))
    ORDER BY e.created_at DESC, e.id DESC LIMIT ?`);
  const selectCounts = db.prepare(`SELECT
      SUM(CASE WHEN kind = 'pr' THEN 1 ELSE 0 END) AS prs,
      SUM(CASE WHEN kind = 'issue' THEN 1 ELSE 0 END) AS issues,
      COALESCE(SUM(COALESCE(weighted_points, points)), 0) AS total
    FROM competition_score_events WHERE competition_id = ? AND status = 'active'`);

  /** 一个人的公开资料；没上传头像时退回 GitHub 头像（signups.person 给的），都没有为 null。 */
  function personOf(accountId: string): PublicPerson {
    const row = selectProfile.get(accountId) as ProfileRow | undefined;
    const fallback = deps.signups.person(accountId);
    const username = row?.username || fallback.login || "member";
    return {
      username,
      display_name: row?.display_name?.trim() || username,
      avatar_url: row?.avatar_hash ? avatarPath(row.avatar_hash) : fallback.avatar_url,
    };
  }

  /** 门户与官网能看到的比赛：存在且没下线。 */
  function visible(competitionId: string): CompetitionRecord | null {
    const record = deps.competitions.get(competitionId);
    return record && !record.offline ? record : null;
  }

  function finalOf(competitionId: string): { finalized_at: number; ranks: Map<string, number> } | null {
    const row = selectFinal.get(competitionId) as { finalized_at: number; standings: string } | undefined;
    if (!row) return null;
    const ranks = new Map<string, number>();
    try {
      for (const item of JSON.parse(row.standings) as { account_id: string; rank: number }[]) ranks.set(item.account_id, item.rank);
    } catch { /* 快照读不出来时按并列名次显示 */ }
    return { finalized_at: row.finalized_at, ranks };
  }

  const gradeFactors = (competitionId: string): PublicGradeFactor[] => {
    const factors = deps.rules.get(competitionId).grade_factors;
    return GRADE_KEYS.map(key => ({ grade: key, label: GRADE_KEY_LABELS[key], factor: factors[key] / 100 }));
  };

  /** 公开比赛对象：在 #238 的字段上加官网地址、门户深链、奖项、年级系数、两档计分表与定榜时间。 */
  function competition(record: CompetitionRecord, now: number) {
    const site = deps.sites.site(record.id);
    const prizes: PrizeTier[] = deps.rules.get(record.id).prizes;
    return {
      ...toPublicCompetition(record, now),
      signup: deps.signups.settingsOf(record.id),
      site_url: record.kind === "internal" && site?.live_version_id ? `/c/${site.slug}/` : null,
      app_url: competitionAppUrl(record.id),
      prizes,
      grade_factors: gradeFactors(record.id),
      scoring: scoringView(),
      finalized_at: finalOf(record.id)?.finalized_at ?? null,
    };
  }

  function leaderboard(competitionId: string): PublicLeaderboard | null {
    if (!visible(competitionId)) return null;
    const result = deps.scores.leaderboard(competitionId);
    if (!result.ok) return { updated_at: 0, individuals: [], teams: [] };
    const final = finalOf(competitionId);
    const individuals = result.value.individuals.map(row => ({
      rank: final?.ranks.get(row.person.account_id) ?? row.rank,
      ...personOf(row.person.account_id),
      team_name: row.team?.name ?? null,
      score: row.points,
    }));
    if (final) individuals.sort((a, b) => a.rank - b.rank);
    const teamsResult = deps.signups.teams(competitionId);
    const members = new Map<string, PublicPerson[]>();
    if (teamsResult.ok) for (const team of teamsResult.value) members.set(team.id, team.members.map(member => personOf(member.account_id)));
    return {
      updated_at: result.value.updated_at,
      individuals,
      teams: result.value.teams.map(row => ({ rank: row.rank, name: row.team.name, members: members.get(row.team.id) ?? [], score: row.points })),
    };
  }

  /** 贡献动态：有效的积分记录，新的在前；`cursor` 不合法时当第一页。 */
  function feed(competitionId: string, cursor: string | null, limit = FEED_PAGE_SIZE): PublicFeed | null {
    if (!visible(competitionId)) return null;
    const size = Math.min(Math.max(1, limit), FEED_PAGE_MAX);
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = (after
      ? selectFeedAfter.all(competitionId, after.at, after.at, after.id, size + 1)
      : selectFeedFirst.all(competitionId, size + 1)) as FeedRow[];
    const page = rows.slice(0, size);
    const last = page[page.length - 1];
    return {
      items: page.map(row => ({
        id: row.id,
        at: row.created_at,
        ...personOf(row.account_id),
        kind: row.kind === "penalty" ? "penalty" : row.kind === "issue" ? "issue" : "pr",
        title: row.kind === "penalty" ? null : row.title,
        url: row.kind === "penalty" ? null : row.url,
        points: row.weighted_points ?? row.points,
        importance: isImportance(row.importance) ? row.importance : null,
        core: isCore(row.core) ? row.core : null,
      })),
      next_cursor: rows.length > size && last ? encodeCursor(last.created_at, last.id) : null,
    };
  }

  function stats(competitionId: string): PublicStats | null {
    if (!visible(competitionId)) return null;
    const board = deps.scores.leaderboard(competitionId);
    const counts = selectCounts.get(competitionId) as { prs: number | null; issues: number | null; total: number };
    const teamsResult = deps.signups.teams(competitionId);
    return {
      participants: deps.signups.activeSignups(competitionId).length,
      teams: teamsResult.ok ? teamsResult.value.length : 0,
      merged_prs: counts.prs ?? 0,
      accepted_issues: counts.issues ?? 0,
      total_points: counts.total,
      updated_at: board.ok ? board.value.updated_at : 0,
    };
  }

  return { personOf, visible, competition, leaderboard, feed, stats, finalOf };
}
export type CompetitionPublic = ReturnType<typeof createCompetitionPublic>;
