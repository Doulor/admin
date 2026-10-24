// 比赛的计分规则（#278，所有者 2026-10-24 13:45）：年级系数、可选的奖项、贡献从哪些 GitLab 项目收集。
//
// 没有 competition_rules 行的比赛用默认系数、没有奖项；第一期的种子在 lib/db.ts。系数按百分数存（150 = 1.5），
// 避免小数在库里和接口里来回转出误差。年级只从 lib/grade.ts 的 gradeOf(入学年份, 记分时刻) 来，这里不另算。
import type Database from "better-sqlite3";
import { gradeOf } from "./grade.js";

export const GRADE_KEYS = ["year1", "year2", "year3", "year4", "graduated", "none"] as const;
export type GradeKey = typeof GRADE_KEYS[number];
export const GRADE_KEY_LABELS: Record<GradeKey, string> = { year1: "大一", year2: "大二", year3: "大三", year4: "大四", graduated: "已毕业", none: "无年级" };
export const DEFAULT_GRADE_FACTORS: Record<GradeKey, number> = { year1: 150, year2: 130, year3: 110, year4: 100, graduated: 100, none: 100 };
/** 系数的允许范围（百分数）：0.5–3 倍。 */
export const GRADE_FACTOR_RANGE = { min: 50, max: 300 } as const;
export const PRIZE_LIMITS = { tiers: 20, maxRank: 100, maxAmount: 100_000, titleLength: 40 } as const;
export const GITLAB_PROJECT_PATTERN = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,4}$/;
export const GITLAB_PROJECTS_MAX = 10;

export type PrizeTier = { from: number; to: number; amount_cny: number; title: string };
export type CompetitionRules = {
  grade_factors: Record<GradeKey, number>;
  prizes: PrizeTier[];
  gitlab_projects: string[];
  updated_at: number | null;
  updated_by: string | null;
};
export type RulesInput = { grade_factors: Record<GradeKey, number>; prizes: PrizeTier[]; gitlab_projects: string[] };
export type RulesError = "bad_grade_factor" | "bad_prizes" | "bad_gitlab_project";
export const RULES_ERRORS: Record<RulesError, { status: number; message: string }> = {
  bad_grade_factor: { status: 400, message: "年级系数要在 0.5 到 3 之间" },
  bad_prizes: { status: 400, message: "奖项的名次要从小到大、不能重叠，金额是不超过 100000 的整数" },
  bad_gitlab_project: { status: 400, message: "GitLab 项目要写成 group/project，最多 10 个" },
};

/** 记分时刻 `at` 的年级键：入学年份没填或在将来时是 none。 */
export function gradeKeyAt(enrollmentYear: number | null, at: number): GradeKey {
  const grade = gradeOf(enrollmentYear, at);
  if (grade === null) return "none";
  return grade === "graduated" ? "graduated" : (`year${grade}` as GradeKey);
}

/** 加权后的分：扣分不乘系数（作弊对谁都一样扣 50），其余按百分数四舍五入。 */
export function weightedPoints(points: number, factor: number): number {
  return points < 0 ? points : Math.round(points * factor / 100);
}

/** 奖项表能不能用：名次从 1 起、每档 from ≤ to、按顺序不重叠，金额是非负整数。 */
export function prizesProblem(prizes: PrizeTier[]): boolean {
  if (prizes.length > PRIZE_LIMITS.tiers) return true;
  let last = 0;
  for (const tier of prizes) {
    if (!Number.isInteger(tier.from) || !Number.isInteger(tier.to) || tier.from < 1 || tier.to < tier.from || tier.to > PRIZE_LIMITS.maxRank) return true;
    if (tier.from <= last) return true;
    if (!Number.isInteger(tier.amount_cny) || tier.amount_cny < 0 || tier.amount_cny > PRIZE_LIMITS.maxAmount) return true;
    if (typeof tier.title !== "string" || tier.title.length > PRIZE_LIMITS.titleLength) return true;
    last = tier.to;
  }
  return false;
}

/** 某个名次拿哪一档奖（没有为 null）。 */
export function prizeForRank(prizes: PrizeTier[], rank: number): PrizeTier | null {
  return prizes.find(tier => rank >= tier.from && rank <= tier.to) ?? null;
}

type RulesRow = { grade_factors: string; prizes: string; updated_at: number; updated_by: string | null };

export function createCompetitionRulesStore(db: Database.Database) {
  const selectRules = db.prepare("SELECT grade_factors, prizes, updated_at, updated_by FROM competition_rules WHERE competition_id = ?");
  const upsertRules = db.prepare(`INSERT INTO competition_rules(competition_id, grade_factors, prizes, updated_at, updated_by) VALUES(@id, @factors, @prizes, @now, @by)
    ON CONFLICT(competition_id) DO UPDATE SET grade_factors = excluded.grade_factors, prizes = excluded.prizes, updated_at = excluded.updated_at, updated_by = excluded.updated_by`);
  const selectSources = db.prepare("SELECT project_path FROM competition_gitlab_sources WHERE competition_id = ? ORDER BY project_path");
  const deleteSources = db.prepare("DELETE FROM competition_gitlab_sources WHERE competition_id = ?");
  const insertSource = db.prepare("INSERT OR IGNORE INTO competition_gitlab_sources(competition_id, project_path) VALUES(?, ?)");
  const selectEnrollment = db.prepare("SELECT enrollment_year FROM account_profiles WHERE account_id = ?");

  function parseFactors(text: string): Record<GradeKey, number> {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { parsed = {}; }
    const factors = { ...DEFAULT_GRADE_FACTORS };
    for (const key of GRADE_KEYS) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isInteger(value) && value >= GRADE_FACTOR_RANGE.min && value <= GRADE_FACTOR_RANGE.max) factors[key] = value;
    }
    return factors;
  }
  function parsePrizes(text: string): PrizeTier[] {
    try {
      const parsed = JSON.parse(text) as PrizeTier[];
      return Array.isArray(parsed) && !prizesProblem(parsed) ? parsed.map(tier => ({ from: tier.from, to: tier.to, amount_cny: tier.amount_cny, title: tier.title })) : [];
    } catch {
      return [];
    }
  }

  function get(competitionId: string): CompetitionRules {
    const row = selectRules.get(competitionId) as RulesRow | undefined;
    return {
      grade_factors: row ? parseFactors(row.grade_factors) : { ...DEFAULT_GRADE_FACTORS },
      prizes: row ? parsePrizes(row.prizes) : [],
      gitlab_projects: (selectSources.all(competitionId) as { project_path: string }[]).map(item => item.project_path),
      updated_at: row?.updated_at ?? null,
      updated_by: row?.updated_by ?? null,
    };
  }

  /** 整份替换；调用方负责比赛存在、没有定榜、授权与操作记录。 */
  function update(competitionId: string, input: RulesInput, actorAccountId: string, now: number): { ok: true; value: CompetitionRules } | { ok: false; error: RulesError } {
    for (const key of GRADE_KEYS) {
      const value = input.grade_factors[key];
      if (!Number.isInteger(value) || value < GRADE_FACTOR_RANGE.min || value > GRADE_FACTOR_RANGE.max) return { ok: false, error: "bad_grade_factor" };
    }
    const prizes = input.prizes.map(tier => ({ from: tier.from, to: tier.to, amount_cny: tier.amount_cny, title: tier.title.trim() }));
    if (prizesProblem(prizes)) return { ok: false, error: "bad_prizes" };
    const projects = [...new Set(input.gitlab_projects.map(path => path.trim()))];
    if (projects.length > GITLAB_PROJECTS_MAX || projects.some(path => !GITLAB_PROJECT_PATTERN.test(path))) return { ok: false, error: "bad_gitlab_project" };
    const factors = Object.fromEntries(GRADE_KEYS.map(key => [key, input.grade_factors[key]]));
    upsertRules.run({ id: competitionId, factors: JSON.stringify(factors), prizes: JSON.stringify(prizes), now, by: actorAccountId });
    deleteSources.run(competitionId);
    for (const path of projects) insertSource.run(competitionId, path);
    return { ok: true, value: get(competitionId) };
  }

  /** 记分那一刻这个人的年级和系数；年级只从入学年份按北京时间的学年现算（lib/grade.ts）。 */
  function factorFor(competitionId: string, accountId: string, at: number): { grade: GradeKey; factor: number } {
    const row = selectEnrollment.get(accountId) as { enrollment_year: number | null } | undefined;
    const grade = gradeKeyAt(row?.enrollment_year ?? null, at);
    return { grade, factor: get(competitionId).grade_factors[grade] };
  }

  return { get, update, factorFor };
}
export type CompetitionRulesStore = ReturnType<typeof createCompetitionRulesStore>;
