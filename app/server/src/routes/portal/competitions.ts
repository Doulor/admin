import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { DEFAULT_SIGNUP_SETTINGS } from "../../lib/competition-signup-store.js";
import { FEED_PAGE_SIZE, PUBLIC_CACHE_TTL_MS, publicCacheKey } from "../../lib/competition-public.js";
import { ipHash } from "../../lib/forum-rules.js";

/** 公开比赛接口按 IP 每分钟 120 次（CONTRACT-278 §2）；官网 15 秒刷一次快照，一个出口 IP 后面能有二三十人同时看。 */
export const PUBLIC_COMPETITION_LIMIT = { bucket: "public.competition.per_minute", max: 120, windowMs: 60_000 } as const;

/**
 * 公开的比赛接口：官网桌面「比赛」应用与比赛官网 SDK 读它。不含任何成员的账号、邮箱、真实姓名，也不含内部字段（`offline`/创建时间）。
 * 列表每场带报名摘要（是否开放、个人或团队、积分），不含报名人数；只返回未下线的比赛。
 * 单场、天梯、动态、统计与快照（#278）给比赛官网用：官网跑在 sandbox CSP 下，来源是 null，所以成功和失败的响应
 * 都带 `Access-Control-Allow-Origin: *`，不带凭据；按 IP 限流，服务端缓存 10 秒，加分、改规则、发布官网、定榜时主动清掉。
 */
export default async function portalCompetitionRoutes(app: FastifyInstance) {
  const { competitions, competitionSignups, competitionPublic, cache, limits } = app.services;

  app.get("/api/public/competitions", async () => {
    const now = Date.now();
    const summaries = competitionSignups.signupSummaries();
    return {
      competitions: competitions.listPublic(now).map(record => ({
        ...competitionPublic.competition(record, now),
        signup: summaries.get(record.id) ?? DEFAULT_SIGNUP_SETTINGS,
      })),
    };
  });

  /** 跨域头先挂上（失败和 429 也要能被官网读到），再按 IP 计数；超额时已经回了 429，调用方直接返回。 */
  function openAndLimit(req: FastifyRequest, reply: FastifyReply): boolean {
    reply.header("Access-Control-Allow-Origin", "*");
    const result = limits.hit({ bucket: PUBLIC_COMPETITION_LIMIT.bucket, subject: ipHash(req.ip), window: { ms: PUBLIC_COMPETITION_LIMIT.windowMs }, max: PUBLIC_COMPETITION_LIMIT.max });
    if (result.ok) return false;
    void reply.code(429).header("Retry-After", String(result.retry_after)).send({
      error: "rate_limited", bucket: PUBLIC_COMPETITION_LIMIT.bucket, message: "请求太频繁，请稍后再试", retry_after: result.retry_after,
    });
    return true;
  }
  const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "not_found", message: "比赛不存在或已下线" });

  const competitionOf = (id: string) => cache.cached(publicCacheKey(id, "competition"), PUBLIC_CACHE_TTL_MS, async () => {
    const record = competitionPublic.visible(id);
    return record ? competitionPublic.competition(record, Date.now()) : null;
  });
  const leaderboardOf = (id: string) => cache.cached(publicCacheKey(id, "leaderboard"), PUBLIC_CACHE_TTL_MS, async () => competitionPublic.leaderboard(id));
  const firstFeedOf = (id: string) => cache.cached(publicCacheKey(id, "feed"), PUBLIC_CACHE_TTL_MS, async () => competitionPublic.feed(id, null, FEED_PAGE_SIZE));
  const statsOf = (id: string) => cache.cached(publicCacheKey(id, "stats"), PUBLIC_CACHE_TTL_MS, async () => competitionPublic.stats(id));

  app.get<{ Params: { id: string } }>("/api/public/competitions/:id", async (req, reply) => {
    if (openAndLimit(req, reply)) return reply;
    // 下线与不存在同一副面孔：记录保留，官网整场隐藏。
    const competition = await competitionOf(req.params.id);
    return competition ? reply.send(competition) : notFound(reply);
  });

  app.get<{ Params: { id: string } }>("/api/public/competitions/:id/leaderboard", async (req, reply) => {
    if (openAndLimit(req, reply)) return reply;
    const board = await leaderboardOf(req.params.id);
    return board ? reply.send(board) : notFound(reply);
  });

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string } }>("/api/public/competitions/:id/feed", async (req, reply) => {
    if (openAndLimit(req, reply)) return reply;
    const limit = req.query.limit ? Number(req.query.limit) : FEED_PAGE_SIZE;
    const feed = !req.query.cursor && limit === FEED_PAGE_SIZE
      ? await firstFeedOf(req.params.id)
      : competitionPublic.feed(req.params.id, req.query.cursor ?? null, limit);
    return feed ? reply.send(feed) : notFound(reply);
  });

  app.get<{ Params: { id: string } }>("/api/public/competitions/:id/stats", async (req, reply) => {
    if (openAndLimit(req, reply)) return reply;
    const stats = await statsOf(req.params.id);
    return stats ? reply.send(stats) : notFound(reply);
  });

  // 整份快照：官网 SDK 的 subscribe 一次拿齐四样，轮询一次只算一个请求（校园网同一出口 IP 后面人多）。
  app.get<{ Params: { id: string } }>("/api/public/competitions/:id/snapshot", async (req, reply) => {
    if (openAndLimit(req, reply)) return reply;
    const id = req.params.id;
    const competition = await competitionOf(id);
    if (!competition) return notFound(reply);
    const [leaderboard, feed, stats] = await Promise.all([leaderboardOf(id), firstFeedOf(id), statsOf(id)]);
    if (!leaderboard || !feed || !stats) return notFound(reply);
    return reply.send({ competition, leaderboard, feed, stats });
  });
}
