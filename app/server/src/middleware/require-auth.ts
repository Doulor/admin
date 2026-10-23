import type { FastifyReply, FastifyRequest } from "fastify";
import { loadSession } from "../lib/session.js";

// loadSession 与 FastifyRequest.session 的类型扩展挪进了 lib/session.ts（#274：lib/console-scope.ts 也要用，
// 但 lib/* 不能依赖 middleware/*，见 scripts/check-boundaries.mjs）；这里保留原路径的 re-export，不用改别处的导入。
export { loadSession };

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const sid = req.cookies?.sid;
  if (!sid) return reply.code(401).send({ error: "not_signed_in" });
  if (!loadSession(req)) return reply.code(401).send({ error: "session_expired" });
}

/** 登录成功后写统一登录的 `sid`：三端同域共用，7 天、不续期（lib/auth.ts 的 SESSION_TTL_MS）。 */
export function setSessionCookie(reply: FastifyReply, sid: string): void {
  const { cookieDomain, cookieSecure } = reply.server.services.config;
  reply.setCookie("sid", sid, { httpOnly: true, secure: cookieSecure, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60, domain: cookieDomain });
}

/** 清掉统一登录的 cookie：退出登录时，和会话里的 GitHub 令牌失效时。`forum_sid` 是旧论坛留下的，一起清。 */
export function clearSessionCookies(reply: FastifyReply): void {
  const { cookieDomain } = reply.server.services.config;
  reply.clearCookie("sid", { path: "/", domain: cookieDomain });
  reply.clearCookie("forum_sid", { path: "/", domain: cookieDomain });
}

/**
 * GitHub 用 401 拒绝了这次调用用的令牌（Octokit 的错误只带 `status`；Fastify 自己的错误带 `statusCode`，不算）。
 * GitHub 只在令牌本身无效时回 401：被用户撤销，或同一用户的令牌超过 10 个时被收回。权限不够是 403 或 404。
 */
export function isRejectedToken(error: unknown): boolean {
  const e = error as { status?: unknown; statusCode?: unknown } | null | undefined;
  return e?.statusCode === undefined && e?.status === 401;
}

/**
 * 会话里存的 GitHub 令牌已经失效，这个会话再也查不了组织角色：删掉它、清 cookie，之后的请求按未登录处理（#164）。
 * 同一页面的几个请求一起碰到时，只有真正删掉会话的那一个记审计 `auth.session_rejected`。
 */
export function endRejectedSession(req: FastifyRequest, reply: FastifyReply, session: { id: string; login: string; account_id: string }): void {
  const { auth, storage } = req.server.services;
  if (auth.destroySession(session.id)) storage.audit(null, session, "auth.session_rejected", session.login, undefined, req.ip);
  clearSessionCookies(reply);
  req.log.warn({ requestId: req.id }, "session ended: GitHub rejected its token");
}
