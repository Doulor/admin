import type { RouteContracts } from "../../lib/http-contracts.js";

/**
 * `routes/admin/auth.ts` 的接口（`/auth/github`、`/auth/callback`、`/auth/signout`、`/auth/me`）不接受
 * 调用方的 JSON body，无需声明契约。GitHub 组织管理的全部契约随 #274 一起删除。
 */
export const adminContracts: RouteContracts = {};
