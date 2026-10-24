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
 * GitHub 登录本身（换码、取 /user、取邮箱）是 lib/auth.ts 直接发的 HTTP 请求，只从这里取超时；Google 登录同样。
 * #274 删掉 GitHub 组织管理（CONTRACT-274 §8）后，组织角色、成员、邀请的查询都没有调用方了，这个文件从
 * lib/github.ts 改名过来，只剩超时工具和 `octokitWith` 工厂（ServiceOverrides.octokitFactory 这个测试覆盖点仍在用）。
 */
export function createGithub(factory: (token: string) => Octokit = token => new Octokit({ auth: token, userAgent: "yzgc-admin", request: { fetch: withTimeout(fetch, GITHUB_TIMEOUT_MS) } })) {
  return { octokitWith: factory };
}
