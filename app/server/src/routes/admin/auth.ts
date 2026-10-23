import { safeReturnTo, signinFailureUrl, type SigninOutcome } from "../../lib/safe-return.js";
import { bindEmailUrl, emailRequired } from "../../lib/email-gate.js";
import { normalizeInviteCode } from "../../lib/invite-codes.js";
import { applyQuota } from "../../lib/apply-quota.js";
import { registrationGuardFor } from "../../lib/register-limits.js";
import { UI_NODES } from "../../lib/permission-nodes.js";
import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { readOAuthState, setOAuthState } from "../../middleware/oauth-state.js";
import { clearSessionCookies, endRejectedSession, isRejectedToken, setSessionCookie } from "../../middleware/require-auth.js";
import { attachVisitorId } from "../../middleware/visitor.js";

export default async function authRoutes(app: FastifyInstance) {
  const { buildAuthorizeUrl,
  destroySession,
  exchangeCode,
  fetchAuthenticatedUser,
  getSession,
  revokeGrant, } = app.services.auth;
  const { audit } = app.services.storage;
  const { config, identity } = app.services;
  /** 被拒的 GitHub 登录尽力撤销这次授权：服务端不存他的 token，也不该让这份授权一直挂在他的账号里。 */
  const revoke = (req: FastifyRequest, token: string) => revokeGrant(token).catch((cause: { code?: string; status?: number }) => {
    req.log.warn({ code: cause?.code, status: cause?.status, requestId: req.id }, "github grant revoke failed");
  });

  /**
   * 换 token、查用户。#274：不再查 GitHub 组织资格——组织那道门已经去掉（SPEC §3.2），邀请码和邮箱、Google 一样选填。
   * 只在真的要新建账号这一步，同一 IP 今天已建满 5 个、同一设备已建满 3 个（lib/register-limits.ts）回
   * `registration_limited`，登录到已有账号不受影响（#274 残留修复，SPEC §3.8）。
   */
  async function signInWithGitHub(code: string) {
    const token = await exchangeCode(code);
    const user = await fetchAuthenticatedUser(token);
    return { token, user };
  }
  app.get<{ Querystring: { return_to?: string; invite?: string } }>("/auth/github", async (req, reply) => {
    const state = randomBytes(16).toString("base64url");
    const returnTo = safeReturnTo(req.query.return_to, config, `${config.publicOrigin}/console`);
    const invite = normalizeInviteCode(req.query.invite) ?? undefined;
    setOAuthState(reply, config, "oauth_state", { state, kind: "admin", returnTo, ...(invite ? { invite } : {}) });
    return reply.redirect(buildAuthorizeUrl(state));
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/auth/callback",
    async (req, reply) => {
      const { code, state, error } = req.query;
      if (!state || (!code && !error)) return reply.code(400).send({ error: "missing_params" });
      if (state.startsWith("forum-")) return reply.code(410).send({ error: "legacy_forum_retired" });
      const flow = readOAuthState(req, reply, "oauth_state", state);
      if (!flow) {
        return reply.code(400).send({ error: "invalid_state" });
      }
      // 从这里起不停在接口的错误页：成功就带着 sid 回到 return_to，没成功回到统一登录页并带上原因与原来的 return_to。
      const back = safeReturnTo(flow.returnTo, config, `${config.publicOrigin}/console`);
      const fail = (outcome: SigninOutcome) => reply.redirect(signinFailureUrl(config.publicOrigin, back, outcome));
      if (error || !code) return fail(error === "access_denied" ? "cancelled" : "failed");
      const result = await signInWithGitHub(code).catch((cause: { code?: string; status?: number }) => {
        req.log.error({ code: cause?.code, status: cause?.status, requestId: req.id }, "github sign-in failed");
        return null;
      });
      if (!result) return fail("failed");
      const { token, user } = result;
      const account = { id: user.id, login: user.login, avatarUrl: user.avatar_url || null };
      // 外部请求到此做完；建号（邀请码选填）、认领、插入会话、删旧会话、审计在一个事务里（lib/identity-store.ts），失败整体回滚。
      let signin;
      try {
        await attachVisitorId(req, reply);
        const registrationLimit = registrationGuardFor(app.services.limits, req.ip, req.visitorId!);
        signin = identity.signInWithGithub({ github: account, accessToken: token, invite: flow.invite ?? null, previousSid: req.cookies?.sid ?? null, ip: req.ip, registrationLimit });
      } catch (cause) {
        req.log.error({ code: (cause as { code?: string })?.code ?? "signin_transaction_failed", requestId: req.id }, "sign-in transaction failed");
        return fail("failed");
      }
      if (!signin.ok) {
        await revoke(req, token);
        app.services.activity.recordActivity(req, { action: "auth.signin_denied", surface: "portal", outcome: "denied", meta: { provider: "github", reason: signin.reason } });
        return fail(signin.reason);
      }
      setSessionCookie(reply, signin.sid);
      app.services.activity.recordActivity(req, {
        action: signin.registered ? "auth.register" : "auth.signin", surface: "portal", outcome: "ok",
        meta: { provider: "github" }, account_id: signin.accountId,
      });
      // 账号还没有登录邮箱（#273）：先到绑定邮箱页，绑好再回 return_to
      return reply.redirect(emailRequired(app.services, signin.accountId) ? bindEmailUrl(config.publicOrigin, back) : back);
    }
  );

  app.post("/auth/signout", async (req, reply) => {
    const sid = req.cookies?.sid;
    if (sid) {
      const s = getSession(sid);
      destroySession(sid);
      if (s) {
        audit(null, { login: s.login, account_id: s.account_id }, "auth.signout", undefined, undefined, req.ip);
        identity.recordSignout(s.account_id, s.provider);
        app.services.activity.recordActivity(req, { action: "auth.signout", surface: "portal", outcome: "ok", account_id: s.account_id });
      }
    }
    clearSessionCookies(reply);
    return { ok: true };
  });

  /**
   * `console_link`：官网与论坛的头像菜单是否显示「控制台」，按新权限引擎的 `console.access` 节点直接判定
   * （#274 起取代旧的 `access.resolve()` 返回的 capabilities 读法——`role_assignments` 迁移后不再有写入，
   * 继续读会让刚靠 perm_groups 拿到控制台权限的人一直看不到入口）。这只决定显不显示入口，控制台的准入仍按
   * 权限节点判定。`access.resolve()` 仍然要调用一次：老账号（#262 之前就用 GitHub 登录、从没记过站内角色的）
   * 第一次来时靠它补查一次 GitHub 组织角色并同步进新权限表（lib/access.ts 的 membership.unrecorded 分支），
   * 只是不再用它返回的 capabilities——GitHub 拒绝了令牌时这里仍然要结束会话（#164），和取 consoleLink 无关。
   * `email_required`（#273）：账号还没有登录邮箱、这个环境又能发信，官网、论坛、控制台读到 true 就跳到绑定邮箱页。
   *
   * #274 CONTRACT-274 §1：没登录也回 200（不是 401），当「访客」给出一致的身份摘要——`level`/`level_name`、
   * `permissions`（UI_NODES 挨个判一遍，通配符已经展开成具体节点的布尔值）、`quota`（目前只有投递每日额度）。
   * 登录了在旧字段基础上再加 `level`/`level_name`/`department`/`titles`（lib/permissions.ts 的 groupsOf）、
   * `permissions`/`quota`、账号资料的 `prefs`/`username`/`display_name`/`bio`，以及打码邮箱的 `identities`
   * （identity.accountView 已经按 lib/email-login.ts 的 maskEmail 处理过，这里不重复脱敏）。
   */
  function visitorIdentity() {
    const { permissions, limits } = app.services;
    const groups = permissions.groupsOf(null);
    return {
      level: groups.level, level_name: groups.level_name,
      permissions: Object.fromEntries(UI_NODES.map(node => [node, permissions.check(null, node)])),
      quota: applyQuota({ permissions, limits }, null, Date.now()),
    };
  }
  app.get("/auth/me", async (req, reply) => {
    const sid = req.cookies?.sid;
    if (!sid) return { signed_in: false, ...visitorIdentity() };
    const s = getSession(sid);
    if (!s) return { signed_in: false, ...visitorIdentity() };
    const sessionRejected = await app.services.access.resolve({ login: s.login, userId: s.user_id, accountId: s.account_id, accessToken: s.accessToken, provider: s.provider })
      .then(() => false)
      .catch((cause: { code?: string; status?: number }) => {
        if (isRejectedToken(cause)) return true;
        req.log.warn({ code: cause?.code, status: cause?.status, requestId: req.id }, "unrecorded org role backfill failed");
        return false;
      });
    if (sessionRejected) {
      endRejectedSession(req, reply, s);
      return { signed_in: false, session_expired: true, ...visitorIdentity() };
    }
    const { permissions, limits, profiles, identity } = app.services;
    const consoleLink = permissions.check(s.account_id, "console.access");
    const groups = permissions.groupsOf(s.account_id);
    const profile = profiles.get(s.account_id);
    // account_id：极客班账号（官网、论坛、控制台读到的是同一个值）；provider：这次的登录方式。user_id 仍是 GitHub 数字 id。
    return {
      signed_in: true, login: s.login, user_id: s.user_id, avatar_url: s.avatar_url, account_id: s.account_id, provider: s.provider, console_link: consoleLink,
      email_required: emailRequired(app.services, s.account_id),
      level: groups.level, level_name: groups.level_name, department: groups.department, titles: groups.titles,
      permissions: Object.fromEntries(UI_NODES.map(node => [node, permissions.check(s.account_id, node)])),
      quota: applyQuota({ permissions, limits }, s.account_id, Date.now()),
      prefs: profile.prefs, username: profile.username, display_name: profile.display_name, bio: profile.bio,
      identities: identity.accountView(s.account_id).identities,
    };
  });
}
