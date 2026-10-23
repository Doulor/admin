import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * 控制台的写操作要求「刚登录过」（CONTRACT-274 §5：「所有写操作需要 step-up」），和账号页绑定邮箱/设密码
 * 同一个 10 分钟窗口（routes/identity/account.ts 的 STEP_UP_MS）；两处各自定义常量，数值保持一致即可，
 * 不强行合并成同一个导入——账号页那份是 #262/#273 已经上线、测试覆盖很深的代码，这里不碰它。
 * 必须排在 requirePermission 之后用（preHandler 数组按声明顺序执行）：没有会话时让 requirePermission 先回 401。
 */
export const STEP_UP_MS = 10 * 60_000;

export function isSessionFresh(req: FastifyRequest): boolean {
  return Date.now() - req.session!.created_at <= STEP_UP_MS;
}

export async function requireStepUp(req: FastifyRequest, reply: FastifyReply) {
  if (!isSessionFresh(req)) {
    return reply.code(403).send({
      error: "step_up_required", message: "这一步要求刚登录过，请重新登录后再试",
      reauth: { return_to: "/console" },
    });
  }
}
