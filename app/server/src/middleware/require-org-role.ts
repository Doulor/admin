import type { FastifyReply, FastifyRequest } from "fastify";
import { requireGithubSession } from "./require-github-session.js";

/** `/api/admin/:org/*` 的守卫：用本人 GitHub 令牌查组织角色；邮箱、Google 会话在调用 GitHub 之前回 github_session_required。 */
export function requireOrgRole(minRole: "admin" | "member") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const { config, github: { getOrgRole } } = req.server.services;
    if (!req.session) return reply.code(401).send({ error: "not_signed_in" });
    if (req.session.provider !== "github") return requireGithubSession(req, reply);
    const org = (req.params as { org?: string }).org;
    if (!org) return reply.code(400).send({ error: "missing org" });
    if (config.allowedOrgs.length > 0 && !config.allowedOrgs.includes(org.toLowerCase())) {
      return reply.code(403).send({
        error: "org_not_whitelisted",
        message: `本部署 ALLOWED_ORGS 仅含 ${config.allowedOrgs.join(", ")}`,
        org,
      });
    }
    const role = await getOrgRole(req.session.accessToken, org, req.session.login);
    req.orgRole = role;
    if (role === null) return reply.code(403).send({ error: "not_a_member_of_org", org });
    if (minRole === "admin" && role !== "admin") {
      return reply.code(403).send({ error: "requires_org_admin", org, your_role: role });
    }
  };
}
