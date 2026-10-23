import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability } from "../../middleware/require-capability.js";
import { requireManagedOrg } from "../../middleware/require-github.js";

export default async function logsRoutes(app: FastifyInstance) {
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  /**
   * 旧审计接口：原样下发邀请链接 token 和 IP，所以除了 audit.read 还要 github.invites.manage——只给本来就能列出邀请链接的人。
   * 只有 audit.read 的人用 `/api/console/audit`，那里 token 只给前几位。
   */
  app.get<{ Params: { org: string }; Querystring: { limit?: string; offset?: string } }>(
    "/api/admin/:org/logs",
    { preHandler: [requireManagedOrg("audit.read"), requireCapability("github.invites.manage")] },
    async (req) => {
      const { org } = req.params;
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const offset = Number(req.query.offset ?? 0);
      const rows = db.prepare(
        "SELECT id, actor, action, target, details, ip, created_at FROM audit_logs WHERE org = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).all(org, limit, offset);
      return { logs: rows.map((r: any) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })) };
    }
  );
}
