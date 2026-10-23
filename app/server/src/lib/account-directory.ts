import type { AccountClaims, IdentityStore } from "./identity-store.js";
import { avatarPath } from "./account-profiles.js";

/**
 * 对外看到的极客班账号（#270；#274 改成读统一资料 account_profiles，取代论坛自己的资料）：账号信息
 * （lib/identity-store.ts）加上统一资料（用户名、显示名、简介、上传的头像）。对外授权（OIDC userinfo）按它
 * 发声明，GitLab 同步按它建号、填资料。统一资料归 lib/account-profiles.ts，这里只读。
 */
export type DirectoryProfile = { username: string; displayName: string; bio: string; avatarHash: string | null };
export type DirectoryAccount = AccountClaims & {
  name: string;
  /** 头像的完整地址：账号资料里上传的头像，没有时用 GitHub 头像，都没有为 null */
  picture: string | null;
  profile: DirectoryProfile | null;
};
/** 对外授权的声明：只给是成员的账号。 */
export type OidcAccount = { accountId: string; login: string; username: string; name: string; picture: string | null; email: string | null };

export function createAccountDirectory(deps: {
  identity: Pick<IdentityStore, "getAccountClaims" | "listAccountsForSync">;
  profiles: { get(accountId: string): { username: string; display_name: string; bio: string; avatar_url: string | null } };
  publicOrigin: string;
}) {
  const withProfile = (claims: AccountClaims): DirectoryAccount => {
    // account_profiles.get() 会兜底建档（ensure()），所以这里永远有资料行；avatar_url 已经是 `/api/identity/avatar/<hash>.webp`
    // 这样的路径，截出 hash 部分供 GitLab 同步按内容去重、判断头像有没有变过。
    const row = deps.profiles.get(claims.account_id);
    const avatarHash = row.avatar_url ? row.avatar_url.replace(/^\/api\/identity\/avatar\//, "").replace(/\.webp$/, "") : null;
    const profile: DirectoryProfile = { username: row.username, displayName: row.display_name, bio: row.bio, avatarHash };
    const picture = avatarHash ? `${deps.publicOrigin}${avatarPath(avatarHash)}` : claims.github?.avatar_url ?? null;
    return { ...claims, name: profile.displayName.trim() || claims.login, picture, profile };
  };

  function account(accountId: string): DirectoryAccount | null {
    const claims = deps.identity.getAccountClaims(accountId);
    return claims ? withProfile(claims) : null;
  }

  /** 发给下游的声明；停用的、不是成员的账号为 null，授权与换令牌都会失败。 */
  function oidcAccount(accountId: string): OidcAccount | null {
    const found = account(accountId);
    if (!found || !found.member) return null;
    return { accountId: found.account_id, login: found.login, username: found.profile?.username ?? found.login, name: found.name, picture: found.picture, email: found.email };
  }

  function listForSync(): DirectoryAccount[] {
    return deps.identity.listAccountsForSync().map(withProfile);
  }

  return { account, oidcAccount, listForSync };
}
export type AccountDirectory = ReturnType<typeof createAccountDirectory>;
