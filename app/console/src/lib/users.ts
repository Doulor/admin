// 「用户」页（SPEC §3.9）：筛选条件、详情抽屉里的编辑稿和 PATCH /api/console/users/:id 的请求体。纯函数，tests/console 直接测。
import { isSelectableGrade } from "./grade";
import type { ConsoleUser, DepartmentRef, Level, PublicDepartment, SelectableGrade, UserPatch } from "./types";

/** 站长：唯一不属于任何部门的称号（SPEC §3.4 `title.site.owner`），在抽屉里单独一项。 */
export const SITE_OWNER_TITLE = { id: "title.site.owner", name: "站长" } as const;
/** 无部门（SPEC §3.4 `dept.none`）：账号没分部门时隐含属于它，接口里写 null。 */
export const NO_DEPARTMENT = "dept.none";

/** 这个人的部门；接口给 null 或 dept.none 都算没有部门。 */
export const departmentOf = (user: { department: DepartmentRef | null }): DepartmentRef | null =>
  user.department && user.department.id !== NO_DEPARTMENT ? user.department : null;

export type AssignableLevel = Exclude<Level, "visitor">;
/**
 * 抽屉里正在改的样子：部门用 dept.none 表示无部门，称号是本部门里的一个（空串是没有称号），站长另算。
 * 真实姓名和年级（#280）：姓名留空表示不改；年级空串表示不改（已毕业或没填时下拉框里没有对应的项）。
 */
export type UserDraft = { level: AssignableLevel; department: string; title: string; owner: boolean; real_name: string; grade: SelectableGrade | "" };

export function draftFromUser(user: ConsoleUser): UserDraft {
  const department = departmentOf(user)?.id ?? NO_DEPARTMENT;
  const title = user.titles.find(item => item.id !== SITE_OWNER_TITLE.id && item.department_id === department)?.id ?? "";
  return {
    level: user.level === "visitor" ? "registered" : user.level,
    department, title,
    owner: user.titles.some(item => item.id === SITE_OWNER_TITLE.id),
    real_name: user.real_name ?? "",
    grade: isSelectableGrade(user.grade) ? user.grade : "",
  };
}

/** 部门单选：接口顺序就是 AI、算法、硬件、网安、管理、无部门；接口没给无部门时补在最后。 */
export function departmentChoices(departments: PublicDepartment[]): { value: string; label: string; tone: PublicDepartment["tone"] }[] {
  const list = departments.map(item => ({ value: item.id, label: item.name, tone: item.tone }));
  if (!list.some(item => item.value === NO_DEPARTMENT)) list.push({ value: NO_DEPARTMENT, label: "无部门", tone: "ink" });
  return list;
}

/** 称号单选：只列这个部门的称号，按权重从高到低（部长、副部长、部员），最后是「没有称号」。 */
export function titleChoices(department: PublicDepartment | undefined): { value: string; label: string }[] {
  if (!department || department.id === NO_DEPARTMENT) return [];
  const titles = [...department.titles].sort((a, b) => b.weight - a.weight).map(item => ({ value: item.id, label: item.name }));
  return [...titles, { value: "", label: "没有称号" }];
}

/** 换部门时原来的称号不再属于新部门，清掉；服务端也会这样做（CONTRACT §5）。 */
export function withDepartment(draft: UserDraft, department: string): UserDraft {
  return department === draft.department ? draft : { ...draft, department, title: "" };
}

const titlesOf = (draft: UserDraft) => [...(draft.title ? [draft.title] : []), ...(draft.owner ? [SITE_OWNER_TITLE.id] : [])];

/** 只带改了的字段；什么都没改回 null，页面不发请求。 */
export function userPatch(user: ConsoleUser, draft: UserDraft): UserPatch | null {
  const patch: UserPatch = {};
  if (draft.level !== user.level) patch.level = draft.level;
  const before = departmentOf(user)?.id ?? NO_DEPARTMENT;
  if (draft.department !== before) patch.department = draft.department === NO_DEPARTMENT ? null : draft.department;
  const current = new Set(user.titles.map(item => item.id));
  const next = titlesOf(draft);
  if (next.length !== current.size || next.some(id => !current.has(id))) patch.titles = next;
  // 看不到真实姓名（没有这个键）时不改；姓名清空不算修改
  const realName = draft.real_name.trim();
  if (user.real_name !== undefined && realName && realName !== (user.real_name ?? "")) patch.real_name = realName;
  if (isSelectableGrade(draft.grade) && draft.grade !== user.grade) patch.grade = draft.grade;
  return Object.keys(patch).length ? patch : null;
}

/** 列表筛选，来自地址参数；不认识的值当作没填。 */
export type UserFilters = { q: string; level: string; department: string; status: string };
const LEVEL_VALUES = ["registered", "member", "alumni"];
const STATUS_VALUES = ["active", "disabled"];
export function userFiltersFromQuery(query: Record<string, unknown>): UserFilters {
  const pick = (key: string) => (typeof query[key] === "string" ? (query[key] as string).trim() : "");
  const level = pick("level");
  const status = pick("status");
  return {
    q: pick("q"),
    level: LEVEL_VALUES.includes(level) ? level : "",
    department: /^dept\.[a-z0-9_]+$/.test(pick("department")) ? pick("department") : "",
    status: STATUS_VALUES.includes(status) ? status : "",
  };
}

/** GET /api/console/users 的查询串。 */
export function usersParams(filters: UserFilters, cursor: string | null = null): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["q", "level", "department", "status"] as const) if (filters[key]) params.set(key, filters[key]);
  if (cursor) params.set("cursor", cursor);
  return params;
}

/** 名单上显示的名字：昵称，没有就用户名。 */
export const nameOf = (user: { display_name: string; username: string }): string => user.display_name.trim() || user.username;

/** 页头和导航里只放一个称号：站长优先，其次接口给的第一个。 */
export const primaryTitle = <T extends { id: string }>(titles: T[]): T | null =>
  titles.find(item => item.id === SITE_OWNER_TITLE.id) ?? titles[0] ?? null;

/** 称号徽章的色调：站长固定 pill 色（SPEC §1），部门里的称号用部门色，其余（没有部门信息时）交给徽章自己的默认色。 */
export const titleTone = (title: { id?: string; department_id: string | null }, department: DepartmentRef | null): DepartmentRef["tone"] | null => {
  if (title.id === SITE_OWNER_TITLE.id) return "pill";
  return title.department_id && department && department.id === title.department_id ? department.tone : null;
};
