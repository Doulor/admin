import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability } from "../../middleware/require-capability.js";
import type { AccountSummary, SiteRoleChoice } from "../../lib/identity-store.js";
import type { OrgMember } from "../../lib/github.js";
import { computeAccess, titleRank, type AssignmentRow, type OrgRole, type TitleView } from "../../lib/roles.js";

type Person = {
  account_id: string | null; login: string; user_id: number | null; avatar_url: string | null;
  /** 站内角色与成员资格（没有账号的人为 null / false）；`role_unrecorded`：回填的老账号还没记过站内角色，按成员算 */
  site_role: OrgRole; role_unrecorded: boolean; member: boolean; status: AccountSummary["status"] | null;
  providers: AccountSummary["providers"]; last_login_at: number | null;
  /** GitHub 组织里的角色：接上 GitHub 并列出了组织成员时才有；null 是不在组织里，undefined（不下发）是没查 */
  github_role?: OrgRole;
  titles: TitleView[];
};

/** 与 role-store 的 assignmentsFor 同一个匹配规则：先按账号，没有账号的指派按 GitHub 数字 id，再没有才按登录名。 */
const belongsTo = (row: AssignmentRow, accountId: string | null, login: string, userId: number | null) =>
  row.account_id ? row.account_id === accountId
    : row.github_user_id !== null ? row.github_user_id === userId
      : row.github_login === login.toLowerCase();

/**
 * 成员与权限（#262 第四期，权限只认极客班账号）：名单以极客班账号为准，每个账号带站内角色、登录方式和称号；
 * 接上了 GitHub（服务器的 GitHub App，或你这次用 GitHub 登录）时再并上 GitHub 组织里还没登录过本站的人（称号按他们
 * 第一次用 GitHub 登录时会记下的站内角色算），最后加上有称号但两边都没有的人（例如还没登录过的被任命者）。
 * 每个人的称号按 computeAccess 算，和本人登录后看到的一致。
 * GitHub 列不出来时名单照常给，`github_listed` 为 false。
 */
export default async function consolePeopleRoutes(app: FastifyInstance) {
  const { roles, config, github, githubConnection, identity } = app.services;
  app.addHook("preHandler", requireAuth);

  app.get("/api/console/people", { preHandler: requireCapability("roles.manage", "roles.department.manage") }, async (req) => {
    const via = githubConnection.via(req.session);
    let members: OrgMember[] | null = null;
    if (via !== "none") {
      members = await githubConnection.clientFor(req.session)
        .then(client => github.listOrgMembers(client, config.consoleOrg))
        .catch((cause: { code?: string; status?: number }) => {
          req.log.warn({ code: cause?.code, status: cause?.status, requestId: req.id }, "people: github members unavailable");
          return null;
        });
    }
    const departments = roles.listDepartments();
    const titles = roles.titleConfigs();
    const assignments = roles.listAssignments();
    const claimed = new Set<number>();
    const titlesOf = (accountId: string | null, login: string, userId: number | null, siteRole: OrgRole, member: boolean) => {
      const rows = assignments.filter(row => belongsTo(row, accountId, login, userId));
      for (const row of rows) claimed.add(row.id);
      return computeAccess({ login, siteRole, member, assignments: rows, departments, titles }).titles;
    };
    const githubRoleOf = new Map((members ?? []).map(member => [member.id, member.role] as const));

    const people: Person[] = identity.listAccounts().map(account => ({
      account_id: account.account_id, login: account.login, user_id: account.github_user_id, avatar_url: account.avatar_url,
      site_role: account.site_role, role_unrecorded: account.role_unrecorded, member: account.member, status: account.status,
      providers: account.providers, last_login_at: account.last_login_at,
      ...(members ? { github_role: account.github_user_id !== null ? githubRoleOf.get(account.github_user_id) ?? null : null } : {}),
      titles: titlesOf(account.account_id, account.login, account.github_user_id, account.site_role, account.member),
    }));
    const known = new Set(people.flatMap(person => person.user_id === null ? [] : [person.user_id]));
    for (const member of members ?? []) {
      if (known.has(member.id)) continue;
      people.push({
        account_id: null, login: member.login, user_id: member.id, avatar_url: member.avatar_url || null,
        site_role: null, role_unrecorded: false, member: false, status: null, providers: [], last_login_at: null, github_role: member.role,
        titles: titlesOf(null, member.login, member.id, member.role, true),
      });
    }
    for (const row of assignments) {
      if (claimed.has(row.id)) continue;
      people.push({
        account_id: null, login: row.github_login, user_id: row.github_user_id, avatar_url: null,
        site_role: null, role_unrecorded: false, member: false, status: null, providers: [], last_login_at: null,
        ...(members ? { github_role: null } : {}),
        titles: titlesOf(null, row.github_login, row.github_user_id, null, false),
      });
    }
    people.sort((a, b) => titleRank(a.titles[0]) - titleRank(b.titles[0]) || a.login.localeCompare(b.login));
    return { people, github: via, github_listed: members !== null };
  });

  /**
   * 改一个账号的站内角色：管理员（提督）、成员（舰员），或不是成员（移出极客班，不能再登录）。只有提督能改，
   * 最后一位管理员不能改掉（lib/identity-store.ts 的 setSiteRole）。
   */
  app.patch<{ Params: { account_id: string }; Body: { site_role: SiteRoleChoice } }>(
    "/api/console/people/:account_id/site-role",
    { preHandler: requireCapability("roles.manage"), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const admiral = roles.titleConfigs().admin.label;
      if (req.access!.siteRole !== "admin") return reply.code(403).send({ error: "admiral_required", message: `只有${admiral}能改站内角色` });
      const result = identity.setSiteRole({
        accountId: req.params.account_id, role: req.body.site_role,
        actor: { login: req.session!.login, account_id: req.session!.account_id }, ip: req.ip,
      });
      if (!result.ok) {
        return result.reason === "not_found"
          ? reply.code(404).send({ error: "not_found", message: "找不到这个账号" })
          : reply.code(409).send({ error: "last_admin", message: `至少要留一位${admiral}` });
      }
      return { account_id: req.params.account_id, site_role: req.body.site_role, changed: result.changed };
    },
  );
}
