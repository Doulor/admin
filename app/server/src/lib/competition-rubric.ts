// 比赛怎么算分（#278，所有者 2026-10-24 16:59）：组织者把一条 Issue 或 MR 标记「有用」时选两档——重要程度和核心度，
// 基础分查下面的表，再乘记分那一刻的年级系数。不看代码行数、文件数和提交数。
//
// 表里的数落在 competition_score_events 已有的 CHECK 之内（Issue 5–30、MR 15–100），扣分固定 -50、不乘系数。
// 防刷：同一个人在同一周（北京时间周一 0 点起）里「一般 × 边缘」的记录只算第 1 条，后面的记 0 分（记录照留）。
// 年级系数的默认值由 scripts/contest-score-sim.mjs 的模拟选出（结果在 docs/plan/COMPETITION-APP.md「计分规则」）。
//
// 这个文件不导入任何模块：模拟脚本直接用 node 读它，算分的规则只有这一份。

export const IMPORTANCE = ["normal", "important", "critical"] as const;
export type Importance = typeof IMPORTANCE[number];
export const CORE = ["edge", "business", "core"] as const;
export type Core = typeof CORE[number];
export type RubricKind = "issue" | "pr";

export const IMPORTANCE_LABELS: Record<Importance, string> = { normal: "一般", important: "重要", critical: "关键" };
export const CORE_LABELS: Record<Core, string> = { edge: "边缘", business: "业务", core: "核心" };
/** 核心度三档各指什么，控制台下拉框与官网都用这一份。 */
export const CORE_HINTS: Record<Core, string> = { edge: "文档、样式、小脚本", business: "一个功能模块", core: "身份、权限、数据、计分、部署" };

/** 基础分：`RUBRIC[种类][重要程度][核心度]`。同样两档，MR 比 Issue 高。 */
export const RUBRIC: Record<RubricKind, Record<Importance, Record<Core, number>>> = {
  issue: {
    normal: { edge: 5, business: 8, core: 12 },
    important: { edge: 8, business: 14, core: 20 },
    critical: { edge: 12, business: 20, core: 30 },
  },
  pr: {
    normal: { edge: 15, business: 25, core: 40 },
    important: { edge: 25, business: 45, core: 65 },
    critical: { edge: 40, business: 65, core: 100 },
  },
};
export const PENALTY_POINTS = -50;

/** 防刷：每人每周「一般 × 边缘」前 `fullPerWeek` 条照算，之后按 `percent`%（0 就是不计分）。 */
export const DAMPING = { fullPerWeek: 1, percent: 0 } as const;

export const GRADE_KEYS = ["year1", "year2", "year3", "year4", "graduated", "none"] as const;
export type GradeKey = typeof GRADE_KEYS[number];
export const GRADE_KEY_LABELS: Record<GradeKey, string> = { year1: "大一", year2: "大二", year3: "大三", year4: "大四", graduated: "已毕业", none: "无年级" };
/** 默认年级系数（百分数，350 = 3.5 倍）。 */
export const DEFAULT_GRADE_FACTORS: Record<GradeKey, number> = { year1: 350, year2: 220, year3: 140, year4: 100, graduated: 100, none: 100 };
/** 系数的允许范围（百分数）：0.5–5 倍。 */
export const GRADE_FACTOR_RANGE = { min: 50, max: 500 } as const;

export const isImportance = (value: unknown): value is Importance => typeof value === "string" && (IMPORTANCE as readonly string[]).includes(value);
export const isCore = (value: unknown): value is Core => typeof value === "string" && (CORE as readonly string[]).includes(value);

export function basePoints(kind: RubricKind, importance: Importance, core: Core): number {
  return RUBRIC[kind][importance][core];
}

/** 「一般 × 边缘」：防刷规则只管这一格。 */
export function isTrivial(importance: Importance | null, core: Core | null): boolean {
  return importance === "normal" && core === "edge";
}

/** 这个人这一周已经有 `already` 条「一般 × 边缘」照算了（有效、没打折）时，新的一条按百分之几算。 */
export function dampPercent(already: number): number {
  return already >= DAMPING.fullPerWeek ? DAMPING.percent : 100;
}

const BEIJING_OFFSET_MS = 8 * 3600_000;
const DAY_MS = 24 * 3600_000;
export const WEEK_LENGTH_MS = 7 * DAY_MS;
/** `at` 所在那一周的开始：北京时间周一 0 点（毫秒时间戳）。 */
export function weekStart(at: number): number {
  const day = Math.floor((at + BEIJING_OFFSET_MS) / DAY_MS);
  // 1970-01-01 是周四：往回数到周一
  const monday = day - ((day + 3) % 7);
  return monday * DAY_MS - BEIJING_OFFSET_MS;
}

/** 加权分：扣分原样；其余乘年级系数（百分数），被防刷规则打折的再乘折扣，最后四舍五入。 */
export function weightedPoints(points: number, gradeFactor: number, dampPercent = 100): number {
  return points < 0 ? points : Math.round(points * gradeFactor * dampPercent / 10_000);
}

/** 公开比赛对象、控制台规则页里的 `scoring`：两档、基础分表、扣分与防刷规则，官网和门户照着画表。 */
export type ScoringView = {
  importance: { key: Importance; label: string }[];
  core: { key: Core; label: string; hint: string }[];
  points: { kind: RubricKind; importance: Importance; core: Core; points: number }[];
  penalty: number;
  trivial_per_week: number;
  trivial_percent: number;
};
export function scoringView(): ScoringView {
  return {
    importance: IMPORTANCE.map(key => ({ key, label: IMPORTANCE_LABELS[key] })),
    core: CORE.map(key => ({ key, label: CORE_LABELS[key], hint: CORE_HINTS[key] })),
    points: (["issue", "pr"] as const).flatMap(kind => IMPORTANCE.flatMap(importance => CORE.map(core => ({ kind, importance, core, points: RUBRIC[kind][importance][core] })))),
    penalty: PENALTY_POINTS,
    trivial_per_week: DAMPING.fullPerWeek,
    trivial_percent: DAMPING.percent,
  };
}
