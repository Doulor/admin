import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/require-permission.js";

/**
 * 一个账号的有效权限（CONTRACT-274 §5）：复用求值引擎的 `effective()`，直接给出展开通配后的
 * allow/deny 节点列表、所在组（含继承链）与 meta 取值，给控制台「用户详情」的「有效权限」页签用。
 */
export default async function consoleAccountsRoutes(app: FastifyInstance) {
  const { permissions, storage } = app.services;
  const db = storage.db;

  app.get<{ Params: { id: string } }>(
    "/api/console/accounts/:id/effective",
    { preHandler: requirePermission("perm.view") },
    async (req, reply) => {
      const exists = db.prepare("SELECT 1 FROM users WHERE id = ? AND status <> 'merged'").get(req.params.id);
      if (!exists) return reply.code(404).send({ error: "not_found", message: "没有这个账号" });
      return permissions.effective(req.params.id);
    },
  );
}
