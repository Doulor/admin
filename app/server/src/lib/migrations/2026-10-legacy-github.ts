import type Database from "better-sqlite3";
import { newAccountId, newUlid } from "../identity-store.js";
import { bumpPermRevision, setExclusiveGroupMembership } from "../permissions.js";

/**
 * #306：v0.1.1 升级后旧 GitHub 用户的账号与成员资格补齐。
 *
 * 升级前的库里「谁是 GitHub 用户」只写在三处：会话、论坛用户（`forum_users.github_user_id`）、站内角色名册
 * （`role_assignments.github_user_id`）。`backfillIdentity` 只给「启动时还没过期的会话」建了账号，其余老用户在
 * 新模型里没有账号和 GitHub 身份，重新登录会被当成新用户；已经建好的账号又因为 `org_role` 为空全落在注册用户。
 * 这里按论坛用户和名册把缺的补上，成员资格按旧记录恢复，只增不删，各只跑一次（`console_seeds`）。
 *
 * 「升级前」以 `console_seeds.identity_v1` 的时间为界：只处理那之前就存在的行，之后新注册的人不受影响。
 */

const RESTORE_SEED = "legacy_github_v1";
const LEVELS_SEED = "legacy_github_v1_levels";
const MIGRATION_GRANT = "migration:2026-10-yugc-v2";
/** 自动授予的注册用户来源：迁移分身份、GitHub 登录新建号。别的来源（控制台、邀请码）视为人工决定，不动。 */
const AUTO_REGISTERED_GRANTS = [MIGRATION_GRANT, "github-signin"];

type Legacy = {
  githubId: number; login: string; avatarUrl: string | null; seenAt: number;
  forumRole: string | null; rosterRoles: Set<string>;
};
type RestoredRole = "admin" | "member" | null;

/**
 * 旧记录里这个人在站内是什么角色：论坛旧管理员 → 管理员；名册里的成员、队长、舰长 → 成员；名册里只有往届的不设
 * （论坛行的默认角色是 member，不能把往届成员提成成员）；没有名册、论坛角色是成员 → 成员。
 */
function legacyOrgRole(person: Legacy): RestoredRole {
  if (person.forumRole === "admin") return "admin";
  if (["member", "head", "captain"].some(role => person.rosterRoles.has(role))) return "member";
  if (person.rosterRoles.has("alumni")) return null;
  return person.forumRole === "member" ? "member" : null;
}

function seedTime(db: Database.Database, name: string): number | null {
  const row = db.prepare("SELECT seeded_at FROM console_seeds WHERE name = ?").get(name) as { seeded_at: number } | undefined;
  return row?.seeded_at ?? null;
}
const markSeed = (db: Database.Database, name: string, now: number) =>
  db.prepare("INSERT OR IGNORE INTO console_seeds(name, seeded_at) VALUES (?, ?)").run(name, now);

function collectLegacy(db: Database.Database, cutoff: number): Legacy[] {
  const people = new Map<number, Legacy>();
  const forum = db.prepare(`SELECT github_user_id, username, github_avatar_url, role, joined_at, updated_at FROM forum_users
    WHERE github_user_id IS NOT NULL AND joined_at <= ?`).all(cutoff) as
    { github_user_id: number; username: string; github_avatar_url: string | null; role: string; joined_at: number; updated_at: number }[];
  for (const row of forum) {
    people.set(row.github_user_id, {
      githubId: row.github_user_id, login: row.username, avatarUrl: row.github_avatar_url || null,
      seenAt: Math.max(row.joined_at, row.updated_at), forumRole: row.role, rosterRoles: new Set(),
    });
  }
  const roster = db.prepare(`SELECT github_user_id, github_login, role, created_at FROM role_assignments
    WHERE github_user_id IS NOT NULL AND created_at <= ? ORDER BY id`).all(cutoff) as
    { github_user_id: number; github_login: string; role: string; created_at: number }[];
  for (const row of roster) {
    const known = people.get(row.github_user_id);
    if (known) {
      // 论坛里的用户名是 GitHub 登录名的最近一次记录，名册里的写法可能是旧的或小写的，不覆盖
      known.rosterRoles.add(row.role);
      continue;
    }
    people.set(row.github_user_id, {
      githubId: row.github_user_id, login: row.github_login, avatarUrl: null,
      seenAt: row.created_at, forumRole: null, rosterRoles: new Set([row.role]),
    });
  }
  return [...people.values()];
}

export type LegacyRestoreReport = { ran: boolean; created: number; adopted: number; forum_claimed: number; roster_claimed: number; ledger_reset: number };

/**
 * 补建缺的账号和 GitHub 身份、给已有账号补上站内角色、认领论坛用户与名册，并把被预先记成「已映射」却没有真正
 * 映射的名册行从台账里撤掉，让随后的 `mapRoleAssignments` 把它们映射上。必须排在 `assignAccountIdentities` 之前。
 */
export function restoreLegacyGithubAccounts(db: Database.Database, now: number): LegacyRestoreReport {
  const report: LegacyRestoreReport = { ran: false, created: 0, adopted: 0, forum_claimed: 0, roster_claimed: 0, ledger_reset: 0 };
  const cutoff = seedTime(db, "identity_v1");
  if (cutoff === null || seedTime(db, RESTORE_SEED) !== null) return report;
  report.ran = true;
  db.transaction(() => {
    const accountOf = db.prepare("SELECT user_id FROM identities WHERE provider = 'github' AND provider_uid = ?");
    const insertUser = db.prepare("INSERT INTO users(id, status, org_state, org_role, org_checked_at, created_at, updated_at) VALUES (?, 'active', 'active', ?, ?, ?, ?)");
    const insertIdentity = db.prepare(`INSERT INTO identities(id, user_id, provider, provider_uid, login, avatar_url, created_at, last_login_at)
      VALUES (?, ?, 'github', ?, ?, ?, ?, ?)`);
    // 控制台把人设成「不是成员」后同样是 org_role 空、org_state not_member，和 GitHub 登录新建的注册用户同形：
    // 靠等级的授予来源区分，来源不是自动授予的（所有者的决定）不动
    const adopt = db.prepare(`UPDATE users SET org_role = ?, org_state = 'active', org_checked_at = COALESCE(org_checked_at, ?), updated_at = ?
      WHERE id = ? AND status = 'active' AND org_role IS NULL AND invite_code_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM perm_members pm JOIN perm_groups g ON g.id = pm.group_id
          WHERE pm.account_id = users.id AND g.kind = 'level' AND pm.granted_by NOT IN (${AUTO_REGISTERED_GRANTS.map(() => "?").join(",")}))`);
    const claimForum = db.prepare(`UPDATE forum_users SET account_id = ? WHERE account_id IS NULL AND github_user_id = ?
      AND NOT EXISTS (SELECT 1 FROM forum_users f WHERE f.account_id = ?)`);
    const claimRoster = db.prepare("UPDATE role_assignments SET account_id = ? WHERE account_id IS NULL AND github_user_id = ?");
    for (const person of collectLegacy(db, cutoff)) {
      const role = legacyOrgRole(person);
      const existing = accountOf.get(String(person.githubId)) as { user_id: string } | undefined;
      let accountId = existing?.user_id;
      if (!accountId) {
        accountId = newAccountId();
        insertUser.run(accountId, role, person.seenAt, now, now);
        insertIdentity.run(newUlid(now), accountId, String(person.githubId), person.login, person.avatarUrl, now, person.seenAt);
        report.created++;
      } else if (role && adopt.run(role, person.seenAt, now, accountId, ...AUTO_REGISTERED_GRANTS).changes > 0) {
        report.adopted++;
      }
      report.forum_claimed += claimForum.run(accountId, person.githubId, accountId).changes;
      report.roster_claimed += claimRoster.run(accountId, person.githubId).changes;
    }
    // 台账把「刚被认领、还没有任何权限成员记录」的名册行也记成已映射（#306 之前的写法），这里撤掉，交给 mapRoleAssignments
    const autoOnly = db.prepare(`SELECT ra.id FROM role_assignments ra
      WHERE ra.account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM perm_members pm JOIN perm_groups g ON g.id = pm.group_id
          WHERE pm.account_id = ra.account_id AND NOT (g.id = 'level.registered' AND pm.granted_by IN (${AUTO_REGISTERED_GRANTS.map(() => "?").join(",")})))`)
      .all(...AUTO_REGISTERED_GRANTS) as { id: number }[];
    const dropKey = db.prepare("DELETE FROM perm_seed_applied WHERE key = ?");
    for (const row of autoOnly) report.ledger_reset += dropKey.run(`role_assignment:${row.id}`).changes;
    markSeed(db, RESTORE_SEED, now);
    // 和 backfillIdentity 一样留一条系统审计，迁移步骤随后把它复制进操作记录；只记数量，不记人
    if (report.created + report.adopted + report.forum_claimed + report.roster_claimed + report.ledger_reset > 0) {
      db.prepare("INSERT INTO audit_logs(org, actor, action, target, details, ip, created_at, actor_account_id) VALUES(NULL, 'system', 'identity.legacy_restore', NULL, ?, NULL, ?, NULL)")
        .run(JSON.stringify({ created: report.created, adopted: report.adopted, forum_claimed: report.forum_claimed, roster_claimed: report.roster_claimed, ledger_reset: report.ledger_reset }), now);
    }
  }).immediate();
  return report;
}

/**
 * 已经建好、停在自动授予的注册用户的旧成员：论坛旧管理员 → 成员与站长，其余旧成员 → 成员。来源不是自动授予的
 * （所有者在控制台调过的）不动。排在 `mapRoleAssignments` 之后。
 */
export function repairLegacyLevels(db: Database.Database, now: number): number {
  if (seedTime(db, "identity_v1") === null || seedTime(db, LEVELS_SEED) !== null) return 0;
  let changed = 0;
  db.transaction(() => {
    const stuck = db.prepare(`SELECT u.id, u.org_role FROM users u
      JOIN perm_members pm ON pm.account_id = u.id AND pm.group_id = 'level.registered' AND pm.granted_by IN (${AUTO_REGISTERED_GRANTS.map(() => "?").join(",")})
      WHERE u.status = 'active' AND u.org_state = 'active' AND u.org_role IN ('member', 'admin')`)
      .all(...AUTO_REGISTERED_GRANTS) as { id: string; org_role: "member" | "admin" }[];
    const addOwner = db.prepare("INSERT OR IGNORE INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, 'title.site.owner', NULL, ?, ?)");
    for (const account of stuck) {
      setExclusiveGroupMembership(db, account.id, "level.member", now, MIGRATION_GRANT);
      if (account.org_role === "admin") addOwner.run(account.id, MIGRATION_GRANT, now);
      changed++;
    }
    if (changed > 0) bumpPermRevision(db);
    markSeed(db, LEVELS_SEED, now);
  }).immediate();
  return changed;
}
