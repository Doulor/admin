import type { FastifyInstance, FastifyReply } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { CANDIDATE_ERRORS, type CandidateError, type CandidateRow, type CandidateStatus } from "../../lib/competition-candidates.js";
import { SCORE_ERRORS } from "../../lib/competition-score-store.js";
import { publicCachePrefix } from "../../lib/competition-public.js";
import type { Core, Importance } from "../../lib/competition-rubric.js";

const MESSAGES: Record<string, { status: number; message: string }> = { ...SCORE_ERRORS, ...CANDIDATE_ERRORS };

/**
 * 控制台「待确认贡献」（#278，CONTRACT-278 §4）：GitLab 收来的候选，审核人「标记有用」（accept，加分）或驳回。
 * 全部要 competition.score.review；写操作再要 step-up，和积分写入在同一个事务里记操作记录。审核人不能审自己的贡献。
 */
export default async function consoleCompetitionCandidateRoutes(app: FastifyInstance) {
  const { competitionCandidates: candidates, competitionPublic, competitions, cache, clock } = app.services;
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);
  const review = requirePermission("competition.score.review");
  const reviewWrite = [requirePermission("competition.score.review"), requireStepUp];

  const refuse = (reply: FastifyReply, error: CandidateError) => {
    const entry = MESSAGES[error] ?? { status: 409, message: "操作没有成功" };
    return reply.code(entry.status).send({ error, message: entry.message });
  };
  const personOf = (accountId: string) => ({ account_id: accountId, ...competitionPublic.personOf(accountId) });
  const view = (row: CandidateRow) => candidates.view(row, personOf);

  app.get<{ Params: { competition_id: string }; Querystring: { status?: CandidateStatus; cursor?: string } }>(
    "/api/console/competitions/:competition_id/candidates",
    { preHandler: review },
    async (req, reply) => {
      if (!competitions.get(req.params.competition_id)) return refuse(reply, "not_found");
      const page = candidates.list(req.params.competition_id, req.query.status ?? null, req.query.cursor ?? null);
      return { items: page.rows.map(view), next_cursor: page.next_cursor, counts: page.counts, last_run: page.last_run };
    },
  );

  app.post<{ Params: { competition_id: string; candidate_id: string }; Body: { importance: Importance; core: Core; reason?: string } }>(
    "/api/console/competitions/:competition_id/candidates/:candidate_id/accept",
    { preHandler: reviewWrite, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { competition_id: id, candidate_id: candidateId } = req.params;
      const result = db.transaction(() => {
        const accepted = candidates.accept(id, candidateId, req.session!.account_id, req.body, clock());
        if (accepted.ok) {
          app.services.activity.recordActivity(req, {
            action: "competition.candidate.accept", surface: "console", target_type: "score_candidate", target_id: candidateId, outcome: "ok",
            meta: {
              competition_id: id, via: "console", points: accepted.value.final_points, importance: accepted.value.importance, core: accepted.value.core,
              score_event_id: accepted.value.score_event_id, kind: accepted.value.kind,
            },
          });
        }
        return accepted;
      })();
      if (!result.ok) return refuse(reply, result.error);
      cache.invalidate(publicCachePrefix(id));
      return { candidate: view(result.value) };
    },
  );

  app.post<{ Params: { competition_id: string; candidate_id: string }; Body: { reason: string } }>(
    "/api/console/competitions/:competition_id/candidates/:candidate_id/reject",
    { preHandler: reviewWrite, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { competition_id: id, candidate_id: candidateId } = req.params;
      const before = candidates.get(id, candidateId);
      const result = db.transaction(() => {
        const rejected = candidates.reject(id, candidateId, req.session!.account_id, req.body.reason, clock());
        if (rejected.ok) {
          app.services.activity.recordActivity(req, {
            action: "competition.candidate.reject", surface: "console", target_type: "score_candidate", target_id: candidateId, outcome: "ok",
            meta: { competition_id: id, revoked_score_event_id: before?.score_event_id ?? null },
          });
        }
        return rejected;
      })();
      if (!result.ok) return refuse(reply, result.error);
      cache.invalidate(publicCachePrefix(id));
      return { candidate: view(result.value) };
    },
  );

  app.post<{ Params: { competition_id: string } }>(
    "/api/console/competitions/:competition_id/candidates/collect",
    { preHandler: reviewWrite, config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = req.params.competition_id;
      const result = await candidates.collect(id);
      if (!result.ok) return refuse(reply, result.error);
      app.services.activity.recordActivity(req, {
        action: "competition.candidate.collect", surface: "console", target_type: "competition", target_id: id, outcome: result.value.error ? "error" : "ok",
        meta: { fetched: result.value.fetched, created: result.value.created, skipped: result.value.skipped, accepted: result.value.accepted, revoked: result.value.revoked, error: result.value.error },
      });
      return { last_run: result.value };
    },
  );
}
