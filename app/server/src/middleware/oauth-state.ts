import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";

export type OAuthState = {
  state: string;
  kind: "admin" | "forum-login" | "forum-bind" | "google-signin" | "google-link";
  returnTo: string;
  issuedAt: number;
  userId?: number;
  sessionHash?: string;
  /** 绑定 Google（#291，kind 为 google-link）：发起绑定的账号；sessionHash 是发起绑定的那个会话 */
  accountId?: string;
  /** Google（#262）：ID Token 里要带回的 nonce、PKCE 的 code_verifier，以及第一次登录建号用的邀请码 */
  nonce?: string;
  verifier?: string;
  invite?: string;
};
export type OAuthCookie = "oauth_state" | "forum_oauth_state" | "google_oauth_state";
/** 每种 cookie 只收自己的 kind，换着用（拿 GitHub 的 state 去 Google 回调）一律无效。 */
const COOKIE_KINDS: Record<OAuthCookie, OAuthState["kind"][]> = {
  oauth_state: ["admin"],
  forum_oauth_state: ["forum-login", "forum-bind"],
  google_oauth_state: ["google-signin", "google-link"],
};
const cookiePath = (name: OAuthCookie) => name === "google_oauth_state" ? "/auth/google" : "/auth";
const TTL_MS = 10 * 60_000;

export const sessionFingerprint = (sid: string) => createHash("sha256").update(sid).digest("hex");

export function setOAuthState(reply: FastifyReply, config: AppConfig, name: OAuthCookie, state: Omit<OAuthState, "issuedAt">) {
  reply.setCookie(name, JSON.stringify({ ...state, issuedAt: Date.now() }), {
    signed: true, httpOnly: true, secure: config.cookieSecure, sameSite: "lax",
    path: cookiePath(name), domain: config.cookieDomain, maxAge: TTL_MS / 1000,
  });
}

/** Cookie integrity and server-checked expiry; GitHub still owns code single-use. */
export function readOAuthState(req: FastifyRequest, reply: FastifyReply, name: OAuthCookie, expected: string): OAuthState | null {
  reply.clearCookie(name, { path: cookiePath(name), domain: req.server.services.config.cookieDomain });
  const raw = req.cookies?.[name];
  if (!raw || raw.length > 8192) return null;
  const signed = req.unsignCookie(raw);
  if (!signed.valid || !signed.value) return null;
  try {
    const value = JSON.parse(signed.value) as OAuthState;
    if (!value || value.state !== expected || typeof value.returnTo !== "string" ||
      !Number.isFinite(value.issuedAt) || value.issuedAt > Date.now() || Date.now() - value.issuedAt > TTL_MS) return null;
    if (!COOKIE_KINDS[name].includes(value.kind)) return null;
    if ((value.kind === "google-signin" || value.kind === "google-link") && (typeof value.nonce !== "string" || typeof value.verifier !== "string")) return null;
    if (value.kind === "google-link" && (typeof value.accountId !== "string" || typeof value.sessionHash !== "string")) return null;
    if (value.kind === "forum-bind" && (!Number.isSafeInteger(value.userId) || typeof value.sessionHash !== "string")) return null;
    return value;
  } catch { return null; }
}

export function setForumSessionCookie(reply: FastifyReply, config: AppConfig, sid: string) {
  reply.setCookie("forum_sid", sid, {
    httpOnly: true, secure: config.cookieSecure, sameSite: "lax", path: "/",
    maxAge: 14 * 24 * 60 * 60, domain: config.cookieDomain,
  });
}
