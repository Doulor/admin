import { Octokit } from "@octokit/rest";

/** GitHub 调用一律 15 秒超时：卡住时尽快失败（登录回到原页面、接口报错），而不是挂到 undici 默认的 300 秒。 */
export const GITHUB_TIMEOUT_MS = 15_000;

/** Octokit 当前版本不读 request.timeout，超时只能套在它用的 fetch 上；调用方自己的 signal 照样生效。 */
export function withTimeout(base: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    return base(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
  };
}

/**
 * #274 review round 1（CONTRACT-274 §8）：GitHub 登录本身（换码、取 /user）不经这里，是 lib/auth.ts 自己
 * 直接发的 HTTP 请求，不用 Octokit。这个模块原来是给服务器接入的 GitHub App（lib/github-connection.ts，已删）
 * 和 `/api/join/:token` 的组织邀请链接（routes/portal/join.ts，组织那部分已删）查组织角色、查成员、查用户用的，
 * 这几个查询现在没有任何调用方了（access.ts 不再查 GitHub 组织角色，见 lib/access.ts 的改动说明），一并删掉。
 * 保留 `octokitWith` 这一个工厂：ServiceOverrides.octokitFactory 这个测试覆盖点还有大量既有测试在用
 * （`testApp({ octokitFactory })`），不在本轮复核范围内逐一核对、挪走。
 */
export function createGithub(factory: (token: string) => Octokit = token => new Octokit({ auth: token, userAgent: "yzgc-admin", request: { fetch: withTimeout(fetch, GITHUB_TIMEOUT_MS) } })) {
  return { octokitWith: factory };
}
