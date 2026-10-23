import type Database from "better-sqlite3";

/**
 * 账号资料（#274 CONTRACT §2）：论坛、控制台、GitLab 同步、OIDC userinfo、命令行统一读这里。
 * `account_profiles` 由迁移脚本（lib/migrations/2026-10-yugc-v2.ts）给每个账号建一行；这里的 `ensure()`
 * 只是兜底，防止极少数绕过迁移直接插 `users` 行的测试或老流程漏掉。
 */
export type AccountProfile = { username: string; display_name: string; bio: string; avatar_url: string | null; prefs: Record<string, unknown> };
export type ProfilePatch = { display_name?: string; bio?: string; username?: string; prefs?: Record<string, unknown> };
export type ProfileUpdateResult = { ok: true; profile: AccountProfile } | { ok: false; reason: "username_taken" };

export function createAccountProfiles(db: Database.Database, deps: { clock?: () => number } = {}) {
  const clock = deps.clock ?? Date.now;
  const selectRow = db.prepare("SELECT username, display_name, bio, avatar_hash, prefs FROM account_profiles WHERE account_id = ?");
  const usernameTaken = db.prepare("SELECT 1 FROM account_profiles WHERE username = ? COLLATE NOCASE AND account_id <> ?");
  const updateStmt = db.prepare("UPDATE account_profiles SET username = ?, display_name = ?, bio = ?, prefs = ?, updated_at = ? WHERE account_id = ?");
  const insertIfMissing = db.prepare("INSERT OR IGNORE INTO account_profiles(account_id, username, display_name, bio, prefs, updated_at) VALUES (?, ?, ?, '', '{}', ?)");
  const setAvatarStmt = db.prepare("UPDATE account_profiles SET avatar_hash = ?, updated_at = ? WHERE account_id = ?");
  const insertAvatarData = db.prepare("INSERT OR IGNORE INTO account_avatars(hash, data, mime, created_at) VALUES (?, ?, 'image/webp', ?)");
  const avatarDataStmt = db.prepare("SELECT data FROM account_avatars WHERE hash = ?");

  function avatarUrl(hash: string | null): string | null {
    return hash ? `/api/identity/avatar/${hash}.webp` : null;
  }

  function ensure(accountId: string): void {
    // 账号 id 是 Crockford base32（见 identity-store.ts 的 newAccountId），字母是大写的；兜底用户名必须小写，
    // 否则不满足 PATCH /api/identity/profile 的 username 合同（^[a-z0-9_]{3,24}$，CONTRACT-274 §2）。
    if (!selectRow.get(accountId)) insertIfMissing.run(accountId, `acct_${accountId.replace(/-/g, "").slice(0, 16).toLowerCase()}`, "", clock());
  }

  function get(accountId: string): AccountProfile {
    ensure(accountId);
    const row = selectRow.get(accountId) as { username: string; display_name: string; bio: string; avatar_hash: string | null; prefs: string };
    return { username: row.username, display_name: row.display_name, bio: row.bio, avatar_url: avatarUrl(row.avatar_hash), prefs: JSON.parse(row.prefs || "{}") };
  }

  /** `prefs` 是合并写，不是整份替换（CONTRACT §2）；`username` 唯一性不分大小写，自己原来的名字不算占用。 */
  function update(accountId: string, patch: ProfilePatch): ProfileUpdateResult {
    ensure(accountId);
    const current = selectRow.get(accountId) as { username: string; display_name: string; bio: string; prefs: string };
    if (patch.username !== undefined && patch.username.toLowerCase() !== current.username.toLowerCase() && usernameTaken.get(patch.username, accountId)) {
      return { ok: false, reason: "username_taken" };
    }
    const username = patch.username ?? current.username;
    const displayName = patch.display_name ?? current.display_name;
    const bio = patch.bio ?? current.bio;
    const prefs = { ...JSON.parse(current.prefs || "{}"), ...(patch.prefs ?? {}) };
    updateStmt.run(username, displayName, bio, JSON.stringify(prefs), clock(), accountId);
    return { ok: true, profile: get(accountId) };
  }

  function setAvatar(accountId: string, hash: string, data: Buffer): void {
    ensure(accountId);
    insertAvatarData.run(hash, data, clock());
    setAvatarStmt.run(hash, clock(), accountId);
  }

  function avatar(hash: string): Buffer | null {
    return (avatarDataStmt.get(hash) as { data: Buffer } | undefined)?.data ?? null;
  }

  return { get, update, setAvatar, avatar, avatarUrl };
}
export type AccountProfileStore = ReturnType<typeof createAccountProfiles>;
