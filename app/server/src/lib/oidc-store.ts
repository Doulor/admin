import { randomBytes } from "node:crypto";
import type Database from "better-sqlite3";
import type { createCrypto } from "./crypto.js";

/**
 * 对外授权的存储（#270，ADR-0005 决策 3、8）：登记的下游应用、给下游的 `sub`、本人允许过的应用，以及 oidc-provider
 * 自己的授权码、令牌、交互与会话。只有这个模块读写 oauth_clients、oauth_subjects、oauth_grants 与 oidc_payloads。
 */
export type OidcClient = { client_id: string; name: string; redirect_uris: string[]; status: "active" | "disabled"; created_at: number; updated_at: number };
type ClientRow = { client_id: string; name: string; secret_encrypted: string; redirect_uris: string; status: "active" | "disabled"; created_at: number; updated_at: number };
type PayloadRow = { payload: string; expires_at: number | null; consumed_at: number | null };

/** oidc-provider 的存储接口（Adapter）。payload 是它自己的对象，这里只按 JSON 存取。 */
export type OidcAdapter = {
  upsert(id: string, payload: Record<string, unknown>, expiresIn?: number): Promise<void>;
  find(id: string): Promise<Record<string, unknown> | undefined>;
  findByUid(uid: string): Promise<Record<string, unknown> | undefined>;
  findByUserCode(userCode: string): Promise<Record<string, unknown> | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
};

/** 不指定时的 client id：`yzgc_` 加 20 位十六进制随机串；secret 是 32 字节随机数的 base64url（43 位）。 */
const newClientId = () => `yzgc_${randomBytes(10).toString("hex")}`;
const newSecret = () => randomBytes(32).toString("base64url");
/** 给下游的 `sub`：32 字节随机数的 base64url。与 users.id 无关，从 sub 推不出账号，也推不出别的应用里的 sub。 */
const newSubject = () => randomBytes(32).toString("base64url");

/** 过期的 oidc_payloads 最多每小时清一次，在写入时顺手做，不另开计时器。 */
const PAYLOAD_SWEEP_MS = 60 * 60 * 1000;

/**
 * 回调地址：只收 https（本机开发可以用 http://127.0.0.1 与 http://localhost），不带 # 片段；同一个应用的回调必须在同一个主机上，
 * 这个主机就是它的 sector——同一个 sector 的应用拿到同一个 `sub`。
 */
export function validateRedirectUris(uris: string[]): { ok: true; sector: string } | { ok: false; reason: string } {
  if (uris.length === 0) return { ok: false, reason: "at least one redirect URI is required" };
  const hosts = new Set<string>();
  for (const raw of uris) {
    let url: URL;
    try { url = new URL(raw); } catch { return { ok: false, reason: `not a URL: ${raw}` }; }
    const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) return { ok: false, reason: `redirect URI must use https: ${raw}` };
    if (url.hash || url.username || url.password) return { ok: false, reason: `redirect URI must not carry a fragment or credentials: ${raw}` };
    hosts.add(url.host);
  }
  if (hosts.size !== 1) return { ok: false, reason: "all redirect URIs of one client must share a host" };
  return { ok: true, sector: [...hosts][0] };
}

export function createOidcStore(db: Database.Database, crypto: ReturnType<typeof createCrypto>, clock: () => number = Date.now) {
  const selectClient = db.prepare("SELECT * FROM oauth_clients WHERE client_id = ?");
  const selectSubject = db.prepare("SELECT sub FROM oauth_subjects WHERE sector_id = ? AND user_id = ?");
  const insertSubject = db.prepare("INSERT OR IGNORE INTO oauth_subjects(sector_id, user_id, sub, created_at) VALUES(?, ?, ?, ?)");
  const selectAccountBySub = db.prepare("SELECT user_id FROM oauth_subjects WHERE sector_id = ? AND sub = ?");

  const toClient = (row: ClientRow): OidcClient => ({
    client_id: row.client_id, name: row.name, redirect_uris: JSON.parse(row.redirect_uris) as string[], status: row.status,
    created_at: row.created_at, updated_at: row.updated_at,
  });

  /** 登记一个下游应用，返回 client id 与 secret。secret 只在这里出现一次，之后只能轮换。 */
  function registerClient(input: { name: string; redirectUris: string[]; clientId?: string }): { client: OidcClient; clientSecret: string } {
    const checked = validateRedirectUris(input.redirectUris);
    if (!checked.ok) throw new Error(checked.reason);
    const name = input.name.trim();
    if (!name || name.length > 60) throw new Error("client name must be 1 to 60 characters");
    const clientId = input.clientId ?? newClientId();
    if (!/^[a-z0-9_]{3,64}$/.test(clientId)) throw new Error("client id must be 3 to 64 lowercase letters, digits or underscores");
    if (selectClient.get(clientId)) throw new Error(`client ${clientId} already exists`);
    const secret = newSecret();
    const now = clock();
    db.prepare("INSERT INTO oauth_clients(client_id, name, secret_encrypted, redirect_uris, status, created_at, updated_at) VALUES(?, ?, ?, ?, 'active', ?, ?)")
      .run(clientId, name, crypto.encrypt(secret), JSON.stringify(input.redirectUris), now, now);
    return { client: toClient(selectClient.get(clientId) as ClientRow), clientSecret: secret };
  }

  /** 换一个新 secret；旧的立即失效。 */
  function rotateSecret(clientId: string): string {
    const secret = newSecret();
    const changed = db.prepare("UPDATE oauth_clients SET secret_encrypted = ?, updated_at = ? WHERE client_id = ?").run(crypto.encrypt(secret), clock(), clientId).changes;
    if (!changed) throw new Error(`client ${clientId} not found`);
    return secret;
  }

  /** 停用或恢复一个应用：停用后它的授权请求和换令牌都失败，已发的令牌在 findClient 查不到时一并作废。 */
  function setClientStatus(clientId: string, status: "active" | "disabled"): void {
    const changed = db.prepare("UPDATE oauth_clients SET status = ?, updated_at = ? WHERE client_id = ?").run(status, clock(), clientId).changes;
    if (!changed) throw new Error(`client ${clientId} not found`);
  }

  /** 这个应用的 sector：回调地址的主机，和 oidc-provider 按 redirect_uris[0] 算出的一致；停用的照样算，没登记为 null。 */
  function sectorOf(clientId: string): string | null {
    const client = getClient(clientId);
    return client ? new URL(client.redirect_uris[0]).host : null;
  }

  function listClients(): OidcClient[] {
    return (db.prepare("SELECT * FROM oauth_clients ORDER BY created_at, client_id").all() as ClientRow[]).map(toClient);
  }

  function getClient(clientId: string): OidcClient | null {
    const row = selectClient.get(clientId) as ClientRow | undefined;
    return row ? toClient(row) : null;
  }

  /** oidc-provider 要的客户端元数据；停用的、secret 解不开的应用当作不存在。 */
  function clientMetadata(clientId: string): Record<string, unknown> | undefined {
    const row = selectClient.get(clientId) as ClientRow | undefined;
    if (!row || row.status !== "active") return undefined;
    let secret: string;
    try { secret = crypto.decrypt(row.secret_encrypted); } catch { return undefined; }
    return {
      client_id: row.client_id,
      client_name: row.name,
      client_secret: secret,
      redirect_uris: JSON.parse(row.redirect_uris) as string[],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_basic",
      subject_type: "pairwise",
    };
  }

  /**
   * 这个账号在这个 sector 的 `sub`：有就用，没有就生成一个存下（ADR-0005 决策 3）。两个请求同时生成时以先写进去的为准
   * （INSERT OR IGNORE 之后再读一次），所以同一个账号在同一个 sector 永远只有一个 `sub`。
   */
  function subjectFor(sectorId: string, accountId: string): string {
    const existing = selectSubject.get(sectorId, accountId) as { sub: string } | undefined;
    if (existing) return existing.sub;
    insertSubject.run(sectorId, accountId, newSubject(), clock());
    return (selectSubject.get(sectorId, accountId) as { sub: string }).sub;
  }

  /** 只读：这个账号在这个 sector 有没有 `sub`（有过就说明下游拿到过他的身份），没有时不生成。 */
  function existingSubject(sectorId: string, accountId: string): string | null {
    return (selectSubject.get(sectorId, accountId) as { sub: string } | undefined)?.sub ?? null;
  }

  /** 按 `sub` 反查账号（GitLab 同步对账用）；不是本 sector 的 sub 查不到。 */
  function accountForSubject(sectorId: string, sub: string): string | null {
    return (selectAccountBySub.get(sectorId, sub) as { user_id: string } | undefined)?.user_id ?? null;
  }

  /** 本人允许过的应用：记下 oidc-provider 的 grant id，下次登录同一个应用时直接用它。 */
  function rememberGrant(accountId: string, clientId: string, grantId: string): void {
    db.prepare(`INSERT INTO oauth_grants(user_id, client_id, grant_id, created_at) VALUES(?, ?, ?, ?)
      ON CONFLICT(user_id, client_id) DO UPDATE SET grant_id = excluded.grant_id, created_at = excluded.created_at`).run(accountId, clientId, grantId, clock());
  }

  function rememberedGrant(accountId: string, clientId: string): string | null {
    return (db.prepare("SELECT grant_id FROM oauth_grants WHERE user_id = ? AND client_id = ?").get(accountId, clientId) as { grant_id: string } | undefined)?.grant_id ?? null;
  }

  let lastSweep = 0;
  /** 删掉过期的 oidc_payloads；返回删掉的行数。 */
  function sweepExpired(): number {
    lastSweep = clock();
    return db.prepare("DELETE FROM oidc_payloads WHERE expires_at IS NOT NULL AND expires_at < ?").run(lastSweep).changes;
  }

  const findPayload = db.prepare("SELECT payload, expires_at, consumed_at FROM oidc_payloads WHERE model = ? AND id = ?");
  const unpack = (row: PayloadRow | undefined): Record<string, unknown> | undefined => {
    if (!row || (row.expires_at !== null && row.expires_at < clock())) return undefined;
    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    // 库里统一存毫秒；oidc-provider 认的 consumed 是秒
    return row.consumed_at === null ? payload : { ...payload, consumed: Math.floor(row.consumed_at / 1000) };
  };

  /** 给 oidc-provider 的存储：每种模型一个实例。`Client` 读 oauth_clients，其余都存在 oidc_payloads 里。 */
  function adapterFor(model: string): OidcAdapter {
    if (model === "Client") {
      return {
        async find(id) { return clientMetadata(id); },
        async upsert() { throw new Error("clients are registered with the server command, not over the API"); },
        async findByUid() { return undefined; },
        async findByUserCode() { return undefined; },
        async consume() {},
        async destroy() {},
        async revokeByGrantId() {},
      };
    }
    return {
      async upsert(id, payload, expiresIn) {
        const now = clock();
        if (now - lastSweep > PAYLOAD_SWEEP_MS) sweepExpired();
        const expiresAt = typeof expiresIn === "number" ? now + expiresIn * 1000 : null;
        db.prepare(`INSERT INTO oidc_payloads(model, id, payload, grant_id, uid, user_code, expires_at, consumed_at) VALUES(?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT(model, id) DO UPDATE SET payload = excluded.payload, grant_id = excluded.grant_id, uid = excluded.uid,
            user_code = excluded.user_code, expires_at = excluded.expires_at`)
          .run(model, id, JSON.stringify(payload), str(payload.grantId), str(payload.uid), str(payload.userCode), expiresAt);
      },
      async find(id) { return unpack(findPayload.get(model, id) as PayloadRow | undefined); },
      async findByUid(uid) {
        return unpack(db.prepare("SELECT payload, expires_at, consumed_at FROM oidc_payloads WHERE model = ? AND uid = ?").get(model, uid) as PayloadRow | undefined);
      },
      async findByUserCode(userCode) {
        return unpack(db.prepare("SELECT payload, expires_at, consumed_at FROM oidc_payloads WHERE model = ? AND user_code = ?").get(model, userCode) as PayloadRow | undefined);
      },
      async consume(id) { db.prepare("UPDATE oidc_payloads SET consumed_at = ? WHERE model = ? AND id = ?").run(clock(), model, id); },
      async destroy(id) { db.prepare("DELETE FROM oidc_payloads WHERE model = ? AND id = ?").run(model, id); },
      // 一次授权（grant）下发的授权码、令牌一起作废：授权码重放、撤销授权时 oidc-provider 对每种模型各调一次，授权本身另外删
      async revokeByGrantId(grantId) { db.prepare("DELETE FROM oidc_payloads WHERE model = ? AND grant_id = ?").run(model, grantId); },
    };
  }

  return {
    registerClient, rotateSecret, setClientStatus, listClients, getClient, sectorOf, clientMetadata,
    subjectFor, existingSubject, accountForSubject, rememberGrant, rememberedGrant, sweepExpired, adapterFor,
  };
}
export type OidcStore = ReturnType<typeof createOidcStore>;

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
