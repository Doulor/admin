import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/require-permission.js";
import { PERMISSION_DOMAINS, PERMISSION_NODES, isKnownNode } from "../../lib/permission-nodes.js";

/**
 * 权限节点目录与解释（CONTRACT-274 §5）：节点目录是代码里 permission-nodes.ts 的只读镜像，
 * 给控制台「权限」页渲染节点选择器与展示节点说明；`explain` 直接复用求值引擎自带的
 * `explainFor`（lib/permissions.ts），不重复实现判定逻辑。
 */
export default async function consolePermissionsRoutes(app: FastifyInstance) {
  const { permissions, storage } = app.services;
  const db = storage.db;
  const view = { preHandler: requirePermission("perm.view") };

  app.get("/api/console/permissions/nodes", view, async () => ({
    nodes: PERMISSION_NODES.map(({ node, domain, label, description, meta }) => ({ node, domain, label, description, meta: meta ?? false })),
    domains: PERMISSION_DOMAINS,
  }));

  app.get<{ Querystring: { account: string; node: string } }>("/api/console/permissions/explain", view, async (req, reply) => {
    const { account, node } = req.query;
    if (node.endsWith(".*") || node === "*" || !isKnownNode(node)) {
      return reply.code(400).send({ error: "unknown_node", message: "不是一个已登记的具体权限节点" });
    }
    const exists = db.prepare("SELECT 1 FROM users WHERE id = ? AND status <> 'merged'").get(account);
    if (!exists) return reply.code(404).send({ error: "not_found", message: "没有这个账号" });
    return permissions.explainFor(account, node);
  });
}
