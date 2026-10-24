import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { GRADE_KEYS, GRADE_KEY_LABELS, RULES_ERRORS, prizeForRank, type RulesInput } from "../../lib/competition-rules-store.js";
import { PRIZE_ERRORS, type PrizeError, type PrizeRow } from "../../lib/competition-prizes.js";
import { publicCachePrefix } from "../../lib/competition-public.js";

/** 兑奖码查找失败的上限：每个操作人每小时 20 次，防止拿控制台当猜码器（码本身有 80 位，主要是留痕）。 */
export const PRIZE_LOOKUP_FAIL_LIMIT = { bucket: "competition.prize.lookup.fail", max: 20, windowMs: 60 * 60_000 } as const;

/**
 * 控制台的计分规则、定榜与兑奖（#278，所有者 2026-10-24 13:45）：
 * - 规则（年级系数、奖项、GitLab 项目）：看要 competition.manage 或 competition.score.review，改要 competition.manage 加 step-up；
 * - 定榜、撤销定榜：competition.manage 加 step-up，比赛结束后才能定；
 * - 兑奖码查找与核销：competition.prize.redeem，核销再要 step-up。真实姓名只给同时有 users.manage 的人看（#280 的规则）。
 * 所有写操作记操作记录，记录里只有兑奖码末四位，不写全码。
 */
export default async function consoleCompetitionResultRoutes(app: FastifyInstance) {
  const { competitions, competitionRules: rules, competitionPrizes: prizes, competitionScores: scores, competitionPublic, permissions, limits, cache, clock } = app.services;
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);
  const manageWrite = [requirePermission("competition.manage"), requireStepUp];
  const redeemRead = requirePermission("competition.prize.redeem");
  const redeemWrite = [requirePermission("competition.prize.redeem"), requireStepUp];
  const selectRealName = db.prepare("SELECT real_name FROM account_profiles WHERE account_id = ?");

  async function canViewRules(req: FastifyRequest, reply: FastifyReply) {
    const accountId = req.session!.account_id;
    if (!permissions.check(accountId, "competition.manage") && !permissions.check(accountId, "competition.score.review")) {
      return reply.code(403).send({ error: "forbidden", node: "competition.manage", message: "需要「competition.manage」或「competition.score.review」权限" });
    }
  }
  const missing = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "比赛不存在" });
  const refusePrize = (reply: FastifyReply, error: PrizeError, extra: Record<string, unknown> = {}) =>
    reply.code(PRIZE_ERRORS[error].status).send({ error, message: PRIZE_ERRORS[error].message, ...extra });
  const personOf = (accountId: string) => ({ account_id: accountId, ...competitionPublic.personOf(accountId) });

  function rulesView(competitionId: string) {
    const value = rules.get(competitionId);
    return {
      grade_factors: value.grade_factors,
      grades: GRADE_KEYS.map(key => ({ grade: key, label: GRADE_KEY_LABELS[key] })),
      prizes: value.prizes,
      gitlab_projects: value.gitlab_projects,
      updated_at: value.updated_at,
      updated_by: value.updated_by ? personOf(value.updated_by) : null,
      finalized: scores.isFinalized(competitionId),
    };
  }

  function prizeView(row: PrizeRow) {
    return {
      id: row.id, competition_id: row.competition_id, rank: row.rank, points: row.points, amount_cny: row.amount_cny, title: row.title,
      account: personOf(row.account_id), code_hint: row.code_hint, created_at: row.created_at,
      redeemed_at: row.redeemed_at, redeemed_by: row.redeemed_by ? personOf(row.redeemed_by) : null,
    };
  }

  /** 定榜页：定了给快照与奖项；没定给现在的严格名次和按奖项表会发给谁（只是预览，不发码）。 */
  function finalView(competitionId: string) {
    const summary = prizes.summary(competitionId);
    if (summary) {
      return {
        finalized_at: summary.final.finalized_at,
        finalized_by: personOf(summary.final.finalized_by),
        standings: summary.standings.slice(0, 50).map(item => ({ rank: item.rank, points: item.points, account: personOf(item.account_id) })),
        prizes: summary.prizes.map(prizeView),
        preview: [],
      };
    }
    const tiers = rules.get(competitionId).prizes;
    return {
      finalized_at: null, finalized_by: null, standings: [], prizes: [],
      preview: scores.standings(competitionId).slice(0, 50).map(item => {
        const tier = item.points > 0 ? prizeForRank(tiers, item.rank) : null;
        return { rank: item.rank, points: item.points, account: personOf(item.account_id), amount_cny: tier?.amount_cny ?? null, title: tier?.title ?? null };
      }),
    };
  }

  app.get<{ Params: { competition_id: string } }>("/api/console/competitions/:competition_id/rules", { preHandler: canViewRules }, async (req, reply) => {
    if (!competitions.get(req.params.competition_id)) return missing(reply);
    return rulesView(req.params.competition_id);
  });

  app.put<{ Params: { competition_id: string }; Body: RulesInput }>(
    "/api/console/competitions/:competition_id/rules",
    { preHandler: manageWrite, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = req.params.competition_id;
      if (!competitions.get(id)) return missing(reply);
      if (scores.isFinalized(id)) return reply.code(409).send({ error: "competition_finalized", message: "这场比赛已经定榜，规则不能再改" });
      const before = rules.get(id);
      const result = db.transaction(() => {
        const saved = rules.update(id, req.body, req.session!.account_id, clock());
        if (saved.ok) {
          app.services.activity.recordActivity(req, {
            action: "competition.rules.update", surface: "console", target_type: "competition", target_id: id, outcome: "ok",
            meta: {
              before: { grade_factors: before.grade_factors, prizes: before.prizes, gitlab_projects: before.gitlab_projects },
              after: { grade_factors: saved.value.grade_factors, prizes: saved.value.prizes, gitlab_projects: saved.value.gitlab_projects },
            },
          });
        }
        return saved;
      })();
      if (!result.ok) return reply.code(RULES_ERRORS[result.error].status).send({ error: result.error, message: RULES_ERRORS[result.error].message });
      cache.invalidate(publicCachePrefix(id));
      return rulesView(id);
    },
  );

  app.get<{ Params: { competition_id: string } }>("/api/console/competitions/:competition_id/final", { preHandler: requirePermission("competition.manage") }, async (req, reply) => {
    if (!competitions.get(req.params.competition_id)) return missing(reply);
    return finalView(req.params.competition_id);
  });

  app.post<{ Params: { competition_id: string } }>(
    "/api/console/competitions/:competition_id/final",
    { preHandler: manageWrite, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = req.params.competition_id;
      const result = db.transaction(() => {
        const done = prizes.finalize(id, req.session!.account_id, clock());
        if (done.ok) {
          app.services.activity.recordActivity(req, {
            action: "competition.finalize", surface: "console", target_type: "competition", target_id: id, outcome: "ok",
            meta: {
              standings: JSON.parse(done.value.final.standings).length,
              prizes: done.value.prizes.map(row => ({ rank: row.rank, account_id: row.account_id, amount_cny: row.amount_cny, code_hint: row.code_hint })),
            },
          });
        }
        return done;
      })();
      if (!result.ok) return refusePrize(reply, result.error);
      cache.invalidate(publicCachePrefix(id));
      return reply.code(201).send(finalView(id));
    },
  );

  app.delete<{ Params: { competition_id: string } }>(
    "/api/console/competitions/:competition_id/final",
    { preHandler: manageWrite, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = req.params.competition_id;
      const result = db.transaction(() => {
        const undone = prizes.unfinalize(id);
        if (undone.ok) {
          app.services.activity.recordActivity(req, {
            action: "competition.unfinalize", surface: "console", target_type: "competition", target_id: id, outcome: "ok", meta: { prizes_removed: undone.value.prizes_removed },
          });
        }
        return undone;
      })();
      if (!result.ok) return refusePrize(reply, result.error);
      cache.invalidate(publicCachePrefix(id));
      return finalView(id);
    },
  );

  /** 核销页上的一张奖：谁、第几名、多少钱、哪场比赛；有 users.manage 的操作人多看到真实姓名。 */
  function redeemView(req: FastifyRequest, row: PrizeRow) {
    const showRealName = permissions.check(req.session!.account_id, "users.manage");
    const realName = showRealName ? (selectRealName.get(row.account_id) as { real_name: string | null } | undefined)?.real_name ?? null : null;
    return {
      ...prizeView(row),
      competition_name: competitions.get(row.competition_id)?.name ?? row.competition_id,
      real_name: realName,
    };
  }

  /** 查找失败才计数；超过上限先回 429，不再去查。 */
  function lookupBlocked(req: FastifyRequest, reply: FastifyReply): boolean {
    const subject = req.session!.account_id;
    const used = limits.count({ bucket: PRIZE_LOOKUP_FAIL_LIMIT.bucket, subject, window: { ms: PRIZE_LOOKUP_FAIL_LIMIT.windowMs } });
    if (used < PRIZE_LOOKUP_FAIL_LIMIT.max) return false;
    const retry = Math.ceil(PRIZE_LOOKUP_FAIL_LIMIT.windowMs / 1000);
    void reply.code(429).header("Retry-After", String(retry)).send({
      error: "rate_limited", bucket: PRIZE_LOOKUP_FAIL_LIMIT.bucket, message: "输错的兑奖码太多了，一小时后再试", retry_after: retry,
    });
    return true;
  }
  const noteFailure = (req: FastifyRequest) => limits.hit({
    bucket: PRIZE_LOOKUP_FAIL_LIMIT.bucket, subject: req.session!.account_id, window: { ms: PRIZE_LOOKUP_FAIL_LIMIT.windowMs }, max: Number.MAX_SAFE_INTEGER,
  });
  const hintOf = (code: string) => code.replace(/[\s-]+/g, "").slice(-4).toUpperCase();

  app.post<{ Body: { code: string } }>("/api/console/prizes/lookup", { preHandler: redeemRead, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (lookupBlocked(req, reply)) return reply;
    const row = prizes.lookup(req.body.code);
    if (!row) {
      noteFailure(req);
      app.services.activity.recordActivity(req, { action: "competition.prize.lookup", surface: "console", outcome: "denied", meta: { code_hint: hintOf(req.body.code), found: false } });
      return refusePrize(reply, "code_not_found");
    }
    return { prize: redeemView(req, row) };
  });

  app.post<{ Body: { code: string } }>("/api/console/prizes/redeem", { preHandler: redeemWrite, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (lookupBlocked(req, reply)) return reply;
    const result = db.transaction(() => {
      const redeemed = prizes.redeem(req.body.code, req.session!.account_id, clock());
      app.services.activity.recordActivity(req, {
        action: "competition.prize.redeem", surface: "console", target_type: "competition_prize", target_id: redeemed.ok ? redeemed.value.id : redeemed.prize?.id ?? null,
        outcome: redeemed.ok ? "ok" : "denied",
        meta: { code_hint: hintOf(req.body.code), result: redeemed.ok ? "redeemed" : redeemed.error, amount_cny: redeemed.ok ? redeemed.value.amount_cny : undefined },
      });
      return redeemed;
    })();
    if (!result.ok) {
      if (result.error === "code_not_found") {
        noteFailure(req);
        return refusePrize(reply, "code_not_found");
      }
      return refusePrize(reply, result.error, result.prize ? { prize: redeemView(req, result.prize) } : {});
    }
    return { prize: redeemView(req, result.value) };
  });
}
