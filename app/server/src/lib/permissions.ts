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

/**
 * 没有账号的真访客（没登录，CONTRACT-274 §1）：按 `level.visitor` 组自己的条目求值，不走继承——
 * 它是最底层的组，没有父组，也没有 perm_members 行（访客不是「成员」，没有账号可以挂在组上）。
 */
export function visitorEntries(db: Database.Database, now: number): ResolvedEntry[] {
  const rows = db.prepare(
    "SELECT * FROM perm_entries WHERE subject_type = 'group' AND subject_id = 'level.visitor' AND (expires_at IS NULL OR expires_at > ?)",
  ).all(now) as EntryRow[];
  const group = groupInfoMap(db, ["level.visitor"]).get("level.visitor") ?? null;
  return rows.map(row => ({ ...parseEntryRow(row), group, via: ["level.visitor"] }));
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
// perm_state.revision：每次写入 +1；缓存还受成员资格/条目有效期与求值时间区间约束。
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
 * `expiresAt` 给 console/permission-groups.ts 的「加成员」接口用（可以带过期时间）；不传就是永久，
 * 和原来的行为一样。调用方如果自己已经在一个事务里，better-sqlite3 的 transaction() 会自动退化成
 * SAVEPOINT，不用调用方特地拆出来（console/users.ts 的 PATCH、迁移脚本的批量循环都是这样嵌套调用的）。
 * #274 残留修复 P：console/users.ts、console/permission-groups.ts 原来各自写了一份一模一样的
 * 「按 kind 删旧的再插入新的」SQL，这里是唯一实现，两处改成调用它。
 */
export function setExclusiveGroupMembership(
  db: Database.Database, accountId: string, groupId: string, now: number, grantedBy: string, expiresAt: number | null = null,
) {
  const group = db.prepare("SELECT kind FROM perm_groups WHERE id = ?").get(groupId) as { kind: string } | undefined;
  if (!group) throw new Error(`perm group not found: ${groupId}`);
  const tx = db.transaction(() => {
    if (group.kind === "level" || group.kind === "department") {
      db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = ?)").run(accountId, group.kind);
    }
    db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, ?, ?, ?)").run(accountId, groupId, expiresAt, grantedBy, now);
  });
  tx();
}

/**
 * 站长组 id；全站最高权限（种子里是唯一拿到 `node:"*"` 的组），不能被收回或删除（接口层强制，这里只给
 * 两个共享的查询，不重复写 SQL）。`levelGroupId`/`levelSuffix` 把 `level.` 前缀集中在一处：console/users.ts、
 * console/me.ts 以前各自用 `SUBSTR(pg.id, 7)`、`` `level.${x}` `` 拼字符串，魔术数字 7 一旦前缀改名就全部错位。
 */
export const SITE_OWNER_GROUP_ID = "title.site.owner";
const LEVEL_PREFIX = "level.";
export function levelGroupId(suffix: string): string { return `${LEVEL_PREFIX}${suffix}`; }
export function levelSuffix(groupId: string): string { return groupId.startsWith(LEVEL_PREFIX) ? groupId.slice(LEVEL_PREFIX.length) : groupId; }

/** 站长只认 active 账号上当前有效的直接资格，不因其它组继承 owner 而成为站长。 */
export function isSiteOwner(db: Database.Database, accountId: string, now: number = Date.now()): boolean {
  return !!db.prepare(`SELECT 1 FROM perm_members m JOIN users u ON u.id = m.account_id
    WHERE m.group_id = ? AND m.account_id = ? AND u.status = 'active'
      AND (m.expires_at IS NULL OR m.expires_at > ?)`).get(SITE_OWNER_GROUP_ID, accountId, now);
}

/** 现在一共有几位站长（用于「至少留一位」的判断）。 */
export function siteOwnerCount(db: Database.Database, now: number = Date.now()): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM perm_members m JOIN users u ON u.id = m.account_id
    WHERE m.group_id = ? AND u.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > ?)`)
    .get(SITE_OWNER_GROUP_ID, now) as { n: number }).n;
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

export type AccountDepartmentView = { id: string; name: string; tone: string | null } | null;
export type AccountTitleView = { id: string; name: string; department_id: string | null };
/** `/auth/me`、`/api/console/me` 用的账号身份摘要（CONTRACT-274 §1）。 */
export type AccountGroupsView = { level: string; level_name: string; department: AccountDepartmentView; titles: AccountTitleView[] };

/** 没登录时的身份摘要：固定是「访客」，没有部门和称号。 */
const VISITOR_GROUPS: AccountGroupsView = { level: "level.visitor", level_name: "访客", department: null, titles: [] };

/**
 * 这个账号直接所在的 level / department / title 组（CONTRACT-274 §1「身份」）：只看直接成员资格，不展开继承——
 * 继承只影响权限判定（explain/evaluate），给本人看的身份要的是「实际在哪几个组」，不是「因此拿到了哪些权限」。
 * `accountId` 为 null 时是没登录的访客，直接回「访客」，不查表。查不到 level 组（数据不一致，正常情况下
 * `syncPermissionLevel` 保证每个账号都在恰好一个 level 组里）时按「注册用户」兜底，不让 `/auth/me` 崩掉。
 */
export function accountGroupsView(db: Database.Database, accountId: string | null, now: number): AccountGroupsView {
  if (accountId === null) return VISITOR_GROUPS;
  const rows = db.prepare(`SELECT g.id, g.kind, g.name, g.department_id AS department_id, g.tone
    FROM perm_members m JOIN perm_groups g ON g.id = m.group_id
    WHERE m.account_id = ? AND (m.expires_at IS NULL OR m.expires_at > ?)`).all(accountId, now) as
    { id: string; kind: string; name: string; department_id: string | null; tone: string | null }[];
  const levelRow = rows.find(row => row.kind === "level");
  const deptRow = rows.find(row => row.kind === "department");
  const titles = rows.filter(row => row.kind === "title").map(row => ({ id: row.id, name: row.name, department_id: row.department_id }));
  return {
    level: levelRow?.id ?? "level.registered",
    level_name: levelRow?.name ?? "注册用户",
    department: deptRow ? { id: deptRow.id, name: deptRow.name, tone: deptRow.tone } : null,
    titles,
  };
}

export type PermissionEngine = ReturnType<typeof createPermissionEngine>;

/**
 * DB 支撑的求值引擎。写操作一律在写完之后调用 `bump()`；时间越过有效期时自动重读。
 * `clock` 可注入，时钟回退到缓存求值时间之前时也重读，恢复此前被过滤的 deny/成员资格。
 */
const VISITOR_CACHE_KEY = "\x00visitor";

export function createPermissionEngine(db: Database.Database, clock: () => number = Date.now) {
  const cache = new Map<string, { revision: number; evaluatedAt: number; expiresAt: number; entries: ResolvedEntry[] }>();

  /** `accountId` 为 null 时是没登录的访客（CONTRACT-274 §1），按 `level.visitor` 组自己的条目求值。 */
  function entriesFor(accountId: string | null): ResolvedEntry[] {
    const revision = getPermRevision(db);
    const now = clock();
    const key = accountId ?? VISITOR_CACHE_KEY;
    const hit = cache.get(key);
    if (hit && hit.revision === revision && now >= hit.evaluatedAt && now < hit.expiresAt) return hit.entries;
    const entries = accountId === null ? visitorEntries(db, now) : entriesForAccount(db, accountId, now);
    // 根组成员资格可能先于继承来的条目到期；allow、deny 与 meta 都会改变结果，不能只跟踪 allow。
    const membershipExpiry = accountId === null ? null : (db.prepare(
      "SELECT MIN(expires_at) AS expiry FROM perm_members WHERE account_id = ? AND expires_at > ?",
    ).get(accountId, now) as { expiry: number | null }).expiry;
    const expiresAt = entries.reduce((expiry, entry) => Math.min(expiry, entry.expiresAt ?? Infinity), membershipExpiry ?? Infinity);
    cache.set(key, { revision, evaluatedAt: now, expiresAt, entries });
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

  function check(accountId: string | null, node: string, scope: Scope = {}): boolean {
    return evaluate(entriesFor(accountId), node, scope);
  }

  function meta(accountId: string | null, node: string): string | null {
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

  function groupsOf(accountId: string | null): AccountGroupsView {
    return accountGroupsView(db, accountId, clock());
  }

  return { entriesFor, check, meta, explainFor, effective, groupsOf, invalidate, bump, revision: () => getPermRevision(db) };
}
