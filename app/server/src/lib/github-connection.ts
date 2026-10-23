import { createSign, type KeyObject } from "node:crypto";
import type { Octokit } from "@octokit/rest";
import { GITHUB_TIMEOUT_MS, withTimeout } from "./github.js";
import type { IdentityProvider } from "./identity-store.js";

/**
 * 服务器接入的 GitHub（#262 第四期，所有者 2026-10-23：「有关 GitHub 的权限是要放权的」「后续我们可能不仅仅只连 GitHub 了」）。
 * 控制台的 GitHub 组织页面由服务器去读写 CONSOLE_ORG，谁能做什么只看站内称号（requireCapability）：
 * - 配了 GitHub App（GH_APP_ID + GH_APP_PRIVATE_KEY）：用 App 装在组织上的安装令牌，GitHub 那边看到的是这个 App；
 * - 没配 App、这次是 GitHub 会话：退回用本人的 GitHub 令牌，GitHub 再按他自己的权限限制一层；
 * - 都没有：回 409 `github_not_connected`（邮箱、Google 会话在没配 App 时就是这样）。
 * 以后接自建 GitLab 时照这个形状另写一个接入，称号判定不变。
 */
export type GithubAppConfig = { appId: string; privateKey: KeyObject };
export type GithubVia = "app" | "session";
/** 路由用到的 Octokit 子集：request 与 paginate。 */
export type GithubClient = Pick<Octokit, "request" | "paginate"> & { via: GithubVia };
type SessionLike = { provider: IdentityProvider; accessToken: string };
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const API = "https://api.github.com";
/** 安装令牌一小时有效，剩不到 5 分钟就换新的。 */
const REFRESH_MARGIN_MS = 5 * 60_000;

export class GithubNotConnected extends Error {
  readonly statusCode = 409;
  readonly code = "github_not_connected";
  constructor() { super("GitHub 还没接上：服务器还没配 GitHub App，这次也不是用 GitHub 登录的"); }
}
/** App 本身出了问题（私钥不对、没装到组织上、令牌被拒）：503，不当成用户的会话失效，不结束会话。 */
export class GithubConnectionFailed extends Error {
  readonly statusCode = 503;
  readonly code = "github_connection_failed";
  constructor(readonly upstreamStatus: number | null) { super("GitHub App 暂时用不了，请联系管理员检查 App 的配置"); }
}

const base64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

/** App 的 JWT（RS256，iat 往前拨 60 秒容忍时钟误差，9 分钟后过期，GitHub 要求不超过 10 分钟）。 */
export function appJwt(app: GithubAppConfig, nowMs: number): string {
  const now = Math.floor(nowMs / 1000);
  const head = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: app.appId }))}`;
  return `${head}.${base64url(createSign("RSA-SHA256").update(head).sign(app.privateKey))}`;
}

export function createGithubConnection(deps: {
  app: GithubAppConfig | null; org: string; octokitWith: (token: string) => Octokit; fetch?: FetchLike; clock?: () => number;
}) {
  const clock = deps.clock ?? Date.now;
  const http: FetchLike = deps.fetch ?? withTimeout(fetch, GITHUB_TIMEOUT_MS) as FetchLike;
  let installationId: number | null = null;
  let cached: { token: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  async function call<T>(path: string, init: RequestInit & { jwt: string }): Promise<T> {
    const response = await http(`${API}${path}`, {
      ...init,
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${init.jwt}`, "user-agent": "yzgc-admin", "x-github-api-version": "2022-11-28" },
    }).catch(() => { throw new GithubConnectionFailed(null); });
    if (!response.ok) throw new GithubConnectionFailed(response.status);
    return await response.json() as T;
  }

  async function mint(app: GithubAppConfig): Promise<string> {
    const jwt = appJwt(app, clock());
    try {
      installationId ??= (await call<{ id: number }>(`/orgs/${encodeURIComponent(deps.org)}/installation`, { method: "GET", jwt })).id;
      const issued = await call<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, { method: "POST", jwt });
      const expiresAt = Date.parse(issued.expires_at);
      cached = { token: issued.token, expiresAt: Number.isFinite(expiresAt) ? expiresAt : clock() + 60 * 60_000 };
      return issued.token;
    } catch (error) {
      // App 重装后安装 id 会变：换不到令牌就连安装 id 一起重新查
      installationId = null;
      throw error;
    }
  }

  /** 安装令牌：有缓存且还够用就直接给；同时来的请求共用一次换取。 */
  async function appToken(): Promise<string> {
    const app = deps.app;
    if (!app) throw new GithubNotConnected();
    if (cached && cached.expiresAt - clock() > REFRESH_MARGIN_MS) return cached.token;
    pending ??= mint(app).finally(() => { pending = null; });
    return pending;
  }

  /**
   * App 令牌被拒（401）说明令牌或 App 出了问题：丢掉这个令牌和安装 id，回 503，不让错误处理器把它当成用户会话失效。
   * 只丢这次用的令牌：慢回来的 401 不能把别的请求刚换好的新令牌也丢掉。
   */
  function guard(octokit: Octokit, token: string): GithubClient {
    const mapped = (error: unknown): never => {
      const status = (error as { status?: unknown })?.status;
      if (status === 401) {
        if (cached?.token === token) { cached = null; installationId = null; }
        throw new GithubConnectionFailed(401);
      }
      throw error;
    };
    return {
      via: "app",
      request: ((...args: Parameters<Octokit["request"]>) => octokit.request(...args).catch(mapped)) as Octokit["request"],
      paginate: ((...args: Parameters<Octokit["paginate"]>) => (octokit.paginate as (...a: unknown[]) => Promise<unknown>)(...args).catch(mapped)) as unknown as Octokit["paginate"],
    };
  }

  /** 这次请求用哪种方式接 GitHub：app、session（本人令牌），或 none。 */
  function via(session: SessionLike | null | undefined): GithubVia | "none" {
    if (deps.app) return "app";
    return session?.provider === "github" && session.accessToken ? "session" : "none";
  }

  /** 给路由的 GitHub 客户端；接不上时抛 GithubNotConnected（409）。 */
  async function clientFor(session: SessionLike | null | undefined): Promise<GithubClient> {
    const mode = via(session);
    if (mode === "app") {
      const token = await appToken();
      return guard(deps.octokitWith(token), token);
    }
    if (mode === "session") return Object.assign(deps.octokitWith(session!.accessToken), { via: "session" as const });
    throw new GithubNotConnected();
  }

  return { configured: deps.app !== null, via, clientFor, appToken };
}
export type GithubConnection = ReturnType<typeof createGithubConnection>;
