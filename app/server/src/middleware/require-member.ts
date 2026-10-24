import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * 报名与组队（#239）：#274 SPEC §3.2 把 GitHub 组织那道门去掉之后，这里改成按权限节点判定，
 * 不再查 `access.member`（GitHub 组织资格）——注册用户（没用邀请码的）报名与组队都不开放，
 * 极客班成员（`level.member`，天然持有 `competition.signup`/`competition.team`，见
 * `lib/migrations/2026-10-yugc-v2.ts` 的种子）才能写；控制台另给部门部长等开了 `competition.manage`，
 * 不在这里处理。
 *
 * 认人只看会话里的 `account_id`，不按 GitHub 登录名兜底——登录名会改，旧名还可能被别人注册。
 */
function refuseNotMember(reply: FastifyReply) {
  return reply.code(403).send({ error: "not_member", message: "报名与组队只对极客班成员开放" });
}

/** 报名用 `competition.signup`，组队用 `competition.team`；写操作按动作本身要的节点分别判定。 */
export function requireCompetitionNode(node: "competition.signup" | "competition.team") {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session?.account_id) return reply.code(401).send({ error: "not_signed_in", message: "请先登录" });
    if (!req.server.services.permissions.check(req.session.account_id, node)) return refuseNotMember(reply);
  };
}

/** 只读接口（我的状态、队伍、空闲人员、积分榜）：持有报名或组队任一权限都能看，不细分到具体是哪一种。 */
export async function requireCompetitionAccess(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session?.account_id) return reply.code(401).send({ error: "not_signed_in", message: "请先登录" });
  const { permissions } = req.server.services;
  const accountId = req.session.account_id;
  if (!permissions.check(accountId, "competition.signup") && !permissions.check(accountId, "competition.team")) return refuseNotMember(reply);
}
