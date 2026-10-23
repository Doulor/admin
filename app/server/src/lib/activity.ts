import type Database from "better-sqlite3";
import type { FastifyRequest } from "fastify";

// req.visitorId（匿名访客编号）由 middleware/visitor.ts 的 attachVisitorId 挂在 portal/forum-api 两个插件作用域上，
// 这里只读，不重复定义一套（两个人各自做过一版，这是收敛成一份之后留下的，见执行记录）。不在这里 import 那个
// 文件：declare module 的类型扩展是全局的，只要它在编译时被别处（routes/portal/index.ts）引入过就对全仓库生效，
// 这里 import 反而会被 check-boundaries.mjs 判「lib 依赖 middleware」。

export type ActivityOutcome = "ok" | "denied" | "limited" | "error";
export type ActivitySurface = "portal" | "forum" | "console" | "cli" | "api" | "system";

/** `POST /api/events` 只收这几种（SPEC §3.7）；不在白名单里的直接丢弃，合并计一条 `events.rejected`。 */
export const EVENT_WHITELIST = ["os.boot.played", "os.boot.skipped", "os.app.open", "os.note.dismissed", "forum.theme.change", "page.view"] as const;
export type WhitelistedEvent = (typeof EVENT_WHITELIST)[number];

export type RecordActivityInput = {
  action: string;
  surface: ActivitySurface;
  target_type?: string | null;
  target_id?: string | null;
  outcome?: ActivityOutcome;
  /** 不记密码、验证码、令牌、完整请求体（SPEC §3.7）；调用方自己按这条清单决定放什么，这里不做内容过滤。 */
  meta?: Record<string, unknown>;
};

/**
 * 操作记录唯一写入口（SPEC §3.7：`recordActivity(req, { action, target, outcome, meta })`）：这里把 `target`
 * 拆成 `target_type`/`target_id` 两个参数，和落库 schema（db.ts 的 `activity_events`）、读接口
 * （routes/console/activity.ts）已经在用的形状保持一致，不是削减字段。
 */
export function createActivityRecorder(db: Database.Database, clock: () => number = Date.now) {
  const insert = db.prepare(`
    INSERT INTO activity_events(at, account_id, visitor_id, surface, action, target_type, target_id, outcome, ip, ua, request_id, meta)
    VALUES (@at, @account_id, @visitor_id, @surface, @action, @target_type, @target_id, @outcome, @ip, @ua, @request_id, @meta)
  `);

  function recordActivity(req: FastifyRequest, input: RecordActivityInput): void {
    const accountId = req.session?.account_id ?? null;
    insert.run({
      at: clock(),
      account_id: accountId,
      // 登录的人不重复记访客编号：一个人同时有账号和访客 cookie 时，操作记录按账号认，不要两边都算一次活跃访客。
      visitor_id: accountId ? null : req.visitorId ?? null,
      surface: input.surface,
      action: input.action,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      outcome: input.outcome ?? "ok",
      ip: req.ip ?? null,
      ua: (req.headers["user-agent"] as string | undefined) ?? null,
      request_id: String(req.id),
      meta: JSON.stringify(input.meta ?? {}),
    });
  }

  /** 保留 180 天、每天清理一次（SPEC §3.7）；IP 原样存但只保留 90 天，90 天以上的记录只打码不删行（还要留着给统计用）。 */
  function pruneExpired(now: number = clock()): { deleted: number; ipMasked: number } {
    const deleted = db.prepare("DELETE FROM activity_events WHERE at < ?").run(now - RETENTION_MS).changes;
    const ipMasked = db.prepare("UPDATE activity_events SET ip = NULL WHERE ip IS NOT NULL AND at < ?").run(now - IP_RETENTION_MS).changes;
    return { deleted, ipMasked };
  }

  return { recordActivity, pruneExpired };
}
export type ActivityRecorder = ReturnType<typeof createActivityRecorder>;

/** 记录保留 180 天；IP 单独只保留 90 天（SPEC §3.7）。 */
export const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
export const IP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** 清理间隔：每天一次，和 lib/auth.ts 的会话清理用同一种「启动清一次 + 定时器」模式。 */
export const ACTIVITY_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type ActivityCleanupLogger = { info(details: Record<string, unknown>, message: string): void; error(details: Record<string, unknown>, message: string): void };

export function startActivityCleanup(recorder: ActivityRecorder, logger: ActivityCleanupLogger): () => void {
  const run = () => {
    try {
      const { deleted, ipMasked } = recorder.pruneExpired();
      if (deleted > 0 || ipMasked > 0) logger.info({ deleted, ipMasked }, "activity events pruned");
    } catch (error) {
      logger.error({ error: (error as Error)?.name ?? "error", code: (error as { code?: unknown })?.code }, "activity cleanup failed");
    }
  };
  run();
  const timer = setInterval(run, ACTIVITY_CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
