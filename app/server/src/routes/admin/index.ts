import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { adminContracts } from "./contracts.js";
import auth from "./auth.js";

/**
 * 登录与会话（`/auth/*`、`/api/me/*`）：GitHub 登录、回调、退出、`/auth/me`。GitHub 组织管理
 * （`/api/admin/:org/*`、`/api/me/orgs`）#274 起整组删除——权限只认极客班账号，不再有「控制台管理的 GitHub 组织」
 * 这个概念；控制台改接 GitLab（见 routes/console/gitlab.ts）。
 */
export default async function adminRoutes(app: FastifyInstance) {
  registerContracts(app, adminContracts);
  await app.register(auth);
}
