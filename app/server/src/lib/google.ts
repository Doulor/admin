import { createHash, createPublicKey, verify as verifySignature, type JsonWebKey, type KeyObject } from "node:crypto";
import { request as defaultRequest } from "undici";
import { GITHUB_TIMEOUT_MS } from "./github-http.js";

/**
 * Google 登录（#262，ADR-0005「Google 登录」）：OIDC 授权码 + PKCE S256 + state + nonce，只申请 `openid email profile`。
 * ID Token 用 Google 的 JWKS 验签（Node 自带的 crypto，不加依赖），再核对 iss、aud、exp、iat、nonce。
 * 不保存 Google 的 access token 与 ID Token。没配 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 时 `enabled` 为假，入口不出现。
 */
export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
/** iat 最多比本机时间晚 5 分钟（两边时钟有偏差） */
const CLOCK_SKEW_MS = 5 * 60_000;
const DEFAULT_KEYS_TTL_MS = 3600_000;

export type GoogleClaims = { sub: string; email: string | null };
export class GoogleError extends Error {
  constructor(readonly code: "google_exchange_failed" | "google_keys_failed" | "id_token_invalid", message: string) { super(message); this.name = "GoogleError"; }
}

const b64url = (value: Buffer) => value.toString("base64url");
/** PKCE：code_challenge = BASE64URL(SHA256(code_verifier)) */
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

function decodeSegment(segment: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* 落到下面 */ }
  throw new GoogleError("id_token_invalid", "malformed token");
}

export function createGoogle(
  config: { clientId: string; clientSecret: string } | null,
  publicOrigin: string,
  undiciRequest = defaultRequest,
  clock: () => number = Date.now,
) {
  const redirectUri = `${publicOrigin}/auth/google/callback`;
  let keys: { byKid: Map<string, KeyObject>; expiresAt: number } | null = null;

  function authorizeUrl(input: { state: string; nonce: string; verifier: string }): string {
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.searchParams.set("client_id", config!.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", input.state);
    url.searchParams.set("nonce", input.nonce);
    url.searchParams.set("code_challenge", pkceChallenge(input.verifier));
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  /** 用授权码和 code_verifier 换 ID Token。失败只带 Google 的错误枚举，不带说明文字。 */
  async function exchange(code: string, verifier: string): Promise<string> {
    const res = await undiciRequest(GOOGLE_TOKEN_URL, {
      method: "POST",
      headersTimeout: GITHUB_TIMEOUT_MS, bodyTimeout: GITHUB_TIMEOUT_MS,
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri,
        client_id: config!.clientId, client_secret: config!.clientSecret,
      }).toString(),
    });
    const body = (await res.body.json()) as { id_token?: unknown; error?: unknown };
    if (typeof body.id_token !== "string") {
      throw Object.assign(new GoogleError("google_exchange_failed", "token exchange failed"), { status: res.statusCode, upstream: typeof body.error === "string" ? body.error.slice(0, 64) : undefined });
    }
    return body.id_token;
  }

  /** Google 的公钥：按 kid 缓存，遵守 Cache-Control 的 max-age；`force` 时不看缓存重取（遇到不认识的 kid 时重取一次）。 */
  async function signingKeys(force: boolean): Promise<Map<string, KeyObject>> {
    if (!force && keys && keys.expiresAt > clock()) return keys.byKid;
    const res = await undiciRequest(GOOGLE_JWKS_URL, { headersTimeout: GITHUB_TIMEOUT_MS, bodyTimeout: GITHUB_TIMEOUT_MS, headers: { Accept: "application/json" } });
    if (res.statusCode !== 200) {
      await res.body?.dump?.();
      throw new GoogleError("google_keys_failed", `jwks ${res.statusCode}`);
    }
    const body = (await res.body.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
    const byKid = new Map<string, KeyObject>();
    for (const jwk of body.keys ?? []) {
      if (typeof jwk.kid !== "string" || jwk.kty !== "RSA") continue;
      try { byKid.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" })); } catch { /* 坏掉的一把跳过 */ }
    }
    const maxAge = /max-age=(\d+)/i.exec(String(res.headers?.["cache-control"] ?? ""))?.[1];
    keys = { byKid, expiresAt: clock() + (maxAge ? Number(maxAge) * 1000 : DEFAULT_KEYS_TTL_MS) };
    return byKid;
  }

  /** 验签并核对声明；通过返回 sub 和（email_verified 为真时的）邮箱，不通过抛 id_token_invalid。 */
  async function verifyIdToken(token: string, nonce: string): Promise<GoogleClaims> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new GoogleError("id_token_invalid", "malformed token");
    const header = decodeSegment(parts[0]);
    const payload = decodeSegment(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw new GoogleError("id_token_invalid", "unexpected algorithm");
    let key = (await signingKeys(false)).get(header.kid);
    if (!key) key = (await signingKeys(true)).get(header.kid);
    if (!key) throw new GoogleError("id_token_invalid", "unknown key");
    const signed = verifySignature("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
    if (!signed) throw new GoogleError("id_token_invalid", "bad signature");
    const now = clock();
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!ISSUERS.has(String(payload.iss))) throw new GoogleError("id_token_invalid", "issuer");
    if (!audience.includes(config!.clientId)) throw new GoogleError("id_token_invalid", "audience");
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) throw new GoogleError("id_token_invalid", "expired");
    if (typeof payload.iat !== "number" || payload.iat * 1000 > now + CLOCK_SKEW_MS) throw new GoogleError("id_token_invalid", "issued in the future");
    if (payload.nonce !== nonce) throw new GoogleError("id_token_invalid", "nonce");
    if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 255) throw new GoogleError("id_token_invalid", "subject");
    const email = payload.email_verified === true && typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
    return { sub: payload.sub, email };
  }

  return { enabled: config !== null, redirectUri, authorizeUrl, exchange, verifyIdToken };
}
export type GoogleClient = ReturnType<typeof createGoogle>;
