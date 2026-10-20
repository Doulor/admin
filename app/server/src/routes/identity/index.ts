import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { identityContracts } from "./contracts.js";
import providers from "./providers.js";

/** 统一登录的接口（#262，docs/plan/UNIFIED-LOGIN.md「接口」）：交付 1 只有 GET /auth/providers。 */
export default async function identityRoutes(app: FastifyInstance) {
  registerContracts(app, identityContracts);
  await app.register(providers);
}
