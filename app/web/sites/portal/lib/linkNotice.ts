// 绑定登录方式（资料窗口里 Google 的「绑定」，#291）走完 Google 授权后回到官网，地址上带 `link=<结果>&provider=google`
// （服务端 lib/safe-return.ts 的 linkResultUrl）。这里把它写成资料窗口里的一句话；不认识的值当没有。
export type LinkNotice = { tone: "ok" | "error"; text: string };

const NOTICES: Readonly<Record<string, LinkNotice>> = {
  linked: { tone: "ok", text: "已绑定 Google，以后可以直接用它登录这个账号。" },
  conflict: { tone: "error", text: "这个 Google 账号已经绑在别的极客班账号上，没有绑到你现在的账号。" },
  exists: { tone: "error", text: "你的账号已经绑定了 Google。" },
  cancelled: { tone: "error", text: "你取消了 Google 授权，没有绑定。" },
  failed: { tone: "error", text: "Google 授权没有完成，没有绑定。再点一次「绑定」试试。" },
};

export function linkNoticeOf(link: string | null, provider: string | null): LinkNotice | null {
  return provider === "google" && link !== null && Object.prototype.hasOwnProperty.call(NOTICES, link) ? NOTICES[link] : null;
}
