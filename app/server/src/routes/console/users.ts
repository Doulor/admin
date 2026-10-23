import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { requireScopedPermission } from "../../lib/console-scope.js";

const PAGE_SIZE = 50;

type Cursor = { created_at: number; id: string };
function encodeCursor(cursor: Cursor): string { return Buffer.from(JSON.stringify(cursor)).toString("base64url"); }
function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof parsed?.created_at === "number" && typeof parsed?.id === "string" ? parsed : null;
  } catch { return null; }
}

type GitlabRow = { gitlab_user_id: number; state: string; last_error: string | null };
function gitlabView(row: GitlabRow | undefined) {
  if (!row) return { state: "none" as const, gitlab_user_id: null };
  if (row.last_error) return { state: "failed" as const, gitlab_user_id: row.gitlab_user_id };
  return { state: (row.state === "active" ? "synced" : row.state) as "synced" | "pending" | "blocked", gitlab_user_id: row.gitlab_user_id };
}

/**
 * 用户列表与改身份（CONTRACT-274 §5）：按新权限体系的 level/department/title 分组渲染，替代旧的
 * `/api/console/people`（旧接口暂时保留给旧控制台前端用，不在这次改动删除，见执行记录里的范围说明）。
 */
export default async function consoleUsersRoutes(app: FastifyInstance) {
  const { permissions, storage } = app.services;
  const db = storage.db;

  app.get("/api/console/users", { preHandler: requireScopedPermission("users.view") }, async (req) => {
    const { q, level, department, status, cursor: cursorParam } = req.query as { q?: string; level?: string; department?: string; status?: string; cursor?: string };
    const cursor = decodeCursor(cursorParam);
    const conditions: string[] = ["u.status <> 'merged'"];
    const params: unknown[] = [];
    if (q) { conditions.push("(p.username LIKE ? OR p.display_name LIKE ? OR g.login LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (status) { conditions.push("u.status = ?"); params.push(status); }
    if (level) { conditions.push("lvl.suffix = ?"); params.push(level); }
    // 部门过滤：dept.none 和「没有任何部门成员资格」算同一回事——dept.none 本身只是迁移给旧「队长」兜底用的占位组。
    const effectiveDepartments = req.departmentScope ?? (department ? [department] : null);
    if (effectiveDepartments) {
      const placeholders = effectiveDepartments.map(() => "?").join(",");
      if (effectiveDepartments.includes("dept.none")) conditions.push(`(dept.id IN (${placeholders}) OR dept.id IS NULL)`);
      else conditions.push(`dept.id IN (${placeholders})`);
      params.push(...effectiveDepartments);
    }
    if (cursor) { conditions.push("(u.created_at > ? OR (u.created_at = ? AND u.id > ?))"); params.push(cursor.created_at, cursor.created_at, cursor.id); }

    const rows = db.prepare(`
      SELECT u.id AS account_id, u.status AS status, u.created_at AS created_at,
        p.username AS username, p.display_name AS display_name, p.avatar_hash AS avatar_hash,
        g.login AS github_login,
        (SELECT group_concat(i.provider) FROM identities i WHERE i.user_id = u.id) AS providers,
        (SELECT MAX(i.last_login_at) FROM identities i WHERE i.user_id = u.id) AS last_login_at,
        lvl.suffix AS level, dept.id AS department_id, dept.name AS department_name, dept.tone AS department_tone,
        ga.gitlab_user_id AS gitlab_user_id, ga.state AS gitlab_state, ga.last_error AS gitlab_last_error
      FROM users u
      LEFT JOIN account_profiles p ON p.account_id = u.id
      LEFT JOIN identities g ON g.user_id = u.id AND g.provider = 'github'
      LEFT JOIN (SELECT pm.account_id, SUBSTR(pg.id, 7) AS suffix FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pg.kind = 'level') lvl ON lvl.account_id = u.id
      LEFT JOIN (SELECT pm.account_id, pg.id, pg.name, pg.tone FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pg.kind = 'department') dept ON dept.account_id = u.id
      LEFT JOIN gitlab_accounts ga ON ga.account_id = u.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY u.created_at ASC, u.id ASC
      LIMIT ?
    `).all(...params, PAGE_SIZE + 1) as {
      account_id: string; status: "active" | "disabled"; created_at: number; username: string | null; display_name: string | null; avatar_hash: string | null;
      github_login: string | null; providers: string | null; last_login_at: number | null; level: string | null;
      department_id: string | null; department_name: string | null; department_tone: string | null;
      gitlab_user_id: number | null; gitlab_state: string | null; gitlab_last_error: string | null;
    }[];

    const page = rows.slice(0, PAGE_SIZE);
    const accountIds = page.map(row => row.account_id);
    const titlesByAccount = new Map<string, { id: string; name: string; department_id: string | null }[]>();
    if (accountIds.length) {
      const placeholders = accountIds.map(() => "?").join(",");
      for (const row of db.prepare(`
        SELECT pm.account_id AS account_id, pg.id AS id, pg.name AS name, pg.department_id AS department_id
        FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id
        WHERE pg.kind = 'title' AND pm.account_id IN (${placeholders})
      `).all(...accountIds) as { account_id: string; id: string; name: string; department_id: string | null }[]) {
        const list = titlesByAccount.get(row.account_id);
        const title = { id: row.id, name: row.name, department_id: row.department_id };
        if (list) list.push(title); else titlesByAccount.set(row.account_id, [title]);
      }
    }

    const items = page.map(row => ({
      account_id: row.account_id, username: row.username, display_name: row.display_name,
      avatar_url: row.avatar_hash ? `/api/identity/avatar/${row.avatar_hash}.webp` : null,
      status: row.status, level: row.level ?? "registered",
      department: row.department_id ? { id: row.department_id, name: row.department_name, tone: row.department_tone } : null,
      titles: titlesByAccount.get(row.account_id) ?? [],
      providers: (row.providers ? row.providers.split(",") : []) as ("email" | "google" | "github")[],
      gitlab: gitlabView(row.gitlab_user_id !== null ? { gitlab_user_id: row.gitlab_user_id, state: row.gitlab_state!, last_error: row.gitlab_last_error } : undefined),
      last_login_at: row.last_login_at, created_at: row.created_at,
    }));
    const nextCursor = rows.length > PAGE_SIZE ? encodeCursor({ created_at: page[page.length - 1]!.created_at, id: page[page.length - 1]!.account_id }) : null;

    const levelCounts = db.prepare(`
      SELECT SUBSTR(pg.id, 7) AS level, COUNT(*) AS n FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id
      WHERE pg.kind = 'level' GROUP BY pg.id
    `).all() as { level: string; n: number }[];
    const counts = { visitor_today: 0, registered: 0, member: 0, alumni: 0 };
    for (const row of levelCounts) if (row.level in counts) (counts as Record<string, number>)[row.level] = row.n;

    return { items, next_cursor: nextCursor, counts };
  });

  app.patch<{ Params: { id: string }; Body: { status?: "active" | "disabled"; level?: "registered" | "member" | "alumni"; department?: string | null; titles?: string[] } }>(
    "/api/console/users/:id",
    { preHandler: [requirePermission("users.manage"), requireStepUp] },
    async (req, reply) => {
      const { id } = req.params;
      const { status, level, department, titles } = req.body;
      if (status !== undefined && !req.server.services.permissions.check(req.session!.account_id, "users.disable")) {
        return reply.code(403).send({ error: "forbidden", node: "users.disable", message: "需要「users.disable」权限" });
      }
      const account = db.prepare("SELECT id, status FROM users WHERE id = ? AND status <> 'merged'").get(id) as { id: string; status: string } | undefined;
      if (!account) return reply.code(404).send({ error: "not_found", message: "没有这个账号" });

      const currentlyOwner = !!db.prepare("SELECT 1 FROM perm_members WHERE group_id = 'title.site.owner' AND account_id = ?").get(id);
      const ownerCount = (db.prepare("SELECT COUNT(*) AS n FROM perm_members WHERE group_id = 'title.site.owner'").get() as { n: number }).n;
      const losingOwnership = currentlyOwner && (status === "disabled" || (titles !== undefined && !titles.includes("title.site.owner")));
      if (losingOwnership && ownerCount <= 1) {
        return reply.code(409).send({ error: "last_owner", message: "至少要留一位站长" });
      }

      if (department !== undefined && department !== null && !db.prepare("SELECT 1 FROM perm_groups WHERE id = ? AND kind = 'department'").get(department)) {
        return reply.code(400).send({ error: "invalid_department", message: "部门不存在" });
      }
      if (titles !== undefined) {
        for (const titleId of titles) {
          if (!db.prepare("SELECT 1 FROM perm_groups WHERE id = ? AND kind = 'title'").get(titleId)) {
            return reply.code(400).send({ error: "invalid_title", message: `称号不存在：${titleId}` });
          }
        }
      }

      // SPEC §3.7「写入前后的 JSON 都放进 meta」：这个接口改的是 level/department/titles，和权限组 CRUD 一样
      // 影响权限，改动前先拍一份快照，事务跑完再拍一份，两份都放进操作记录。
      const snapshot = () => ({
        status: (db.prepare("SELECT status FROM users WHERE id = ?").get(id) as { status: string } | undefined)?.status ?? null,
        level: (db.prepare("SELECT pg.id AS id FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pm.account_id = ? AND pg.kind = 'level'").get(id) as { id: string } | undefined)?.id ?? null,
        department: (db.prepare("SELECT pg.id AS id FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pm.account_id = ? AND pg.kind = 'department'").get(id) as { id: string } | undefined)?.id ?? null,
        titles: (db.prepare("SELECT pg.id AS id FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pm.account_id = ? AND pg.kind = 'title' ORDER BY pg.id").all(id) as { id: string }[]).map(row => row.id),
      });
      const before = snapshot();
      const now = Date.now();
      db.transaction(() => {
        if (status !== undefined) db.prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);
        if (level !== undefined) {
          db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'level')").run(id);
          db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, NULL, ?, ?)")
            .run(id, `level.${level}`, req.session!.login, now);
        }
        const finalDepartment = department !== undefined ? department : (db.prepare(
          "SELECT pg.id AS id FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pm.account_id = ? AND pg.kind = 'department'",
        ).get(id) as { id: string } | undefined)?.id ?? null;
        if (department !== undefined) {
          db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'department')").run(id);
          if (department !== null) db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, NULL, ?, ?)").run(id, department, req.session!.login, now);
        }
        if (titles !== undefined) {
          db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'title')").run(id);
          const insertTitle = db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, NULL, ?, ?)");
          for (const titleId of titles) insertTitle.run(id, titleId, req.session!.login, now);
        } else if (department !== undefined) {
          // 部门变了，没有同时给新的称号列表：不属于新部门的称号自动去掉（CONTRACT-274 §5）；站长等无部门称号不受影响。
          const dropStmt = finalDepartment
            ? db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'title' AND department_id IS NOT NULL AND department_id <> ?)")
            : db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = 'title' AND department_id IS NOT NULL)");
          if (finalDepartment) dropStmt.run(id, finalDepartment); else dropStmt.run(id);
        }
      })();
      permissions.bump();
      storage.audit(null, req.session!, "users.update", id, { fields: Object.keys(req.body) }, req.ip);
      app.services.activity.recordActivity(req, { action: "users.update", surface: "console", target_type: "user", target_id: id, outcome: "ok", meta: { before, after: snapshot() } });
      return { account_id: id };
    },
  );
}
