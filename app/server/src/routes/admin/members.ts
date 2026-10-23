import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireGithub } from "../../middleware/require-github.js";

export default async function membersRoutes(app: FastifyInstance) {
  const { audit } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { org: string } }>("/api/admin/:org/members", {
    preHandler: requireGithub("github.org.read"),
  }, async (req) => {
    const { org } = req.params;
    const octokit = req.github!;
    const members = await octokit.paginate("GET /orgs/{org}/members", { org, per_page: 100 });
    const enriched = await Promise.all(
      members.map(async (m) => {
        try {
          const ms = await octokit.request("GET /orgs/{org}/memberships/{username}", { org, username: m.login });
          return { login: m.login, id: m.id, avatar_url: m.avatar_url, html_url: m.html_url, role: ms.data.role, state: ms.data.state };
        } catch {
          return { login: m.login, id: m.id, avatar_url: m.avatar_url, html_url: m.html_url, role: "?", state: "?" };
        }
      })
    );
    return { members: enriched };
  });

  app.delete<{ Params: { org: string; login: string } }>("/api/admin/:org/members/:login", {
    preHandler: requireGithub("github.members.manage"),
  }, async (req, reply) => {
    const { org, login } = req.params;
    if (login === req.session!.login) return reply.code(400).send({ error: "不能移除自己" });
    const octokit = req.github!;
    await octokit.request("DELETE /orgs/{org}/memberships/{username}", { org, username: login });
    audit(org, req.session!, "member.remove", login, undefined, req.ip);
    return { ok: true };
  });

  app.patch<{ Params: { org: string; login: string }; Body: { role: "admin" | "member" } }>(
    "/api/admin/:org/members/:login/role",
    { preHandler: requireGithub("github.members.manage") },
    async (req, reply) => {
      const { org, login } = req.params;
      const { role } = req.body;
      if (role !== "admin" && role !== "member") return reply.code(400).send({ error: "role 必须是 admin 或 member" });
      const octokit = req.github!;
      await octokit.request("PUT /orgs/{org}/memberships/{username}", { org, username: login, role });
      audit(org, req.session!, "member.role", login, { role }, req.ip);
      return { ok: true };
    }
  );
}
