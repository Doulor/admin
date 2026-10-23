import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { normalizeEmail } from "../../lib/email-login.js";
import { normalizeInviteCode } from "../../lib/invite-codes.js";
import { safeReturnTo, signinFailureUrl, type SigninOutcome } from "../../lib/safe-return.js";
import { bindEmailUrl, emailRequired } from "../../lib/email-gate.js";
import { readOAuthState, setOAuthState } from "../../middleware/oauth-state.js";
import { setSessionCookie } from "../../middleware/require-auth.js";

/**
 * Google 登录（#262，ADR-0005「Google 登录」；#274 邀请码改选填，SPEC §3.2）：`GET /auth/google` 生成 state、nonce
 * 与 PKCE，存进签名 cookie 后跳 Google；`GET /auth/google/callback` 换 token、验 ID Token、按 Google 的 `sub` 登录。
 * 没有账号时不填 `/auth/google?invite=` 就注册成注册用户，填了且有效注册成成员，填了但无效回登录页
 * `signin=invite_invalid&provider=google`（不建号，还能重新发起）。
 * 没配 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 时两个接口都回 404 provider_not_enabled，登录页也不出现 Google。
 */
export default async function googleRoutes(app: FastifyInstance) {
  const { config, google, identity } = app.services;
  const fallback = `${config.publicOrigin}/console`;

  // 限流按 IP：回调里会试邀请码、会用我们的密钥去 Google 换 token，不能让人反复刷
  app.get<{ Querystring: { return_to?: string; invite?: string } }>("/auth/google", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!google.enabled) return reply.code(404).send({ error: "provider_not_enabled", message: "本站没有启用 Google 登录" });
    const state = randomBytes(16).toString("base64url");
    const nonce = randomBytes(16).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const invite = normalizeInviteCode(req.query.invite) ?? undefined;
    const returnTo = safeReturnTo(req.query.return_to, config, fallback);
    setOAuthState(reply, config, "google_oauth_state", { state, kind: "google-signin", returnTo, nonce, verifier, ...(invite ? { invite } : {}) });
    return reply.redirect(google.authorizeUrl({ state, nonce, verifier }));
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/auth/google/callback", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!google.enabled) return reply.code(404).send({ error: "provider_not_enabled", message: "本站没有启用 Google 登录" });
    const { code, state, error } = req.query;
    if (!state || (!code && !error)) return reply.code(400).send({ error: "missing_params" });
    const flow = readOAuthState(req, reply, "google_oauth_state", state);
    if (!flow) return reply.code(400).send({ error: "invalid_state" });
    const back = safeReturnTo(flow.returnTo, config, fallback);
    const fail = (outcome: SigninOutcome) => reply.redirect(signinFailureUrl(config.publicOrigin, back, outcome, { provider: "google" }));
    if (error || !code) return fail(error === "access_denied" ? "cancelled" : "failed");
    const claims = await google.exchange(code, flow.verifier!)
      .then(idToken => google.verifyIdToken(idToken, flow.nonce!))
      .catch((cause: { code?: string; status?: number; upstream?: string }) => {
        req.log.error({ code: cause?.code, status: cause?.status, upstream: cause?.upstream, requestId: req.id }, "google sign-in failed");
        return null;
      });
    if (!claims) return fail("failed");
    let result;
    try {
      result = identity.signInWithGoogle({
        sub: claims.sub, email: claims.email ? normalizeEmail(claims.email) : null, invite: flow.invite ?? null,
        previousSid: req.cookies?.sid ?? null, ip: req.ip,
      });
    } catch (cause) {
      req.log.error({ code: (cause as { code?: string })?.code ?? "signin_transaction_failed", requestId: req.id }, "google sign-in transaction failed");
      return fail("failed");
    }
    if (!result.ok) return fail(result.reason === "code_expired" ? "failed" : result.reason);
    setSessionCookie(reply, result.sid);
    // 账号还没有登录邮箱（#273，Google 给的邮箱不算登录邮箱）：先到绑定邮箱页，绑好再回 return_to
    return reply.redirect(emailRequired(app.services, result.accountId) ? bindEmailUrl(config.publicOrigin, back) : back);
  });
}
