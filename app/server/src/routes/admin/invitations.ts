import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireGithub } from "../../middleware/require-github.js";

export default async function invitationsRoutes(app: FastifyInstance) {
  const { audit, db } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  app.get<{ Params: { org: string } }>("/api/admin/:org/invitations", {
    preHandler: requireGithub("github.invites.manage"),
  }, async (req) => {
    const { org } = req.params;
    const octokit = req.github!;
    const pending = await octokit.paginate("GET /orgs/{org}/invitations", { org, per_page: 100 });
    const history = db.prepare(
      "SELECT id, invite_link_token, github_login, email, note, source_ip, github_invitation_id, status, error_message, created_at FROM invitations WHERE org = ? ORDER BY created_at DESC LIMIT 200"
    ).all(org);
    return { pending, history };
  });

  app.delete<{ Params: { org: string; id: string } }>("/api/admin/:org/invitations/:id", {
    preHandler: requireGithub("github.invites.manage"),
  }, async (req, reply) => {
    const { org, id } = req.params;
    const n = Number(id);
    if (!Number.isFinite(n)) return reply.code(400).send({ error: "invalid id" });
    const octokit = req.github!;
    await octokit.request("DELETE /orgs/{org}/invitations/{invitation_id}", { org, invitation_id: n });
    audit(org, req.session!, "invitation.cancel", String(n), undefined, req.ip);
    return { ok: true };
  });
}
