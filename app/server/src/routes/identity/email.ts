import bcrypt from "bcryptjs";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CODE_TTL_MS, RESEND_AFTER_S, normalizeEmail } from "../../lib/email-login.js";
import type { LoginCodePurpose } from "../../lib/mail/login-code.js";
import { PASSWORD_MIN_LENGTH, createLoginThrottle, hashPassword, passwordError } from "../../lib/password-policy.js";
import { safeReturnTo } from "../../lib/safe-return.js";
import { rateLimited } from "../../middleware/http-policy.js";
import { setSessionCookie } from "../../middleware/require-auth.js";

/**
 * 邮箱登录（#262，所有者 2026-10-23：「验证码和密码都支持」）：
 * - `POST /auth/email/start`：发 6 位验证码。不论邮箱有没有账号响应都一样（202 + 挑战 cookie），没有账号的邮箱也真的发——
 *   填了邀请码就能用它注册。
 * - `POST /auth/email/verify`：核对验证码后登录；没有账号时要 `invite_code`，缺了回 `invite_required`（验证码不作废，
 *   填上邀请码再交一次），邀请码不对回 `invalid_invite` 并记一次失败。
 * - `POST /auth/email/password`：邮箱加密码登录。密码在账号页设（至少 8 位）；没账号、没设密码、密码不对一律回同一个错误。
 * - `POST /auth/email/reset`（#273，忘了密码）：用 `/auth/email/start` 发的验证码（`purpose: "reset"` 只改信的文字，
 *   挑战还是登录用的那一种）核对邮箱，设新密码并登录。不能注册：邮箱没有账号回 `no_account`，验证码不作废。
 * 成功都写 `sid` 并回 `{ return_to }`，前端整页跳转。
 */
export const CHALLENGE_COOKIE = "email_challenge";
/** 没有账号时也跑一次 bcrypt，响应时间不随邮箱是否注册变化（cost 与 lib/password-policy.ts 的 12 相同）；第一次用到时才算。 */
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= bcrypt.hash("yzgc-no-such-account", 12));

/** 挑战 cookie：签名、HttpOnly、10 分钟；登录用 path=/auth/email，绑定用 path=/api/identity/email。 */
export function setChallengeCookie(reply: FastifyReply, id: string, path: string): void {
  const { cookieDomain, cookieSecure } = reply.server.services.config;
  reply.setCookie(CHALLENGE_COOKIE, id, { signed: true, httpOnly: true, secure: cookieSecure, sameSite: "lax", path, domain: cookieDomain, maxAge: CODE_TTL_MS / 1000 });
}
export function readChallengeCookie(req: FastifyRequest): string | null {
  const raw = req.cookies?.[CHALLENGE_COOKIE];
  if (!raw || raw.length > 512) return null;
  const signed = req.unsignCookie(raw);
  return signed.valid && signed.value ? signed.value : null;
}
export function clearChallengeCookie(reply: FastifyReply, path: string): void {
  reply.clearCookie(CHALLENGE_COOKIE, { path, domain: reply.server.services.config.cookieDomain });
}

/**
 * 发验证码信：不等发信就回响应（`void`），投递结果只记日志（发信商、错误码），不记地址和验证码。
 * 验证码原文只在这里交给发信模块，不落库、不进日志。
 */
export function sendCode(req: FastifyRequest, to: string, code: string, purpose: LoginCodePurpose, challengeId: string): void {
  const { mail } = req.server.services;
  const letter = mail.loginCodeLetter(code, purpose, CODE_TTL_MS / 60_000);
  void mail.sendNow(to, letter, `yzgc-code-${challengeId}`)
    .then(result => {
      if (result.status === "sent") req.log.info({ provider: result.provider, purpose, requestId: req.id }, "login code sent");
      else req.log.warn({ status: result.status, error: result.error, purpose, requestId: req.id }, "login code not sent");
    })
    .catch(() => req.log.error({ purpose, requestId: req.id }, "login code send crashed"));
}

/** 发码太频繁的 429：与 #191 的 rate_limited 同形，另带 Retry-After 与 `retry_after`（秒），登录页按它倒计时。 */
export function tooSoon(reply: FastifyReply, retryAfter: number): FastifyReply {
  const seconds = Math.max(1, retryAfter);
  return reply.code(429).header("Retry-After", String(seconds)).send({
    error: "rate_limited", message: `发得太频繁了，${seconds} 秒后再试`, retry_after: seconds, request_id: reply.request.id,
  });
}

export default async function emailRoutes(app: FastifyInstance) {
  const { config, emailLogin, identity } = app.services;
  const throttle = createLoginThrottle();
  const fallback = `${config.publicOrigin}/console`;

  app.post<{ Body: { email: string; return_to?: string; purpose?: "signin" | "reset" } }>(
    "/auth/email/start",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const email = normalizeEmail(req.body.email);
      if (!email) return reply.code(400).send({ error: "bad_email", message: "邮箱格式不对" });
      const returnTo = safeReturnTo(req.body.return_to, config, fallback);
      const started = emailLogin.start({ purpose: "signin", email, ip: req.ip, replaces: readChallengeCookie(req), returnTo });
      if (!started.ok) return tooSoon(reply, started.retryAfter);
      sendCode(req, email, started.code, req.body.purpose === "reset" ? "reset" : "signin", started.id);
      setChallengeCookie(reply, started.id, "/auth/email");
      return reply.code(202).send({ resend_after: RESEND_AFTER_S });
    },
  );

  app.post<{ Body: { code: string; invite_code?: string } }>(
    "/auth/email/verify",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const id = readChallengeCookie(req);
      const checked = emailLogin.check(id, req.body.code, "signin");
      if (!checked.ok) {
        return checked.error === "invalid_code"
          ? reply.code(400).send({ error: "invalid_code", message: `验证码不对，还可以试 ${checked.attemptsLeft} 次`, attempts_left: checked.attemptsLeft })
          : reply.code(400).send({ error: "code_expired", message: "验证码已失效，请重新获取" });
      }
      const { challenge } = checked;
      const result = identity.signInWithEmailCode({
        email: challenge.email, invite: req.body.invite_code?.trim() || null,
        previousSid: req.cookies?.sid ?? null, ip: req.ip, claim: () => emailLogin.claim(challenge.id),
      });
      if (!result.ok) {
        switch (result.reason) {
          case "invite_required":
            return reply.code(400).send({ error: "invite_required", message: "这个邮箱还没有极客班账号，填邀请码就能注册" });
          case "invalid_invite": {
            const left = emailLogin.penalize(challenge.id);
            return reply.code(400).send({ error: "invalid_invite", message: left > 0 ? `邀请码无效，还可以试 ${left} 次` : "邀请码无效，验证码已失效，请重新获取", attempts_left: left });
          }
          case "account_disabled":
            return reply.code(403).send({ error: "account_disabled", message: "这个极客班账号已停用" });
          case "not_member":
            return reply.code(403).send({ error: "not_member", message: "这个账号已经不是极客班成员" });
          default:
            return reply.code(400).send({ error: "code_expired", message: "验证码已失效，请重新获取" });
        }
      }
      clearChallengeCookie(reply, "/auth/email");
      setSessionCookie(reply, result.sid);
      return { return_to: challenge.return_to ?? fallback, registered: result.registered };
    },
  );

  app.post<{ Body: { email: string; password: string; return_to?: string } }>(
    "/auth/email/password",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const wrong = () => reply.code(400).send({ error: "invalid_credentials", message: "邮箱或密码不对" });
      const email = normalizeEmail(req.body.email);
      if (!email) return wrong();
      // 按邮箱另计次数（15 分钟 10 次），在按 IP 的限流之外：换 IP 也不能对一个邮箱无限猜
      if (!throttle.take(email)) throw rateLimited();
      const record = identity.passwordFor(email);
      const matched = await bcrypt.compare(req.body.password, record?.hash ?? await dummy());
      if (!record?.hash || !matched) return wrong();
      const result = identity.signInWithPassword({ email, previousSid: req.cookies?.sid ?? null, ip: req.ip });
      if (!result.ok) {
        return result.reason === "account_disabled"
          ? reply.code(403).send({ error: "account_disabled", message: "这个极客班账号已停用" })
          : reply.code(403).send({ error: "not_member", message: "这个账号已经不是极客班成员" });
      }
      throttle.reset(email);
      setSessionCookie(reply, result.sid);
      return { return_to: safeReturnTo(req.body.return_to, config, fallback) };
    },
  );

  app.post<{ Body: { code: string; password: string } }>(
    "/auth/email/reset",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      // 先看新密码合不合规：不合规不碰验证码，免得白白用掉一次尝试
      const invalid = passwordError(req.body.password);
      if (invalid) {
        return reply.code(400).send({ error: invalid, message: invalid === "password_too_short" ? `密码至少 ${PASSWORD_MIN_LENGTH} 位` : "密码太长了（不能超过 72 个字节）" });
      }
      const checked = emailLogin.check(readChallengeCookie(req), req.body.code, "signin");
      if (!checked.ok) {
        return checked.error === "invalid_code"
          ? reply.code(400).send({ error: "invalid_code", message: `验证码不对，还可以试 ${checked.attemptsLeft} 次`, attempts_left: checked.attemptsLeft })
          : reply.code(400).send({ error: "code_expired", message: "验证码已失效，请重新获取" });
      }
      const { challenge } = checked;
      const hash = await hashPassword(req.body.password);
      const result = identity.resetPassword({
        email: challenge.email, hash, previousSid: req.cookies?.sid ?? null, ip: req.ip, claim: () => emailLogin.claim(challenge.id),
      });
      if (!result.ok) {
        switch (result.reason) {
          case "invite_required":
            return reply.code(400).send({ error: "no_account", message: "这个邮箱还没有极客班账号，切到「注册」用邀请码注册" });
          case "account_disabled":
            return reply.code(403).send({ error: "account_disabled", message: "这个极客班账号已停用" });
          case "not_member":
            return reply.code(403).send({ error: "not_member", message: "这个账号已经不是极客班成员" });
          default:
            return reply.code(400).send({ error: "code_expired", message: "验证码已失效，请重新获取" });
        }
      }
      // 新密码已经生效：这个邮箱之前猜错的次数清零
      throttle.reset(challenge.email);
      clearChallengeCookie(reply, "/auth/email");
      setSessionCookie(reply, result.sid);
      return { return_to: challenge.return_to ?? fallback };
    },
  );
}
