import { choices, object, text, type RouteContracts } from "../../lib/http-contracts.js";

/** 一种登录方式（规格「接口」的 Providers）：前端按这个列表渲染按钮，不写死任何渠道。 */
const provider = object({
  id: choices("github", "google", "email"),
  name: text(40, 1),
  kind: choices("redirect", "email_code"),
  start: text(200, 1),
  can_register: { type: "boolean" },
}, ["id", "name", "kind", "start", "can_register"]);

export const identityContracts: RouteContracts = {
  "GET /auth/providers": {
    querystring: object({}),
    response: { 200: object({ providers: { type: "array", items: provider, maxItems: 3 } }, ["providers"]) },
  },
};
