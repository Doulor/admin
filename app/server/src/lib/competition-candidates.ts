// GitLab 贡献收集与「有用」标记（#278，CONTRACT-278 §4，所有者 2026-10-24 13:45）。
//
// 后台每 10 分钟（GitLab 同步不是 off 时）把比赛配置的 GitLab 项目里、比赛时间窗内的贡献收成候选：
//   - 已合并的 MR（按合并时间算窗口）；
//   - 带「有用」标签或被 MR 关闭的 Issue（按创建时间算窗口）。
// 作者经 gitlab_accounts 对到极客班账号，且这个账号已报名这场比赛，否则跳过。唯一约束保证重复拉取不产生重复行。
// 分数不看改动行数（所有者 2026-10-24 16:59），只看审核人选的重要程度和核心度（lib/competition-rubric.ts）。
//
// 只有被标记「有用」的候选才加分，两条路：
//   1. GitLab 标签：「有用」加一个 `重要程度::一般|重要|关键`、一个 `核心度::边缘|业务|核心`。这三个标签各自最后一次
//      都是被加上，加的人对得上极客班账号、有 competition.score.review、而且不是作者本人——满足就按两档自动加分
//      （登记人是打「有用」的人）；不满足的留在待确认，note 写原因。待确认的候选记下标签上现在的两档，控制台默认选它。
//   2. 控制台「标记有用」（accept）时选两档，审核人不能是作者本人。
// 加分之后再改两档标签不改分，要改分到控制台驳回后重新标记。
// 标签被拿掉：经标签自动加的分撤销、候选回到待确认；控制台确认的不受影响；定榜之后什么都不再改。
// 只有这个模块读写 competition_score_candidates；加分、撤销写 competition_score_events 走 competition-score-store。
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AuditActor } from "./db.js";
import type { CompetitionRecord, CompetitionStore } from "./competition-store.js";
import type { CompetitionSignupStore } from "./competition-signup-store.js";
import type { CompetitionScoreStore, ScoreErrorCode } from "./competition-score-store.js";
import type { CompetitionRulesStore } from "./competition-rules-store.js";
import { CORE, CORE_LABELS, IMPORTANCE, IMPORTANCE_LABELS, basePoints, isCore, isImportance, type Core, type Importance } from "./competition-rubric.js";
import type { ActivityOutcome, ActivitySurface } from "./activity.js";

export const USEFUL_LABEL = "有用";
/** 两档评定的 GitLab 标签：`重要程度::一般` 这样，一个前缀只能有一个。 */
export const IMPORTANCE_LABEL_PREFIX = "重要程度::";
export const CORE_LABEL_PREFIX = "核心度::";
const IMPORTANCE_BY_LABEL = new Map(IMPORTANCE.map(key => [`${IMPORTANCE_LABEL_PREFIX}${IMPORTANCE_LABELS[key]}`, key] as const));
const CORE_BY_LABEL = new Map(CORE.map(key => [`${CORE_LABEL_PREFIX}${CORE_LABELS[key]}`, key] as const));
export const COLLECT_INTERVAL_MS = 10 * 60_000;
/** 比赛结束后还继续收集多久（迟到的标签、合并），定榜后停。 */
export const COLLECT_GRACE_MS = 30 * 24 * 3600_000;
/** 一次收集最多发多少个 GitLab 请求，超过就停在这里，下一轮接着补。 */
export const COLLECT_REQUEST_BUDGET = 300;
const LIST_PAGES_MAX = 10;
const CANDIDATE_PAGE = 50;

export type CandidateStatus = "pending" | "accepted" | "rejected";
export type CandidateRow = {
  id: string; competition_id: string; account_id: string; kind: "pr" | "issue"; gitlab_project: string; gitlab_iid: number;
  url: string; title: string; importance: Importance | null; core: Core | null; status: CandidateStatus;
  reviewed_by: string | null; reviewed_at: number | null; final_points: number | null; reason: string | null;
  score_event_id: string | null; accepted_via: "label" | "console" | null; note: string | null;
  contributed_at: number; created_at: number; updated_at: number;
};
export type CollectRun = {
  at: number; fetched: number; created: number; skipped: number; accepted: number; revoked: number; error: string | null;
};
export type CandidateError = "not_found" | "candidate_not_found" | "self_review" | "already_accepted" | "already_rejected"
  | "competition_finalized" | "gitlab_sync_off" | ScoreErrorCode;
export const CANDIDATE_ERRORS: Partial<Record<CandidateError, { status: number; message: string }>> = {
  candidate_not_found: { status: 404, message: "这条候选贡献不存在" },
  self_review: { status: 403, message: "不能审核自己的贡献" },
  already_accepted: { status: 409, message: "这条贡献已经标记为有用" },
  already_rejected: { status: 409, message: "这条贡献已经驳回" },
  gitlab_sync_off: { status: 409, message: "GitLab 同步关着或没配好，收集不了贡献" },
};

/** 标签上的两档：每个前缀恰好一个、名字对得上才算；没有或不止一个就是 null。 */
export function levelsFromLabels(labels: string[]): { importance: Importance | null; core: Core | null } {
  const pick = <T>(prefix: string, table: Map<string, T>): T | null => {
    const found = labels.filter(label => label.startsWith(prefix));
    return found.length === 1 ? table.get(found[0]) ?? null : null;
  };
  return { importance: pick(IMPORTANCE_LABEL_PREFIX, IMPORTANCE_BY_LABEL), core: pick(CORE_LABEL_PREFIX, CORE_BY_LABEL) };
}

type GitlabReader = {
  readonly mode: "off" | "dry-run" | "on";
  readonly url: string | null;
  readApi(path: string): Promise<{ status: number; data: unknown; nextPage: number | null }>;
  accountForGitlabUser(gitlabUserId: number): Promise<string | null>;
};
type Logger = { info(details: Record<string, unknown>, message: string): void; error(details: Record<string, unknown>, message: string): void };
type GitlabItem = {
  iid?: unknown; title?: unknown; web_url?: unknown; author?: { id?: unknown } | null; labels?: unknown;
  merged_at?: unknown; created_at?: unknown; state?: unknown; merge_requests_count?: unknown;
};
type LabelEvent = { id?: unknown; action?: unknown; created_at?: unknown; label?: { name?: unknown } | null; user?: { id?: unknown; username?: unknown } | null };

export function createCompetitionCandidates(db: Database.Database, deps: {
  competitions: Pick<CompetitionStore, "get" | "list">;
  signups: Pick<CompetitionSignupStore, "settingsOf" | "activeSignups">;
  scores: Pick<CompetitionScoreStore, "add" | "isFinalized">;
  rules: Pick<CompetitionRulesStore, "get">;
  gitlab: GitlabReader;
  canReview: (accountId: string) => boolean;
  audit: (actor: AuditActor, action: string, target?: string, details?: unknown, ip?: string, opts?: { surface?: ActivitySurface; outcome?: ActivityOutcome }) => void;
  onScoresChanged: (competitionId: string) => void;
  clock?: () => number;
}) {
  const clock = deps.clock ?? Date.now;
  const selectOne = db.prepare("SELECT * FROM competition_score_candidates WHERE competition_id = ? AND id = ?");
  const selectByKey = db.prepare("SELECT * FROM competition_score_candidates WHERE competition_id = ? AND kind = ? AND gitlab_project = ? AND gitlab_iid = ?");
  const insertCandidate = db.prepare(`INSERT OR IGNORE INTO competition_score_candidates(id, competition_id, account_id, kind, gitlab_project, gitlab_iid, url, title,
      status, contributed_at, created_at, updated_at)
    VALUES(@id, @competition_id, @account_id, @kind, @gitlab_project, @gitlab_iid, @url, @title, 'pending', @contributed_at, @now, @now)`);
  const refreshCandidate = db.prepare("UPDATE competition_score_candidates SET title = ?, url = ?, updated_at = ? WHERE id = ? AND (title <> ? OR url <> ?)");
  const setLevels = db.prepare(`UPDATE competition_score_candidates SET importance = @importance, core = @core, updated_at = @now
    WHERE id = @id AND status = 'pending' AND (IFNULL(importance, '') <> IFNULL(@importance, '') OR IFNULL(core, '') <> IFNULL(@core, ''))`);
  const setNote = db.prepare("UPDATE competition_score_candidates SET note = ?, updated_at = ? WHERE id = ? AND IFNULL(note, '') <> IFNULL(?, '')");
  const markAccepted = db.prepare(`UPDATE competition_score_candidates SET status = 'accepted', accepted_via = @via, reviewed_by = @by, reviewed_at = @now,
      importance = @importance, core = @core, final_points = @points, reason = @reason, score_event_id = @event, note = NULL, updated_at = @now WHERE id = @id`);
  const markRejected = db.prepare(`UPDATE competition_score_candidates SET status = 'rejected', accepted_via = NULL, reviewed_by = @by, reviewed_at = @now,
      final_points = NULL, reason = @reason, score_event_id = NULL, note = NULL, updated_at = @now WHERE id = @id`);
  const markPending = db.prepare(`UPDATE competition_score_candidates SET status = 'pending', accepted_via = NULL, reviewed_by = NULL, reviewed_at = NULL,
      final_points = NULL, reason = NULL, score_event_id = NULL, note = @note, updated_at = @now WHERE id = @id`);
  const revokeEvent = db.prepare("UPDATE competition_score_events SET status = 'revoked', revoked_by = ?, revoked_at = ?, revoke_reason = ? WHERE id = ? AND status = 'active'");
  const selectByEvent = db.prepare("SELECT * FROM competition_score_candidates WHERE score_event_id = ?");
  const countByStatus = db.prepare("SELECT status, COUNT(*) AS n FROM competition_score_candidates WHERE competition_id = ? GROUP BY status");
  const pendingAll = db.prepare(`SELECT COUNT(*) AS n FROM competition_score_candidates c
    WHERE c.status = 'pending' AND NOT EXISTS (SELECT 1 FROM competition_finals f WHERE f.competition_id = c.competition_id)`);

  const lastRuns = new Map<string, CollectRun>();
  const running = new Map<string, Promise<CollectRun>>();

  function view(row: CandidateRow, personOf: (accountId: string) => { account_id: string; username: string; display_name: string; avatar_url: string | null }) {
    return {
      id: row.id, account: personOf(row.account_id), kind: row.kind, gitlab_project: row.gitlab_project, gitlab_iid: row.gitlab_iid,
      url: row.url, title: row.title, importance: row.importance, core: row.core, status: row.status,
      final_points: row.final_points, reason: row.reason,
      reviewed_by: row.reviewed_by ? personOf(row.reviewed_by) : null, reviewed_at: row.reviewed_at,
      accepted_via: row.accepted_via, note: row.note, contributed_at: row.contributed_at, created_at: row.created_at,
    };
  }

  function list(competitionId: string, status: CandidateStatus | null, cursor: string | null) {
    const params: unknown[] = [competitionId];
    let where = "competition_id = ?";
    if (status) { where += " AND status = ?"; params.push(status); }
    const after = cursor ? /^([0-9]{1,15})_([0-9a-f-]{36})$/.exec(cursor) : null;
    if (after) { where += " AND (created_at < ? OR (created_at = ? AND id < ?))"; params.push(Number(after[1]), Number(after[1]), after[2]); }
    const rows = db.prepare(`SELECT * FROM competition_score_candidates WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(...params, CANDIDATE_PAGE + 1) as CandidateRow[];
    const page = rows.slice(0, CANDIDATE_PAGE);
    const last = page[page.length - 1];
    const counts = { pending: 0, accepted: 0, rejected: 0 };
    for (const row of countByStatus.all(competitionId) as { status: CandidateStatus; n: number }[]) counts[row.status] = row.n;
    return { rows: page, next_cursor: rows.length > CANDIDATE_PAGE && last ? `${last.created_at}_${last.id}` : null, counts, last_run: lastRuns.get(competitionId) ?? null };
  }

  const get = (competitionId: string, candidateId: string) => (selectOne.get(competitionId, candidateId) as CandidateRow | undefined) ?? null;

  /** 加分并把候选置为 accepted；防刷按贡献发生的那一周数。调用方在事务里。 */
  function acceptRow(row: CandidateRow, actorAccountId: string, via: "label" | "console", levels: { importance: Importance; core: Core }, reason: string, now: number):
    { ok: true; value: CandidateRow } | { ok: false; error: CandidateError } {
    const created = deps.scores.add(row.competition_id, actorAccountId, {
      account_id: row.account_id, kind: row.kind, repo: row.gitlab_project, number: row.gitlab_iid,
      importance: levels.importance, core: levels.core, reason, contributed_at: row.contributed_at,
    }, now);
    if (!created.ok) return { ok: false, error: created.error };
    markAccepted.run({ id: row.id, via, by: actorAccountId, now, ...levels, points: created.value.points, reason, event: created.value.id });
    return { ok: true, value: get(row.competition_id, row.id)! };
  }

  /** 控制台「标记有用」：审核人选两档（表单默认选标签上记下的两档）；审核人不能是作者。 */
  function accept(competitionId: string, candidateId: string, actorAccountId: string, input: { importance: Importance; core: Core; reason?: string }, now: number):
    { ok: true; value: CandidateRow } | { ok: false; error: CandidateError } {
    if (!deps.competitions.get(competitionId)) return { ok: false, error: "not_found" };
    const row = get(competitionId, candidateId);
    if (!row) return { ok: false, error: "candidate_not_found" };
    if (deps.scores.isFinalized(competitionId)) return { ok: false, error: "competition_finalized" };
    if (row.status === "accepted") return { ok: false, error: "already_accepted" };
    if (row.account_id === actorAccountId) return { ok: false, error: "self_review" };
    const { importance, core } = input;
    if (!isImportance(importance) || !isCore(core)) return { ok: false, error: "bad_levels" };
    const reason = (input.reason ?? "").trim() || `控制台标记有用：${row.kind === "pr" ? "MR" : "Issue"} ${row.gitlab_project}#${row.gitlab_iid}`;
    return acceptRow(row, actorAccountId, "console", { importance, core }, reason.slice(0, 200), now);
  }

  /** 驳回；已经加过分的连同积分记录一起撤销。 */
  function reject(competitionId: string, candidateId: string, actorAccountId: string, reason: string, now: number):
    { ok: true; value: CandidateRow } | { ok: false; error: CandidateError } {
    if (!deps.competitions.get(competitionId)) return { ok: false, error: "not_found" };
    const row = get(competitionId, candidateId);
    if (!row) return { ok: false, error: "candidate_not_found" };
    if (deps.scores.isFinalized(competitionId)) return { ok: false, error: "competition_finalized" };
    if (row.status === "rejected") return { ok: false, error: "already_rejected" };
    if (row.account_id === actorAccountId) return { ok: false, error: "self_review" };
    const text = reason.trim().slice(0, 200);
    if (row.score_event_id) revokeEvent.run(actorAccountId, now, `候选贡献被驳回：${text}`.slice(0, 200), row.score_event_id);
    markRejected.run({ id: row.id, by: actorAccountId, now, reason: text });
    return { ok: true, value: get(competitionId, candidateId)! };
  }

  /** 控制台在积分记录页撤销了一条来自候选的积分：候选跟着变成驳回，免得两边对不上。 */
  function onEventRevoked(eventId: string, actorAccountId: string, reason: string, now: number): void {
    const row = selectByEvent.get(eventId) as CandidateRow | undefined;
    if (row) markRejected.run({ id: row.id, by: actorAccountId, now, reason: reason.trim().slice(0, 200) || "积分记录被撤销" });
  }

  function pendingCount(): number {
    return (pendingAll.get() as { n: number }).n;
  }

  // ── 收集 ──────────────────────────────────────────────────────────

  /** 这场比赛现在要不要收集：内部赛、没下线、开了积分、已开始、没定榜、在结束后的宽限期内、配了项目。 */
  function collectable(record: CompetitionRecord, now: number): boolean {
    return record.kind === "internal" && !record.offline && now >= record.start_at && now <= record.end_at + COLLECT_GRACE_MS
      && deps.signups.settingsOf(record.id).scoring === "contribution" && !deps.scores.isFinalized(record.id)
      && deps.rules.get(record.id).gitlab_projects.length > 0;
  }

  async function runCollect(record: CompetitionRecord): Promise<CollectRun> {
    const now = clock();
    const run: CollectRun = { at: now, fetched: 0, created: 0, skipped: 0, accepted: 0, revoked: 0, error: null };
    let budget = COLLECT_REQUEST_BUDGET;
    const read = async (path: string) => {
      if (budget-- <= 0) throw Object.assign(new Error("budget"), { code: "request_budget_exhausted" });
      return deps.gitlab.readApi(path);
    };
    const accountFor = async (userId: number) => {
      if (budget-- <= 0) throw Object.assign(new Error("budget"), { code: "request_budget_exhausted" });
      return deps.gitlab.accountForGitlabUser(userId);
    };
    const readList = async <T = GitlabItem>(path: string): Promise<T[]> => {
      const items: T[] = [];
      let page: number | null = 1;
      for (let count = 0; page && count < LIST_PAGES_MAX; count++) {
        const result = await read(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
        if (result.status !== 200 || !Array.isArray(result.data)) throw Object.assign(new Error("list"), { code: `gitlab_http_${result.status}` });
        items.push(...(result.data as T[]));
        const next: number | null = result.nextPage ?? (result.data.length === 100 ? page + 1 : null);
        if (next !== null && next !== page + 1) throw Object.assign(new Error("pagination"), { code: "gitlab_pagination_incomplete" });
        page = next;
      }
      if (page !== null) throw Object.assign(new Error("pagination"), { code: "gitlab_pagination_incomplete" });
      return items;
    };
    const signedUp = new Set(deps.signups.activeSignups(record.id).map(person => person.account_id));
    const since = new Date(record.start_at).toISOString();
    const until = new Date(record.end_at).toISOString();
    const inWindow = (value: unknown) => {
      const at = typeof value === "string" ? Date.parse(value) : Number.NaN;
      return Number.isFinite(at) && at >= record.start_at && at <= record.end_at ? at : null;
    };
    const urlOf = (value: unknown, project: string, kind: "pr" | "issue", iid: number) => {
      if (typeof value === "string" && /^https?:\/\/[^\s]+$/.test(value)) return value.slice(0, 500);
      return `${deps.gitlab.url ?? ""}/${project}/-/${kind === "pr" ? "merge_requests" : "issues"}/${iid}`;
    };
    const labelsOf = (item: GitlabItem): string[] => {
      if (!Array.isArray(item.labels) || item.labels.some(label => typeof label !== "string")) {
        throw Object.assign(new Error("labels"), { code: "gitlab_data_incomplete" });
      }
      return item.labels;
    };

    type LatestLabel = { action: "add" | "remove"; userId: number | null; username: string | null };
    /** 完整事件中每个标签最后一次是谁、加还是拿掉；坏事件不能被跳过后把旧事件误认成最新。 */
    async function latestLabelEvents(project: string, kind: "pr" | "issue", iid: number): Promise<Map<string, LatestLabel>> {
      const resource = kind === "pr" ? "merge_requests" : "issues";
      const events = await readList<LabelEvent>(`/projects/${encodeURIComponent(project)}/${resource}/${iid}/resource_label_events`);
      const latest = new Map<string, LabelEvent>();
      for (const event of events) {
        const name = event?.label?.name;
        if (!event || !Number.isSafeInteger(event.id) || Number(event.id) <= 0
          || !Number.isFinite(Date.parse(String(event.created_at ?? "")))
          || typeof name !== "string" || !name || (event.action !== "add" && event.action !== "remove")) {
          throw Object.assign(new Error("event"), { code: "gitlab_data_incomplete" });
        }
        const known = latest.get(name);
        const at = Date.parse(String(event.created_at ?? ""));
        const knownAt = known ? Date.parse(String(known.created_at ?? "")) : -Infinity;
        if (!known || at > knownAt || (at === knownAt && Number(event.id) > Number(known.id))) latest.set(name, event);
      }
      return new Map([...latest].map(([name, event]) => [name, {
        action: event.action as "add" | "remove",
        userId: typeof event.user?.id === "number" ? event.user.id : null,
        username: typeof event.user?.username === "string" ? event.user.username : null,
      }]));
    }

    /** 一个标签最后一次是不是由能审核积分、又不是作者的人加上的：是就给账号，不是就给未计分的原因。 */
    async function labelAdder(row: CandidateRow, name: string, event: LatestLabel | undefined): Promise<{ account: string } | { note: string }> {
      const reviewer = event?.action === "add" && event.userId !== null ? await accountFor(event.userId) : null;
      if (!event || event.action !== "add") return { note: `有「${name}」标签，但读不到是谁加的，先留在待确认` };
      if (!reviewer) return { note: `「${name}」标签由 GitLab 用户 ${event.username ?? event.userId} 添加，对不上极客班账号，未计分` };
      if (reviewer === row.account_id) return { note: `「${name}」标签是作者自己加的，未计分` };
      if (!deps.canReview(reviewer)) return { note: `「${name}」标签由 ${event.username ?? reviewer} 添加，这个账号没有审核积分的权限，未计分` };
      return { account: reviewer };
    }

    /**
     * 按标签核对一条候选：待确认的先记下标签上的两档；加了「有用」和两档、三个标签都由审核人加上就加分；
     * 「有用」拿掉了就撤销经标签加的分。
     */
    async function syncLabel(row: CandidateRow, labels: string[]) {
      const labeled = labels.includes(USEFUL_LABEL);
      if (row.status === "pending") {
        const levels = levelsFromLabels(labels);
        setLevels.run({ id: row.id, ...levels, now: clock() });
        if (!labeled) return;
        const keep = (note: string) => { setNote.run(note, clock(), row.id, note); };
        if (!levels.importance || !levels.core) {
          keep(`有「有用」标签，但重要程度和核心度要各有一个标签（${IMPORTANCE_LABEL_PREFIX}一般/重要/关键、${CORE_LABEL_PREFIX}边缘/业务/核心），先留在待确认`);
          return;
        }
        const events = await latestLabelEvents(row.gitlab_project, row.kind, row.gitlab_iid);
        const useful = await labelAdder(row, USEFUL_LABEL, events.get(USEFUL_LABEL));
        if ("note" in useful) { keep(useful.note); return; }
        const reviewers = new Set([useful.account]);
        // 两档标签也要审核人加，作者自己改成「关键」「核心」不算
        for (const name of [`${IMPORTANCE_LABEL_PREFIX}${IMPORTANCE_LABELS[levels.importance]}`, `${CORE_LABEL_PREFIX}${CORE_LABELS[levels.core]}`]) {
          const adder = await labelAdder(row, name, events.get(name));
          if ("note" in adder) { keep(adder.note); return; }
          reviewers.add(adder.account);
        }
        // 核验其它身份需要等待 HTTP，之前的审核人可能已被停用或撤权。
        if ([...reviewers].some(accountId => !deps.canReview(accountId))) {
          keep("标签审核人的当前权限已变化，未计分");
          return;
        }
        const reviewer = useful.account;
        const username = events.get(USEFUL_LABEL)?.username ?? null;
        const reason = `GitLab 上由 ${username ?? "审核人"} 标记「有用」`;
        const accepted = { importance: levels.importance, core: levels.core };
        const done = db.transaction(() => {
          const result = acceptRow(row, reviewer, "label", accepted, reason, clock());
          if (result.ok) {
            deps.audit({ login: username ?? "gitlab", account_id: reviewer }, "competition.candidate.accept", row.id,
              { competition_id: row.competition_id, via: "label", points: result.value.final_points, ...accepted, kind: row.kind }, undefined, { surface: "system" });
          } else {
            const text = result.error === "duplicate_score_event" ? "已经有同一条贡献的积分记录，未重复计分" : `自动计分没成功（${result.error}）`;
            setNote.run(text, clock(), row.id, text);
          }
          return result.ok;
        })();
        if (done) run.accepted++;
        return;
      }
      if (!labeled && row.status === "accepted" && row.accepted_via === "label" && row.score_event_id) {
        const event = (await latestLabelEvents(row.gitlab_project, row.kind, row.gitlab_iid)).get(USEFUL_LABEL);
        if (!event || event.action !== "remove") return; // 缺证据或列表还没刷新到，不把未知当撤销。
        const remover = event.userId != null ? await accountFor(event.userId) : null;
        const eventId = row.score_event_id;
        db.transaction(() => {
          revokeEvent.run(remover, clock(), "GitLab 上的「有用」标签被移除", eventId);
          markPending.run({ id: row.id, now: clock(), note: "「有用」标签被移除，经标签加的分已撤销" });
          deps.audit({ login: event?.username ?? "gitlab", account_id: remover }, "competition.candidate.label_removed", row.id,
            { competition_id: row.competition_id, score_event_id: eventId }, undefined, { surface: "system" });
        })();
        run.revoked++;
      }
    }

    function upsert(kind: "pr" | "issue", project: string, item: GitlabItem, accountId: string, contributedAt: number) {
      const iid = Number(item.iid);
      const title = (typeof item.title === "string" ? item.title : `${kind === "pr" ? "MR" : "Issue"} ${iid}`).slice(0, 200);
      const url = urlOf(item.web_url, project, kind, iid);
      const existing = selectByKey.get(record.id, kind, project, iid) as CandidateRow | undefined;
      if (existing) {
        refreshCandidate.run(title, url, clock(), existing.id, title, url);
        return selectByKey.get(record.id, kind, project, iid) as CandidateRow;
      }
      insertCandidate.run({
        id: randomUUID(), competition_id: record.id, account_id: accountId, kind, gitlab_project: project, gitlab_iid: iid,
        url, title, contributed_at: contributedAt, now: clock(),
      });
      run.created++;
      return selectByKey.get(record.id, kind, project, iid) as CandidateRow;
    }

    const authorAccount = async (item: GitlabItem) => {
      const id = item.author?.id;
      const account = typeof id === "number" ? await accountFor(id) : null;
      return account && signedUp.has(account) ? account : null;
    };

    try {
      for (const project of deps.rules.get(record.id).gitlab_projects) {
        const encoded = encodeURIComponent(project);
        const mrs = await readList(`/projects/${encoded}/merge_requests?state=merged&updated_after=${encodeURIComponent(since)}&order_by=updated_at`);
        for (const item of mrs) {
          if (!Number.isInteger(Number(item.iid))) continue;
          const mergedAt = inWindow(item.merged_at);
          if (mergedAt === null) continue;
          run.fetched++;
          const account = await authorAccount(item);
          if (!account) { run.skipped++; continue; }
          const row = upsert("pr", project, item, account, mergedAt);
          await syncLabel(row, labelsOf(item));
        }
        const issues = await readList(`/projects/${encoded}/issues?created_after=${encodeURIComponent(since)}&created_before=${encodeURIComponent(until)}`);
        for (const item of issues) {
          if (!Number.isInteger(Number(item.iid))) continue;
          const createdAt = inWindow(item.created_at);
          if (createdAt === null) continue;
          const labels = labelsOf(item);
          const iid = Number(item.iid);
          const known = selectByKey.get(record.id, "issue", project, iid) as CandidateRow | undefined;
          let qualifies = Boolean(known) || labels.includes(USEFUL_LABEL);
          if (!qualifies && item.state === "closed" && Number(item.merge_requests_count) > 0) {
            const closedBy = await read(`/projects/${encoded}/issues/${iid}/closed_by`);
            qualifies = closedBy.status === 200 && Array.isArray(closedBy.data)
              && (closedBy.data as { state?: unknown }[]).some(mr => mr.state === "merged");
          }
          if (!qualifies) continue;
          run.fetched++;
          const account = await authorAccount(item);
          if (!account) { run.skipped++; continue; }
          const row = upsert("issue", project, item, account, createdAt);
          await syncLabel(row, labels);
        }
      }
    } catch (error) {
      run.error = (error as { code?: unknown }).code ? String((error as { code: unknown }).code) : "collect_failed";
    }
    if (run.accepted || run.revoked) deps.onScoresChanged(record.id);
    lastRuns.set(record.id, run);
    return run;
  }

  /** 收集一场比赛；同一场正在跑时等它跑完，不并发跑两遍。GitLab 同步 off 或没配好时不跑。 */
  async function collect(competitionId: string): Promise<{ ok: true; value: CollectRun } | { ok: false; error: CandidateError }> {
    const record = deps.competitions.get(competitionId);
    if (!record) return { ok: false, error: "not_found" };
    if (deps.scores.isFinalized(competitionId)) return { ok: false, error: "competition_finalized" };
    if (deps.gitlab.mode === "off" || !deps.gitlab.url) return { ok: false, error: "gitlab_sync_off" };
    const current = running.get(competitionId);
    if (current) return { ok: true, value: await current };
    const task = runCollect(record).finally(() => running.delete(competitionId));
    running.set(competitionId, task);
    return { ok: true, value: await task };
  }

  async function collectAll(): Promise<CollectRun[]> {
    if (deps.gitlab.mode === "off" || !deps.gitlab.url) return [];
    const now = clock();
    const runs: CollectRun[] = [];
    for (const record of deps.competitions.list(now)) {
      if (!collectable(record, now)) continue;
      const result = await collect(record.id);
      if (result.ok) runs.push(result.value);
    }
    return runs;
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  let stopping = false;
  let loop: Promise<unknown> | null = null;
  /** 每 10 分钟收一轮（启动时先收一轮）；每一轮开始时才看 GitLab 同步开没开，控制台改设置不用重排定时器。 */
  function start(logger: Logger): void {
    if (timer) return;
    stopping = false;
    const tick = () => {
      if (stopping || loop) return;
      loop = collectAll().then(runs => {
        const failed = runs.filter(item => item.error);
        if (failed.length) logger.error({ errors: failed.map(item => item.error) }, "competition collect failed");
        else if (runs.some(item => item.created || item.accepted || item.revoked)) {
          logger.info({ created: runs.reduce((sum, item) => sum + item.created, 0), accepted: runs.reduce((sum, item) => sum + item.accepted, 0) }, "competition collect finished");
        }
      }).catch(error => logger.error({ error: (error as Error)?.name ?? "error" }, "competition collect failed")).finally(() => { loop = null; });
    };
    tick();
    timer = setInterval(tick, COLLECT_INTERVAL_MS);
    timer.unref();
  }
  async function stop(): Promise<void> {
    stopping = true;
    if (timer) clearInterval(timer);
    timer = null;
    await loop?.catch(() => undefined);
  }

  return { list, get, view, accept, reject, onEventRevoked, pendingCount, collect, collectAll, collectable, start, stop };
}
export type CompetitionCandidates = ReturnType<typeof createCompetitionCandidates>;
