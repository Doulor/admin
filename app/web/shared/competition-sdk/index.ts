/**
 * 比赛官网 SDK（#278，CONTRACT-278 §3）：托管在 `/c/<slug>/` 的官网用它读比赛的公开接口。
 *
 * 官网在 sandbox CSP 下运行（来源是 null，读不到主站的 cookie），所以这里只发匿名的 GET，不带凭据；
 * 官网与主站同域，`origin` 默认是空串（同源相对地址）。构建出的 ESM 由 web 镜像放在 `/sdk/competition/v1.js`，
 * 官网也可以直接把这份源码打进自己的包。不依赖任何库，浏览器与 Node 18+ 都能跑。
 */

export type PublicPerson = { username: string; display_name: string; avatar_url: string | null };
export type CompetitionStatus = "upcoming" | "registering" | "closed" | "ongoing" | "ended";
export type PrizeTier = { from: number; to: number; amount_cny: number; title: string };
export type GradeFactor = { grade: string; label: string; factor: number };
export type Importance = "normal" | "important" | "critical";
export type Core = "edge" | "business" | "core";
/**
 * 两档计分表：组织者标记「有用」时选重要程度和核心度，基础分查 `points`，再乘年级系数；扣分 `penalty`、不乘系数；
 * 每人每周「一般 × 边缘」只照算前 `trivial_per_week` 条，之后按 `trivial_percent`%。
 */
export type Scoring = {
  importance: { key: Importance; label: string }[];
  core: { key: Core; label: string; hint: string }[];
  points: { kind: "issue" | "pr"; importance: Importance; core: Core; points: number }[];
  penalty: number;
  trivial_per_week: number;
  trivial_percent: number;
};

export type PublicCompetition = {
  id: string;
  name: string;
  kind: "internal" | "external";
  start_at: number;
  end_at: number;
  signup_deadline: number | null;
  url: string | null;
  description: string;
  status: CompetitionStatus;
  signup: { enabled: boolean; participation: "individual" | "team"; team_min: number; team_max: number; scoring: "none" | "contribution" };
  site_url: string | null;
  app_url: string;
  prizes: PrizeTier[];
  grade_factors: GradeFactor[];
  scoring: Scoring;
  finalized_at: number | null;
};

export type LeaderboardEntry = PublicPerson & { rank: number; team_name: string | null; score: number };
export type LeaderboardTeam = { rank: number; name: string; members: PublicPerson[]; score: number };
export type Leaderboard = { updated_at: number; individuals: LeaderboardEntry[]; teams: LeaderboardTeam[] };

/** `points` 已乘年级系数；`importance`、`core` 是标记时选的两档，扣分和两档评定之前的记录为 null。 */
export type FeedItem = PublicPerson & {
  id: string; at: number; kind: "pr" | "issue" | "penalty"; title: string | null; url: string | null; points: number;
  importance: Importance | null; core: Core | null;
};
export type Feed = { items: FeedItem[]; next_cursor: string | null };

export type Stats = { participants: number; teams: number; merged_prs: number; accepted_issues: number; total_points: number; updated_at: number };
/** 部门身份摘要，和 `getCompetition()` 等接口里别处的身份口径一致；没分配部门为 null。 */
export type PublicDepartment = { id: string; name: string; tone: string | null } | null;
/** 人员（站点包必带的接口）：全部已报名、未取消的参赛者，不是只有拿过分的人——和天梯不同。 */
export type Participant = PublicPerson & { department: PublicDepartment };
export type Participants = { items: Participant[]; next_cursor: string | null };
export type TeamEntry = { name: string; slogan: string; status: "recruiting" | "locked"; member_count: number; members: PublicPerson[] };
/**
 * 队伍（站点包必带的接口，团队赛才需要）：全部未解散的队伍，不是只有拿过分的队。`enabled` 为 false
 * 时是个人赛，站点据此跳过「队伍」这一段，不是报错——调用 `getTeams()` 永远不会因为是个人赛而失败。
 */
export type Teams = { enabled: boolean; team_min: number; team_max: number; teams: TeamEntry[] };

export type Snapshot = { competition: PublicCompetition; leaderboard: Leaderboard; feed: Feed; stats: Stats };

export type CompetitionErrorCode = "network" | "not_found" | "rate_limited" | "server";
/** 所有方法失败时 reject 的值；`retry_after` 只在限流时有，单位秒。 */
export type CompetitionError = { code: CompetitionErrorCode; status?: number; retry_after?: number };

export type ClientOptions = {
  /** 比赛 id，例如 `oss-challenge-2026-1`。 */
  competition: string;
  /** 接口所在的站点，默认空串（官网与主站同域）；不要带结尾的 `/`。 */
  origin?: string;
  /** 测试或非浏览器环境换掉请求函数。 */
  fetch?: typeof fetch;
};

export type SubscribeOptions = { interval?: number };
export type SubscribeUpdate = (Snapshot & { error?: undefined }) | { error: CompetitionError };

export type CompetitionClient = {
  readonly competition: string;
  readonly origin: string;
  getCompetition(): Promise<PublicCompetition>;
  getLeaderboard(): Promise<Leaderboard>;
  getFeed(options?: { cursor?: string | null; limit?: number }): Promise<Feed>;
  getStats(): Promise<Stats>;
  /** 人员：全部已报名的参赛者（含还没拿过分的人），不是天梯。`limit` 1–200，默认 100。 */
  getParticipants(options?: { cursor?: string | null; limit?: number }): Promise<Participants>;
  /** 队伍：个人赛也能调，`enabled` 为 false 时直接跳过这一段，不用先判断比赛是不是团队赛。 */
  getTeams(): Promise<Teams>;
  /** 天梯、动态、统计与比赛信息一次取齐。 */
  getSnapshot(): Promise<Snapshot>;
  /** 主站比赛窗口的报名深链，在新标签页打开。 */
  signupUrl(): string;
  /** 主站比赛窗口的组队深链。 */
  teamUrl(): string;
  /**
   * 按间隔轮询快照。成功回调拿到快照；失败不抛，回调拿到 `{ error }`，按间隔继续重试（限流时等够 `retry_after`）。
   * 页面切到后台时暂停，回到前台立刻取一次。返回取消函数。
   */
  subscribe(callback: (update: SubscribeUpdate) => void, options?: SubscribeOptions): () => void;
};

export const DEFAULT_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 5_000;

export function isCompetitionError(value: unknown): value is CompetitionError {
  return Boolean(value && typeof value === "object" && typeof (value as { code?: unknown }).code === "string"
    && ["network", "not_found", "rate_limited", "server"].includes((value as { code: string }).code));
}

/** 服务端给的地址是相对路径（`/?open=…`、`/c/…`、`/api/…`）：按 origin 补成可以直接打开的地址。 */
function join(origin: string, path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function createClient(options: ClientOptions): CompetitionClient {
  const competition = String(options.competition ?? "");
  if (!competition) throw new TypeError("createClient 需要 competition（比赛 id）");
  const origin = (options.origin ?? "").replace(/\/+$/, "");
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  const base = `/api/public/competitions/${encodeURIComponent(competition)}`;
  let appUrl = `/?open=competitions&competition=${encodeURIComponent(competition)}`;

  async function get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(join(origin, `${base}${path}`), { method: "GET", credentials: "omit", headers: { accept: "application/json" } });
    } catch {
      throw { code: "network" } satisfies CompetitionError;
    }
    if (response.status === 404) throw { code: "not_found", status: 404 } satisfies CompetitionError;
    if (response.status === 429) {
      const body = await response.json().catch(() => null) as { retry_after?: unknown } | null;
      const header = Number(response.headers.get("retry-after"));
      const retry = typeof body?.retry_after === "number" ? body.retry_after : Number.isFinite(header) && header > 0 ? header : 60;
      throw { code: "rate_limited", status: 429, retry_after: retry } satisfies CompetitionError;
    }
    if (!response.ok) throw { code: "server", status: response.status } satisfies CompetitionError;
    try {
      return await response.json() as T;
    } catch {
      throw { code: "server", status: response.status } satisfies CompetitionError;
    }
  }

  const remember = <T extends { app_url?: string }>(record: T): T => {
    if (record && typeof record.app_url === "string" && record.app_url) appUrl = record.app_url;
    return record;
  };

  const client: CompetitionClient = {
    competition,
    origin,
    getCompetition: () => get<PublicCompetition>("").then(remember),
    getLeaderboard: () => get<Leaderboard>("/leaderboard"),
    getFeed: (feedOptions = {}) => {
      const query = new URLSearchParams();
      if (feedOptions.cursor) query.set("cursor", feedOptions.cursor);
      if (feedOptions.limit) query.set("limit", String(Math.max(1, Math.min(50, Math.floor(feedOptions.limit)))));
      const text = query.toString();
      return get<Feed>(`/feed${text ? `?${text}` : ""}`);
    },
    getStats: () => get<Stats>("/stats"),
    getParticipants: (participantOptions = {}) => {
      const query = new URLSearchParams();
      if (participantOptions.cursor) query.set("cursor", participantOptions.cursor);
      if (participantOptions.limit) query.set("limit", String(Math.max(1, Math.min(200, Math.floor(participantOptions.limit)))));
      const text = query.toString();
      return get<Participants>(`/participants${text ? `?${text}` : ""}`);
    },
    getTeams: () => get<Teams>("/teams"),
    getSnapshot: () => get<Snapshot>("/snapshot").then(snapshot => {
      remember(snapshot.competition);
      return snapshot;
    }),
    signupUrl: () => join(origin, appUrl),
    teamUrl: () => join(origin, `${appUrl}${appUrl.includes("?") ? "&" : "?"}view=team`),
    subscribe(callback, subscribeOptions = {}) {
      const interval = Math.max(MIN_INTERVAL_MS, subscribeOptions.interval ?? DEFAULT_INTERVAL_MS);
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let inflight = false;
      const doc = typeof document === "undefined" ? null : document;
      const hidden = () => Boolean(doc && doc.visibilityState === "hidden");

      const schedule = (ms: number) => {
        if (stopped) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, ms);
      };
      async function tick() {
        timer = null;
        if (stopped || inflight) return;
        if (hidden()) return; // 回到前台时由 visibilitychange 接上
        inflight = true;
        let wait = interval;
        try {
          const snapshot = await client.getSnapshot();
          if (!stopped) callback(snapshot);
        } catch (error) {
          const failure: CompetitionError = isCompetitionError(error) ? error : { code: "network" };
          if (failure.code === "rate_limited" && failure.retry_after) wait = Math.max(interval, failure.retry_after * 1000);
          if (!stopped) callback({ error: failure });
        } finally {
          inflight = false;
        }
        schedule(wait);
      }
      const onVisibility = () => {
        if (!hidden() && !timer && !inflight) void tick();
      };
      doc?.addEventListener("visibilitychange", onVisibility);
      void tick();
      return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        doc?.removeEventListener("visibilitychange", onVisibility);
      };
    },
  };
  return client;
}
