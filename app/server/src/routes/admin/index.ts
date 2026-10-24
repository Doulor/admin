import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { adminContracts } from "./contracts.js";
import auth from "./auth.js";

/**
 * 登录与会话（`/auth/*`、`/api/me/*`）：GitHub 登录、回调、退出、`/auth/me`。GitHub 组织管理
 * （`/api/admin/:org/*`、`/api/me/orgs`）#274 起整组删除——权限只认极客班账号，不再有「控制台管理的 GitHub 组织」
 * 这个概念；控制台改接 GitLab（见 routes/console/gitlab.ts）。
 * 没有挂 middleware/visitor.ts 的 attachVisitorId：这组路由不需要自己发访客 cookie（auth.ts 的 GitHub 回调按
 * 注册限额只在已经有这个 cookie 时才用它，见 auth.ts 的说明），避免 `/auth/github` 的跳转多带一个 Set-Cookie，
 * 弄坏一大批测试里「取第一个 set-cookie 的第一段」这种朴素的 cookie 提取写法。
 */
export default async function adminRoutes(app: FastifyInstance) {
  registerContracts(app, adminContracts);
  await app.register(auth);
}
