import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveAccess } from "./require-capability.js";

/**
 * 报名与组队只对极客班成员开放（#239）：会话必须有统一账号，且这个账号是成员。
 *
 * 认人只看会话里的 `account_id`，不按 GitHub 登录名兜底——登录名会改，旧名还可能被别人注册。
 * 成员资格只在这里判一次（`access.member`）：GitHub 会话按本人令牌实时查组织角色（缓存 60 秒）；
 * 邮箱、Google 会话按账号记下的成员资格——GitHub 组织成员，或用邀请码注册的人（#262，所有者 2026-10-23）。
 */
export async function requireMember(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session?.account_id) return reply.code(401).send({ error: "not_signed_in", message: "请先登录" });
  const access = await resolveAccess(req);
  if (!access.member) {
    return reply.code(403).send({ error: "not_member", message: "报名与组队只对极客班成员开放" });
  }
}
