import type { FastifyInstance } from "fastify";

const CACHE_KEY = "public:departments";
const CACHE_TTL_MS = 60_000;

type DepartmentRow = { id: string; name: string; tone: string | null; icon: string | null; description: string };
type TitleRow = { id: string; name: string; weight: number; department_id: string };

/**
 * 公开的部门与称号列表（#274 CONTRACT §1）：给门户「组织架构」窗口用（#275 接入），6 个新部门
 * （AI/算法/硬件/网安/管理/无部门），按 perm_groups.sort 升序排列，正好是「无部门」排在最后。
 * 不含任何人、不含权限包，和 /api/public/org（旧的称号/部门体系）并存，#275 切换数据源之后旧的再退场。
 */
export default async function portalDepartmentsRoutes(app: FastifyInstance) {
  const { storage, cache } = app.services;
  const db = storage.db;
  app.get("/api/public/departments", async () => cache.cached(CACHE_KEY, CACHE_TTL_MS, async () => {
    const departments = db.prepare(
      "SELECT id, name, tone, icon, description FROM perm_groups WHERE kind = 'department' ORDER BY sort ASC",
    ).all() as DepartmentRow[];
    const titles = db.prepare(
      "SELECT id, name, weight, department_id FROM perm_groups WHERE kind = 'title' AND department_id IS NOT NULL ORDER BY weight ASC",
    ).all() as TitleRow[];
    return {
      departments: departments.map(dept => ({
        id: dept.id, name: dept.name, tone: dept.tone, icon: dept.icon, description: dept.description,
        titles: titles.filter(title => title.department_id === dept.id).map(({ id, name, weight }) => ({ id, name, weight })),
      })),
    };
  }));
}
