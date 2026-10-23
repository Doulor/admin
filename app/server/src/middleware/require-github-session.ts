import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * 只对「本人的 GitHub」有意义的接口（现在只有 `GET /api/me/orgs`，列本人加入的 GitHub 组织）：邮箱、Google 会话没有 GitHub 令牌，
 * 回 `403 github_session_required`。控制台的 GitHub 组织页面不用它：那些按站内称号放行，经服务器接入的 GitHub 执行（#262 第四期）。
 */
export async function requireGithubSession(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session) return reply.code(401).send({ error: "not_signed_in" });
  if (req.session.provider !== "github") {
    return reply.code(403).send({ error: "github_session_required", message: "这一步需要用 GitHub 登录", request_id: req.id });
  }
}
