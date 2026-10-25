import type { FastifyInstance } from "fastify";
import { registerContracts } from "../../lib/http-contracts.js";
import { attachVisitorId } from "../../middleware/visitor.js";
import { forumContracts, forumValidationMessage } from "./contracts.js";
import topics from "./topics.js";
import posts from "./posts.js";
import people from "./people.js";
import stickers from "./stickers.js";
import uploads from "./uploads.js";

/**
 * 论坛接口 `/api/forum/*`（#57，ADR-0004）：存储在 data.db，身份只认核心 `sid`，
 * 论坛能力与控制台同一条 computeAccess 路径。不导入其它路由模块。
 */
export default async function forumRoutes(app: FastifyInstance) {
  registerContracts(app, forumContracts);
  app.setSchemaErrorFormatter((errors, dataVar) => new Error(forumValidationMessage(errors, dataVar)));
  // 访客 cookie（#274）：论坛接口第一次收到请求就发，不论登录没登录；只在这个插件作用域生效。
  app.addHook("onRequest", attachVisitorId);
  await app.register(topics);
  await app.register(posts);
  await app.register(people);
  await app.register(stickers);
  await app.register(uploads);
}
