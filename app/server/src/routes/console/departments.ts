import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";

/**
 * 部门是固定清单（SPEC §1），不再支持控制台里新建/改名/归档/删除；这里只留只读列表给需要部门人数的页面用。
 * 旧的新建/编辑/归档/删除写路由随这次 #274 权限切换一起删除（见执行记录），旧表与旧数据不受影响。
 */
export default async function consoleDepartmentRoutes(app: FastifyInstance) {
  const { roles } = app.services;
  app.addHook("preHandler", requireAuth);

  app.get("/api/console/departments", { preHandler: requirePermission("console.access") }, async () => {
    const counts = roles.crewCounts();
    const departments = roles.listDepartments().map(department => ({
      ...department, heads: counts.get(department.id)?.heads ?? [], crew_count: counts.get(department.id)?.crew ?? 0,
    }));
    return { departments };
  });
}
