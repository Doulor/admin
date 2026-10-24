import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { gateRefusal, gateRefusalBody } from "../lib/email-gate.js";

/**
 * geek 命令行的令牌鉴权（#277）：从 `Authorization: Bearer` 头取设备令牌，查 `device_grants`
 * （lib/device-store.ts 的 `authenticate()`），通过后把账号「挂」成 `req.session`——和 cookie 会话
 * 完全同一个形状，requireAuth/requirePermission/forumViewer 等既有中间件都靠 `loadSession()` 的
 * `if (req.session) return true` 直接复用，不用为命令行另写一套鉴权判定。
 * 必须在 `@fastify/cookie` 注册之后挂这个钩子（见 app.ts）：下面要读 `req.cookies` 判断「同一个请求
 * 不能同时带 cookie 和 Bearer」。
 */

/**
 * 粗按 URL 前缀把业务接口分组到 DEVICE_CLIENTS 登记的 scope：只是把令牌限制在它申请过的分类里，
 * 节点级的权限判定仍然交给 requirePermission/requireWriter，这里不重复判断业务规则。
 */
const SCOPE_BY_PREFIX: ReadonlyArray<{ prefix: string; scope: string }> = [
  { prefix: "/api/forum/", scope: "forum" },
  { prefix: "/api/teams/", scope: "apply" },
  { prefix: "/api/competitions/", scope: "competition" },
  { prefix: "/api/me/competitions", scope: "competition" },
  { prefix: "/api/public/gitlab/", scope: "repo" },
];

function pathOf(url: string): string {
  return url.split(/[?#]/)[0];
}

function scopeFor(path: string): string | null {
  return SCOPE_BY_PREFIX.find(entry => path.startsWith(entry.prefix))?.scope ?? null;
}

/** 身份接口本身：令牌用来登录、登出，不是「业务」，不挡邮箱闸、也不要求 scope。 */
const GATE_EXEMPT_PATHS = new Set(["/auth/device/userinfo", "/auth/device/revoke"]);

/**
 * 不属于哪个 scope、命令行也要读的接口，只放 GET/HEAD：公开接口（`geek comp list` 读
 * `/api/public/competitions`），和 `geek whoami` 取昵称、部门的 `/api/console/me`（不含真实姓名）。
 */
const OPEN_READ_PREFIXES = ["/api/public/"];
const OPEN_READ_PATHS = new Set(["/api/console/me"]);

/**
 * 令牌默认什么都不能用，只认上面列出的接口。其余的（控制台、账号页的改密码和绑邮箱、`/auth/me`、OIDC）
 * 一律 403：令牌放在终端和 agent 的环境变量里，泄露的面比浏览器会话大，不能拿它改账号或做管理操作；
 * `/auth/me`、`/api/identity/*` 还会回本人的真实姓名，命令行拿不到真实姓名（#277）。
 */
function cliMayUse(method: string, path: string): boolean {
  if (GATE_EXEMPT_PATHS.has(path) || scopeFor(path)) return true;
  if (method !== "GET" && method !== "HEAD") return false;
  return OPEN_READ_PATHS.has(path) || OPEN_READ_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * 没有登录邮箱、缺姓名或年级的账号不能用业务接口（#273、#280 的同一条规则，命令行这边单独过一遍，因为
 * 浏览器那边靠前端读 `/auth/me` 的 `email_required`/`profile_required` 自己跳转，命令行没有浏览器会话
 * 可以读）；email-gate.ts 的 `gateRefusal()` 先判邮箱、再判姓名和年级，这里直接按它的结论回对应的错误体。
 */
export function cliGate(app: FastifyInstance, accountId: string): { error: string; message: string } | null {
  const refusal = gateRefusal(app.services, accountId);
  return refusal ? gateRefusalBody(refusal, "使用命令行") : null;
}

export function registerBearerAuth(app: FastifyInstance) {
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return;
    // 同一个请求不能既带 cookie 又带 Bearer：两种身份混在一起容易把 CSRF 防护（cookie 会话的 Origin 规则）
    // 和令牌的权限边界搞混，宁可拒绝也不要猜该信哪一个。
    if (req.cookies?.sid) {
      return reply.code(400).send({ error: "mixed_credentials", message: "一个请求不能同时带 cookie 和 Bearer 令牌" });
    }
    const identity = app.services.device.authenticate(token);
    if (!identity) return; // 令牌无效或已过期：交给下游 requireAuth/requirePermission 按未登录处理，和 cookie 失效时一样
    req.session = {
      id: `cli:${identity.accountId}`,
      account_id: identity.accountId,
      // provider 字段只有控制台「我的身份」(/api/console/me) 读过；账号真实的登录方式（GitHub/Google/邮箱）
      // 与命令行无关，这里按多数账号的情况给个兜底值，不强行查一遍。
      provider: "github",
      login: identity.login,
      user_id: identity.userId,
      avatar_url: identity.avatarUrl,
      accessToken: "",
      // 不是一次登录：created_at 记 0，加上 require-step-up.ts、account.ts 对 via=cli 的判断，
      // 命令行请求永远不算「刚登录过」，过不了任何 step-up。
      created_at: 0,
      expires_at: Date.now(),
    };
    req.via = "cli";
    const path = pathOf(req.url);
    if (!cliMayUse(req.method, path)) {
      return reply.code(403).send({ error: "cli_not_allowed", message: "命令行令牌不能用这个接口，请到网页上操作" });
    }
    if (GATE_EXEMPT_PATHS.has(path)) return;
    const refusal = cliGate(app, identity.accountId);
    if (refusal) return reply.code(403).send(refusal);
    const scope = scopeFor(path);
    if (scope && !identity.scope.split(" ").includes(scope)) {
      return reply.code(403).send({ error: "insufficient_scope", message: `这个令牌没有「${scope}」范围，请重新 geek login 申请`, scope });
    }
  });
  /**
   * 「控制台的操作记录能看到这次命令行调用了哪个接口」（#277）：成功的请求各个路由不一定自己调
   * recordActivity（大多数只读接口本来就不记），这里统一补一条 `cli.<method>`，和路由自己记的那条
   * （如果有）一起留在表里，不是互相替代——按 request_id 能对上是不是同一次请求。403/429 已经由
   * middleware/http-policy.ts 的 recordDenialOrLimit 记过，这里不重复记。
   */
  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.via !== "cli" || reply.statusCode >= 400) return;
    app.services.activity.recordActivity(req, {
      action: `cli.${req.method.toLowerCase()}`, surface: "cli", target_type: "route", target_id: pathOf(req.url), outcome: "ok",
    });
  });
}
