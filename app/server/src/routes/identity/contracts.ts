import {
  choices, integer, nullableText, object, text, type RouteContracts,
} from "../../lib/http-contracts.js";

/** 一种登录方式（规格「接口」的 Providers）：前端按这个列表渲染按钮，不写死任何渠道。 */
const provider = object({
  id: choices("github", "google", "email"),
  name: text(40, 1),
  kind: choices("redirect", "email_code"),
  start: text(200, 1),
  can_register: { type: "boolean" },
  password: text(200, 1),
}, ["id", "name", "kind", "start", "can_register"]);

// 错误体：设备授权（RFC 8628）带 OAuth 的 error / error_description，邮箱登录与账号页带 attempts_left、retry_after、reauth；
// 都保留共同错误处理器的扩展字段，不因补了成功响应的合同而被删掉。
const failure = object({
  error: { type: "string" },
  error_description: { type: "string" },
  message: { type: "string" },
  request_id: { type: "string" },
}, ["error"], true);
const failures = { "4xx": failure, "5xx": failure };

// 邮箱、Google 与账号页（#262 第二期）
const email = text(254, 3);
const code = text(16);
const returnTo = text(2048);
const inviteCode = text(40);
const timestamp = integer(0);
const nullableTimestamp = { anyOf: [integer(0), { type: "null" }] };
const loginProvider = choices("github", "email", "google");
const codeSent = object({ resend_after: integer(1) }, ["resend_after"]);
const signedIn = object({ return_to: text(2048, 1), registered: { type: "boolean" } }, ["return_to"]);
const done = object({ ok: { type: "boolean", const: true } }, ["ok"]);
const accountView = object({
  account_id: text(64, 1),
  login: text(100, 1),
  identities: {
    type: "array", maxItems: 3,
    items: object({ provider: loginProvider, label: text(254), linked_at: timestamp, last_login_at: nullableTimestamp }, ["provider", "label", "linked_at", "last_login_at"]),
  },
  has_password: { type: "boolean" },
  password_updated_at: nullableTimestamp,
  membership: object({
    state: choices("active", "pending", "not_member", "unknown"), org_role: nullableText(20), via_invite: { type: "boolean" },
  }, ["state", "org_role", "via_invite"]),
  created_at: timestamp,
  recent: {
    type: "array", maxItems: 20,
    items: object({ at: timestamp, action: text(64, 1), provider: nullableText(20), result: choices("ok", "denied", "failed") }, ["at", "action", "provider", "result"]),
  },
  available: { type: "array", items: choices("email"), maxItems: 1 },
  session: object({
    provider: loginProvider, created_at: timestamp, expires_at: timestamp, step_up_until: timestamp,
  }, ["provider", "created_at", "expires_at", "step_up_until"]),
}, ["account_id", "login", "identities", "has_password", "password_updated_at", "membership", "created_at", "recent", "available", "session"]);

const deviceStatus = choices("pending", "approved", "denied", "expired", "consumed");
const deviceCodeResult = object({
  device_code: text(128, 1),
  user_code: text(9, 1),
  verification_uri: text(500, 1),
  verification_uri_complete: text(600, 1),
  expires_in: integer(0),
  interval: integer(1),
}, ["device_code", "user_code", "verification_uri", "verification_uri_complete", "expires_in", "interval"]);
const deviceTokenResult = object({
  access_token: text(128, 1),
  token_type: choices("Bearer"),
  expires_in: integer(0),
  scope: text(200),
  account_id: text(64, 1),
}, ["access_token", "token_type", "expires_in", "scope", "account_id"]);
const deviceView = object({
  user_code: text(9, 1),
  client_id: text(64, 1),
  client_name: text(40, 1),
  scope: text(200),
  status: deviceStatus,
  expires_at: integer(0),
}, ["user_code", "client_id", "client_name", "scope", "status", "expires_at"]);
const deviceDecision = object({
  ok: { type: "boolean", const: true },
  status: choices("approved", "denied"),
}, ["ok", "status"]);
const deviceProfile = object({
  sub: text(64, 1),
  account_id: text(64, 1),
  login: text(40),
  avatar_url: nullableText(500),
  scope: text(200),
}, ["sub", "account_id", "login", "avatar_url", "scope"]);

export const identityContracts: RouteContracts = {
  "GET /auth/providers": {
    querystring: object({}),
    response: { 200: object({ providers: { type: "array", items: provider, maxItems: 3 } }, ["providers"]) },
  },
  // 字段不设 required：缺参数也要按 RFC 8628 回 invalid_client / invalid_grant，而不是通用的 validation_error。
  "POST /auth/device/code": {
    querystring: object({}),
    body: object({ client_id: text(64), scope: text(200) }),
    response: { 200: deviceCodeResult, ...failures },
  },
  "POST /auth/device/token": {
    querystring: object({}),
    body: object({ grant_type: text(120), device_code: text(128), client_id: text(64) }),
    response: { 200: deviceTokenResult, ...failures },
  },
  "GET /api/identity/device": {
    querystring: object({ user_code: text(32) }),
    response: { 200: deviceView, ...failures },
  },
  "POST /api/identity/device/approve": {
    querystring: object({}),
    body: object({ user_code: text(32), decision: choices("approve", "deny") }),
    response: { 200: deviceDecision, ...failures },
  },
  "GET /auth/device/userinfo": {
    querystring: object({}),
    response: { 200: deviceProfile, ...failures },
  },
  "POST /auth/email/start": {
    querystring: object({}),
    body: object({ email, return_to: returnTo }, ["email"]),
    response: { 202: codeSent, ...failures },
  },
  "POST /auth/email/verify": {
    querystring: object({}),
    body: object({ code, invite_code: inviteCode }, ["code"]),
    response: { 200: signedIn, ...failures },
  },
  "POST /auth/email/password": {
    querystring: object({}),
    body: object({ email, password: text(200, 1), return_to: returnTo }, ["email", "password"]),
    response: { 200: signedIn, ...failures },
  },
  // 两个 Google 接口成功时都是 302 跳转、没有响应体，只约束失败体
  "GET /auth/google": { querystring: object({ return_to: returnTo, invite: inviteCode }), response: failures },
  // Google 回调还会带 scope、authuser、prompt、hd、iss 等参数，不一一列出
  "GET /auth/google/callback": { querystring: object({ code: text(2048), state: text(128), error: text(128) }, [], true), response: failures },
  "GET /api/identity/me": { querystring: object({}), response: { 200: accountView, ...failures } },
  "POST /api/identity/email/start": { querystring: object({}), body: object({ email }, ["email"]), response: { 202: codeSent, ...failures } },
  "POST /api/identity/email/verify": { querystring: object({}), body: object({ code }, ["code"]), response: { 200: done, ...failures } },
  "POST /api/identity/password": {
    querystring: object({}),
    body: object({ password: text(200, 1), current_password: text(200) }, ["password"]),
    response: { 200: done, ...failures },
  },
};
