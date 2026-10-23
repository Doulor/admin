import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireGithub } from "../../middleware/require-github.js";

export default async function teamsRoutes(app: FastifyInstance) {
  const { audit } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { org: string } }>("/api/admin/:org/teams", {
    preHandler: requireGithub("github.org.read"),
  }, async (req) => {
    const { org } = req.params;
    const octokit = req.github!;
    const teams = await octokit.paginate("GET /orgs/{org}/teams", { org, per_page: 100 });
    const enriched = await Promise.all(
      teams.map(async (t) => {
        const [members, repos] = await Promise.all([
          octokit.paginate("GET /orgs/{org}/teams/{team_slug}/members", { org, team_slug: t.slug, per_page: 100 }).catch(() => []),
          octokit.paginate("GET /orgs/{org}/teams/{team_slug}/repos", { org, team_slug: t.slug, per_page: 100 }).catch(() => []),
        ]);
        return { ...t, member_count: members.length, repo_count: repos.length };
      })
    );
    return { teams: enriched };
  });

  app.post<{ Params: { org: string }; Body: { name: string; description?: string; privacy?: "secret" | "closed" } }>(
    "/api/admin/:org/teams",
    { preHandler: requireGithub("github.teams.manage") },
    async (req, reply) => {
      const { org } = req.params;
      const { name, description, privacy } = req.body;
      if (!name) return reply.code(400).send({ error: "name 必填" });
      const octokit = req.github!;
      const res = await octokit.request("POST /orgs/{org}/teams", { org, name, description, privacy });
      audit(org, req.session!, "team.create", res.data.slug, { name }, req.ip);
      return { ok: true, team: res.data };
    }
  );

  app.delete<{ Params: { org: string; slug: string } }>(
    "/api/admin/:org/teams/:slug",
    { preHandler: requireGithub("github.teams.manage") },
    async (req) => {
      const { org, slug } = req.params;
      const octokit = req.github!;
      await octokit.request("DELETE /orgs/{org}/teams/{team_slug}", { org, team_slug: slug });
      audit(org, req.session!, "team.delete", slug, undefined, req.ip);
      return { ok: true };
    }
  );
}
