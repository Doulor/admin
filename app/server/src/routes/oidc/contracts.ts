import { choices, integer, object, text, type RouteContracts } from "../../lib/http-contracts.js";

/**
 * 对外授权的交互接口（#270）。`/oidc/*` 的协议端点（发现文档、JWKS、授权、换令牌、userinfo、撤销）由 oidc-provider 按 OIDC 与
 * OAuth 的规范回应，请求不在这里校验，成功的形状以规范为准，这里只声明出错时的形状（`oidcProtocolResponse`）；
 * 其余是交互入口和授权页用的三个接口。
 */
const uid = object({ uid: { type: "string", pattern: "^[A-Za-z0-9_-]{10,64}$" } }, ["uid"]);
const noQuery = { querystring: object({}) };
const failure = object({ error: { type: "string" }, error_description: { type: "string" }, message: { type: "string" }, request_id: { type: "string" } }, ["error"], true);
const failures = { "4xx": failure, "5xx": failure };
const redirect = object({ redirect_to: text(4096, 1) }, ["redirect_to"]);

/** 协议端点与交互入口出错时：oidc-provider 的 `{ error, error_description }`、限流与 404 的 `{ error, message }`（交互入口的 HTML 错误页是字符串，不经序列化）。 */
export const oidcProtocolResponse = failures;

export const oidcContracts: RouteContracts = {
  "GET /oidc/interaction/:uid": { ...noQuery, params: uid, response: oidcProtocolResponse },
  "GET /oidc/interaction/:uid/details": {
    ...noQuery,
    params: uid,
    response: {
      200: object({
        client: object({ id: text(64, 1), name: text(60, 1), host: text(255, 1) }, ["id", "name", "host"]),
        scopes: { type: "array", maxItems: 3, items: choices("openid", "profile", "email") },
        account: object({ login: text(100, 1), name: text(255, 1), picture: { anyOf: [text(2048, 1), { type: "null" }] } }, ["login", "name", "picture"]),
        expires_at: integer(0),
      }, ["client", "scopes", "account", "expires_at"]),
      ...failures,
    },
  },
  "POST /oidc/interaction/:uid/confirm": { ...noQuery, params: uid, response: { 200: redirect, ...failures } },
  "POST /oidc/interaction/:uid/abort": { ...noQuery, params: uid, response: { 200: redirect, ...failures } },
};
