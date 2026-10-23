import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { emailRequired } from "../../lib/email-gate.js";
import { entriesForAccount } from "../../lib/permissions.js";
import { departmentScopedAccess } from "../../lib/console-scope.js";
import { beijingDayStart } from "../../lib/beijing-time.js";

const LEVEL_NAME: Record<string, string> = { visitor: "访客", registered: "注册用户", member: "极客班成员", alumni: "往届成员" };
/** 没有全站 allow、只有部门范围 allow 的节点也要算「有」：#274 的 permissions 字段给前端判断导航显隐用，
 * 部长看不到全站数据，但应该看到「用户」「操作记录」这些导航项（范围由各接口自己再收窄）。 */
const SCOPE_AWARE_NODES = ["users.view", "apply.view", "apply.review", "activity.read", "dept.manage"];

/**
 * 控制台身份与概览（CONTRACT-274 §5、§7）：按新权限节点体系重写，取代旧的站内角色/能力形状。
 * 旧控制台前端（site_role、capabilities、head_of、github 字段）随这次改动一起下线，由新控制台
 * （权限节点驱动的 permissions 数组）接手，两边不再共存——旧形状没有调用方了（人工审查确认：
 * 旧的 people/departments/titles/assignments/catalogue/audit 路由已删，是唯一读过旧形状的地方）。
 */
export default async function consoleMeRoutes(app: FastifyInstance) {
  const { permissions, profiles, storage } = app.services;
  const db = storage.db;
  app.addHook("preHandler", requireAuth);

  app.get("/api/console/me", async (req) => {
    const accountId = req.session!.account_id;
    const profile = profiles.get(accountId);
    const row = db.prepare(`
      SELECT lvl.suffix AS level, dept.id AS department_id, dept.name AS department_name, dept.tone AS department_tone
      FROM users u
      LEFT JOIN (SELECT pm.account_id, SUBSTR(pg.id, 7) AS suffix FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pg.kind = 'level') lvl ON lvl.account_id = u.id
      LEFT JOIN (SELECT pm.account_id, pg.id, pg.name, pg.tone FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pg.kind = 'department') dept ON dept.account_id = u.id
      WHERE u.id = ?
    `).get(accountId) as { level: string | null; department_id: string | null; department_name: string | null; department_tone: string | null } | undefined;
    const level = row?.level ?? "registered";
    const titles = (db.prepare(
      "SELECT pg.id AS id, pg.name AS name, pg.department_id AS department_id FROM perm_members pm JOIN perm_groups pg ON pg.id = pm.group_id WHERE pg.kind = 'title' AND pm.account_id = ?",
    ).all(accountId) as { id: string; name: string; department_id: string | null }[]);

    const effective = permissions.effective(accountId);
    const entries = entriesForAccount(db, accountId, Date.now());
    const extra = SCOPE_AWARE_NODES.filter(node => !effective.allow.includes(node) && departmentScopedAccess(entries, node).kind === "scoped");

    return {
      account_id: accountId, login: req.session!.login, username: profile.username, display_name: profile.display_name,
      avatar_url: profile.avatar_url, level, level_name: LEVEL_NAME[level] ?? level,
      department: row?.department_id ? { id: row.department_id, name: row.department_name, tone: row.department_tone } : null,
      titles, permissions: [...effective.allow, ...extra],
      provider: req.session!.provider, email_required: emailRequired(app.services, accountId),
    };
  });

  /** 概览（CONTRACT-274 §7）：去掉所有 GitHub 字段，只回调用者有权看的键；candidates_pending 在 #278 落地前固定回 0。 */
  app.get("/api/console/summary", async (req) => {
    const accountId = req.session!.account_id;
    const check = (node: string) => permissions.check(accountId, node);
    const result: Record<string, unknown> = {};

    if (check("apply.view")) {
      const DAY_MS = 24 * 60 * 60 * 1000;
      const rows = db.prepare("SELECT status, COUNT(*) AS n FROM applications GROUP BY status").all() as { status: string; n: number }[];
      const byStatus: Record<string, number> = {};
      for (const row of rows) byStatus[row.status] = row.n;
      const lastWeek = db.prepare("SELECT COUNT(*) AS n FROM applications WHERE created_at >= ?").get(Date.now() - 7 * DAY_MS) as { n: number };
      result.applications = { total: rows.reduce((sum, row) => sum + row.n, 0), by_status: byStatus, last_7d: lastWeek.n };
    }
    if (check("competition.score.review")) result.candidates_pending = 0; // #278 之前先固定回 0
    const todayStart = beijingDayStart(Date.now());
    if (check("users.view")) {
      const registrations = db.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?").get(todayStart) as { n: number };
      result.registrations_today = registrations.n;
    }
    if (check("activity.read")) {
      const blocked = db.prepare("SELECT COUNT(*) AS n FROM activity_events WHERE outcome = 'limited' AND at >= ?").get(todayStart) as { n: number };
      result.blocked_today = blocked.n;
    }
    if (check("gitlab.view")) {
      const { healthy } = await app.services.gitlab.health();
      result.gitlab = { mode: app.services.gitlab.mode, healthy, last_run: app.services.gitlab.lastRun() };
    }
    if (check("feedback.view")) result.feedback = app.services.feedback.countFeedback(app.services.config.consoleOrg);
    return result;
  });
}
