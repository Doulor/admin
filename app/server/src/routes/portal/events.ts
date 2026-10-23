import type { FastifyInstance, FastifyRequest } from "fastify";
import { loadSession } from "../../lib/session.js";
import { EVENT_WHITELIST } from "../../lib/activity.js";

type EventItem = { action: string; target_type?: string | null; target_id?: string | null; meta?: Record<string, unknown> };

/**
 * 前端只补充服务端看不到的动作（SPEC §3.7）：批量上报，访客也能调。白名单外的直接丢弃，合并计一条
 * `events.rejected`，不逐条记垃圾数据。限流按 visitor 或账号（不是 IP）：同一人开多个标签页共享同一个配额。
 * `req.visitorId` 由 routes/portal/index.ts 挂的 attachVisitorId（middleware/visitor.ts）发，这里只读，不重复发 cookie。
 */
export default async function eventsRoutes(app: FastifyInstance) {
  const { activity } = app.services;

  // 登录的人一样能调：这里只是尽量认出账号，不强制登录（游客也能调），所以不用 requireAuth。
  app.addHook("preHandler", async (req: FastifyRequest) => { loadSession(req); });

  app.post<{ Body: { events: EventItem[] } }>(
    "/api/events",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute", hook: "preHandler", keyGenerator: req => req.session?.account_id ?? req.visitorId ?? req.ip } } },
    async req => {
      let accepted = 0;
      const rejectedActions: string[] = [];
      for (const event of req.body.events) {
        if ((EVENT_WHITELIST as readonly string[]).includes(event.action)) {
          activity.recordActivity(req, {
            action: event.action, surface: "portal",
            target_type: event.target_type ?? null, target_id: event.target_id ?? null, meta: event.meta,
          });
          accepted += 1;
        } else {
          rejectedActions.push(event.action);
        }
      }
      if (rejectedActions.length > 0) {
        activity.recordActivity(req, { action: "events.rejected", surface: "api", outcome: "denied", meta: { count: rejectedActions.length, actions: rejectedActions } });
      }
      return { accepted, rejected: rejectedActions.length };
    },
  );
}
