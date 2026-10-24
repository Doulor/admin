import type { FastifyInstance } from "fastify";
import { DEFAULT_CONSOLE_ORG } from "../../config.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";

/** 控制台意见箱：固定为 DEFAULT_CONSOLE_ORG，SQL 与管理端共用 lib/feedback-store。 */
export default async function consoleFeedbackRoutes(app: FastifyInstance) {
  const { listFeedback, updateFeedback, deleteFeedback } = app.services.feedback;
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { status?: string; limit?: string } }>(
    "/api/console/feedback",
    { preHandler: requirePermission("feedback.view") },
    async (req) => listFeedback(DEFAULT_CONSOLE_ORG, { status: req.query.status, limit: Number(req.query.limit ?? 200) }),
  );

  app.patch<{ Params: { id: string }; Body: { status?: string; reply?: string } }>(
    "/api/console/feedback/:id",
    { preHandler: [requirePermission("feedback.handle"), requireStepUp] },
    async (req, reply) => {
      const { status, reply: replyText } = req.body;
      if (!updateFeedback(DEFAULT_CONSOLE_ORG, Number(req.params.id), { status, reply: replyText }, req.session!.login)) {
        return reply.code(404).send({ error: "not_found", message: "意见不存在" });
      }
      app.services.activity.recordActivity(req, { action: "feedback.update", surface: "console", target_type: "feedback", target_id: req.params.id, outcome: "ok", meta: { status, has_reply: Boolean(replyText) } });
      return { ok: true };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/console/feedback/:id",
    { preHandler: [requirePermission("feedback.handle"), requireStepUp] },
    async (req, reply) => {
      if (!deleteFeedback(DEFAULT_CONSOLE_ORG, Number(req.params.id))) return reply.code(404).send({ error: "not_found", message: "意见不存在" });
      app.services.activity.recordActivity(req, { action: "feedback.delete", surface: "console", target_type: "feedback", target_id: req.params.id, outcome: "ok" });
      return { ok: true };
    },
  );
}
