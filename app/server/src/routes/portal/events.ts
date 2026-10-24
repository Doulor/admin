import type { FastifyInstance, FastifyRequest } from "fastify";
import { loadSession } from "../../lib/session.js";
import { EVENT_WHITELIST } from "../../lib/activity.js";
import { ipHash } from "../../lib/forum-rules.js";

type EventItem = { action: string; target_type?: string | null; target_id?: string | null; meta?: Record<string, unknown> };

/** meta 序列化之后的大小上限：挡住拿这个接口当任意数据通道用（#274 残留修复 K.2）。 */
const META_BYTES_MAX = 2048;

/**
 * 前端只补充服务端看不到的动作（SPEC §3.7）：批量上报，访客也能调。白名单外的、meta 超过大小上限的
 * 直接丢弃，合并计一条 `events.rejected`，不逐条记垃圾数据。限流键登录的人按账号，没登录的按 IP 哈希，
 * 不再用访客 cookie（#274 残留修复 K.2）：那个 cookie 能被清掉重发一个新的（格式校验只挡格式不对的，
 * 见 middleware/visitor.ts），按它限流等于没限——同一个 IP 换着造新访客 cookie 就能一直拿到新额度。
 * `req.visitorId` 由 routes/portal/index.ts 挂的 attachVisitorId（middleware/visitor.ts）发，这里只读，不重复发 cookie，
 * 也不参与限流键（只用来给操作记录按访客去重，和「配额算谁的」是两回事）。
 */
export default async function eventsRoutes(app: FastifyInstance) {
  const { activity } = app.services;

  // 登录的人一样能调：这里只是尽量认出账号，不强制登录（游客也能调），所以不用 requireAuth。
  app.addHook("preHandler", async (req: FastifyRequest) => { loadSession(req); });

  app.post<{ Body: { events: EventItem[] } }>(
    "/api/events",
    {
      config: {
        rateLimit: {
          max: 30, timeWindow: "1 minute", hook: "preHandler",
          keyGenerator: req => req.session?.account_id ?? `ip:${ipHash(req.ip)}`,
        },
      },
    },
    async req => {
      let accepted = 0;
      const rejectedActions: string[] = [];
      for (const event of req.body.events) {
        const metaTooLarge = event.meta !== undefined && JSON.stringify(event.meta).length > META_BYTES_MAX;
        if (!metaTooLarge && (EVENT_WHITELIST as readonly string[]).includes(event.action)) {
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
