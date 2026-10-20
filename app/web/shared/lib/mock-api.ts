import { ApiError } from "./http";
// Development-only local fixtures. api() routes to this module when the data
// source is "mock" so the portal can be browsed without a backend.
// Never used in production builds (production forces "live").
// 控制台的样板数据在 app/console/src/mock（控制台是独立的 Vue 包）。

const now = Date.now();
const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** 北京时间那一天的 00:00:00.000 与 23:59:59.999：控制台只填日期，存下来的就是这两个点。 */
const dayStart = (at: number) => Math.floor((at + 8 * HOUR) / DAY) * DAY - 8 * HOUR;
const dayEnd = (at: number) => dayStart(at) + DAY - 1;

/**
 * 比赛样板（#265）：五种状态、内部外部、有无官网各有一场，日期都落在整天边界上（与控制台存的一样）。
 * 只写起止时间，状态由界面按同一套口径（`statusAt`）现算；e2e 与改前改后截图也用这一份（传入同一个 `at`）。
 */
export function demoCompetitions(at = Date.now()) {
  const day = (offset: number, edge: "start" | "end") => (edge === "start" ? dayStart : dayEnd)(at + offset * DAY);
  return [
    { id: "c1001", name: "秋季黑客松", kind: "internal", start_at: day(12, "start"), end_at: day(13, "end"), signup_deadline: day(5, "end"), url: null, description: "两天一夜，三到五人一队，现场公布题目。\n还没有队伍也可以先报名，组织者会帮忙组队。" },
    { id: "c1002", name: "2026 校内算法赛", kind: "internal", start_at: day(9, "start"), end_at: day(9, "end"), signup_deadline: day(2, "end"), url: null, description: "个人赛，三小时八道题，按 ACM 规则排名。前十名进入校队集训名单。" },
    { id: "c1003", name: "CCPC 2026 哈尔滨站", kind: "external", start_at: day(25, "start"), end_at: day(26, "end"), signup_deadline: day(1, "end"), url: "https://ccpc.io/", description: "中国大学生程序设计竞赛区域赛，三人一队，以学校名义报名：先在官网注册队伍，再由教练审核。" },
    { id: "c1004", name: "蓝桥杯 Web 应用开发", kind: "external", start_at: day(40, "start"), end_at: day(40, "end"), signup_deadline: null, url: "https://dasai.lanqiao.cn/", description: "省赛线上进行，个人参赛。报名时间以官网公布为准。" },
    { id: "c1005", name: "全国大学生数学建模竞赛", kind: "external", start_at: day(3, "start"), end_at: day(5, "end"), signup_deadline: day(-3, "end"), url: null, description: "三人一队，三天内完成一篇建模论文。" },
    { id: "c1006", name: "极客班 CTF 新生赛", kind: "internal", start_at: day(-1, "start"), end_at: day(1, "end"), signup_deadline: day(-2, "end"), url: null, description: "线上解题赛，Web、逆向、密码学都有入门题，做出一道就算入门。" },
    { id: "c1007", name: "春季编程挑战赛", kind: "internal", start_at: day(-40, "start"), end_at: day(-40, "end"), signup_deadline: day(-45, "end"), url: null, description: "" },
  ];
}
const demoOrg = "Yangtze-University-Geek-Class";

function route(path: string): unknown {
  const url = new URL(path, "http://mock.local");
  const pathname = url.pathname;

  if (pathname === "/api/docs") return { items: [{ id: "usage", label: "使用指南", lang: "zh" }, { id: "usage-en", label: "Usage", lang: "en" }] };
  if (pathname.startsWith("/api/docs/")) return { id: pathname.split("/").pop(), label: "使用指南", lang: pathname.endsWith("-en") ? "en" : "zh", file: "docs/ops/USAGE.md", content: "# 开发预览\n\n当前使用本地 mock 数据。" };
  if (pathname === "/api/feedback/categories") return { categories: ["建议", "Bug", "新功能", "其他"], pow_difficulty: 1, org: demoOrg };
  if (pathname === "/api/public/config") return { turnstile_site_key: null, pow_difficulty: 1 };
  if (pathname === "/api/feedback/public") return { items: [] };
  if (pathname === "/api/public/competitions") return { competitions: demoCompetitions(now) };
  if (pathname.startsWith("/api/join/")) return { valid: true, org: demoOrg, note: "开发预览邀请", expires_at: now + 864e5, remaining_uses: 23, pow_difficulty: 1 };

  throw new ApiError(404, "mock_route_missing", `开发预览未实现此接口：${pathname}`);
}

export async function mockApi<T>(path: string, init?: RequestInit): Promise<T> {
  if ((init?.method ?? "GET").toUpperCase() !== "GET") throw new ApiError(501, "mock_read_only", "开发预览为只读，操作验证请使用隔离测试或本地真实数据源");
  await new Promise((resolve) => setTimeout(resolve, 90));
  return structuredClone(route(path)) as T;
}
