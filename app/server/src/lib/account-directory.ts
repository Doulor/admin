import type { AccountClaims, IdentityStore } from "./identity-store.js";
import { avatarPath } from "./forum-store.js";

/**
 * 对外看到的极客班账号（#270）：账号信息（lib/identity-store.ts）加上论坛里的资料（显示名、简介、所在地、网站、上传的头像）。
 * 对外授权按它发声明，GitLab 同步按它建号。论坛资料归 lib/forum-store.ts，这里只读。
 */
export type DirectoryProfile = { displayName: string; bio: string; location: string; website: string; avatarHash: string | null };
export type DirectoryAccount = AccountClaims & {
  name: string;
  /** 头像的完整地址：论坛上传的头像，没有时用 GitHub 头像，都没有为 null */
  picture: string | null;
  profile: DirectoryProfile | null;
};
/** 对外授权的声明：只给是成员的账号。 */
export type OidcAccount = { accountId: string; login: string; name: string; picture: string | null; email: string | null };

export function createAccountDirectory(deps: {
  identity: Pick<IdentityStore, "getAccountClaims" | "listAccountsForSync">;
  forum: { profileForAccount(accountId: string): DirectoryProfile | null };
  publicOrigin: string;
}) {
  const withProfile = (claims: AccountClaims): DirectoryAccount => {
    const profile = deps.forum.profileForAccount(claims.account_id);
    const picture = profile?.avatarHash ? `${deps.publicOrigin}${avatarPath(profile.avatarHash)}` : claims.github?.avatar_url ?? null;
    return { ...claims, name: profile?.displayName.trim() || claims.login, picture, profile };
  };

  function account(accountId: string): DirectoryAccount | null {
    const claims = deps.identity.getAccountClaims(accountId);
    return claims ? withProfile(claims) : null;
  }

  /** 发给下游的声明；停用的、不是成员的账号为 null，授权与换令牌都会失败。 */
  function oidcAccount(accountId: string): OidcAccount | null {
    const found = account(accountId);
    if (!found || !found.member) return null;
    return { accountId: found.account_id, login: found.login, name: found.name, picture: found.picture, email: found.email };
  }

  function listForSync(): DirectoryAccount[] {
    return deps.identity.listAccountsForSync().map(withProfile);
  }

  return { account, oidcAccount, listForSync };
}
export type AccountDirectory = ReturnType<typeof createAccountDirectory>;
