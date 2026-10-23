import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability } from "../../middleware/require-capability.js";

type AuditRow = { id: number; actor: string; action: string; target: string | null; details: string | null; ip: string | null; created_at: number };

/**
 * 邀请链接 token 是「持有即可用」的凭据：`POST /api/join/:token` 会经服务器接入的 GitHub 发出组织邀请。
 * `audit.read` 可以放进任何部门权限包，不等于 `github.invites.manage`，所以这里只下发前几位用于对照，
 * 否则持有审计能力的人就能拿到完整 token，凭它发组织邀请。
 * 旧 `/api/admin/:org/logs` 另要 `github.invites.manage`，那些人本来就能列出邀请链接，不在此处理。
 */
const TOKEN_PREVIEW_LENGTH = 6;
const maskToken = (token: string) => `${token.slice(0, TOKEN_PREVIEW_LENGTH)}…`;
function redactAuditRow<T extends Pick<AuditRow, "actor" | "action" | "target">>(row: T): T {
  // invite_link.create / toggle / delete：target 是链接 token。
  const target = row.action.startsWith("invite_link.") && row.target ? maskToken(row.target) : row.target;
  // invite.sent / invite.failed：操作者记作 public:<token>。
  const actor = row.action.startsWith("invite.") && row.actor.startsWith("public:") ? `public:${maskToken(row.actor.slice("public:".length))}` : row.actor;
  return { ...row, actor, target };
}

/** 审计日志：只查 org = CONSOLE_ORG 的行；action 按前缀匹配；邀请链接 token 只下发前几位。 */
export default async function consoleAuditRoutes(app: FastifyInstance) {
  const { config } = app.services;
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  app.get<{ Querystring: { limit?: string; offset?: string; action?: string } }>(
    "/api/console/audit",
    { preHandler: requireCapability("audit.read") },
    async (req) => {
      const limit = Number(req.query.limit ?? 100);
      const offset = Number(req.query.offset ?? 0);
      const params: unknown[] = [config.consoleOrg];
      let sql = "SELECT id, actor, action, target, details, ip, created_at FROM audit_logs WHERE org = ?";
      if (req.query.action) {
        sql += " AND action LIKE ? ESCAPE '\\'";
        params.push(`${req.query.action.replace(/[\\%_]/g, match => `\\${match}`)}%`);
      }
      sql += " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
      const rows = db.prepare(sql).all(...params, limit, offset) as AuditRow[];
      return { logs: rows.map(row => ({ ...redactAuditRow(row), details: row.details ? JSON.parse(row.details) : null })) };
    },
  );
}
