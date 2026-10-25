import type { FastifyInstance } from "fastify";

/**
 * 本站启用的登录方式（#262）：统一登录页按顺序渲染，前端不写死任何渠道。GitHub 恒在；邮箱在配了发信商时出现，
 * Google 在配了 GOOGLE_CLIENT_ID 与 GOOGLE_CLIENT_SECRET 时出现。三种都能建号（`can_register`）：GitHub 要是组织成员，
 * 邮箱和 Google 第一次登录要填邀请码（所有者 2026-10-23）。邮箱另有密码登录的地址（`password`）。
 */
export type LoginProvider = {
  id: "github" | "google" | "email";
  name: string;
  kind: "redirect" | "email_code";
  /** redirect：整页跳转地址，前端追加 `return_to`；email_code：发验证码的接口 */
  start: string;
  can_register: boolean;
  /** 只有邮箱：邮箱加密码登录的接口 */
  password?: string;
};

export const GITHUB_PROVIDER: LoginProvider = { id: "github", name: "GitHub", kind: "redirect", start: "/auth/github", can_register: true };

export const GOOGLE_PROVIDER: LoginProvider = { id: "google", name: "Google", kind: "redirect", start: "/auth/google", can_register: true };
export const EMAIL_PROVIDER: LoginProvider = { id: "email", name: "邮箱", kind: "email_code", start: "/auth/email/start", can_register: true, password: "/auth/email/password" };

export function loginProviders({ mailEnabled, googleEnabled }: { mailEnabled: boolean; googleEnabled: boolean }): LoginProvider[] {
  return [GITHUB_PROVIDER, ...(googleEnabled ? [GOOGLE_PROVIDER] : []), ...(mailEnabled ? [EMAIL_PROVIDER] : [])];
}

export default async function providerRoutes(app: FastifyInstance) {
  const { mail, google } = app.services;
  app.get("/auth/providers", async () => ({ providers: loginProviders({ mailEnabled: mail.sendingEnabled, googleEnabled: google.enabled }) }));
}
