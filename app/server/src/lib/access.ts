import { computeAccess, type Access, type OrgRole } from "./roles.js";
import type { RoleStore } from "./role-store.js";
import type { IdentityProvider } from "./identity-store.js";

export type AccessDeps = {
  roles: RoleStore;
  /** 当前有效的 member/alumni 与 direct owner 摘要（identity-store.membershipOf），不读旧 org_role。 */
  membership: {
    of: (accountId: string) => { member: boolean; orgRole: OrgRole };
  };
};
/**
 * `accountId`：会话的极客班账号（#262），称号先按它认人。`accessToken`、`provider` 留着不删——
 * middleware/require-capability.ts 的 `resolveAccess()` 仍然按这个形状传参（它不是本次改动的范围），
 * 这里不再读它们：#274 去掉 GitHub 组织那道门之后，成员资格和站内角色只认账号自己记的，不再查 GitHub
 * （CONTRACT-274 §8，见下面 resolve() 的改动说明）。
 */
export type ResolveInput = { login: string; userId: number | null; accountId: string | null; accessToken: string; provider: IdentityProvider };

/**
 * 身份解析：只接受普通参数，不接触 Fastify 请求。
 * #274 review round 1（blocker）：原来这里在账号「还没记过站内角色」时，会用会话自带的 GitHub 令牌实时查一次
 * GitHub 组织角色并写回站内角色/新权限引擎（membership.record → identity-store 的 applyOrgRole →
 * syncPermissionLevel），这就让任何 GitHub 组织管理员一旦调用到走这条路径的接口（例如论坛），不填邀请码也能
 * 被悄悄提升为 level.member 甚至站长，绕开了邀请码制度——这正是本轮复核要堵的洞。现在彻底不查 GitHub：
 * 成员资格、站内角色和站长身份只认账号自己在新权限引擎里记的有效直接资格（perm_members），由注册时的邀请码结果
 * （lib/identity-store.ts 的 signInWithGithub/signInSecondChannel）或控制台/命令行的显式操作
 * （setSiteRole、provisionAccount）写入，不会再被一次路由调用悄悄改变。
 */
export function createAccess({ roles, membership }: AccessDeps) {
  async function resolve({ login, userId, accountId }: ResolveInput): Promise<Access> {
    const { member, orgRole: siteRole } = accountId ? membership.of(accountId) : { member: false, orgRole: null };
    return computeAccess({
      login, siteRole, member,
      assignments: roles.assignmentsFor(login, userId, accountId),
      departments: roles.listDepartments(),
      titles: roles.titleConfigs(),
    });
  }
  return { resolve };
}
export type AccessService = ReturnType<typeof createAccess>;
