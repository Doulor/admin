// 比赛积分账本与天梯（#239 第二部分）：组织者登记 Issue / PR / 扣分，天梯按报名与队伍现算。
//
// 规则与报名组队一样只在服务端：只接普通参数与 `now`；一条记录只改状态（active / revoked），撤销留痕。
// 个人榜包含本场全部 active 报名者（0 分也列），队伍分 = 当前在队成员个人分之和；人数与成员来自报名存储。
// 年级加权（#278）：每条记录在登记那一刻记下年级和系数（competition-rules-store 的 factorFor），天梯加的是
// weighted_points，之后改系数、升年级都不回头重算已经记下的分。定榜之后（competition_finals 有行）不能再加分或撤销。
// 两档评定（#278，所有者 2026-10-24 16:59）：Issue 与 PR 登记时选重要程度和核心度，基础分查 competition-rubric 的表，
// 不收手填分数；同一人同一周第 2 条起的「一般 × 边缘」按防刷规则打折（记下 damp_percent，之后撤销前面的也不回头改）。
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { CompetitionStore } from "./competition-store.js";
import type { CompetitionSignupStore, Person } from "./competition-signup-store.js";
import type { CompetitionRulesStore } from "./competition-rules-store.js";
import {
  PENALTY_POINTS, WEEK_LENGTH_MS, basePoints, dampPercent, isCore, isImportance, isTrivial, weekStart, weightedPoints,
  type Core, type GradeKey, type Importance,
} from "./competition-rubric.js";

export type ScoreKind = "issue" | "pr" | "penalty";
/** `created_by_login` 取登记人账号当前绑定的 GitHub 登录名，不存快照。 */
export type ScoreEvent = {
  id: string;
  competition_id: string;
  person: Person;
  kind: ScoreKind;
  repo: string | null;
  number: number | null;
  /** 基础分：Issue 与 PR 是两档查表的结果，扣分是 -50。 */
  points: number;
  /** 两档评定；扣分和两档评定上线之前登记的为 null。 */
  importance: Importance | null;
  core: Core | null;
  /** 记分那一刻的年级与系数（百分数）；#278 之前登记的为 null，按系数 1 算。 */
  grade: GradeKey | null;
  grade_factor: number | null;
  /** 防刷折扣（百分数）：100 是照算，0 是这一周的「一般 × 边缘」已经算过一条。之前登记的为 null。 */
  damp_percent: number | null;
  weighted_points: number;
  /** 贡献发生的时间（MR 合并、Issue 创建）；控制台手工登记的等于登记时间，之前登记的为 null。 */
  contributed_at: number | null;
  reason: string;
  status: "active" | "revoked";
  created_by_login: string;
  created_at: number;
  revoked_at: number | null;
  revoke_reason: string | null;
};
export type LeaderboardIndividual = {
  rank: number;
  person: Person;
  team: { id: string; name: string } | null;
  points: number;
  issues: number;
  prs: number;
  penalties: number;
};
export type LeaderboardTeam = {
  rank: number;
  team: { id: string; name: string; status: "recruiting" | "locked" };
  points: number;
  member_count: number;
};
export type Leaderboard = { updated_at: number; individuals: LeaderboardIndividual[]; teams: LeaderboardTeam[] };

export type ScoreErrorCode =
  | "not_found" | "scoring_not_enabled" | "not_signed_up"
  | "bad_repo" | "bad_number" | "bad_levels" | "duplicate_score_event" | "already_revoked" | "competition_finalized";
export const SCORE_ERRORS: Record<ScoreErrorCode, { status: number; message: string }> = {
  not_found: { status: 404, message: "比赛或积分记录不存在" },
  scoring_not_enabled: { status: 409, message: "这场比赛没有开启积分" },
  not_signed_up: { status: 409, message: "这位成员没有报名这场比赛" },
  bad_repo: { status: 400, message: "请填写 owner/name 形式的仓库（GitLab 子组写成 group/sub/project）" },
  bad_number: { status: 400, message: "Issue 或 PR 编号必须是正整数" },
  bad_levels: { status: 400, message: "Issue 和 PR 要选重要程度和核心度，扣分不选" },
  duplicate_score_event: { status: 409, message: "同一条 Issue 或 PR 已经记过分" },
  already_revoked: { status: 409, message: "这条积分已经撤销过了" },
  competition_finalized: { status: 409, message: "这场比赛已经定榜，积分不能再改" },
};
export type ScoreFailure = { ok: false; error: ScoreErrorCode };
export type ScoreResult<T> = { ok: true; value: T } | ScoreFailure;
const failure = (error: ScoreErrorCode): ScoreFailure => ({ ok: false, error });

/** owner/name；GitLab 的子组项目多几段（group/sub/project），最多五段。 */
export const REPO_PATTERN = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,4}$/;

export type ScoreEventInput = {
  account_id: string; kind: ScoreKind; repo?: string | null; number?: number | null;
  importance?: Importance | null; core?: Core | null; reason?: string;
  /** 贡献发生的时间；不给就是登记时间。防刷按它所在的那一周数。 */
  contributed_at?: number;
};
/** 登记之前算一遍这条会记多少分（控制台表单实时显示），和 add 用同一套算法。 */
export type ScorePreview = { points: number; grade: GradeKey | null; grade_factor: number; damp_percent: number; weighted_points: number };

type EventRow = {
  id: string; competition_id: string; account_id: string; kind: string; repo: string | null; number: number | null;
  points: number; reason: string; status: string; created_by: string; created_at: number;
  revoked_by: string | null; revoked_at: number | null; revoke_reason: string | null;
  grade: string | null; grade_factor: number | null; weighted_points: number | null;
  importance: string | null; core: string | null; damp_percent: number | null; contributed_at: number | null;
};
type TotalsRow = { account_id: string; kind: string; points: number; status: string; created_at: number };
/** 定榜用的严格名次：同分时先到这个分的在前（最后一条有效记录更早），再按报名先后、账号 id，不并列。 */
export type Standing = { rank: number; account_id: string; points: number; reached_at: number; signed_up_at: number };

export interface CompetitionScoreStore {
  list(competitionId: string): ScoreResult<ScoreEvent[]>;
  add(competitionId: string, actorAccountId: string, input: ScoreEventInput, now: number): ScoreResult<ScoreEvent>;
  preview(competitionId: string, input: ScoreEventInput, now: number): ScoreResult<ScorePreview>;
  revoke(competitionId: string, actorAccountId: string, eventId: string, reason: string, now: number): ScoreResult<ScoreEvent>;
  leaderboard(competitionId: string): ScoreResult<Leaderboard>;
  /** 严格名次（不并列），定榜用；只含 active 报名者。 */
  standings(competitionId: string): Standing[];
  isFinalized(competitionId: string): boolean;
}

export function createCompetitionScoreStore(
  db: Database.Database,
  competitions: Pick<CompetitionStore, "get">,
  signups: CompetitionSignupStore,
  rules: Pick<CompetitionRulesStore, "factorFor">,
): CompetitionScoreStore {
  const selectEvents = db.prepare("SELECT * FROM competition_score_events WHERE competition_id = ? ORDER BY created_at DESC, rowid DESC");
  const selectEvent = db.prepare("SELECT * FROM competition_score_events WHERE competition_id = ? AND id = ?");
  const selectDuplicate = db.prepare(`SELECT id FROM competition_score_events
    WHERE competition_id = ? AND kind = ? AND repo = ? AND number = ? AND status = 'active'`);
  const insertEvent = db.prepare(`INSERT INTO competition_score_events(id, competition_id, account_id, kind, repo, number, points, reason, status, created_by, created_at,
      grade, grade_factor, weighted_points, importance, core, damp_percent, contributed_at)
    VALUES(@id, @competition_id, @account_id, @kind, @repo, @number, @points, @reason, 'active', @created_by, @now,
      @grade, @grade_factor, @weighted_points, @importance, @core, @damp_percent, @contributed_at)`);
  // 防刷数的是这一周照算了的有效记录：照算的那条被撤销后，下一条又能照算；之前登记的行 importance 为空，不算进来
  const countTrivial = db.prepare(`SELECT COUNT(*) AS n FROM competition_score_events
    WHERE competition_id = ? AND account_id = ? AND status = 'active' AND importance = 'normal' AND core = 'edge' AND damp_percent = 100
      AND COALESCE(contributed_at, created_at) >= ? AND COALESCE(contributed_at, created_at) < ?`);
  const revokeEvent = db.prepare("UPDATE competition_score_events SET status = 'revoked', revoked_by = ?, revoked_at = ?, revoke_reason = ? WHERE id = ?");
  const selectTotals = db.prepare("SELECT account_id, kind, COALESCE(weighted_points, points) AS points, status, created_at FROM competition_score_events WHERE competition_id = ?");
  const selectFinal = db.prepare("SELECT 1 AS n FROM competition_finals WHERE competition_id = ?");
  const isFinalized = (competitionId: string) => Boolean(selectFinal.get(competitionId));
  const selectLatestTouch = db.prepare("SELECT COALESCE(MAX(COALESCE(revoked_at, created_at)), 0) AS n FROM competition_score_events WHERE competition_id = ?");

  const eventView = (row: EventRow): ScoreEvent => ({
    id: row.id,
    competition_id: row.competition_id,
    person: signups.person(row.account_id),
    kind: row.kind as ScoreKind,
    repo: row.repo,
    number: row.number,
    points: row.points,
    importance: isImportance(row.importance) ? row.importance : null,
    core: isCore(row.core) ? row.core : null,
    grade: (row.grade as GradeKey | null) ?? null,
    grade_factor: row.grade_factor,
    damp_percent: row.damp_percent,
    weighted_points: row.weighted_points ?? row.points,
    contributed_at: row.contributed_at,
    reason: row.reason,
    status: row.status === "revoked" ? "revoked" : "active",
    created_by_login: signups.person(row.created_by).login,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    revoke_reason: row.revoke_reason,
  });

  function list(competitionId: string): ScoreResult<ScoreEvent[]> {
    if (!competitions.get(competitionId)) return failure("not_found");
    return { ok: true, value: (selectEvents.all(competitionId) as EventRow[]).map(eventView) };
  }

  /** 校验并算分：两档查表 → 年级系数 → 防刷折扣。add 与 preview 共用。 */
  function compute(competitionId: string, input: ScoreEventInput, now: number): ScoreResult<ScorePreview & {
    importance: Importance | null; core: Core | null; contributed_at: number;
  }> {
    if (!competitions.get(competitionId)) return failure("not_found");
    if (isFinalized(competitionId)) return failure("competition_finalized");
    if (signups.settingsOf(competitionId).scoring !== "contribution") return failure("scoring_not_enabled");
    if (!signups.activeSignups(competitionId).some(person => person.account_id === input.account_id)) return failure("not_signed_up");
    const contributedAt = input.contributed_at ?? now;
    const { grade, factor } = rules.factorFor(competitionId, input.account_id, now);
    if (input.kind === "penalty") {
      if (input.importance != null || input.core != null) return failure("bad_levels");
      // 扣分不乘系数，记下的系数也写 100，免得以后看记录的人以为扣分被放大或缩小过
      return { ok: true, value: { points: PENALTY_POINTS, grade, grade_factor: 100, damp_percent: 100, weighted_points: PENALTY_POINTS, importance: null, core: null, contributed_at: contributedAt } };
    }
    if (!isImportance(input.importance) || !isCore(input.core)) return failure("bad_levels");
    const points = basePoints(input.kind, input.importance, input.core);
    let damp = 100;
    if (isTrivial(input.importance, input.core)) {
      const from = weekStart(contributedAt);
      damp = dampPercent((countTrivial.get(competitionId, input.account_id, from, from + WEEK_LENGTH_MS) as { n: number }).n);
    }
    return {
      ok: true,
      value: {
        points, grade, grade_factor: factor, damp_percent: damp, weighted_points: weightedPoints(points, factor, damp),
        importance: input.importance, core: input.core, contributed_at: contributedAt,
      },
    };
  }

  function preview(competitionId: string, input: ScoreEventInput, now: number): ScoreResult<ScorePreview> {
    const result = compute(competitionId, input, now);
    if (!result.ok) return result;
    const { points, grade, grade_factor, damp_percent, weighted_points } = result.value;
    return { ok: true, value: { points, grade, grade_factor, damp_percent, weighted_points } };
  }

  function add(competitionId: string, actorAccountId: string, input: ScoreEventInput, now: number): ScoreResult<ScoreEvent> {
    const computed = compute(competitionId, input, now);
    if (!computed.ok) return computed;
    const reason = (input.reason ?? "").trim();
    // 只有 Issue 与 PR 带仓库和编号；扣分是一条针对人的记录，不带这两个字段。
    const repo = input.kind === "penalty" ? null : (input.repo ?? "").trim();
    const number = input.kind === "penalty" ? null : input.number ?? null;
    if (input.kind !== "penalty") {
      if (!repo || !REPO_PATTERN.test(repo)) return failure("bad_repo");
      if (!number || !Number.isInteger(number) || number < 1) return failure("bad_number");
    }
    if (selectDuplicate.get(competitionId, input.kind, repo, number)) return failure("duplicate_score_event");
    const id = randomUUID();
    const value = computed.value;
    insertEvent.run({
      id, competition_id: competitionId, account_id: input.account_id, kind: input.kind,
      repo, number, points: value.points, reason, created_by: actorAccountId, now,
      grade: value.grade, grade_factor: value.grade_factor, weighted_points: value.weighted_points,
      importance: value.importance, core: value.core, damp_percent: value.damp_percent, contributed_at: value.contributed_at,
    });
    return { ok: true, value: eventView(selectEvent.get(competitionId, id) as EventRow) };
  }

  function revoke(competitionId: string, actorAccountId: string, eventId: string, reason: string, now: number): ScoreResult<ScoreEvent> {
    const row = selectEvent.get(competitionId, eventId) as EventRow | undefined;
    if (!row) return failure("not_found");
    if (isFinalized(competitionId)) return failure("competition_finalized");
    if (row.status === "revoked") return failure("already_revoked");
    revokeEvent.run(actorAccountId, now, reason.trim(), eventId);
    return { ok: true, value: eventView(selectEvent.get(competitionId, eventId) as EventRow) };
  }

  /** 天梯：同分按最早报名，并列同名次（1,1,3）；队伍分 = 当前在队成员的个人分之和。 */
  function leaderboard(competitionId: string): ScoreResult<Leaderboard> {
    const record = competitions.get(competitionId);
    if (!record || record.offline) return failure("not_found");
    if (signups.settingsOf(competitionId).scoring !== "contribution") return failure("scoring_not_enabled");
    const totals = new Map<string, { points: number; issues: number; prs: number; penalties: number }>();
    for (const row of selectTotals.all(competitionId) as TotalsRow[]) {
      if (row.status !== "active") continue;
      const entry = totals.get(row.account_id) ?? { points: 0, issues: 0, prs: 0, penalties: 0 };
      entry.points += row.points;
      if (row.kind === "issue") entry.issues += 1;
      else if (row.kind === "pr") entry.prs += 1;
      else entry.penalties += 1;
      totals.set(row.account_id, entry);
    }
    const teamsResult = signups.teams(competitionId);
    const teamViews = teamsResult.ok ? teamsResult.value : [];
    const teamOf = new Map<string, { id: string; name: string; status: "recruiting" | "locked" }>();
    for (const team of teamViews) {
      for (const member of team.members) teamOf.set(member.account_id, { id: team.id, name: team.name, status: team.status });
    }
    const rows = signups.activeSignups(competitionId).map(person => {
      const total = totals.get(person.account_id) ?? { points: 0, issues: 0, prs: 0, penalties: 0 };
      const team = teamOf.get(person.account_id);
      return {
        rank: 0, person,
        team: team ? { id: team.id, name: team.name } : null,
        points: total.points, issues: total.issues, prs: total.prs, penalties: total.penalties,
        signed_up_at: person.created_at,
      };
    });
    rows.sort((a, b) => b.points - a.points || a.signed_up_at - b.signed_up_at
      || (a.person.account_id < b.person.account_id ? -1 : 1));
    let lastPoints: number | null = null;
    let lastRank = 0;
    const individuals: LeaderboardIndividual[] = rows.map(({ signed_up_at: _signedUpAt, ...row }, index) => {
      if (row.points !== lastPoints) {
        lastRank = index + 1;
        lastPoints = row.points;
      }
      return { ...row, rank: lastRank };
    });

    const teamRows = teamViews.map(team => ({
      rank: 0,
      team: { id: team.id, name: team.name, status: team.status },
      points: team.members.reduce((sum, member) => sum + (totals.get(member.account_id)?.points ?? 0), 0),
      member_count: team.member_count,
      created_at: team.created_at,
    }));
    teamRows.sort((a, b) => b.points - a.points || a.created_at - b.created_at || (a.team.id < b.team.id ? -1 : 1));
    lastPoints = null;
    lastRank = 0;
    const teams: LeaderboardTeam[] = teamRows.map(({ created_at: _createdAt, ...row }, index) => {
      if (row.points !== lastPoints) {
        lastRank = index + 1;
        lastPoints = row.points;
      }
      return { ...row, rank: lastRank };
    });

    return {
      ok: true,
      value: {
        updated_at: (selectLatestTouch.get(competitionId) as { n: number }).n,
        individuals,
        teams,
      },
    };
  }

  function standings(competitionId: string): Standing[] {
    const totals = new Map<string, { points: number; reached_at: number }>();
    for (const row of selectTotals.all(competitionId) as TotalsRow[]) {
      if (row.status !== "active") continue;
      const entry = totals.get(row.account_id) ?? { points: 0, reached_at: 0 };
      entry.points += row.points;
      entry.reached_at = Math.max(entry.reached_at, row.created_at);
      totals.set(row.account_id, entry);
    }
    const rows = signups.activeSignups(competitionId).map(person => ({
      account_id: person.account_id,
      points: totals.get(person.account_id)?.points ?? 0,
      reached_at: totals.get(person.account_id)?.reached_at ?? 0,
      signed_up_at: person.created_at,
    }));
    rows.sort((a, b) => b.points - a.points || a.reached_at - b.reached_at || a.signed_up_at - b.signed_up_at
      || (a.account_id < b.account_id ? -1 : 1));
    return rows.map((row, index) => ({ rank: index + 1, ...row }));
  }

  return { list, add, preview, revoke, leaderboard, standings, isFinalized };
}
