import { safeMailLink, type EnvelopeMessage } from "./envelope.js";

/**
 * 登录与绑定邮箱的验证码信（#262）：只有验证码、有效期、只能用一次和「不是你本人操作请忽略」，正文**不放登录或确认链接**（页脚照常有站点地址）——
 * 邮箱的安全扫描会预先打开链接，带链接的验证信也容易被仿冒。版式和转义由 renderEnvelope 负责。
 */
export type LoginCodePurpose = "signin" | "link";

export function loginCodeMessage(input: { code: string; purpose: LoginCodePurpose; minutes: number; siteOrigin: string; sentAt: number }): EnvelopeMessage {
  const verb = input.purpose === "link" ? "绑定" : "登录";
  return {
    subject: `你的极客班${verb}验证码`,
    preheader: `验证码 ${input.code}，${input.minutes} 分钟内有效。`,
    kicker: `极客班统一登录 · ${verb}`,
    greeting: "你好：",
    blocks: [
      { kind: "paragraph", text: `你正在${verb}极客班账号，验证码是：` },
      { kind: "facts", items: [{ label: "验证码", value: input.code, mono: true }] },
      { kind: "paragraph", text: `${input.minutes} 分钟内有效，只能用一次。` },
      { kind: "paragraph", text: "如果这不是你本人的操作，忽略这封邮件就好，你的账号不会有任何变化。" },
    ],
    signedAt: input.sentAt,
    footer: ["这封邮件由极客班统一登录自动发出，请不要回复。"],
    siteUrl: new URL("/", safeMailLink(input.siteOrigin)).href,
  };
}
