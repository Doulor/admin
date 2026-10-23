import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import type { AuditActor } from "./db.js";
import { redeemInvite } from "./invite-codes.js";
import { maskEmail } from "./email-login.js";
import { bumpPermRevision, setExclusiveGroupMembership } from "./permissions.js";

/**
 * 极客班账号（#262，docs/plan/UNIFIED-LOGIN.md）：`users` 一行是一个账号，`id` 就是接口里的 `account_id`（极客班 OpenID）；
 * `identities` 一行是一种登录方式，交付 1 只有 GitHub（`provider_uid` 是 GitHub 数字 id 的十进制串，不用会变的登录名）。
 * 只有这个模块读写 `users`、`identities` 与 `identity_audit`；业务代码从会话拿 `account_id`，不读身份表。
 */
export type IdentityProvider = "github" | "google" | "email";
export type GithubAccount = { id: number; login: string; avatarUrl: string | null };
/** auth.createSession 的入参：会话记账号和本次登录方式，旧列（登录名、GitHub id、头像、加密 token）照写，供回滚后的旧镜像读。 */
export type NewSession = { accountId: string; provider: IdentityProvider; login: string; userId: number | null; avatarUrl: string | null; accessToken: string };
/** 站内角色（与 lib/roles.ts 的 OrgRole 相同；这里不导入 roles，免得身份模块依赖称号模块）。 */
export type RecordedOrgRole = "admin" | "member" | null;
/** 控制台里给账号设的站内角色：管理员（提督）、成员（舰员），或「不是成员」（移出极客班，不能再登录）。 */
export type SiteRoleChoice = "admin" | "member" | "none";
/**
 * 邮箱、Google 与 GitHub 登录（#262，所有者 2026-10-23；#274 邀请码改选填）没成功的原因：账号停用、
 * 邀请码无效（填了但校验不过，不悄悄降级成注册用户）、Google 的邮箱已经属于别的账号、验证码这时已被用掉。
 * `not_member`、`invite_required` 不会再被抛出：GitHub 组织那道门已经去掉，没填邀请码就注册成注册用户
 * （SPEC §3.2）。`invite_invalid` 取代旧名字「invalid_invite」，和 CONTRACT-274 的错误码一致。
 * `no_account`：忘了密码（resetPassword）核对的邮箱还没有账号——这条路径不能顺手注册，邀请码选填只对
 * 真正的注册路径生效。
 */
export type SigninRefusal = "account_disabled" | "invite_invalid" | "email_taken" | "code_expired" | "no_account";
export type SigninResult =
  | { ok: true; sid: string; accountId: string; registered: boolean }
  | { ok: false; reason: SigninRefusal };
export type LinkResult = { ok: true } | { ok: false; reason: "identity_conflict" | "identity_exists" | "email_limit" | "code_expired" };
export type UnlinkResult = { ok: true } | { ok: false; reason: "not_found" | "primary_email" };
/** 一个账号最多绑几个邮箱（#272）：每个都能登录，GitLab 按它们认提交人。 */
export const EMAILS_MAX = 5;
/** 「成员与权限」名单里的一个账号（listAccounts）。`role_unrecorded`：回填的老账号，还没记过站内角色。 */
export type AccountSummary = {
  account_id: string; login: string; github_login: string | null; github_user_id: number | null; avatar_url: string | null;
  providers: IdentityProvider[]; status: "active" | "disabled"; member: boolean;
  site_role: RecordedOrgRole; role_unrecorded: boolean; last_login_at: number | null; created_at: number;
};
/**
 * 给对外授权与 GitLab 同步用的账号信息（#270，getAccountClaims / listAccountsForSync）：成员资格、站内角色、登录名、
 * 绑定的 GitHub 身份和已验证的邮箱：`email` 是主邮箱（canonical_email），`emails` 是绑定的全部邮箱，主邮箱在前（#272）。
 * 只读，不含密码、第三方令牌与登录记录。
 */
export type AccountClaims = {
  account_id: string; status: "active" | "disabled"; member: boolean; site_role: RecordedOrgRole;
  login: string; handle: string | null; github: { id: number; login: string; avatar_url: string | null } | null; email: string | null;
  emails: string[];
};
/** #274：GitHub 登录和邮箱、Google 共用同一套结果（不再单独带 `accountId` 的拒绝分支，组织门槛已经去掉）。 */
export type GithubSigninResult = SigninResult;
/** 启动回填的计数，写进 `identity.backfill` 审计（规格「交付 1：回填」第 5 步）。 */
export type IdentityBackfillReport = {
  users: number; identities: number; sessions_mapped: number; sessions_unmapped: number;
  assignments_claimed: number; assignments_unclaimed: number; forum_claimed: number;
};

/** identity_audit 的 action：登录、被拒、退出；#262 第二期加注册、绑定、绑定冲突、设密码与改密码；第四期加站内角色被改；#273 加忘了密码后重设。 */
export type AccountAction = "login" | "login_denied" | "logout" | "register" | "link" | "link_conflict" | "unlink" | "password_set" | "password_change" | "password_reset" | "role_change";

/** `merged_into` 最多走 8 跳；更长或成环说明数据坏了，登录按 `failed` 处理。 */
export const MERGE_HOPS_MAX = 8;

/** 合并链超长、成环或指向不存在的账号。登录事务整体回滚，路由记错误日志（只记 code）后回跳 `failed`。 */
export class IdentityChainError extends Error {
  readonly code = "identity_chain_invalid";
  constructor(message: string) { super(message); this.name = "IdentityChainError"; }
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function base32(value: bigint, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) { out = CROCKFORD[Number(value & 31n)] + out; value >>= 5n; }
  return out;
}
const randomBits = (bytes: number) => BigInt(`0x${randomBytes(bytes).toString("hex")}`);
/** 账号 id：128 位随机数编成 26 位 Crockford Base32。不用自增、不用任何渠道的 id，永不复用。 */
export const newAccountId = () => base32(randomBits(16), 26);
/** 身份 id：ULID（48 位毫秒时间 + 80 位随机，26 位 Crockford Base32）。 */
export const newUlid = (now: number) => base32(BigInt(now), 10) + base32(randomBits(10), 16);

type AccountRow = { id: string; status: "active" | "disabled" | "merged"; merged_into: string | null };
/** 这个 GitHub id 对应的账号（provider_uid 存十进制串）：回填与登录共用的匹配写法。 */
const ACCOUNT_OF_GITHUB_ID = (column: string) =>
  `(SELECT i.user_id FROM identities i WHERE i.provider = 'github' AND i.provider_uid = CAST(${column} AS TEXT))`;

/** 沿 `merged_into` 走到终点账号（`active` 或 `disabled`）；超过 MERGE_HOPS_MAX 跳、成环或断链抛 IdentityChainError。 */
function terminalAccount(db: Database.Database, accountId: string): { id: string; status: "active" | "disabled" } {
  const select = db.prepare("SELECT id, status, merged_into FROM users WHERE id = ?");
  const seen = new Set<string>();
  let current = select.get(accountId) as AccountRow | undefined;
  for (let hops = 0; current; hops++) {
    if (current.status !== "merged") return { id: current.id, status: current.status };
    if (hops >= MERGE_HOPS_MAX) throw new IdentityChainError(`merge chain longer than ${MERGE_HOPS_MAX} hops`);
    if (seen.has(current.id)) throw new IdentityChainError("merge chain has a cycle");
    seen.add(current.id);
    current = select.get(current.merged_into) as AccountRow | undefined;
  }
  throw new IdentityChainError("merge chain points to a missing account");
}

/**
 * 启动回填（规格「交付 1：回填」）：每次启动在一个事务里跑，全是带条件的更新，可以重跑——回滚到旧镜像期间产生的
 * 会话、称号和论坛用户，重新上线时由同一段代码补上。
 * 1. 建号：未过期会话里出现过、还没有 GitHub 身份的每个 user_id，各建一个账号和 GitHub 身份（登录名、头像取该 id 最新的会话）。
 * 2. 映射会话：有 user_id 的会话写上账号；user_id 为空的旧会话不映射，读到时按未登录处理（auth.getSession）。
 * 3. 认领称号：github_user_id 等于某个 GitHub 身份的写上账号；github_user_id 为空的只能按登录名匹配，**不认领**。
 * 4. 认领论坛用户：github_user_id 等于某个 GitHub 身份的写上账号。
 * 5. 报告：第一次跑完写 console_seeds 的 identity_v1 和一条 identity.backfill 审计；之后只有补到了东西才再写一条。
 */
export function backfillIdentity(db: Database.Database, now: number): { report: IdentityBackfillReport; recorded: boolean } {
  return db.transaction(() => {
    const candidates = db.prepare(`SELECT user_id, login, avatar_url, created_at FROM sessions
      WHERE expires_at > ? AND user_id IS NOT NULL AND ${ACCOUNT_OF_GITHUB_ID("sessions.user_id")} IS NULL
      ORDER BY user_id, created_at DESC, rowid DESC`).all(now) as { user_id: number; login: string; avatar_url: string | null; created_at: number }[];
    const insertUser = db.prepare("INSERT INTO users(id, status, org_state, org_checked_at, created_at, updated_at) VALUES(?, 'active', 'active', ?, ?, ?)");
    const insertIdentity = db.prepare(`INSERT INTO identities(id, user_id, provider, provider_uid, login, avatar_url, created_at, last_login_at)
      VALUES(?, ?, 'github', ?, ?, ?, ?, ?)`);
    const created = new Set<number>();
    for (const row of candidates) {
      if (created.has(row.user_id)) continue;
      created.add(row.user_id);
      const accountId = newAccountId();
      // 会话签发时 GitHub 刚确认过组织资格，所以 org_checked_at、last_login_at 都取这条会话的签发时间
      insertUser.run(accountId, row.created_at, now, now);
      insertIdentity.run(newUlid(now), accountId, String(row.user_id), row.login, row.avatar_url, now, row.created_at);
    }
    const sessionsMapped = db.prepare(`UPDATE sessions SET openid = ${ACCOUNT_OF_GITHUB_ID("sessions.user_id")}, provider = 'github'
      WHERE openid IS NULL AND user_id IS NOT NULL AND ${ACCOUNT_OF_GITHUB_ID("sessions.user_id")} IS NOT NULL`).run().changes;
    const assignmentsClaimed = db.prepare(`UPDATE role_assignments SET account_id = ${ACCOUNT_OF_GITHUB_ID("role_assignments.github_user_id")}
      WHERE account_id IS NULL AND github_user_id IS NOT NULL AND ${ACCOUNT_OF_GITHUB_ID("role_assignments.github_user_id")} IS NOT NULL`).run().changes;
    const forumClaimed = db.prepare(`UPDATE forum_users SET account_id = ${ACCOUNT_OF_GITHUB_ID("forum_users.github_user_id")}
      WHERE account_id IS NULL AND github_user_id IS NOT NULL AND ${ACCOUNT_OF_GITHUB_ID("forum_users.github_user_id")} IS NOT NULL`).run().changes;
    const count = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number }).n;
    const report: IdentityBackfillReport = {
      users: created.size,
      identities: created.size,
      sessions_mapped: sessionsMapped,
      sessions_unmapped: count("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ? AND openid IS NULL", now),
      assignments_claimed: assignmentsClaimed,
      assignments_unclaimed: count("SELECT COUNT(*) AS n FROM role_assignments WHERE account_id IS NULL AND github_user_id IS NULL"),
      forum_claimed: forumClaimed,
    };
    const first = db.prepare("INSERT OR IGNORE INTO console_seeds(name, seeded_at) VALUES('identity_v1', ?)").run(now).changes === 1;
    const filled = report.users + report.identities + report.sessions_mapped + report.assignments_claimed + report.forum_claimed > 0;
    if (first || filled) {
      db.prepare("INSERT INTO audit_logs(org, actor, action, target, details, ip, created_at, actor_account_id) VALUES(NULL, 'system', 'identity.backfill', NULL, ?, NULL, ?, NULL)")
        .run(JSON.stringify(report), now);
    }
    return { report, recorded: first || filled };
  }).immediate();
}

export type IdentityDeps = {
  /** auth.createSession：在登录事务里插入会话 */
  createSession: (input: NewSession) => string;
  /** storage.audit */
  audit: (org: string | null, actor: AuditActor, action: string, target?: string, details?: unknown, ip?: string) => void;
  consoleOrg: string;
  clock?: () => number;
};

export function createIdentityStore(db: Database.Database, deps: IdentityDeps) {
  const clock = deps.clock ?? Date.now;
  const githubIdentity = db.prepare("SELECT id, user_id FROM identities WHERE provider = 'github' AND provider_uid = ?");
  const insertUser = db.prepare("INSERT INTO users(id, status, org_state, org_checked_at, created_at, updated_at) VALUES(?, 'active', 'active', ?, ?, ?)");
  const insertIdentity = db.prepare(`INSERT INTO identities(id, user_id, provider, provider_uid, login, avatar_url, created_at, last_login_at)
    VALUES(?, ?, 'github', ?, ?, ?, ?, ?)`);
  const refreshIdentity = db.prepare("UPDATE identities SET login = ?, avatar_url = ?, last_login_at = ? WHERE id = ?");
  const setOrgRole = db.prepare("UPDATE users SET org_role = ?, org_checked_at = ?, updated_at = ? WHERE id = ?");
  const roleRow = db.prepare("SELECT status, org_state, org_role, invite_code_id FROM users WHERE id = ?");
  const countAdmins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE status = 'active' AND org_state = 'active' AND org_role = 'admin'");
  const adminCount = () => (countAdmins.get() as { n: number }).n;
  /** 登录没成功时统一抛出，事务外层按 `reason` 翻成 `SigninResult`（邮箱、Google、GitHub 共用，#274）。 */
  class Refused extends Error {
    constructor(readonly reason: SigninRefusal) { super(reason); }
  }
  const addSiteOwner = db.prepare("INSERT OR IGNORE INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, 'title.site.owner', ?, ?)");
  // 只收回「这条同步自己发过的」站长资格（按 granted_by 认领），不动控制台单独发的——见下面函数注释。
  const removeSyncedSiteOwner = db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id = 'title.site.owner' AND granted_by = ?");

  /**
   * #274：按站内角色把账号放进新权限系统的 level 组（perm_members），迁移脚本只在启动时跑一次，
   * 这里补上运行时新建号/改角色的那一刻——否则这之后新建或改角色的账号在新引擎里是「没有任何条目」，
   * 所有权限判定都会落到 unset（按拒绝处理），包括这次改动本身新加的 account.profile.edit 等接口。
   * 口径和 lib/migrations/2026-10-yugc-v2.ts 的 assignAccountIdentities() 一致：admin 进 level.member 且是站长，
   * member 进 level.member，其余（null，含被设成「不是成员」）进 level.registered——新模型里没有登录就完全没权限这回事，
   * 「不是成员」只是不再是极客班成员，账号还在、还是注册用户。
   * 被从 admin 改成别的角色时把这次同步自己发的站长资格收回；但 `roleUnrecorded()` 对 role=null 的账号永远成立
   * （`org_role` 列在角色是 null 时不会被写，和「从没查过」没法区分，这是 #262 就有的设计，查过一次不代表以后
   * 不再查），意味着 GitHub 登录每次都会重新跑到这里——如果不分青红皂白地 DELETE，控制台用新权限体系（§5 的
   * users.ts/permission-groups.ts）单独给某个 GitHub 登录账号加的站长身份，会在这个人下次用 GitHub 登录时被
   * 这里悄悄收回（已经在测试里复现过这个失败模式）。只删「granted_by 等于这次调用自己」的那一行，不碰别的来源
   * 发的站长资格，按 ibuki 式「只清理自己发的，不碰别人发的」的幂等同步原则——`console:set-site-role`（旧
   * people.ts 的站内角色接口）本来就是另一个 grantedBy 值，降级时仍然只收它自己发的那份，行为不变。
   */
  function syncPermissionLevel(accountId: string, role: RecordedOrgRole, grantedBy: string, now: number): void {
    setExclusiveGroupMembership(db, accountId, role === null ? "level.registered" : "level.member", now, grantedBy);
    if (role === "admin") addSiteOwner.run(accountId, grantedBy, now);
    else removeSyncedSiteOwner.run(accountId, grantedBy);
    bumpPermRevision(db);
  }

  /**
   * 回填建的老账号还没记过站内角色（#262 第四期）：账号正常、是成员、没有角色、也不是邀请码注册的。只有这种账号
   * 还按 GitHub 组织角色补记一次（GitHub 会话用到时，或下次 GitHub 登录时），之后只认站内记录。
   */
  function roleUnrecorded(accountId: string): boolean {
    const row = roleRow.get(accountId) as { status: string; org_state: string; org_role: string | null; invite_code_id: number | null } | undefined;
    return row?.status === "active" && row.org_state === "active" && row.org_role === null && row.invite_code_id === null;
  }
  const claimAssignments = db.prepare("UPDATE role_assignments SET account_id = ? WHERE account_id IS NULL AND github_user_id = ?");
  // 论坛用户按账号唯一：账号已经有论坛用户时不再认领第二个
  const claimForumUser = db.prepare(`UPDATE forum_users SET account_id = ? WHERE account_id IS NULL AND github_user_id = ?
    AND NOT EXISTS (SELECT 1 FROM forum_users f WHERE f.account_id = ?)`);
  const deleteSession = db.prepare("DELETE FROM sessions WHERE id = ?");
  const insertAccountEvent = db.prepare("INSERT INTO identity_audit(user_id, action, provider, result, reason, created_at) VALUES(?, ?, ?, ?, ?, ?)");

  /** 本人可见的账号记录：不存 IP、UA、邮箱原文和第三方标识。 */
  function accountEvent(accountId: string, action: AccountAction, provider: IdentityProvider | null, result: "ok" | "denied" | "failed", reason: string | null, now = clock()) {
    insertAccountEvent.run(accountId, action, provider, result, reason, now);
  }

  /** 这个 GitHub id 现在属于哪个账号（走到合并链终点）；还没登录过（没有身份）或合并链坏了时为 null。 */
  function accountForGithub(githubUserId: number): string | null {
    const identity = githubIdentity.get(String(githubUserId)) as { user_id: string } | undefined;
    if (!identity) return null;
    try { return terminalAccount(db, identity.user_id).id; } catch { return null; }
  }

  /**
   * GitHub 登录事务（#274 重写：邀请码选填，不再查、不再看 GitHub 组织资格，SPEC §3.2「去掉 GitHub 组织那道门」）。
   * 外部请求（换 token、查用户）都已在事务外做完，这里在一个 `BEGIN IMMEDIATE` 事务里：
   * 找身份，没有就建号——没填邀请码进注册用户，填了且有效进成员，填了但无效直接拒绝（不建号、不悄悄降级）——
   * 沿合并链走到终点、停用拒绝、刷新身份、认领称号与论坛用户（claimAssignments/claimForumUser，SPEC §3.6 第 5 步：
   * 这个 GitHub 账号以前登记过的旧论坛作者，这次自动关联）、插入会话、删请求带来的旧会话、写 identity_audit 与 auth.signin。
   * 任何一步抛错整体回滚：不留半个账号，请求带来的旧会话照常有效；调用方回跳 `failed`。
   */
  function signInWithGithub(input: { github: GithubAccount; accessToken: string; invite?: string | null; previousSid?: string | null; ip?: string }): GithubSigninResult {
    const { github } = input;
    const avatarUrl = github.avatarUrl || null;
    try {
      return db.transaction((): GithubSigninResult => {
        const now = clock();
        let identity = githubIdentity.get(String(github.id)) as { id: string; user_id: string } | undefined;
        let registered = false;
        if (!identity) {
          const invite = input.invite ? redeemInvite(db, input.invite, now) : null;
          if (input.invite && !invite?.ok) throw new Refused("invite_invalid");
          const accountId = newAccountId();
          insertUser.run(accountId, now, now, now);
          identity = { id: newUlid(now), user_id: accountId };
          insertIdentity.run(identity.id, accountId, String(github.id), github.login, avatarUrl, now, now);
          if (invite?.ok) {
            setOrgRole.run("member", now, now, accountId);
            syncPermissionLevel(accountId, "member", `invite:${invite.id}`, now);
          } else {
            syncPermissionLevel(accountId, null, "github-signin", now);
          }
          registered = true;
        }
        const account = terminalAccount(db, identity.user_id);
        if (account.status === "disabled") {
          accountEvent(account.id, "login_denied", "github", "denied", "account_disabled", now);
          deps.audit(null, { login: github.login, account_id: account.id }, "auth.signin_denied", github.login,
            { org: deps.consoleOrg, reason: "account_disabled", provider: "github" }, input.ip);
          return { ok: false, reason: "account_disabled" };
        }
        refreshIdentity.run(github.login, avatarUrl, now, identity.id);
        // 只按 GitHub 数字 id 认领：登录名会改，旧名字也可能被别人注册
        claimAssignments.run(account.id, github.id);
        claimForumUser.run(account.id, github.id, account.id);
        const sid = deps.createSession({ accountId: account.id, provider: "github", login: github.login, userId: github.id, avatarUrl, accessToken: input.accessToken });
        // 换号登录、重复登录：请求带来的旧会话作废
        if (input.previousSid && input.previousSid !== sid) deleteSession.run(input.previousSid);
        if (registered) {
          accountEvent(account.id, "register", "github", "ok", null, now);
          deps.audit(null, { login: github.login, account_id: account.id }, "auth.register", undefined, { provider: "github" }, input.ip);
        }
        accountEvent(account.id, "login", "github", "ok", null, now);
        deps.audit(null, { login: github.login, account_id: account.id }, "auth.signin", github.login, { provider: "github" }, input.ip);
        return { ok: true, sid, accountId: account.id, registered };
      }).immediate();
    } catch (error) {
      if (error instanceof Refused) return { ok: false, reason: error.reason };
      throw error;
    }
  }

  /** 退出：给本人记一条 logout（auth.signout 审计由路由写）。 */
  function recordSignout(accountId: string, provider: IdentityProvider): void {
    accountEvent(accountId, "logout", provider, "ok", null);
  }

  // ── 邮箱、Google、密码与邀请码注册（#262，所有者 2026-10-23 的决定，ADR-0005「2026-10-23 修订」）──

  const identityOf = db.prepare("SELECT id, user_id FROM identities WHERE provider = ? AND provider_uid = ?");
  const githubOfAccount = db.prepare("SELECT provider_uid, login, avatar_url FROM identities WHERE user_id = ? AND provider = 'github'");
  const providerOfAccount = db.prepare("SELECT id FROM identities WHERE user_id = ? AND provider = ?");
  const accountRow = db.prepare(`SELECT id, status, org_state, org_role, handle, invite_code_id, canonical_email, password_hash, password_updated_at, created_at
    FROM users WHERE id = ?`);
  const handleTaken = db.prepare("SELECT 1 FROM users WHERE handle = ?");
  const emailTaken = db.prepare("SELECT 1 FROM identities WHERE provider = 'email' AND provider_uid = ? UNION SELECT 1 FROM users WHERE canonical_email = ?");
  // #274：邀请码选填。@org_role/@invite 为 null 时是普通注册用户；邀请码有效时传 'member' / 邀请码 id（SPEC §3.2）。
  const insertAccount = db.prepare(`INSERT INTO users(id, status, org_state, org_role, org_checked_at, handle, invite_code_id, canonical_email, created_at, updated_at)
    VALUES(@id, 'active', 'active', @org_role, @now, @handle, @invite, @email, @now, @now)`);
  const insertChannel = db.prepare(`INSERT INTO identities(id, user_id, provider, provider_uid, email, email_verified, login, avatar_url, created_at, last_login_at)
    VALUES(@id, @user_id, @provider, @uid, @email, @verified, NULL, NULL, @now, @last_login_at)`);
  const touchIdentity = db.prepare("UPDATE identities SET last_login_at = ? WHERE id = ?");
  const setCanonicalEmail = db.prepare("UPDATE users SET canonical_email = ?, updated_at = ? WHERE id = ? AND canonical_email IS NULL");

  /** 没有绑定 GitHub 的账号用的登录名：yz_ 加 8 位小写 Base32。GitHub 登录名不能有下划线，所以撞不上任何 GitHub 账号。 */
  function newHandle(): string {
    for (;;) {
      const handle = `yz_${base32(randomBits(5), 8).toLowerCase()}`;
      if (!handleTaken.get(handle)) return handle;
    }
  }

  /** 会话里的 login、user_id、avatar_url：有绑定 GitHub 的取 GitHub 的（第二渠道也是），没有的取账号自己的 yz_ 登录名。 */
  function sessionProfile(accountId: string): { login: string; userId: number | null; avatarUrl: string | null } {
    const github = githubOfAccount.get(accountId) as { provider_uid: string; login: string | null; avatar_url: string | null } | undefined;
    if (github?.login) return { login: github.login, userId: Number(github.provider_uid), avatarUrl: github.avatar_url };
    const row = accountRow.get(accountId) as { handle: string | null } | undefined;
    return { login: row?.handle ?? `yz_${accountId.slice(0, 8).toLowerCase()}`, userId: null, avatarUrl: null };
  }

  /**
   * 邮箱（验证码或密码）与 Google 的登录事务（#274 重写：邀请码选填，SPEC §3.2）。外部请求（Google 换 token、验签，
   * bcrypt 比对）都已在事务外做完；这里在一个 `BEGIN IMMEDIATE` 事务里：按 (provider, provider_uid) 找身份 →
   * 没有就建号——没填邀请码进注册用户，填了且有效进成员，填了但无效直接拒绝（不建号、不悄悄降级）→
   * 沿合并链走到终点 → 停用拒绝 → 占用验证码（`claim`）→ 插入会话、删旧会话、写 identity_audit 与 auth.signin。
   * 建号、兑换和占用在同一个事务里，任何一步不成整体回滚：邀请码不白用，验证码不白丢。
   */
  function signInSecondChannel(input: {
    provider: "email" | "google"; uid: string; email: string | null; method: "code" | "password" | "oidc" | "reset";
    invite?: string | null; previousSid?: string | null; ip?: string; claim?: () => boolean;
    /** 默认 true；忘了密码核对（resetPassword）传 false，这条路径不能顺手注册新账号（SPEC「不能注册」）。 */
    register?: boolean;
  }): SigninResult {
    try {
      return db.transaction((): SigninResult => {
        const now = clock();
        let identity = identityOf.get(input.provider, input.uid) as { id: string; user_id: string } | undefined;
        let registered = false;
        if (!identity) {
          if (input.register === false) throw new Refused("no_account");
          // Google 给的邮箱已经是某个账号的邮箱：不另建一个号，也不自动绑定（ADR-0005「不按邮箱合并」）
          if (input.provider === "google" && input.email && emailTaken.get(input.email, input.email)) throw new Refused("email_taken");
          const invite = input.invite ? redeemInvite(db, input.invite, now) : null;
          if (input.invite && !invite?.ok) throw new Refused("invite_invalid");
          const accountId = newAccountId();
          insertAccount.run({
            id: accountId, now, handle: newHandle(), org_role: invite?.ok ? "member" : null,
            invite: invite?.ok ? invite.id : null, email: input.provider === "email" ? input.email : null,
          });
          identity = { id: newUlid(now), user_id: accountId };
          insertChannel.run({
            id: identity.id, user_id: accountId, provider: input.provider, uid: input.uid, email: input.email,
            verified: input.email ? 1 : 0, now, last_login_at: null,
          });
          syncPermissionLevel(accountId, invite?.ok ? "member" : null, invite?.ok ? `invite:${invite.id}` : `${input.provider}-signin`, now);
          registered = true;
        }
        const account = terminalAccount(db, identity.user_id);
        if (account.status === "disabled") {
          accountEvent(account.id, "login_denied", input.provider, "denied", "account_disabled", now);
          deps.audit(null, { login: sessionProfile(account.id).login, account_id: account.id }, "auth.signin_denied", undefined,
            { reason: "account_disabled", provider: input.provider, method: input.method }, input.ip);
          return { ok: false, reason: "account_disabled" };
        }
        if (input.claim && !input.claim()) throw new Refused("code_expired");
        touchIdentity.run(now, identity.id);
        const profile = sessionProfile(account.id);
        const sid = deps.createSession({ accountId: account.id, provider: input.provider, login: profile.login, userId: profile.userId, avatarUrl: profile.avatarUrl, accessToken: "" });
        if (input.previousSid && input.previousSid !== sid) deleteSession.run(input.previousSid);
        if (registered) {
          accountEvent(account.id, "register", input.provider, "ok", null, now);
          deps.audit(null, { login: profile.login, account_id: account.id }, "auth.register", undefined, { provider: input.provider }, input.ip);
        }
        accountEvent(account.id, "login", input.provider, "ok", null, now);
        deps.audit(null, { login: profile.login, account_id: account.id }, "auth.signin", profile.login, { provider: input.provider, method: input.method }, input.ip);
        return { ok: true, sid, accountId: account.id, registered };
      }).immediate();
    } catch (error) {
      if (error instanceof Refused) return { ok: false, reason: error.reason };
      throw error;
    }
  }

  /** 邮箱验证码登录；没有账号时凭邀请码注册。`claim` 在事务里占用验证码。 */
  function signInWithEmailCode(input: { email: string; invite?: string | null; previousSid?: string | null; ip?: string; claim: () => boolean }): SigninResult {
    return signInSecondChannel({ provider: "email", uid: input.email, email: input.email, method: "code", invite: input.invite, previousSid: input.previousSid, ip: input.ip, claim: input.claim });
  }
  /** 邮箱密码登录：路由已经核对过密码（passwordFor + bcrypt），这里只建会话；没有账号不会走到这里。 */
  function signInWithPassword(input: { email: string; previousSid?: string | null; ip?: string }): SigninResult {
    // 路由已经用 passwordFor() 确认过这个邮箱有账号、密码核对也通过了；这里和 resetPassword 一样不顺手注册新账号。
    return signInSecondChannel({ provider: "email", uid: input.email, email: input.email, method: "password", previousSid: input.previousSid, ip: input.ip, register: false });
  }
  /** Google 登录；`email` 只在 email_verified 为真时传。没有账号时凭邀请码注册。 */
  function signInWithGoogle(input: { sub: string; email: string | null; invite?: string | null; previousSid?: string | null; ip?: string }): SigninResult {
    return signInSecondChannel({ provider: "google", uid: input.sub, email: input.email, method: "oidc", invite: input.invite, previousSid: input.previousSid, ip: input.ip });
  }

  /** 这个邮箱绑定的账号（走到合并链终点）和它的密码哈希；邮箱没绑定、账号没设密码时 hash 为空。 */
  function passwordFor(email: string): { accountId: string; hash: string | null } | null {
    const identity = identityOf.get("email", email) as { user_id: string } | undefined;
    if (!identity) return null;
    try {
      const account = terminalAccount(db, identity.user_id);
      const row = accountRow.get(account.id) as { password_hash: string | null };
      return { accountId: account.id, hash: row.password_hash };
    } catch { return null; }
  }

  /** 账号的密码哈希；没设过为空。 */
  function passwordHashOf(accountId: string): string | null {
    return (accountRow.get(accountId) as { password_hash: string | null } | undefined)?.password_hash ?? null;
  }

  /** 写密码哈希、identity_audit 与 account.password；调用方负责事务。`reset` 是忘了密码后用验证码重设（#273）。 */
  function writePassword(accountId: string, hash: string, actor: { login: string; ip?: string }, reset: boolean): void {
    const now = clock();
    const had = (accountRow.get(accountId) as { password_hash: string | null }).password_hash !== null;
    db.prepare("UPDATE users SET password_hash = ?, password_updated_at = ?, updated_at = ? WHERE id = ?").run(hash, now, now, accountId);
    // 改了密码：这个账号用密码以外方式登录的会话不动，其余设备上旧密码换来的会话也不动（不做「退出所有设备」，规格「不做」）
    const kind = reset ? "reset" : had ? "change" : "set";
    accountEvent(accountId, `password_${kind}`, "email", "ok", null, now);
    deps.audit(null, { login: actor.login, account_id: accountId }, "account.password", undefined, { action: kind }, actor.ip);
  }

  /** 设置或修改密码（哈希由路由用 lib/password-policy.ts 算好）；写 identity_audit 与 account.password。 */
  function setPassword(accountId: string, hash: string, actor: { login: string; ip?: string }): void {
    db.transaction(() => writePassword(accountId, hash, actor, false))();
  }

  /**
   * 忘了密码（#273）：邮箱验证码核对过本人，在一个事务里登录（和验证码登录同一条路径：没有账号回 invite_required、
   * 停用或不是成员照旧拒绝、占用验证码、建会话）并换上新密码。不能注册新账号；任何一步不成整体回滚，验证码不白丢。
   */
  function resetPassword(input: { email: string; hash: string; previousSid?: string | null; ip?: string; claim: () => boolean }): SigninResult {
    return db.transaction((): SigninResult => {
      const result = signInSecondChannel({ provider: "email", uid: input.email, email: input.email, method: "reset", previousSid: input.previousSid, ip: input.ip, claim: input.claim, register: false });
      if (result.ok) writePassword(result.accountId, input.hash, { login: sessionProfile(result.accountId).login, ip: input.ip }, true);
      return result;
    }).immediate();
  }

  /** 账号有没有登录邮箱（#273）：没有时统一登录要先请人绑一个。 */
  function hasEmail(accountId: string): boolean {
    return Boolean(providerOfAccount.get(accountId, "email"));
  }

  /**
   * 绑定邮箱（账号页）：`claim` 在事务里占用验证码。这个邮箱已属于别的账号回 identity_conflict（不说是谁），已经绑在本账号上回
   * identity_exists，本账号已有 EMAILS_MAX 个邮箱回 email_limit（#272：一个账号可以绑几个邮箱，第一个是主邮箱）。
   * 成功写身份、identity_audit 与 identity.link；还没有主邮箱时这个就是主邮箱（canonical_email）。
   */
  function linkEmail(input: { accountId: string; email: string; login: string; ip?: string; claim: () => boolean }): LinkResult {
    return db.transaction((): LinkResult => {
      const now = clock();
      const owner = identityOf.get("email", input.email) as { user_id: string } | undefined;
      if (owner && owner.user_id !== input.accountId) {
        accountEvent(input.accountId, "link_conflict", "email", "denied", "identity_conflict", now);
        deps.audit(null, { login: input.login, account_id: input.accountId }, "identity.link_conflict", undefined, { provider: "email" }, input.ip);
        return { ok: false, reason: "identity_conflict" };
      }
      const refusal = emailAddRefusal(input.accountId, input.email);
      if (refusal) return { ok: false, reason: refusal };
      if (!input.claim()) return { ok: false, reason: "code_expired" };
      insertChannel.run({ id: newUlid(now), user_id: input.accountId, provider: "email", uid: input.email, email: input.email, verified: 1, now, last_login_at: null });
      setCanonicalEmail.run(input.email, now, input.accountId);
      accountEvent(input.accountId, "link", "email", "ok", null, now);
      deps.audit(null, { login: input.login, account_id: input.accountId }, "identity.link", undefined, { provider: "email" }, input.ip);
      return { ok: true };
    }).immediate();
  }

  /**
   * 本账号还能不能加这个邮箱（#272）：已经绑在本账号上回 identity_exists，已经有 EMAILS_MAX 个回 email_limit，能加回 null。
   * 不给邮箱时只看个数。发码前（账号页接口）和写入时（linkEmail 的事务里）都按它判断。
   */
  function emailAddRefusal(accountId: string, email?: string): "identity_exists" | "email_limit" | null {
    if (email && (identityOf.get("email", email) as { user_id: string } | undefined)?.user_id === accountId) return "identity_exists";
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM identities WHERE user_id = ? AND provider = 'email'").get(accountId) as { n: number };
    return n >= EMAILS_MAX ? "email_limit" : null;
  }

  /**
   * 删掉本账号的一个邮箱（#272，账号页）：`identityId` 是 accountView 给的邮箱身份 id。不是本账号的邮箱回 not_found，
   * 主邮箱（canonical_email，收验证码和通知的那个）回 primary_email，不能删。用这个邮箱登录的会话不动。
   */
  function unlinkEmail(input: { accountId: string; identityId: string; login: string; ip?: string }): UnlinkResult {
    return db.transaction((): UnlinkResult => {
      const now = clock();
      const row = db.prepare("SELECT i.provider_uid, u.canonical_email FROM identities i JOIN users u ON u.id = i.user_id WHERE i.id = ? AND i.user_id = ? AND i.provider = 'email'")
        .get(input.identityId, input.accountId) as { provider_uid: string; canonical_email: string | null } | undefined;
      if (!row) return { ok: false, reason: "not_found" };
      if (row.provider_uid === row.canonical_email) return { ok: false, reason: "primary_email" };
      db.prepare("DELETE FROM identities WHERE id = ?").run(input.identityId);
      accountEvent(input.accountId, "unlink", "email", "ok", null, now);
      deps.audit(null, { login: input.login, account_id: input.accountId }, "identity.unlink", undefined, { provider: "email" }, input.ip);
      return { ok: true };
    }).immediate();
  }

  /**
   * 老账号补记站内角色（access.resolve，只在 roleUnrecorded 时调）：GitHub 会话第一次用到时用本人令牌查到的组织角色。
   * 查到「不是成员」时成员资格改成 not_member，之后要由控制台重新设成成员。
   */
  function recordOrgRole(accountId: string, role: RecordedOrgRole): void {
    applyOrgRole(accountId, role, "not_member");
  }
  /**
   * `lost`：查到不是成员时，不是靠邀请码注册的账号改成哪种成员资格（not_member，或邀请还没接受的 pending）。
   * #274 之前这里只更新 `users.org_role`；这次改动发现，forum-api/viewer.ts 和 /auth/me（routes/admin/auth.ts）
   * 还在走这条旧的 access.resolve → recordOrgRole 路径（还没切到 requirePermission），只要这两个路由任何一个
   * 先于一次真正的 GitHub 登录（signInWithGithub）被这个账号用到，`roleUnrecorded` 就会被它提前标记为
   * false——而 signInWithGithub 的同步只在 `roleUnrecorded` 为 true 时才补 perm_members，account 就会永远停在
   * 迁移脚本给的默认 level.registered，再也没有路径把它补成 level.member/title.site.owner（除非控制台手动改）。
   * 两个口径都在改账号记的站内角色，就都要在这里同步新权限系统，和 signInWithGithub 用同一个函数。
   */
  function applyOrgRole(accountId: string, role: RecordedOrgRole, lost: "not_member" | "pending"): void {
    const row = accountRow.get(accountId) as { org_role: string | null; org_state: string; invite_code_id: number | null } | undefined;
    if (!row) return;
    const state = role !== null ? "active" : row.invite_code_id === null ? lost : row.org_state;
    if (row.org_role === role && row.org_state === state) return;
    const now = clock();
    db.prepare("UPDATE users SET org_role = ?, org_state = ?, org_checked_at = ?, updated_at = ? WHERE id = ?").run(role, state, now, now, accountId);
    syncPermissionLevel(accountId, role, "access-resolve", now);
  }

  /** 账号记下的成员资格与站内角色：不论用哪种方式登录，判成员和称号都用它（不调用 GitHub）。 */
  function membershipOf(accountId: string): { member: boolean; orgRole: RecordedOrgRole } {
    const row = accountRow.get(accountId) as { status: string; org_state: string; org_role: string | null } | undefined;
    const member = row?.status === "active" && row.org_state === "active";
    const orgRole = member && (row.org_role === "admin" || row.org_role === "member") ? row.org_role : null;
    return { member, orgRole };
  }

  /**
   * 账号页的数据：登录方式（邮箱掩码）、有没有密码、成员资格、最近 20 条账号记录。不含 IP、第三方标识和他人信息。
   * 邮箱另带身份 `id`（删邮箱用）和 `primary`（主邮箱），主邮箱排在别的邮箱前面（#272）。
   */
  function accountView(accountId: string) {
    const row = accountRow.get(accountId) as {
      org_state: string; org_role: string | null; handle: string | null; invite_code_id: number | null; canonical_email: string | null;
      password_hash: string | null; password_updated_at: number | null; created_at: number;
    };
    const identities = (db.prepare(`SELECT id, provider, provider_uid, email, login, created_at, last_login_at FROM identities WHERE user_id = ?
      ORDER BY CASE provider WHEN 'github' THEN 0 WHEN 'email' THEN 1 ELSE 2 END, CASE WHEN provider_uid = ? THEN 0 ELSE 1 END, created_at, rowid`).all(accountId, row.canonical_email) as {
      id: string; provider: IdentityProvider; provider_uid: string; email: string | null; login: string | null; created_at: number; last_login_at: number | null;
    }[]).map(item => ({
      provider: item.provider,
      label: item.provider === "github" ? item.login ?? "" : item.email ? maskEmail(item.email) : "",
      linked_at: item.created_at,
      last_login_at: item.last_login_at,
      ...(item.provider === "email" && { id: item.id, primary: item.provider_uid === row.canonical_email }),
    }));
    const recent = db.prepare("SELECT created_at AS at, action, provider, result FROM identity_audit WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 20")
      .all(accountId) as { at: number; action: string; provider: string | null; result: "ok" | "denied" | "failed" }[];
    return {
      login: sessionProfile(accountId).login,
      identities,
      has_password: row.password_hash !== null,
      password_updated_at: row.password_updated_at,
      membership: { state: row.org_state, org_role: row.org_role, via_invite: row.invite_code_id !== null },
      created_at: row.created_at,
      recent,
    };
  }

  /**
   * 运维用的建号（`dist/cli/account.js`，所有者 2026-10-23「给我的admin账号弄个邮箱登录」）：按 GitHub 数字 id 找到或建立账号，
   * 刷新 GitHub 身份的登录名，记下组织角色，再绑定邮箱。可以重跑：已经绑好的不重复写。只在服务器上由维护者执行，不开接口。
   */
  function provisionAccount(input: { githubId: number; githubLogin: string; orgRole: Exclude<RecordedOrgRole, null>; email: string }): { accountId: string; created: boolean; emailLinked: boolean } {
    return db.transaction(() => {
      const now = clock();
      let identity = githubIdentity.get(String(input.githubId)) as { id: string; user_id: string } | undefined;
      const created = !identity;
      if (!identity) {
        const accountId = newAccountId();
        insertUser.run(accountId, now, now, now);
        identity = { id: newUlid(now), user_id: accountId };
        insertIdentity.run(identity.id, accountId, String(input.githubId), input.githubLogin, null, now, null);
      } else {
        db.prepare("UPDATE identities SET login = ? WHERE id = ?").run(input.githubLogin, identity.id);
      }
      const account = terminalAccount(db, identity.user_id);
      db.prepare("UPDATE users SET org_state = 'active', org_role = ?, org_checked_at = ?, updated_at = ? WHERE id = ?").run(input.orgRole, now, now, account.id);
      syncPermissionLevel(account.id, input.orgRole, "cli:provision", now);
      claimAssignments.run(account.id, input.githubId);
      claimForumUser.run(account.id, input.githubId, account.id);
      const owner = identityOf.get("email", input.email) as { user_id: string } | undefined;
      if (owner && owner.user_id !== account.id) throw new Error("this email already belongs to another account");
      let emailLinked = false;
      if (!owner) {
        if (providerOfAccount.get(account.id, "email")) throw new Error("this account already has a different email");
        insertChannel.run({ id: newUlid(now), user_id: account.id, provider: "email", uid: input.email, email: input.email, verified: 1, now, last_login_at: null });
        setCanonicalEmail.run(input.email, now, account.id);
        accountEvent(account.id, "link", "email", "ok", "provisioned", now);
        emailLinked = true;
      }
      deps.audit(null, "system", "account.provision", input.githubLogin, { account_id: account.id, created, email_linked: emailLinked, org_role: input.orgRole });
      return { accountId: account.id, created, emailLinked };
    }).immediate();
  }

  /**
   * 「成员与权限」的名单（#262 第四期）：每个没被合并的账号，带站内角色、成员资格、GitHub 身份（登录名、数字 id、头像）、
   * 登录方式和最近一次登录。邮箱只给掩码，不给第三方标识以外的东西。
   */
  const PROVIDER_ORDER: IdentityProvider[] = ["github", "email", "google"];
  function listAccounts(): AccountSummary[] {
    const rows = db.prepare(`SELECT u.id, u.status, u.org_state, u.org_role, u.handle, u.invite_code_id, u.created_at,
        g.provider_uid AS github_id, g.login AS github_login, g.avatar_url,
        (SELECT group_concat(i.provider) FROM identities i WHERE i.user_id = u.id) AS providers,
        (SELECT MAX(i.last_login_at) FROM identities i WHERE i.user_id = u.id) AS last_login_at
      FROM users u
      LEFT JOIN identities g ON g.user_id = u.id AND g.provider = 'github'
      WHERE u.status <> 'merged'
      ORDER BY u.created_at ASC, u.id ASC`).all() as {
      id: string; status: "active" | "disabled"; org_state: string; org_role: string | null; handle: string | null; invite_code_id: number | null; created_at: number;
      github_id: string | null; github_login: string | null; avatar_url: string | null; providers: string | null; last_login_at: number | null;
    }[];
    return rows.map(row => {
      const member = row.status === "active" && row.org_state === "active";
      return {
        account_id: row.id,
        login: row.github_login ?? row.handle ?? `yz_${row.id.slice(0, 8).toLowerCase()}`,
        github_login: row.github_login,
        github_user_id: row.github_id === null ? null : Number(row.github_id),
        avatar_url: row.avatar_url,
        // 与账号页同一个顺序：GitHub、邮箱、Google
        providers: PROVIDER_ORDER.filter(provider => (row.providers ?? "").split(",").includes(provider)),
        status: row.status,
        member,
        site_role: member && (row.org_role === "admin" || row.org_role === "member") ? row.org_role : null,
        role_unrecorded: row.status === "active" && row.org_state === "active" && row.org_role === null && row.invite_code_id === null,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
      };
    });
  }

  /**
   * 控制台改账号的站内角色（#262 第四期，只有提督能改，路由检查）：管理员、成员，或「不是成员」（移出极客班：
   * 不能再登录，已有会话拿不到任何能力，论坛按游客）。不能把最后一位管理员改掉，免得没人能再管。
   * 写 identity_audit（本人看得到）与 account.role 审计。
   */
  function setSiteRole(input: { accountId: string; role: SiteRoleChoice; actor: AuditActor; ip?: string }): { ok: true; changed: boolean } | { ok: false; reason: "not_found" | "last_admin" } {
    return db.transaction(() => {
      const row = roleRow.get(input.accountId) as { status: string; org_state: string; org_role: string | null } | undefined;
      if (!row || row.status === "merged") return { ok: false as const, reason: "not_found" as const };
      const before: SiteRoleChoice = row.org_state !== "active" ? "none" : row.org_role === "admin" ? "admin" : "member";
      if (before === input.role && (input.role === "none" || row.org_role === input.role)) return { ok: true as const, changed: false };
      if (before === "admin" && input.role !== "admin" && adminCount() <= 1) return { ok: false as const, reason: "last_admin" as const };
      const now = clock();
      if (input.role === "none") db.prepare("UPDATE users SET org_role = NULL, org_state = 'not_member', org_checked_at = ?, updated_at = ? WHERE id = ?").run(now, now, input.accountId);
      else db.prepare("UPDATE users SET org_role = ?, org_state = 'active', org_checked_at = ?, updated_at = ? WHERE id = ?").run(input.role, now, now, input.accountId);
      syncPermissionLevel(input.accountId, input.role === "none" ? null : input.role, "console:set-site-role", now);
      accountEvent(input.accountId, "role_change", null, "ok", input.role, now);
      deps.audit(null, input.actor, "account.role", sessionProfile(input.accountId).login, { account_id: input.accountId, from: before, to: input.role }, input.ip);
      return { ok: true as const, changed: true };
    }).immediate();
  }

  /** 指派称号的对象（#262 第四期）：账号（走到合并链终点）和它的登录名、GitHub 数字 id；账号不存在或已合并坏链时为 null。 */
  function accountTarget(accountId: string): { accountId: string; login: string; githubUserId: number | null } | null {
    if (!roleRow.get(accountId)) return null;
    try {
      const account = terminalAccount(db, accountId);
      const profile = sessionProfile(account.id);
      return { accountId: account.id, login: profile.login, githubUserId: profile.userId };
    } catch { return null; }
  }

  /** 按 GitHub 登录名（不分大小写）找已经登录过的账号的 GitHub 身份：指派称号时 GitHub 没接上，就只认站内认识的人。 */
  function githubIdentityByLogin(login: string): { accountId: string; githubUserId: number; login: string } | null {
    const row = db.prepare("SELECT user_id, provider_uid, login FROM identities WHERE provider = 'github' AND lower(login) = lower(?) ORDER BY last_login_at DESC LIMIT 1")
      .get(login) as { user_id: string; provider_uid: string; login: string } | undefined;
    if (!row) return null;
    try { return { accountId: terminalAccount(db, row.user_id).id, githubUserId: Number(row.provider_uid), login: row.login }; } catch { return null; }
  }

  // ── 对外授权与 GitLab 同步（#270）：只读 ──
  // #274 SPEC §3.2：邀请码选填之后，新建的账号不论有没有邀请码，org_state 都写 'active'（组织那道门已经去掉，
  // 这一列不再代表真的成员资格，只保留给历史数据，详见 docs 里的「org_state 已弃用」说明）。对外授权
  // （OIDC、GitLab 同步）判定「是不是成员」必须另外看新权限引擎的 level.member 组，不能再信 org_state。
  const claimsSelect = `SELECT u.id, u.status, u.org_state, u.org_role, u.handle, u.canonical_email,
      g.provider_uid AS github_id, g.login AS github_login, g.avatar_url,
      EXISTS (SELECT 1 FROM perm_members pm WHERE pm.account_id = u.id AND pm.group_id = 'level.member') AS is_level_member
    FROM users u LEFT JOIN identities g ON g.user_id = u.id AND g.provider = 'github'`;
  type ClaimsRow = {
    id: string; status: "active" | "disabled" | "merged"; org_state: string; org_role: string | null; handle: string | null; canonical_email: string | null;
    github_id: string | null; github_login: string | null; avatar_url: string | null; is_level_member: 0 | 1;
  };
  const toClaims = (row: ClaimsRow): AccountClaims => {
    const member = row.status === "active" && row.is_level_member === 1;
    return {
      account_id: row.id,
      status: row.status === "active" ? "active" : "disabled",
      member,
      site_role: member && (row.org_role === "admin" || row.org_role === "member") ? row.org_role : null,
      login: row.github_login ?? row.handle ?? `yz_${row.id.slice(0, 8).toLowerCase()}`,
      handle: row.handle,
      github: row.github_id !== null && row.github_login ? { id: Number(row.github_id), login: row.github_login, avatar_url: row.avatar_url } : null,
      email: row.canonical_email,
      emails: emailsOf(row.id, row.canonical_email),
    };
  };
  const claimsOf = db.prepare(`${claimsSelect} WHERE u.id = ?`);
  const emailsSelect = db.prepare("SELECT provider_uid FROM identities WHERE user_id = ? AND provider = 'email' ORDER BY created_at, rowid");
  /** 绑定的全部邮箱，主邮箱在前（#272）。 */
  function emailsOf(accountId: string, primary: string | null): string[] {
    const all = (emailsSelect.all(accountId) as { provider_uid: string }[]).map(item => item.provider_uid);
    return primary && all.includes(primary) ? [primary, ...all.filter(email => email !== primary)] : all;
  }

  /** 一个账号的信息；账号不存在或已被合并（不是终点账号）时为 null。 */
  function getAccountClaims(accountId: string): AccountClaims | null {
    const row = claimsOf.get(accountId) as ClaimsRow | undefined;
    return row && row.status !== "merged" ? toClaims(row) : null;
  }

  /** 所有没被合并的账号，按建号先后。GitLab 同步按它对账：停用的、不是成员的也在里面，同步据此封禁。 */
  function listAccountsForSync(): AccountClaims[] {
    return (db.prepare(`${claimsSelect} WHERE u.status <> 'merged' ORDER BY u.created_at ASC, u.id ASC`).all() as ClaimsRow[]).map(toClaims);
  }

  return {
    signInWithGithub, recordSignout, accountForGithub,
    signInWithEmailCode, signInWithPassword, signInWithGoogle, passwordFor, passwordHashOf, setPassword, resetPassword, hasEmail, linkEmail, unlinkEmail, emailAddRefusal,
    recordOrgRole, roleUnrecorded, membershipOf, accountView, provisionAccount, listAccounts, setSiteRole, githubIdentityByLogin, accountTarget,
    getAccountClaims, listAccountsForSync,
  };
}
export type IdentityStore = ReturnType<typeof createIdentityStore>;
