// 比赛（#238）的数据：官网桌面「比赛」窗口读 GET /api/public/competitions。
//
// 状态一律按时间戳本地算（`statusAt`，与服务端 `competitionStatus` 同一套口径），窗口开着时每 60 秒重算一次，
// 免得在午夜前后停在旧状态上；服务端响应里的 `status` 只当形状校验，不作为展示来源。
// 读不到（离线、接口不通、开发预览没有这份数据）时标记失败，窗口显示「没加载出来」并给「重试」，而不是冒充「没有比赛」。
// 窗口里的日期与文案（截止、赛程、操作条）在 competitionLabels.ts。
import { useCallback, useEffect, useState } from "react";
import { api } from "@shared/lib/api";

export type CompetitionKind = "internal" | "external";
export type CompetitionStatus = "planning" | "upcoming" | "registering" | "closed" | "ongoing" | "ended";
export type Participation = "individual" | "team";
/**
 * 内部赛的在线报名设置（#239）：组织者在控制台打开；`scoring: "contribution"` 是按合入的 Issue / PR 计分的天梯。
 * 外部赛一律在官网报名，读进来就是 NO_SIGNUP。
 */
export type SignupSettings = { enabled: boolean; participation: Participation; team_min: number; team_max: number; scoring: "none" | "contribution" };
export const NO_SIGNUP: SignupSettings = { enabled: false, participation: "individual", team_min: 1, team_max: 1, scoring: "none" };
export type Competition = {
  id: string; name: string; kind: CompetitionKind;
  start_at: number; end_at: number; signup_deadline: number | null;
  url: string | null; description: string; status: CompetitionStatus;
  /** 规划中（#278）：和服务端一样，本地每 60 秒重算状态要用到它，不能只在第一次解析时看一眼。 */
  planning: boolean;
  signup: SignupSettings;
  /** 这场比赛已发布的官网（#278，`/c/<slug>/`）；没发布或服务端还没给这个字段时是 null。 */
  site_url: string | null;
  /** 奖项（#278，可选）：名次从小到大，没有奖项是空数组。 */
  prizes: PrizeTier[];
  /** 年级系数（#278）：只有开了积分的内部赛才有意义，按服务端给的顺序（大一到无年级）。 */
  grade_factors: GradeFactor[];
  /** 两档计分表（#278）：重要程度 × 核心度查基础分、扣分与防刷规则；服务端没给或形状不对时是 null，不显示半张表。 */
  scoring: Scoring | null;
  /** 定榜时间（#278）：定榜后名次不再变，得奖的人在「我的参赛」看到兑奖码；没定榜是 null。 */
  finalized_at: number | null;
};
export type PrizeTier = { from: number; to: number; amount_cny: number; title: string };
export type GradeFactor = { grade: string; label: string; factor: number };
export type ScoringLevel = { key: string; label: string; hint: string };
export type Scoring = {
  importance: ScoringLevel[];
  core: ScoringLevel[];
  /** `points[kind][importance][core]`：基础分。 */
  points: Record<"issue" | "pr", Record<string, Record<string, number>>>;
  penalty: number; trivial_per_week: number; trivial_percent: number;
};

export const COMPETITIONS_URL = "/api/public/competitions";

const KINDS: CompetitionKind[] = ["internal", "external"];
const STATUSES: CompetitionStatus[] = ["planning", "upcoming", "registering", "closed", "ongoing", "ended"];
/** 只认识要用的那几个字段：缺 `id`、名称或起止时间的条目直接丢掉，不显示半条。 */
type RawCompetition = {
  id?: unknown; name?: unknown; kind?: unknown; start_at?: unknown; end_at?: unknown; signup_deadline?: unknown; url?: unknown; description?: unknown; status?: unknown; signup?: unknown;
  site_url?: unknown; prizes?: unknown; grade_factors?: unknown; scoring?: unknown; finalized_at?: unknown; planning?: unknown;
};

// 北京时间显示还要加八小时；UTC 有效但换算后越界的时间也不能交给界面。
const asTimestamp = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && Number.isFinite(new Date(value + 8 * 3600_000).getTime()) ? value : null;
const asText = (value: unknown): string => (typeof value === "string" ? value : "");
/** 比赛官网只认本站的 `/c/<slug>/`，别的写法当作没有，不拿去拼外链。 */
const SITE_PATH = /^\/c\/[a-z0-9][a-z0-9-]*\/$/;
const rankOf = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 100 ? value : null);

/** 奖项：名次是 1–100 的整数且 from ≤ to、金额是不小于 0 的整数，否则丢掉这一档，不显示「第 3–1 名」。 */
export function readPrizes(value: unknown): PrizeTier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): PrizeTier[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const tier = raw as { from?: unknown; to?: unknown; amount_cny?: unknown; title?: unknown };
    const from = rankOf(tier.from);
    const to = rankOf(tier.to);
    const amount = typeof tier.amount_cny === "number" && Number.isSafeInteger(tier.amount_cny) && tier.amount_cny >= 0 ? tier.amount_cny : null;
    if (from === null || to === null || from > to || amount === null) return [];
    return [{ from, to, amount_cny: amount, title: asText(tier.title) }];
  });
}

/** 年级系数：要有年级名和一个大于 0 的系数。 */
export function readGradeFactors(value: unknown): GradeFactor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): GradeFactor[] => {
    if (typeof raw !== "object" || raw === null) return [];
    const item = raw as { grade?: unknown; label?: unknown; factor?: unknown };
    const label = asText(item.label);
    if (!label || typeof item.factor !== "number" || !Number.isFinite(item.factor) || item.factor <= 0) return [];
    return [{ grade: asText(item.grade) || label, label, factor: item.factor }];
  });
}

/** 两档计分表：每一档要有 key 和名字，每个格子都要有整数分；缺一格就整张不显示。 */
export function readScoring(value: unknown): Scoring | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as { importance?: unknown; core?: unknown; points?: unknown; penalty?: unknown; trivial_per_week?: unknown; trivial_percent?: unknown };
  const levels = (list: unknown): ScoringLevel[] | null => {
    if (!Array.isArray(list) || !list.length) return null;
    const out = list.map((item) => {
      const level = (typeof item === "object" && item !== null ? item : {}) as { key?: unknown; label?: unknown; hint?: unknown };
      return { key: asText(level.key), label: asText(level.label), hint: asText(level.hint) };
    });
    return out.every((level) => level.key && level.label) ? out : null;
  };
  const importance = levels(raw.importance);
  const core = levels(raw.core);
  const whole = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
  if (!importance || !core || !Array.isArray(raw.points) || !whole(raw.penalty) || !whole(raw.trivial_per_week) || !whole(raw.trivial_percent)) return null;
  const points: Scoring["points"] = { issue: {}, pr: {} };
  for (const item of raw.points as { kind?: unknown; importance?: unknown; core?: unknown; points?: unknown }[]) {
    if (typeof item !== "object" || item === null || (item.kind !== "issue" && item.kind !== "pr") || !whole(item.points)) continue;
    (points[item.kind][asText(item.importance)] ??= {})[asText(item.core)] = item.points;
  }
  const complete = (["issue", "pr"] as const).every((kind) => importance.every((i) => core.every((c) => whole(points[kind][i.key]?.[c.key]))));
  return complete ? { importance, core, points, penalty: raw.penalty, trivial_per_week: raw.trivial_per_week, trivial_percent: raw.trivial_percent } : null;
}

/**
 * 读一条比赛。`id`、名称、起止时间缺一不可。服务端给的 `status` 认不出时按时间现算，
 * 不把状态显示错；所有类型的比赛都可以带有效的 https 链接。
 */
export function readCompetition(value: unknown): Competition | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as RawCompetition;
  const id = asText(raw.id);
  const name = asText(raw.name);
  const start = asTimestamp(raw.start_at);
  const end = asTimestamp(raw.end_at);
  if (!id || !name || start === null || end === null || end < start) return null;
  const kind = KINDS.includes(raw.kind as CompetitionKind) ? (raw.kind as CompetitionKind) : "internal";
  const signup_deadline = asTimestamp(raw.signup_deadline);
  const planning = raw.planning === true;
  const status = STATUSES.includes(raw.status as CompetitionStatus)
    ? (raw.status as CompetitionStatus)
    : statusAt({ start_at: start, end_at: end, signup_deadline, planning }, Date.now());
  const link = asText(raw.url);
  let url: string | null = null;
  try {
    if (/^https:\/\/\S+$/.test(link) && new URL(link).protocol === "https:") url = link;
  } catch {
    // 无效链接不妨碍读取赛事的其余公开信息。
  }
  const signup = kind === "internal" ? readSignup(raw.signup) : NO_SIGNUP;
  const site = asText(raw.site_url);
  const site_url = SITE_PATH.test(site) ? site : null;
  return {
    id, name, kind, start_at: start, end_at: end, signup_deadline, url, description: asText(raw.description), status, planning, signup, site_url,
    prizes: readPrizes(raw.prizes), grade_factors: readGradeFactors(raw.grade_factors), scoring: readScoring(raw.scoring),
    finalized_at: asTimestamp(raw.finalized_at),
  };
}

/**
 * 读报名设置：缺了、没开、或队伍人数说不通（最少大于最多、不在 1–50 人）都当没开在线报名，
 * 不显示「每队 3–1 人」这种规则。个人赛的人数固定是 1。
 */
export function readSignup(value: unknown): SignupSettings {
  if (typeof value !== "object" || value === null) return NO_SIGNUP;
  const raw = value as { enabled?: unknown; participation?: unknown; team_min?: unknown; team_max?: unknown; scoring?: unknown };
  const team = raw.participation === "team";
  const size = (n: unknown) => (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 50 ? n : null);
  const min = team ? size(raw.team_min) : 1;
  const max = team ? size(raw.team_max) : 1;
  if (raw.enabled !== true || min === null || max === null || min > max) return NO_SIGNUP;
  return { enabled: true, participation: team ? "team" : "individual", team_min: min, team_max: max, scoring: raw.scoring === "contribution" ? "contribution" : "none" };
}

/** 服务端 `competitionStatus` 的同一套口径（含规划中），用于接口没给状态或值认不出时兜底，也用于窗口开着时
 *  每 60 秒的本地重算——`planning` 打开且还没到开赛时间时压过其余规则，过了开赛时间就不再生效。 */
export function statusAt(record: { start_at: number; end_at: number; signup_deadline: number | null; planning: boolean }, now: number): CompetitionStatus {
  if (record.planning && now < record.start_at) return "planning";
  if (now > record.end_at) return "ended";
  if (record.signup_deadline !== null && now <= record.signup_deadline) return "registering";
  if (now >= record.start_at) return "ongoing";
  return record.signup_deadline === null ? "upcoming" : "closed";
}

/** 读响应：只留读得出来的条目，保持服务端给的顺序。 */
export function readCompetitions(body: unknown): Competition[] {
  if (typeof body !== "object" || body === null || !Array.isArray((body as { competitions?: unknown }).competitions)) {
    throw new Error("Invalid competitions response");
  }
  const list = (body as { competitions: unknown[] }).competitions;
  return list.map(readCompetition).filter((item): item is Competition => item !== null);
}

export type CompetitionFeed = {
  items: Competition[];
  failed: boolean;
  loading: boolean;
  /** 这一次渲染用的当前时间：状态、排序和「还剩几天」都按它算，同一屏不会各算各的。 */
  now: number;
  /** 读失败后重读一次（「重试」按钮）。 */
  reload: () => void;
};

/**
 * 窗口打开时读一次，关掉即取消；`reload` 再读一次。窗口开着时每 60 秒按当前时间重算一次状态：
 * 报名在半夜截止、或比赛当天开始时，界面不用等刷新就能跟上。
 *
 * 展示用的状态一律按本地时间算（`statusAt`），不看服务端给的 `status`：
 * 两者口径相同，但服务端那条只在响应到达时算一次，窗口一直开着就不动了。
 */
export function useCompetitions(): CompetitionFeed {
  const [items, setItems] = useState<Competition[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [, tick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<unknown>(COMPETITIONS_URL, { signal: controller.signal, headers: { Accept: "application/json" } }).then(
      (body) => {
        if (controller.signal.aborted) return;
        setItems(readCompetitions(body));
        setFailed(false);
        setLoading(false);
      },
    ).catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  const now = Date.now();
  const current = items.map((item) => ({ ...item, status: statusAt(item, now) })).sort((a, b) => {
    const aEnded = now > a.end_at;
    const bEnded = now > b.end_at;
    if (aEnded !== bEnded) return aEnded ? 1 : -1;
    return (aEnded ? b.start_at - a.start_at : a.start_at - b.start_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  return { items: current, failed, loading, now, reload };
}

/** 时间戳 → 北京时间的 `YYYY-MM-DD`。 */
export function beijingDay(at: number): string {
  const d = new Date(at + 8 * 3600_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 北京时间的某一天 → 时间戳；`start` 是当天 00:00:00.000，`end` 是当天末毫秒。日期不存在时给 null。 */
export function beijingDayEdge(date: string, edge: "start" | "end"): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const midnight = Date.UTC(y, m - 1, d) - 8 * 3600_000;
  if (beijingDay(midnight) !== date) return null;
  return edge === "start" ? midnight : midnight + 24 * 3600_000 - 1;
}

/** 本年省略年份；跨年赛事保留年份，按北京时间判断当前年。 */
export function shortDay(at: number, now = Date.now()): string {
  const date = beijingDay(at);
  const year = beijingDay(now).split("-")[0];
  return date.startsWith(`${year}-`) ? date.slice(year.length + 1) : date;
}

/** 比赛时间：起止在北京时间同一天时只写一个日期，跨天才写「10-26 至 10-28」，不出现「10-26 至 10-26」。 */
export function dayRange(start: number, end: number, now = Date.now()): string {
  const from = shortDay(start, now);
  return beijingDay(start) === beijingDay(end) ? from : `${from} 至 ${shortDay(end, now)}`;
}
