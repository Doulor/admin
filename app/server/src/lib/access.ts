import { computeAccess, type Access, type OrgRole } from "./roles.js";
import type { RoleStore } from "./role-store.js";
import type { IdentityProvider } from "./identity-store.js";

export type AccessDeps = {
  consoleOrg: string;
  getOrgRole: (token: string, org: string, login: string) => Promise<OrgRole>;
  cached: <T>(key: string, ttlMs: number, fn: () => Promise<T>) => Promise<T>;
  roles: RoleStore;
  /** 账号记下的成员资格与站内角色（lib/identity-store.ts 的 membershipOf / roleUnrecorded / recordOrgRole）。 */
  membership: {
    of: (accountId: string) => { member: boolean; orgRole: OrgRole };
    unrecorded: (accountId: string) => boolean;
    record: (accountId: string, role: OrgRole) => void;
  };
};
/** `accountId`：会话的极客班账号（#262），称号先按它认人；`provider`：这次的登录方式，只有 GitHub 会话有 GitHub 令牌。 */
export type ResolveInput = { login: string; userId: number | null; accountId: string | null; accessToken: string; provider: IdentityProvider };

/** 补记站内角色时查到的 GitHub 组织角色缓存 60 秒。错误不缓存（由 cache 保证）。 */
export const ORG_ROLE_TTL_MS = 60_000;

/**
 * 身份解析：只接受普通参数，不接触 Fastify 请求。
 * 权限只认极客班账号（#262 第四期，所有者 2026-10-23「有关 GitHub 的权限是要放权的」）：不论用哪种方式登录，
 * 成员资格和站内角色都按账号记下的给，不调用 GitHub。唯一的例外是回填建的老账号还没记过站内角色：它的 GitHub 会话
 * 第一次用到时用本人令牌查一次 GitHub 组织角色并记下来，之后就只认站内记录、由控制台改。
 * 查 GitHub 失败直接抛出，由 http-policy 统一映射，绝不把失败当成「不是成员」。
 */
export function createAccess({ consoleOrg, getOrgRole, cached, roles, membership }: AccessDeps) {
  async function orgRole(login: string, accessToken: string): Promise<OrgRole> {
    return cached(`console:orgrole:${login.toLowerCase()}`, ORG_ROLE_TTL_MS, () => getOrgRole(accessToken, consoleOrg, login));
  }
  async function resolve({ login, userId, accountId, accessToken, provider }: ResolveInput): Promise<Access> {
    if (accountId && provider === "github" && accessToken && membership.unrecorded(accountId)) {
      membership.record(accountId, await orgRole(login, accessToken));
    }
    const { member, orgRole: siteRole } = accountId ? membership.of(accountId) : { member: false, orgRole: null };
    return computeAccess({
      login, siteRole, member,
      assignments: roles.assignmentsFor(login, userId, accountId),
      departments: roles.listDepartments(),
      titles: roles.titleConfigs(),
    });
  }
  return { consoleOrg, resolve };
}
export type AccessService = ReturnType<typeof createAccess>;
