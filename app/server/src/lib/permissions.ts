import type Database from "better-sqlite3";
import { PERMISSION_NODES, isValidNode } from "./permission-nodes.js";

/**
 * 权限求值引擎（#274 SPEC §3.5），模型照搬 ibuki-next
 * （`apps/gateway/gateway/permissions.py` + `store.py:112-131`），加了组继承与 meta 取值。
 *
 * 纯函数部分（nodeMatches/scopeMatches/explain/evaluate）故意保持和 ibuki 的版本逐行一致：
 * 测试向量 `app/server/test/fixtures/permission-vectors.json` 直接搬自 ibuki 的 fixture，
 * 行为必须逐条对上。ibuki 的 NAS 子树隔离规则（`xc.content.nas.*` 不随 `xc.content.*` 隐式放行）
 * 是它应用特有的保护，这里没有对应需求，故不移植。
 */

export type ScopeValue = string | number | boolean | null | undefined;
export type Scope = Record<string, ScopeValue | ScopeValue[]>;

export type PermEntryLike = { node: string; value: boolean; scope?: Scope };

export function nodeMatches(granted: string, requested: string): boolean {
  if (granted === "*" || granted === requested) return true;
  if (granted.endsWith(".*")) return requested.startsWith(granted.slice(0, -1));
  return false;
}

/** 缺键、null、空列表都算「没给」：约束该键的条目一律不命中（allow 与 deny 同此）。 */
export function scopeMatches(granted: Scope | undefined, requested: Scope): boolean {
  if (!granted || Object.keys(granted).length === 0) return true;
  for (const [key, allowed] of Object.entries(granted)) {
    const actual = requested[key];
    if (actual === null || actual === undefined || (Array.isArray(actual) && actual.length === 0)) return false;
    const allowedValues = Array.isArray(allowed) ? allowed : [allowed];
    const actualValues = Array.isArray(actual) ? actual : [actual];
    if (!actualValues.every(value => allowedValues.includes(value))) return false;
  }
  return true;
}

export type ExplainDecision = "allow" | "deny" | "unset";
export type ExplainResult<E extends PermEntryLike = PermEntryLike> = {
  decision: ExplainDecision;
  matched: E[];
  deniedBy: E[];
};

/**
 * 判定过程：命中 = 节点匹配且 scope 成立；命中里有 deny 就是 deny，否则有 allow 就是 allow，都没有是 unset。
 * 只接受具体节点：不合法或以 `.*` 结尾的查询永远 unset（和 ibuki 一致）。
 */
export function explain<E extends PermEntryLike>(entries: E[], node: string, scope: Scope = {}): ExplainResult<E> {
  if (!isValidNode(node) || node.endsWith(".*")) return { decision: "unset", matched: [], deniedBy: [] };
  const matched = entries.filter(entry => nodeMatches(entry.node, node) && scopeMatches(entry.scope, scope));
  const deniedBy = matched.filter(entry => !entry.value);
  const decision: ExplainDecision = deniedBy.length > 0 ? "deny" : matched.length > 0 ? "allow" : "unset";
  return { decision, matched, deniedBy };
}

/** SPEC §3.5 第 2 条：「都没有就是 unset」，unset 按拒绝处理 —— 所以布尔结果只有 allow 才是 true。 */
export function evaluate(entries: PermEntryLike[], node: string, scope: Scope = {}): boolean {
  return explain(entries, node, scope).decision === "allow";
}

// ---------------------------------------------------------------------------
// DB 层：读取账号 + 其所在组（递归继承）的条目，过期的在读取时过滤掉（SPEC §3.5 第 3 条）。
// ---------------------------------------------------------------------------

export type GroupInfo = { id: string; kind: string; name: string; weight: number };

export type ResolvedEntry = PermEntryLike & {
  id: number;
  subjectType: "account" | "group";
  subjectId: string;
  metaValue: string | null;
  expiresAt: number | null;
  grantedBy: string;
  createdAt: number;
  /** subjectType === 'group' 时才有：这条条目实际挂在哪个组上。 */
  group: GroupInfo | null;
  /** 从账号直接所在的组到条目所在组的继承链（含两端）；账号自身条目时为空数组。 */
  via: string[];
};

type EntryRow = {
  id: number; subject_type: "account" | "group"; subject_id: string; node: string;
  value: number | null; meta_value: string | null; scope: string; expires_at: number | null;
  granted_by: string; created_at: number;
};

function parseEntryRow(row: EntryRow): Omit<ResolvedEntry, "group" | "via"> {
  return {
    id: row.id, subjectType: row.subject_type, subjectId: row.subject_id, node: row.node,
    value: row.value === null ? false : row.value === 1,
    metaValue: row.meta_value, scope: JSON.parse(row.scope || "{}"),
    expiresAt: row.expires_at, grantedBy: row.granted_by, createdAt: row.created_at,
  };
}

/** 账号当前（未过期）直接所在的组：level、department、title 或 custom 组，来自 `perm_members`。 */
function directGroupsOfAccount(db: Database.Database, accountId: string, now: number): string[] {
  return (db.prepare(
    "SELECT group_id FROM perm_members WHERE account_id = ? AND (expires_at IS NULL OR expires_at > ?)",
  ).all(accountId, now) as { group_id: string }[]).map(r => r.group_id);
}

/** 全部组继承边：group_id 继承 parent_id。小表，整表读出来在内存里做 BFS。 */
function allParentEdges(db: Database.Database): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of db.prepare("SELECT group_id, parent_id FROM perm_group_parents").all() as { group_id: string; parent_id: string }[]) {
    const list = map.get(row.group_id);
    if (list) list.push(row.parent_id); else map.set(row.group_id, [row.parent_id]);
  }
  return map;
}

/**
 * 从每个直接所在组出发做 BFS，收集递归继承到的全部组 id，并记下从该根组到它的继承链。
 * 同一个组可能经由多条路径到达（菱形继承）：保留第一次发现的那条路径，足够用于展示，不追求「最短」。
 */
function closureWithPaths(roots: string[], parentsOf: Map<string, string[]>): Map<string, string[]> {
  const reached = new Map<string, string[]>();
  for (const root of roots) {
    if (reached.has(root)) continue;
    const queue: string[][] = [[root]];
    while (queue.length) {
      const path = queue.shift()!;
      const head = path[path.length - 1];
      if (reached.has(head)) continue;
      reached.set(head, path);
      for (const parent of parentsOf.get(head) ?? []) {
        if (!reached.has(parent)) queue.push([...path, parent]);
      }
    }
  }
  return reached;
}

function groupInfoMap(db: Database.Database, ids: string[]): Map<string, GroupInfo> {
  const map = new Map<string, GroupInfo>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  for (const row of db.prepare(`SELECT id, kind, name, weight FROM perm_groups WHERE id IN (${placeholders})`).all(...ids) as GroupInfo[]) {
    map.set(row.id, row);
  }
  return map;
}

/** 账号自己 + 所在组（递归继承）的全部未过期条目，按 SPEC §3.5 第 1 条收集。 */
export function entriesForAccount(db: Database.Database, accountId: string, now: number): ResolvedEntry[] {
  const own = (db.prepare(
    "SELECT * FROM perm_entries WHERE subject_type = 'account' AND subject_id = ? AND (expires_at IS NULL OR expires_at > ?)",
  ).all(accountId, now) as EntryRow[]).map(row => ({ ...parseEntryRow(row), group: null, via: [] as string[] }));

  const roots = directGroupsOfAccount(db, accountId, now);
  if (roots.length === 0) return own;
  const reached = closureWithPaths(roots, allParentEdges(db));
  const groupIds = [...reached.keys()];
  const groups = groupInfoMap(db, groupIds);
  const placeholders = groupIds.map(() => "?").join(",");
  const groupRows = groupIds.length
    ? (db.prepare(
        `SELECT * FROM perm_entries WHERE subject_type = 'group' AND subject_id IN (${placeholders}) AND (expires_at IS NULL OR expires_at > ?)`,
      ).all(...groupIds, now) as EntryRow[])
    : [];
  const fromGroups = groupRows.map(row => {
    const parsed = parseEntryRow(row);
    return { ...parsed, group: groups.get(row.subject_id) ?? null, via: reached.get(row.subject_id) ?? [row.subject_id] };
  });
  return [...own, ...fromGroups];
}

/** 更宽松：-1（不限）永远赢；否则数值更大者更宽松；非数值时保留已有值（不参与比较）。 */
function isMorePermissive(candidate: string, current: string): boolean {
  const a = Number(candidate), b = Number(current);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === -1 || b === -1) return a === -1;
  return a > b;
}

/** SPEC §3.5 第 4 条：meta 节点取值，账号自己的优先，否则取命中组里权重最高（同权重取更宽松）的值。 */
export function metaValueFromEntries(entries: ResolvedEntry[], node: string): string | null {
  const own = entries.find(e => e.subjectType === "account" && e.node === node && e.metaValue !== null);
  if (own) return own.metaValue;
  let best: { value: string; weight: number } | null = null;
  for (const entry of entries) {
    if (entry.subjectType !== "group" || entry.node !== node || entry.metaValue === null) continue;
    const weight = entry.group?.weight ?? 0;
    if (!best || weight > best.weight || (weight === best.weight && isMorePermissive(entry.metaValue, best.value))) {
      best = { value: entry.metaValue, weight };
    }
  }
  return best?.value ?? null;
}

// ---------------------------------------------------------------------------
// perm_state.revision：每次写入 +1，进程内缓存以 (account_id, revision) 为键（SPEC §3.5 第 5 条）。
// ---------------------------------------------------------------------------

export function getPermRevision(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM perm_state WHERE key = 'revision'").get() as { value: number } | undefined;
  if (row) return row.value;
  db.prepare("INSERT OR IGNORE INTO perm_state(key, value) VALUES ('revision', 0)").run();
  return 0;
}

export function bumpPermRevision(db: Database.Database): number {
  getPermRevision(db); // 确保行存在
  db.prepare("UPDATE perm_state SET value = value + 1 WHERE key = 'revision'").run();
  return getPermRevision(db);
}

/**
 * level、department 组每账号最多一个（SPEC §3.6「身份唯一」）：写入前在同一事务里删除该账号在同类组下的
 * 旧成员资格，再插入新的。用「写入时检查」而不是触发器，便于在应用层测试和在迁移脚本里复用。
 * 调用方写完之后要自行 `bumpPermRevision(db)` 让缓存失效（迁移脚本在整段迁移结束后统一 bump 一次）。
 */
export function setExclusiveGroupMembership(db: Database.Database, accountId: string, groupId: string, now: number, grantedBy: string) {
  const group = db.prepare("SELECT kind FROM perm_groups WHERE id = ?").get(groupId) as { kind: string } | undefined;
  if (!group) throw new Error(`perm group not found: ${groupId}`);
  const tx = db.transaction(() => {
    if (group.kind === "level" || group.kind === "department") {
      db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = ?)").run(accountId, group.kind);
    }
    db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, NULL, ?, ?)").run(accountId, groupId, grantedBy, now);
  });
  tx();
}

export type ExplainHit = {
  source: "account" | "group";
  group: { id: string; name: string } | null;
  via: string[];
  entry: { node: string; value: boolean; scope: Scope; expires_at: number | null };
};
export type AccountExplainResult = { node: string; result: ExplainDecision; hits: ExplainHit[]; meta_value?: string | null };
export type EffectivePermissions = {
  account_id: string;
  groups: { id: string; name: string; kind: string; via: string[] }[];
  allow: string[];
  deny: string[];
  meta: Record<string, string>;
};

export type PermissionEngine = ReturnType<typeof createPermissionEngine>;

/**
 * DB 支撑的求值引擎，带 (account_id, revision) 进程内缓存。`clock` 可注入，测试用。
 * 写操作（新增/删除组、成员、条目）一律要在写完之后调用 `bump()`，否则缓存不会失效。
 */
export function createPermissionEngine(db: Database.Database, clock: () => number = Date.now) {
  const cache = new Map<string, { revision: number; entries: ResolvedEntry[] }>();

  function entriesFor(accountId: string): ResolvedEntry[] {
    const revision = getPermRevision(db);
    const hit = cache.get(accountId);
    if (hit && hit.revision === revision) return hit.entries;
    const entries = entriesForAccount(db, accountId, clock());
    cache.set(accountId, { revision, entries });
    return entries;
  }

  function invalidate() {
    cache.clear();
  }

  function bump(): number {
    const revision = bumpPermRevision(db);
    cache.clear();
    return revision;
  }

  function check(accountId: string, node: string, scope: Scope = {}): boolean {
    return evaluate(entriesFor(accountId), node, scope);
  }

  function meta(accountId: string, node: string): string | null {
    return metaValueFromEntries(entriesFor(accountId), node);
  }

  function explainFor(accountId: string, node: string, scope: Scope = {}): AccountExplainResult {
    const def = PERMISSION_NODES.find(item => item.node === node);
    if (def?.meta) return { node, result: "unset", hits: [], meta_value: meta(accountId, node) };
    const { decision, matched } = explain(entriesFor(accountId), node, scope);
    const hits: ExplainHit[] = matched.map(entry => ({
      source: entry.subjectType,
      group: entry.group ? { id: entry.group.id, name: entry.group.name } : null,
      via: entry.via,
      entry: { node: entry.node, value: entry.value, scope: entry.scope ?? {}, expires_at: entry.expiresAt },
    }));
    return { node, result: decision, hits };
  }

  function effective(accountId: string): EffectivePermissions {
    const entries = entriesFor(accountId);
    const roots = directGroupsOfAccount(db, accountId, clock());
    const reached = closureWithPaths(roots, allParentEdges(db));
    const groups = groupInfoMap(db, [...reached.keys()]);
    const allow: string[] = [];
    const deny: string[] = [];
    const metaOut: Record<string, string> = {};
    for (const def of PERMISSION_NODES) {
      if (def.meta) {
        const value = metaValueFromEntries(entries, def.node);
        if (value !== null) metaOut[def.node] = value;
        continue;
      }
      const result = explain(entries, def.node, {});
      if (result.decision === "allow") allow.push(def.node);
      else if (result.decision === "deny" && result.deniedBy.length > 0) deny.push(def.node);
    }
    return {
      account_id: accountId,
      groups: [...reached.entries()].map(([id, path]) => {
        const info = groups.get(id);
        return { id, name: info?.name ?? id, kind: info?.kind ?? "custom", via: path };
      }),
      allow, deny, meta: metaOut,
    };
  }

  return { entriesFor, check, meta, explainFor, effective, invalidate, bump, revision: () => getPermRevision(db) };
}
