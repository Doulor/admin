import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * 要本人 GitHub 令牌的接口（#262，docs/plan/UNIFIED-LOGIN.md「要本人 GitHub 令牌的接口」）：邮箱、Google 会话没有 GitHub 令牌，
 * 在调用 GitHub 之前回 `403 github_session_required`，前端提示「这一页需要用 GitHub 登录」，不当成退出。
 * 挂在 requireAuth 之后；`requireOrgRole` 自己也先查这一条。
 */
export async function requireGithubSession(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session) return reply.code(401).send({ error: "not_signed_in" });
  if (req.session.provider !== "github") {
    return reply.code(403).send({ error: "github_session_required", message: "这一步需要用 GitHub 登录", request_id: req.id });
  }
}
