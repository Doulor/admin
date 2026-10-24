// 操作记录页的纯函数（lib/activity）和开发预览的记录（mock/console），不挂载组件。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_FILTERS, OUTCOME_TEXT, SURFACE_TEXT, actionText, activityParams, actorText, bucketText, filtersFromQuery, filtersToQuery, rangeProblem, targetText,
} from "../../app/console/src/lib/activity";
import { routeConsole } from "../../app/console/src/mock/console";
import type { ActivityList } from "../../app/console/src/lib/types";

afterEach(() => vi.unstubAllGlobals());
const as = (persona: string) => vi.stubGlobal("window", { location: { search: `?__persona=${persona}` } });
const read = (query = "") => routeConsole(new URL(`/api/console/activity${query}`, "http://mock.local")) as ActivityList;

describe("activity filters", () => {
  it("names the six surfaces and four outcomes in Chinese", () => {
    expect(Object.values(SURFACE_TEXT)).toEqual(["官网", "论坛", "控制台", "命令行", "接口", "系统"]);
    expect(Object.values(OUTCOME_TEXT)).toEqual(["成功", "拒绝", "限流", "出错"]);
  });
  it("drops unknown surfaces, outcomes and malformed dates from the address bar", () => {
    expect(filtersFromQuery({ surface: "github", outcome: "maybe", from: "2026-13-01", to: "2026-10-24", action: " auth. " }))
      .toEqual({ ...EMPTY_FILTERS, to: "2026-10-24", action: "auth." });
    expect(filtersToQuery({ ...EMPTY_FILTERS, outcome: "limited", account: " " })).toEqual({ outcome: "limited" });
  });
  it("sends Beijing day edges, so one day means the whole day", () => {
    const params = activityParams({ ...EMPTY_FILTERS, from: "2026-10-24", to: "2026-10-24", surface: "forum" }, { cursor: "50" });
    expect(params.get("from")).toBe(String(Date.UTC(2026, 9, 23, 16)));
    expect(params.get("to")).toBe(String(Date.UTC(2026, 9, 24, 16) - 1));
    expect(params.toString()).toContain("surface=forum");
    expect(params.toString()).toContain("cursor=50");
    expect(rangeProblem({ from: "2026-10-25", to: "2026-10-24" })).toBe("开始日期晚于结束日期");
  });
  // #274：服务端 activityQuery 契约不认 `limit`（每页固定 50 条），传了会被拒绝；地址串不能再带它。
  it("never sends limit — the server contract does not accept it", () => {
    const params = activityParams({ ...EMPTY_FILTERS, surface: "forum" }, { cursor: "50" });
    expect(params.has("limit")).toBe(false);
  });
  it("writes actions, buckets, actors and targets plainly, falling back to the raw value", () => {
    expect(actionText("auth.signin")).toBe("登录");
    expect(actionText("perm.group.update")).toBe("权限");
    expect(actionText("x.y")).toBe("");
    expect(bucketText("apply.daily")).toBe("每天投递份数");
    expect(bucketText("forum.reply.hourly")).toBe("论坛");
    expect(bucketText("unknown")).toBe("");
    expect(actorText({ account: null, visitor_id: "v_8f3a2c61e0b94d7a" })).toEqual({ kind: "visitor", text: "访客 v_8f3a2c" });
    expect(actorText({ account: null, visitor_id: null })).toEqual({ kind: "system", text: "系统" });
    expect(targetText({ target_type: "topic", target_id: "128" })).toBe("topic · 128");
  });
});

describe("preview activity (mock)", () => {
  it("pages with a cursor, newest first", () => {
    as("owner");
    const first = read();
    expect(first.items).toHaveLength(50);
    expect(first.next_cursor).toBe("50");
    expect(first.items[0].at).toBeGreaterThanOrEqual(first.items[1].at);
    const second = read("?cursor=50");
    expect(second.next_cursor).toBeNull();
    expect(second.items.length).toBeGreaterThan(0);
  });
  // #274：Activity.vue 曾经一直带着 `limit=50`，服务端的 activityQuery 契约不认它，整页 400。
  // mock 现在和服务端一样拒绝契约之外的字段，不能再对着这种参数默默放行。
  it("rejects a query param the server contract doesn't have, like limit", () => {
    as("owner");
    expect(() => read("?limit=50")).toThrow(/additional properties/);
  });
  // 概览的「最近操作」也带过 `?limit=6`，同样整块 400：控制台源码里请求操作记录的地方都不许带 limit。
  it("no console page asks the activity API for a limit", () => {
    const root = join(__dirname, "../../app/console/src");
    const files = (readdirSync(root, { recursive: true }) as string[]).filter(name => /\.(vue|ts)$/.test(name) && !name.startsWith("mock"));
    const offenders = files.filter(name => /\/activity[^"'`]*[?&]limit=/.test(readFileSync(join(root, name), "utf8")));
    expect(offenders).toEqual([]);
  });
  it("filters by account, visitor, action prefix, surface, outcome and time", () => {
    as("owner");
    expect(read("?outcome=limited").items.every(row => row.outcome === "limited")).toBe(true);
    expect(read("?action=perm.").items.every(row => row.action.startsWith("perm."))).toBe(true);
    expect(read("?account=mock-chen_hang").items.every(row => row.account?.username === "chen_hang")).toBe(true);
    expect(read("?visitor=v_1d07e5b2a9c84f36").items.every(row => row.visitor_id === "v_1d07e5b2a9c84f36")).toBe(true);
    expect(read("?surface=cli").items.every(row => row.surface === "cli")).toBe(true);
    // #274：论坛、控制台也各自上报操作记录了，来源筛选要对这两个来源同样好用。
    expect(read("?surface=forum").items.every(row => row.surface === "forum")).toBe(true);
    expect(read("?surface=console").items.every(row => row.surface === "console")).toBe(true);
    expect(read("?surface=forum").items.length).toBeGreaterThan(0);
    expect(read("?surface=console").items.length).toBeGreaterThan(0);
    expect(read(`?from=${Date.now() - 60 * 60_000}`).items.every(row => row.at >= Date.now() - 60 * 60_000 - 1000)).toBe(true);
  });
  it("masks IPs without activity.read.ip and keeps them for the owner", () => {
    as("owner");
    expect(read().items[0].ip).not.toContain("*");
    as("management_head");
    // 管理部部长有 activity.*，也看得到完整 IP；部门部长只有 activity.read
    expect(read().items[0].ip).not.toContain("*");
    as("ai_head");
    for (const row of read().items) expect(row.ip ?? "a.b.*.*").toMatch(/^\d+\.\d+\.\*\.\*$/);
  });
  it("shows a department head only their department's accounts and no blocked counts", () => {
    as("ai_head");
    const { items, blocked_today } = read();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(row => ["li_xiaoman", "qin_lan", "he_miao", "fang_lin"].includes(row.account?.username ?? ""))).toBe(true);
    expect(blocked_today).toEqual([]);
  });
});
