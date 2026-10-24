import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { attachVisitorId } from "../../middleware/visitor.js";
import { portalContracts } from "./contracts.js";
import r0 from "./public-config.js";
import r1 from "./docs.js";
import r2 from "./feedback.js";
import r3 from "./apply.js";
import r4 from "./org.js";
import r5 from "./competitions.js";
import r6 from "./competition-signups.js";
import r7 from "./gitlab.js";
import r8 from "./departments.js";
import r9 from "./events.js";
export default async function portalRoutes(app: FastifyInstance) {
  registerContracts(app, portalContracts);
  // 访客 cookie（#274）：门户接口第一次收到请求就发，不论登录没登录；只在这个插件作用域生效。
  app.addHook("onRequest", attachVisitorId);
  await app.register(r0);
  await app.register(r1);
  await app.register(r2);
  await app.register(r3);
  await app.register(r4);
  await app.register(r5);
  await app.register(r6);
  await app.register(r7);
  await app.register(r8);
  await app.register(r9);
}
