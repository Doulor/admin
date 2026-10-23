import type { FastifyReply, FastifyRequest } from "fastify";
import type { Scope } from "../lib/permissions.js";
import { loadSession } from "./require-auth.js";

/**
 * 新权限中间件（#274）：按权限节点判定，取代按 Capability 判定的 require-capability.ts。
 * 两套中间件现在并存——路由逐个切换到这一套，见 Phase 2b 的进度（notes/ 的执行记录）。
 * `node` 必须是具体节点（不能是通配符）；`scope` 支持函数形式，按请求参数算，例如本部门范围。
 * 自己调 `loadSession`（不依赖前面另外挂一个 requireAuth）：路由如果还要按账号限流（`config.rateLimit`
 * 的 `keyGenerator` 读 `req.session`），必须把那条限流规则的 `hook` 设成 `"preHandler"`——
 * `@fastify/rate-limit` 默认挂在 `onRequest`，比这里还早，那时候 `req.session`还没被任何人填上。
 */
export function requirePermission(node: string, scope?: Scope | ((req: FastifyRequest) => Scope)) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!loadSession(req)) return reply.code(401).send({ error: "unauthenticated", message: "请先登录" });
    const resolvedScope = typeof scope === "function" ? scope(req) : scope;
    if (!req.server.services.permissions.check(req.session!.account_id, node, resolvedScope)) {
      return reply.code(403).send({ error: "forbidden", node, message: `需要「${node}」权限` });
    }
  };
}
