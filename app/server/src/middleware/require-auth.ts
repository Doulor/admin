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
