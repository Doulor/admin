import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireGithub } from "../../middleware/require-github.js";

const EDITABLE_KEYS = [
  "name", "description", "company", "email", "location", "blog", "twitter_username",
  "billing_email", "default_repository_permission",
  "members_can_create_repositories", "members_can_create_public_repositories",
  "members_can_create_private_repositories", "members_can_create_internal_repositories",
  "members_can_fork_private_repositories", "members_can_create_pages",
  "members_can_create_public_pages", "members_can_create_private_pages",
  "members_can_invite_outside_collaborators", "members_can_delete_repositories",
  "members_can_change_repo_visibility", "members_can_delete_issues",
] as const;

export default async function orgRoutes(app: FastifyInstance) {
  const { audit } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { org: string } }>("/api/admin/:org/org", {
    preHandler: requireGithub("github.org.read"),
  }, async (req) => {
    const { org } = req.params;
    const octokit = req.github!;
    const res = await octokit.request("GET /orgs/{org}", { org });
    return res.data;
  });

  app.patch<{ Params: { org: string }; Body: Record<string, unknown> }>(
    "/api/admin/:org/org",
    { preHandler: requireGithub("github.org.manage") },
    async (req, reply) => {
      const { org } = req.params;
      const update: Record<string, unknown> = {};
      for (const k of EDITABLE_KEYS) if (k in req.body) update[k] = req.body[k];
      if (Object.keys(update).length === 0) return reply.code(400).send({ error: "no editable fields" });
      const octokit = req.github!;
      const res = await octokit.request("PATCH /orgs/{org}", { org, ...update });
      audit(org, req.session!, "org.update", org, update, req.ip);
      return res.data;
    }
  );
}
