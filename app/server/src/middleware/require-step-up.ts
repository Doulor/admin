import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * 控制台的写操作要求「刚登录过」（CONTRACT-274 §5：「所有写操作需要 step-up」），和账号页绑定邮箱/设密码
 * 同一个 10 分钟窗口（routes/identity/account.ts 的 STEP_UP_MS）；两处各自定义常量，数值保持一致即可，
 * 不强行合并成同一个导入——账号页那份是 #262/#273 已经上线、测试覆盖很深的代码，这里不碰它。
 * 必须排在 requirePermission 之后用（preHandler 数组按声明顺序执行）：没有会话时让 requirePermission 先回 401。
 * 用 `req.server.services.clock()` 而不是裸 `Date.now()`：session.created_at 是 lib/auth.ts 的 createSession
 * 用同一个可注入时钟盖的时间戳，测试用固定/拨动的假时钟时（如 tests/server/mail-outbox.test.ts），两边必须
 * 比对同一条时间线，否则假时钟和真实 Date.now() 的差值（可能是几年）会让每个会话看起来永远「不新鲜」。
 */
export const STEP_UP_MS = 10 * 60_000;

export function isSessionFresh(req: FastifyRequest): boolean {
  return req.server.services.clock() - req.session!.created_at <= STEP_UP_MS;
}

export async function requireStepUp(req: FastifyRequest, reply: FastifyReply) {
  if (!isSessionFresh(req)) {
    return reply.code(403).send({
      error: "step_up_required", message: "这一步要求刚登录过，请重新登录后再试",
      reauth: { return_to: "/console" },
    });
  }
}
