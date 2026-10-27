import type { AccountProfile } from "./account-profiles.js";

export type PublicAccountProfile = Pick<AccountProfile, "username" | "display_name" | "bio" | "avatar_url">;

/** 统一公开资料：沿用账号目录的空昵称 / 无上传头像回退，不带偏好、邮箱或实名信息。 */
export function publicProfile(profile: PublicAccountProfile, fallback: { login: string; avatarUrl: string | null }): PublicAccountProfile {
  return {
    username: profile.username,
    display_name: profile.display_name.trim() || fallback.login,
    bio: profile.bio,
    avatar_url: profile.avatar_url || fallback.avatarUrl,
  };
}
