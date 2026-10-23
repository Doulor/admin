import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability, resolveAccess } from "../../middleware/require-capability.js";
import { APPLICATION_STATUS_IDS, orderedCapabilities } from "../../lib/roles.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function consoleMeRoutes(app: FastifyInstance) {
  const { config, roles, feedback, githubConnection } = app.services;
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  /**
   * 当前用户在极客班控制台的身份：站内角色、称号与能力。只需要登录。
   * 权限只认极客班账号（#262 第四期）：不论用哪种方式登录（`provider`），能力都按站内角色和称号给。
   * `github`：控制台的 GitHub 页面这次经什么接 GitHub——服务器的 GitHub App（app）、你自己的 GitHub 会话（session），
   * 或还没接上（none，这时那些页面打不开，按钮也不用点）。
   */
  app.get("/api/console/me", async (req) => {
    const access = await resolveAccess(req);
    return {
      login: req.session!.login, avatar_url: req.session!.avatar_url, org: config.consoleOrg,
      provider: req.session!.provider,
      site_role: access.siteRole,
      github: githubConnection.via(req.session),
      title: access.titles[0], titles: access.titles,
      capabilities: orderedCapabilities(access.capabilities),
      head_of: access.headOf,
    };
  });

  /** 概览统计：只返回调用者有权限看的键。 */
  app.get("/api/console/summary", { preHandler: requireCapability("console.access") }, async (req) => {
    const access = req.access!;
    const result: Record<string, unknown> = {};
    if (access.capabilities.has("applications.read")) {
      const rows = db.prepare("SELECT status, COUNT(*) AS n FROM applications GROUP BY status").all() as { status: string; n: number }[];
      const byStatus: Record<string, number> = Object.fromEntries(APPLICATION_STATUS_IDS.map(id => [id, 0]));
      for (const row of rows) byStatus[row.status] = row.n;
      const lastWeek = db.prepare("SELECT COUNT(*) AS n FROM applications WHERE created_at >= ?").get(Date.now() - 7 * DAY_MS) as { n: number };
      result.applications = { total: rows.reduce((sum, row) => sum + row.n, 0), by_status: byStatus, last_7d: lastWeek.n };
    }
    if (access.capabilities.has("feedback.read")) result.feedback = feedback.countFeedback(config.consoleOrg);
    if (access.capabilities.has("roles.manage") || access.capabilities.has("roles.department.manage")) {
      result.people = { assignments: roles.countAssignments(), departments: roles.listDepartments().filter(item => !item.archived).length };
    }
    return result;
  });
}
