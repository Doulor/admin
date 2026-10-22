import { computeAccess, type Access, type OrgRole } from "./roles.js";
import type { RoleStore } from "./role-store.js";
import type { IdentityProvider } from "./identity-store.js";

export type AccessDeps = {
  consoleOrg: string;
  getOrgRole: (token: string, org: string, login: string) => Promise<OrgRole>;
  cached: <T>(key: string, ttlMs: number, fn: () => Promise<T>) => Promise<T>;
  roles: RoleStore;
  /** 账号记下的成员资格与组织角色（lib/identity-store.ts 的 membershipOf / recordOrgRole）。 */
  membership: {
    of: (accountId: string) => { member: boolean; orgRole: OrgRole };
    record: (accountId: string, role: OrgRole) => void;
  };
};
/** `accountId`：会话的极客班账号（#262），称号先按它认人；`provider`：这次的登录方式，只有 GitHub 会话有 GitHub 令牌。 */
export type ResolveInput = { login: string; userId: number | null; accountId: string | null; accessToken: string; provider: IdentityProvider };

/** GitHub 组织角色缓存 60 秒；撤销组织管理员最长 60 秒后生效。错误不缓存（由 cache 保证）。 */
export const ORG_ROLE_TTL_MS = 60_000;

/**
 * 身份解析：只接受普通参数，不接触 Fastify 请求。
 * GitHub 会话用本人令牌实时查组织角色（60 秒缓存），查到的角色记到账号上；GitHub 调用失败直接抛出，
 * 由 http-policy 统一映射，绝不把失败当成「不是组织成员」。
 * 邮箱、Google 会话没有 GitHub 令牌，不调用 GitHub：成员资格和提督、舰员称号按账号记下的角色给（所有者 2026-10-23
 * 「按站内称号认」），`github.*` 能力一律挡掉（`github_session_required`）。
 */
export function createAccess({ consoleOrg, getOrgRole, cached, roles, membership }: AccessDeps) {
  async function orgRole(login: string, accessToken: string): Promise<OrgRole> {
    return cached(`console:orgrole:${login.toLowerCase()}`, ORG_ROLE_TTL_MS, () => getOrgRole(accessToken, consoleOrg, login));
  }
  async function resolve({ login, userId, accountId, accessToken, provider }: ResolveInput): Promise<Access> {
    const githubSession = provider === "github";
    let role: OrgRole;
    let member: boolean;
    if (githubSession) {
      role = await orgRole(login, accessToken);
      member = role !== null;
      if (accountId) membership.record(accountId, role);
    } else {
      ({ member, orgRole: role } = accountId ? membership.of(accountId) : { member: false, orgRole: null });
    }
    return computeAccess({
      login, orgRole: role, githubSession, member,
      assignments: roles.assignmentsFor(login, userId, accountId),
      departments: roles.listDepartments(),
      titles: roles.titleConfigs(),
    });
  }
  return { consoleOrg, resolve, orgRole };
}
export type AccessService = ReturnType<typeof createAccess>;
