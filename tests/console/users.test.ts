// 「用户」页的纯函数（lib/users）和开发预览的名单（mock/console），不挂载组件。
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NO_DEPARTMENT, SITE_OWNER_TITLE, departmentChoices, departmentOf, draftFromUser, nameOf, primaryTitle, titleChoices, titleTone, userFiltersFromQuery,
  userPatch, usersParams, withDepartment,
} from "../../app/console/src/lib/users";
import { MOCK_DEPARTMENTS, MOCK_USERS, routeConsole } from "../../app/console/src/mock/console";
import type { UsersResponse } from "../../app/console/src/lib/types";

afterEach(() => vi.unstubAllGlobals());
const as = (persona: string) => vi.stubGlobal("window", { location: { search: `?__persona=${persona}` } });
const user = (username: string) => MOCK_USERS.find(item => item.username === username)!;
const list = (query = "") => routeConsole(new URL(`/api/console/users${query}`, "http://mock.local")) as UsersResponse;

describe("user drawer draft", () => {
  it("reads level, department, the department title and the site owner flag apart", () => {
    expect(draftFromUser(user("li_xiaoman"))).toEqual({ level: "member", department: "dept.ai", title: "title.ai.head", owner: false, real_name: "李晓曼", grade: 2 });
    expect(draftFromUser(user("xu_yan"))).toEqual({ level: "member", department: NO_DEPARTMENT, title: "", owner: true, real_name: "徐言", grade: 4 });
    // 已毕业也能在下拉框里选；没填姓名是空串
    expect(draftFromUser(user("gao_yuan"))).toMatchObject({ grade: "graduated" });
    expect(draftFromUser(user("yz_k3m9q2xa"))).toMatchObject({ real_name: "", grade: "" });
    expect(departmentOf({ department: { id: NO_DEPARTMENT, name: "无部门", tone: "ink" } })).toBeNull();
  });
  it("offers six departments and only the chosen department's titles, highest first", () => {
    expect(departmentChoices(MOCK_DEPARTMENTS).map(item => item.label)).toEqual(["AI部门", "算法部门", "硬件部门", "网安部门", "管理部门", "无部门"]);
    expect(departmentChoices(MOCK_DEPARTMENTS.filter(item => item.id !== NO_DEPARTMENT)).at(-1)).toEqual({ value: NO_DEPARTMENT, label: "无部门", tone: "ink" });
    expect(titleChoices(MOCK_DEPARTMENTS[0]).map(item => item.label)).toEqual(["部长", "副部长", "部员", "没有称号"]);
    expect(titleChoices(MOCK_DEPARTMENTS.find(item => item.id === NO_DEPARTMENT))).toEqual([]);
  });
  it("clears the title when the department changes, like the server does", () => {
    const draft = draftFromUser(user("he_miao"));
    expect(withDepartment(draft, "dept.algo")).toMatchObject({ department: "dept.algo", title: "" });
    expect(withDepartment(draft, "dept.ai")).toBe(draft);
  });
  it("sends only what changed; 无部门 goes out as null and the owner title rides along", () => {
    const target = user("he_miao");
    const draft = draftFromUser(target);
    expect(userPatch(target, draft)).toBeNull();
    expect(userPatch(target, { ...draft, level: "alumni" })).toEqual({ level: "alumni" });
    expect(userPatch(target, withDepartment(draft, NO_DEPARTMENT))).toEqual({ department: null, titles: [] });
    expect(userPatch(target, { ...draft, title: "title.ai.deputy" })).toEqual({ titles: ["title.ai.deputy"] });
    expect(userPatch(target, { ...draft, owner: true })).toEqual({ titles: ["title.ai.staff", SITE_OWNER_TITLE.id] });
    // 姓名和年级（#280）：改了才带；姓名清空不算修改；看不到姓名（没有这个键）时不带
    expect(userPatch(target, { ...draft, real_name: " 何淼 ", grade: 3 })).toEqual({ real_name: "何淼", grade: 3 });
    expect(userPatch(target, { ...draft, real_name: "" })).toBeNull();
    const { real_name: _hidden, ...withoutName } = target;
    expect(userPatch(withoutName, { ...draft, real_name: "何淼" })).toBeNull();
  });
  it("shows real names only to users.manage, and searches them only then (#280)", () => {
    as("owner");
    expect(list().items.find(item => item.username === "lu_mingyuan")).toMatchObject({ real_name: "陆明远", grade: 2, grade_label: "大二" });
    expect(list("?q=陆明远").items.map(item => item.username)).toEqual(["lu_mingyuan"]);
    as("ai_head");
    const scoped = list().items;
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every(item => !("real_name" in item) && "grade_label" in item)).toBe(true);
  });
  it("shows one title in the header: the site owner first, in its own fixed colour, department titles coloured by their department", () => {
    const owner = user("xu_yan");
    expect(primaryTitle(owner.titles)?.id).toBe(SITE_OWNER_TITLE.id);
    // 站长固定 pill 色（SPEC §1 / 服务端迁移种子），不跟着「无部门」的 ink 色走。
    expect(titleTone(owner.titles[0], owner.department)).toBe("pill");
    const head = user("li_xiaoman");
    expect(titleTone(head.titles[0], head.department)).toBe("y");
    expect(nameOf({ display_name: " ", username: "wu_yifan" })).toBe("wu_yifan");
  });
});

describe("user list filters", () => {
  it("reads only known values from the address bar and writes back what is set", () => {
    expect(userFiltersFromQuery({ q: " 陈 ", level: "member", department: "dept.ai", status: "disabled" })).toEqual({ q: "陈", level: "member", department: "dept.ai", status: "disabled" });
    expect(userFiltersFromQuery({ level: "visitor", department: "ai", status: "gone" })).toEqual({ q: "", level: "", department: "", status: "" });
    expect(usersParams({ q: "", level: "member", department: "", status: "" }, "20").toString()).toBe("level=member&cursor=20");
  });
  it("filters the preview list like the server, including 无部门", () => {
    as("owner");
    expect(list().items).toHaveLength(MOCK_USERS.length);
    expect(list("?department=dept.none").items.every(item => item.department === null)).toBe(true);
    expect(list("?status=disabled").items.map(item => item.username)).toEqual(["mo_chen"]);
    expect(list("?q=chen").items.map(item => item.username).sort()).toEqual(["chen_hang", "mo_chen"]);
    expect(list().counts).toMatchObject({ member: 14, alumni: 1, registered: 3 });
  });
  it("shows a department head only their own department", () => {
    as("ai_head");
    expect(new Set(list().items.map(item => item.department?.id))).toEqual(new Set(["dept.ai"]));
    expect(list().counts.member).toBe(4);
  });
  it("uses underscores in every preview username, like real usernames", () => {
    for (const item of MOCK_USERS) expect(item.username, item.username).toMatch(/^[a-z0-9_]+$/);
  });
});
