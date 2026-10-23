import type { FastifyRequest } from "fastify";
import type { IdentityProvider } from "./identity-store.js";

declare module "fastify" {
  interface FastifyRequest {
    /** `account_id` 是极客班账号（#262）；`login`、`user_id`、`avatar_url` 是绑定的 GitHub 账号。 */
    session?: {
      id: string;
      account_id: string;
      provider: IdentityProvider;
      login: string;
      user_id: number | null;
      avatar_url: string | null;
      accessToken: string;
      /** 会话签发时间：绑定邮箱、设密码前要求这次登录不超过 10 分钟（重新验证） */
      created_at: number;
      expires_at: number;
    };
  }
}

/**
 * 有有效的 `sid` 就挂到 req.session 并返回 true；没有或已过期返回 false，不回复。给「游客也能用」的接口（论坛）用。
 * 原来在 middleware/require-auth.ts：#274 的 lib/console-scope.ts（requireScopedPermission）也要自己判定登录态
 * （同 require-permission.ts 的理由——它挂的路由不一定有 requireAuth 钩子），但 scripts/check-boundaries.mjs
 * 不准 app/server/src/lib/* 依赖 app/server/src/middleware/*；挪到这里，middleware/require-auth.ts 改成从这儿
 * re-export，其余按旧路径 `../middleware/require-auth.js` 导入 loadSession 的文件不用改。
 */
export function loadSession(req: FastifyRequest): boolean {
  if (req.session) return true;
  const sid = req.cookies?.sid;
  const s = sid ? req.server.services.auth.getSession(sid) : null;
  if (!s) return false;
  req.session = {
    id: s.id,
    account_id: s.account_id,
    provider: s.provider,
    login: s.login,
    user_id: s.user_id,
    avatar_url: s.avatar_url,
    accessToken: s.accessToken,
    created_at: s.created_at,
    expires_at: s.expires_at,
  };
  return true;
}
