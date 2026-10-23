/**
 * 没有登录邮箱的账号要先绑一个（#273，所有者 2026-10-23 19:22：「之前只绑定了github账号没有绑定邮箱的再次进来或者登录的时候必须绑定邮箱」）。
 * GitHub、Google 登录回调、对外授权（GitLab）的交互和设备授权的确认在服务端拦；控制台、官网、论坛读 `/auth/me` 的
 * `email_required` 自己跳到绑定邮箱页。这个环境发不出信时不要求：收不到验证码就绑不上，不能把人关在门外。
 */
export const BIND_EMAIL_PATH = "/bind-email";

export function emailRequired(deps: { identity: { hasEmail(accountId: string): boolean }; mail: { sendingEnabled: boolean } }, accountId: string): boolean {
  return deps.mail.sendingEnabled && !deps.identity.hasEmail(accountId);
}

/** 绑定邮箱页的完整地址，绑好后回到 `back`（本站地址或路径）；`back` 已经是绑定邮箱页时原样返回，不套两层。 */
export function bindEmailUrl(publicOrigin: string, back: string): string {
  const target = new URL(back, publicOrigin);
  if (target.pathname === BIND_EMAIL_PATH) return target.toString();
  const url = new URL(BIND_EMAIL_PATH, publicOrigin);
  url.searchParams.set("return_to", `${target.pathname}${target.search}${target.hash}`);
  return url.toString();
}
