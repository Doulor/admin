import type Database from "better-sqlite3";
import type { AuditActor } from "./db.js";
import type { DirectoryAccount } from "./account-directory.js";

/**
 * GitLab 账号同步（#270）：每个是成员的极客班账号在自建 GitLab 上有一个用户，进 `GITLAB_GROUP` 组（舰员 Developer，提督 Owner）；
 * 停用或不再是成员的封禁（block），恢复后解封，从不删除。GitLab 用户按 OIDC 身份（provider = openid_connect，extern_uid =
 * 这个账号在 GitLab 那个客户端的 sector 里的 `sub`）认人，不按用户名或邮箱认。用户名在第一次同步时定下：有 GitHub 的用 GitHub 登录名，
 * 没有的用站内登录名（yz_…），被占用或是保留名时加后缀，之后不再改名。
 * 只有这个模块读写 gitlab_accounts；`mode` 为 dry-run 时只算出要做什么，不写表、不改 GitLab。
 */
export const GITLAB_OIDC_PROVIDER = "openid_connect";
/** GitLab 在签发者那里登记的 client id（oidc.js client add --client-id gitlab）。sector 取它的回调地址的主机，和签发者给 GitLab 的 `sub` 是同一个。 */
export const GITLAB_OIDC_CLIENT_ID = "gitlab";
/** GitLab 组成员的权限级别：Developer 30，Owner 50。 */
export const GITLAB_ACCESS = { developer: 30, owner: 50 } as const;
/** on 模式下每 10 分钟对一次账（启动时先对一次）。 */
export const GITLAB_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const AVATAR_MAX_BYTES = 1024 * 1024;
/** GitLab 不让用、或者会和路由撞上的用户名，碰到直接加后缀，不用等 GitLab 拒绝。 */
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "ghost", "support", "support-bot", "alert-bot", "security-bot", "automation-bot", "api", "help",
  "explore", "groups", "users", "dashboard", "projects", "snippets", "search", "import", "oauth", "public", "profile", "assets", "uploads",
]);

export type GitlabSyncConfig = { mode: "off" | "dry-run" | "on"; url: string | null; token: string | null; group: string };
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type SyncAction =
  | { kind: "create"; username: string; access_level: number }
  | { kind: "block" }
  | { kind: "unblock" }
  | { kind: "set_access"; access_level: number };
export type GitlabAccountState = "pending" | "active" | "blocked";
export type GitlabAccountRow = {
  account_id: string; gitlab_user_id: number | null; username: string; state: GitlabAccountState; access_level: number | null;
  last_error: string | null; last_error_at: number | null; synced_at: number | null; created_at: number; updated_at: number;
};
export type SyncOutcome = { account_id: string; login: string; actions: SyncAction[]; applied: boolean; error: string | null };
export type SyncSummary = { mode: GitlabSyncConfig["mode"]; accounts: number; changed: number; failed: number; outcomes: SyncOutcome[] };
export type SyncLogger = { info(details: Record<string, unknown>, message: string): void; error(details: Record<string, unknown>, message: string): void };

class SyncError extends Error {
  constructor(readonly code: string) { super(code); this.name = "SyncError"; }
}

/** 按 GitLab 的用户名规则整理：只留字母、数字、_、-、.，不以 - 或 . 开头，不以 . 结尾，最长 60。 */
export function gitlabUsername(base: string): string {
  const cleaned = base.replace(/[^A-Za-z0-9_.-]/g, "_").replace(/^[-.]+/, "").replace(/\.+$/, "").replace(/\.(git|atom)$/i, "_$1").slice(0, 60);
  return cleaned || "member";
}

export function createGitlabSync(db: Database.Database, deps: {
  config: GitlabSyncConfig;
  directory: { listForSync(): DirectoryAccount[]; account(accountId: string): DirectoryAccount | null };
  subjects: { subjectFor(sectorId: string, accountId: string): string; existingSubject(sectorId: string, accountId: string): string | null };
  clients: { sectorOf(clientId: string): string | null };
  avatars: { avatar(hash: string): Buffer | null };
  audit: (org: string | null, actor: AuditActor, action: string, target?: string, details?: unknown, ip?: string) => void;
  fetch?: FetchLike;
  githubFetch?: FetchLike;
  clock?: () => number;
}) {
  const { config } = deps;
  const clock = deps.clock ?? Date.now;
  const fetchGitlab = deps.fetch ?? fetch;
  const fetchGithub = deps.githubFetch ?? fetch;
  const gitlabHost = config.url ? new URL(config.url).host : null;
  // GITLAB_URL 可以是内网地址，不能拿它的主机当 sector；客户端还没登记时为 null，这时不建号
  const sector = () => deps.clients.sectorOf(GITLAB_OIDC_CLIENT_ID);
  const selectRow = db.prepare("SELECT * FROM gitlab_accounts WHERE account_id = ?");
  const usernameTaken = db.prepare("SELECT 1 FROM gitlab_accounts WHERE username = ? COLLATE NOCASE AND account_id <> ?");

  const rowOf = (accountId: string) => selectRow.get(accountId) as GitlabAccountRow | undefined;
  const wantedAccess = (account: DirectoryAccount) => account.site_role === "admin" ? GITLAB_ACCESS.owner : GITLAB_ACCESS.developer;
  const wanted = (account: DirectoryAccount) => account.status === "active" && account.member;

  /** 第一次同步时的用户名：GitHub 登录名或站内登录名；保留名或已被别的账号占用时依次加 _yz、_yz2……。 */
  function freeUsername(account: DirectoryAccount, avoid: Set<string> = new Set()): string {
    const base = gitlabUsername(account.github?.login ?? account.handle ?? account.login);
    const blocked = (name: string) => RESERVED_USERNAMES.has(name.toLowerCase()) || name.toLowerCase() === config.group.toLowerCase()
      || avoid.has(name.toLowerCase()) || Boolean(usernameTaken.get(name, account.account_id));
    if (!blocked(base)) return base;
    for (let n = 1; ; n++) {
      const candidate = `${base.slice(0, 54)}_yz${n === 1 ? "" : n}`;
      if (!blocked(candidate)) return candidate;
    }
  }

  /**
   * 这个账号现在要做什么（不碰 GitLab）。是成员、还没建号的建号；建过的按成员资格封禁或解封、调组权限。
   * 不是成员、也没有对上 GitLab 用户的：只要他在 GitLab 的 sector 有过 `sub`（用极客班登录过 GitLab，GitLab 可能已经自动建了号，
   * 例如同步关着时、或者在下一轮对账之前），就去 GitLab 按身份找一次，找到就封禁。
   */
  function plan(account: DirectoryAccount): SyncAction[] {
    const row = rowOf(account.account_id);
    const access = wantedAccess(account);
    if (!row || row.state === "pending" || row.gitlab_user_id === null) {
      if (wanted(account)) return [{ kind: "create", username: row?.username ?? freeUsername(account), access_level: access }];
      const sectorId = sector();
      return row?.state !== "blocked" && sectorId && deps.subjects.existingSubject(sectorId, account.account_id) ? [{ kind: "block" }] : [];
    }
    if (!wanted(account)) return row.state === "blocked" ? [] : [{ kind: "block" }];
    const actions: SyncAction[] = [];
    if (row.state === "blocked") actions.push({ kind: "unblock" });
    if (row.access_level !== access) actions.push({ kind: "set_access", access_level: access });
    return actions;
  }

  async function gitlab(method: string, path: string, body?: Record<string, unknown> | FormData): Promise<{ status: number; data: unknown }> {
    const form = body instanceof FormData;
    let res: Response;
    try {
      res = await fetchGitlab(`${config.url}/api/v4${path}`, {
        method,
        headers: { "PRIVATE-TOKEN": config.token ?? "", Accept: "application/json", ...(body && !form ? { "Content-Type": "application/json" } : {}) },
        body: body === undefined ? undefined : form ? body : JSON.stringify(body),
        // 不跟随跳转：跳到别的源时管理员令牌会跟着过去
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new SyncError("gitlab_unreachable");
    }
    const text = await res.text().catch(() => "");
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: res.status, data };
  }

  /** POST /users 被拒的原因：用户名或邮箱已被占用（409），或者用户名不合规则、是保留名（400）。 */
  function conflictOf(result: { status: number; data: unknown }): "username" | "email" | null {
    const message = (result.data as { message?: unknown } | null)?.message;
    const text = typeof message === "string" ? message : JSON.stringify(message ?? "");
    if (result.status === 409 || result.status === 400) {
      if (/username/i.test(text)) return "username";
      if (/email/i.test(text)) return "email";
    }
    return null;
  }

  /** 建号时一次性补资料：论坛资料优先；没有论坛资料的 GitHub 账号匿名读一次 GitHub 公开资料。读不到就只用登录名，不让同步失败。 */
  type GithubProfile = { name?: string | null; bio?: string | null; blog?: string | null; location?: string | null; avatar_url?: string | null };
  async function profileFor(account: DirectoryAccount) {
    let github: GithubProfile | null = null;
    if (!account.profile && account.github) {
      try {
        const res = await fetchGithub(`https://api.github.com/user/${account.github.id}`, {
          headers: { Accept: "application/vnd.github+json", "User-Agent": "yzgc-gitlab-sync" }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) github = await res.json() as GithubProfile;
      } catch { github = null; }
    }
    return {
      name: (account.profile?.displayName.trim() || github?.name?.trim() || account.name || account.login).slice(0, 255),
      bio: (account.profile?.bio || github?.bio || "").slice(0, 255),
      location: (account.profile?.location || github?.location || "").slice(0, 255),
      website_url: websiteOf(account.profile?.website || github?.blog || ""),
      avatarUrl: account.profile?.avatarHash ? null : github?.avatar_url ?? account.github?.avatar_url ?? null,
    };
  }

  /** GitHub 的 blog 是随手填的文字：没写协议的补 https://，补完还不是带点号主机名、不带账号口令的 http(s) 网址就不传，免得 GitLab 因为它拒绝建号。 */
  function websiteOf(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withScheme);
      return /^https?:$/.test(url.protocol) && url.hostname.includes(".") && !url.username && !url.password && withScheme.length <= 255 ? withScheme : "";
    } catch {
      return "";
    }
  }

  /** 头像：论坛上传的头像（webp）直接取库里的；否则下载 GitHub 头像。超过 1 MB 或下载失败就不传。 */
  async function avatarFor(account: DirectoryAccount, url: string | null): Promise<Blob | null> {
    if (account.profile?.avatarHash) {
      const data = deps.avatars.avatar(account.profile.avatarHash);
      return data && data.length <= AVATAR_MAX_BYTES ? new Blob([new Uint8Array(data)], { type: "image/webp" }) : null;
    }
    if (!url || !/^https:\/\/avatars\.githubusercontent\.com\//.test(url)) return null;
    try {
      const res = await fetchGithub(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/(png|jpeg|gif|webp)$/.test(type.split(";")[0])) return null;
      const data = new Uint8Array(await res.arrayBuffer());
      return data.length <= AVATAR_MAX_BYTES ? new Blob([data], { type }) : null;
    } catch { return null; }
  }

  async function ensureMembership(userId: number, accessLevel: number): Promise<void> {
    const group = encodeURIComponent(config.group);
    const added = await gitlab("POST", `/groups/${group}/members`, { user_id: userId, access_level: accessLevel });
    if (added.status === 201) return;
    if (added.status !== 409) throw new SyncError(`gitlab_member_${added.status}`);
    const updated = await gitlab("PUT", `/groups/${group}/members/${userId}`, { access_level: accessLevel });
    if (updated.status !== 200) throw new SyncError(`gitlab_member_${updated.status}`);
  }

  /** 封禁或解封；GitLab 对已经是这个状态的用户可能回错，再读一次状态，已经是想要的就算成功。 */
  async function setBlocked(userId: number, blocked: boolean): Promise<void> {
    const result = await gitlab("POST", `/users/${userId}/${blocked ? "block" : "unblock"}`);
    if (result.status === 201) return;
    const user = await gitlab("GET", `/users/${userId}`);
    const state = (user.data as { state?: string } | null)?.state;
    if (user.status === 200 && (blocked ? state === "blocked" : state === "active")) return;
    throw new SyncError(`gitlab_${blocked ? "block" : "unblock"}_${result.status}`);
  }

  /** 按 OIDC 身份找 GitLab 用户：同步建的，或者他用极客班登录时 GitLab 自动建的。 */
  async function userByIdentity(sub: string): Promise<{ id: number; username: string } | undefined> {
    const found = await gitlab("GET", `/users?extern_uid=${encodeURIComponent(sub)}&provider=${GITLAB_OIDC_PROVIDER}`);
    if (found.status !== 200) throw new SyncError(`gitlab_lookup_${found.status}`);
    return Array.isArray(found.data) ? found.data[0] as { id: number; username: string } | undefined : undefined;
  }

  /** 建号：先按 OIDC 身份找（上次建到一半、或者 GitLab 上已经有了），找不到再建；用户名、邮箱被占用时换一个再试。 */
  async function create(account: DirectoryAccount, action: Extract<SyncAction, { kind: "create" }>): Promise<void> {
    const sectorId = sector();
    if (!sectorId) throw new SyncError("gitlab_client_missing");
    const now = clock();
    let username = action.username;
    // 先占下用户名：建到一半失败时，下次沿用同一个名字
    db.prepare(`INSERT INTO gitlab_accounts(account_id, gitlab_user_id, username, state, access_level, created_at, updated_at)
      VALUES(?, NULL, ?, 'pending', NULL, ?, ?) ON CONFLICT(account_id) DO NOTHING`).run(account.account_id, username, now, now);
    const sub = deps.subjects.subjectFor(sectorId, account.account_id);
    let user = await userByIdentity(sub);
    if (!user) {
      const profile = await profileFor(account);
      const tried = new Set<string>();
      let useNoreply = !account.email;
      for (let attempt = 0; attempt < 6 && !user; attempt++) {
        tried.add(username.toLowerCase());
        const created = await gitlab("POST", "/users", {
          username, name: profile.name, email: useNoreply ? `${username.toLowerCase()}@noreply.${gitlabHost}` : account.email,
          extern_uid: sub, provider: GITLAB_OIDC_PROVIDER, skip_confirmation: true, force_random_password: true,
          bio: profile.bio, location: profile.location, website_url: profile.website_url,
        });
        if (created.status === 201) { user = created.data as { id: number; username: string }; break; }
        const conflict = conflictOf(created);
        if (conflict === "email" && !useNoreply) { useNoreply = true; continue; }
        if (conflict !== "username") throw new SyncError(`gitlab_create_${created.status}`);
        username = freeUsername(account, tried);
        db.prepare("UPDATE gitlab_accounts SET username = ?, updated_at = ? WHERE account_id = ?").run(username, clock(), account.account_id);
      }
      if (!user) throw new SyncError("gitlab_username_exhausted");
      const avatar = await avatarFor(account, profile.avatarUrl);
      if (avatar) {
        const form = new FormData();
        form.append("avatar", avatar, avatar.type === "image/webp" ? "avatar.webp" : "avatar.png");
        // 头像传不上去不算失败：资料已经建好，下次不会再传
        await gitlab("PUT", `/users/${user.id}`, form).catch(() => undefined);
      }
    }
    db.prepare("UPDATE gitlab_accounts SET gitlab_user_id = ?, username = ?, state = 'active', updated_at = ? WHERE account_id = ?")
      .run(user.id, user.username, clock(), account.account_id);
    await ensureMembership(user.id, action.access_level);
    db.prepare("UPDATE gitlab_accounts SET access_level = ?, updated_at = ? WHERE account_id = ?").run(action.access_level, clock(), account.account_id);
  }

  /**
   * 封禁一个还没对上 GitLab 用户的账号（见 plan）：按身份找到就记下这个用户再封禁；找不到也记一行 blocked（gitlab_user_id 为空），
   * 之后不再去找。他回来时这一行按建号处理，建号前同样先按身份找。
   */
  async function blockUnlinked(account: DirectoryAccount): Promise<void> {
    const sectorId = sector();
    const sub = sectorId ? deps.subjects.existingSubject(sectorId, account.account_id) : null;
    const user = sub ? await userByIdentity(sub) : undefined;
    const now = clock();
    db.prepare(`INSERT INTO gitlab_accounts(account_id, gitlab_user_id, username, state, access_level, created_at, updated_at)
      VALUES(?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(account_id) DO UPDATE SET gitlab_user_id = excluded.gitlab_user_id,
        username = excluded.username, state = excluded.state, updated_at = excluded.updated_at`)
      .run(account.account_id, user?.id ?? null, user?.username ?? rowOf(account.account_id)?.username ?? freeUsername(account), user ? "active" : "blocked", now, now);
    if (!user) return;
    await setBlocked(user.id, true);
    db.prepare("UPDATE gitlab_accounts SET state = 'blocked', updated_at = ? WHERE account_id = ?").run(clock(), account.account_id);
  }

  async function apply(account: DirectoryAccount, actions: SyncAction[]): Promise<void> {
    for (const action of actions) {
      if (action.kind === "create") { await create(account, action); continue; }
      const row = rowOf(account.account_id);
      if (action.kind === "block" && (!row || row.gitlab_user_id === null)) { await blockUnlinked(account); continue; }
      const userId = row!.gitlab_user_id!;
      if (action.kind === "block" || action.kind === "unblock") {
        await setBlocked(userId, action.kind === "block");
        db.prepare("UPDATE gitlab_accounts SET state = ?, updated_at = ? WHERE account_id = ?").run(action.kind === "block" ? "blocked" : "active", clock(), account.account_id);
      } else {
        await ensureMembership(userId, action.access_level);
        db.prepare("UPDATE gitlab_accounts SET access_level = ?, updated_at = ? WHERE account_id = ?").run(action.access_level, clock(), account.account_id);
      }
    }
  }

  /** 同步一个账号。dry-run 只返回要做什么；on 时照做，失败的原因记在 last_error，下次对账再试。 */
  async function syncNow(account: DirectoryAccount, actor: AuditActor): Promise<SyncOutcome> {
    const actions = plan(account);
    const outcome: SyncOutcome = { account_id: account.account_id, login: account.login, actions, applied: false, error: null };
    if (config.mode !== "on") return outcome;
    const now = clock();
    try {
      if (actions.length) await apply(account, actions);
      db.prepare("UPDATE gitlab_accounts SET last_error = NULL, last_error_at = NULL, synced_at = ? WHERE account_id = ?").run(clock(), account.account_id);
      outcome.applied = actions.length > 0;
    } catch (error) {
      outcome.error = error instanceof SyncError ? error.code : "gitlab_sync_failed";
      db.prepare("UPDATE gitlab_accounts SET last_error = ?, last_error_at = ?, updated_at = ? WHERE account_id = ?").run(outcome.error, now, now, account.account_id);
    }
    if (actions.length) {
      deps.audit(null, actor, "gitlab.sync", rowOf(account.account_id)?.username ?? account.login,
        { account_id: account.account_id, actions: actions.map(item => item.kind), error: outcome.error });
    }
    return outcome;
  }

  const inFlight = new Map<string, Promise<SyncOutcome>>();
  /** 同一个账号同一时间只同步一次：定时对账和控制台的「立即同步」碰上时，后来的等前一次做完，再按那时的记录重新算要做什么。 */
  function syncOne(account: DirectoryAccount, actor: AuditActor = "system"): Promise<SyncOutcome> {
    const id = account.account_id;
    const next = (inFlight.get(id) ?? Promise.resolve()).catch(() => undefined).then(() => syncNow(account, actor));
    inFlight.set(id, next);
    const release = () => { if (inFlight.get(id) === next) inFlight.delete(id); };
    next.then(release, release);
    return next;
  }

  let running: Promise<SyncSummary> | null = null;
  let stopping = false;
  /** 全部账号对一次账；上一次还没跑完时返回同一个结果，不同时跑两轮。停下（stop）时做完手上这个账号就结束。 */
  function reconcile(): Promise<SyncSummary> {
    if (running) return running;
    running = (async () => {
      const outcomes: SyncOutcome[] = [];
      for (const account of deps.directory.listForSync()) {
        if (config.mode === "off" || stopping) break;
        outcomes.push(await syncOne(account));
      }
      return {
        mode: config.mode, accounts: outcomes.length,
        changed: outcomes.filter(item => item.applied).length, failed: outcomes.filter(item => item.error).length, outcomes,
      };
    })().finally(() => { running = null; });
    return running;
  }

  /** 控制台手动重试一个账号；同步关着时不做。 */
  async function syncAccount(accountId: string, actor: AuditActor): Promise<SyncOutcome | null> {
    const account = deps.directory.account(accountId);
    if (!account) return null;
    return syncOne(account, actor);
  }

  /** 控制台成员页的同步状态：每个账号的 GitLab 用户名、用户 id、状态、组权限、最后一次错误，以及现在还要做什么。 */
  function status() {
    return deps.directory.listForSync().map(account => {
      const row = rowOf(account.account_id);
      return {
        account_id: account.account_id, login: account.login,
        username: row?.username ?? null, gitlab_user_id: row?.gitlab_user_id ?? null, state: row?.state ?? null, access_level: row?.access_level ?? null,
        last_error: row?.last_error ?? null, last_error_at: row?.last_error_at ?? null, synced_at: row?.synced_at ?? null,
        pending: config.mode === "off" ? [] : plan(account),
      };
    });
  }

  /** 给以后的比赛记分（#239）：极客班账号在 GitLab 上是谁。还没建好时为 null。 */
  function gitlabUserFor(accountId: string): { gitlabUserId: number; username: string; state: GitlabAccountState } | null {
    const row = rowOf(accountId);
    return row && row.gitlab_user_id !== null ? { gitlabUserId: row.gitlab_user_id, username: row.username, state: row.state } : null;
  }

  /** 反过来：GitLab 用户是哪个极客班账号；不是同步建的用户为 null。 */
  function accountForGitlabUser(gitlabUserId: number): string | null {
    return (db.prepare("SELECT account_id FROM gitlab_accounts WHERE gitlab_user_id = ?").get(gitlabUserId) as { account_id: string } | undefined)?.account_id ?? null;
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  /** on 模式才开定时对账（buildApp 的 gitlabSync，index.ts 打开）；立即对一次，之后每 10 分钟。出错只记日志。 */
  function start(logger: SyncLogger): void {
    if (timer || config.mode !== "on") return;
    stopping = false;
    const run = () => {
      reconcile().then(summary => {
        if (summary.changed || summary.failed) logger.info({ changed: summary.changed, failed: summary.failed }, "gitlab sync finished");
      }).catch(error => logger.error({ error: (error as Error)?.name ?? "error" }, "gitlab sync failed"));
    };
    run();
    timer = setInterval(run, GITLAB_SYNC_INTERVAL_MS);
    timer.unref();
  }
  async function stop(): Promise<void> {
    stopping = true;
    if (timer) clearInterval(timer);
    timer = null;
    await running?.catch(() => undefined);
  }

  return { mode: config.mode, plan, reconcile, syncAccount, status, gitlabUserFor, accountForGitlabUser, start, stop };
}
export type GitlabSync = ReturnType<typeof createGitlabSync>;
