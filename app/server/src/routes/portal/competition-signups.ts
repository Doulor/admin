import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCompetitionAccess, requireCompetitionNode } from "../../middleware/require-member.js";
import { SCORE_ERRORS, type ScoreErrorCode } from "../../lib/competition-score-store.js";
import { SIGNUP_ERRORS, type SignupErrorCode, type SignupFailure } from "../../lib/competition-signup-store.js";

/** 报名与组队两种错误码合成一张表：路由只负责把存储层的结果翻成 HTTP。 */
const ERRORS: Record<SignupErrorCode | ScoreErrorCode, { status: number; message: string }> = { ...SIGNUP_ERRORS, ...SCORE_ERRORS };

function refuse(reply: FastifyReply, error: SignupErrorCode | ScoreErrorCode) {
  return reply.code(ERRORS[error].status).send({ error, message: ERRORS[error].message });
}

/**
 * 成员写操作的结果：成功回最新「我的状态」并记一条 `competition.<action>` 操作记录（SPEC §3.7「必须记
 * competition.*」），失败回稳定的错误码与中文说明（store 层的业务拒绝不是 403/429，http-policy.ts 的
 * 全局钩子不管，这里不用另记——SPEC 只要求 403 denied / 429 limited 两种，这些不在其列）。
 */
function settle(req: FastifyRequest, reply: FastifyReply, action: string, competitionId: string, result: { ok: true; value: unknown } | SignupFailure, status = 200) {
  if (!result.ok) return refuse(reply, result.error);
  req.server.services.activity.recordActivity(req, { action: `competition.${action}`, surface: "portal", target_type: "competition", target_id: competitionId, outcome: "ok" });
  return reply.code(status).send(result.value);
}

/**
 * 比赛报名与组队（#239）：全部要求统一登录，按会话里的 `account_id` 认人。
 * #274 SPEC §3.2：不再查 GitHub 组织资格，按权限节点判定——报名用 `competition.signup`，组队用
 * `competition.team`（极客班成员天然持有两者，注册用户都没有），只读接口持有任一权限都能看。
 * 规则在 lib/competition-signup-store.ts；路由只做鉴权、限流和错误码映射。写操作每人每分钟 30 次。
 */
export default async function competitionSignupRoutes(app: FastifyInstance) {
  const { competitionSignups: signups, competitionScores: scores } = app.services;
  const read = { preHandler: [requireAuth, requireCompetitionAccess] };
  const signup = { preHandler: [requireAuth, requireCompetitionNode("competition.signup")], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };
  const team = { preHandler: [requireAuth, requireCompetitionNode("competition.team")], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

  app.get("/api/me/competitions", read, async req => signups.myCompetitions(req.session!.account_id, Date.now()));

  app.get<{ Params: { id: string } }>("/api/competitions/:id/my-status", read, async (req, reply) => {
    const result = signups.myStatus(req.params.id, req.session!.account_id, Date.now());
    return result.ok ? result.value : refuse(reply, result.error);
  });

  app.post<{ Params: { id: string }; Body: { note?: string; looking_for_team?: boolean } }>(
    "/api/competitions/:id/signup", signup,
    async (req, reply) => settle(req, reply, "signup", req.params.id, signups.signUp(req.params.id, req.session!.account_id, req.body ?? {}, Date.now())),
  );

  app.delete<{ Params: { id: string } }>("/api/competitions/:id/signup", signup, async (req, reply) =>
    settle(req, reply, "signup.cancel", req.params.id, signups.cancelSignUp(req.params.id, req.session!.account_id, Date.now())));

  app.get<{ Params: { id: string } }>("/api/competitions/:id/teams", read, async (req, reply) => {
    const result = signups.teams(req.params.id);
    return result.ok ? { teams: result.value } : refuse(reply, result.error);
  });

  app.get<{ Params: { id: string } }>("/api/competitions/:id/free-agents", read, async (req, reply) => {
    const result = signups.freeAgents(req.params.id);
    return result.ok ? { people: result.value } : refuse(reply, result.error);
  });

  app.post<{ Params: { id: string }; Body: { name: string; slogan?: string } }>(
    "/api/competitions/:id/teams", team,
    async (req, reply) => settle(req, reply, "team.create", req.params.id, signups.createTeam(req.params.id, req.session!.account_id, req.body, Date.now()), 201),
  );

  app.post<{ Params: { id: string }; Body: { message?: string } }>(
    "/api/teams/:id/apply", team,
    async (req, reply) => settle(req, reply, "team.apply", req.params.id, signups.apply(req.params.id, req.session!.account_id, req.body.message ?? "", Date.now()), 201),
  );

  app.post<{ Params: { id: string }; Body: { account_id: string } }>(
    "/api/teams/:id/invite", team,
    async (req, reply) => settle(req, reply, "team.invite", req.params.id, signups.invite(req.params.id, req.session!.account_id, req.body.account_id, Date.now()), 201),
  );

  app.post<{ Params: { id: string }; Body: { membership_id: string; action: "accept" | "decline" | "withdraw" } }>(
    "/api/teams/:id/respond", team,
    async (req, reply) => settle(req, reply, `team.${req.body.action}`, req.params.id, signups.respond(
      req.params.id, req.session!.account_id, req.body.membership_id, req.body.action, Date.now(),
    )),
  );

  app.post<{ Params: { id: string } }>("/api/teams/:id/leave", team, async (req, reply) =>
    settle(req, reply, "team.leave", req.params.id, signups.leave(req.params.id, req.session!.account_id, Date.now())));

  app.post<{ Params: { id: string }; Body: { account_id: string } }>(
    "/api/teams/:id/transfer", team,
    async (req, reply) => settle(req, reply, "team.transfer", req.params.id, signups.transfer(req.params.id, req.session!.account_id, req.body.account_id, Date.now())),
  );

  app.delete<{ Params: { id: string } }>("/api/teams/:id", team, async (req, reply) =>
    settle(req, reply, "team.disband", req.params.id, signups.disband(req.params.id, req.session!.account_id, Date.now())));

  app.post<{ Params: { id: string } }>("/api/teams/:id/lock", team, async (req, reply) =>
    settle(req, reply, "team.lock", req.params.id, signups.lock(req.params.id, req.session!.account_id, Date.now())));

  app.delete<{ Params: { id: string } }>("/api/teams/:id/lock", team, async (req, reply) =>
    settle(req, reply, "team.unlock", req.params.id, signups.unlock(req.params.id, req.session!.account_id, Date.now())));

  app.get<{ Params: { id: string } }>("/api/competitions/:id/leaderboard", read, async (req, reply) => {
    const result = scores.leaderboard(req.params.id);
    return result.ok ? result.value : refuse(reply, result.error);
  });
}
