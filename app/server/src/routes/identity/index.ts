import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { identityContracts } from "./contracts.js";
import providers from "./providers.js";
import device from "./device.js";
import email from "./email.js";
import google from "./google.js";
import account from "./account.js";

/** 统一登录的接口（#262，docs/plan/UNIFIED-LOGIN.md「接口」）：登录方式列表、邮箱与 Google 登录、账号页与命令行设备授权。 */
export default async function identityRoutes(app: FastifyInstance) {
  registerContracts(app, identityContracts);
  await app.register(providers);
  await app.register(device);
  await app.register(email);
  await app.register(google);
  await app.register(account);
}
